import { VISION } from './data/balance';
import type { GameState, Enemy, VisibilityState, NodeType, MissionTactics } from './types';
import { pointInPolygon } from './terrain-poly';

const CELL = VISION.cellSize;
export function baseSensorRadius(type:NodeType,mission?:MissionTactics):number {
  const base=type==='core'?VISION.core:type==='beacon'?VISION.beacon:type==='radar'?VISION.radar:VISION.node;
  return (mission?.frontier&&(type==='beacon'||type==='radar')?Math.min(base,VISION.frontierSensor):base)*(mission?.visionMultiplier??1);
}

export function createVisibility(width: number, height: number): VisibilityState {
  const cols = Math.ceil(width / CELL),
    rows = Math.ceil(height / CELL);
  return {
    cols,
    rows,
    cellSize: CELL,
    visible: new Uint8Array(cols * rows),
    explored: new Uint8Array(cols * rows),
    sources: [],
    revision: 0,
  };
}

/** This is the shared information model for rendering, building, minimap and targeting. */
export function updateVisibility(state: GameState): void {
  const v = (state.visibility ??= createVisibility(state.worldWidth, state.worldHeight));
  const oldVisible = v.visible.slice(),
    oldSources = v.sources;
  v.visible.fill(0);
  const multiplier = (state.signalBlackoutUntil ?? 0) > state.elapsedSeconds ? VISION.blackoutFactor : 1;
  v.sources = state.nodes
    .filter(
      (n) =>
        n.owner === 'player' &&
        n.status !== 'destroyed' &&
        (n.type === 'core' || (n.connected && n.currentEnergy >= n.activationThreshold)),
    )
    .map((n) => {
      let radius = baseSensorRadius(n.type,state.mission) * multiplier;
      if (state.weatherClouds.some((c) => Math.hypot(n.x - c.x, n.y - c.y) < c.radius))
        radius *= VISION.weatherFactor;
      return { x: n.x, y: n.y, radius, detector: n.type === 'beacon' || n.type === 'radar' };
    });
  // A powered near-end relay can scout the partner gate before recruiting its relay.
  for (const gate of state.terrainPolygons) {
    if (gate.type !== 'wormhole' || !gate.linkedId) continue;
    if (
      !state.nodes.some(
        (n) =>
          n.type === 'relay' &&
          n.owner === 'player' &&
          n.connected &&
          n.currentEnergy >= n.activationThreshold &&
          pointInPolygon(n.x, n.y, gate),
      )
    )
      continue;
    const partner = state.terrainPolygons.find((p) => p.id === gate.linkedId);
    if (partner)
      v.sources.push({
        x: partner.centroid.x,
        y: partner.centroid.y,
        radius: VISION.remoteGate,
        detector: false,
      });
  }
  for (const source of v.sources) {
    const left = Math.max(0, Math.floor((source.x - source.radius) / CELL));
    const right = Math.min(v.cols - 1, Math.floor((source.x + source.radius) / CELL));
    const top = Math.max(0, Math.floor((source.y - source.radius) / CELL));
    const bottom = Math.min(v.rows - 1, Math.floor((source.y + source.radius) / CELL));
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        if (Math.hypot((x + 0.5) * CELL - source.x, (y + 0.5) * CELL - source.y) <= source.radius) {
          const index = y * v.cols + x;
          v.visible[index] = 1;
          v.explored[index] = 1;
        }
      }
  }
  const changed =
    oldSources.length !== v.sources.length ||
    v.sources.some((source, i) => {
      const previous = oldSources[i];
      return (
        !previous ||
        previous.x !== source.x ||
        previous.y !== source.y ||
        previous.radius !== source.radius ||
        previous.detector !== source.detector
      );
    }) ||
    v.visible.some((cell, i) => cell !== oldVisible[i]);
  if (changed) v.revision++;
}

function cellIndex(state: GameState, x: number, y: number): number {
  const v = state.visibility;
  if (!v || x < 0 || y < 0 || x >= state.worldWidth || y >= state.worldHeight) return -1;
  return Math.floor(y / v.cellSize) * v.cols + Math.floor(x / v.cellSize);
}

export function isPositionVisible(state: GameState, x: number, y: number): boolean {
  const index = cellIndex(state, x, y);
  return index >= 0 && state.visibility.visible[index] === 1;
}

export function isPositionExplored(state: GameState, x: number, y: number): boolean {
  const index = cellIndex(state, x, y);
  return index >= 0 && state.visibility.explored[index] === 1;
}

export function canDetectEnemy(state: GameState, enemy: Enemy): boolean {
  if (enemy.hp <= 0 || !isPositionVisible(state, enemy.x, enemy.y)) return false;
  return (
    enemy.type !== 'stealth' ||
    (enemy.revealedUntil ?? 0) > state.elapsedSeconds ||
    state.visibility.sources.some(
      (s) => s.detector && Math.hypot(s.x - enemy.x, s.y - enemy.y) <= s.radius,
    )
  );
}
