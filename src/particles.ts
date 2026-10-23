// ===== 粒子特效系统 =====
import type { GameState, Point, StrikeEffect } from './types';
import { EDGE_CONFIGS } from './data/edges';
const rand = Math.random; // Visual randomness must not consume the simulation RNG.

export function updateParticles(state: GameState, dt: number): void {
  for (const strike of state.strikeEffects) strike.life -= dt;
  state.strikeEffects = state.strikeEffects.filter((strike) => strike.life > 0);
  // 更新通用粒子
  for (const p of state.particles) {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.life -= dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  // 更新能量流动粒子
  for (const fp of state.flowParticles) {
    fp.progress += fp.speed * dt;
  }
  state.flowParticles = state.flowParticles.filter((fp) => fp.progress <= 1);

  // 为活跃边生成新的流动粒子
  for (const edge of state.edges) {
    if (!edge.active) continue;

    // 每条活跃边每帧有概率生成流动粒子
    if (rand() < 0.04 + 0.14 * Math.min(1, Math.abs(edge.energyFlow) / edge.throughput)) {
      const sourceNode = state.nodes.find((n) => n.id === edge.sourceId);
      if (sourceNode) {
        const cfg = EDGE_CONFIGS[edge.type];
        const baseColor = cfg.color || sourceNode.glowColor;
        state.flowParticles.push({
          edgeId: edge.id,
          reverse: edge.energyFlow < 0,
          progress: 0,
          speed:
            (0.45 + Math.min(1, Math.abs(edge.energyFlow) / edge.throughput) * 0.65) *
            cfg.flowSpeedMult,
          size: edge.type === 'heavy' ? 3 + rand() * 2 : 2 + rand() * 2,
          color: baseColor,
        });
      }
    }
  }
}

/** Preserve a shot's resolved positions even after its targets move or die. */
export function emitStrike(
  state: GameState,
  points: Point[],
  color: string,
  kind: StrikeEffect['kind'],
): void {
  state.strikeEffects.push({
    points: points.map((p) => ({ x: p.x, y: p.y })),
    color,
    kind,
    life: kind === 'drone' ? .5 : .18,
    maxLife: kind === 'drone' ? .5 : .18,
  });
}

// 生成节点光晕粒子
export function emitNodeParticles(state: GameState): void {
  for (const node of state.nodes) {
    if (
      node.status === 'destroyed' ||
      !node.connected ||
      node.currentEnergy < node.activationThreshold
    )
      continue;
    if (rand() > 0.03) continue;

    const angle = rand() * Math.PI * 2;
    const speed = 0.3 + rand() * 0.8;
    state.particles.push({
      x: node.x + Math.cos(angle) * node.radius,
      y: node.y + Math.sin(angle) * node.radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.8 + rand() * 0.5,
      maxLife: 1.3,
      color: node.glowColor,
      size: 1 + rand(),
    });
  }
}

// 生成敌人销毁粒子（增强版 — 更多粒子+大粒子）
export function emitDestructionParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
): void {
  // 核心碎片
  for (let i = 0; i < 20; i++) {
    const angle = rand() * Math.PI * 2;
    const speed = 2 + rand() * 5;
    state.particles.push({
      x: x + (rand() - 0.5) * 10,
      y: y + (rand() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + rand() * 0.6,
      maxLife: 1.2,
      color,
      size: 2 + rand() * 3,
    });
  }
  // 闪光粒子（短寿命、大尺寸）
  for (let i = 0; i < 5; i++) {
    const angle = rand() * Math.PI * 2;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * 1,
      vy: Math.sin(angle) * 1,
      life: 0.15 + rand() * 0.15,
      maxLife: 0.3,
      color: '#ffffff',
      size: 5 + rand() * 4,
    });
  }
}
