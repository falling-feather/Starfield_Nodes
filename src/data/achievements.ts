// 成就数据层
// 抽离自 src/achievements.ts（Phase B-1）
import type { AchievementDef } from '../achievements';

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- 通关类 ---
  {
    id: 'first_victory',
    name: '初次胜利',
    icon: '🏆',
    description: '首次通关任意关卡',
    check: ctx => ctx.levelWon,
  },
  {
    id: 'clear_all',
    name: '全境征服',
    icon: '👑',
    description: '通关全部6个关卡',
    check: ctx => ctx.clearedLevels.length >= 6,
  },
  {
    id: 'perfect_clear',
    name: '完美防线',
    icon: '💎',
    description: '通关时所有核心未受伤害',
    check: ctx => ctx.levelWon && ctx.noCoreDamage,
  },

  // --- 击杀类 ---
  {
    id: 'kill_100',
    name: '百敌斩',
    icon: '⚔️',
    description: '累计击杀100个敌人',
    check: ctx => ctx.totalEnemiesKilled >= 100,
  },
  {
    id: 'kill_1000',
    name: '千敌灭',
    icon: '🗡️',
    description: '累计击杀1000个敌人',
    check: ctx => ctx.totalEnemiesKilled >= 1000,
  },
  {
    id: 'wave_20',
    name: '持久战',
    icon: '🌊',
    description: '单局存活到第20波',
    check: ctx => ctx.wave >= 20,
  },

  // --- 建造类 ---
  {
    id: 'build_50',
    name: '建筑大师',
    icon: '🏗️',
    description: '累计建造50个节点',
    check: ctx => ctx.totalNodesBuilt >= 50,
  },
  {
    id: 'build_tesla_5',
    name: '电网专家',
    icon: '⚡',
    description: '单局建造5座连锁塔',
    check: ctx => (ctx.nodeTypeCounts['tesla'] ?? 0) >= 5,
  },
  {
    id: 'multi_core',
    name: '多核架构',
    icon: '🔮',
    description: '单局拥有3个以上核心',
    check: ctx => (ctx.nodeTypeCounts['core'] ?? 0) >= 3,
  },

  // --- 分数/资源类 ---
  {
    id: 'score_5000',
    name: '星域之星',
    icon: '⭐',
    description: '单局得分超过5000',
    check: ctx => ctx.score >= 5000,
  },
  {
    id: 'score_20000',
    name: '传奇指挥官',
    icon: '🌟',
    description: '单局得分超过20000',
    check: ctx => ctx.score >= 20000,
  },
];
