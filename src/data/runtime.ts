// ===== 运行时常量命名导出 =====
// 把 balance.RUNTIME / balance.ECONOMY 中的若干字段以惯用大写常量名暴露，
// 调用方继续使用 TICK_INTERVAL 这种短名即可，不需要拼 RUNTIME.tickIntervalMs。
//
// 与 balance.ts 是唯一真理源（编辑数值请改 balance.ts）。

import { RUNTIME, ECONOMY } from './balance';

export const TICK_INTERVAL = RUNTIME.tickIntervalMs;
export const MAX_EDGE_LENGTH = RUNTIME.maxEdgeLength;
export const CORE_ENERGY_PRODUCTION = RUNTIME.coreEnergyProduction;
export const ENEMY_SPAWN_BASE_INTERVAL = RUNTIME.enemySpawnBaseInterval;

export const TERRITORY_RADIUS = RUNTIME.territoryRadius;
export const EXPANDED_TERRITORY_RADIUS = RUNTIME.territoryRadiusExpanded;
export const TERRITORY_DISCOUNT = ECONOMY.territoryDiscount;

export const EXPAND_COST = ECONOMY.expandCost;
export const EXPAND_CRYSTAL_COST = ECONOMY.expandCrystalCost;
