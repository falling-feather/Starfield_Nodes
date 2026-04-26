// ===== 成就系统 =====

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 检测函数，传入当前游戏快照，返回 true 表示解锁 */
  check: (ctx: AchievementContext) => boolean;
}

/** 成就检测所需的游戏上下文快照 */
export interface AchievementContext {
  score: number;
  wave: number;
  enemiesKilled: number;
  nodesBuilt: number;
  levelWon: boolean;
  gameOver: boolean;
  levelId: number | null;
  /** 存档累计击杀 */
  totalEnemiesKilled: number;
  /** 存档累计建造 */
  totalNodesBuilt: number;
  /** 存档已通关关卡 */
  clearedLevels: number[];
  /** 当前节点类型统计 */
  nodeTypeCounts: Record<string, number>;
  /** 本局0损失 */
  noCoreDamage: boolean;
}

// ─── 成就定义 ─────────────────────────────────
// ACHIEVEMENTS 数据已迁移至 src/data/achievements.ts，从此处重新导出以保持向后兼容
export { ACHIEVEMENTS } from './data/achievements';
import { ACHIEVEMENTS } from './data/achievements';

// ─── 运行时状态 ─────────────────────────────────

/** 本次会话刚解锁的成就队列（用于弹窗通知） */
let pendingNotifications: AchievementDef[] = [];

/**
 * 检测并解锁成就。
 * @returns 本次新解锁的成就列表
 */
export function checkAchievements(
  ctx: AchievementContext,
  unlocked: string[],
): AchievementDef[] {
  const newlyUnlocked: AchievementDef[] = [];
  for (const def of ACHIEVEMENTS) {
    if (unlocked.includes(def.id)) continue;
    if (def.check(ctx)) {
      unlocked.push(def.id);
      newlyUnlocked.push(def);
      pendingNotifications.push(def);
    }
  }
  return newlyUnlocked;
}

/** 弹出一条待通知成就（FIFO），无则返回 null */
export function popNotification(): AchievementDef | null {
  return pendingNotifications.shift() ?? null;
}

/** 清空通知队列 */
export function clearNotifications(): void {
  pendingNotifications = [];
}
