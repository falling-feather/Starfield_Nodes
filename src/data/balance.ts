// ===== 平衡数值中央集约（Phase B 续 / Phase E 推动） =====
// 目的：把散落在 input/entities/graph/types 的纯数值常量与计算系数集中，
// 便于后续 Playwright 批量 benchmark 调参，且不破坏现有引用方式（其它文件仍可继续 re-export）。

import type { EnemyType, NodeType } from '../types';
import { NODE_CONFIGS } from './nodes';

/** 节点经济学：升级、进化、领地、核心扩展 */
export const ECONOMY = {
  /** 升级费用 = upgradeBaseCost × node.level（线性） */
  upgradeBaseCost: 30,
  /** 升级时 maxEnergy 增长系数：base × (1 + level × upgradeEnergyGrowth) */
  upgradeEnergyGrowth: 0.3,
  /** 升级时 maxHp 增长系数：base × (1 + level × upgradeHpGrowth) */
  upgradeHpGrowth: 0.25,

  /** 进化费用 = NODE_CONFIGS[type].cost × evolutionCostMult */
  evolutionCostMult: 3,
  /** 进化晶体费 = ceil(cost / evolutionCrystalDivisor)。§36 16→32 攻击 crystal 瓶颈（turret 4→2, energy 2→1） */
  evolutionCrystalDivisor: 32,
  /** 进化属性增长倍率（同时作用于 maxEnergy / maxHp） */
  evolutionAttrGrowth: 1.5,

  /** 领地内建造费用减免比例 */
  territoryDiscount: 0.2,
  /** 核心扩展卡资源费 */
  expandCost: 300,
  /** 核心扩展卡晶体费 */
  expandCrystalCost: 5,
  /** 矿机基础产出：output = (oc ? mineOutputOvercharge : mineOutputBase) × level。§23 上调 base 2->3 恢复中前期资源；§35 验证 3->5 反而 -20% score 已回滚 */
  mineOutputBase: 3,
  mineOutputOvercharge: 6,
} as const;
export interface EnemyDeathReward {
  score: number;
  res: number;
  crystal: number;
}
export const ENEMY_DEATH_REWARDS: Record<EnemyType, EnemyDeathReward> = {
  scout:     { score: 15,  res: 8,  crystal: 1 },
  heavy:     { score: 30,  res: 15, crystal: 2 },
  swarm:     { score: 10,  res: 8,  crystal: 1 },
  stealth:   { score: 25,  res: 8,  crystal: 2 },
  splitter:  { score: 20,  res: 12, crystal: 1 },
  disruptor: { score: 20,  res: 10, crystal: 2 },
  healer:    { score: 25,  res: 12, crystal: 2 },
  shielder:  { score: 30,  res: 15, crystal: 2 },
  boss:      { score: 100, res: 30, crystal: 8 },
};
/** 默认兜底奖励（防御未知敌人 type） */
export const DEFAULT_ENEMY_REWARD: EnemyDeathReward = { score: 10, res: 8, crystal: 1 };

/** 运行/玩法运行时常量（不影响每秒 tick 数的整体节奏，仅为参数集中点） */
export const RUNTIME = {
  tickIntervalMs: 500,
  maxEdgeLength: 200,
  coreEnergyProduction: 15,
  enemySpawnBaseInterval: 8,
  /**
   * 每次 spawnEnemy 调用生成的敌人数 = 1 + floor(wave / enemySpawnCountDivisor)。
   * 数值越大越平缓。§22 诊断：原 3 过陡，§23 上调为 4。
   */
  enemySpawnCountDivisor: 4,

  territoryRadius: 400,
  territoryRadiusExpanded: 600,

  evolutionLevel: 5,
} as const;

/** 能量超载（之前 graph.ts 内私有常量） */
export const OVERCHARGE = {
  threshold: 0.9,
  buildup: 3,
  duration: 5,
  cooldown: 8,
} as const;

/**
 * 节点每 tick 的能量消耗集中表（之前散落在 graph.ts processNodeEffects 各 case 内）。
 * - 标量：所有形态消耗相同
 * - { n, oc }：超载形态消耗 oc，普通/进化形态消耗 n
 *
 * 注意：能量增益（energy +3/+6、tesla +5）仍在 graph.ts 内联，
 * 因为它们是"产出"而非"消耗"，与本表语义对偶。
 */
export const ENERGY_COSTS = {
  mine: 5,
  turret: { n: 10, oc: 15 },
  shield: { n: 8, oc: 12 },
  factory: 15,
  magnet: 5,
  repair: { n: 8, oc: 15 },
  sniper: { n: 12, oc: 20 },
  buffer: { n: 6, oc: 12 },
  collector: 4,
  interceptor: { n: 5, oc: 8 },
  radar: 3,
  portal: 5,
  blackhole: 6,
  echo: 4,
  toxin: 3,
  arc: 4,
  beacon: 2,
} as const;

/**
 * 节点每 tick 主动获得的能量（与 ENERGY_COSTS 对偶）。
 * energy 节点不走 ENERGY_COSTS，而是每 tick +N；
 * tesla 节点在攻击同时也补上 +N。
 */
export const ENERGY_GAINS = {
  energy: { n: 3, e: 6 },
  tesla: 5,
} as const;

/** 派生工具：升级费用、进化费用，统一从 ECONOMY 计算（保留原函数签名兼容） */
export function calcUpgradeCost(level: number): number {
  return ECONOMY.upgradeBaseCost * level;
}
export function calcEvolutionCost(type: NodeType): number {
  return NODE_CONFIGS[type].cost * ECONOMY.evolutionCostMult;
}
export function calcEvolutionCrystalCost(type: NodeType): number {
  return Math.ceil(NODE_CONFIGS[type].cost / ECONOMY.evolutionCrystalDivisor);
}

/**
 * COMBAT — 各节点战斗系数集中表
 *
 * 命名约定：
 * - n: normal 普通形态
 * - e: evolved 进化形态
 * - oc: overcharged 超载形态
 * - 凡是后接 `× level × damageMult` / `× level × rangeMult` 的字段，仅记基础值
 */
export const COMBAT = {
  /** 炮塔：射程/伤害都 × level × *Mult；evolvedAoeRadius 为狙击炮 AoE 穿透半径 */
  /** §28 A/B baseline：§26 rangeBase=200, damageBase=22 (在 §27 autoUpgrade 下验证收益) */
  turret: { rangeBase: 200, damageBase: 22, evolvedAoeRadius: 40 },

  /** 护盾：每 tick 修复 = healAmount × level */
  shield: {
    range: { n: 150, e: 200 },
    healAmount: { n: 5, e: 8 },
    /** 超载脉冲：overchargeHealPulse 范围 / HP 治疗×level / 能量恢复 / damaged→normal 阈值比 */
    ocPulseRange: 220,
    ocPulseHealPerLevel: 8,
    ocPulseEnergyHeal: 5,
    ocPulseStatusRestoreRatio: 0.5,
    /** 进化(堡垒)：evolvedShieldArmor 范围 + 每 tick 装甲 HP 治疗 */
    evolvedArmorRange: 200,
    /** §24 调优 ③：装甲每 tick 修复 3 -> 4，对应 §22 建议的 armorBoost +1 */
    evolvedArmorHealPerTick: 4,
    /** 联动：shield 直连 player owned repair 时，受到的伤害 ×(1 - reduce) */
    synergyRepairDamageReduce: 0.20,
  },

  /** 维修站：每 tick 修复 = healAmount × level */
  repair: {
    range: { n: 180, e: 220 },
    healAmount: { n: 10, e: 15 },
  },
  /** 维修站超载脉冲：一次性大范围 */
  repairPulse: {
    range: { n: 250, e: 300 },
    healAmount: { n: 18, e: 25 },
  },

  /** 雷达：伤害 = damage × level × damageMult */
  radar: {
    range: { n: 200, e: 280, oc: 350 },
    damage: { n: 3, e: 5, oc: 8 },
  },

  /** 地雷：伤害 = damage × level × damageMult；blastRadius 内有 1→0.5 的距离衰减 */
  mine: {
    blastRadius: { n: 150, e: 250 },
    damage: { n: 200, e: 350 },
    /** 边缘衰减系数（中心 1 → 边缘 1 - falloffMax） */
    falloffMax: 0.5,
  },

  /** 电弧塔：射程/伤害 / 反弹 */
  arc: {
    range: { n: 160, e: 200, oc: 250 },
    damage: { n: 10, e: 15, oc: 20 },
    bounceRange: { n: 80, e: 100 },
    /** 最大弹跳次数（含首发） */
    maxBounces: { n: 2, e: 4, oc: 6 },
    /** 每次弹跳的伤害衰减系数 */
    decay: { n: 0.8, e: 0.9, oc: 1.0 },
  },

  /** 黑洞：吸引/碾压/伤害 */
  blackhole: {
    range: { n: 120, e: 160, oc: 200 },
    crushRange: { n: 40, e: 60, oc: 80 },
    crushDamage: { n: 8, e: 15, oc: 16 },
    /** 拉拽强度（越大吸力越强） */
    pullStrength: { n: 0.5, e: 0.8, oc: 1.2 },
    /** 极近距离阈值（进化形态触发额外倍率） */
    closeDistance: 20,
    /** 极近距离伤害倍率（仅进化形态生效） */
    closeDamageMult: 3,
  },

  /** 拦截器（点防）：伤害 = damage × level × damageMult */
  interceptor: {
    range: { n: 130, e: 170 },
    damage: 5,
  },

  /** 反修复（污染）：range × rangeMult */
  antiRepair: {
    rangeBase: 200,
  },

  /** 工厂：伤害 = damage × level × damageMult */
  factory: {
    range: 200,
    aoeRadius: { n: 60, e: 80 },
    damage: 12,
    /** 进化形态 AoE 命中后的减速系数（基于 baseSpeed） */
    evolvedSlowFactor: 0.5,
  },

  /** 狙击：射程 = (rangeBase + level × rangePerLevel) × rangeMult；超载伤害 ×3；溅射 splashRange */
  sniper: {
    rangeBase: 250,
    rangePerLevel: 30,
    damage: 30,
    overchargeDamageMult: 3,
    splashRange: 60,
    /** 进化形态击杀时溅射伤害比例 */
    splashDamageRatio: 0.5,
  },

  /** 特斯拉：伤害 × level × damageMult；接触判定 hitRange；链式伤害 = damage × chainRatio */
  tesla: {
    damage: 8,
    hitRange: 25,
    chainRatio: 0.5,
    /** 联动：当 tesla 直连 player owned relay 时，电弧借道 relay 的其它边再延伸一跳 */
    synergyRelayHop: true,
    /** 二级电弧伤害衰减系数（基于 tesla 自身基础伤害） */
    synergyRelayDamageRatio: 0.6,
  },

  /** 陷阱：伤害 × level × damageMult */
  trap: {
    detectRange: 80,
    blastRange: 120,
    damage: 80,
  },

  /** 磁力塔：射程 = base × level × rangeMult；slowFactor 越小减速越强 */
  magnet: {
    /** 普通形态 */
    normal: { rangeBase: 160, slowFactor: 0.4 },
    /** 进化（黑洞）形态：拉拽 + 减速 */
    evolved: { rangeBase: 180, rangeBaseOc: 220, slowFactor: 0.35, slowFactorOc: 0.2, pullStrength: 0.3 },
    /** 超载（普通形态）形态 */
    overcharge: { rangeBase: 220, slowFactor: 0.2 },
  },

  /** 毒雾：伤害 × level × damageMult；中毒死亡时进化版扩散 spreadRange 内、伤害 × spreadDamageRatio */
  toxin: {
    range: { n: 140, e: 200, oc: 250 },
    damage: { n: 3, e: 5, oc: 8 },
    slowFactor: { n: 0.6, e: 0.4, oc: 0.3 },
    spreadRange: 60,
    spreadDamageRatio: 0.5,
  },

  /** 自爆核爆：复用 mine 半径/伤害体系，shake 为屏幕震动幅度 */
  kamikaze: {
    blastRadius: { n: 150, e: 250 },
    damage: { n: 200, e: 350 },
    falloffMax: 0.5,
    shake: { n: 10, e: 15 },
  },

  /** 传送门：range / pushDist / maxTargets；boss 推送距离打 bossPushRatio 折扣；teleportCooldown 为重复传送冷却 */
  portal: {
    range: { n: 150, e: 200, oc: 220 },
    pushDist: { n: 400, e: 600, oc: 800 },
    maxTargets: { n: 1, e: 2, oc: 999 },
    bossPushRatio: 0.5,
    teleportCooldown: { n: 4, e: 3 },
    /** 联动：每个直连的 player owned interceptor 对被传送敌人额外射击一次 */
    synergyInterceptorShot: true,
    /** 联动射击伤害倍率（基于 interceptor 自身基础伤害） */
    synergyInterceptorDamageMult: 1.0,
  },

  /** 信标：仅消耗能量做视野（无攻击数值）。能耗见 ENERGY_COSTS.beacon */
  beacon: {},

  /** 能量站超载/进化属性（主体充能增益见 ENERGY_GAINS.energy） */
  energy: {
    /** 超载广播：每邻居获得 boost 能量，临时超充上限 = maxEnergy × capRatio */
    ocBroadcastBoost: 10,
    ocBroadcastCapRatio: 1.2,
    /** 进化(核聚变)：能量比 < threshold 的邻居会获得 boost 充能 */
    evolvedAssistThreshold: 0.8,
    evolvedAssistBoost: 8,
  },

  /** 缓冲器：boost = boostPerLevel × level，叠到邻居 currentEnergy（上限 maxEnergy） */
  buffer: {
    range: { n: 160, e: 200 },
    boostPerLevel: { n: 2, e: 4 },
  },

  /** 缓冲器超载脉冲：可超充至 maxEnergy × overchargeCapRatio */
  bufferPulse: {
    range: { n: 230, e: 280 },
    boostPerLevel: { n: 8, e: 12 },
    /** 超充能量上限比例（× maxEnergy） */
    overchargeCapRatio: 1.2,
  },

  /** 采集器：output = cap × level × (evolved ? evolvedOutputMult : 1) × (1 + synergy) */
  collector: {
    range: { n: 180, e: 240, oc: 300 },
    /** 普通形态最多统计 cap 个敌人，超载无上限 */
    maxNearbyCap: 3,
    /** 进化产出乘数 */
    evolvedOutputMult: 1.5,
    /** 进化形态：附近敌人 ≥ crystalThreshold 时每 tick 产 1 晶体 */
    crystalThreshold: 3,
    /** 联动：直连任一 player owned buffer 时产出 +bonus（不叠加多个） */
    synergyBufferBonus: 0.25,
    /** 联动：晶体阈值的 buffer 减免（每接一个 buffer 减 1，最低 1） */
    synergyCrystalThresholdReduce: 1,
  },

  /** 回声塔：复制邻居能力时的代理节点 level 缩放 + 超载额外伤害乘数 */
  echo: {
    /** 代理节点等级 = ceil(echo.level × proxyLevelScale) */
    proxyLevelScale: 0.8,
    /** 超载形态对复制效果的伤害倍率 */
    overchargeMult: 1.5,
  },

  /** 进化磁力塔（黑洞）专属：拉拽时忽略距离 < minPullDist 的敌人 */
  magnetEvolved: {
    minPullDist: 10,
  },
} as const;
