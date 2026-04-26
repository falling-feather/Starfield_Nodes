// ===== 节点进化相关数据 =====

import type { NodeType } from '../types';
import { RUNTIME, calcEvolutionCost, calcEvolutionCrystalCost } from './balance';

/** 节点达到该等级才能进化 */
export const EVOLUTION_LEVEL = RUNTIME.evolutionLevel;

/** 可进化节点类型集合 */
export const EVOLVABLE_TYPES: Set<NodeType> = new Set([
  'turret', 'mine', 'shield', 'energy', 'tesla', 'factory', 'magnet',
  'repair', 'sniper', 'buffer', 'collector', 'interceptor', 'radar',
  'portal', 'blackhole', 'echo', 'toxin', 'arc', 'kamikaze',
]);

/** 进化后名称（用于 UI 描述） */
export const EVOLUTION_NAMES: Partial<Record<NodeType, string>> = {
  turret: '狙击炮',
  mine: '精炼厂',
  shield: '堡垒',
  energy: '核聚变',
  tesla: '雷暴',
  factory: '航母',
  magnet: '黑洞',
  repair: '纳米工坊',
  sniper: '死神',
  buffer: '增幅器',
  collector: '量子拾荒',
  interceptor: '护卫者',
  radar: '全息雷达',
  portal: '虫洞门',
  blackhole: '奇点',
  echo: '回响核心',
  toxin: '瘡疫之源',
  arc: '裂雷',
  kamikaze: '超新星',
};

/** 进化所需资源 — 转发到 balance.calcEvolutionCost */
export const getEvolutionCost = calcEvolutionCost;
/** 进化所需晶体 — 转发到 balance.calcEvolutionCrystalCost */
export const getEvolutionCrystalCost = calcEvolutionCrystalCost;
