import { secondaryObjectiveStatus } from './mission-objectives';
import { pilotStep } from './benchmark-pilot';
import { isFrontierStrategy, frontierPilotBlock } from './frontier-pilot';
import { frontierStatus } from './frontier';
import type { BenchStrategy } from './benchmark-pilot';
import { upgradeNode } from './construction';
import type { TechState } from './tech';
// ===== Benchmark Headless Runner（Phase B-2） =====
// 用法：?bench=1&seed=12345&level=1&waves=10&speed=4[&nodes=energy,turret,mine,shield,relay]
//
// 行为：
// 1) main.ts 检测到 bench=1 时跳过 LoginScreen / LevelSelect / NodeSelect / Cutscene，
//    直接构造匿名 profile + 指定 level + 节点池启动 Game
// 2) 锁定 timeScale 为指定 speed（默认 4×）
// 3) 监听 game.state，达到目标条件（wave >= waves / gameOver / levelWon）后采集统计
// 4) 结果写入 console.info 并挂到 window.__benchResult
// 5) seed=0 时 rand() 自动回退 Math.random，结果不可复现，但仍可作为压测

import { Game } from './game';
import { LEVELS, recommendedLoadout } from './levels';
import type { LevelConfig } from './levels';
import type { GameNode, NodeType } from './types';
import type { SaveProfile } from './save';
import { NODE_CONFIGS } from './data';

export interface BenchParams {
  enabled: boolean;
  seed: number;
  levelId: number;
  targetWaves: number;
  speed: number;
  nodes: NodeType[];
  /** §27：bench 启用 auto-upgrade 策略，每 60 tick 把资源花在升级最低 level 的连接 turret/shield 上 */
  autoUpgrade: boolean;
  strategy: BenchStrategy;
}

export interface BenchWaveSample {
  /** 该样本对应的波次（结束波快照时为刚结束的波；最终样本为当前进行中的波） */
  wave: number;
  /** 抓样时刻的 game.state.tick */
  tick: number;
  /** 抓样时刻的累计分数 */
  score: number;
  /** 抓样时刻的节点数 */
  nodeCount: number;
  /** 抓样时刻的敌人数 */
  enemyCount: number;
  /** 抓样时刻距 benchmark 启动的实际毫秒 */
  elapsedMs: number; /** §25 instrumentation：局内累计击杀数 */
  kills: number;
  /** §25 instrumentation：局内累计玩家建造节点数 */
  built: number;
  /** §25 instrumentation：局内累计资源花费 */
  spent: number; /** 样本类型：wave_end = 上一波结束瞬间；final = 局终（含 won/gameover/reached_target） */
  kind: 'wave_end' | 'final';
}

export interface BenchResult {
  strategy?: BenchStrategy;
  frontier?: {
    completionSeconds:number;
    progress:number;
    harvested:number;
    stations:Record<string,number>;
    netSpend:number;
    turretCount:number;
    minCoreIntegrity:number;
    linkLength:number;
    powerWaitTicks:number;
    workingTicks:number;
    pilotBlock:string;
  };
  seed: number;
  levelId: number;
  targetWaves: number;
  speed: number;
  reachedWave: number;
  finalScore: number;
  totalTicks: number;
  finalNodeCount: number;
  finalEnemyCount: number;
  network?: {
    owned: number;
    connected: number;
    underpowered: number;
    liveCores: number;
    secondaryComplete: boolean;
    secondaryReached: boolean;
    resourcesRemaining: number;
  };
  performance?: {
    frames: number;
    averageSimulationMs: number;
    averageRenderMs: number;
    longFrames: number;
  };
  outcome: 'won' | 'gameover' | 'reached_target';
  elapsedMs: number;
  /** §32 instrumentation：终局节点统计（level 分布 + evolved 计数） */
  nodeStats?: {
    /** 按 type 累计 evolved 数 */
    evolvedByType: Record<string, number>;
    /** 按 level (1..5) 统计节点总数（不含 core / destroyed） */
    levelDist: Record<string, number>;
    /** 按 type 统计节点数（不含 destroyed） */
    countByType: Record<string, number>;
  };
  /** 每波时序样本（Phase B-2 第二轮：perWave dump） */
  perWave: BenchWaveSample[];
}

declare global {
  interface Window {
    __benchResult?: BenchResult;
  }
}

const DEFAULT_NODES: NodeType[] = ['energy', 'turret', 'mine', 'shield', 'relay'];

export function parseBenchParams(): BenchParams {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      seed: 0,
      levelId: 1,
      targetWaves: 10,
      speed: 4,
      nodes: DEFAULT_NODES,
      autoUpgrade: false,
      strategy: 'idle',
    };
  }
  const sp = new URLSearchParams(window.location.search);
  const enabled = sp.get('bench') === '1';
  const seed = parseInt(sp.get('seed') ?? '0', 10) || 0;
  const levelId = parseInt(sp.get('level') ?? '1', 10) || 1;
  const targetWaves = parseInt(sp.get('waves') ?? '10', 10) || 10;
  const speed = parseFloat(sp.get('speed') ?? '4') || 4;
  const nodesStr = sp.get('nodes');
  const nodes: NodeType[] =
    nodesStr === 'recommended'
      ? recommendedLoadout(LEVELS.find((l) => l.id === levelId) ?? LEVELS[0])
      : nodesStr
        ? (nodesStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean) as NodeType[])
        : DEFAULT_NODES;
  // §27：默认 off，必须显式 ?autoUpgrade=1 开启；保持旧 sweep 可复现
  const autoUpgrade = sp.get('autoUpgrade') === '1';
  if (nodes.some((type) => !Object.hasOwn(NODE_CONFIGS, type)))
    throw new Error('基准节点池包含未知类型');
  const requested = sp.get('strategy');
  const strategy: BenchStrategy =
    requested === 'defend' || requested === 'scout' || isFrontierStrategy(requested) ? requested : 'idle';
  return { enabled, seed, levelId, targetWaves, speed, nodes, autoUpgrade, strategy };
}

/**
 * §27/§31/§33 auto-upgrade 策略：模拟"会玩"的玩家把资源花在升级上。
 * §33 养精兵：同 type 内按 level DESC 排序，单节点 upgrade→evolve 一气呵成，
 * 再轮到下一个；避免雨露均沾导致 evolve 池常空。
 * 跨 type 优先级：turret > shield > 其它（core 跳过）。
 */
function tickAutoUpgrade(state: import('./types').GameState, tech: TechState): void {
  const nodes = state.nodes
    .filter(
      (n) => n.owner === 'player' && n.connected && n.type !== 'core' && n.status !== 'destroyed',
    )
    .sort(
      (a, b) =>
        (a.type === 'turret' ? -1 : 0) - (b.type === 'turret' ? -1 : 0) || b.level - a.level,
    );
  for (const node of nodes)
    while (upgradeNode(state, node, tech).ok) {
      /* One canonical upgrade/evolution rule. */
    }
}

/** §32 instrumentation：从最终 state.nodes 提取 evolved / level / type 统计 */
function collectNodeStats(nodes: GameNode[]): NonNullable<BenchResult['nodeStats']> {
  const evolvedByType: Record<string, number> = {};
  const levelDist: Record<string, number> = {};
  const countByType: Record<string, number> = {};
  for (const n of nodes) {
    if (n.status === 'destroyed' || n.owner !== 'player') continue;
    if (n.type === 'core') continue;
    countByType[n.type] = (countByType[n.type] ?? 0) + 1;
    const lk = String(n.level);
    levelDist[lk] = (levelDist[lk] ?? 0) + 1;
    if (n.evolved) evolvedByType[n.type] = (evolvedByType[n.type] ?? 0) + 1;
  }
  return { evolvedByType, levelDist, countByType };
}

/** 构造一个匿名 profile，避免污染存档 */
function makeAnonymousProfile(): SaveProfile {
  return {
    name: '__bench__',
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    stats: {
      highScore: 0,
      highWave: 0,
      totalGamesPlayed: 0,
      totalEnemiesKilled: 0,
      totalNodesBuilt: 0,
    },
    unlockedTechs: [],
    currentLevel: 1,
    clearedLevels: [],
    unlockedAchievements: [],
    discoveredSynergies: [],
  };
}

/** 启动 benchmark；调用方须保证 setSeed 已先于本函数执行 */
export function runBenchmark(canvas: HTMLCanvasElement, params: BenchParams): void {
  const level: LevelConfig = LEVELS.find((l) => l.id === params.levelId) ?? LEVELS[0];
  const profile = makeAnonymousProfile();

  // 关 1 首次进入会触发教程并把 state.paused 置 true，benchmark 必须绕开

  console.info(
    `[bench] start seed=${params.seed} level=${level.id}(${level.name}) waves=${params.targetWaves} speed=${params.speed}× nodes=${params.nodes.join(',')} autoUpgrade=${params.autoUpgrade ? 1 : 0}`,
  );

  const t0 = performance.now();
  const game = new Game(canvas, profile, level, params.nodes, () => {
    // onLevelEnd 由 game 在 won/lost 时触发；轮询逻辑会在下一帧捕获并 dump
  });
  game.start({ audio: false, tutorial: false, pauseOnHidden: false });
  game.state.timeScale = params.speed;

  const perWave: BenchWaveSample[] = [];
  let lastWave = game.state.wave;
  let lastUpgradeTick = -1;
  let lastPilotTick = -2;
  let secondaryReached = false;

  const poll = (): void => {
    const s = game.state;
    secondaryReached ||= secondaryObjectiveStatus(s)?.complete ?? true;
    // 持续锁定 speed，防止任何 UI 重置
    if (s.timeScale !== params.speed) s.timeScale = params.speed;
    // 防御：若任何 UI 路径把 state.paused 置 true（教程/对话框），强制取消
    if (s.paused) s.paused = false;

    // §27 auto-upgrade：每 60 tick 触发一次（约 1s @60fps）
    if (params.autoUpgrade && s.tick - lastUpgradeTick >= 60) {
      tickAutoUpgrade(s, game.techState);
      lastUpgradeTick = s.tick;
    }

    if (params.strategy !== 'idle' && s.tick - lastPilotTick >= 2) {
      pilotStep(s, game.techState, params.nodes, params.strategy);
      lastPilotTick = s.tick;
    }

    // wave 切换瞬间：把"刚刚结束的那一波"打个快照
    if (s.wave !== lastWave) {
      perWave.push({
        wave: lastWave,
        tick: s.tick,
        score: s.score,
        nodeCount: s.nodes.length,
        enemyCount: s.enemies.length,
        elapsedMs: Math.round(performance.now() - t0),
        kills: s.enemiesKilled,
        built: s.nodesBuilt,
        spent: s.resourcesSpent,
        kind: 'wave_end',
      });
      lastWave = s.wave;
    }

    let outcome: BenchResult['outcome'] | null = null;
    if (s.levelWon) outcome = 'won';
    else if (s.gameOver) outcome = 'gameover';
    else if (s.wave >= params.targetWaves) outcome = 'reached_target';

    if (outcome) {
      const elapsedMs = Math.round(performance.now() - t0);
      perWave.push({
        wave: s.wave,
        tick: s.tick,
        score: s.score,
        nodeCount: s.nodes.length,
        enemyCount: s.enemies.length,
        elapsedMs,
        kills: s.enemiesKilled,
        built: s.nodesBuilt,
        spent: s.resourcesSpent,
        kind: 'final',
      });
      const result: BenchResult = {
        strategy:params.strategy,
        frontier:s.frontier ? {
          completionSeconds:s.elapsedSeconds,
          progress:frontierStatus(s)?.ratio??0,
          harvested:s.frontier.harvested,
          stations:{...s.frontier.progress},
          netSpend:s.resourcesSpent-s.frontier.recovered,
          turretCount:s.nodes.filter(n=>n.type==='turret'&&n.owner==='player'&&n.status!=='destroyed').length,
          minCoreIntegrity:Math.min(...s.nodes.filter(n=>n.type==='core'&&n.owner==='player').map(n=>Math.max(0,n.hp/n.maxHp))),
          linkLength:s.edges.reduce((sum,e)=>{const a=s.nodes.find(n=>n.id===e.sourceId)!,b=s.nodes.find(n=>n.id===e.targetId)!;return sum+Math.hypot(a.x-b.x,a.y-b.y);},0),
          powerWaitTicks:s.frontier.powerWaitTicks,
          workingTicks:s.frontier.workingTicks,
          pilotBlock:frontierPilotBlock(s),
        } : undefined,
        seed: params.seed,
        levelId: level.id,
        targetWaves: params.targetWaves,
        speed: params.speed,
        reachedWave: s.wave,
        finalScore: s.score,
        totalTicks: s.tick,
        finalNodeCount: s.nodes.length,
        finalEnemyCount: s.enemies.length,
        outcome,
        elapsedMs,
        network: {
          owned: s.nodes.filter((n) => n.owner === 'player' && n.status !== 'destroyed').length,
          connected: s.nodes.filter(
            (n) => n.owner === 'player' && n.connected && n.status !== 'destroyed',
          ).length,
          underpowered: s.nodes.filter(
            (n) =>
              n.owner === 'player' &&
              n.connected &&
              n.status !== 'destroyed' &&
              n.currentEnergy < n.activationThreshold,
          ).length,
          liveCores: s.nodes.filter((n) => n.type === 'core' && n.status !== 'destroyed').length,
          secondaryComplete: secondaryObjectiveStatus(s)?.complete ?? true,
          secondaryReached,
          resourcesRemaining: s.resources,
        },
        performance: {
          frames: game.metrics.frames,
          averageSimulationMs: game.metrics.updateMs / Math.max(1, game.metrics.frames),
          averageRenderMs: game.metrics.renderMs / Math.max(1, game.metrics.frames),
          longFrames: game.metrics.longFrames,
        },
        nodeStats: collectNodeStats(s.nodes),
        perWave,
      };
      window.__benchResult = result;
      console.info('[bench] result', result);
      console.info('[bench] JSON:', JSON.stringify(result));
      game.stop();
      return;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
