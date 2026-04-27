// ===== 关卡定义系统 =====
import type { NodeType } from './types';
import { LEVELS } from './data/levels';

export type ObjectiveType = 'survive' | 'boss' | 'protect' | 'timed';

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  worldWidth: number;
  worldHeight: number;
  startResources: number;
  /** 初始科技晶体 */
  startCrystals?: number;
  /** 可用节点类型（PvZ选卡从这里选） */
  availableNodes: NodeType[];
  /** 最大可携带节点种类数 */
  maxSelectedNodes: number;
  /** 胜利条件 */
  objective: ObjectiveType;
  /** 生存波次目标（survive/timed模式） */
  targetWaves: number;
  /** 是否有Boss */
  hasBoss: boolean;
  /** Boss出现波次 */
  bossWave: number;
  /** 限时（秒），0=无限 */
  timeLimit: number;
  /** 初始节点数量 */
  nodeCount: number;
  /** 敌人强度倍率 */
  difficultyMult: number;
  /** 解锁需要通关的前置关卡ID（0=直接解锁） */
  unlockRequires: number;
  /** 地形配置（可选） */
  terrainConfig?: {
    nebulaCount?: number;
    asteroidCount?: number;
    wormholePairs?: number;
  };
}

// LEVELS 已迁移至 src/data/levels.ts，从此处重新导出以保持向后兼容
export { LEVELS };

export function getUnlockedLevels(clearedLevelIds: number[]): LevelConfig[] {
  return LEVELS.filter(l => l.unlockRequires === 0 || clearedLevelIds.includes(l.unlockRequires));
}

