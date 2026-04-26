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
import { LEVELS } from './levels';
import type { LevelConfig } from './levels';
import type { NodeType } from './types';
import type { SaveProfile } from './save';

export interface BenchParams {
  enabled: boolean;
  seed: number;
  levelId: number;
  targetWaves: number;
  speed: number;
  nodes: NodeType[];
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
  elapsedMs: number;
  /** 样本类型：wave_end = 上一波结束瞬间；final = 局终（含 won/gameover/reached_target） */
  kind: 'wave_end' | 'final';
}

export interface BenchResult {
  seed: number;
  levelId: number;
  targetWaves: number;
  speed: number;
  reachedWave: number;
  finalScore: number;
  totalTicks: number;
  finalNodeCount: number;
  finalEnemyCount: number;
  outcome: 'won' | 'gameover' | 'reached_target';
  elapsedMs: number;
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
    return { enabled: false, seed: 0, levelId: 1, targetWaves: 10, speed: 4, nodes: DEFAULT_NODES };
  }
  const sp = new URLSearchParams(window.location.search);
  const enabled = sp.get('bench') === '1';
  const seed = parseInt(sp.get('seed') ?? '0', 10) || 0;
  const levelId = parseInt(sp.get('level') ?? '1', 10) || 1;
  const targetWaves = parseInt(sp.get('waves') ?? '10', 10) || 10;
  const speed = parseFloat(sp.get('speed') ?? '4') || 4;
  const nodesStr = sp.get('nodes');
  const nodes: NodeType[] = nodesStr
    ? (nodesStr.split(',').map(s => s.trim()).filter(Boolean) as NodeType[])
    : DEFAULT_NODES;
  return { enabled, seed, levelId, targetWaves, speed, nodes };
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
  };
}

/** 启动 benchmark；调用方须保证 setSeed 已先于本函数执行 */
export function runBenchmark(canvas: HTMLCanvasElement, params: BenchParams): void {
  const level: LevelConfig = LEVELS.find(l => l.id === params.levelId) ?? LEVELS[0];
  const profile = makeAnonymousProfile();

  // 关 1 首次进入会触发教程并把 state.paused 置 true，benchmark 必须绕开
  try { localStorage.setItem('starfield_nodes_tutorial_done', '1'); } catch { /* ignore */ }

  console.info(`[bench] start seed=${params.seed} level=${level.id}(${level.name}) waves=${params.targetWaves} speed=${params.speed}× nodes=${params.nodes.join(',')}`);

  const t0 = performance.now();
  const game = new Game(canvas, profile, level, params.nodes, () => {
    // onLevelEnd 由 game 在 won/lost 时触发；轮询逻辑会在下一帧捕获并 dump
  });
  game.start();
  game.state.timeScale = params.speed;

  const perWave: BenchWaveSample[] = [];
  let lastWave = game.state.wave;

  const poll = (): void => {
    const s = game.state;
    // 持续锁定 speed，防止任何 UI 重置
    if (s.timeScale !== params.speed) s.timeScale = params.speed;
    // 防御：若任何 UI 路径把 state.paused 置 true（教程/对话框），强制取消
    if (s.paused) s.paused = false;

    // wave 切换瞬间：把"刚刚结束的那一波"打个快照
    if (s.wave !== lastWave) {
      perWave.push({
        wave: lastWave,
        tick: s.tick,
        score: s.score,
        nodeCount: s.nodes.length,
        enemyCount: s.enemies.length,
        elapsedMs: Math.round(performance.now() - t0),
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
        kind: 'final',
      });
      const result: BenchResult = {
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
