import { COMBAT, ECONOMY, energyStationOutput } from './data/balance';
import { TICK_INTERVAL } from './data/runtime';
import { NODE_CONFIGS } from './data/nodes';
import type { NodeType } from './types';
import type { LevelConfig } from './levels';
import { baseSensorRadius } from './visibility';

export const NODE_PRESENTATION: Record<NodeType, { name: string; glyph: string; role: string }> = {
  core: { name: '核心', glyph: '◇', role: '网络中枢' },
  energy: { name: '能量站', glyph: 'ϟ', role: '能量生产' },
  turret: { name: '炮塔', glyph: '⊕', role: '定点防御' },
  mine: { name: '矿机', glyph: '⌁', role: '资源生产' },
  shield: { name: '护盾', glyph: '◈', role: '阵地保护' },
  relay: { name: '中继器', glyph: '◎', role: '远距输送' },
  tesla: { name: '连锁塔', glyph: '↯', role: '电网防御' },
  beacon: { name: '信标', glyph: '⌾', role: '侦察探路' },
  factory: { name: '工厂', glyph: '⬡', role: '无人机支援' },
  magnet: { name: '磁力塔', glyph: '⊙', role: '减速控制' },
  trap: { name: '陷阱', glyph: '✦', role: '区域爆破' },
  repair: { name: '维修站', glyph: '✚', role: '持续修复' },
  sniper: { name: '狙击塔', glyph: '⌖', role: '远程打击' },
  buffer: { name: '缓冲器', glyph: '◉', role: '储能增幅' },
  collector: { name: '采集器', glyph: '⟐', role: '资源回收' },
  interceptor: { name: '拦截器', glyph: '⏣', role: '区域防御' },
  radar: { name: '雷达', glyph: '◴', role: '侦测锁定' },
  portal: { name: '传送门', glyph: '◌', role: '空间调度' },
  blackhole: { name: '引力井', glyph: '●', role: '引力控制' },
  echo: { name: '回声塔', glyph: '≋', role: '网络共振' },
  toxin: { name: '毒雾塔', glyph: '⋇', role: '持续伤害' },
  arc: { name: '电弧塔', glyph: '⌁', role: '连锁打击' },
  kamikaze: { name: '自爆塔', glyph: '✳', role: '蓄能爆破' },
};

export function nodeSummary(type: NodeType, level?:LevelConfig): string {
  if (type === 'energy')
    return `基础产能 ${(energyStationOutput(1, false) * 1000) / TICK_INTERVAL} 能量/秒，升级提升产能`;
  if (type === 'turret')
    return `基础伤害 ${COMBAT.turret.damageBase} · 射程 ${COMBAT.turret.rangeBase}`;
  if (type === 'mine')
    if(level?.tactics?.frontier) return '矿脉范围内自由放置，每处一站；升级改善开采效率';
  if (type === 'mine')
    return `基础产出 ${(ECONOMY.mineOutputBase * 1000) / TICK_INTERVAL} 资源/秒，升级提升产出`;
  if (type === 'beacon') return `侦察半径 ${Math.floor(baseSensorRadius(type,level?.tactics))}，可识破隐匿并为观测阵列供电`;
  if (type === 'radar') return `侦测半径 ${Math.floor(baseSensorRadius(type,level?.tactics))}，可识破隐匿并锁定近敌`;
  if (type === 'relay') return '低成本扩张网络；升级降低输能阻力，可接通虫洞';
  if (type === 'factory') return `无人机射程 ${COMBAT.factory.range}，越过岩带进行范围打击`;
  return (
    NODE_CONFIGS[type].description.split(' - ').slice(1).join(' - ') ||
    NODE_CONFIGS[type].description
  );
}

export function objectiveLabel(level: LevelConfig): string {
  const frontier = level.tactics?.frontier;
  if (frontier) return frontier.goal.kind === 'harvest' ? `开采 ${frontier.goal.amount} 份远端矿物` : `恢复 ${frontier.goal.count} 处${frontier.stations.some(s=>s.after) ? '任务设施' : '观测阵列'}`;
  const primary =
    level.objective === 'boss'
      ? `击败第 ${level.bossWave} 波首领`
      : level.objective === 'timed'
        ? `守住 ${Math.round(level.timeLimit / 60)} 分钟`
        : level.objective === 'protect'
          ? `保护双核心，守过 ${level.targetWaves} 波`
          : `守过 ${level.targetWaves} 波入侵`;
  const secondary = level.tactics?.secondaryObjective;
  return (
    primary +
    (secondary ? (secondary.kind === 'observatory' ? ' · 接通远端观测点' : ' · 接通虫洞中继') : '')
  );
}

export const LOGO = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3 35 12v16L20 37 5 28V12Z" stroke="currentColor" opacity=".5"/><path d="m20 10 9 10-9 10-9-10Z" fill="currentColor" opacity=".15"/><path d="M20 10v20M11 20h18" stroke="currentColor"/><circle cx="20" cy="20" r="3" fill="currentColor"/></svg>`;

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export function missionMap(level: LevelConfig): string {
  const w = level.worldWidth,
    h = level.worldHeight;
  const polygons = (level.terrainPolygons ?? [])
    .map(
      (p) =>
        `<polygon class="map-${p.type}" points="${p.vertices.map(([x, y]) => `${(x / w) * 600},${(y / h) * 360}`).join(' ')}"/>`,
    )
    .join('');
  const cores = (level.corePositions ?? [{ x: 0.5, y: 0.5 }])
    .map(
      (p) =>
        `<g transform="translate(${p.x * 600},${p.y * 360})"><circle class="map-sensor" r="45"/><circle class="map-core" r="7"/><path d="M-13 0h26M0-13v26" stroke="currentColor" opacity=".6"/></g>`,
    )
    .join('');
  const entries =
    level.tactics?.entryPoints
      .map(
        (p) =>
          `<g transform="translate(${p.x * 600},${p.y * 360})"><circle class="map-entry" r="5"/><circle class="map-entry-ring" r="15"/></g>`,
      )
      .join('') ?? '';
  const secondary = level.tactics?.secondaryObjective;
  const goal =
    secondary?.kind === 'observatory'
      ? `<g transform="translate(${secondary.position.x * 600},${secondary.position.y * 360})"><path d="m0-8 8 8-8 8-8-8Z" fill="none" stroke="#cfc79b" stroke-width="2"/><circle r="19" fill="none" stroke="#cfc79b66" stroke-dasharray="2 5"/></g>`
      : '';
  const frontier = level.tactics?.frontier;
  const sites = (frontier?.deposits??[]).map(d=>`<g transform="translate(${d.x/w*600},${d.y/h*360})"><circle r="15" fill="#c9ad7510" stroke="#d5bb8888" stroke-dasharray="2 4"/><path d="m-6 3 3-10 5 6 3-4 3 9Z" fill="#d8bc86"/><title>${escapeHtml(d.label)}</title></g>`).join('');
  const stations = (frontier?.stations??[]).map(d=>`<g transform="translate(${d.x/w*600},${d.y/h*360})"><path d="m0-8 8 8-8 8-8-8Z" fill="#a3c2dc22" stroke="#a3c2dc"/><title>${escapeHtml(d.label)}</title></g>`).join('');
  return `<svg viewBox="0 0 600 360" role="img" aria-label="${escapeHtml(level.name)}战术星图"><defs><pattern id="map-grid-${level.id}" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="currentColor" stroke-opacity=".06"/></pattern></defs><rect width="600" height="360" fill="url(#map-grid-${level.id})"/>${polygons}${cores}${entries}${goal}${sites}${stations}<path d="M12 32V12h20M568 12h20v20M588 328v20h-20M32 348H12v-20" stroke="currentColor" stroke-opacity=".3" fill="none"/></svg>`;
}
