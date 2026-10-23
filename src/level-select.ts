import type { LevelConfig } from './levels';
import { LEVELS, getUnlockedLevels } from './levels';
import { Screen, paginationControls } from './screen';
import { pageWindow, pageForIndex } from './screen-layout';
import { missionMap, objectiveLabel, NODE_PRESENTATION } from './presentation';
import { paintFacilityPortraits } from './facility-art';
let collection: 'frontier' | 'archive' = 'frontier';

export class LevelSelectScreen {
  private screen: Screen;
  private selectedId: number;
  private resolved = false;
  private view: 'map' | 'brief' | 'tactic' | 'kit' = 'map';

  constructor(canvas: HTMLCanvasElement, cleared: number[], onSelect: (level: LevelConfig) => void, onBack?: () => void, initialId = 101) {
    const routes = () => LEVELS.filter(level => collection === 'frontier' ? !!level.tactics?.frontier : !level.tactics?.frontier);
    this.selectedId = routes().some(level => level.id === initialId) ? initialId : routes()[0].id;
    const current = () => routes().find(level => level.id === this.selectedId)!;
    const unlocked = getUnlockedLevels(cleared);
    const launch = () => { if (this.resolved) return; this.resolved = true; this.screen.destroy(); onSelect(current()); };
    const back = () => { if (this.resolved) return; this.resolved = true; this.screen.destroy(); onBack?.(); };
    const changePage = (delta: number) => {
      const list = routes(), page = pageForIndex(list.findIndex(level => level.id === this.selectedId), list.length, 3);
      this.selectedId = list[pageWindow(list.length, 3, page + delta).start].id;
      render();
      this.screen.root.querySelector<HTMLElement>('.expedition-route.selected')?.focus({ preventScroll: true });
    };
    this.screen = new Screen(canvas, 'mission-screen', event => {
      if (['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const list = routes(), index = list.findIndex(level => level.id === this.selectedId);
        this.selectedId = list[(index + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1) + list.length) % list.length].id;
        render();
        this.screen.root.querySelector<HTMLElement>('.expedition-route.selected')?.focus({ preventScroll: true });
      } else if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault(); changePage(event.key === 'PageDown' ? 1 : -1);
      } else if (event.key === 'Enter') { event.preventDefault(); launch(); }
      else if (event.key === 'Escape') back();
    });
    this.screen.root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLElement>('[data-action]');
      if (!button || button instanceof HTMLButtonElement && button.disabled) return;
      switch (button.dataset.action) {
        case 'mission': this.selectedId = Number(button.dataset.id); render(); break;
        case 'collection': collection = button.dataset.collection as typeof collection; this.selectedId = routes()[0].id; render(); break;
        case 'route-page': changePage(Number(button.dataset.direction)); break;
        case 'detail': this.view = button.dataset.view as typeof this.view; render(); break;
        case 'launch': launch(); break;
        case 'back': case 'home': back(); break;
      }
    });
    const render = () => {
      const level = current(), tactics = level.tactics!, list = routes();
      const done = list.filter(route => cleared.includes(route.id)).length;
      const page = pageWindow(list.length, 3, pageForIndex(list.findIndex(route => route.id === this.selectedId), list.length, 3));
      this.screen.root.style.setProperty('--mission-accent', tactics.accent);
      const cards = list.slice(page.start, page.end).map((route, offset) => `<button class="expedition-route ${route.id === this.selectedId ? 'selected' : ''}" data-action="mission" data-id="${route.id}" data-focus-key="mission-${route.id}" aria-pressed="${route.id === this.selectedId}" style="--route-accent:${route.tactics!.accent}">
        <span class="route-number">${String(page.start + offset + 1).padStart(2,'0')}</span><div><small>${route.tactics?.frontier?.chapter.split(' / ')[1] ?? '经典远征'}</small><h2>${route.name}</h2></div><span class="route-completion" aria-label="${cleared.includes(route.id) ? '已完成' : '可以试航'}">${cleared.includes(route.id) ? '✓' : '↗'}</span></button>`).join('');
      const content = this.view === 'map'
        ? `<div class="expedition-chart"><div class="chart-caption"><span>TACTICAL ATLAS</span><span>${level.worldWidth} × ${level.worldHeight}</span></div><div class="chart-map">${missionMap(level)}</div><div class="chart-legend"><span>◇ 任务设施</span><span>⌁ 矿脉</span><span>● 核心</span><span>△ 入侵</span></div></div>`
        : this.view === 'brief' || this.view === 'tactic'
        ? `<div class="brief-reading"><h3>${this.view === 'brief' ? '行动情境' : '布局取舍'}</h3><p>${this.view === 'brief' ? tactics.briefing : tactics.challenge}</p></div>`
        : `<div class="expedition-kit">${(tactics.recommendedNodes ?? []).slice(0,7).map(type => `<div class="kit-card"><canvas width="160" height="128" data-facility="${type}" aria-hidden="true"></canvas><strong>${NODE_PRESENTATION[type].name}</strong></div>`).join('')}</div>`;
      this.screen.render(`${this.screen.header('星域行动 / MISSION CONTROL', !!onBack)}
        <section class="expedition-layout"><div class="expedition-routes"><div class="section-heading"><div><p class="eyebrow">CHOOSE YOUR FRONTIER</p><h1>选择你的前线</h1></div><span class="progress-chip">${done} / ${list.length}</span></div>
        <div class="mode-tabs" role="group" aria-label="航线集合"><button data-action="collection" data-collection="frontier" data-focus-key="collection-frontier" aria-pressed="${collection === 'frontier'}">前沿行动</button><button data-action="collection" data-collection="archive" data-focus-key="collection-archive" aria-pressed="${collection === 'archive'}">历史航线</button></div>
        <div class="expedition-route-list">${cards}</div>${paginationControls(page, 'route-page', '航线')}<p class="subtle-note">${collection === 'frontier' ? '三张行动均可直接试玩，自由选择路线。' : '保留原进度，任意历史航线均可回访。'}</p></div>
        <aside class="expedition-detail"><header class="expedition-brief"><div><h2>${level.name}</h2><p>${tactics.tagline}</p></div><div class="brief-budget">${level.startResources}<small>起始资源</small></div></header>
        <div class="view-tabs" role="group" aria-label="战术资料">${[['map','战术星图'],['brief','行动简报'],['tactic','布局取舍'],['kit','设施建议']].map(([view,label]) => `<button data-action="detail" data-view="${view}" data-focus-key="detail-${view}" aria-pressed="${this.view === view}">${label}</button>`).join('')}</div>
        <div class="expedition-detail-content">${content}</div><div class="expedition-goal"><small>行动目标</small><strong>${objectiveLabel(level)}</strong></div>
        <div class="expedition-launch"><span>${!unlocked.includes(level) ? '开放试航' : cleared.includes(level.id) ? '✓ 已完成 · 可重玩' : '可直接试航'}</span><button class="primary-button" data-action="launch">配置设施，进入行动 <span>→</span></button></div></aside></section>
        <footer class="screen-footer"><span>自由建造 · 路线选择 · 持续供电</span><span>方向键选关 · PageUp / Down 翻页 · Esc 返回</span></footer>`);
      paintFacilityPortraits(this.screen.root);
    };
    this.screen.onResize(render);
    render();
  }
}
