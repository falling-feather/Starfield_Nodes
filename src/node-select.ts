import { recommendedLoadout } from './levels';
import type { LevelConfig } from './levels';
import type { NodeType } from './types';
import { NODE_CONFIGS } from './data/nodes';
import { NODE_PRESENTATION, objectiveLabel, nodeSummary } from './presentation';
import { Screen, paginationControls } from './screen';
import { pageWindow, pageForIndex, moveGridFocus } from './screen-layout';
import { paintFacilityPortraits } from './facility-art';
import { FACILITY_ART } from './data/facility-art';

const DEFENSE = new Set<NodeType>(['turret','tesla','factory','sniper','trap','arc','toxin','blackhole','kamikaze','interceptor','radar']);

export class NodeSelectScreen {
  private screen: Screen;
  private selected: NodeType[];
  private focus = 0;
  private resolved = false;
  private summary: 'kit' | 'mission' = 'kit';
  private notice = '点选设施调整出战清单，编号对应局内快捷键。';

  constructor(canvas: HTMLCanvasElement, level: LevelConfig, onConfirm: (nodes: NodeType[]) => void, onBack?: () => void) {
    this.selected = recommendedLoadout(level);
    const confirm = () => {
      if (this.resolved || !this.selected.some(n => DEFENSE.has(n))) return;
      this.resolved = true;
      this.screen.destroy();
      onConfirm([...this.selected]);
    };
    const back = () => {
      if (this.resolved) return;
      this.resolved = true;
      this.screen.destroy();
      onBack?.();
    };
    const toggle = (index: number) => {
      this.focus = index;
      const type = level.availableNodes[index];
      if (!type) return;
      const name = NODE_PRESENTATION[type].name;
      if (level.requiredNodes?.includes(type)) this.notice = `${name}是本关基础设施，已固定携带。`;
      else if (this.selected.includes(type)) {
        this.selected = this.selected.filter(n => n !== type);
        this.notice = `已移除${name}，可选择其他设施替换。`;
      } else if (this.selected.length < level.maxSelectedNodes) {
        this.selected.push(type);
        this.notice = `已携带${name}，局内快捷键为 ${this.selected.length}。`;
      } else this.notice = `已满 ${level.maxSelectedNodes} 类；先移除一类，再携带${name}。`;
      render();
    };
    const changePage = (delta: number) => {
      const capacity = this.screen.layout.pageSize;
      const current = pageForIndex(this.focus, level.availableNodes.length, capacity);
      const next = pageWindow(level.availableNodes.length, capacity, current + delta);
      this.focus = next.start;
      render();
      this.screen.root.querySelector<HTMLElement>(`[data-index="${this.focus}"]`)?.focus({ preventScroll: true });
    };
    this.screen = new Screen(canvas, 'loadout-screen', event => {
      if (['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)) {
        event.preventDefault();
        this.focus = moveGridFocus(this.focus, event.key, level.availableNodes.length, this.screen.layout.columns);
        render();
        this.screen.root.querySelector<HTMLElement>(`[data-index="${this.focus}"]`)?.focus({ preventScroll: true });
      } else if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault(); changePage(event.key === 'PageDown' ? 1 : -1);
      } else if (event.key === ' ') {
        event.preventDefault(); toggle(this.focus);
      } else if (event.key === 'Enter') {
        event.preventDefault(); confirm();
      } else if (event.key === 'Escape' && onBack) back();
    });
    this.screen.root.style.setProperty('--mission-accent', level.tactics!.accent);
    this.screen.root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLElement>('[data-action]');
      if (!button || button instanceof HTMLButtonElement && button.disabled) return;
      switch (button.dataset.action) {
        case 'node': toggle(Number(button.dataset.index)); break;
        case 'node-page': changePage(Number(button.dataset.direction)); break;
        case 'preset':
          this.selected = recommendedLoadout(level);
          this.notice = '已恢复本关推荐配置。';
          render(); break;
        case 'summary': this.summary = button.dataset.view as typeof this.summary; render(); break;
        case 'locate-node':
          this.focus = level.availableNodes.indexOf(button.dataset.type as NodeType);
          render();
          this.screen.root.querySelector<HTMLElement>(`[data-index="${this.focus}"]`)?.focus({ preventScroll: true });
          break;
        case 'launch': confirm(); break;
        case 'back': case 'home': back(); break;
      }
    });
    const render = () => {
      const sector = level.tactics?.frontier?.chapter.split(' / ')[0] ?? String(level.id).padStart(2,'0');
      const full = this.selected.length >= level.maxSelectedNodes;
      const canLaunch = this.selected.some(n => DEFENSE.has(n));
      const missingDetector = level.tactics?.enemyPool.includes('stealth') && !this.selected.some(type => type === 'beacon' || type === 'radar');
      const page = pageWindow(level.availableNodes.length, this.screen.layout.pageSize, pageForIndex(this.focus, level.availableNodes.length, this.screen.layout.pageSize));
      const cards = level.availableNodes.slice(page.start, page.end).map((type, offset) => {
        const index = page.start + offset, presentation = NODE_PRESENTATION[type], config = NODE_CONFIGS[type];
        const slot = this.selected.indexOf(type), chosen = slot >= 0, required = !!level.requiredNodes?.includes(type);
        return `<button class="node-card ${chosen ? 'chosen' : ''} ${index === this.focus ? 'keyboard-focus' : ''} ${full && !chosen ? 'muted' : ''}" data-action="node" data-index="${index}" data-focus-key="node-${type}" aria-pressed="${chosen}" aria-disabled="${required}" style="--node-color:${FACILITY_ART[type].color}">
          <div class="node-card-top"><canvas class="facility-portrait" data-facility="${type}" width="160" height="128" aria-hidden="true"></canvas><span class="node-slot">${chosen ? String(slot + 1).padStart(2,'0') : '＋'}</span></div>
          <h2>${presentation.name}<span>${config.cost} ◆</span></h2><p>${presentation.role}${required ? ' · 基础设施' : ''}</p><small>${nodeSummary(type, level)}</small></button>`;
      }).join('');
      const chips = this.selected.map((type, index) => `<button data-action="locate-node" data-type="${type}" data-focus-key="kit-${type}" style="--node-color:${FACILITY_ART[type].color}" aria-label="定位${NODE_PRESENTATION[type].name}配置"><b>${index + 1}</b>${NODE_PRESENTATION[type].name}</button>`).join('');
      const status = !canLaunch ? '至少携带一种防御设施，再进入星域。' : missingDetector ? '本关有隐匿敌人，建议携带信标或雷达。' : this.notice;
      this.screen.render(`${this.screen.header(`出战配置 / SECTOR ${sector}`, !!onBack)}
        <section class="loadout-layout"><div class="loadout-main"><div class="loadout-head"><div class="section-heading"><div><p class="eyebrow">BUILD YOUR NETWORK</p><h1>让每个节点，各司其职。</h1></div><button class="quiet-button" data-action="preset" data-focus-key="preset">推荐配置 ↗</button></div><p class="loadout-intro">共 ${level.availableNodes.length} 类设施，可携带 ${level.maxSelectedNodes} 类。${level.requiredNodes?.length ? '基础设施固定携带。' : '设施自由组合。'}</p></div>
        <div class="node-card-grid">${cards}</div>${paginationControls(page, 'node-page', '设施')}</div>
        <aside class="loadout-summary"><header class="loadout-summary-header"><small>SECTOR ${sector}</small><h2>${level.name}</h2></header><div class="view-tabs" role="group" aria-label="出战信息"><button data-action="summary" data-view="kit" data-focus-key="summary-kit" aria-pressed="${this.summary === 'kit'}">出战清单</button><button data-action="summary" data-view="mission" data-focus-key="summary-mission" aria-pressed="${this.summary === 'mission'}">本关任务</button></div>
        <div class="loadout-summary-content">${this.summary === 'kit' ? `<div class="loadout-count"><span>已携带设施</span><strong>${this.selected.length}<small> / ${level.maxSelectedNodes}</small></strong></div><div class="selected-chips">${chips}</div><p class="subtle-note">点击清单中的设施，可定位到对应配置卡。</p>` : `<div class="mission-objective"><small>行动目标</small><strong>${objectiveLabel(level)}</strong></div><p class="summary-tactic">${level.tactics!.challenge}</p>`}</div>
        <p class="loadout-notice ${!canLaunch || missingDetector ? 'notice-warning' : ''}" role="status" aria-live="polite">${status}</p><div class="loadout-launch"><button class="primary-button" data-action="launch" ${canLaunch ? '' : 'disabled'}>进入星域 <span>↗</span></button></div></aside></section>
        <footer class="screen-footer"><span>方向键选卡 · 空格携带 · PageUp / Down 翻页</span><span>P 可随时暂停规划 · Esc 返回</span></footer>`);
      paintFacilityPortraits(this.screen.root);
    };
    this.screen.onResize(render);
    render();
  }
}
