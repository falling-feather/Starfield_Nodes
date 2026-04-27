// ===== 图数据结构 + 算法逻辑 =====
import type {
  GameNode, Edge, GameState, NodeType, EdgeType, TerrainZone,
} from './types';
import {
  MAX_EDGE_LENGTH, CORE_ENERGY_PRODUCTION,
  TERRITORY_RADIUS, EXPANDED_TERRITORY_RADIUS, TERRITORY_DISCOUNT,
} from './data/runtime';
import { NODE_CONFIGS } from './data/nodes';
import { EDGE_CONFIGS } from './data/edges';
import { COLORS } from './ui-tokens';
import { OVERCHARGE, COMBAT, ENERGY_COSTS, ENERGY_GAINS, ECONOMY } from './data/balance';
import { ENEMY_BASE_SPEED, DEFAULT_ENEMY_BASE_SPEED } from './data/enemies';
import { sfxTesla, sfxFactory, sfxTrapExplode, sfxShoot, sfxOvercharge } from './audio';
import { rand } from './rng';
import { emitDestructionParticles } from './particles';

let nodeIdCounter = 0;
let edgeIdCounter = 0;

/**
 * V1.2.1：标记一对联动被触发。
 * 仅在「首次发现」时把 id 推入 state.pendingSynergyEvents，供 UI 派发 toast。
 * 重复触发幂等，无副作用。
 */
export function markSynergy(state: GameState, id: string): void {
  if (state.discoveredSynergies.has(id)) return;
  state.discoveredSynergies.add(id);
  state.pendingSynergyEvents.push(id);
}

export function createNode(x: number, y: number, type: NodeType): GameNode {
  const cfg = NODE_CONFIGS[type];
  return {
    id: `n_${nodeIdCounter++}`,
    x, y, type,
    level: 1,
    currentEnergy: type === 'core' ? cfg.maxEnergy : 0,
    maxEnergy: cfg.maxEnergy,
    status: 'normal',
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    activationThreshold: cfg.activationThreshold,
    radius: cfg.radius,
    glowColor: cfg.glowColor,
    pulsePhase: rand() * Math.PI * 2,
    overchargeBuildup: 0,
    overchargeTicks: 0,
    overchargeCooldown: 0,
    evolved: false,
    connected: type === 'core', // 核心默认已连接
    owner: 'player',
    expanded: false,
    hitFlash: 0,
  };
}

export function createEdge(sourceId: string, targetId: string, type: EdgeType = 'standard'): Edge {
  const cfg = EDGE_CONFIGS[type];
  return {
    id: `e_${edgeIdCounter++}`,
    sourceId,
    targetId,
    type,
    throughput: cfg.throughput,
    flowProgress: 0,
    active: false,
    disruptedTimer: 0,
  };
}

/** 计算领地折扣：坐标(x,y)是否在任意核心领地内，返回折扣比例(0~TERRITORY_DISCOUNT) */
export function getTerritoryDiscount(state: GameState, x: number, y: number): number {
  for (const node of state.nodes) {
    if (node.type !== 'core' || node.status === 'destroyed') continue;
    const r = node.expanded ? EXPANDED_TERRITORY_RADIUS : TERRITORY_RADIUS;
    const dx = node.x - x, dy = node.y - y;
    if (dx * dx + dy * dy < r * r) return TERRITORY_DISCOUNT;
  }
  return 0;
}

// ===== 泊松圆盘采样 =====
export function poissonDiskSampling(
  width: number, height: number,
  minDist: number, maxAttempts: number = 30,
  margin: number = 80,
): { x: number; y: number }[] {
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil((width - 2 * margin) / cellSize);
  const gridH = Math.ceil((height - 2 * margin) / cellSize);
  const grid: (number | null)[][] = Array.from({ length: gridW }, () =>
    Array(gridH).fill(null)
  );
  const points: { x: number; y: number }[] = [];
  const activeList: number[] = [];

  // 从中心附近开始（但排除正中心，留给核心基地）
  const cx = (width - 2 * margin) / 2;
  const cy = (height - 2 * margin) / 2;
  const startX = cx + (rand() - 0.5) * 100;
  const startY = cy + (rand() - 0.5) * 100;

  const addPoint = (x: number, y: number) => {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return -1;
    const idx = points.length;
    points.push({ x: x + margin, y: y + margin });
    grid[gx][gy] = idx;
    activeList.push(idx);
    return idx;
  };

  addPoint(startX, startY);

  while (activeList.length > 0) {
    const randIdx = Math.floor(rand() * activeList.length);
    const pidx = activeList[randIdx];
    const px = points[pidx].x - margin;
    const py = points[pidx].y - margin;
    let found = false;

    for (let a = 0; a < maxAttempts; a++) {
      const angle = rand() * Math.PI * 2;
      const dist = minDist + rand() * minDist;
      const nx = px + Math.cos(angle) * dist;
      const ny = py + Math.sin(angle) * dist;

      if (nx < 0 || nx >= width - 2 * margin || ny < 0 || ny >= height - 2 * margin) continue;

      const gx = Math.floor(nx / cellSize);
      const gy = Math.floor(ny / cellSize);
      let tooClose = false;

      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const cx2 = gx + dx;
          const cy2 = gy + dy;
          if (cx2 < 0 || cx2 >= gridW || cy2 < 0 || cy2 >= gridH) continue;
          const ni = grid[cx2][cy2];
          if (ni !== null) {
            const d2 = (points[ni].x - margin - nx) ** 2 + (points[ni].y - margin - ny) ** 2;
            if (d2 < minDist * minDist) {
              tooClose = true;
              break;
            }
          }
        }
        if (tooClose) break;
      }

      if (!tooClose) {
        addPoint(nx, ny);
        found = true;
        break;
      }
    }

    if (!found) {
      activeList.splice(randIdx, 1);
    }
  }

  return points;
}

// ===== 距离计算 =====
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ===== 联动：shield 是否直连同方 repair（用于伤害减免） =====
export function hasShieldRepairLink(state: GameState, node: GameNode): boolean {
  if (node.type !== 'shield') return false;
  for (const edge of state.edges) {
    let otherId: string | null = null;
    if (edge.sourceId === node.id) otherId = edge.targetId;
    else if (edge.targetId === node.id) otherId = edge.sourceId;
    if (!otherId) continue;
    const other = state.nodes.find(n => n.id === otherId);
    if (!other || other.status === 'destroyed') continue;
    if (other.type !== 'repair') continue;
    if (other.owner !== node.owner) continue;
    return true;
  }
  return false;
}

// ===== 连线校验 =====
export function canConnect(state: GameState, sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return false;
  const source = state.nodes.find(n => n.id === sourceId);
  const target = state.nodes.find(n => n.id === targetId);
  if (!source || !target) return false;
  if (source.status === 'destroyed' || target.status === 'destroyed') return false;
  // 中立节点不能连线
  if (source.owner === 'neutral' || target.owner === 'neutral') return false;

  // 距离校验
  if (dist(source, target) > MAX_EDGE_LENGTH) return false;

  // 重复边校验
  const exists = state.edges.some(
    e => (e.sourceId === sourceId && e.targetId === targetId) ||
         (e.sourceId === targetId && e.targetId === sourceId)
  );
  if (exists) return false;

  // 小行星带阻挡连线
  for (const zone of state.terrainZones) {
    if (zone.type === 'asteroid') {
      if (lineIntersectsCircle(source, target, zone, zone.radius)) {
        return false;
      }
    }
  }

  return true;
}

/** 判断线段是否穿过圆形区域 */
function lineIntersectsCircle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  center: { x: number; y: number },
  radius: number,
): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(a, center) <= radius;
  const t = Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return dist(center, { x: projX, y: projY }) <= radius;
}

// ===== BFS 连通性检测（从所有核心出发） =====
export function getConnectedNodes(state: GameState): Set<string> {
  const cores = state.nodes.filter(n => n.type === 'core' && n.status !== 'destroyed');
  if (cores.length === 0) return new Set();

  const visited = new Set<string>();
  const queue: string[] = [];
  for (const core of cores) {
    visited.add(core.id);
    queue.push(core.id);
  }

  // 构建邻接表（跳过被干扰的边）
  const adj = new Map<string, string[]>();
  for (const edge of state.edges) {
    if (edge.disruptedTimer > 0) continue;
    if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, []);
    if (!adj.has(edge.targetId)) adj.set(edge.targetId, []);
    adj.get(edge.sourceId)!.push(edge.targetId);
    adj.get(edge.targetId)!.push(edge.sourceId);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current) || [];
    for (const nid of neighbors) {
      if (!visited.has(nid)) {
        const node = state.nodes.find(n => n.id === nid);
        if (node && node.status !== 'destroyed') {
          visited.add(nid);
          queue.push(nid);
        }
      }
    }
  }

  return visited;
}

/** 更新所有节点的 connected 状态 */
export function updateConnectedStatus(state: GameState): void {
  const connectedIds = getConnectedNodes(state);
  for (const node of state.nodes) {
    if (node.status === 'destroyed') {
      node.connected = false;
    } else {
      node.connected = connectedIds.has(node.id);
    }
  }
}

// ===== BFS 能量分发（支持多核心） =====
export function distributeEnergy(state: GameState): void {
  // 所有核心节点产能
  const cores = state.nodes.filter(n => n.type === 'core' && n.status !== 'destroyed');
  if (cores.length === 0) return;

  for (const core of cores) {
    core.currentEnergy = Math.min(core.maxEnergy, core.currentEnergy + CORE_ENERGY_PRODUCTION);
  }

  // 从所有核心开始 BFS 逐层分发
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const core of cores) {
    visited.add(core.id);
    queue.push(core.id);
  }

  // 构建节点索引
  const nodeMap = new Map<string, GameNode>();
  for (const n of state.nodes) nodeMap.set(n.id, n);

  // 构建邻接表（包含边信息）
  const adj = new Map<string, { nodeId: string; edge: Edge }[]>();
  for (const edge of state.edges) {
    if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, []);
    if (!adj.has(edge.targetId)) adj.set(edge.targetId, []);
    adj.get(edge.sourceId)!.push({ nodeId: edge.targetId, edge });
    adj.get(edge.targetId)!.push({ nodeId: edge.sourceId, edge });
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = nodeMap.get(currentId)!;
    const neighbors = adj.get(currentId) || [];

    for (const { nodeId, edge } of neighbors) {
      if (visited.has(nodeId)) continue;
      // 被干扰的连线无法传输能量
      if (edge.disruptedTimer > 0) { edge.active = false; continue; }
      const target = nodeMap.get(nodeId);
      if (!target || target.status === 'destroyed') continue;

      visited.add(nodeId);
      queue.push(nodeId);

      // 根据带宽传输能量
      const transferAmount = Math.min(edge.throughput, current.currentEnergy * 0.5);
      if (transferAmount > 0 && target.currentEnergy < target.maxEnergy) {
        const amplify = EDGE_CONFIGS[edge.type].amplifyBonus;
        const boosted = transferAmount * (1 + amplify);
        const actual = Math.min(boosted, target.maxEnergy - target.currentEnergy);
        current.currentEnergy -= Math.min(transferAmount, actual);
        target.currentEnergy += actual;
        edge.active = true;
      } else {
        edge.active = false;
      }
    }
  }

  // 标记边活跃状态
  const connectedNodes = getConnectedNodes(state);
  for (const edge of state.edges) {
    edge.active = connectedNodes.has(edge.sourceId) && connectedNodes.has(edge.targetId);
  }
}

export interface TechBonuses {
  damageMultiplier: number;
  rangeMultiplier: number;
  coreProduction: number;
}

// ===== 能量超载系统 =====
const OVERCHARGE_THRESHOLD = OVERCHARGE.threshold;
const OVERCHARGE_BUILDUP = OVERCHARGE.buildup;
const OVERCHARGE_DURATION = OVERCHARGE.duration;
const OVERCHARGE_COOLDOWN = OVERCHARGE.cooldown;
const OVERCHARGEABLE: Set<NodeType> = new Set([
  'turret', 'mine', 'shield', 'tesla', 'factory', 'magnet', 'energy',
]);

export function updateOvercharge(state: GameState): void {
  for (const node of state.nodes) {
    if (node.status === 'destroyed') continue;

    // 冷却倒计时
    if (node.overchargeCooldown > 0) {
      node.overchargeCooldown--;
      node.overchargeBuildup = 0;
      continue;
    }

    // 超载持续倒计时
    if (node.overchargeTicks > 0) {
      node.overchargeTicks--;
      if (node.overchargeTicks === 0) {
        node.overchargeCooldown = OVERCHARGE_COOLDOWN;
      }
      continue;
    }

    // 不可超载的类型直接跳过
    if (!OVERCHARGEABLE.has(node.type)) continue;

    // 累计高能tick
    if (node.currentEnergy >= node.maxEnergy * OVERCHARGE_THRESHOLD) {
      node.overchargeBuildup++;
      if (node.overchargeBuildup >= OVERCHARGE_BUILDUP) {
        node.overchargeTicks = OVERCHARGE_DURATION;
        node.overchargeBuildup = 0;
        sfxOvercharge();
        // 超载触发粒子爆发
        for (let i = 0; i < 8; i++) {
          const angle = rand() * Math.PI * 2;
          const speed = 1 + rand() * 3;
          state.particles.push({
            x: node.x, y: node.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.6 + rand() * 0.4,
            maxLife: 1.0,
            color: COLORS.text.primary,
            size: 2 + rand() * 3,
          });
        }
      }
    } else {
      node.overchargeBuildup = 0;
    }
  }
}

export function isOvercharged(node: GameNode): boolean {
  return node.overchargeTicks > 0;
}

// ===== 节点效果处理 =====
export function processNodeEffects(state: GameState, bonuses?: TechBonuses): void {
  const b = bonuses || { damageMultiplier: 1, rangeMultiplier: 1, coreProduction: 0 };

  // 重置敌人速度（磁力塔每 tick 重新施加减速）
  for (const enemy of state.enemies) {
    enemy.speed = getBaseSpeed(enemy.type) + state.wave * 0.05;
  }

  for (const node of state.nodes) {
    if (node.status === 'destroyed') continue;
    if (node.owner === 'neutral') continue;
    if (node.currentEnergy < node.activationThreshold) continue;

    const oc = isOvercharged(node);
    const ev = node.evolved;

    switch (node.type) {
      case 'mine':
        // 矿机产出资源 — 超载: 3倍 | 进化(精炼厂): +邻居数量奖励 + 产出晶体
        {
          let output = (oc ? ECONOMY.mineOutputOvercharge : ECONOMY.mineOutputBase) * node.level;
          if (ev) {
            const neighbors = state.edges.filter(
              e => e.sourceId === node.id || e.targetId === node.id
            ).length;
            output += neighbors * node.level;
            // 进化矿机额外产出晶体
            state.crystals += node.level;
          }
          state.resources += output;
        }
        node.currentEnergy -= ENERGY_COSTS.mine;
        break;
      case 'turret':
        // 炮塔 — 进化(狙击炮): 射程翻倍+穿透 | 超载: 双发
        fireTurret(state, node, b.damageMultiplier, b.rangeMultiplier * (ev ? 2 : 1), ev);
        if (oc) fireTurret(state, node, b.damageMultiplier, b.rangeMultiplier * (ev ? 2 : 1), ev);
        node.currentEnergy -= oc ? ENERGY_COSTS.turret.oc : ENERGY_COSTS.turret.n;
        break;
      case 'energy':
        // 能量站 — 进化(核聚变): 双倍自充+自动充能最低邻居 | 超载: 广播
        node.currentEnergy = Math.min(node.maxEnergy, node.currentEnergy + (ev ? ENERGY_GAINS.energy.e : ENERGY_GAINS.energy.n));
        if (ev) evolvedEnergyAssist(state, node);
        if (oc) overchargeEnergyBroadcast(state, node);
        // V1.1.9 联动：relay 网络充能（结构型）
        energyRelayNetwork(state, node);
        break;
      case 'shield':
        // 护盾 — 进化(堡垒): 给范围内节点伤害减免标记 | 超载: 脉冲
        if (oc) overchargeHealPulse(state, node);
        else healNearbyNodes(state, node, ev);
        if (ev) evolvedShieldArmor(state, node);
        node.currentEnergy -= oc ? ENERGY_COSTS.shield.oc : ENERGY_COSTS.shield.n;
        break;
      case 'tesla':
        // 连锁塔 — 进化(雷暴): 电击连锁跳跃 | 超载: 双倍
        node.currentEnergy = Math.min(node.maxEnergy, node.currentEnergy + ENERGY_GAINS.tesla);
        teslaDamageEnemies(state, node, b.damageMultiplier * (oc ? 2 : 1), ev);
        break;
      case 'beacon':
        node.currentEnergy -= ENERGY_COSTS.beacon;
        break;
      case 'factory':
        // 工厂 — 进化(航母): AoE附带减速 | 超载: 加速
        {
          const interval = oc ? 2 : 4;
          if (state.tick % interval === 0) {
            factoryAttack(state, node, b.damageMultiplier, b.rangeMultiplier, ev);
            node.currentEnergy -= ENERGY_COSTS.factory;
          }
        }
        break;
      case 'magnet':
        // 磁力塔 — 进化(黑洞): 拉拽敌人 | 超载: 增强
        if (ev) evolvedMagnetPull(state, node, b.rangeMultiplier, oc);
        else if (oc) overchargeMagnetSlow(state, node, b.rangeMultiplier);
        else magnetSlowEnemies(state, node, b.rangeMultiplier);
        node.currentEnergy -= ENERGY_COSTS.magnet;
        break;
      case 'trap':
        if (trapDetonate(state, node, b.damageMultiplier)) {
          break;
        }
        break;
      case 'repair':
        // 维修站 — 进化(纳米工坊): 双倍修复+更大范围 | 超载: 全力修复脉冲
        if (oc) overchargeRepairPulse(state, node, ev);
        else repairNearbyNodes(state, node, ev);
        node.currentEnergy -= oc ? ENERGY_COSTS.repair.oc : ENERGY_COSTS.repair.n;
        break;
      case 'sniper':
        // 狙击手 — 每3tick开一枪 | 进化(死神): 击杀溅射 | 超载: 3倍暴击
        if (state.tick % 3 === 0) {
          fireSniper(state, node, b.damageMultiplier, b.rangeMultiplier * (ev ? 1.5 : 1), ev, oc);
          node.currentEnergy -= oc ? ENERGY_COSTS.sniper.oc : ENERGY_COSTS.sniper.n;
        }
        break;
      case 'buffer':
        // 缓冲器 — 进化(增幅器): 双倍充能+更大范围 | 超载: 能量脉冲
        if (oc) overchargeBufferPulse(state, node, ev);
        else bufferBoostNearby(state, node, ev);
        node.currentEnergy -= oc ? ENERGY_COSTS.buffer.oc : ENERGY_COSTS.buffer.n;
        break;
      case 'collector':
        // 采集器 — 附近敌人越多产出越高 | 进化(量子拾荒): 产晶体 | 超载: 无上限
        collectorHarvest(state, node, ev, oc);
        node.currentEnergy -= ENERGY_COSTS.collector;
        break;
      case 'interceptor':
        // 拦截器 — 快速点防御 | 进化(护卫者): 双发+扩大范围 | 超载: 全方位扫射
        fireInterceptor(state, node, b.damageMultiplier, ev, oc);
        if (ev) fireInterceptor(state, node, b.damageMultiplier, ev, oc);
        node.currentEnergy -= oc ? ENERGY_COSTS.interceptor.oc : ENERGY_COSTS.interceptor.n;
        break;
      case 'radar':
        // 雷达 — 锁定敌人DoT | 进化(全息雷达): 隐身双倍+范围大 | 超载: 全范围扫描
        radarLockDamage(state, node, b.damageMultiplier, ev, oc);
        node.currentEnergy -= ENERGY_COSTS.radar;
        break;
      case 'portal':
        // 传送门 — 将敌人传送回远处 | 进化(虫洞门): 2目标+更远 | 超载: 全部传送
        portalTeleport(state, node, ev, oc);
        node.currentEnergy -= ENERGY_COSTS.portal;
        break;
      case 'blackhole':
        // 黑洞 — 引力拉拽+碾压伤害 | 进化(奇点): 更强拉拽+中心重伤 | 超载: 全域引力
        blackholeGravity(state, node, b.damageMultiplier, ev, oc);
        node.currentEnergy -= ENERGY_COSTS.blackhole;
        break;
      case 'echo':
        // 回声塔 — 复制相邻节点能力 | 进化(回响核心): 同时复制全部 | 超载: 增强效果
        echoMimic(state, node, b, ev, oc);
        node.currentEnergy -= ENERGY_COSTS.echo;
        break;
      case 'toxin':
        // 毒雾 — 范围持续毒伤+减速 | 进化(瘟疫之源): 死亡扩散+更强 | 超载: 大范围剧毒
        toxinCloud(state, node, b.damageMultiplier, ev, oc);
        node.currentEnergy -= ENERGY_COSTS.toxin;
        break;
      case 'arc':
        // 电弧链 — 闪电弹跳多目标 | 进化(裂雷): 更多弹跳+更高伤害 | 超载: 无衰减
        arcChainLightning(state, node, b.damageMultiplier, ev, oc);
        node.currentEnergy -= ENERGY_COSTS.arc;
        break;
      case 'kamikaze':
        // 自爆 — 充能满后核爆自毁 | 进化(超新星): 更大范围+残留伤害 | 超载: 立即引爆
        kamikazeDetonate(state, node, b.damageMultiplier, ev);
        break;
      default:
        break;
    }
  }
}

function fireTurret(state: GameState, turret: GameNode, damageMult: number, rangeMult: number, evolved: boolean = false): void {
  if (state.enemies.length === 0) return;

  const range = COMBAT.turret.rangeBase * turret.level * rangeMult;
  let closest: { enemy: typeof state.enemies[0]; d: number } | null = null;

  for (const enemy of state.enemies) {
    const d = dist(turret, enemy);
    if (d <= range && (!closest || d < closest.d)) {
      closest = { enemy, d };
    }
  }

  if (closest) {
    sfxShoot();
    const damage = COMBAT.turret.damageBase * turret.level * damageMult;
    // 进化(狙击炮): AoE 穿透，对目标周围 evolvedAoeRadius 内敌人也造成伤害
    if (evolved) {
      for (const e of state.enemies) {
        if (dist(closest.enemy, e) <= COMBAT.turret.evolvedAoeRadius) {
          e.hp -= damage;
          e.hitFlash = 1;
        }
      }
    }
    state.projectiles.push({
      x: turret.x,
      y: turret.y,
      targetId: closest.enemy.id,
      speed: evolved ? 12 : 8,
      damage: evolved ? 0 : damage, // 进化版伤害已直接结算
      color: evolved ? '#ff8800' : turret.glowColor,
    });
  }
}

function healNearbyNodes(state: GameState, shield: GameNode, evolved: boolean = false): void {
  const range = evolved ? COMBAT.shield.range.e : COMBAT.shield.range.n;
  const healAmount = (evolved ? COMBAT.shield.healAmount.e : COMBAT.shield.healAmount.n) * shield.level;
  for (const node of state.nodes) {
    if (node.id === shield.id || node.status === 'destroyed') continue;
    if (dist(shield, node) <= range) {
      node.hp = Math.min(node.maxHp, node.hp + healAmount);
      if (node.status === 'damaged' && node.hp > node.maxHp * 0.5) {
        node.status = 'normal';
      }
    }
  }
}

// ===== 维修站修复 =====
function repairNearbyNodes(state: GameState, repair: GameNode, evolved: boolean = false): void {
  const range = evolved ? COMBAT.repair.range.e : COMBAT.repair.range.n;
  const healAmount = (evolved ? COMBAT.repair.healAmount.e : COMBAT.repair.healAmount.n) * repair.level;
  for (const node of state.nodes) {
    if (node.id === repair.id || node.status === 'destroyed') continue;
    if (dist(repair, node) <= range) {
      node.hp = Math.min(node.maxHp, node.hp + healAmount);
      if (node.status === 'damaged' && node.hp > node.maxHp * 0.5) {
        node.status = 'normal';
      }
    }
  }
}

/** 超载维修站：大范围强力修复脉冲 */
function overchargeRepairPulse(state: GameState, repair: GameNode, evolved: boolean): void {
  const range = evolved ? COMBAT.repairPulse.range.e : COMBAT.repairPulse.range.n;
  const healAmount = (evolved ? COMBAT.repairPulse.healAmount.e : COMBAT.repairPulse.healAmount.n) * repair.level;
  for (const node of state.nodes) {
    if (node.id === repair.id || node.status === 'destroyed') continue;
    if (dist(repair, node) <= range) {
      node.hp = Math.min(node.maxHp, node.hp + healAmount);
      if (node.status === 'damaged' && node.hp > node.maxHp * 0.5) {
        node.status = 'normal';
      }
    }
  }
}


// ===== 雷达锁定伤害 =====
function radarLockDamage(state: GameState, radar: GameNode, damageMult: number, evolved: boolean, overcharged: boolean): void {
  const range = overcharged ? COMBAT.radar.range.oc : (evolved ? COMBAT.radar.range.e : COMBAT.radar.range.n);
  const baseDmg = (overcharged ? 8 : (evolved ? 5 : 3)) * radar.level * damageMult;

  for (const enemy of state.enemies) {
    if (dist(radar, enemy) > range) continue;
    let dmg = baseDmg;
    // 进化: 隐身敌人受双倍
    if (evolved && enemy.type === 'stealth') dmg *= 2;
    enemy.hp -= dmg;
  }
}

// ===== 自爆核爆 =====
function kamikazeDetonate(state: GameState, node: GameNode, damageMult: number, evolved: boolean): void {
  const blastRadius = evolved ? COMBAT.kamikaze.blastRadius.e : COMBAT.kamikaze.blastRadius.n;
  const damage = (evolved ? COMBAT.kamikaze.damage.e : COMBAT.kamikaze.damage.n) * node.level * damageMult;

  // 对范围内所有敌人造成伤害
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = dist(node, enemy);
    if (d <= blastRadius) {
      // 距离越近伤害越高
      const falloff = 1 - (d / blastRadius) * COMBAT.kamikaze.falloffMax;
      enemy.hp -= damage * falloff;
      enemy.hitFlash = 1;
    }
  }

  // 屏幕震动
  state.screenShake = evolved ? COMBAT.kamikaze.shake.e : COMBAT.kamikaze.shake.n;

  // 爆炸粒子
  emitDestructionParticles(state, node.x, node.y, COLORS.accent.red);
  emitDestructionParticles(state, node.x, node.y, COLORS.accent.yellow);

  // 自毁
  node.hp = 0;
  node.status = 'destroyed';
  node.currentEnergy = 0;

  // 断开所有连线
  state.edges = state.edges.filter(
    e => e.sourceId !== node.id && e.targetId !== node.id
  );
}

// ===== 电弧链闪电弹跳 =====
function arcChainLightning(state: GameState, arc: GameNode, damageMult: number, evolved: boolean, overcharged: boolean): void {
  if (state.enemies.length === 0) return;

  const range = overcharged ? COMBAT.arc.range.oc : (evolved ? COMBAT.arc.range.e : COMBAT.arc.range.n);
  const baseDmg = (overcharged ? COMBAT.arc.damage.oc : (evolved ? COMBAT.arc.damage.e : COMBAT.arc.damage.n)) * arc.level * damageMult;
  const maxBounces = overcharged ? COMBAT.arc.maxBounces.oc : (evolved ? COMBAT.arc.maxBounces.e : COMBAT.arc.maxBounces.n);
  const bounceRange = evolved ? COMBAT.arc.bounceRange.e : COMBAT.arc.bounceRange.n;
  const decay = overcharged ? COMBAT.arc.decay.oc : (evolved ? COMBAT.arc.decay.e : COMBAT.arc.decay.n);

  // 找第一个目标（范围内最近的）
  let firstTarget: typeof state.enemies[0] | null = null;
  let minDist = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = dist(arc, enemy);
    if (d <= range && d < minDist) {
      firstTarget = enemy;
      minDist = d;
    }
  }
  if (!firstTarget) return;

  // 链式弹跳
  const hit = new Set<string>();
  let current = firstTarget;
  let dmg = baseDmg;

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    current.hp -= dmg;
    current.hitFlash = 1;
    hit.add(current.id);
    dmg *= decay;

    // 寻找下一个弹跳目标
    let next: typeof state.enemies[0] | null = null;
    let nextDist = Infinity;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || hit.has(enemy.id)) continue;
      const d = dist(current, enemy);
      if (d <= bounceRange && d < nextDist) {
        next = enemy;
        nextDist = d;
      }
    }
    if (!next) break;
    current = next;
  }
}

// ===== 毒雾区域伤害 =====
function toxinCloud(state: GameState, toxin: GameNode, damageMult: number, evolved: boolean, overcharged: boolean): void {
  if (state.enemies.length === 0) return;

  const range = overcharged ? COMBAT.toxin.range.oc : (evolved ? COMBAT.toxin.range.e : COMBAT.toxin.range.n);
  const dmg = (overcharged ? COMBAT.toxin.damage.oc : (evolved ? COMBAT.toxin.damage.e : COMBAT.toxin.damage.n)) * toxin.level * damageMult;
  const slowFactor = overcharged ? COMBAT.toxin.slowFactor.oc : (evolved ? COMBAT.toxin.slowFactor.e : COMBAT.toxin.slowFactor.n);

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (dist(toxin, enemy) > range) continue;

    enemy.hp -= dmg;
    enemy.speed = Math.min(enemy.speed, getBaseSpeed(enemy.type) * slowFactor);

    // 进化: 中毒的敌人死亡时扩散毒素到 spreadRange 内其他敌人
    if (evolved && enemy.hp <= 0) {
      for (const other of state.enemies) {
        if (other === enemy || other.hp <= 0) continue;
        if (dist(enemy, other) <= COMBAT.toxin.spreadRange) {
          other.hp -= dmg * COMBAT.toxin.spreadDamageRatio;
        }
      }
    }
  }
}

// ===== 回声塔复制能力 =====
function echoMimic(state: GameState, echo: GameNode, b: TechBonuses, evolved: boolean, overcharged: boolean): void {
  // 找到相邻节点
  const neighbors: GameNode[] = [];
  const nodeMap = new Map<string, GameNode>();
  for (const n of state.nodes) nodeMap.set(n.id, n);

  for (const edge of state.edges) {
    if (edge.disruptedTimer > 0) continue;
    let neighborId: string | null = null;
    if (edge.sourceId === echo.id) neighborId = edge.targetId;
    else if (edge.targetId === echo.id) neighborId = edge.sourceId;
    if (!neighborId) continue;
    const neighbor = nodeMap.get(neighborId);
    if (neighbor && neighbor.status !== 'destroyed' && neighbor.type !== 'echo' && neighbor.type !== 'core') {
      neighbors.push(neighbor);
    }
  }
  if (neighbors.length === 0) return;

  const echoMult = overcharged ? COMBAT.echo.overchargeMult : 1.0;
  const dmg = b.damageMultiplier * echoMult;
  const rng = b.rangeMultiplier;

  // 进化: 复制全部相邻节点；普通: 随机选1个
  const targets = evolved ? neighbors : [neighbors[Math.floor(rand() * neighbors.length)]];

  for (const target of targets) {
    // 用 echo 的位置模拟 target 类型的效果 (创建临时代理节点)
    const proxy: GameNode = {
      ...echo,
      type: target.type,
      level: Math.max(1, Math.ceil(echo.level * COMBAT.echo.proxyLevelScale)), // 稍弱于原版
    };

    switch (target.type) {
      case 'turret': fireTurret(state, proxy, dmg, rng, target.evolved); break;
      case 'shield': healNearbyNodes(state, proxy, target.evolved); break;
      case 'tesla': teslaDamageEnemies(state, proxy, dmg, target.evolved); break;
      case 'repair': repairNearbyNodes(state, proxy, target.evolved); break;
      case 'sniper': fireSniper(state, proxy, dmg, rng, target.evolved, false); break;
      case 'buffer': bufferBoostNearby(state, proxy, target.evolved); break;
      case 'interceptor': fireInterceptor(state, proxy, dmg, target.evolved, false); break;
      case 'radar': radarLockDamage(state, proxy, dmg, target.evolved, false); break;
      case 'magnet': magnetSlowEnemies(state, proxy, rng); break;
      case 'blackhole': blackholeGravity(state, proxy, dmg, target.evolved, false); break;
      case 'collector': collectorHarvest(state, proxy, target.evolved, false); break;
      // portal, mine, trap 等特殊类型不复制
      default: break;
    }
  }
}

// ===== 黑洞引力碾压 =====
function blackholeGravity(state: GameState, bh: GameNode, damageMult: number, evolved: boolean, overcharged: boolean): void {
  if (state.enemies.length === 0) return;

  const range = overcharged ? COMBAT.blackhole.range.oc : (evolved ? COMBAT.blackhole.range.e : COMBAT.blackhole.range.n);
  const crushRange = overcharged ? COMBAT.blackhole.crushRange.oc : (evolved ? COMBAT.blackhole.crushRange.e : COMBAT.blackhole.crushRange.n);
  const pullStr = overcharged ? COMBAT.blackhole.pullStrength.oc : (evolved ? COMBAT.blackhole.pullStrength.e : COMBAT.blackhole.pullStrength.n);
  const crushDmg = (overcharged ? COMBAT.blackhole.crushDamage.oc : (evolved ? COMBAT.blackhole.crushDamage.e : COMBAT.blackhole.crushDamage.n)) * bh.level * damageMult;

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = dist(bh, enemy);
    if (d > range || d < 1) continue;

    // 拉拽 — 越近拉力越强
    const dx = bh.x - enemy.x;
    const dy = bh.y - enemy.y;
    const factor = pullStr * (1 - d / range);
    enemy.x += (dx / d) * factor * 2;
    enemy.y += (dy / d) * factor * 2;

    // 碾压伤害 — 中心区域
    if (d <= crushRange) {
      let dmg = crushDmg * (1 - d / crushRange); // 越近伤害越高
      // 进化: 极近冗伤害
      if (evolved && d < COMBAT.blackhole.closeDistance) dmg *= COMBAT.blackhole.closeDamageMult;
      enemy.hp -= dmg;
    }
  }
}

// ===== 传送门传送 =====
function portalTeleport(state: GameState, portal: GameNode, evolved: boolean, overcharged: boolean): void {
  if (state.enemies.length === 0) return;

  const range = overcharged ? COMBAT.portal.range.oc : (evolved ? COMBAT.portal.range.e : COMBAT.portal.range.n);
  const pushDist = overcharged ? COMBAT.portal.pushDist.oc : (evolved ? COMBAT.portal.pushDist.e : COMBAT.portal.pushDist.n);
  const maxTargets = overcharged ? COMBAT.portal.maxTargets.oc : (evolved ? COMBAT.portal.maxTargets.e : COMBAT.portal.maxTargets.n);

  // 找范围内可传送的敌人 (排除传送冷却中的)
  const candidates = state.enemies.filter(
    e => e.hp > 0 && e.teleportCooldown <= 0 && dist(portal, e) <= range
  );
  if (candidates.length === 0) return;

  // 按离传送门的距离排序，优先最近的
  candidates.sort((a, b) => dist(portal, a) - dist(portal, b));

  const targets = candidates.slice(0, maxTargets);

  // 联动：收集直连的 player owned interceptor（在传送前定位即可，传送后只需打投射物）
  const synergyInterceptors: GameNode[] = [];
  if (COMBAT.portal.synergyInterceptorShot) {
    for (const edge of state.edges) {
      let otherId: string | null = null;
      if (edge.sourceId === portal.id) otherId = edge.targetId;
      else if (edge.targetId === portal.id) otherId = edge.sourceId;
      if (!otherId) continue;
      const other = state.nodes.find(n => n.id === otherId);
      if (!other || other.status === 'destroyed') continue;
      if (other.type !== 'interceptor') continue;
      if (other.owner !== portal.owner) continue;
      synergyInterceptors.push(other);
    }
  }

  for (const enemy of targets) {
    // 联动射击：在敌人被传送前发射，目标锁定该敌人 id（传送后投射物会追到新位置）
    if (synergyInterceptors.length > 0) markSynergy(state, 'portal-interceptor');
    for (const inter of synergyInterceptors) {
      const dmg = COMBAT.interceptor.damage * inter.level * COMBAT.portal.synergyInterceptorDamageMult;
      state.projectiles.push({
        x: inter.x, y: inter.y,
        targetId: enemy.id, speed: 12,
        damage: dmg, color: '#ffaaff',
      });
    }

    // Boss 只被推一半距离
    const actualPush = enemy.type === 'boss' ? pushDist * COMBAT.portal.bossPushRatio : pushDist;
    // 传送到离portal actualPush远的随机方向
    const angle = rand() * Math.PI * 2;
    enemy.x = portal.x + Math.cos(angle) * actualPush;
    enemy.y = portal.y + Math.sin(angle) * actualPush;
    // 限制不超出世界边界
    enemy.x = Math.max(0, Math.min(state.worldWidth, enemy.x));
    enemy.y = Math.max(0, Math.min(state.worldHeight, enemy.y));
    enemy.targetNodeId = null; // 重新寻路
    enemy.teleportCooldown = evolved ? COMBAT.portal.teleportCooldown.e : COMBAT.portal.teleportCooldown.n; // 传送免疫冷却
  }
}

// ===== 拦截器点防御 =====
function fireInterceptor(state: GameState, interceptor: GameNode, damageMult: number, evolved: boolean, overcharged: boolean): void {
  if (state.enemies.length === 0) return;

  const range = evolved ? COMBAT.interceptor.range.e : COMBAT.interceptor.range.n;
  const damage = COMBAT.interceptor.damage * interceptor.level * damageMult;

  if (overcharged) {
    // 超载: 攻击范围内所有敌人
    for (const enemy of state.enemies) {
      if (dist(interceptor, enemy) <= range) {
        state.projectiles.push({
          x: interceptor.x, y: interceptor.y,
          targetId: enemy.id, speed: 10,
          damage, color: '#aaccff',
        });
      }
    }
    return;
  }

  // 优先攻击离友方节点最近的敌人（保护友军）
  let bestTarget: typeof state.enemies[0] | null = null;
  let minDistToNode = Infinity;

  for (const enemy of state.enemies) {
    if (dist(interceptor, enemy) > range) continue;
    for (const node of state.nodes) {
      if (node.status === 'destroyed' || node.id === interceptor.id) continue;
      const d = dist(enemy, node);
      if (d < minDistToNode) {
        minDistToNode = d;
        bestTarget = enemy;
      }
    }
  }

  if (bestTarget) {
    state.projectiles.push({
      x: interceptor.x, y: interceptor.y,
      targetId: bestTarget.id, speed: 10,
      damage, color: interceptor.glowColor,
    });
  }
}

// ===== 采集器收集资源 =====
function collectorHarvest(state: GameState, collector: GameNode, evolved: boolean, overcharged: boolean): void {
  const range = overcharged ? COMBAT.collector.range.oc : (evolved ? COMBAT.collector.range.e : COMBAT.collector.range.n);
  let nearbyCount = 0;
  for (const enemy of state.enemies) {
    if (dist(collector, enemy) <= range) nearbyCount++;
  }
  if (nearbyCount === 0) return;

  // 联动：直连 player owned buffer 数量（用于产能加成 + 晶体阈值减免）
  let bufferLinkCount = 0;
  for (const edge of state.edges) {
    let otherId: string | null = null;
    if (edge.sourceId === collector.id) otherId = edge.targetId;
    else if (edge.targetId === collector.id) otherId = edge.sourceId;
    if (!otherId) continue;
    const other = state.nodes.find(n => n.id === otherId);
    if (!other || other.status === 'destroyed') continue;
    if (other.type !== 'buffer') continue;
    if (other.owner !== collector.owner) continue;
    bufferLinkCount++;
  }
  const synergyMult = bufferLinkCount > 0 ? (1 + COMBAT.collector.synergyBufferBonus) : 1;
  if (bufferLinkCount > 0) markSynergy(state, 'buffer-collector');

  const cap = overcharged ? nearbyCount : Math.min(nearbyCount, COMBAT.collector.maxNearbyCap);
  const output = cap * collector.level * (evolved ? COMBAT.collector.evolvedOutputMult : 1) * synergyMult;
  state.resources += Math.floor(output);

  // 进化(量子拾荒): crystalThreshold+敌人在范围内时每tick产1晶体
  // 联动：每接 1 个 buffer，threshold -1（最低 1）
  if (evolved) {
    const reduce = bufferLinkCount * COMBAT.collector.synergyCrystalThresholdReduce;
    const effectiveThreshold = Math.max(1, COMBAT.collector.crystalThreshold - reduce);
    if (nearbyCount >= effectiveThreshold) {
      state.crystals += 1;
    }
  }
}

// ===== 缓冲器能量增幅 =====
function bufferBoostNearby(state: GameState, buffer: GameNode, evolved: boolean): void {
  const range = evolved ? COMBAT.buffer.range.e : COMBAT.buffer.range.n;
  let boost = (evolved ? COMBAT.buffer.boostPerLevel.e : COMBAT.buffer.boostPerLevel.n) * buffer.level;
  // V1.1.8 联动：buffer 直连任一同方 energy 时，boost × synergyEnergyBoostMult
  let energyLinked = false;
  for (const edge of state.edges) {
    let otherId: string | null = null;
    if (edge.sourceId === buffer.id) otherId = edge.targetId;
    else if (edge.targetId === buffer.id) otherId = edge.sourceId;
    if (!otherId) continue;
    const other = state.nodes.find(n => n.id === otherId);
    if (!other || other.status === 'destroyed') continue;
    if (other.type !== 'energy') continue;
    if (other.owner !== buffer.owner) continue;
    energyLinked = true;
    break;
  }
  if (energyLinked) {
    boost *= COMBAT.buffer.synergyEnergyBoostMult;
    markSynergy(state, 'energy-buffer');
  }
  for (const node of state.nodes) {
    if (node.id === buffer.id || node.status === 'destroyed') continue;
    if (node.owner === 'neutral') continue;
    if (dist(buffer, node) <= range) {
      node.currentEnergy = Math.min(node.maxEnergy, node.currentEnergy + boost);
    }
  }
}

/** 超载缓冲器：大范围能量脉冲 + 临时超充 */
function overchargeBufferPulse(state: GameState, buffer: GameNode, evolved: boolean): void {
  const range = evolved ? COMBAT.bufferPulse.range.e : COMBAT.bufferPulse.range.n;
  const boost = (evolved ? COMBAT.bufferPulse.boostPerLevel.e : COMBAT.bufferPulse.boostPerLevel.n) * buffer.level;
  for (const node of state.nodes) {
    if (node.id === buffer.id || node.status === 'destroyed') continue;
    if (node.owner === 'neutral') continue;
    if (dist(buffer, node) <= range) {
      // 超充：可超过 maxEnergy 的 overchargeCapRatio
      const cap = node.maxEnergy * COMBAT.bufferPulse.overchargeCapRatio;
      node.currentEnergy = Math.min(cap, node.currentEnergy + boost);
    }
  }
}

// ===== 狙击手远程射击 =====
function fireSniper(state: GameState, sniper: GameNode, damageMult: number, rangeMult: number, evolved: boolean, overcharged: boolean): void {
  if (state.enemies.length === 0) return;

  const range = (COMBAT.sniper.rangeBase + sniper.level * COMBAT.sniper.rangePerLevel) * rangeMult;
  let target: { enemy: typeof state.enemies[0]; d: number } | null = null;

  // 优先攻击血量最高的敌人（远程狙击策略）
  for (const enemy of state.enemies) {
    const d = dist(sniper, enemy);
    if (d <= range) {
      if (!target || enemy.hp > target.enemy.hp) {
        target = { enemy, d };
      }
    }
  }

  if (!target) return;

  sfxShoot();
  const baseDamage = COMBAT.sniper.damage * sniper.level * damageMult;
  const damage = overcharged ? baseDamage * COMBAT.sniper.overchargeDamageMult : baseDamage;

  // 进化(死神)：击杀时对周围60px内敌人溅射50%伤害
  if (evolved) {
    target.enemy.hp -= damage;
    target.enemy.hitFlash = 1;
    if (target.enemy.hp <= 0) {
      // 溅射伤害
      const splashRange = COMBAT.sniper.splashRange;
      const splashDmg = damage * COMBAT.sniper.splashDamageRatio;
      for (const e of state.enemies) {
        if (e.id === target.enemy.id) continue;
        if (dist(target.enemy, e) <= splashRange) {
          e.hp -= splashDmg;
          e.hitFlash = 0.6;
        }
      }
    }
  }

  // 发射弹丸
  state.projectiles.push({
    x: sniper.x,
    y: sniper.y,
    targetId: target.enemy.id,
    speed: 14,
    damage: evolved ? 0 : damage,  // 进化版伤害已直接结算
    color: overcharged ? '#ffcc00' : sniper.glowColor,
  });
}

// ===== 连锁塔电网伤害 =====
function teslaDamageEnemies(state: GameState, tesla: GameNode, damageMult: number, evolved: boolean = false): void {
  // 查找所有连接到此 tesla 节点的边
  const teslaEdges = state.edges.filter(
    e => e.sourceId === tesla.id || e.targetId === tesla.id
  );
  if (teslaEdges.length === 0) return;

  const nodeMap = new Map<string, GameNode>();
  for (const n of state.nodes) nodeMap.set(n.id, n);

  const damage = COMBAT.tesla.damage * tesla.level * damageMult;
  const hitRange = COMBAT.tesla.hitRange;
  let hitAny = false;
  const hitEnemies = new Set<string>();

  // 收集"二级电弧"段（tesla → relay → relay 的另一邻居）
  type ArcSeg = { a: GameNode; b: GameNode; dmg: number };
  const secondHopSegs: ArcSeg[] = [];

  for (const edge of teslaEdges) {
    const other = nodeMap.get(edge.sourceId === tesla.id ? edge.targetId : edge.sourceId);
    if (!other || other.status === 'destroyed') continue;

    for (const enemy of state.enemies) {
      const d = pointToSegmentDist(enemy, tesla, other);
      if (d <= hitRange) {
        enemy.hp -= damage;
        enemy.hitFlash = 1;
        hitEnemies.add(enemy.id);
        hitAny = true;
        if (rand() < 0.3) {
          state.particles.push({
            x: enemy.x + (rand() - 0.5) * 10,
            y: enemy.y + (rand() - 0.5) * 10,
            vx: (rand() - 0.5) * 4,
            vy: (rand() - 0.5) * 4,
            life: 0.2 + rand() * 0.2,
            maxLife: 0.4,
            color: evolved ? COLORS.text.primary : '#ccff00',
            size: 2 + rand() * 2,
          });
        }
      }
    }

    // 联动：other 是同方 relay → 借道二级延伸
    if (
      COMBAT.tesla.synergyRelayHop
      && other.type === 'relay'
      && other.owner === tesla.owner
    ) {
      const secondDmg = damage * COMBAT.tesla.synergyRelayDamageRatio;
      for (const e2 of state.edges) {
        if (e2.id === edge.id) continue;
        if (e2.sourceId !== other.id && e2.targetId !== other.id) continue;
        const tip = nodeMap.get(e2.sourceId === other.id ? e2.targetId : e2.sourceId);
        if (!tip || tip.id === tesla.id || tip.status === 'destroyed') continue;
        secondHopSegs.push({ a: other, b: tip, dmg: secondDmg });
        markSynergy(state, 'tesla-relay');
      }
    }
  }

  // 处理二级段（去重：同段只算一次）
  const seenSegKeys = new Set<string>();
  for (const seg of secondHopSegs) {
    const k = seg.a.id < seg.b.id ? `${seg.a.id}|${seg.b.id}` : `${seg.b.id}|${seg.a.id}`;
    if (seenSegKeys.has(k)) continue;
    seenSegKeys.add(k);
    for (const enemy of state.enemies) {
      const d = pointToSegmentDist(enemy, seg.a, seg.b);
      if (d <= hitRange) {
        enemy.hp -= seg.dmg;
        enemy.hitFlash = 1;
        hitAny = true;
      }
    }
  }

  // 进化(雷暴): 被击中敌人周围60px内的其他敌人也受到50%伤害
  if (evolved && hitEnemies.size > 0) {
    const chainDamage = damage * COMBAT.tesla.chainRatio;
    for (const enemy of state.enemies) {
      if (hitEnemies.has(enemy.id)) continue;
      for (const hitId of hitEnemies) {
        const hitEnemy = state.enemies.find(e => e.id === hitId);
        if (hitEnemy && dist(hitEnemy, enemy) <= 60) {
          enemy.hp -= chainDamage;
          enemy.hitFlash = 1;
          break; // 只连锁一次
        }
      }
    }
  }

  if (hitAny) sfxTesla();
}

// 点到线段距离
function pointToSegmentDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return dist(p, { x: projX, y: projY });
}

// ===== 工厂无人机攻击（AoE 伤害最近敌人区域） =====
function factoryAttack(state: GameState, factory: GameNode, damageMult: number, rangeMult: number, evolved: boolean = false): void {
  const range = COMBAT.antiRepair.rangeBase * rangeMult;
  let closest: { enemy: typeof state.enemies[0]; d: number } | null = null;

  for (const enemy of state.enemies) {
    const d = dist(factory, enemy);
    if (d <= range && (!closest || d < closest.d)) {
      closest = { enemy, d };
    }
  }

  if (!closest) return;
  sfxFactory();

  const aoeRadius = evolved ? COMBAT.factory.aoeRadius.e : COMBAT.factory.aoeRadius.n;
  const damage = COMBAT.factory.damage * factory.level * damageMult;

  for (const enemy of state.enemies) {
    if (dist(closest.enemy, enemy) <= aoeRadius) {
      enemy.hp -= damage;
      enemy.hitFlash = 1;
      // 进化(航母): AoE 附带减速
      if (evolved) {
        enemy.speed = Math.min(enemy.speed, getBaseSpeed(enemy.type) * COMBAT.factory.evolvedSlowFactor);
      }
    }
  }

  // 无人机飞行粒子效果
  for (let i = 0; i < 5; i++) {
    state.particles.push({
      x: factory.x + (rand() - 0.5) * 20,
      y: factory.y + (rand() - 0.5) * 20,
      vx: (closest.enemy.x - factory.x) * 0.02 + (rand() - 0.5) * 2,
      vy: (closest.enemy.y - factory.y) * 0.02 + (rand() - 0.5) * 2,
      life: 0.4 + rand() * 0.3,
      maxLife: 0.7,
      color: '#ff8800',
      size: 2 + rand() * 2,
    });
  }
}

// ===== 磁力塔减速 =====
function magnetSlowEnemies(state: GameState, magnet: GameNode, rangeMult: number): void {
  const range = COMBAT.magnet.normal.rangeBase * magnet.level * rangeMult;
  const slowFactor = COMBAT.magnet.normal.slowFactor;

  for (const enemy of state.enemies) {
    if (dist(magnet, enemy) <= range) {
      // 每 tick 重新施加减速（临时效果）
      enemy.speed = Math.min(enemy.speed, getBaseSpeed(enemy.type) * slowFactor);
    }
  }
}

/** V1.1.9 联动：energy 直连 relay 时，沿 relay 链路给二跳同方节点少量充能（结构型） */
function energyRelayNetwork(state: GameState, energyNode: GameNode): void {
  const boost = COMBAT.energy.synergyRelayNetworkBoost;
  let triggered = false;
  for (const edge of state.edges) {
    if (edge.disruptedTimer > 0) continue;
    let relayId: string | null = null;
    if (edge.sourceId === energyNode.id) relayId = edge.targetId;
    else if (edge.targetId === energyNode.id) relayId = edge.sourceId;
    if (!relayId) continue;
    const relay = state.nodes.find(n => n.id === relayId);
    if (!relay || relay.status === 'destroyed') continue;
    if (relay.type !== 'relay') continue;
    if (relay.owner !== energyNode.owner) continue;

    // 沿 relay 找二跳邻居（≠ energyNode 自己），给同方节点充能
    for (const e2 of state.edges) {
      if (e2.id === edge.id) continue;
      if (e2.disruptedTimer > 0) continue;
      let tipId: string | null = null;
      if (e2.sourceId === relay.id) tipId = e2.targetId;
      else if (e2.targetId === relay.id) tipId = e2.sourceId;
      if (!tipId || tipId === energyNode.id) continue;
      const tip = state.nodes.find(n => n.id === tipId);
      if (!tip || tip.status === 'destroyed') continue;
      if (tip.owner !== energyNode.owner) continue;
      tip.currentEnergy = Math.min(tip.maxEnergy, tip.currentEnergy + boost);
      triggered = true;
    }
  }
  if (triggered) markSynergy(state, 'relay-energy');
}

// ===== 超载专属效果 =====

/** 超载能量站：向所有相邻节点广播额外能量 */
function overchargeEnergyBroadcast(state: GameState, energyNode: GameNode): void {
  const nodeMap = new Map<string, GameNode>();
  for (const n of state.nodes) nodeMap.set(n.id, n);

  for (const edge of state.edges) {
    if (edge.disruptedTimer > 0) continue;
    let neighborId: string | null = null;
    if (edge.sourceId === energyNode.id) neighborId = edge.targetId;
    else if (edge.targetId === energyNode.id) neighborId = edge.sourceId;
    if (!neighborId) continue;

    const neighbor = nodeMap.get(neighborId);
    if (!neighbor || neighbor.status === 'destroyed') continue;
    // 忽略容量限制，可超过 maxEnergy（但不超过 capRatio）
    const boost = COMBAT.energy.ocBroadcastBoost;
    const cap = neighbor.maxEnergy * COMBAT.energy.ocBroadcastCapRatio;
    neighbor.currentEnergy = Math.min(cap, neighbor.currentEnergy + boost);
  }
}

/** 超载护盾：更大范围治疗 + 恢复邻居能量 */
function overchargeHealPulse(state: GameState, shield: GameNode): void {
  const range = COMBAT.shield.ocPulseRange;
  for (const node of state.nodes) {
    if (node.id === shield.id || node.status === 'destroyed') continue;
    if (dist(shield, node) <= range) {
      node.hp = Math.min(node.maxHp, node.hp + COMBAT.shield.ocPulseHealPerLevel * shield.level);
      node.currentEnergy = Math.min(node.maxEnergy, node.currentEnergy + COMBAT.shield.ocPulseEnergyHeal);
      if (node.status === 'damaged' && node.hp > node.maxHp * COMBAT.shield.ocPulseStatusRestoreRatio) {
        node.status = 'normal';
      }
    }
  }
}

/** 超载磁力塔：更大范围 + 更强减速 */
function overchargeMagnetSlow(state: GameState, magnet: GameNode, rangeMult: number): void {
  const range = COMBAT.magnet.overcharge.rangeBase * magnet.level * rangeMult;
  const slowFactor = COMBAT.magnet.overcharge.slowFactor;

  for (const enemy of state.enemies) {
    if (dist(magnet, enemy) <= range) {
      enemy.speed = Math.min(enemy.speed, getBaseSpeed(enemy.type) * slowFactor);
    }
  }
}

// ===== 进化专属效果 =====

/** 进化能量站(核聚变): 自动给能量最低的邻居充能 */
function evolvedEnergyAssist(state: GameState, energyNode: GameNode): void {
  const nodeMap = new Map<string, GameNode>();
  for (const n of state.nodes) nodeMap.set(n.id, n);

  let lowestNeighbor: GameNode | null = null;
  let lowestRatio = 1;

  for (const edge of state.edges) {
    if (edge.disruptedTimer > 0) continue;
    let neighborId: string | null = null;
    if (edge.sourceId === energyNode.id) neighborId = edge.targetId;
    else if (edge.targetId === energyNode.id) neighborId = edge.sourceId;
    if (!neighborId) continue;

    const neighbor = nodeMap.get(neighborId);
    if (!neighbor || neighbor.status === 'destroyed') continue;
    const ratio = neighbor.currentEnergy / neighbor.maxEnergy;
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      lowestNeighbor = neighbor;
    }
  }

  if (lowestNeighbor && lowestRatio < COMBAT.energy.evolvedAssistThreshold) {
    const boost = COMBAT.energy.evolvedAssistBoost;
    lowestNeighbor.currentEnergy = Math.min(lowestNeighbor.maxEnergy, lowestNeighbor.currentEnergy + boost);
  }
}

/** 进化护盾(堡垒): 范围内节点受到伤害减少（通过恢复HP模拟） */
function evolvedShieldArmor(state: GameState, shield: GameNode): void {
  const range = COMBAT.shield.evolvedArmorRange;
  for (const node of state.nodes) {
    if (node.id === shield.id || node.status === 'destroyed') continue;
    if (dist(shield, node) <= range) {
      // 每tick恢复少量HP（模拟30%伤害减免效果）
      node.hp = Math.min(node.maxHp, node.hp + COMBAT.shield.evolvedArmorHealPerTick);
    }
  }
}

/** 进化磁力塔(黑洞): 拉拽敌人向中心 + 减速 */
function evolvedMagnetPull(state: GameState, magnet: GameNode, rangeMult: number, overcharged: boolean): void {
  const range = (overcharged ? COMBAT.magnet.evolved.rangeBaseOc : COMBAT.magnet.evolved.rangeBase) * magnet.level * rangeMult;
  const slowFactor = overcharged ? COMBAT.magnet.evolved.slowFactorOc : COMBAT.magnet.evolved.slowFactor;
  const pullStrength = COMBAT.magnet.evolved.pullStrength;

  for (const enemy of state.enemies) {
    const d = dist(magnet, enemy);
    if (d <= range && d > COMBAT.magnetEvolved.minPullDist) {
      enemy.speed = Math.min(enemy.speed, getBaseSpeed(enemy.type) * slowFactor);
      // 拉拽
      const dx = magnet.x - enemy.x;
      const dy = magnet.y - enemy.y;
      enemy.x += dx / d * pullStrength;
      enemy.y += dy / d * pullStrength;
    }
  }
}

function getBaseSpeed(type: string): number {
  return ENEMY_BASE_SPEED[type] ?? DEFAULT_ENEMY_BASE_SPEED;
}

// ===== 陷阱引爆 =====
function trapDetonate(state: GameState, trap: GameNode, damageMult: number): boolean {
  const detectRange = COMBAT.trap.detectRange;
  const blastRange = COMBAT.trap.blastRange;
  const damage = COMBAT.trap.damage * trap.level * damageMult;

  // 检测范围内是否有敌人
  let hasEnemy = false;
  for (const enemy of state.enemies) {
    if (dist(trap, enemy) <= detectRange) {
      hasEnemy = true;
      break;
    }
  }

  if (!hasEnemy) return false;
  sfxTrapExplode();

  // 爆炸！对范围内所有敌人造成大量伤害
  for (const enemy of state.enemies) {
    if (dist(trap, enemy) <= blastRange) {
      enemy.hp -= damage;
      enemy.hitFlash = 1;
    }
  }

  // 爆炸粒子
  for (let i = 0; i < 20; i++) {
    const angle = rand() * Math.PI * 2;
    const speed = 2 + rand() * 6;
    state.particles.push({
      x: trap.x,
      y: trap.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + rand() * 0.5,
      maxLife: 1,
      color: rand() < 0.5 ? '#ff2222' : '#ff8800',
      size: 3 + rand() * 4,
    });
  }

  // 陷阱自毁
  trap.status = 'destroyed';
  trap.hp = 0;
  trap.currentEnergy = 0;

  // 移除连线
  state.edges = state.edges.filter(
    e => e.sourceId !== trap.id && e.targetId !== trap.id
  );

  return true;
}

// ===== 初始化游戏地图 =====
export function initializeMap(state: GameState, nodeCount?: number, terrainConfig?: { nebulaCount?: number; asteroidCount?: number; wormholePairs?: number }): void {
  const ww = state.worldWidth;
  const wh = state.worldHeight;
  const cx = ww / 2;
  const cy = wh / 2;

  // 创建核心基地
  const core = createNode(cx, cy, 'core');
  state.nodes.push(core);

  // 生成地形
  generateTerrain(state, terrainConfig);

  // 泊松圆盘采样生成中立节点候选位置
  const points = poissonDiskSampling(
    ww, wh,
    90, 30, 60
  );

  // 过滤掉太靠近核心的点，以及在小行星带内的点
  const filtered = points.filter(p => {
    if (dist(p, { x: cx, y: cy }) < 80) return false;
    // 不在小行星带内生成节点
    for (const zone of state.terrainZones) {
      if (zone.type === 'asteroid' && dist(p, zone) < zone.radius) return false;
    }
    return true;
  });
  const shuffled = filtered.sort(() => rand() - 0.5);
  const count = nodeCount ?? Math.min(shuffled.length, 40 + Math.floor(rand() * 15));

  const types: NodeType[] = ['energy', 'energy', 'turret', 'mine', 'relay', 'relay'];
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rand() * types.length)];
    const node = createNode(shuffled[i].x, shuffled[i].y, type);
    state.nodes.push(node);
  }

  // 中立节点 — 散布在地图远处，玩家可花费资源招募
  const neutralTypes: NodeType[] = ['turret', 'mine', 'energy', 'shield', 'tesla'];
  const neutralCandidates = shuffled.slice(count).filter(p => dist(p, { x: cx, y: cy }) > 350);
  const neutralCount = Math.min(neutralCandidates.length, 3 + Math.floor(rand() * 3));
  for (let i = 0; i < neutralCount; i++) {
    const type = neutralTypes[Math.floor(rand() * neutralTypes.length)];
    const node = createNode(neutralCandidates[i].x, neutralCandidates[i].y, type);
    node.owner = 'neutral';
    node.connected = false;
    state.nodes.push(node);
  }

  // 自动连接核心附近的节点（给玩家一个起步基础）
  for (const node of state.nodes) {
    if (node.type === 'core') continue;
    const d = dist(core, node);
    if (d <= MAX_EDGE_LENGTH && state.edges.length < 3) {
      state.edges.push(createEdge(core.id, node.id));
    }
  }
}

// ===== 地形生成 =====
let terrainIdCounter = 0;

export function generateTerrain(
  state: GameState,
  config?: { nebulaCount?: number; asteroidCount?: number; wormholePairs?: number },
): void {
  const ww = state.worldWidth;
  const wh = state.worldHeight;
  const core = state.nodes.find(n => n.type === 'core');
  const coreX = core?.x ?? ww / 2;
  const coreY = core?.y ?? wh / 2;
  const zones: TerrainZone[] = [];

  const nebulaCount = config?.nebulaCount ?? 0;
  const asteroidCount = config?.asteroidCount ?? 0;
  const wormholePairs = config?.wormholePairs ?? 0;

  // 星云区
  for (let i = 0; i < nebulaCount; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = 150 + rand() * (ww - 300);
      const y = 150 + rand() * (wh - 300);
      const radius = 120 + rand() * 100;
      if (dist({ x, y }, { x: coreX, y: coreY }) < radius + 120) continue;
      if (zones.some(z => dist(z, { x, y }) < z.radius + radius * 0.5)) continue;
      zones.push({
        id: `terrain_${terrainIdCounter++}`,
        type: 'nebula',
        x, y, radius,
        slowFactor: 0.4 + rand() * 0.2,
      });
      break;
    }
  }

  // 小行星带
  for (let i = 0; i < asteroidCount; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = 200 + rand() * (ww - 400);
      const y = 200 + rand() * (wh - 400);
      const radius = 80 + rand() * 70;
      if (dist({ x, y }, { x: coreX, y: coreY }) < radius + 180) continue;
      if (zones.some(z => dist(z, { x, y }) < z.radius + radius * 0.6)) continue;
      zones.push({
        id: `terrain_${terrainIdCounter++}`,
        type: 'asteroid',
        x, y, radius,
      });
      break;
    }
  }

  // 虫洞对
  for (let i = 0; i < wormholePairs; i++) {
    const r = 35;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x1 = 200 + rand() * (ww - 400);
      const y1 = 200 + rand() * (wh - 400);
      const x2 = 200 + rand() * (ww - 400);
      const y2 = 200 + rand() * (wh - 400);
      if (dist({ x: x1, y: y1 }, { x: x2, y: y2 }) < 400) continue;
      if (dist({ x: x1, y: y1 }, { x: coreX, y: coreY }) < 200) continue;
      if (dist({ x: x2, y: y2 }, { x: coreX, y: coreY }) < 200) continue;
      if (zones.some(z => dist(z, { x: x1, y: y1 }) < z.radius + r + 30)) continue;
      if (zones.some(z => dist(z, { x: x2, y: y2 }) < z.radius + r + 30)) continue;
      const id1 = `terrain_${terrainIdCounter++}`;
      const id2 = `terrain_${terrainIdCounter++}`;
      zones.push({ id: id1, type: 'wormhole', x: x1, y: y1, radius: r, linkedId: id2 });
      zones.push({ id: id2, type: 'wormhole', x: x2, y: y2, radius: r, linkedId: id1 });
      break;
    }
  }

  state.terrainZones = zones;
}

/** 返回 (x,y) 处的星云减速倍率 (1 = 无减速) */
export function getNebulaSlowFactor(x: number, y: number, state: GameState): number {
  let factor = 1;
  for (const zone of state.terrainZones) {
    if (zone.type === 'nebula' && dist({ x, y }, zone) <= zone.radius) {
      factor = Math.min(factor, zone.slowFactor ?? 0.5);
    }
  }
  return factor;
}

// ===== 能量衰减（未连接节点） =====
export function decayDisconnectedEnergy(state: GameState): void {
  const connected = getConnectedNodes(state);
  for (const node of state.nodes) {
    if (node.type === 'core' || node.status === 'destroyed') continue;
    if (!connected.has(node.id)) {
      node.currentEnergy = Math.max(0, node.currentEnergy - 2);
    }
  }
}
