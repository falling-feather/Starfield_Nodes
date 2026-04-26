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
