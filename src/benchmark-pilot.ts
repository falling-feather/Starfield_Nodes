import type { GameState, GameNode, NodeType, Point } from './types';
import type { TechState } from './tech';
import { canConnect, dist } from './graph';
import { buildNode, connectNodes, recruitNode, upgradeNode, placementStatus } from './construction';
import { getMaxEdgeLength, researchTech } from './tech';
import { findPath, isPointWalkable } from './navigation';
import { isPositionVisible } from './visibility';
import { secondaryObjectiveStatus } from './mission-objectives';
import { pointInPolygon } from './terrain-poly';
import { frontierPilot, isFrontierStrategy } from './frontier-pilot';
import type { FrontierStrategy } from './frontier-pilot';

export type BenchStrategy = 'idle' | 'defend' | 'scout' | FrontierStrategy;

/** A regression driver, using exactly the same paid commands as player input. */
export function pilotStep(
  state: GameState,
  tech: TechState,
  allowed: NodeType[],
  strategy: BenchStrategy,
): void {
  if (strategy === 'idle') return;
  if (state.frontier) {
    const selected=isFrontierStrategy(strategy)?strategy:strategy==='defend'?'ring':state.mission?.frontier?.goal.kind==='harvest'?'choke':'parallel';
    frontierPilot(state,tech,allowed,selected);return;
  }
  const owned = state.nodes.filter((n) => n.owner === 'player' && n.status !== 'destroyed');
  const connected = owned.filter((n) => n.connected),
    cores = owned.filter((n) => n.type === 'core');
  for (const node of owned.filter((n) => !n.connected)) {
    const source = connected
      .filter((n) => canConnect(state, n.id, node.id, getMaxEdgeLength(tech)))
      .sort((a, b) => dist(a, node) - dist(b, node))[0];
    if (source && connectNodes(state, source.id, node.id, 'standard', tech).ok) return;
  }
  const build = (type: NodeType, point: Point): boolean => {
    if (!allowed.includes(type) || !placementStatus(state, type, point.x, point.y, tech).valid)
      return false;
    const source = connected
      .filter((n) => dist(n, point) <= getMaxEdgeLength(tech))
      .sort((a, b) => dist(a, point) - dist(b, point))[0];
    if (!source) return false;
    const result = buildNode(state, type, point.x, point.y, tech);
    if (!result.ok) return false;
    connectNodes(state, source.id, result.value.id, 'standard', tech);
    return true;
  };
  const towers = owned.filter((n) =>
    ['turret', 'sniper', 'tesla', 'arc', 'factory'].includes(n.type),
  );
  const towerType =
    allowed.includes('sniper') && towers.length % 3 === 2
      ? 'sniper'
      : allowed.includes('tesla') && towers.length % 4 === 3
        ? 'tesla'
        : (allowed.find((n) => ['turret', 'sniper', 'tesla', 'arc', 'factory'].includes(n)) ??
          'turret');
  for (const core of cores) {
    const energy = owned.filter((n) => n.type === 'energy' && dist(n, core) < 300);
    if (energy.length < 2) {
      for (const dy of [-110, 110])
        if (build('energy', { x: core.x - 145, y: core.y + dy })) return;
    }
  }
  for (const mine of owned.filter((n) => n.type === 'mine' && n.connected && n.level < 2))
    if (upgradeNode(state, mine, tech).ok) return;
  if (state.mission?.enemyPool.includes('stealth')) {
    for (const core of cores)
      if (!owned.some((n) => n.type === 'beacon' && dist(n, core) < 350)) {
        for (const point of [
          { x: core.x + 85, y: core.y - 105 },
          { x: core.x - 90, y: core.y - 120 },
        ])
          if (build('beacon', point)) return;
      }
  }
  if (towers.length >= cores.length * 2) {
    const production = tech.tree.find((t) => t.id === 'core_overcharge');
    if (production && !production.unlocked && researchTech(production.id, tech, state)) return;
    const links = tech.tree.find((t) => t.id === 'efficient_links');
    if (links && !links.unlocked && researchTech(links.id, tech, state)) return;
    // A connected defense can still be starved behind one narrow branch.
    // Add local production and a paid alternate route instead of upgrading guns indefinitely.
    if (state.elapsedSeconds > 30)
      for (const tower of towers.filter(
        (n) => n.connected && n.currentEnergy < n.activationThreshold,
      )) {
        const plant = owned.find((n) => n.type === 'energy' && n.connected && dist(n, tower) < 180);
        if (plant) {
          if (
            canConnect(state, plant.id, tower.id, getMaxEdgeLength(tech)) &&
            connectNodes(state, plant.id, tower.id, 'standard', tech).ok
          )
            return;
          if (plant.level < 3 && upgradeNode(state, plant, tech).ok) return;
        } else if (
          cores.some(
            (core) =>
              dist(core, tower) < 450 &&
              owned.filter((n) => n.type === 'energy' && dist(n, core) < 450).length < 4,
          )
        ) {
          for (const [dx, dy] of [
            [-90, -80],
            [-90, 80],
            [90, -80],
            [90, 80],
          ])
            if (build('energy', { x: tower.x + dx, y: tower.y + dy })) return;
        }
      }
    for (const core of cores) {
      if (
        !owned.some((n) => n.type === 'repair' && dist(n, core) < 200) &&
        build('repair', { x: core.x - 85, y: core.y - 95 })
      )
        return;
      if (
        !owned.some((n) => n.type === 'buffer' && dist(n, core) < 200) &&
        build('buffer', { x: core.x + 75, y: core.y - 100 })
      )
        return;
      if (
        state.wave >= 5 &&
        !owned.some((n) => n.type === 'shield' && dist(n, core) < 200) &&
        build('shield', { x: core.x + 85, y: core.y + 85 })
      )
        return;
    }
  }
  if (strategy === 'scout' && towers.length >= 4 && towers.some((n) => n.level >= 3)) {
    const objective = state.mission?.secondaryObjective;
    if (objective?.kind === 'wormhole-network') {
      for (const gate of state.terrainPolygons.filter((p) => p.type === 'wormhole')) {
        const hasRelay = owned.some((n) => n.type === 'relay' && pointInPolygon(n.x, n.y, gate));
        const neutral = state.nodes.some(
          (n) =>
            n.type === 'relay' &&
            n.owner === 'neutral' &&
            n.status !== 'destroyed' &&
            pointInPolygon(n.x, n.y, gate),
        );
        if (
          !hasRelay &&
          !neutral &&
          isPositionVisible(state, gate.centroid.x, gate.centroid.y) &&
          build('relay', gate.centroid)
        )
          return;
      }

      const remote = connected.find(
        (n) =>
          n.type === 'relay' &&
          cores.every((c) => dist(c, n) > 500) &&
          state.terrainPolygons.some((p) => p.type === 'wormhole' && pointInPolygon(n.x, n.y, p)),
      );
      if (remote) {
        if (allowed.includes('core') && !cores.some((c) => dist(c, remote) < 400)) {
          for (const p of [
            { x: remote.x + 150, y: remote.y + 90 },
            { x: remote.x - 150, y: remote.y + 90 },
          ])
            if (build('core', p)) return;
        }
        const plant = state.nodes.find(
          (n) =>
            n.type === 'energy' &&
            n.owner === 'neutral' &&
            dist(n, remote) < 220 &&
            isPositionVisible(state, n.x, n.y),
        );
        if (plant && recruitNode(state, plant, tech).ok) {
          connectNodes(state, remote.id, plant.id, 'standard', tech);
          return;
        }
        const guards = towers.filter((n) => dist(n, remote) < 350);
        if (guards.length < 2)
          for (const p of [
            { x: remote.x + 130, y: remote.y - 30 },
            { x: remote.x - 100, y: remote.y - 100 },
          ])
            if (build(towerType, p)) return;
      }

      const relay = state.nodes.find(
        (n) =>
          n.owner === 'neutral' &&
          n.type === 'relay' &&
          isPositionVisible(state, n.x, n.y) &&
          state.terrainPolygons.some((p) => p.type === 'wormhole' && pointInPolygon(n.x, n.y, p)),
      );
      if (relay && recruitNode(state, relay, tech).ok) return;
    } else if (objective?.kind === 'observatory' && !secondaryObjectiveStatus(state)?.complete) {
      const goal = {
        x: objective.position.x * state.worldWidth,
        y: objective.position.y * state.worldHeight,
      };
      const station = state.nodes.find(
        (n) =>
          n.type === 'beacon' &&
          n.owner === 'neutral' &&
          dist(n, goal) < 85 &&
          isPositionVisible(state, n.x, n.y),
      );
      if (station && recruitNode(state, station, tech).ok) return;
      const front = [...connected].sort((a, b) => dist(a, goal) - dist(b, goal))[0];
      if (front) {
        const route = findPath(state, front, goal),
          next = route?.[0];
        if (next) {
          const length = dist(front, next),
            step = Math.min(150, length),
            point = {
              x: front.x + ((next.x - front.x) / length) * step,
              y: front.y + ((next.y - front.y) / length) * step,
            };
          if (
            length > 65 &&
            isPointWalkable(state, point.x, point.y) &&
            build(allowed.includes('beacon') ? 'beacon' : 'energy', point)
          )
            return;
        }
      }
    }
  }
  const desired = cores.length * (state.wave < 5 ? 4 : 6);
  if (towers.length < desired) {
    for (const core of [...cores].sort(
      (a, b) =>
        towers.filter((n) => dist(n, a) < 450).length -
        towers.filter((n) => dist(n, b) < 450).length,
    )) {
      if (towers.filter((n) => dist(n, core) < 450).length >= (state.wave < 5 ? 4 : 6)) continue;
      const entry = state.mission?.entryPoints.find(
        (p) => state.wave >= (p.fromWave ?? 1) && state.wave <= (p.untilWave ?? Infinity),
      );
      const angle = entry
        ? Math.atan2(entry.y * state.worldHeight - core.y, entry.x * state.worldWidth - core.x)
        : 0;
      for (const [offset, radius] of [
        [0, 180],
        [-0.65, 180],
        [0.65, 180],
        [-1.25, 195],
        [1.25, 195],
        [Math.PI, 180],
        [-0.3, 285],
        [0.3, 285],
      ]) {
        if (
          build(towerType, {
            x: core.x + Math.cos(angle + offset) * radius,
            y: core.y + Math.sin(angle + offset) * radius,
          })
        )
          return;
      }
    }
  }
  const priority = [
    ...towers,
    ...owned.filter((n) => n.type === 'energy' || n.type === 'shield'),
  ].sort((a: GameNode, b: GameNode) => a.level - b.level);
  for (const node of priority) if (upgradeNode(state, node, tech).ok) return;
}
