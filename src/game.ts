// ===== 游戏主循环 =====
import type { GameState, NodeType } from './types';
import { TICK_INTERVAL, ENEMY_SPAWN_BASE_INTERVAL } from './data/runtime';
import { NODE_CONFIGS } from './data/nodes';
import type { Camera } from './types';
import { COLORS } from './ui-tokens';
import { distributeEnergy, initializeMap, processNodeEffects, decayDisconnectedEnergy, updateOvercharge, updateConnectedStatus } from './graph';
import type { TechBonuses } from './graph';
import { spawnEnemy, spawnBoss, updateEnemies } from './entities';
import { updateParticles, emitNodeParticles } from './particles';
import { Renderer } from './renderer';
import { UI } from './ui';
import { InputManager } from './input';
import { createTechState, getTechMultiplier } from './tech';
import type { TechState } from './tech';
import type { SaveProfile } from './save';
import { updateProfileStats, saveProfile } from './save';
import type { LevelConfig } from './levels';
import { initAudio, startBgm, stopBgm, sfxGameOver, sfxVictory } from './audio';
import { checkAchievements, clearNotifications } from './achievements';
import type { AchievementContext } from './achievements';
import { startTutorial, updateTutorial, skipTutorial, isTutorialDone } from './tutorial';

export class Game {
  // benchmark/调试需要从外部读取，故公开
  state: GameState;
  private renderer: Renderer;
  private ui: UI;
  private input: InputManager;
  private canvas: HTMLCanvasElement;
  private lastTime: number = 0;
  private tickAccumulator: number = 0;
  private animFrameId: number = 0;
  private techState: TechState;
  private profile: SaveProfile;
  private nodesBuilt: number = 0;
  private enemiesKilled: number = 0;
  private statsSaved: boolean = false;
  private levelConfig: LevelConfig | null;
  private selectedNodes: NodeType[] | null;
  private bossSpawned: boolean = false;
  private elapsedTime: number = 0;
  private onLevelEnd: ((won: boolean) => void) | null = null;
  private boundResize: (() => void) | null = null;
  private noCoreDamage: boolean = true;

  constructor(
    canvas: HTMLCanvasElement,
    profile: SaveProfile,
    levelConfig?: LevelConfig,
    selectedNodes?: NodeType[],
    onLevelEnd?: (won: boolean) => void,
  ) {
    this.canvas = canvas;
    this.profile = profile;
    this.levelConfig = levelConfig ?? null;
    this.selectedNodes = selectedNodes ?? null;
    this.onLevelEnd = onLevelEnd ?? null;

    this.state = this.createInitialState();
    this.techState = createTechState();
    this.renderer = new Renderer(this.canvas, this.state.worldWidth, this.state.worldHeight);
    this.ui = new UI(this.canvas.getContext('2d')!);
    this.ui.techState = this.techState;
    this.ui.unlockedAchievements = this.profile.unlockedAchievements ?? [];
    this.input = new InputManager(this.canvas, this.state, () => this.restart(), this.techState, this.ui);

    // 限制可用节点类型
    if (this.selectedNodes) {
      this.input.allowedNodeTypes = this.selectedNodes;
      this.ui.allowedNodeTypes = this.selectedNodes;
    }

    // 设置关卡目标提示文字
    if (this.levelConfig) {
      const obj = this.levelConfig.objective;
      const text: Record<string, string> = {
        survive: `目标：生存 ${this.levelConfig.targetWaves} 波`,
        boss: `目标：击败 Boss（第 ${this.levelConfig.bossWave} 波出现）`,
        protect: '目标：保护所有核心存活',
        timed: `目标：坚持 ${(this.levelConfig.timeLimit ?? 0) / 60 | 0} 分钟`,
      };
      this.ui.levelObjectiveText = text[obj] ?? '';
    }

    this.handleResize();
    this.boundResize = () => this.handleResize();
    window.addEventListener('resize', this.boundResize);

    const nodeCount = levelConfig?.nodeCount;
    const terrainCfg = levelConfig?.terrainConfig;
    initializeMap(this.state, nodeCount, terrainCfg);

    this.state.resources = levelConfig?.startResources ?? 100;
    this.state.crystals = levelConfig?.startCrystals ?? 0;
  }

  private createInitialState(): GameState {
    const worldWidth = this.levelConfig?.worldWidth ?? 3000;
    const worldHeight = this.levelConfig?.worldHeight ?? 2000;
    const camera: Camera = {
      x: worldWidth / 2 - window.innerWidth / 2,
      y: worldHeight / 2 - window.innerHeight / 2,
      zoom: 1,
      targetX: worldWidth / 2 - window.innerWidth / 2,
      targetY: worldHeight / 2 - window.innerHeight / 2,
      targetZoom: 1,
    };
    return {
      nodes: [],
      edges: [],
      enemies: [],
      particles: [],
      flowParticles: [],
      projectiles: [],
      tick: 0,
      wave: 1,
      score: 0,
      resources: 100,
      crystals: 0,
      gameOver: false,
      levelWon: false,
      paused: false,
      selectedNodeId: null,
      selectedNodeIds: [],
      draggingFrom: null,
      selectedEdgeType: 'standard',
      mouseX: 0,
      mouseY: 0,
      canvasWidth: window.innerWidth,
      canvasHeight: window.innerHeight,
      worldWidth,
      worldHeight,
      camera,
      terrainZones: [],
      timeScale: 1,
      weatherClouds: [],
      screenShake: 0,
    };
  }

  private handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.state.canvasWidth = w;
    this.state.canvasHeight = h;
    this.renderer.resize(w, h);
  }

  restart(): void {
    this.state.nodes = [];
    this.state.edges = [];
    this.state.enemies = [];
    this.state.particles = [];
    this.state.flowParticles = [];
    this.state.projectiles = [];
    this.state.tick = 0;
    this.state.wave = 1;
    this.state.score = 0;
    this.state.resources = 100;
    this.state.crystals = 0;
    this.state.gameOver = false;
    this.state.levelWon = false;
    this.state.paused = false;
    this.state.selectedNodeId = null;
    this.state.selectedNodeIds = [];
    this.state.draggingFrom = null;
    this.state.timeScale = 1;
    this.state.weatherClouds = [];

    this.techState = createTechState();
    this.ui.techState = this.techState;
    this.input.techState = this.techState;

    this.nodesBuilt = 0;
    this.enemiesKilled = 0;
    this.statsSaved = false;
    this.bossSpawned = false;
    this.elapsedTime = 0;
    this.noCoreDamage = true;

    const nodeCount = this.levelConfig?.nodeCount;
    const terrainCfg = this.levelConfig?.terrainConfig;
    initializeMap(this.state, nodeCount, terrainCfg);
    this.state.resources = this.levelConfig?.startResources ?? 100;
    this.state.crystals = this.levelConfig?.startCrystals ?? 0;
  }

  start(): void {
    initAudio();
    startBgm();
    clearNotifications();
    // 首次进入第1关时启动教程
    if (this.levelConfig?.id === 1 && !isTutorialDone()) {
      startTutorial();
      this.state.paused = true; // 教程开始时暂停
    }
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
    this.input.destroy();
    stopBgm();
    if (this.boundResize) {
      window.removeEventListener('resize', this.boundResize);
    }
  }

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // 限制 delta 防止跳帧
    this.lastTime = timestamp;

    if (!this.state.paused && !this.state.gameOver && !this.state.levelWon) {
      this.update(dt);
    }

    // 游戏结束或关卡胜利时保存统计 + 成就检测
    if ((this.state.gameOver || this.state.levelWon) && !this.statsSaved) {
      this.statsSaved = true;
      if (this.state.levelWon) sfxVictory();
      else sfxGameOver();
      updateProfileStats(this.profile, this.state.score, this.state.wave, this.enemiesKilled, this.nodesBuilt);
      if (this.state.levelWon && this.levelConfig) {
        // 记录通关的关卡
        if (!this.profile.clearedLevels) this.profile.clearedLevels = [];
        if (!this.profile.clearedLevels.includes(this.levelConfig.id)) {
          this.profile.clearedLevels.push(this.levelConfig.id);
        }
      }

      // 成就检测
      const nodeTypeCounts: Record<string, number> = {};
      for (const n of this.state.nodes) {
        nodeTypeCounts[n.type] = (nodeTypeCounts[n.type] ?? 0) + 1;
      }
      const allCoresFull = this.state.nodes
        .filter(n => n.type === 'core')
        .every(n => n.hp >= n.maxHp);
      const achCtx: AchievementContext = {
        score: this.state.score,
        wave: this.state.wave,
        enemiesKilled: this.enemiesKilled,
        nodesBuilt: this.nodesBuilt,
        levelWon: this.state.levelWon,
        gameOver: this.state.gameOver,
        levelId: this.levelConfig?.id ?? null,
        totalEnemiesKilled: this.profile.stats.totalEnemiesKilled,
        totalNodesBuilt: this.profile.stats.totalNodesBuilt,
        clearedLevels: this.profile.clearedLevels,
        nodeTypeCounts,
        noCoreDamage: allCoresFull && this.noCoreDamage,
      };
      if (!this.profile.unlockedAchievements) this.profile.unlockedAchievements = [];
      checkAchievements(achCtx, this.profile.unlockedAchievements);
      this.ui.unlockedAchievements = this.profile.unlockedAchievements;

      saveProfile(this.profile);
      if (this.onLevelEnd) {
        // 延迟回调，让玩家看到结果
        setTimeout(() => this.onLevelEnd!(this.state.levelWon), 3000);
      }
    }

    this.render(dt);

    this.animFrameId = requestAnimationFrame(t => this.loop(t));
  }

  private update(dt: number): void {
    // 摄像机平滑插值
    // 位移用较快的指数缓动以保持响应感；缩放用更慢的曲线避免突兀
    const cam = this.state.camera;
    const moveLerp = 1 - Math.pow(0.001, dt);   // ~每帧 10% 收敛
    const zoomLerp = 1 - Math.pow(0.02, dt);    // ~每帧 6% 收敛，过渡更柔和
    cam.x += (cam.targetX - cam.x) * moveLerp;
    cam.y += (cam.targetY - cam.y) * moveLerp;
    cam.zoom += (cam.targetZoom - cam.zoom) * zoomLerp;

    // Tick 系统
    this.tickAccumulator += dt * 1000 * this.state.timeScale;
    while (this.tickAccumulator >= TICK_INTERVAL) {
      this.tickAccumulator -= TICK_INTERVAL;
      this.state.tick++;

      // 能量分发
      distributeEnergy(this.state);

      // 更新节点连接状态
      updateConnectedStatus(this.state);

      // 未连接节点能量衰减
      decayDisconnectedEnergy(this.state);

      // 能量超载检测
      updateOvercharge(this.state);

      // 节点效果
      const techBonuses: TechBonuses = {
        damageMultiplier: getTechMultiplier(this.techState, 'boost_damage'),
        rangeMultiplier: getTechMultiplier(this.techState, 'turret_range'),
        coreProduction: getTechMultiplier(this.techState, 'core_production'),
      };
      processNodeEffects(this.state, techBonuses);

      // 科技树效果：自动修复
      const autoRepair = getTechMultiplier(this.techState, 'auto_repair');
      if (autoRepair > 0) {
        for (const node of this.state.nodes) {
          if (node.status !== 'destroyed' && node.hp < node.maxHp) {
            node.hp = Math.min(node.maxHp, node.hp + autoRepair);
            if (node.hp > node.maxHp * 0.5 && node.status === 'damaged') {
              node.status = 'normal';
            }
          }
        }
      }

      // 敌人生成（开局20秒空窗期 = 40 tick）
      const GRACE_PERIOD = 40;
      const diff = this.levelConfig?.difficultyMult ?? 1;
      const spawnInterval = Math.max(3, ENEMY_SPAWN_BASE_INTERVAL - Math.floor(this.state.wave / 2));
      if (this.state.tick >= GRACE_PERIOD && this.state.tick % spawnInterval === 0) {
        spawnEnemy(this.state, diff);
      }

      // Boss 生成
      if (this.levelConfig?.hasBoss && !this.bossSpawned && this.state.wave >= this.levelConfig.bossWave) {
        this.bossSpawned = true;
        spawnBoss(this.state, diff);
      }

      // 波次递增
      if (this.state.tick % 30 === 0) {
        this.state.wave++;
      }

      // 关卡胜利条件检测
      this.checkVictoryCondition();

      // 天气系统 — 星云飘过
      this.updateWeather();
    }

    // 限时模式计时
    this.elapsedTime += dt;

    // 敌人移动 & 战斗
    const enemiesBefore = this.state.enemies.length;
    updateEnemies(this.state, dt);
    const killed = enemiesBefore - this.state.enemies.length;
    if (killed > 0) this.enemiesKilled += killed;

    // 核心受损检测（成就用）
    if (this.noCoreDamage) {
      for (const n of this.state.nodes) {
        if (n.type === 'core' && n.hp < n.maxHp) {
          this.noCoreDamage = false;
          break;
        }
      }
    }

    // 粒子更新
    updateParticles(this.state, dt);
    emitNodeParticles(this.state);

    // 教程条件检测
    updateTutorial(this.state);

    // 受击闪光衰减（每帧）
    for (const node of this.state.nodes) {
      if (node.hitFlash > 0) {
        node.hitFlash = Math.max(0, node.hitFlash - 3 * dt);
      }
    }
    for (const enemy of this.state.enemies) {
      if (enemy.hitFlash > 0) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - 4 * dt);
      }
    }
  }

  private checkVictoryCondition(): void {
    if (!this.levelConfig) return;
    const lc = this.levelConfig;

    switch (lc.objective) {
      case 'survive':
        if (this.state.wave > lc.targetWaves) {
          this.state.levelWon = true;
        }
        break;
      case 'boss':
        // Boss 已生成且已被击杀
        if (this.bossSpawned && !this.state.enemies.some(e => e.type === 'boss')) {
          this.state.levelWon = true;
        }
        break;
      case 'timed':
        if (lc.timeLimit > 0 && this.elapsedTime >= lc.timeLimit) {
          // 时间到：存活 = 胜利
          this.state.levelWon = true;
        }
        break;
      case 'protect':
        if (this.state.wave > lc.targetWaves) {
          // 所有核心存活
          const allCoresAlive = this.state.nodes.filter(
            n => n.type === 'core' && n.status !== 'destroyed'
          ).length === this.state.nodes.filter(n => n.type === 'core').length;
          if (allCoresAlive) {
            this.state.levelWon = true;
          }
        }
        break;
    }
  }

  private render(dt: number): void {
    this.renderer.render(this.state, dt);
    this.ui.selectedEdgeType = this.state.selectedEdgeType;
    this.ui.render(this.state);

    // 建造模式指示
    const buildMode = this.input.getBuildMode();
    if (buildMode) {
      this.drawBuildCursor(buildMode);
    }

    // 框选矩形
    if (this.input.boxSelectStart && this.input.boxSelectEnd) {
      this.drawBoxSelect();
    }
  }

  private drawBuildCursor(type: string): void {
    const ctx = this.canvas.getContext('2d')!;
    const cfg = NODE_CONFIGS[type as keyof typeof NODE_CONFIGS];
    if (!cfg) return;

    const cam = this.state.camera;
    const sx = (this.state.mouseX - cam.x) * cam.zoom;
    const sy = (this.state.mouseY - cam.y) * cam.zoom;
    const r = cfg.radius * cam.zoom;

    const status = this.input.getBuildPlacementStatus();
    const valid = status?.valid ?? false;
    const color = valid ? '#44ff88' : COLORS.accent.red;

    ctx.save();

    // 半透明填充
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = valid ? 'rgba(68,255,136,0.08)' : 'rgba(255,68,68,0.08)';
    ctx.fill();

    // 虚线外圈
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 十字准星
    ctx.strokeStyle = valid ? 'rgba(68,255,136,0.4)' : 'rgba(255,68,68,0.4)';
    ctx.lineWidth = 1;
    const cross = 6;
    ctx.beginPath();
    ctx.moveTo(sx - cross, sy); ctx.lineTo(sx + cross, sy);
    ctx.moveTo(sx, sy - cross); ctx.lineTo(sx, sy + cross);
    ctx.stroke();

    // 标签
    ctx.fillStyle = color;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    const costText = status ? `${status.cost}◆` : '';
    const discountText = status && status.discount > 0 ? ` (-${Math.round(status.discount * 100)}%)` : '';
    const label = cfg.description?.split(' - ')[0] ?? type;
    ctx.fillText(`${label} ${costText}${discountText}`, sx, sy - r - 14);

    // 无效原因
    if (status && !status.valid) {
      ctx.fillStyle = COLORS.accent.redSoft;
      ctx.font = '10px monospace';
      ctx.fillText(status.reason, sx, sy - r - 2);
    }

    ctx.restore();
  }

  /** 天气系统 — 随机生成 & 移动星云 */
  private updateWeather(): void {
    const s = this.state;
    // 每 20 tick 有概率生成一朵云 (最多 5 朵)
    if (s.tick % 20 === 0 && s.weatherClouds.length < 3 && Math.random() < 0.35) {
      const edge = Math.random() < 0.5; // 从左/右边进入
      s.weatherClouds.push({
        x: edge ? -200 : s.worldWidth + 200,
        y: Math.random() * s.worldHeight,
        radius: 180 + Math.random() * 220,
        vx: (edge ? 1 : -1) * (0.8 + Math.random() * 1.2),
        vy: (Math.random() - 0.5) * 0.6,
        opacity: 0.4 + Math.random() * 0.3,
        life: 300 + Math.floor(Math.random() * 200),
      });
    }
    // 移动 & 衰减
    for (let i = s.weatherClouds.length - 1; i >= 0; i--) {
      const c = s.weatherClouds[i];
      c.x += c.vx;
      c.y += c.vy;
      c.life--;
      if (c.life <= 0 || c.x < -500 || c.x > s.worldWidth + 500) {
        s.weatherClouds.splice(i, 1);
      }
    }
  }

  private drawBoxSelect(): void {
    const start = this.input.boxSelectStart!;
    const end = this.input.boxSelectEnd!;
    const cam = this.state.camera;
    const ctx = this.canvas.getContext('2d')!;

    // 世界坐标 → 屏幕坐标
    const sx1 = (start.x - cam.x) * cam.zoom;
    const sy1 = (start.y - cam.y) * cam.zoom;
    const sx2 = (end.x - cam.x) * cam.zoom;
    const sy2 = (end.y - cam.y) * cam.zoom;
    const rx = Math.min(sx1, sx2);
    const ry = Math.min(sy1, sy2);
    const rw = Math.abs(sx2 - sx1);
    const rh = Math.abs(sy2 - sy1);

    ctx.save();
    // 半透明填充
    ctx.fillStyle = 'rgba(0,255,136,0.08)';
    ctx.fillRect(rx, ry, rw, rh);
    // 虚线边框
    ctx.strokeStyle = 'rgba(0,255,136,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
    ctx.restore();
  }
}