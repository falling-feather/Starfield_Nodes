// 数据层 barrel：统一从 src/data/ 重新导出，便于按目录导入。
// 旧路径 `from './types'` / `from './levels'` 仍可继续使用（各文件内重新导出）。
export { NODE_CONFIGS, DEFAULT_NODE_GLOW } from './nodes';
export { EDGE_CONFIGS, DEFAULT_EDGE_COLORS } from './edges';
export { ENEMY_COLORS, DEFAULT_ENEMY_COLORS } from './enemies';
export { LEVELS } from './levels';
export { ACHIEVEMENTS } from './achievements';
export { createTechTree } from './tech';
export {
  ENEMY_BASE_STATS,
  ENEMY_UNLOCK_WAVE,
  TARGET_WEIGHT_BY_ENEMY,
  getBossStats,
  SPAWN_DIST_MIN,
  SPAWN_DIST_RANDOM,
  BOSS_SPAWN_DIST,
} from './spawn';
export {
  ECONOMY,
  ENEMY_DEATH_REWARDS,
  DEFAULT_ENEMY_REWARD,
  RUNTIME,
  OVERCHARGE,
  COMBAT,
  calcUpgradeCost,
  calcEvolutionCost,
  calcEvolutionCrystalCost,
} from './balance';
export type { EnemyDeathReward } from './balance';
