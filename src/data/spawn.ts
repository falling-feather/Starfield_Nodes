// 敌人生成 / 寻敌行为参数（Phase B-1 抽离自 entities.ts）
import type { Enemy } from '../types';

/** 各类型敌人基础属性（不含波次成长系数） */
export interface EnemyBaseStats {
  hp: number;
  speed: number;
  damage: number;
  radius: number;
}

export const ENEMY_BASE_STATS: Record<Exclude<Enemy['type'], 'boss'>, EnemyBaseStats> = {
  scout:    { hp: 40,  speed: 1.5, damage: 10, radius: 8 },
  heavy:    { hp: 120, speed: 0.7, damage: 25, radius: 14 },
  swarm:    { hp: 25,  speed: 2.2, damage: 5,  radius: 6 },
  stealth:  { hp: 35,  speed: 1.8, damage: 15, radius: 9 },
  splitter: { hp: 60,  speed: 1.0, damage: 12, radius: 11 },
  disruptor:{ hp: 50,  speed: 1.4, damage: 8,  radius: 10 },
  healer:   { hp: 55,  speed: 1.2, damage: 5,  radius: 10 },
  shielder: { hp: 80,  speed: 0.9, damage: 8,  radius: 12 },
};

/** 各敌人类型解锁所需波次（默认从 wave 0 起即可生成） */
export const ENEMY_UNLOCK_WAVE: Partial<Record<Enemy['type'], number>> = {
  healer: 6,
  stealth: 8,
  shielder: 10,
  splitter: 12,
  disruptor: 12,
};

/**
 * 各敌人类型对节点的目标优先级权重：值越小越优先（相当于缩短感知距离）。
 * 默认权重 = 1，不在表中的节点类型走默认。
 */
export const TARGET_WEIGHT_BY_ENEMY: Record<Enemy['type'], Partial<Record<string, number>>> = {
  scout:    {},                                         // 纯最近目标
  heavy:    { core: 0.3 },                              // 重型：直扑核心
  swarm:    {},                                         // 蜂群：最近目标
  boss:     { core: 0.35, turret: 0.7 },                // Boss：核心优先，也会拆炮台
  stealth:  { core: 0.4, energy: 0.7 },                 // 隐形：偷袭核心/能量站
  splitter: { core: 0.5 },                              // 分裂：倾向核心
  disruptor:{ relay: 0.3, core: 0.9 },                  // 干扰：优先中继，打断网络
  healer:   { core: 0.6 },                              // 治疗者：中距离跟随，倾向核心
  shielder: { core: 0.5, turret: 0.8 },                 // 护盾者：慢速推进，保护周围敌人
};

/** Boss 基础属性公式（按当前波次成长） */
export function getBossStats(wave: number): { hp: number; speed: number; damage: number; radius: number } {
  return {
    hp: 500 + wave * 20,
    speed: 0.5,
    damage: 40 + wave * 3,
    radius: 24,
  };
}

/** 普通敌人的生成距离（围绕玩家节点的环形半径） */
export const SPAWN_DIST_MIN = 500;
export const SPAWN_DIST_RANDOM = 300;
/** Boss 生成距离 */
export const BOSS_SPAWN_DIST = 600;
