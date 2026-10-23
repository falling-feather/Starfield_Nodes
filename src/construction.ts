import type { GameState, NodeType, GameNode, Edge, EdgeType } from './types';
import type { TechState } from './tech';
import { getTechMultiplier, getMaxEdgeLength, applyNodeTech } from './tech';
import { NODE_CONFIGS } from './data/nodes';
import {
  getTerritoryDiscount,
  dist,
  createNode,
  createEdge,
  canConnect,
  connectionBlockReason,
  updateConnectedStatus,
} from './graph';
import { EDGE_CONFIGS } from './data/edges';
import { ECONOMY, calcUpgradeCost } from './data/balance';
import {
  EVOLUTION_LEVEL,
  EVOLVABLE_TYPES,
  getEvolutionCost,
  getEvolutionCrystalCost,
} from './data/evolution';
import { isPointInAsteroidPolygon } from './terrain-poly';
import { isPositionExplored, isPositionVisible, updateVisibility } from './visibility';
import { mineralAt } from './frontier';

export type ActionResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export interface PlacementStatus { valid: boolean; reason: string; cost: number; discount: number }
function refresh(state: GameState): void {
  updateConnectedStatus(state);
  updateVisibility(state);
}

export function placementStatus(
  state: GameState,
  type: NodeType,
  x: number,
  y: number,
  tech: TechState,
): PlacementStatus {
  const cfg = NODE_CONFIGS[type],
    discount = getTerritoryDiscount(state, x, y);
  const cost = Math.floor(cfg.cost * (1 - discount) * getTechMultiplier(tech, 'reduce_cost'));
  const invalid = (reason: string) => ({ valid: false, reason, cost, discount });
  if (state.gameOver || state.levelWon) return invalid('本次航行已经结束');
  if (x < 20 || x > state.worldWidth - 20 || y < 20 || y > state.worldHeight - 20)
    return invalid('超出星域边界');
  if (!isPositionExplored(state, x, y)) return invalid('未知星域 · 先用供电节点或信标探索');
  if (type === 'mine' && state.mission?.frontier) {
    const deposit = mineralAt(state, { x, y });
    if (!deposit) return invalid('采矿站需要放在矿脉范围内');
    if (state.nodes.some(n => n.type === 'mine' && n.status !== 'destroyed' && mineralAt(state,n)?.id === deposit.id))
      return invalid(`${deposit.label}已被采矿站占用`);
  }
  if (state.resources < cost) return invalid('可用资源不足');
  if (isPointInAsteroidPolygon(state, x, y)) return invalid('小行星带内无法建造');
  if (
    state.nodes.some(
      (n) => n.status !== 'destroyed' && dist(n, { x, y }) < n.radius + cfg.radius + 10,
    )
  )
    return invalid('与已有设施距离过近');
  return { valid: true, reason: '', cost, discount };
}

export function buildNode(
  state: GameState,
  type: NodeType,
  x: number,
  y: number,
  tech: TechState,
): ActionResult<GameNode> {
  const quote = placementStatus(state, type, x, y, tech);
  if (!quote.valid) return { ok: false, reason: quote.reason };
  const node = createNode(x, y, type);
  node.investment = quote.cost;
  applyNodeTech(node, tech);
  state.nodes.push(node);
  state.resources -= quote.cost;
  state.resourcesSpent += quote.cost;
  state.nodesBuilt++;
  refresh(state);
  return { ok: true, value: node };
}

export function connectNodes(
  state: GameState,
  from: string,
  to: string,
  type: EdgeType,
  tech: TechState,
): ActionResult<Edge> {
  if (state.gameOver || state.levelWon) return { ok: false, reason: '本次航行已经结束' };
  const maxLength = getMaxEdgeLength(tech), issue = connectionBlockReason(state, from, to, maxLength);
  if (issue === 'range') {
    const source = state.nodes.find(node => node.id === from)!, target = state.nodes.find(node => node.id === to)!;
    return { ok: false, reason: `链路距离 ${Math.ceil(dist(source,target))} / ${Math.floor(maxLength)} · 用中继器延伸` };
  }
  if (issue) {
    const reasons = { same: '请连接两座不同的设施', missing: '这座设施已不在当前战场',
      ownership: '先接管中立设施，再接入电网', destroyed: '设施已损毁，无法接线',
      duplicate: '两座设施已有链路，无需重复建造', terrain: '线路被岩带阻挡 · 改沿边缘布线' };
    return { ok: false, reason: reasons[issue] };
  }
  const cfg = EDGE_CONFIGS[type];
  if (state.resources < cfg.cost) return { ok: false, reason: `资源不足 · 这条链路需要 ${cfg.cost} ◆` };
  if (state.crystals < cfg.crystalCost) return { ok: false, reason: `晶体不足 · 这条链路需要 ${cfg.crystalCost} 晶体` };
  const edge = createEdge(from, to, type);
  edge.throughput += getTechMultiplier(tech, 'boost_throughput');
  state.edges.push(edge);
  state.resources -= cfg.cost;
  state.crystals -= cfg.crystalCost;
  state.resourcesSpent += cfg.cost;
  refresh(state);
  return { ok: true, value: edge };
}

export function recruitNode(
  state: GameState,
  node: GameNode,
  tech: TechState,
): ActionResult<GameNode> {
  if (state.gameOver || state.levelWon) return { ok: false, reason: '本次航行已经结束' };
  if (
    node.owner !== 'neutral' ||
    node.status === 'destroyed' ||
    !isPositionVisible(state, node.x, node.y)
  )
    return { ok: false, reason: '先让侦察信号覆盖这座设施' };
  const cost = NODE_CONFIGS[node.type].cost;
  if (state.resources < cost) return { ok: false, reason: '招募资源不足' };
  node.owner = 'player';
  node.investment = cost;
  applyNodeTech(node, tech);
  state.resources -= cost;
  state.resourcesSpent += cost;
  refresh(state);
  return { ok: true, value: node };
}

export function upgradeNode(
  state: GameState,
  node: GameNode,
  tech: TechState,
): ActionResult<GameNode> {
  if (state.gameOver || state.levelWon) return { ok: false, reason: '本次航行已经结束' };
  if (
    node.owner !== 'player' ||
    node.type === 'core' ||
    !node.connected ||
    node.status === 'destroyed'
  )
    return { ok: false, reason: '这座设施尚未接入核心电网' };
  if (node.level >= EVOLUTION_LEVEL) {
    if (node.evolved || !EVOLVABLE_TYPES.has(node.type))
      return { ok: false, reason: '设施已达到最高形态' };
    const cost = getEvolutionCost(node.type),
      crystals = getEvolutionCrystalCost(node.type);
    if (state.resources < cost || state.crystals < crystals)
      return { ok: false, reason: '进化所需资源或晶体不足' };
    state.resources -= cost;
    state.crystals -= crystals;
    state.resourcesSpent += cost;
    node.investment += cost;
    node.evolved = true;
    node.maxEnergy = Math.floor(node.maxEnergy * ECONOMY.evolutionAttrGrowth);
    node.maxHp = Math.floor(node.maxHp * ECONOMY.evolutionAttrGrowth);
    node.hp = node.maxHp;
  } else {
    const cost = calcUpgradeCost(node.type,node.level);
    if (state.resources < cost) return { ok: false, reason: '升级资源不足' };
    node.level++;
    const cfg = NODE_CONFIGS[node.type];
    node.maxEnergy = Math.floor(cfg.maxEnergy * (1 + node.level * ECONOMY.upgradeEnergyGrowth));
    node.maxHp = Math.floor(cfg.maxHp * (1 + node.level * ECONOMY.upgradeHpGrowth));
    node.hp = node.maxHp;
    applyNodeTech(node, tech);
    node.hp = node.maxHp;
    state.resources -= cost;
    state.resourcesSpent += cost;
    node.investment += cost;
  }
  refresh(state);
  return { ok: true, value: node };
}

export function sellQuote(
  state: GameState,
  node: GameNode,
): { valid: boolean; reason: string; refund: number } {
  const refund = Math.floor(node.investment * (state.frontier ? .75 : .5)),
    invalid = (reason: string) => ({ valid: false, reason, refund });
  if (state.gameOver || state.levelWon) return invalid('本次航行已经结束');
  if (node.owner !== 'player' || node.status === 'destroyed')
    return invalid('只能回收己方存活设施');
  if (state.protectedCoreIds?.has(node.id)) return invalid('任务核心需要保留');
  if (
    node.type === 'core' &&
    state.nodes.filter((n) => n.type === 'core' && n.owner === 'player' && n.status !== 'destroyed')
      .length <= 1
  )
    return invalid('至少保留一座核心');
  return { valid: true, reason: '', refund };
}

export function nearestConnection(state:GameState,node:GameNode,tech:TechState):GameNode | undefined {
  return state.nodes.filter(n=>n.owner==='player'&&n.connected&&n.status!=='destroyed'&&canConnect(state,n.id,node.id,getMaxEdgeLength(tech))).sort((a,b)=>dist(a,node)-dist(b,node))[0];
}

export function sellNode(state: GameState, node: GameNode): ActionResult<GameNode> {
  const quote = sellQuote(state, node);
  if (!quote.valid) return { ok: false, reason: quote.reason };
  state.resources += quote.refund;
  if (state.frontier) state.frontier.recovered += quote.refund;
  state.edges = state.edges.filter((e) => e.sourceId !== node.id && e.targetId !== node.id);
  node.status = 'destroyed';
  node.currentEnergy = 0;
  node.hp = 0;
  if (state.selectedNodeId === node.id) state.selectedNodeId = null;
  state.selectedNodeIds = state.selectedNodeIds.filter((id) => id !== node.id);
  refresh(state);
  return { ok: true, value: node };
}
