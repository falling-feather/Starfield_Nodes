import { drawBattleHUD, drawBuildDock, drawInspector, drawBatchInspector } from './battle-hud';
import { COMBAT } from './data/balance';
import { TICK_INTERVAL } from './data/runtime';
import { UI_FONT, MONO_FONT, panel, wrappedText, objectiveRect } from './canvas-ui';
// ===== UI/HUD 绘制 =====
import type { GameState, NodeType, EdgeType } from './types';
import type { TechState } from './tech';
import { canResearch } from './tech';
import { sfxAchievement } from './audio';
import { popNotification, ACHIEVEMENTS } from './achievements';
import type { AchievementDef } from './achievements';
import { getKey, getAllBindings, setKey, resetKeybinds } from './keybinds';
import type { KeyAction } from './keybinds';
import { getCurrentStep, getProgress, isTutorialActive, LORE_TIPS, isLoreSeen } from './tutorial';
import { COLORS, FONT } from './ui-tokens';
import type { PlacementStatus } from './construction';
import { pageWindow } from './screen-layout';

/** 成就通知 Toast */
interface AchToast {
  def: AchievementDef;
  timer: number; // 剩余显示时间 (秒)
}

export class UI {
  private ctx: CanvasRenderingContext2D;
  techState: TechState | null = null;
  allowedNodeTypes: NodeType[] | null = null;
  objectiveCollapsed=false;
  levelObjectiveText: string = '';
  levelTitle = '星域远征';
  buildMode: NodeType | null = null;
  buildPlacement: PlacementStatus | null = null;
  /** 当前展示的成就通知队列 */
  private toasts: AchToast[] = [];
  /** V1.2.1：联动首次发现的世界内 toast 队列 */
  private synergyToasts: { id: string; timer: number }[] = [];
  private loreToasts: { id: string; timer: number }[] = [];
  /** 显示成就面板 */
  showAchievementPanel: boolean = false;
  /** 显示快捷键设置面板 */
  showKeybindPanel: boolean = false;
  showKnowledgePanel: boolean = false;
  /** 显示联动图鉴面板（V1.1.6） */
  showSynergyPanel: boolean = false;
  /** V1.6.1：当前帧已打开的子面板矩形（draw 阶段填充，input click-outside 读取） */
  openPanelRects: {
    id: 'tech' | 'knowledge' | 'achievement' | 'synergy' | 'keybind';
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  /** 正在编辑的快捷键操作（等待按键输入） */
  editingAction: KeyAction | null = null;
  keybindMessage = '';
  keybindAreas: { action: KeyAction; x: number; y: number; w: number; h: number }[] = [];
  /** 存档已解锁成就列表（由外部设置） */
  unlockedAchievements: string[] = [];
  /** V1.1.7：存档已发现的联动 id（由外部设置） */
  discoveredSynergies: Set<string> = new Set();
  /** V1.2.0：本局首次发现的联动 id 列表（结算面展示） */
  newSynergiesThisRun: string[] = [];
  /** 当前选中的连线类型（由InputManager同步） */
  selectedEdgeType: EdgeType = 'standard';
  /** 节点面板按钮命中区域（屏幕坐标） */
  nodeButtons: { action: string; x: number; y: number; w: number; h: number; enabled: boolean }[] =
    [];
  /** 科技树卡片点击区（V1.0.6）：drawTechPanel 负责填充，input.ts 负责命中检测 */
  techCardAreas: {
    idx: number;
    techId: string;
    x: number;
    y: number;
    w: number;
    h: number;
    available: boolean;
    unlocked: boolean;
  }[] = [];
  /** V1.2.4：科技树滚动偏移（像素），由 input wheel 调整 */
  private techScrollOffset = 0;
  /** V1.2.4：科技树最大可滚动距离（drawTechPanel 内更新） */
  private techMaxScroll = 0;
  private knowledgePage = 0;
  private knowledgePages = 1;
  /** V1.6.1：成就面板滚动偏移（像素） */
  private achievementScrollOffset = 0;
  /** V1.6.1：成就面板最大可滚动距离（drawAchievementPanel 内更新） */
  private achievementMaxScroll = 0;
  private synergyScrollOffset = 0;
  private synergyMaxScroll = 0;

  // ── V1.1.0 暂停菜单 ──
  /** 暂停菜单是否打开（独立于 state.paused：菜单打开 → state.paused = true，但 P 键暂停不会打开菜单） */
  pauseMenuOpen: boolean = false;
  /** 当前高亮的菜单项索引 */
  pauseMenuIndex: number = 0;
  /** 暂停菜单条目（label + action token，由 input.ts 解释执行） */
  readonly pauseMenuItems: { label: string; action: 'resume' | 'restart' | 'levels' | 'title' }[] =
    [
      { label: '继续', action: 'resume' },
      { label: '重开本关', action: 'restart' },
      { label: '返回航线', action: 'levels' },
      { label: '返回标题', action: 'title' },
    ];
  /** 暂停菜单条目命中区（屏幕坐标），由 drawPauseMenu 填充，onMouseDown 命中检测 */
  pauseMenuAreas: { idx: number; x: number; y: number; w: number; h: number }[] = [];

  // ── 微动效状态 ──
  /** HUD 首次进入战斗时的淡入起点（ms） */
  /** 通用面板淡入淡出进度（0..1） */
  private techFade = 0;
  private achievementFade = 0;
  private keybindFade = 0;
  private synergyFade = 0;
  /** 上次 render 时间（用于面板 fade dt） */
  private lastFadeTick = performance.now();
  private frameSeconds = 1 / 60;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  resetSession(): void {
    this.buildMode = null;
    this.buildPlacement = null;
    this.objectiveCollapsed=false;
    this.toasts = [];
    this.loreToasts = [];
    this.synergyToasts = [];
    this.newSynergiesThisRun = [];
    this.showAchievementPanel = false;
    this.showKnowledgePanel = false;
    this.showKeybindPanel = false;
    this.showSynergyPanel = false;
    this.pauseMenuOpen = false;
    this.pauseMenuIndex = 0;
    this.techFade = 0;
    this.achievementFade = 0;
    this.keybindFade = 0;
    this.synergyFade = 0;
    this.openPanelRects = [];
    this.editingAction = null;
    this.keybindMessage = '';
    this.keybindAreas = [];
    this.techScrollOffset =
      this.knowledgePage =
      this.achievementScrollOffset =
      this.synergyScrollOffset =
        0;
    this.knowledgePages = 1;
  }

  render(state: GameState): void {
    this.nodeButtons = [];
    this.openPanelRects = []; // V1.6.1：每帧重置
    this.hudRects = [];

    // 更新各面板 fade 进度（180ms 全程）
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFadeTick) / 1000);
    this.lastFadeTick = now;
    this.frameSeconds = dt;
    const FADE_RATE = 1 / 0.18; // 1/秒
    const step = (cur: number, target: number): number => {
      const d = target - cur;
      const m = FADE_RATE * dt;
      if (Math.abs(d) <= m) return target;
      return cur + Math.sign(d) * m;
    };
    this.techFade = step(this.techFade, this.techState?.showPanel ? 1 : 0);
    this.achievementFade = step(this.achievementFade, this.showAchievementPanel ? 1 : 0);
    this.keybindFade = step(this.keybindFade, this.showKeybindPanel ? 1 : 0);
    this.synergyFade = step(this.synergyFade, this.showSynergyPanel ? 1 : 0);

    this.drawHUD(state);

    if (state.selectedNodeIds.length > 0) {
      this.drawBatchPanel(state);
    }

    this.drawBuildPanel(state);

    // 科技树面板（带淡入淡出）
    if (this.techFade > 0.01) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha *= this.easeFade(this.techFade);
      this.drawTechPanel(state);
      ctx.restore();
    }

    // 新手教程提示
    if (isTutorialActive()) {
      this.drawTutorial(state);
    }

    // V1.1.0 暂停菜单
    if (this.pauseMenuOpen) {
      this.drawPauseMenu(state);
    }

    // 选中设施详情
    if (
      state.selectedNodeId &&
      !this.hasOpenSubPanel() &&
      !this.pauseMenuOpen &&
      !state.gameOver &&
      !state.levelWon
    ) {
      this.drawInspector(state);
    }

    if (state.gameOver) {
      this.drawResult(state, false);
    }

    if (state.levelWon) {
      this.drawResult(state, true);
    }

    // 成就面板（带淡入淡出）
    if (this.achievementFade > 0.01) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha *= this.easeFade(this.achievementFade);
      this.drawAchievementPanel(state);
      ctx.restore();
    }

    // 快捷键设置面板（带淡入淡出）
    if (this.keybindFade > 0.01) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha *= this.easeFade(this.keybindFade);
      this.drawKeybindPanel(state);
      ctx.restore();
    }

    // V1.5.1：知识库面板（直接显示，不带淡入）
    if (this.showKnowledgePanel) {
      this.drawKnowledgePanel(state);
    }

    // 联动图鉴面板（V1.1.6，带淡入淡出）
    if (this.synergyFade > 0.01) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha *= this.easeFade(this.synergyFade);
      this.drawSynergyPanel(state);
      ctx.restore();
    }

    // 共用通知通道，避免首次发现、知识点与成就互相遮挡设施详情。
    if(!this.hasOpenSubPanel()&&!this.pauseMenuOpen&&!state.gameOver&&!state.levelWon){
      if(this.loreToasts.length)this.updateLoreToasts(state);
      else if(this.synergyToasts.length)this.updateSynergyToasts(state);
      else this.updateToasts(state);
    }
  }

  /** 面板淡入淡出曲线 easeOutCubic */
  private easeFade(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - x, 3);
  }

  hudRects: { x:number; y:number; w:number; h:number }[] = [];

  private drawHUD(state: GameState): void {
    drawBattleHUD(this.ctx,state,this);
  }

  private drawInspector(state: GameState): void {
    drawInspector(this.ctx,state,this);
  }

  private drawBatchPanel(state:GameState):void {drawBatchInspector(this.ctx,state,this);}

  drawBuildPanel(state: GameState): void {
    drawBuildDock(this.ctx,state,this);
  }

  private drawTutorial(state: GameState): void {
    const step = getCurrentStep();
    if (!step) return;
    const objective = objectiveRect(state, this.objectiveCollapsed);
    const ctx = this.ctx,
      x = 22,
      y = objective.y + objective.h + 8,
      w = 340,
      h = 204;
    ctx.save();
    ctx.shadowBlur = 0;
    panel(ctx, x, y, w, h, '#102737f5', '#8bcbc88c', 8);
    this.hudRects.push({x,y,w,h});
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#77b9b4';
    ctx.font = `12px ${MONO_FONT}`;
    ctx.fillText(`FLIGHT TRAINING / ${getProgress()}`, x + 18, y + 17);
    ctx.fillStyle = '#def2ef';
    ctx.font = `500 17px ${UI_FONT}`;
    ctx.fillText(step.title.replace(/[⟨⟩〈〉]/g, ''), x + 18, y + 41, w - 36);
    ctx.fillStyle = '#a7c0cc';
    ctx.font = `13px ${UI_FONT}`;
    const description = step.lines
      .filter((line) => line && !line.includes('空格') && !line.includes('自动继续'))
      .join(String.fromCharCode(10))
      .replace('[U]', `[${getKey('upgrade').toUpperCase()}]`)
      .replace('[T]', `[${getKey('techTree').toUpperCase()}]`)
      .replace('[P]', `[${getKey('pause').toUpperCase()}]`);
    wrappedText(ctx, description, x + 18, y + 76, w - 36, 22, 4);
    ctx.fillStyle = '#87c9bf';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText(step.manual ? '空格 · 继续' : '完成操作后自动继续', x + 18, y + h - 33);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6e91a4';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText('Esc 跳过', x + w - 18, y + h - 31);
    if (step.id === 'connect') {
      const core = state.nodes.find((n) => n.type === 'core'),
        energy = state.nodes.find((n) => n.type === 'energy' && n.owner === 'player');
      if (core && energy) {
        const cam = state.camera;
        const a = { x: (core.x - cam.x) * cam.zoom, y: (core.y - cam.y) * cam.zoom },
          b = { x: (energy.x - cam.x) * cam.zoom, y: (energy.y - cam.y) * cam.zoom };
        ctx.strokeStyle = '#a0e8d5';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 7]);
        ctx.lineDashOffset = -performance.now() / 70;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const p of [a, b]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 32 * cam.zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  private drawTechPanel(state: GameState): void {
    if (!this.techState) return;
    const ctx = this.ctx,
      w = Math.min(980, state.canvasWidth - 48),
      h = Math.min(650, state.canvasHeight - 54);
    const x = (state.canvasWidth - w) / 2,
      y = (state.canvasHeight - h) / 2,
      padding = 24,
      header = 112,
      footer = 34;
    const cols = w >= 880 ? 3 : w >= 560 ? 2 : 1,
      gap = 14,
      cw = (w - padding * 2 - gap * (cols - 1)) / cols,
      ch = 116;
    const tree = this.techState.tree,
      contentHeight = Math.ceil(tree.length / cols) * (ch + gap);
    const viewport = h - header - footer;
    this.techMaxScroll = Math.max(0, contentHeight - viewport);
    this.techScrollOffset = Math.max(0, Math.min(this.techMaxScroll, this.techScrollOffset));
    this.openPanelRects.push({ id: 'tech', x, y, w, h });
    this.techCardAreas = [];
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#020b16c9';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    panel(ctx, x, y, w, h, '#0b1e2efc', '#90bfcb66', 10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#83b5bc';
    ctx.font = `10px ${MONO_FONT}`;
    ctx.fillText('RESEARCH / NETWORK DEVELOPMENT', x + padding, y + 25);
    ctx.fillStyle = '#e2eef1';
    ctx.font = `500 25px ${UI_FONT}`;
    ctx.fillText('研究与升级', x + padding, y + 56);
    ctx.fillStyle = '#94afbd';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText('本次航行生效 · 点击卡片研究，也可使用数字键 1–9、0', x + padding, y + 86);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#a2dfcb';
    ctx.font = `16px ${MONO_FONT}`;
    ctx.fillText(`${Math.floor(state.resources)} ◆`, x + w - padding - 48, y + 54);
    panel(ctx, x + w - 54, y + 18, 32, 32, '#173044', '#87abba55', 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#adc8d3';
    ctx.font = `20px ${UI_FONT}`;
    ctx.fillText('×', x + w - 38, y + 35);
    this.nodeButtons.push({
      action: 'close_panel',
      x: x + w - 54,
      y: y + 18,
      w: 32,
      h: 32,
      enabled: true,
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padding - 2, y + header, w - padding * 2 + 4, viewport);
    ctx.clip();
    tree.forEach((tech, i) => {
      const tx = x + padding + (i % cols) * (cw + gap),
        ty = y + header + Math.floor(i / cols) * (ch + gap) - this.techScrollOffset;
      if (ty + ch < y + header || ty > y + h - footer) return;
      const available = canResearch(tech, this.techState!, state.resources);
      panel(
        ctx,
        tx,
        ty,
        cw,
        ch,
        tech.unlocked ? '#143631' : available ? '#163246' : '#122535',
        tech.unlocked ? '#72c2a76b' : available ? '#86bcc25e' : '#64829835',
        6,
      );
      ctx.textAlign = 'left';
      ctx.fillStyle = tech.unlocked ? '#a2dfc4' : '#d0e1e8';
      ctx.font = `500 15px ${UI_FONT}`;
      ctx.fillText(tech.name, tx + 15, ty + 24, cw - 76);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7093a4';
      ctx.font = `11px ${MONO_FONT}`;
      ctx.fillText(`[${(i + 1) % 10}]`, tx + cw - 14, ty + 24);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8da9b9';
      ctx.font = `12px ${UI_FONT}`;
      wrappedText(ctx, tech.description.replaceAll('Tick', '步'), tx + 15, ty + 49, cw - 30, 18, 2);
      ctx.fillStyle = tech.unlocked ? '#8fd2b7' : available ? '#d9c18b' : '#8094a4';
      ctx.font = `11px ${UI_FONT}`;
      const requirements = tech.requires
        .filter((id) => !this.techState!.tree.find((t) => t.id === id)?.unlocked)
        .map((id) => tree.find((t) => t.id === id)?.name ?? id);
      const status = tech.unlocked
        ? '✓ 已完成研究'
        : requirements.length
          ? `前置：${requirements.join('、')}`
          : `${tech.cost} ◆  /  ${available ? '可研究' : '资源不足'}`;
      wrappedText(ctx, status, tx + 15, ty + 91, cw - 30, 16, 1);
      this.techCardAreas.push({
        idx: i,
        techId: tech.id,
        x: tx,
        y: Math.max(ty, y + header),
        w: cw,
        h: Math.min(ty + ch, y + h - footer) - Math.max(ty, y + header),
        available,
        unlocked: tech.unlocked,
      });
    });
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7093a6';
    ctx.font = `11px ${UI_FONT}`;
    ctx.fillText(
      this.techMaxScroll
        ? '滚轮浏览更多研究 · Esc 返回星域'
        : '研究会消耗本次航行资源 · Esc 返回星域',
      state.canvasWidth / 2,
      y + h - 17,
    );
    if (this.techMaxScroll) {
      const barH = viewport * (viewport / contentHeight),
        by = y + header + ((viewport - barH) * this.techScrollOffset) / this.techMaxScroll;
      ctx.fillStyle = '#83b8bd66';
      ctx.beginPath();
      ctx.roundRect(x + w - 11, by, 3, barH, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  scrollTechPanel(delta: number): void {
    if (!this.techState || !this.techState.showPanel) return;
    this.techScrollOffset = Math.max(
      0,
      Math.min(this.techMaxScroll, this.techScrollOffset + delta),
    );
  }

  /** 手册以整页阅读，滚轮不再滚动被裁切的卡片。 */
  scrollKnowledgePanel(delta: number): void {
    if (!this.showKnowledgePanel) return;
    this.knowledgePage = Math.max(0, Math.min(this.knowledgePages - 1, this.knowledgePage + Math.sign(delta)));
  }

  /** V1.6.1：滚动成就面板 */
  scrollAchievementPanel(delta: number): void {
    if (!this.showAchievementPanel) return;
    this.achievementScrollOffset = Math.max(
      0,
      Math.min(this.achievementMaxScroll, this.achievementScrollOffset + delta),
    );
  }

  scrollSynergyPanel(delta: number): void {
    if (this.showSynergyPanel)
      this.synergyScrollOffset = Math.max(
        0,
        Math.min(this.synergyMaxScroll, this.synergyScrollOffset + delta),
      );
  }

  /** V1.6.1：是否有任意子面板正在显示 */
  hasOpenSubPanel(): boolean {
    return !!(
      this.showKeybindPanel ||
      this.showKnowledgePanel ||
      this.showAchievementPanel ||
      this.showSynergyPanel ||
      (this.techState && this.techState.showPanel)
    );
  }

  /** V1.6.1：屏幕坐标 (sx,sy) 是否落在任意已打开子面板矩形内 */
  isPointInOpenPanel(sx: number, sy: number): boolean {
    for (const r of this.openPanelRects) {
      if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return true;
    }
    return false;
  }

  private drawResult(state: GameState, won: boolean): void {
    this.nodeButtons=[];
    const ctx = this.ctx,
      w = Math.min(640, state.canvasWidth - 48),
      h = 410,
      x = (state.canvasWidth - w) / 2,
      y = (state.canvasHeight - h) / 2;
    const accent = won ? '#a1dfc7' : '#e4af99';
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#020a15c9';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    panel(ctx, x, y, w, h, '#0b1f2ff8', won ? '#86c9b384' : '#b88c7780', 10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = `10px ${MONO_FONT}`;
    ctx.fillText(won ? 'EXPEDITION COMPLETE' : 'SIGNAL LOST', x + 30, y + 30);
    ctx.fillStyle = '#e5f0f3';
    ctx.font = `500 32px ${UI_FONT}`;
    ctx.fillText(won ? (state.frontier?'行动已完成。':'航线已守住。') : '核心失去响应。', x + 30, y + 77);
    ctx.fillStyle = '#95b0c0';
    ctx.font = `13px ${UI_FONT}`;
    wrappedText(
      ctx,
      won
        ? `${this.levelTitle}的网络保持了运转。你已经完成这段航线。`
        : '调整供能、火力与侦察布局，再带着新的方案出发。',
      x + 30,
      y + 118,
      w - 60,
      22,
      2,
    );
    const metrics = state.frontier ? [
      ['行动用时',`${Math.floor(state.elapsedSeconds/60)}:${String(Math.floor(state.elapsedSeconds%60)).padStart(2,'0')}`],
      ['净资源投入',Math.floor(state.resourcesSpent-state.frontier.recovered)],
      ['在役设施',state.nodes.filter(n=>n.owner==='player'&&n.status!=='destroyed').length],
    ] : [ ['航行得分',state.score],['抵达波次',state.wave],['有效击杀',state.enemiesKilled] ];
    metrics.forEach(([label, value], i) => {
      const xx = x + 30 + (i * (w - 60)) / 3;
      ctx.fillStyle = '#7594a7';
      ctx.font = `11px ${UI_FONT}`;
      ctx.fillText(String(label), xx, y + 181);
      ctx.fillStyle = accent;
      ctx.font = `500 26px ${MONO_FONT}`;
      ctx.fillText(String(value), xx, y + 216);
    });
    ctx.strokeStyle = '#89acbe26';
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 249);
    ctx.lineTo(x + w - 30, y + 249);
    ctx.stroke();
    ctx.fillStyle = '#8aa7b8';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText(
      `本次建造 ${state.nodesBuilt} 座设施 · 发现 ${this.newSynergiesThisRun.length} 组新联动`,
      x + 30,
      y + 279,
    );
    this.drawNewSynergiesBlock(state, y + 305);
    const gap = 12,
      bw = (w - 60 - gap) / 2,
      by = y + h - 83;
    panel(ctx, x + 30, by, bw, 47, won ? '#8fd8c8' : '#dfb59b', accent, 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0c2330';
    ctx.font = `500 14px ${UI_FONT}`;
    ctx.fillText(won ? '返回行动列表  ↗' : '重新出发  ↗', x + 30 + bw / 2, by + 24);
    panel(ctx, x + 30 + bw + gap, by, bw, 47, '#163145', '#789dad55', 5);
    ctx.fillStyle = '#bdd3dd';
    ctx.fillText(won ? '再试一次' : '返回航线', x + 30 + bw + gap + bw / 2, by + 24);
    this.nodeButtons.push(
      { action: won ? 'continue' : 'quick_restart', x: x + 30, y: by, w: bw, h: 47, enabled: true },
      {
        action: won ? 'quick_restart' : 'continue',
        x: x + 30 + bw + gap,
        y: by,
        w: bw,
        h: 47,
        enabled: true,
      },
    );
    ctx.fillStyle = '#688b9f';
    ctx.font = `10px ${UI_FONT}`;
    ctx.fillText(
      `Enter 返回航线 · ${getKey('restart').toUpperCase()} 快速重开`,
      state.canvasWidth / 2,
      y + h - 17,
    );
    ctx.restore();
  }

  /** V1.2.0：在结算面板下方展示「本局首次发现的联动」 */
  private drawNewSynergiesBlock(state: GameState, baseY: number): void {
    if (!this.newSynergiesThisRun.length) return;
    const names = this.newSynergiesThisRun
      .map((id) => this.SYNERGIES.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2);
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b9caa9';
    ctx.font = `11px ${UI_FONT}`;
    ctx.fillText(
      `新发现：${names.join(' · ')}`,
      state.canvasWidth / 2,
      baseY,
      state.canvasWidth - 100,
    );
  }

  private drawPauseMenu(state: GameState): void {
    const ctx = this.ctx,
      w = Math.min(420, state.canvasWidth - 48),
      h = 370,
      x = (state.canvasWidth - w) / 2,
      y = (state.canvasHeight - h) / 2;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#020b16b8';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    panel(ctx, x, y, w, h, '#0d2435f7', '#8ab7c263', 9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#729cae';
    ctx.font = `10px ${MONO_FONT}`;
    ctx.fillText('EXPEDITION / PAUSED', x + 26, y + 26);
    ctx.fillStyle = '#dbecef';
    ctx.font = `500 25px ${UI_FONT}`;
    ctx.fillText('航行已暂停', x + 26, y + 62);
    this.pauseMenuAreas = [];
    this.pauseMenuItems.forEach((item, i) => {
      const yy = y + 102 + i * 53,
        selected = i === this.pauseMenuIndex;
      panel(
        ctx,
        x + 24,
        yy,
        w - 48,
        43,
        selected ? '#25505a' : '#132c3e',
        selected ? '#8bc4be88' : '#648a9d35',
        5,
      );
      ctx.fillStyle = selected ? '#d3ede7' : '#a2bdcc';
      ctx.font = `14px ${UI_FONT}`;
      ctx.fillText(item.label, x + 42, yy + 22);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#668c9b';
      ctx.font = `11px ${MONO_FONT}`;
      ctx.fillText(String(i + 1), x + w - 42, yy + 22);
      ctx.textAlign = 'left';
      this.pauseMenuAreas.push({ idx: i, x: x + 24, y: yy, w: w - 48, h: 43 });
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#698a9e';
    ctx.font = `10px ${UI_FONT}`;
    ctx.fillText('方向键选择 · Enter 确认 · Esc 返回', state.canvasWidth / 2, y + h - 20);
    ctx.restore();
  }

  // ───── 成就 Toast 通知 ─────

  private updateToasts(state: GameState): void {
    // 从成就系统拉新通知
    let next = popNotification();
    while (next) {
      this.toasts.push({ def: next, timer: 4 });
      sfxAchievement();
      next = popNotification();
    }
    // 最多同时显示3条
    if (this.toasts.length > 3) this.toasts = this.toasts.slice(-3);

    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;

    const toastW = 280;
    const toastH = 50;
    const startY = 94;

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i];
      toast.timer -= this.frameSeconds; // ~60fps
      if (toast.timer <= 0) {
        this.toasts.splice(i, 1);
        continue;
      }

      const alpha = Math.min(1, toast.timer);
      const idx = this.toasts.length - 1 - i;
      const tx = (state.canvasWidth - toastW) / 2;
      const ty = startY + idx * (toastH + 6);
      this.hudRects.push({x:tx,y:ty,w:toastW,h:toastH});

      // 背景
      ctx.fillStyle = `rgba(20,10,40,${0.9 * alpha})`;
      ctx.strokeStyle = `rgba(255,200,0,${0.6 * alpha})`;
      ctx.lineWidth = 1.5;
      ctx.fillRect(tx, ty, toastW, toastH);
      ctx.strokeRect(tx, ty, toastW, toastH);

      // 图标
      ctx.globalAlpha = alpha;
      ctx.font = '30px "Segoe UI", "Microsoft YaHei UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.accent.yellowHi;
      ctx.fillText(toast.def.icon, tx + 10, ty + toastH / 2);

      // 标题
      ctx.font = 'bold 18px "Segoe UI", "Microsoft YaHei UI", sans-serif';
      ctx.fillStyle = COLORS.accent.yellowHi;
      ctx.fillText(`成就解锁: ${toast.def.name}`, tx + 40, ty + 16);

      // 描述
      ctx.font = FONT.md;
      ctx.fillStyle = COLORS.text.high;
      ctx.fillText(toast.def.description, tx + 40, ty + 36);

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /** V1.2.1：由 Game 在 tick 后调用，把首次发现的联动加入世界 toast 队列 */
  pushSynergyToast(id: string): void {
    // 避免重复（同一 id 短时间内多次 push）
    if (this.synergyToasts.some((t) => t.id === id)) return;
    this.synergyToasts.push({ id, timer: 4 });
    if (this.synergyToasts.length > 3) this.synergyToasts = this.synergyToasts.slice(-3);
    sfxAchievement(); // 复用成就音效，给玩家明确反馈
  }

  /** V1.5.0：弹出地形/虫洞知识点 toast（id 来自 LORE_TIPS） */
  pushLoreToast(id: string): void {
    if (!LORE_TIPS[id]) return;
    if (this.loreToasts.some((t) => t.id === id)) return;
    this.loreToasts.push({ id, timer: 8 });
    if (this.loreToasts.length > 3) this.loreToasts = this.loreToasts.slice(-3);
    sfxAchievement();
  }

  /** V1.5.0：渲染 lore toast（位置在 synergy toast 下方，避免冲突） */
  private updateLoreToasts(state: GameState): void {
    const toast = this.loreToasts[0];
    if (!toast || isTutorialActive()) return;
    toast.timer -= this.frameSeconds;
    if (toast.timer <= 0) {
      this.loreToasts.shift();
      return;
    }
    const tip = LORE_TIPS[toast.id];
    if (!tip) return;
    const ctx = this.ctx,
      w = Math.min(360, state.canvasWidth - 48),
      x = (state.canvasWidth - w) / 2,
      y = 94,
      h = 164;
    ctx.save();
    ctx.globalAlpha = Math.min(1, toast.timer);
    ctx.shadowBlur = 0;
    panel(ctx, x, y, w, h, '#102637f5', '#94b9ca66', 7);
    this.hudRects.push({x,y,w,h});
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#9bbdca';
    ctx.font = `500 15px ${UI_FONT}`;
    ctx.fillText(tip.title.replace(/^★\s*/, ''), x + 17, y + 17, w - 34);
    ctx.fillStyle = '#9ab3c2';
    ctx.font = `12px ${UI_FONT}`;
    wrappedText(ctx, tip.lines.join(' '), x + 17, y + 52, w - 34, 21, 4);
    ctx.fillStyle = '#63899c';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText('H · 在作战手册中查看详情', x + 17, y + h - 23);
    ctx.restore();
  }

  private updateSynergyToasts(state: GameState): void {
    if (this.synergyToasts.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;

    const toastW = 360;
    const toastH = 56;
    const startY = 94;
    const cx = state.canvasWidth / 2;

    for (let i = this.synergyToasts.length - 1; i >= 0; i--) {
      const toast = this.synergyToasts[i];
      toast.timer -= this.frameSeconds;
      if (toast.timer <= 0) {
        this.synergyToasts.splice(i, 1);
        continue;
      }
      const s = this.SYNERGIES.find((x) => x.id === toast.id);
      if (!s) continue;

      // 入场上滑动 + 出场渐隐
      const inT = Math.min(1, (4 - toast.timer) / 0.25);
      const eased = 1 - Math.pow(1 - inT, 3);
      const alpha = Math.min(1, toast.timer);
      const idx = this.synergyToasts.length - 1 - i;
      const tx = cx - toastW / 2;
      const ty = startY + idx * (toastH + 6) - (1 - eased) * 10;
      this.hudRects.push({x:tx,y:ty,w:toastW,h:toastH});

      ctx.globalAlpha = alpha;
      // 背景：使用联动主题色边框
      ctx.fillStyle = 'rgba(15,8,30,0.92)';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.fillRect(tx, ty, toastW, toastH);
      ctx.strokeRect(tx, ty, toastW, toastH);

      // 左侧装饰条
      ctx.fillStyle = s.color;
      ctx.fillRect(tx, ty, 4, toastH);

      // 标题
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Segoe UI", "Microsoft YaHei UI", sans-serif';
      ctx.fillStyle = s.color;
      ctx.fillText(`★ 首次发现联动`, tx + 14, ty + 16);

      // 名称 + 模式
      ctx.font = FONT.md;
      ctx.fillStyle = COLORS.text.high;
      ctx.fillText(`${s.name} · ${s.pair}`, tx + 14, ty + 38, toastW - 28);

      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ───── V1.5.1 知识库面板 ─────
  private drawKnowledgePanel(state: GameState): void {
    const ctx = this.ctx,
      w = Math.min(900, state.canvasWidth - 48),
      h = Math.min(710, state.canvasHeight - 48),
      x = (state.canvasWidth - w) / 2,
      y = (state.canvasHeight - h) / 2;
    const padding = 24,
      header = 110,
      footer = 60,
      viewport = h - header - footer,
      cols = w >= 650 ? 2 : 1,
      gap = 14,
      cw = (w - padding * 2 - gap * (cols - 1)) / cols;
    const taskIds = Object.keys(LORE_TIPS).filter(
      (id) => id.startsWith('challenge_') && !id.endsWith('_done'),
    );
    const completed = taskIds.filter((id) => isLoreSeen(`${id}_done`)).length;
    const cards: [string, string, boolean | null][] = [
      [
        '连接与扩张',
        '点击底部卡片，再在已探索区域建造。拖拽两个己方节点建立链路。中立设施需要先招募；断开的设施可以重新连接或回收。',
        null,
      ],
      [
        '规划与成长',
        `${getKey('pause').toUpperCase()} 暂停后仍可布置设施；选中设施按 ${getKey('upgrade').toUpperCase()} 升级。能量站升级提高产能，研究「高效链路」提高带宽。`,
        null,
      ],
      [
        '支援单位',
        '十字标记的治疗者会周期性恢复同伴生命；菱形护盾者会降低附近敌人所受伤害。观察支援范围，调整火力与阵地。',
        null,
      ],
      [
        '侦察与干扰',
        '隐匿者需要信标或雷达侦测；干扰者会使接近的链路断流。让前线保持视野，并为关键设施保留备用供电路径。',
        null,
      ],
      ...['terrain_nebula', 'terrain_asteroid', 'terrain_wormhole'].map(
        (id) =>
          [LORE_TIPS[id].title.replace(/^★\s*/, ''), LORE_TIPS[id].lines.join(' '), null] as [
            string,
            string,
            boolean | null,
          ],
      ),
      ...taskIds.map(
        (id) =>
          [
            LORE_TIPS[id].title.replace(/^★\s*/, ''),
            LORE_TIPS[id].lines.join(' '),
            isLoreSeen(`${id}_done`),
          ] as [string, string, boolean | null],
      ),
    ];
    const missionH = state.mission ? 102 : 0, ch = viewport - missionH - 4;
    const page = pageWindow(cards.length, cols, this.knowledgePage);
    this.knowledgePage = page.page;
    this.knowledgePages = page.pages;
    this.openPanelRects.push({ id: 'knowledge', x, y, w, h });
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#020b16c9';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    panel(ctx, x, y, w, h, '#0b1f30fc', '#91bcca66', 9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#739faf';
    ctx.font = `12px ${MONO_FONT}`;
    ctx.fillText('FIELD MANUAL / NETWORK TACTICS', x + padding, y + 25);
    ctx.fillStyle = '#e0edf0';
    ctx.font = `500 25px ${UI_FONT}`;
    ctx.fillText('作战手册', x + padding, y + 57);
    ctx.fillStyle = '#91adbb';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText(
      `协同实践 ${completed} / ${taskIds.length} 已完成 · 所有规则均在局内生效`,
      x + padding,
      y + 86,
    );
    panel(ctx, x + w - 55, y + 18, 32, 32, '#173246', '#7ea6b34a', 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#adc7d0';
    ctx.font = `20px ${UI_FONT}`;
    ctx.fillText('×', x + w - 39, y + 35);
    this.nodeButtons.push({
      action: 'close_panel',
      x: x + w - 55,
      y: y + 18,
      w: 32,
      h: 32,
      enabled: true,
    });
    ctx.save();
    const top = y + header;
    if (state.mission) {
      panel(ctx, x + padding, top, w - padding * 2, 88, '#173342', '#87b2b340', 6);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#bed9d9';
      ctx.font = `500 13px ${UI_FONT}`;
      ctx.fillText(`当前航线 · ${this.levelTitle}`, x + padding + 16, top + 23);
      ctx.fillStyle = '#90adbd';
      ctx.font = `12px ${UI_FONT}`;
      wrappedText(
        ctx,
        state.mission.challenge,
        x + padding + 16,
        top + 49,
        w - padding * 2 - 32,
        20,
        2,
      );
    }
    cards.slice(page.start, page.end).forEach(([title, body, done], i) => {
      const xx = x + padding + (i % cols) * (cw + gap),
        yy = top + missionH;
      panel(ctx, xx, yy, cw, ch, done ? '#13312f' : '#112a3c', done ? '#8ec1aa4d' : '#7399ae33', 6);
      ctx.textAlign = 'left';
      ctx.fillStyle = done ? '#b0d6bc' : '#c2dbe1';
      ctx.font = `500 16px ${UI_FONT}`;
      ctx.fillText(title, xx + 15, yy + 24);
      if (done !== null) {
        ctx.textAlign = 'right';
        ctx.fillStyle = done ? '#8ec7a8' : '#708e9e';
        ctx.font = `12px ${UI_FONT}`;
        ctx.fillText(done ? '✓ 已完成' : '待实践', xx + cw - 14, yy + 24);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8da9b9';
      ctx.font = `14px ${UI_FONT}`;
      wrappedText(ctx, body, xx + 15, yy + 55, cw - 30, 22, Math.floor((ch - 70) / 22));
    });
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a3bdcc';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText(`${page.page + 1} / ${page.pages} 页 · 滚轮翻页 · H 或 Esc 返回`, state.canvasWidth / 2, y + h - 28);
    for (const [action,label,xx,enabled] of [
      ['knowledge_prev','← 上一页',x+padding,page.page>0],
      ['knowledge_next','下一页 →',x+w-padding-110,page.page+1<page.pages],
    ] as const) {
      panel(ctx,xx,y+h-44,110,32,'#183547','#8aaeb64a',5);
      ctx.fillStyle=enabled?'#d5e8eb':'#668595';ctx.fillText(label,xx+55,y+h-28);
      this.nodeButtons.push({action,x:xx,y:y+h-44,w:110,h:32,enabled});
    }
    ctx.restore();
  }

  private drawArchiveFrame(
    state: GameState,
    id: 'achievement' | 'synergy' | 'keybind',
    title: string,
    eyebrow: string,
    subtitle: string,
    maxWidth = 840,
  ): { x: number; y: number; w: number; h: number } {
    const ctx = this.ctx,
      w = Math.min(maxWidth, state.canvasWidth - 48),
      h = Math.min(680, state.canvasHeight - 48),
      x = (state.canvasWidth - w) / 2,
      y = (state.canvasHeight - h) / 2;
    this.openPanelRects.push({ id, x, y, w, h });
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#020b15cc';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    panel(ctx, x, y, w, h, '#0b2030f5', '#7199ac66', 9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#719eae';
    ctx.font = '10px ' + MONO_FONT;
    ctx.fillText(eyebrow, x + 24, y + 25);
    ctx.fillStyle = '#e0edf0';
    ctx.font = '500 25px ' + UI_FONT;
    ctx.fillText(title, x + 24, y + 57);
    ctx.fillStyle = '#91adbb';
    ctx.font = '12px ' + UI_FONT;
    ctx.fillText(subtitle, x + 24, y + 86, w - 48);
    panel(ctx, x + w - 55, y + 18, 32, 32, '#173246', '#7ea6b34a', 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#adc7d0';
    ctx.font = '20px ' + UI_FONT;
    ctx.fillText('×', x + w - 39, y + 35);
    this.nodeButtons.push({
      action: 'close_panel',
      x: x + w - 55,
      y: y + 18,
      w: 32,
      h: 32,
      enabled: true,
    });
    return { x, y, w, h };
  }

  private drawAchievementPanel(state: GameState): void {
    const ctx = this.ctx,
      unlocked = this.unlockedAchievements;
    const count = ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)).length;
    ctx.save();
    const { x, y, w, h } = this.drawArchiveFrame(
      state,
      'achievement',
      '远征成就',
      'EXPEDITION / ACHIEVEMENTS',
      count + ' / ' + ACHIEVEMENTS.length + ' 已达成 · 记录每一次成长',
    );
    const cols = w >= 640 ? 2 : 1,
      gap = 12,
      cw = (w - 48 - gap * (cols - 1)) / cols,
      rowH = 104,
      top = y + 110,
      viewport = h - 144,
      content = Math.ceil(ACHIEVEMENTS.length / cols) * (rowH + gap) - gap;
    this.achievementMaxScroll = Math.max(0, content - viewport);
    this.achievementScrollOffset = Math.max(
      0,
      Math.min(this.achievementMaxScroll, this.achievementScrollOffset),
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 20, top, w - 40, viewport);
    ctx.clip();
    ACHIEVEMENTS.forEach((achievement, i) => {
      const xx = x + 24 + (i % cols) * (cw + gap),
        yy = top + Math.floor(i / cols) * (rowH + gap) - this.achievementScrollOffset,
        done = unlocked.includes(achievement.id);
      panel(
        ctx,
        xx,
        yy,
        cw,
        rowH,
        done ? '#15382f' : '#112a3c',
        done ? '#8ec6a851' : '#7399ae33',
        6,
      );
      ctx.textAlign = 'left';
      ctx.fillStyle = done ? '#acd5b6' : '#a9c4d0';
      ctx.font = '500 15px ' + UI_FONT;
      ctx.fillText(achievement.name, xx + 16, yy + 25, cw - 100);
      ctx.textAlign = 'right';
      ctx.fillStyle = done ? '#9ad2ae' : '#7291a1';
      ctx.font = '10px ' + UI_FONT;
      ctx.fillText(done ? '✓ 已达成' : '待达成', xx + cw - 16, yy + 25);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8ca9b9';
      ctx.font = '12px ' + UI_FONT;
      wrappedText(ctx, achievement.description, xx + 16, yy + 56, cw - 32, 21, 2);
    });
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6c8e9f';
    ctx.font = '11px ' + UI_FONT;
    ctx.fillText(
      '滚轮浏览 · ' + getKey('achievements').toUpperCase() + ' 或 Esc 返回星域',
      state.canvasWidth / 2,
      y + h - 17,
    );
    if (this.achievementMaxScroll > 0) {
      const bh = (viewport * viewport) / content,
        by = top + ((viewport - bh) * this.achievementScrollOffset) / this.achievementMaxScroll;
      ctx.fillStyle = '#80aaa666';
      ctx.fillRect(x + w - 11, by, 3, bh);
    }
    ctx.restore();
  }
  // ───── 联动图鉴面板（V1.1.6） ─────

  /** 静态联动配置（与 graph.ts / entities.ts / renderer.ts 中实现保持一致） */
  private readonly SYNERGIES: {
    id: string;
    pair: string;
    name: string;
    effect: string;
    hint: string;
    color: string;
  }[] = [
    {
      id: 'tesla-relay',
      pair: '连锁塔 × 中继器',
      name: '链式电网',
      effect: `连锁塔借助直连中继器的其他边延伸一跳，伤害 ×${COMBAT.tesla.synergyRelayDamageRatio}。`,
      hint: '连接连锁塔与中继器，再让中继器连接前线设施，观察电网覆盖的变化。',
      color: 'rgba(120, 220, 255, 0.85)',
    },
    {
      id: 'buffer-collector',
      pair: '缓冲器 × 采集器',
      name: '经济共振',
      effect: `采集器直连缓冲器，产出 ×${1 + COMBAT.collector.synergyBufferBonus}；每个相连缓冲器使进化晶体阈值降低 ${COMBAT.collector.synergyCrystalThresholdReduce}。`,
      hint: '让缓冲器直连采集器，在敌人接近时观察资源产出。',
      color: 'rgba(255, 215, 96, 0.85)',
    },
    {
      id: 'portal-interceptor',
      pair: '传送门 × 拦截器',
      name: '出门一炮',
      effect: '传送门转移敌人时，直连的己方拦截器各追加一次追踪射击。',
      hint: '把传送门与拦截器直接连接，让敌人进入传送范围。',
      color: 'rgba(255, 170, 255, 0.85)',
    },
    {
      id: 'shield-repair',
      pair: '护盾 × 维修站',
      name: '再生护甲',
      effect: `护盾直连维修站时，自身受到的伤害降低 ${Math.round(COMBAT.shield.synergyRepairDamageReduce * 100)}%。`,
      hint: '让护盾与维修站直接连接，在承受攻击时观察这组组合。',
      color: 'rgba(140, 255, 180, 0.85)',
    },
    {
      id: 'energy-buffer',
      pair: '能量站 × 缓冲器',
      name: '能量共振',
      effect: `缓冲器直连能量站，范围充能 ×${COMBAT.buffer.synergyEnergyBoostMult}。`,
      hint: '将能量站和缓冲器直接连接，让周围设施接受充能。',
      color: 'rgba(200, 130, 255, 0.85)',
    },
    {
      id: 'relay-energy',
      pair: '能量站 × 中继器',
      name: '能量网络',
      effect: `能量站经中继器给二跳己方邻居额外补充 ${(COMBAT.energy.synergyRelayNetworkBoost * 1000) / TICK_INTERVAL} 能量/秒。`,
      hint: '以能量站—中继器—前线节点组成一条支路，观察末端供能。',
      color: 'rgba(120, 200, 255, 0.85)',
    },
    {
      id: 'magnet-radar',
      pair: '磁力塔 × 雷达',
      name: '重力扫描',
      effect: `雷达直连磁力塔时，锁定攻击范围增加 ${Math.round(COMBAT.radar.synergyMagnetRangeBoost * 100)}%。`,
      hint: '让雷达与磁力塔直连，再观察敌人进入锁定范围后的反馈。',
      color: 'rgba(208, 156, 255, 0.85)',
    },
    {
      id: 'buffer-wormhole',
      pair: '缓冲器 × 双端虫洞',
      name: '虫洞共振',
      effect: '己方缓冲器分别位于一对虫洞中时，可为另一端周围的设施提供范围充能。',
      hint: '在同一对虫洞的两端各部署并供电一座缓冲器，连接彼岸的设施。',
      color: 'rgba(168, 220, 255, 0.85)',
    },
  ];

  private drawSynergyPanel(state: GameState): void {
    const ctx = this.ctx,
      discovered = new Set([...this.discoveredSynergies, ...state.discoveredSynergies]);
    const count = this.SYNERGIES.filter((s) => discovered.has(s.id)).length;
    ctx.save();
    const { x, y, w, h } = this.drawArchiveFrame(
      state,
      'synergy',
      '网络联动',
      'NETWORK / SYNERGY ATLAS',
      count + ' / ' + this.SYNERGIES.length + ' 已发现 · 在连接中寻找新的可能',
    );
    const cols = w >= 680 ? 2 : 1,
      gap = 14,
      cw = (w - 48 - gap * (cols - 1)) / cols,
      rowH = 160,
      top = y + 110,
      viewport = h - 144,
      content = Math.ceil(this.SYNERGIES.length / cols) * (rowH + gap) - gap;
    this.synergyMaxScroll = Math.max(0, content - viewport);
    this.synergyScrollOffset = Math.max(
      0,
      Math.min(this.synergyMaxScroll, this.synergyScrollOffset),
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 20, top, w - 40, viewport);
    ctx.clip();
    this.SYNERGIES.forEach((synergy, i) => {
      const xx = x + 24 + (i % cols) * (cw + gap),
        yy = top + Math.floor(i / cols) * (rowH + gap) - this.synergyScrollOffset,
        found = discovered.has(synergy.id);
      panel(
        ctx,
        xx,
        yy,
        cw,
        rowH,
        found ? '#153430' : '#112a3c',
        found ? '#91c7b15c' : '#7399ae33',
        6,
      );
      ctx.textAlign = 'left';
      ctx.fillStyle = found ? '#add6c1' : '#afc9d3';
      ctx.font = '500 15px ' + UI_FONT;
      ctx.fillText(synergy.name, xx + 16, yy + 25, cw - 100);
      ctx.textAlign = 'right';
      ctx.fillStyle = found ? '#9ac8b1' : '#7291a1';
      ctx.font = '10px ' + UI_FONT;
      ctx.fillText(found ? '✓ 已发现' : '待实践', xx + cw - 16, yy + 25);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#95b9c5';
      ctx.font = '11px ' + UI_FONT;
      ctx.fillText(synergy.pair, xx + 16, yy + 52, cw - 32);
      ctx.fillStyle = '#8ca9b9';
      ctx.font = '12px ' + UI_FONT;
      wrappedText(ctx, found ? synergy.effect : synergy.hint, xx + 16, yy + 79, cw - 32, 21, 3);
    });
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6c8e9f';
    ctx.font = '11px ' + UI_FONT;
    ctx.fillText(
      '滚轮浏览 · ' + getKey('synergy').toUpperCase() + ' 或 Esc 返回星域',
      state.canvasWidth / 2,
      y + h - 17,
    );
    if (this.synergyMaxScroll > 0) {
      const bh = (viewport * viewport) / content,
        by = top + ((viewport - bh) * this.synergyScrollOffset) / this.synergyMaxScroll;
      ctx.fillStyle = '#80aaa666';
      ctx.fillRect(x + w - 11, by, 3, bh);
    }
    ctx.restore();
  }

  private drawKeybindPanel(state: GameState): void {
    const ctx = this.ctx,
      bindings = getAllBindings();
    ctx.save();
    const { x, y, w, h } = this.drawArchiveFrame(
      state,
      'keybind',
      '快捷键设置',
      'CONTROLS / YOUR COMMANDS',
      '点击一行或按数字 1–9 选择，再按新的按键',
      680,
    );
    const top = y + 110,
      rowH = Math.min(48, (h - 154) / bindings.length);
    this.keybindAreas = [];
    bindings.forEach((binding, i) => {
      const yy = top + i * rowH,
        editing = this.editingAction === binding.action;
      panel(
        ctx,
        x + 24,
        yy,
        w - 48,
        rowH - 5,
        editing ? '#20483f' : '#112a3c',
        editing ? '#96d3ba99' : '#7399ae22',
        5,
      );
      this.keybindAreas.push({ action: binding.action, x: x + 24, y: yy, w: w - 48, h: rowH - 5 });
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6a92a3';
      ctx.font = '11px ' + MONO_FONT;
      ctx.fillText(String(i + 1).padStart(2, '0'), x + 38, yy + (rowH - 5) / 2);
      ctx.fillStyle = '#bed5df';
      ctx.font = '13px ' + UI_FONT;
      ctx.fillText(binding.label, x + 76, yy + (rowH - 5) / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = editing ? '#b0e4cc' : '#c5bc96';
      ctx.font = '500 13px ' + MONO_FONT;
      ctx.fillText(
        editing ? '按下新键 · Esc 取消' : binding.key.toUpperCase(),
        x + w - 40,
        yy + (rowH - 5) / 2,
        w - 250,
      );
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = this.keybindMessage ? '#d6ba8c' : '#6c8e9f';
    ctx.font = '11px ' + UI_FONT;
    ctx.fillText(
      this.keybindMessage || 'Backspace 恢复默认 · K 或 Esc 返回星域',
      state.canvasWidth / 2,
      y + h - 17,
      w - 40,
    );
    ctx.restore();
  }
  /** 处理快捷键设置面板中的按键输入，返回 true 表示已消费 */
  handleKeybindInput(key: string): boolean {
    if (!this.showKeybindPanel) return false;

    // 正在等待新按键
    if (this.editingAction) {
      if (key === 'escape') {
        this.editingAction = null;
        return true;
      }
      const ok = setKey(this.editingAction, key);
      this.keybindMessage = ok
        ? '按键已保存'
        : '无法使用这个按键 · 请避开已有绑定与 H / K / 数字等保留键';
      this.editingAction = null;
      return true;
    }

    // 恢复默认
    if (key === 'backspace') {
      resetKeybinds();
      this.keybindMessage = '已恢复默认按键';
      return true;
    }

    // 按数字选择行
    const bindings = getAllBindings();
    const num = parseInt(key);
    if (num >= 1 && num <= bindings.length) {
      this.editingAction = bindings[num - 1].action;
      return true;
    }

    return true; // 消费所有按键
  }
}
