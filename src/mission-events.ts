import type { GameState } from './types';
import { spawnEnemy } from './entities';
import { GRACE_PERIOD_TICKS } from './data/runtime';

/** Scripted pressure is tied to simulation ticks and is visible before it strikes. */
export function processMissionEvents(state: GameState): void {
  const mission = state.mission;
  if (!mission) return;
  const disrupt = (count: number, seconds: number) => {
    const edges = state.edges
      .filter((e) => e.disruptedTimer <= 0)
      .sort((a, b) => Math.abs(b.energyFlow) - Math.abs(a.energyFlow))
      .slice(0, count);
    for (const edge of edges) edge.disruptedTimer = seconds;
    return edges.length;
  };
  const period = mission.interferenceEvery ? Math.round(mission.interferenceEvery * 2) : 0;
  if (period && state.tick > GRACE_PERIOD_TICKS) {
    if (state.tick % period === period - 6)
      state.alert = {
        text: '干扰脉冲即将到达 · 检查冗余供电线路',
        until: state.elapsedSeconds + 3,
      };
    if (state.tick % period === 0) {
      const count = disrupt(2, 3);
      if (count)
        state.alert = {
          text: `信号干扰 · ${count} 条主干线路暂时中断`,
          until: state.elapsedSeconds + 3,
        };
    }
  }
  const boss = state.enemies.find((e) => e.type === 'boss' && e.hp > 0);
  if (!boss || !mission.bossStyle) return;
  const phase = boss.hp / boss.maxHp < 0.34 ? 3 : boss.hp / boss.maxHp < 0.67 ? 2 : 1;
  if (phase <= (boss.bossPhase ?? 1)) return;
  boss.bossPhase = phase;
  if (mission.bossStyle === 'siege') {
    spawnEnemy(state, 1, phase === 2 ? 'healer' : 'shielder');
    state.alert = {
      text:
        phase === 2 ? '巢主召集治疗护卫 · 优先切断敌方支援' : '巢主进入防御阶段 · 护盾者正在接近',
      until: state.elapsedSeconds + 6,
    };
  } else if (mission.bossStyle === 'rupture') {
    disrupt(phase, 4);
    state.alert = {
      text: '奇点释放断链脉冲 · 用储能与备用路线维持阵地',
      until: state.elapsedSeconds + 5,
    };
  } else {
    state.signalBlackoutUntil = state.elapsedSeconds + (phase === 2 ? 7 : 10);
    state.alert = { text: '回响遮蔽侦察信号 · 保护前沿信标供能', until: state.elapsedSeconds + 6 };
    if (phase === 3) spawnEnemy(state, 1, 'stealth');
  }
}
