// 敌人数据层
// 抽离自 types.ts（Phase B-1）
import type { EnemyType } from '../types';

/** 敌人外观色（统一表，主题切换时被改写） */
export const ENEMY_COLORS: Record<EnemyType, string> = {
  scout: '#ff3333',
  heavy: '#ff6600',
  swarm: '#ff00ff',
  boss: '#ff0000',
  stealth: '#88ffff',
  splitter: '#aaff00',
  disruptor: '#ff88ff',
  healer: '#44ff88',
  shielder: '#4488ff',
};

/** 敌人色快照（用于主题切换回退） */
export const DEFAULT_ENEMY_COLORS: Record<EnemyType, string> = { ...ENEMY_COLORS };

/**
 * 敌人基础移动速度表。
 * graph.ts::getBaseSpeed 与所有减速逻辑（magnet / factory.evolved AoE / 进化磁力塔）
 * 都基于此返回值乘以 slowFactor，所以这里是减速效果的"地基"。
 */
export const ENEMY_BASE_SPEED: Record<string, number> = {
  scout: 2.5,
  heavy: 1,
  swarm: 3,
  boss: 0.5,
  stealth: 2.8,
  splitter: 1.5,
  disruptor: 2.0,
  healer: 1.2,
};

/** 未在 ENEMY_BASE_SPEED 表内的敌人类型（含 shielder 等）使用的默认速度 */
export const DEFAULT_ENEMY_BASE_SPEED = 2;
