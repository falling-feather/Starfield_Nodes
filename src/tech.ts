// ===== 科技树系统 =====
import type { NodeType, GameState } from './types';

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  color: string;
  unlocked: boolean;
  requires: string[]; // 前置科技ID
  effect: TechEffect;
}

export type TechEffect =
  | { type: 'unlock_node'; nodeType: NodeType }
  | { type: 'boost_throughput'; amount: number }
  | { type: 'boost_damage'; multiplier: number }
  | { type: 'boost_energy'; multiplier: number }
  | { type: 'boost_hp'; multiplier: number }
  | { type: 'core_production'; amount: number }
  | { type: 'reduce_cost'; multiplier: number }
  | { type: 'turret_range'; multiplier: number }
  | { type: 'auto_repair'; amount: number }
  | { type: 'max_edge_length'; amount: number };

// 科技树定义
// createTechTree 已迁移至 src/data/tech.ts，此处用 import + 再导出保留向后兼容
// 注意：必须用 import 形式，否则同文件 createTechState() 调用 createTechTree() 时
// 在打包产物里会变成 ReferenceError（纯 export {} from 不进入本模块作用域）
import { createTechTree } from './data/tech';
export { createTechTree };

// 科技树状态
export interface TechState {
  tree: TechNode[];
  showPanel: boolean;
}

export function createTechState(): TechState {
  return {
    tree: createTechTree(),
    showPanel: false,
  };
}

// 检查科技是否可研究
export function canResearch(tech: TechNode, techState: TechState, resources: number): boolean {
  if (tech.unlocked) return false;
  if (resources < tech.cost) return false;
  // 检查前置科技是否已解锁
  return tech.requires.every(reqId =>
    techState.tree.find(t => t.id === reqId)?.unlocked === true
  );
}

// 研究科技
export function researchTech(techId: string, techState: TechState, state: GameState): boolean {
  const tech = techState.tree.find(t => t.id === techId);
  if (!tech || !canResearch(tech, techState, state.resources)) return false;

  state.resources -= tech.cost;
  tech.unlocked = true;

  // 应用科技效果
  applyTechEffect(tech.effect, state);

  return true;
}

// 应用科技效果到全局状态
function applyTechEffect(effect: TechEffect, state: GameState): void {
  switch (effect.type) {
    case 'boost_throughput':
      for (const edge of state.edges) {
        edge.throughput += effect.amount;
      }
      // 存储全局加成，新边也会受到影响
      break;
    case 'boost_hp':
      for (const node of state.nodes) {
        node.maxHp = Math.floor(node.maxHp * effect.multiplier);
        node.hp = Math.min(node.hp * effect.multiplier, node.maxHp);
      }
      break;
    case 'boost_energy':
      for (const node of state.nodes) {
        node.maxEnergy = Math.floor(node.maxEnergy * effect.multiplier);
      }
      break;
    case 'boost_damage':
    case 'turret_range':
    case 'core_production':
    case 'reduce_cost':
    case 'auto_repair':
    case 'max_edge_length':
    case 'unlock_node':
      // 这些效果在游戏逻辑中查询科技树状态来实现
      break;
  }
}

// 查询已解锁的科技效果
export function getTechMultiplier(techState: TechState, effectType: TechEffect['type']): number {
  let result = effectType === 'boost_damage' || effectType === 'boost_energy'
    || effectType === 'boost_hp' || effectType === 'reduce_cost'
    || effectType === 'turret_range' ? 1 : 0;

  for (const tech of techState.tree) {
    if (!tech.unlocked) continue;
    if (tech.effect.type !== effectType) continue;

    if ('multiplier' in tech.effect) {
      result *= tech.effect.multiplier;
    } else if ('amount' in tech.effect) {
      result += tech.effect.amount;
    }
  }

  return result;
}

// 检查节点类型是否已解锁
export function isNodeUnlocked(techState: TechState, nodeType: NodeType): boolean {
  // 基础类型默认解锁
  const defaultUnlocked: NodeType[] = ['core', 'energy', 'turret', 'mine', 'relay'];
  if (defaultUnlocked.includes(nodeType)) return true;

  return techState.tree.some(t =>
    t.unlocked && t.effect.type === 'unlock_node' && t.effect.nodeType === nodeType
  );
}
