import { createVisibility } from '../src/visibility';
import type { GameState, GameNode, Enemy } from '../src/types';
import { createNode } from '../src/graph';

export function node(type: GameNode['type'], x: number, y: number): GameNode {
  const result = createNode(x, y, type);
  result.connected = true;
  result.currentEnergy = result.maxEnergy;
  return result;
}

export function enemy(type: Enemy['type'], x: number, y: number): Enemy {
  return {
    id: `${type}-${x}-${y}`,
    type,
    x,
    y,
    hp: 100,
    maxHp: 100,
    speed: 1,
    damage: 10,
    targetNodeId: null,
    radius: 8,
    teleportCooldown: 0,
    hitFlash: 0,
    damageReduction: 0,
  };
}

export function state(): GameState {
  return {
    visibility: createVisibility(2000, 1400),
    elapsedSeconds: 0,
    nodes: [],
    edges: [],
    enemies: [],
    particles: [],
    flowParticles: [],
    strikeEffects: [],
    projectiles: [],
    tick: 0,
    wave: 1,
    score: 0,
    resources: 200,
    crystals: 0,
    gameOver: false,
    levelWon: false,
    paused: false,
    selectedNodeId: null,
    selectedNodeIds: [],
    draggingFrom: null,
    selectedEdgeType: 'standard',
    mouseX: 0,
    mouseY: 0,
    canvasWidth: 1280,
    canvasHeight: 800,
    worldWidth: 2000,
    worldHeight: 1400,
    camera: { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 },
    terrainZones: [],
    terrainPolygons: [],
    timeScale: 1,
    weatherClouds: [],
    screenShake: 0,
    enemiesKilled: 0,
    nodesBuilt: 0,
    resourcesSpent: 0,
    discoveredSynergies: new Set(),
    pendingSynergyEvents: [],
  };
}
