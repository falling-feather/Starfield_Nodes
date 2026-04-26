// ===== 星域节点 - 核心类型定义 =====

export type NodeType = 'core' | 'energy' | 'turret' | 'mine' | 'shield' | 'relay' | 'tesla' | 'beacon' | 'factory' | 'magnet' | 'trap' | 'repair' | 'sniper' | 'buffer' | 'collector' | 'interceptor' | 'radar' | 'portal' | 'blackhole' | 'echo' | 'toxin' | 'arc' | 'kamikaze';
export type NodeStatus = 'normal' | 'damaged' | 'destroyed';

export interface GameNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  level: number;
  currentEnergy: number;
  maxEnergy: number;
  status: NodeStatus;
  hp: number;
  maxHp: number;
  activationThreshold: number;
  // 视觉属性
  radius: number;
  glowColor: string;
  pulsePhase: number;
  // 能量超载
  overchargeBuildup: number;   // 连续高能tick计数
  overchargeTicks: number;     // 超载剩余tick
  overchargeCooldown: number;  // 冷却剩余tick
  // 进化
  evolved: boolean;
  // 连接状态（是否连通到核心）
  connected: boolean;
  /** 所有者: player=玩家, neutral=中立(可招募) */
  owner: 'player' | 'neutral';
  /** 核心扩展卡 — 扩大领地范围 */
  expanded: boolean;
  /** 受击闪红强度 0~1，每帧衰减 */
  hitFlash: number;
}

// ===== 领地系统 =====
// TERRITORY_RADIUS / EXPANDED_TERRITORY_RADIUS / TERRITORY_DISCOUNT /
// EXPAND_COST / EXPAND_CRYSTAL_COST 已迁至 src/data/runtime.ts，请直接 import

export type EdgeType = 'standard' | 'fast' | 'heavy' | 'amplify';

// ===== 地形系统 =====
export type TerrainType = 'nebula' | 'asteroid' | 'wormhole';

export interface TerrainZone {
  id: string;
  type: TerrainType;
  x: number;
  y: number;
  radius: number;
  /** 星云减速倍率 (0~1, 越小越慢) */
  slowFactor?: number;
  /** 虫洞配对ID */
  linkedId?: string;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  throughput: number; // 带宽吞吐量 (能量/tick)
  flowProgress: number; // 流动动画进度 0~1
  active: boolean;
  /** 干扰剩余时间（秒），>0 时链路中断 */
  disruptedTimer: number;
}

// EDGE_CONFIGS / DEFAULT_EDGE_COLORS 已迁至 src/data/edges.ts，请直接 import
// EDGE_CONFIGS / DEFAULT_EDGE_COLORS moved to ./data/edges — import 从 data/edges 即可


export interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  targetNodeId: string | null;
  type: 'scout' | 'heavy' | 'swarm' | 'boss' | 'stealth' | 'splitter' | 'disruptor' | 'healer' | 'shielder';
  radius: number;
  /** 虫洞传送免疫冷却 (秒) */
  teleportCooldown: number;
  /** 受击闪白强度 0~1，每帧衰减 */
  hitFlash: number;
  /** 护盾者光环减伤 0~1，每tick重算 */
  damageReduction: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FlowParticle {
  edgeId: string;
  progress: number; // 0~1 沿边的进度
  speed: number;
  size: number;
  color: string;
}

export interface Projectile {
  x: number;
  y: number;
  targetId: string;
  speed: number;
  damage: number;
  color: string;
}

export interface Camera {
  x: number;      // 视口左上角在世界坐标中的 x
  y: number;      // 视口左上角在世界坐标中的 y
  zoom: number;   // 缩放级别 (1 = 100%)
  targetX: number; // 平滑移动目标
  targetY: number;
  targetZoom: number;
}

export interface GameState {
  nodes: GameNode[];
  edges: Edge[];
  enemies: Enemy[];
  particles: Particle[];
  flowParticles: FlowParticle[];
  projectiles: Projectile[];
  tick: number;
  wave: number;
  score: number;
  resources: number;
  /** 科技晶体 — 击杀敌人/高级矿机产出，用于进化/增幅/高级科技 */
  crystals: number;
  gameOver: boolean;
  levelWon: boolean;
  paused: boolean;
  selectedNodeId: string | null;
  selectedNodeIds: string[];       // 框选的多个节点
  draggingFrom: string | null;
  selectedEdgeType: EdgeType;
  mouseX: number;
  mouseY: number;
  canvasWidth: number;
  canvasHeight: number;
  // 大地图
  worldWidth: number;
  worldHeight: number;
  camera: Camera;
  terrainZones: TerrainZone[];
  /** 时间加速倍率 (1 / 2 / 3) */
  timeScale: number;
  /** 动态天气云 */
  weatherClouds: WeatherCloud[];
  /** 屏幕震动强度（外部触发） */
  screenShake: number;
  // === §25 bench instrumentation：累计统计字段（局内单调递增） ===
  /** 局内累计敌人击杀数 */
  enemiesKilled: number;
  /** 局内累计玩家建造节点数（不含初始/敌人节点） */
  nodesBuilt: number;
  /** 局内累计资源花费（建造扣费总和） */
  resourcesSpent: number;
}

/** 漂浮星云 — 暂时遮挡视野 */
export interface WeatherCloud {
  x: number;
  y: number;
  radius: number;
  vx: number;        // 漂移速度
  vy: number;
  opacity: number;    // 0-1
  life: number;       // 剩余寿命 (ticks)
}

// NODE_CONFIGS / DEFAULT_NODE_GLOW 已迁至 src/data/nodes.ts，请直接 import


/** 敌人类型联合 */
export type EnemyType = Enemy['type'];

// ENEMY_COLORS / DEFAULT_ENEMY_COLORS 已迁至 src/data/enemies.ts，请直接 import


// MAX_EDGE_LENGTH / TICK_INTERVAL / CORE_ENERGY_PRODUCTION /
// ENEMY_SPAWN_BASE_INTERVAL 已迁至 src/data/runtime.ts，请直接 import

// EVOLUTION_LEVEL / EVOLVABLE_TYPES / EVOLUTION_NAMES /
// getEvolutionCost / getEvolutionCrystalCost 已迁至 src/data/evolution.ts，请直接 import
