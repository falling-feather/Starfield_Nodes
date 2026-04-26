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
  /** 进化晶体费 = ceil(cost / evolutionCrystalDivisor) */
  evolutionCrystalDivisor: 16,
  /** 进化属性增长倍率（同时作用于 maxEnergy / maxHp） */
  evolutionAttrGrowth: 1.5,

  /** 领地内建造费用减免比例 */
  territoryDiscount: 0.2,
  /** 核心扩展卡资源费 */
  expandCost: 300,
  /** 核心扩展卡晶体费 */
  expandCrystalCost: 5,
} as const;

/** 战斗：敌人击杀奖励表（之前散落在 entities.ts 内） */
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
  turret: { rangeBase: 180, damageBase: 15, evolvedAoeRadius: 40 },

  /** 护盾：每 tick 修复 = healAmount × level */
  shield: {
    range: { n: 150, e: 200 },
    healAmount: { n: 5, e: 8 },
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
  },

  /** 黑洞：吸引/碾压/伤害 */
  blackhole: {
    range: { n: 120, e: 160, oc: 200 },
    crushRange: { n: 40, e: 60, oc: 80 },
    crushDamage: { n: 8, e: 15, oc: 16 },
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
  },

  /** 狙击：射程 = (rangeBase + level × rangePerLevel) × rangeMult；超载伤害 ×3；溅射 splashRange */
  sniper: {
    rangeBase: 250,
    rangePerLevel: 30,
    damage: 30,
    overchargeDamageMult: 3,
    splashRange: 60,
  },

  /** 特斯拉：伤害 × level × damageMult；接触判定 hitRange；链式伤害 = damage × chainRatio */
  tesla: {
    damage: 8,
    hitRange: 25,
    chainRatio: 0.5,
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
  },
} as const;
