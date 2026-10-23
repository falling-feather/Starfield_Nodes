import { rand } from './rng';
import { drawFacility } from './facility-art';
// ===== 游戏主循环 =====
import type { GameState, NodeType } from './types';
import { TICK_INTERVAL, ENEMY_SPAWN_BASE_INTERVAL, GRACE_PERIOD_TICKS } from './data/runtime';
import { NODE_CONFIGS } from './data/nodes';
import type { Camera } from './types';
import { SimulationClock } from './simulation-clock';
import { createInitialCamera } from './camera';
import { createVisibility, updateVisibility } from './visibility';
import { processMissionEvents } from './mission-events';
import { objectiveLabel } from './presentation';
import { missionOutcome } from './mission-objectives';
import { advanceFrontier } from './frontier';
import { COLORS } from './ui-tokens';
import {
  distributeEnergy,
  initializeMap,
  processNodeEffects,
  decayDisconnectedEnergy,
  updateOvercharge,
  updateConnectedStatus,
} from './graph';
import type { TechBonuses } from './graph';
import { spawnEnemy, spawnBoss, updateEnemies, processEnemySupport } from './entities';
import { updateParticles, emitNodeParticles } from './particles';
import { Renderer } from './renderer';
import { UI } from './ui';
import { InputManager } from './input';
import { createTechState, getTechMultiplier, getMaxEdgeLength } from './tech';
import type { TechState } from './tech';
import type { SaveProfile } from './save';
import { updateProfileStats, saveProfile } from './save';
import type { LevelConfig } from './levels';
import { initAudio, startBgm, stopBgm, sfxGameOver, sfxVictory } from './audio';
import { checkAchievements, clearNotifications } from './achievements';
import type { AchievementContext } from './achievements';
import {
  startTutorial,
  updateTutorial,
  isTutorialDone,
  isTutorialActive,
  checkLoreTipsForLevel,
  checkChallengeTips,
  getCompletedChallengeCount,
} from './tutorial';

export class Game {
  // benchmark/调试需要从外部读取，故公开
  state: GameState;
  readonly metrics = { frames: 0, updateMs: 0, renderMs: 0, longFrames: 0 };
  private renderer: Renderer;
  private ui: UI;
  private input: InputManager;
  private canvas: HTMLCanvasElement;
  private lastTime: number = 0;
  private tickAccumulator: number = 0;
  private animFrameId: number = 0;
  techState: TechState;
  private profile: SaveProfile;
  private statsSaved: boolean = false;
  private levelConfig: LevelConfig | null;
  private selectedNodes: NodeType[] | null;
  private bossSpawned: boolean = false;
  private readonly clock = new SimulationClock();
  private onLevelEnd: ((won: boolean) => void) | null = null;
  private onExitToLevelSelect: (() => void) | null = null;
  private onExitToTitle: (() => void) | null = null;
  private boundResize: (() => void) | null = null;
  private boundVisibility: (() => void) | null = null;
  private _challengeTipTick: number = 0;
  private noCoreDamage: boolean = true;
  /** V1.2.0：本局开始前已发现的联动 id，用于结算面计算「本局首次发现」 */
  private synergiesAtStart: Set<string> = new Set();

  constructor(
    canvas: HTMLCanvasElement,
    profile: SaveProfile,
    levelConfig?: LevelConfig,
    selectedNodes?: NodeType[],
    onLevelEnd?: (won: boolean) => void,
    onExitToLevelSelect?: () => void,
    onExitToTitle?: () => void,
  ) {
    this.canvas = canvas;
    this.profile = profile;
    this.levelConfig = levelConfig ?? null;
    this.selectedNodes = selectedNodes ?? null;
    this.onLevelEnd = onLevelEnd ?? null;
    this.onExitToLevelSelect = onExitToLevelSelect ?? null;
    this.onExitToTitle = onExitToTitle ?? null;

    this.state = this.createInitialState();
    this.techState = createTechState();
    this.renderer = new Renderer(this.canvas, this.state.worldWidth, this.state.worldHeight);
    this.ui = new UI(this.canvas.getContext('2d')!);
    this.ui.techState = this.techState;
    this.ui.unlockedAchievements = this.profile.unlockedAchievements ?? [];
    this.ui.discoveredSynergies = new Set(this.profile.discoveredSynergies ?? []);
    this.synergiesAtStart = new Set(this.profile.discoveredSynergies ?? []);
    this.input = new InputManager(
      this.canvas,
      this.state,
      () => this.restart(),
      this.techState,
      this.ui,
      () => {
        if (this.state.gameOver || this.state.levelWon) this.onLevelEnd?.(this.state.levelWon);
        else this.onExitToLevelSelect?.();
      },
      () => {
        this.onExitToTitle?.();
      },
    );

    // 限制可用节点类型
    if (this.selectedNodes) {
      this.input.allowedNodeTypes = this.selectedNodes;
      this.ui.allowedNodeTypes = this.selectedNodes;
    }

    // 设置关卡目标提示文字
    if (this.levelConfig) {
      this.ui.levelObjectiveText = objectiveLabel(this.levelConfig);
      this.ui.levelTitle = this.levelConfig.name;
    }

    this.handleResize();
    this.boundResize = () => this.handleResize();
    window.addEventListener('resize', this.boundResize);

    initializeMap(this.state, levelConfig);

    updateConnectedStatus(this.state);
    updateVisibility(this.state);

    // V1.5.0：首次遇到 nebula/asteroid/wormhole 地形时弹出知识点
    for (const tipId of this.levelConfig?.id === 1 ? [] : checkLoreTipsForLevel(this.state)) {
      this.ui.pushLoreToast(tipId);
    }
  }

  private createInitialState(): GameState {
    const worldWidth = this.levelConfig?.worldWidth ?? 3000;
    const worldHeight = this.levelConfig?.worldHeight ?? 2000;
    const camera: Camera = createInitialCamera(
      worldWidth,
      worldHeight,
      window.innerWidth,
      window.innerHeight,
      this.levelConfig?.corePositions,
    );
    return {
      visibility: createVisibility(worldWidth, worldHeight),
      mission: this.levelConfig?.tactics,
      elapsedSeconds: 0,
      signalBlackoutUntil: 0,
      alert: undefined,
      protectedCoreIds: undefined,
      nodes: [],
      edges: [],
      enemies: [],
      particles: [],
      flowParticles: [],
      strikeEffects: [],
      projectiles: [],
      tick: 0,
      wave: 1,
      score: 0,
      resources: this.levelConfig?.startResources ?? 100,
      crystals: this.levelConfig?.startCrystals ?? 0,
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
      terrainPolygons: [],
      timeScale: 1,
      weatherClouds: [],
      screenShake: 0,
      enemiesKilled: 0,
      nodesBuilt: 0,
      resourcesSpent: 0,
      discoveredSynergies: new Set<string>(this.profile.discoveredSynergies ?? []),
      pendingSynergyEvents: [],
      crossWormholeFx: [],
    };
  }

  private handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cam = this.state.camera;
    cam.x += (this.state.canvasWidth - w) / (2 * cam.zoom);
    cam.y += (this.state.canvasHeight - h) / (2 * cam.zoom);
    cam.targetX += (this.state.canvasWidth - w) / (2 * cam.targetZoom);
    cam.targetY += (this.state.canvasHeight - h) / (2 * cam.targetZoom);
    this.state.canvasWidth = w;
    this.state.canvasHeight = h;
    this.renderer.resize(w, h);
  }

  restart(): void {
    Object.assign(this.state, this.createInitialState());
    this.techState = createTechState();
    this.ui.techState = this.techState;
    this.input.techState = this.techState;
    this.input.resetInteractions();
    this.ui.resetSession();
    clearNotifications();
    this.tickAccumulator = 0;
    this.clock.reset();
    this.statsSaved = false;
    this.bossSpawned = false;
    this.noCoreDamage = true;
    this.synergiesAtStart = new Set(this.profile.discoveredSynergies ?? []);
    this._challengeTipTick = 0;
    initializeMap(this.state, this.levelConfig ?? undefined);

    updateConnectedStatus(this.state);
    updateVisibility(this.state);
    if (isTutorialActive()) {
      startTutorial(this.state);
      this.state.paused = true;
    }
    this.lastTime = performance.now();
    Object.assign(this.metrics, { frames: 0, updateMs: 0, renderMs: 0, longFrames: 0 });
  }

  start(options: { audio?: boolean; tutorial?: boolean; pauseOnHidden?: boolean } = {}): void {
    this.canvas.focus({ preventScroll: true });
    if (options.audio !== false) {
      initAudio();
      startBgm();
    }
    clearNotifications();
    if (options.pauseOnHidden !== false) {
      this.boundVisibility = () => {
        if (document.hidden && !this.state.gameOver && !this.state.levelWon) {
          this.state.paused = true;
          this.clock.reset();
          this.lastTime = performance.now();
        }
      };
      document.addEventListener('visibilitychange', this.boundVisibility);
    }
    // 首次进入第1关时启动教程
    if (options.tutorial !== false && this.levelConfig?.id === 1 && !isTutorialDone()) {
      startTutorial(this.state);
      this.state.paused = true; // 教程开始时暂停
    }
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
    this.input.destroy();
    if (this.boundVisibility) {
      document.removeEventListener('visibilitychange', this.boundVisibility);
      this.boundVisibility = null;
    }
    stopBgm();
    if (this.boundResize) {
      window.removeEventListener('resize', this.boundResize);
    }
  }

  private loop(timestamp: number): void {
    const frameStart = performance.now();
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // 限制 delta 防止跳帧
    this.lastTime = timestamp;

    const cam = this.state.camera;
    const moveLerp = 1 - Math.pow(0.001, dt),
      zoomLerp = 1 - Math.pow(0.02, dt);
    cam.x += (cam.targetX - cam.x) * moveLerp;
    cam.y += (cam.targetY - cam.y) * moveLerp;
    cam.zoom += (cam.targetZoom - cam.zoom) * zoomLerp;
    updateTutorial(this.state);
    if (!this.state.paused && !this.state.gameOver && !this.state.levelWon) {
      this.clock.advance(dt, this.state.timeScale, (step) => {
        if (!this.state.gameOver && !this.state.levelWon) this.update(step);
      });
    } else this.clock.reset();

    // V1.2.1：消费本帧的「首次发现联动」事件，派发为世界内 toast
    if (this.state.pendingSynergyEvents.length > 0) {
      for (const id of this.state.pendingSynergyEvents) {
        this.ui.pushSynergyToast(id);
      }
      this.state.pendingSynergyEvents.length = 0;
    }

    // 游戏结束或关卡胜利时保存统计 + 成就检测
    if ((this.state.gameOver || this.state.levelWon) && !this.statsSaved) {
      this.statsSaved = true;
      if (this.state.levelWon) sfxVictory();
      else sfxGameOver();
      updateProfileStats(
        this.profile,
        this.state.score,
        this.state.wave,
        this.state.enemiesKilled,
        this.state.nodesBuilt,
      );
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
        if (n.owner !== 'player' || n.status === 'destroyed') continue;
        nodeTypeCounts[n.type] = (nodeTypeCounts[n.type] ?? 0) + 1;
      }
      const allCoresFull = this.state.nodes
        .filter((n) => n.type === 'core')
        .every((n) => n.hp >= n.maxHp);
      const achCtx: AchievementContext = {
        score: this.state.score,
        wave: this.state.wave,
        enemiesKilled: this.state.enemiesKilled,
        nodesBuilt: this.state.nodesBuilt,
        levelWon: this.state.levelWon,
        gameOver: this.state.gameOver,
        levelId: this.levelConfig?.id ?? null,
        totalEnemiesKilled: this.profile.stats.totalEnemiesKilled,
        totalNodesBuilt: this.profile.stats.totalNodesBuilt,
        clearedLevels: this.profile.clearedLevels,
        nodeTypeCounts,
        noCoreDamage: allCoresFull && this.noCoreDamage,
        loreCompletedCount: getCompletedChallengeCount(),
      };
      if (!this.profile.unlockedAchievements) this.profile.unlockedAchievements = [];
      checkAchievements(achCtx, this.profile.unlockedAchievements);
      this.ui.unlockedAchievements = this.profile.unlockedAchievements;

      // V1.1.7：将本局发现的联动合并回存档
      if (!this.profile.discoveredSynergies) this.profile.discoveredSynergies = [];
      for (const id of this.state.discoveredSynergies) {
        if (!this.profile.discoveredSynergies.includes(id)) {
          this.profile.discoveredSynergies.push(id);
        }
      }
      this.ui.discoveredSynergies = new Set(this.profile.discoveredSynergies);

      // V1.2.0：计算本局首次发现的联动 id，供结算面展示
      const newSynergies: string[] = [];
      for (const id of this.state.discoveredSynergies) {
        if (!this.synergiesAtStart.has(id)) newSynergies.push(id);
      }
      this.ui.newSynergiesThisRun = newSynergies;

      saveProfile(this.profile);
    }

    const renderStart = performance.now();
    this.render(dt);
    const renderEnd = performance.now();
    this.metrics.frames++;
    this.metrics.updateMs += renderStart - frameStart;
    this.metrics.renderMs += renderEnd - renderStart;
    if (renderEnd - frameStart > 16.7) this.metrics.longFrames++;

    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    // Tick 系统
    this.tickAccumulator += dt * 1000;
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

      processMissionEvents(this.state);
      updateVisibility(this.state);
      processEnemySupport(this.state);
      // 节点效果
      const techBonuses: TechBonuses = {
        damageMultiplier: getTechMultiplier(this.techState, 'boost_damage'),
        rangeMultiplier: getTechMultiplier(this.techState, 'turret_range'),
        coreProduction: getTechMultiplier(this.techState, 'core_production'),
      };
      processNodeEffects(this.state, techBonuses);
      advanceFrontier(this.state);

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
      const diff = this.levelConfig?.difficultyMult ?? 1;
      const frontier = this.state.mission?.frontier;
      const spawnInterval = frontier ? Math.round(frontier.attackSeconds * 2) : Math.max(
        3,
        ENEMY_SPAWN_BASE_INTERVAL - Math.floor(this.state.wave / 2),
      );
      const grace = frontier ? frontier.preparationSeconds * 2 : GRACE_PERIOD_TICKS;
      if (this.state.tick >= grace && this.state.tick % spawnInterval === 0) {
        spawnEnemy(this.state, diff);
      }

      // Boss 生成
      if (
        this.levelConfig?.hasBoss &&
        !this.bossSpawned &&
        this.state.wave >= this.levelConfig.bossWave
      ) {
        this.bossSpawned = true;
        spawnBoss(this.state, diff);
      }

      // 波次递增
      if (frontier) this.state.wave = 1 + Math.floor(Math.max(0,this.state.tick / 2 - frontier.preparationSeconds) / frontier.waveSeconds);
      else if (this.state.tick % 30 === 0) {
        this.state.wave++;
      }

      // 天气系统 — 星云飘过
      this.updateWeather();
    }

    // 限时模式计时
    this.state.elapsedSeconds += dt;

    // 敌人移动 & 战斗
    updateEnemies(this.state, dt);
    this.checkVictoryCondition();

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
      // V1.2.2：联动闪光衰减（1.2 秒消退）
      if (node.synergyFlash !== undefined && node.synergyFlash > 0) {
        node.synergyFlash = Math.max(0, node.synergyFlash - dt / 1.2);
      }
    }
    for (const enemy of this.state.enemies) {
      if (enemy.hitFlash > 0) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - 4 * dt);
      }
    }
    // V1.4.2：跨虫洞 fx ttl 衰减（按帧 dt 秒，30→0 约 0.5s）
    if (this.state.crossWormholeFx && this.state.crossWormholeFx.length > 0) {
      for (const fx of this.state.crossWormholeFx) fx.ttl -= dt * 60;
      this.state.crossWormholeFx = this.state.crossWormholeFx.filter((fx) => fx.ttl > 0);
    }
    // V1.5.2：每 30 帧检查主动引导任务点
    this._challengeTipTick = (this._challengeTipTick ?? 0) + 1;
    if (this._challengeTipTick >= 30) {
      this._challengeTipTick = 0;
      let pushedDone = false;
      for (const tipId of checkChallengeTips(this.state)) {
        this.ui.pushLoreToast(tipId);
        if (tipId.endsWith('_done')) pushedDone = true;
      }
      // V1.5.10：任务完成后检查哲学家成就
      if (pushedDone && this.profile) {
        if (!this.profile.unlockedAchievements) this.profile.unlockedAchievements = [];
        const partialCtx: AchievementContext = {
          score: this.state.score,
          wave: this.state.wave,
          enemiesKilled: this.state.enemiesKilled,
          nodesBuilt: this.state.nodesBuilt,
          levelWon: false,
          gameOver: false,
          levelId: this.levelConfig?.id ?? null,
          totalEnemiesKilled: this.profile.stats.totalEnemiesKilled,
          totalNodesBuilt: this.profile.stats.totalNodesBuilt,
          clearedLevels: this.profile.clearedLevels ?? [],
          nodeTypeCounts: {},
          noCoreDamage: false,
          loreCompletedCount: getCompletedChallengeCount(),
        };
        checkAchievements(partialCtx, this.profile.unlockedAchievements);
        this.ui.unlockedAchievements = this.profile.unlockedAchievements;
      }
    }
  }

  private checkVictoryCondition(): void {
    const outcome = missionOutcome(this.state, this.levelConfig, this.bossSpawned);
    if (outcome === 'lost') {
      this.state.gameOver = true;
      this.state.levelWon = false;
    } else if (outcome === 'won') this.state.levelWon = true;
  }

  private render(dt: number): void {
    this.input.updatePointerWorld();
    this.renderer.maxEdgeLength = getMaxEdgeLength(this.techState);
    this.renderer.rangeMultiplier = getTechMultiplier(this.techState, 'turret_range');
    this.renderer.render(this.state, dt);
    // V1.3.2 dev-only 多边形编辑器叠加层
    this.renderer.drawPolygonEditorOverlay(this.state, this.input.polygonEditor);
    this.ui.selectedEdgeType = this.state.selectedEdgeType;
    this.ui.buildMode = this.input.getBuildMode();
    this.ui.buildPlacement = this.input.getBuildPlacementStatus();
    this.ui.render(this.state);

    // 建造模式指示
    const buildMode = this.input.getBuildMode();
    if (
      buildMode &&
      !this.ui.hasOpenSubPanel() &&
      !this.ui.pauseMenuOpen &&
      !this.state.gameOver &&
      !this.state.levelWon
    ) {
      this.drawBuildCursor(buildMode);
    }

    // 框选矩形
    if (this.input.boxSelectStart && this.input.boxSelectEnd) {
      this.drawBoxSelect();
    }
  }

  private drawBuildCursor(type: NodeType): void {
    const ctx = this.canvas.getContext('2d')!;
    const cfg = NODE_CONFIGS[type as keyof typeof NODE_CONFIGS];
    if (!cfg) return;

    const cam = this.state.camera;
    const sx = (this.state.mouseX - cam.x) * cam.zoom;
    const sy = (this.state.mouseY - cam.y) * cam.zoom;
    const r = cfg.radius * cam.zoom;
    const status = this.ui.buildPlacement;
    if (!status) return;
    const valid = status.valid;
    const color = valid ? '#44ff88' : COLORS.accent.red;

    ctx.save();

    // 半透明填充
    ctx.save();ctx.globalAlpha=.6;drawFacility(ctx,type,sx,sy,(cfg.radius+4)*cam.zoom,{powered:valid});ctx.restore();
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
    ctx.moveTo(sx - cross, sy);
    ctx.lineTo(sx + cross, sy);
    ctx.moveTo(sx, sy - cross);
    ctx.lineTo(sx, sy + cross);
    ctx.stroke();

    ctx.restore();
  }

  /** 天气系统 — 随机生成 & 移动星云 */
  private updateWeather(): void {
    const s = this.state;
    // 每 20 tick 有概率生成一朵云 (最多 5 朵)
    if (s.tick % 20 === 0 && s.weatherClouds.length < 3 && rand() < 0.35) {
      const edge = rand() < 0.5; // 从左/右边进入
      s.weatherClouds.push({
        x: edge ? -200 : s.worldWidth + 200,
        y: rand() * s.worldHeight,
        radius: 180 + rand() * 220,
        vx: (edge ? 1 : -1) * (0.8 + rand() * 1.2),
        vy: (rand() - 0.5) * 0.6,
        opacity: 0.4 + rand() * 0.3,
        life: 300 + Math.floor(rand() * 200),
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
