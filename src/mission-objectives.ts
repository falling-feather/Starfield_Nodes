import type { GameState } from './types';
import { isWormholeHubActive } from './terrain-poly';
import type { LevelConfig } from './levels';
import { frontierStatus } from './frontier';

export function protectedCoresIntact(state: GameState): boolean {
  return (
    !!state.protectedCoreIds?.size &&
    [...state.protectedCoreIds].every((id) =>
      state.nodes.some((n) => n.id === id && n.type === 'core' && n.status !== 'destroyed'),
    )
  );
}

/** Combat is resolved before this check; loss takes precedence over a simultaneous win. */
export function missionOutcome(
  state: GameState,
  level: LevelConfig | null,
  bossSpawned: boolean,
): 'won' | 'lost' | null {
  if (
    state.gameOver ||
    !state.nodes.some((n) => n.type === 'core' && n.owner === 'player' && n.status !== 'destroyed')
  )
    return 'lost';
  if (!level) return null;
  if (level.objective === 'protect' && !protectedCoresIntact(state)) return 'lost';
  if (level.objective === 'network') return frontierStatus(state)?.complete ? 'won' : null;
  const achieved =
    level.objective === 'boss'
      ? bossSpawned && !state.enemies.some((e) => e.type === 'boss' && e.hp > 0)
      : level.objective === 'timed'
        ? level.timeLimit > 0 && state.elapsedSeconds >= level.timeLimit
        : state.wave > level.targetWaves;
  if (!achieved) return null;
  const secondary = secondaryObjectiveStatus(state);
  return !secondary || secondary.complete ? 'won' : null;
}

/** One authoritative check feeds both the HUD and the victory condition. */
export function secondaryObjectiveStatus(
  state: GameState,
): { complete: boolean; label: string } | null {
  const objective = state.mission?.secondaryObjective;
  if (!objective) return null;
  if (objective.kind === 'observatory') {
    const x = objective.position.x * state.worldWidth,
      y = objective.position.y * state.worldHeight;
    const sites = state.nodes.filter(
      (n) => n.type === 'beacon' && Math.hypot(n.x - x, n.y - y) < 85,
    );
    const live = sites.filter((n) => n.status !== 'destroyed');
    const owned = live.find((n) => n.owner === 'player');
    const complete = live.some(
      (n) => n.owner === 'player' && n.connected && n.currentEnergy >= n.activationThreshold,
    );
    const status = complete
      ? '已接通'
      : !live.length
        ? sites.length
          ? '信标损毁，请在原址重建'
          : '请在标记处建造信标'
        : !owned
          ? '待侦察并招募'
          : !owned.connected
            ? '等待接入电网'
            : '等待充能，请检查供电';
    return { complete, label: `远端观测点 · ${status}` };
  }
  const complete = state.nodes.some(
    (n) =>
      n.type === 'relay' &&
      n.owner === 'player' &&
      n.status !== 'destroyed' &&
      n.connected &&
      n.currentEnergy >= n.activationThreshold &&
      isWormholeHubActive(state, n.x, n.y, ['relay']),
  );
  return {
    complete,
    label: complete ? '双端虫洞中继 · 已接通' : '双端虫洞中继 · 检查两端设施与供电',
  };
}
