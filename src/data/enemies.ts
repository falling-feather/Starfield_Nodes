// 敌人数据层
// 抽离自 types.ts（Phase B-1）
import type { EnemyType } from '../types';

/** 敌人外观色（统一表，主题切换时被改写） */
export const ENEMY_COLORS: Record<EnemyType, string> = {
  scout: '#e98e7c',
  heavy: '#dfa172',
  swarm: '#d4a0a0',
  boss: '#ee8c78',
  stealth: '#b3c9d4',
  splitter: '#c4bd87',
  disruptor: '#be9fbf',
  healer: '#9fba9b',
  shielder: '#94aecd',
};

/** 敌人色快照（用于主题切换回退） */
export const DEFAULT_ENEMY_COLORS: Record<EnemyType, string> = { ...ENEMY_COLORS };
