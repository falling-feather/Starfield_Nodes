// ===== UI/HUD 绘制 =====
import type { GameState, NodeType, EdgeType } from './types';
import { EXPAND_COST, EXPAND_CRYSTAL_COST } from './data/runtime';
import { EVOLUTION_LEVEL, EVOLVABLE_TYPES, EVOLUTION_NAMES, getEvolutionCost, getEvolutionCrystalCost } from './data/evolution';
import { NODE_CONFIGS } from './data/nodes';
import { EDGE_CONFIGS } from './data/edges';
import type { TechState } from './tech';
import { canResearch } from './tech';
import { isMuted } from './audio';
import { sfxAchievement } from './audio';
import { popNotification, ACHIEVEMENTS } from './achievements';
import type { AchievementDef } from './achievements';
import { getKey, getAllBindings, setKey, resetKeybinds } from './keybinds';
import { isOvercharged } from './graph';
import type { KeyAction } from './keybinds';
import { getCurrentStep, getProgress, isTutorialActive } from './tutorial';
import { COLORS, FONT, ANIM } from './ui-tokens';
import { getSeed } from './rng';

/** 成就通知 Toast */
interface AchToast {
  def: AchievementDef;
  timer: number; // 剩余显示时间 (秒)
}

export class UI {
  private ctx: CanvasRenderingContext2D;
  techState: TechState | null = null;
  allowedNodeTypes: NodeType[] | null = null;
  levelObjectiveText: string = '';
  /** 当前展示的成就通知队列 */
  private toasts: AchToast[] = [];
  /** 显示成就面板 */
  showAchievementPanel: boolean = false;
  /** 显示快捷键设置面板 */
  showKeybindPanel: boolean = false;
  /** 正在编辑的快捷键操作（等待按键输入） */
  editingAction: KeyAction | null = null;
  /** 存档已解锁成就列表（由外部设置） */
  unlockedAchievements: string[] = [];
  /** 当前选中的连线类型（由InputManager同步） */
  selectedEdgeType: EdgeType = 'standard';
  /** 节点面板按钮命中区域（屏幕坐标） */
  nodeButtons: { action: string; x: number; y: number; w: number; h: number; enabled: boolean }[] = [];

  // ── 微动效状态 ──
  /** HUD 首次进入战斗时的淡入起点（ms） */
  private hudFadeStart: number = performance.now();
  /** 径向菜单当前展开的节点 id（用于检测切换） */
  private radialForNodeId: number | null = null;
  /** 径向菜单展开动画起始时间（ms） */
  private radialAnimStart: number = 0;
  /** 通用面板淡入淡出进度（0..1） */
  private techFade = 0;
  private achievementFade = 0;
  private keybindFade = 0;
  /** 上次 render 时间（用于面板 fade dt） */
  private lastFadeTick = performance.now();

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(state: GameState): void {
    this.nodeButtons = [];

    // 更新各面板 fade 进度（180ms 全程）
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFadeTick) / 1000);
    this.lastFadeTick = now;
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

    if (state.paused && !this.techState?.showPanel && !isTutorialActive()) {
      this.drawPaused(state);
    }

    // 节点环形菜单（绘制在暂停遮罩之上）
    if (state.selectedNodeId && !state.gameOver && !state.levelWon) {
      this.drawRadialMenu(state);
    }

    if (state.gameOver) {
      this.drawGameOver(state);
    }

    if (state.levelWon) {
      this.drawLevelWon(state);
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

    // 成就通知 Toast
    this.updateToasts(state);
  }

  /** 面板淡入淡出曲线 easeOutCubic */
  private easeFade(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - x, 3);
  }

  private drawHUD(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;

    // HUD 进入淡入：easeOut
    const elapsed = performance.now() - this.hudFadeStart;
    const fadeDur = ANIM.hudFadeIn;
    const fadeT = Math.min(1, elapsed / fadeDur);
    const easedFade = 1 - Math.pow(1 - fadeT, 3);
    ctx.globalAlpha *= easedFade;

    // 顶部信息栏背景
    ctx.fillStyle = COLORS.bg.overlay;
    ctx.fillRect(0, 0, state.canvasWidth, 50);
    ctx.strokeStyle = COLORS.border.cyanFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.lineTo(state.canvasWidth, 50);
    ctx.stroke();

    ctx.font = FONT.xl;
    ctx.textBaseline = 'middle';

    // 波次
    ctx.fillStyle = COLORS.accent.cyan;
    ctx.textAlign = 'left';
    ctx.fillText(`⟨ WAVE ${state.wave} ⟩`, 12, 25);

    // 分数
    ctx.fillStyle = COLORS.accent.yellow;
    ctx.fillText(`★ ${state.score}`, 170, 25);

    // 资源
    ctx.fillStyle = COLORS.accent.green;
    ctx.fillText(`◆ ${Math.floor(state.resources)}`, 300, 25);

    // 晶体
    ctx.fillStyle = COLORS.accent.crystal;
    ctx.fillText(`✧ ${Math.floor(state.crystals)}`, 420, 25);

    // 敌人数
    ctx.fillStyle = COLORS.accent.red;
    ctx.fillText(`⚠ ${state.enemies.length}`, 540, 25);

    // 科技树按钮
    ctx.fillStyle = COLORS.accent.purple;
    ctx.fillText(`[T] 科技树`, 680, 25);

    // 时间加速（可点击）
    const tsX = 820;
    const tsW = 80;
    if (state.timeScale > 1) {
      ctx.fillStyle = COLORS.accent.yellowHi;
      ctx.fillText(`▶▶ ×${state.timeScale}`, tsX + 10, 25);
    } else {
      ctx.fillStyle = COLORS.text.disabled;
      ctx.fillText(`▶ ×1`, tsX + 10, 25);
    }
    this.nodeButtons.push({ action: 'time_scale', x: tsX, y: 0, w: tsW, h: 50, enabled: true });

    // Tick
    ctx.fillStyle = COLORS.text.faint;
    ctx.textAlign = 'right';
    ctx.fillText(`TICK ${state.tick}`, state.canvasWidth - 12, 25);

    // Seed 标识（仅在注入了 seed 时显示，benchmark 复现可视）
    const seed = getSeed();
    if (seed !== 0) {
      ctx.fillStyle = COLORS.accent.purple;
      ctx.font = FONT.md;
      ctx.fillText(`SEED ${seed}`, state.canvasWidth - 120, 25);
    }

    ctx.restore();
  }

  /** 节点环形菜单（明日方舟风格，在节点周围弹出按钮） */
  private drawRadialMenu(state: GameState): void {
    const node = state.nodes.find(n => n.id === state.selectedNodeId);
    if (!node) { this.nodeButtons = []; this.radialForNodeId = null; return; }

    // 检测选中节点变化 → 重置展开动画
    if (this.radialForNodeId !== node.id) {
      this.radialForNodeId = node.id;
      this.radialAnimStart = performance.now();
    }
    // 进入动画：缩放 0.7→1.0 + 透明度 0→1，使用 easeOutBack 微弹
    const ANIM_DUR = ANIM.radialMenuIn;
    const t = Math.min(1, (performance.now() - this.radialAnimStart) / ANIM_DUR);
    // easeOutBack
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    const animScale = 0.7 + 0.3 * eased;
    const animAlpha = Math.min(1, t * 1.4); // 透明度比缩放快

    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;

    const cfg = NODE_CONFIGS[node.type];
    const cam = state.camera;
    // 世界坐标 → 屏幕坐标
    const cx = (node.x - cam.x) * cam.zoom;
    const cy = (node.y - cam.y) * cam.zoom;

    // 收集可用操作
    const actions: { id: string; icon: string; label: string; color: string; enabled: boolean }[] = [];

    if (node.owner === 'neutral') {
      const recruitCost = NODE_CONFIGS[node.type].cost;
      const canRecruit = state.resources >= recruitCost;
      actions.push({ id: 'recruit', icon: '🤝', label: `招募 ${recruitCost}◆`, color: '#44cc88', enabled: canRecruit });
    }

    if (node.type === 'core' && node.connected && !node.expanded) {
      const canExpand = state.resources >= EXPAND_COST && state.crystals >= EXPAND_CRYSTAL_COST;
      actions.push({ id: 'expand', icon: '🔭', label: `扩展 ${EXPAND_COST}◆`, color: COLORS.accent.cyanSoft, enabled: canExpand });
    }

    if (node.type !== 'core' && node.connected) {
      if (node.evolved) {
        actions.push({ id: 'upgrade', icon: '✦', label: '已进化', color: COLORS.text.faint, enabled: false });
      } else if (node.level >= EVOLUTION_LEVEL && EVOLVABLE_TYPES.has(node.type)) {
        const evoCost = getEvolutionCost(node.type);
        const evoCrystal = getEvolutionCrystalCost(node.type);
        const enabled = state.resources >= evoCost && state.crystals >= evoCrystal;
        actions.push({ id: 'upgrade', icon: '★', label: `进化 ${evoCost}◆ ${evoCrystal}✧`, color: COLORS.accent.pink, enabled });
      } else if (node.level >= EVOLUTION_LEVEL) {
        actions.push({ id: 'upgrade', icon: '✦', label: '已满级', color: COLORS.text.faint, enabled: false });
      } else {
        const upgradeCost = 30 * node.level;
        const enabled = state.resources >= upgradeCost;
        actions.push({ id: 'upgrade', icon: '⬆', label: `升级 ${upgradeCost}◆`, color: COLORS.accent.cyan, enabled });
      }
    }

    if (node.connected) {
      // 连线按钮
      const edgeCost = EDGE_CONFIGS[state.selectedEdgeType].cost;
      const isConnecting = state.draggingFrom === node.id;
      actions.push({
        id: 'connect', icon: '🔗',
        label: isConnecting ? '连线中…' : `连线 ${edgeCost}◆`,
        color: isConnecting ? COLORS.accent.yellow : '#44aaff',
        enabled: !isConnecting,
      });

      const baseCost = NODE_CONFIGS[node.type].cost;
      let totalInvested = baseCost;
      for (let lv = 1; lv < node.level; lv++) totalInvested += 30 * lv;
      if (node.evolved) totalInvested += getEvolutionCost(node.type);
      const refund = Math.floor(totalInvested * 0.5);
      let sellEnabled = true;
      if (node.type === 'core') {
        const aliveCores = state.nodes.filter(n => n.type === 'core' && n.status !== 'destroyed');
        sellEnabled = aliveCores.length > 1;
      }
      actions.push({ id: 'sell', icon: '✕', label: `出售 +${refund}◆`, color: COLORS.accent.redSoft, enabled: sellEnabled });
    }

    // 保留 HUD 按钮（时间加速等）
    this.nodeButtons = this.nodeButtons.filter(b => b.action === 'time_scale');

    if (actions.length === 0) { ctx.restore(); return; }

    // 应用展开动画：以节点为中心做缩放 + 整体透明度
    ctx.translate(cx, cy);
    ctx.scale(animScale, animScale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha *= animAlpha;
    // 动画前 60% 期间禁止点击，避免按钮位置错位导致的误触
    const hitEnabled = t > 0.6;

    const menuRadius = 85;
    const btnRadius = 24;

    // 绘制光环指示环
    ctx.strokeStyle = this.withAlpha(node.glowColor, 0.2);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, menuRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 连接线（中心 → 各按钮）
    ctx.strokeStyle = this.withAlpha(node.glowColor, 0.1);
    ctx.lineWidth = 1;

    const startAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 2) / actions.length;

    for (let i = 0; i < actions.length; i++) {
      const angle = startAngle + i * angleStep;
      const bx = cx + Math.cos(angle) * menuRadius;
      const by = cy + Math.sin(angle) * menuRadius;
      const action = actions[i];

      // 连接线
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // 按钮圆形背景
      ctx.beginPath();
      ctx.arc(bx, by, btnRadius, 0, Math.PI * 2);
      ctx.fillStyle = action.enabled ? COLORS.bg.panel : 'rgba(10,10,30,0.65)';
      ctx.fill();
      ctx.strokeStyle = action.enabled ? action.color : COLORS.text.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 启用时添加微弱外发光
      if (action.enabled) {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = action.color;
        ctx.beginPath();
        ctx.arc(bx, by, btnRadius, 0, Math.PI * 2);
        ctx.strokeStyle = this.withAlpha(action.color, 0.3);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // 图标
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT.xxl;
      ctx.fillStyle = action.enabled ? action.color : COLORS.text.disabled;
      ctx.fillText(action.icon, bx, by - 1);

      // 标签（按钮外侧）
      const labelDist = menuRadius + btnRadius + 14;
      const lx = cx + Math.cos(angle) * labelDist;
      const ly = cy + Math.sin(angle) * labelDist;
      ctx.font = FONT.md;
      ctx.fillStyle = action.enabled ? COLORS.text.high : COLORS.text.disabled;
      // 根据角度调整文本对齐
      if (Math.abs(Math.cos(angle)) < 0.3) {
        ctx.textAlign = 'center';
      } else if (Math.cos(angle) > 0) {
        ctx.textAlign = 'left';
      } else {
        ctx.textAlign = 'right';
      }
      ctx.textBaseline = 'middle';
      ctx.fillText(action.label, lx, ly);

      // 命中区域
      this.nodeButtons.push({
        action: action.id,
        x: bx - btnRadius,
        y: by - btnRadius,
        w: btnRadius * 2,
        h: btnRadius * 2,
        enabled: hitEnabled && action.enabled,
      });
    }

    // ── 节点信息卡片 ──
    const cardW = 220;
    const cardH = 76;
    const cardX = cx - cardW / 2;
    // 默认在环上方，太靠近顶部则放到下方
    let cardY = cy - menuRadius - btnRadius - cardH - 8;
    if (cardY < 4) cardY = cy + menuRadius + btnRadius + 8;

    ctx.fillStyle = COLORS.bg.card;
    ctx.strokeStyle = this.withAlpha(node.glowColor, 0.5);
    ctx.lineWidth = 1;
    // 圆角矩形
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 6);
    ctx.fill();
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 6);
    ctx.stroke();

    // 名称 + 等级
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = node.glowColor;
    const desc = node.evolved && EVOLUTION_NAMES[node.type]
      ? `★ ${EVOLUTION_NAMES[node.type]}` : cfg.description;
    ctx.fillText(`${desc} Lv.${node.level}`, cx, cardY + 5);

    // HP 条
    const barX = cardX + 8;
    const barW = cardW - 16;
    const barH = 7;
    const barY = cardY + 22;
    const hpRatio = node.hp / node.maxHp;
    const hpColor = hpRatio > 0.5 ? COLORS.accent.green : hpRatio > 0.25 ? COLORS.accent.yellow : COLORS.accent.red;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.font = FONT.xs;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text.primary;
    ctx.fillText(`HP ${Math.floor(node.hp)}/${node.maxHp}`, cx, barY + barH / 2);

    // 能量条
    const eBarY = barY + barH + 4;
    const energyRatio = node.currentEnergy / node.maxEnergy;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(barX, eBarY, barW, barH);
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(barX, eBarY, barW * energyRatio, barH);
    ctx.font = FONT.xs;
    ctx.fillStyle = COLORS.text.primary;
    ctx.fillText(`⚡ ${Math.floor(node.currentEnergy)}/${node.maxEnergy}`, cx, eBarY + barH / 2);

    // 状态指示（未连接 / 中立 / 超载）
    if (node.owner === 'neutral' || !node.connected || isOvercharged(node)) {
      const tagY = eBarY + barH + 3;
      ctx.font = FONT.sm;
      ctx.textBaseline = 'top';
      if (node.owner === 'neutral') {
        ctx.fillStyle = '#88aacc';
        ctx.fillText('☆ 中立', cx, tagY);
      } else if (!node.connected) {
        ctx.fillStyle = COLORS.accent.red;
        ctx.fillText('⊘ 断连', cx, tagY);
      } else if (isOvercharged(node)) {
        ctx.fillStyle = COLORS.accent.yellowHi;
        ctx.fillText('⚡ 超载', cx, tagY);
      }
    }

    ctx.restore();
  }

  /** 辅助：绘制圆角矩形路径 */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /** 批量操作面板（框选后显示） */
  private drawBatchPanel(state: GameState): void {
    const ids = state.selectedNodeIds;
    if (ids.length === 0) { this.nodeButtons = []; return; }

    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;

    const panelW = 230;
    const panelX = state.canvasWidth - panelW - 10;
    const panelY = 60;
    const btnW = panelW - 20;
    const btnH = 24;
    const panelH = 10 + 20 + 12 + (btnH + 6) * 3 + 10;
    this.nodeButtons = [];

    // 面板背景
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeStyle = 'rgba(0,255,136,0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.font = FONT.lg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let y = panelY + 10;
    const x = panelX + 10;

    // 标题
    ctx.fillStyle = COLORS.accent.green;
    ctx.fillText(`已选中 ${ids.length} 个节点`, x, y);
    y += 20 + 6;

    // 全部升级
    const upgradeColor = COLORS.accent.cyan;
    this.drawButton(x, y, btnW, btnH, `⬆ 全部升级 (${ids.length})`, upgradeColor, true);
    this.nodeButtons.push({ action: 'batch_upgrade', x, y, w: btnW, h: btnH, enabled: true });
    y += btnH + 6;

    // 全部出售
    const sellColor = COLORS.accent.redSoft;
    this.drawButton(x, y, btnW, btnH, `✕ 全部出售 (${ids.length})`, sellColor, true);
    this.nodeButtons.push({ action: 'batch_sell', x, y, w: btnW, h: btnH, enabled: true });
    y += btnH + 6;

    // 取消选择
    const clearColor = COLORS.text.muted;
    this.drawButton(x, y, btnW, btnH, '✕ 取消选择', clearColor, true);
    this.nodeButtons.push({ action: 'batch_clear', x, y, w: btnW, h: btnH, enabled: true });

    ctx.restore();
  }

  /** 绘制一个可点击按钮 */
  private drawButton(x: number, y: number, w: number, h: number, label: string, color: string, enabled: boolean): void {
    const ctx = this.ctx;
    // 按钮背景
    ctx.fillStyle = enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.withAlpha(color, enabled ? 0.6 : 0.2);
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // 按钮文本
    ctx.fillStyle = color;
    ctx.font = FONT.base;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  drawBuildPanel(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;

    const panelH = 64;
    const panelY = state.canvasHeight - panelH;
    ctx.fillStyle = COLORS.bg.overlay;
    ctx.fillRect(0, panelY, state.canvasWidth, panelH);
    ctx.strokeStyle = COLORS.border.cyanFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(state.canvasWidth, panelY);
    ctx.stroke();

    // 静态表：仅作为未限制节点选择场景下的退回（如 bench / 调试）
    const fallbackBuildTypes: { key: string; type: NodeType; label: string }[] = [
      { key: '1', type: 'energy', label: '能量站' },
      { key: '2', type: 'turret', label: '炮塔' },
      { key: '3', type: 'mine', label: '矿机' },
      { key: '4', type: 'shield', label: '护盾' },
      { key: '5', type: 'relay', label: '中继器' },
      { key: '6', type: 'tesla', label: '连锁塔' },
      { key: '7', type: 'core', label: '核心' },
      { key: '8', type: 'beacon', label: '信标' },
      { key: '9', type: 'factory', label: '工厂' },
      { key: '0', type: 'magnet', label: '磁力塔' },
      { key: '-', type: 'trap', label: '陷阱' },
      { key: '=', type: 'repair', label: '维修站' },
      { key: '\\', type: 'sniper', label: '狙击手' },
      { key: ']', type: 'buffer', label: '缓冲器' },
      { key: '[', type: 'collector', label: '采集器' },
      { key: "'", type: 'interceptor', label: '拦截器' },
      { key: ';', type: 'radar', label: '雷达' },
      { key: '`', type: 'portal', label: '传送门' },
      { key: '.', type: 'blackhole', label: '黑洞' },
      { key: '/', type: 'echo', label: '回声塔' },
      { key: ',', type: 'toxin', label: '毒雾' },
      { key: 'Q', type: 'arc', label: '电弧链' },
      { key: 'E', type: 'kamikaze', label: '自爆' },
    ];

    // V1.0.5：有 allowedNodeTypes 时按玩家选择顺序绑定数字键 1..9,0
    const NUM_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const NODE_LABELS: Partial<Record<NodeType, string>> = Object.fromEntries(
      fallbackBuildTypes.map(bt => [bt.type, bt.label]),
    ) as Partial<Record<NodeType, string>>;

    let buildTypes: { key: string; type: NodeType; label: string }[];
    if (this.allowedNodeTypes && this.allowedNodeTypes.length > 0) {
      buildTypes = this.allowedNodeTypes.slice(0, NUM_KEYS.length).map((type, i) => ({
        key: NUM_KEYS[i],
        type,
        label: NODE_LABELS[type] ?? type,
      }));
    } else {
      buildTypes = fallbackBuildTypes;
    }

    const startX = 10;
    ctx.font = FONT.md;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // 动态分两排
    const half = Math.ceil(buildTypes.length / 2);
    const row1 = buildTypes.slice(0, half);
    const row2 = buildTypes.slice(half);
    const colW = 130;

    for (let i = 0; i < row1.length; i++) {
      const bt = row1[i];
      const cfg = NODE_CONFIGS[bt.type];
      const bx = startX + i * colW;
      ctx.fillStyle = state.resources >= cfg.cost ? cfg.glowColor : COLORS.text.border;
      ctx.fillText(`[${bt.key}]${bt.label}(${cfg.cost}◆)`, bx, panelY + 20);
    }
    for (let i = 0; i < row2.length; i++) {
      const bt = row2[i];
      const cfg = NODE_CONFIGS[bt.type];
      const bx = startX + i * colW;
      ctx.fillStyle = state.resources >= cfg.cost ? cfg.glowColor : COLORS.text.border;
      ctx.fillText(`[${bt.key}]${bt.label}(${cfg.cost}◆)`, bx, panelY + 44);
    }

    // 操作提示
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text.disabled;
    ctx.font = FONT.md;
    ctx.fillText(`[${getKey('upgrade').toUpperCase()}]升级 | [${getKey('sell').toUpperCase()}]出售 | [${getKey('pause').toUpperCase()}]暂停 | [${getKey('achievements').toUpperCase()}]成就 | [K]按键 | [${getKey('mute').toUpperCase()}]${isMuted() ? '🔇' : '🔊'}`, state.canvasWidth - 10, panelY + 20);

    // 连线类型选择器
    const ecfg = EDGE_CONFIGS[this.selectedEdgeType];
    const etColor = ecfg.color || COLORS.accent.cyan;
    ctx.fillStyle = etColor;
    ctx.textAlign = 'right';
    ctx.fillText(`[Tab]连线: ${ecfg.name}(${ecfg.cost}◆${ecfg.crystalCost ? ' ' + ecfg.crystalCost + '✧' : ''}) ${ecfg.description}`, state.canvasWidth - 200, panelY + 44);

    ctx.fillStyle = COLORS.text.disabled;
    ctx.fillText('Ctrl+左键平移 | 滚轮缩放', state.canvasWidth - 10, panelY + 44);

    ctx.restore();
  }

  private drawTutorial(state: GameState): void {
    const step = getCurrentStep();
    if (!step) return;

    const ctx = this.ctx;
    ctx.save();

    const cx = state.canvasWidth / 2;
    const lineH = 20;
    const padding = 16;
    const boxW = 480;
    const boxH = padding * 2 + step.lines.length * lineH + 40;

    // 位置
    let boxY: number;
    if (step.highlight === 'bottom') {
      boxY = state.canvasHeight - boxH - 60;
    } else if (step.highlight === 'top') {
      boxY = 50;
    } else {
      boxY = (state.canvasHeight - boxH) / 2;
    }
    const boxX = cx - boxW / 2;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    // 面板
    ctx.fillStyle = 'rgba(5,5,25,0.95)';
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // 进度指示
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = FONT.md;
    ctx.fillStyle = COLORS.text.disabled;
    ctx.fillText(`${getProgress()}  [Esc] 跳过`, boxX + boxW - 10, boxY + 8);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(step.title, cx, boxY + padding + 12);

    // 内容行
    ctx.font = FONT.xl;
    ctx.fillStyle = COLORS.text.high;
    const contentStartY = boxY + padding + 40;
    for (let i = 0; i < step.lines.length; i++) {
      const line = step.lines[i];
      ctx.fillStyle = line.startsWith('提示') ? COLORS.accent.yellow : COLORS.text.high;
      ctx.fillText(line, cx, contentStartY + i * lineH);
    }

    ctx.restore();
  }

  private drawTechPanel(state: GameState): void {
    if (!this.techState) return;
    const ctx = this.ctx;
    ctx.save();

    const cx = state.canvasWidth / 2;
    const cy = state.canvasHeight / 2;
    const panelW = 600;
    const panelH = 440;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    // 面板背景
    ctx.fillStyle = 'rgba(10,10,30,0.95)';
    ctx.strokeStyle = COLORS.accent.purple;
    ctx.lineWidth = 2;
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeRect(px, py, panelW, panelH);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 27px monospace';
    ctx.fillStyle = COLORS.accent.purple;
    ctx.fillText('⟨ 科 技 树 ⟩', cx, py + 25);

    ctx.font = FONT.base;
    ctx.fillStyle = COLORS.text.faint;
    ctx.fillText(`◆ ${Math.floor(state.resources)} 可用资源  |  [T] 关闭  |  点击数字键研究`, cx, py + 46);

    // 绘制各科技节点
    const tree = this.techState.tree;
    const colW = panelW / 3;
    const startY = py + 70;

    // 按 tier 分组
    const tier1 = tree.filter(t => t.requires.length === 0);
    const tier2 = tree.filter(t => t.requires.length === 1);
    const tier3 = tree.filter(t => t.requires.length >= 2);
    const tiers = [tier1, tier2, tier3];
    const tierLabels = ['基 础', '进 阶', '高 级'];

    for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
      const tier = tiers[tierIdx];
      const tierX = px + tierIdx * colW;
      const tierCx = tierX + colW / 2;

      // Tier 标签
      ctx.fillStyle = COLORS.text.border;
      ctx.font = FONT.md;
      ctx.textAlign = 'center';
      ctx.fillText(tierLabels[tierIdx], tierCx, startY - 8);

      for (let i = 0; i < tier.length; i++) {
        const tech = tier[i];
        const ty = startY + 10 + i * 90;
        const cardW = colW - 20;
        const cardH = 75;
        const cardX = tierCx - cardW / 2;

        const available = canResearch(tech, this.techState, state.resources);

        // 卡片背景
        ctx.fillStyle = tech.unlocked
          ? 'rgba(0,255,100,0.1)'
          : available
          ? 'rgba(170,68,255,0.15)'
          : 'rgba(30,30,50,0.8)';
        ctx.strokeStyle = tech.unlocked
          ? COLORS.accent.green
          : available
          ? COLORS.accent.purple
          : COLORS.text.borderFaint;
        ctx.lineWidth = 1;
        ctx.fillRect(cardX, ty, cardW, cardH);
        ctx.strokeRect(cardX, ty, cardW, cardH);

        // 图标
        ctx.font = FONT.xxl;
        ctx.fillStyle = tech.unlocked ? tech.color : available ? tech.color : COLORS.text.disabled;
        ctx.textAlign = 'left';
        ctx.fillText(tech.icon, cardX + 8, ty + 18);

        // 名称
        ctx.font = 'bold 16px monospace';
        ctx.fillText(tech.name, cardX + 30, ty + 18);

        // 描述
        ctx.font = FONT.md;
        ctx.fillStyle = tech.unlocked ? COLORS.text.body : '#777777';
        ctx.fillText(tech.description, cardX + 8, ty + 38);

        // 状态/费用
        ctx.font = FONT.md;
        if (tech.unlocked) {
          ctx.fillStyle = COLORS.accent.green;
          ctx.fillText('✓ 已研究', cardX + 8, ty + 58);
        } else {
          ctx.fillStyle = available ? COLORS.accent.yellow : COLORS.text.disabled;
          ctx.fillText(`费用: ${tech.cost}◆`, cardX + 8, ty + 58);
          if (tech.requires.length > 0) {
            const reqNames = tech.requires.map(id => {
              const req = this.techState!.tree.find(t => t.id === id);
              return req ? (req.unlocked ? '' : '❌' + req.name) : '';
            }).filter(s => s).join(' ');
            if (reqNames) {
              ctx.fillStyle = COLORS.accent.redSoft;
              ctx.font = FONT.sm;
              ctx.fillText(`需要: ${reqNames}`, cardX + 8, ty + 70);
            }
          }
        }

        // 快捷键提示（可研究的科技）
        if (available) {
          const keyIdx = tree.indexOf(tech);
          ctx.fillStyle = COLORS.accent.purple;
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`[${keyIdx + 1}]`, cardX + cardW - 8, ty + 18);
          ctx.textAlign = 'left';
        }
      }

      // 绘制 tier 之间的连接线
      if (tierIdx < tiers.length - 1) {
        ctx.strokeStyle = COLORS.text.borderFaint;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        const lineX = tierX + colW;
        ctx.beginPath();
        ctx.moveTo(lineX, startY);
        ctx.lineTo(lineX, startY + 280);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  private drawGameOver(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = COLORS.bg.overlay;
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle = COLORS.accent.red;
    ctx.font = 'bold 72px monospace';
    ctx.fillText('CORE DESTROYED', state.canvasWidth / 2, state.canvasHeight / 2 - 40);

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.accent.yellow;
    ctx.font = '36px monospace';
    ctx.fillText(`SCORE: ${state.score}`, state.canvasWidth / 2, state.canvasHeight / 2 + 20);

    ctx.fillStyle = COLORS.accent.cyan;
    ctx.font = FONT.xxl;
    ctx.fillText(`WAVE REACHED: ${state.wave}`, state.canvasWidth / 2, state.canvasHeight / 2 + 55);

    ctx.fillStyle = COLORS.text.muted;
    ctx.font = '21px monospace';
    ctx.fillText('[R] 重新开始', state.canvasWidth / 2, state.canvasHeight / 2 + 90);

    ctx.restore();
  }

  private drawLevelWon(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = COLORS.bg.overlay;
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowBlur = 20;
    ctx.shadowColor = COLORS.accent.green;
    ctx.fillStyle = COLORS.accent.green;
    ctx.font = 'bold 72px monospace';
    ctx.fillText('★ VICTORY ★', state.canvasWidth / 2, state.canvasHeight / 2 - 40);

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.accent.yellow;
    ctx.font = '36px monospace';
    ctx.fillText(`SCORE: ${state.score}  |  WAVE: ${state.wave}`, state.canvasWidth / 2, state.canvasHeight / 2 + 20);

    if (this.levelObjectiveText) {
      ctx.fillStyle = COLORS.accent.cyan;
      ctx.font = FONT.xxl;
      ctx.fillText(this.levelObjectiveText, state.canvasWidth / 2, state.canvasHeight / 2 + 55);
    }

    ctx.fillStyle = COLORS.text.muted;
    ctx.font = '21px monospace';
    ctx.fillText('即将返回关卡选择...', state.canvasWidth / 2, state.canvasHeight / 2 + 90);

    ctx.restore();
  }

  private drawPaused(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.accent.cyan;
    ctx.fillStyle = COLORS.accent.cyan;
    ctx.font = 'bold 54px monospace';
    ctx.fillText('⏸ PAUSED', state.canvasWidth / 2, state.canvasHeight / 2);

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.text.muted;
    ctx.font = '21px monospace';
    ctx.fillText('[P] 继续', state.canvasWidth / 2, state.canvasHeight / 2 + 40);

    ctx.restore();
  }

  private withAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
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
    const marginRight = 10;
    const startY = 60; // 顶栏下方

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i];
      toast.timer -= 1 / 60; // ~60fps
      if (toast.timer <= 0) {
        this.toasts.splice(i, 1);
        continue;
      }

      const alpha = Math.min(1, toast.timer);
      const idx = this.toasts.length - 1 - i;
      const tx = state.canvasWidth - toastW - marginRight;
      const ty = startY + idx * (toastH + 6);

      // 背景
      ctx.fillStyle = `rgba(20,10,40,${0.9 * alpha})`;
      ctx.strokeStyle = `rgba(255,200,0,${0.6 * alpha})`;
      ctx.lineWidth = 1.5;
      ctx.fillRect(tx, ty, toastW, toastH);
      ctx.strokeRect(tx, ty, toastW, toastH);

      // 图标
      ctx.globalAlpha = alpha;
      ctx.font = '30px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.accent.yellowHi;
      ctx.fillText(toast.def.icon, tx + 10, ty + toastH / 2);

      // 标题
      ctx.font = 'bold 18px monospace';
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

  // ───── 成就面板 ─────

  private drawAchievementPanel(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();

    const cx = state.canvasWidth / 2;
    const cy = state.canvasHeight / 2;
    const panelW = 520;
    const panelH = 400;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    // 面板背景
    ctx.fillStyle = 'rgba(10,10,30,0.95)';
    ctx.strokeStyle = COLORS.accent.yellowHi;
    ctx.lineWidth = 2;
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeRect(px, py, panelW, panelH);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 27px monospace';
    ctx.fillStyle = COLORS.accent.yellowHi;
    ctx.fillText('⟨ 成 就 ⟩', cx, py + 25);

    const unlocked = this.unlockedAchievements;
    const total = ACHIEVEMENTS.length;
    const count = unlocked.length;
    ctx.font = FONT.base;
    ctx.fillStyle = COLORS.text.muted;
    ctx.fillText(`${count}/${total} 已解锁  |  [A] 关闭`, cx, py + 46);

    // 成就列表
    const startY = py + 65;
    const rowH = 56;
    const cols = 2;
    const colW = (panelW - 20) / cols;

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const ach = ACHIEVEMENTS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ax = px + 10 + col * colW;
      const ay = startY + row * rowH;

      const isUnlocked = unlocked.includes(ach.id);

      // 卡片背景
      ctx.fillStyle = isUnlocked ? 'rgba(255,200,0,0.08)' : 'rgba(30,30,50,0.6)';
      ctx.strokeStyle = isUnlocked ? 'rgba(255,200,0,0.4)' : 'rgba(60,60,80,0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(ax, ay, colW - 6, rowH - 8);
      ctx.strokeRect(ax, ay, colW - 6, rowH - 8);

      // 图标
      ctx.font = '27px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isUnlocked ? COLORS.accent.yellowHi : COLORS.text.border;
      ctx.fillText(isUnlocked ? ach.icon : '🔒', ax + 8, ay + (rowH - 8) / 2 - 6);

      // 名称
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = isUnlocked ? COLORS.accent.yellowHi : COLORS.text.faint;
      ctx.fillText(ach.name, ax + 34, ay + 16);

      // 描述
      ctx.font = FONT.md;
      ctx.fillStyle = isUnlocked ? COLORS.text.body : COLORS.text.disabled;
      ctx.fillText(ach.description, ax + 34, ay + 34);
    }

    ctx.restore();
  }

  // ───── 快捷键设置面板 ─────

  private drawKeybindPanel(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();

    const cx = state.canvasWidth / 2;
    const cy = state.canvasHeight / 2;
    const bindings = getAllBindings();
    const panelW = 400;
    const rowH = 38;
    const panelH = 80 + bindings.length * rowH + 40;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    // 面板背景
    ctx.fillStyle = 'rgba(10,10,30,0.95)';
    ctx.strokeStyle = COLORS.accent.cyanSoft;
    ctx.lineWidth = 2;
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeRect(px, py, panelW, panelH);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 27px monospace';
    ctx.fillStyle = COLORS.accent.cyanSoft;
    ctx.fillText('⟨ 快捷键设置 ⟩', cx, py + 25);

    ctx.font = FONT.base;
    ctx.fillStyle = COLORS.text.muted;
    ctx.fillText('[K] 关闭  |  [Backspace] 恢复默认', cx, py + 46);

    // 按键列表
    const startY = py + 70;
    for (let i = 0; i < bindings.length; i++) {
      const b = bindings[i];
      const ry = startY + i * rowH;
      const isEditing = this.editingAction === b.action;

      // 行背景
      ctx.fillStyle = isEditing ? 'rgba(0,200,255,0.12)' : (i % 2 === 0 ? 'rgba(30,30,50,0.4)' : 'rgba(20,20,40,0.4)');
      ctx.fillRect(px + 10, ry, panelW - 20, rowH - 4);

      if (isEditing) {
        ctx.strokeStyle = COLORS.accent.cyanSoft;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 10, ry, panelW - 20, rowH - 4);
      }

      // 操作名称
      ctx.textAlign = 'left';
      ctx.font = FONT.xl;
      ctx.fillStyle = COLORS.text.high;
      ctx.fillText(b.label, px + 24, ry + rowH / 2 - 2);

      // 当前按键
      ctx.textAlign = 'right';
      ctx.font = 'bold 21px monospace';
      if (isEditing) {
        ctx.fillStyle = COLORS.accent.cyanSoft;
        ctx.fillText('按下新键...', px + panelW - 24, ry + rowH / 2 - 2);
      } else {
        ctx.fillStyle = COLORS.accent.yellow;
        ctx.fillText(`[ ${b.key.toUpperCase()} ]`, px + panelW - 24, ry + rowH / 2 - 2);
      }

      // 编号提示
      ctx.textAlign = 'left';
      ctx.font = FONT.md;
      ctx.fillStyle = COLORS.text.disabled;
      ctx.fillText(`${i + 1}`, px + 12, ry + rowH / 2 - 2);
    }

    // 底部提示
    ctx.textAlign = 'center';
    ctx.font = FONT.md;
    ctx.fillStyle = COLORS.text.faint;
    ctx.fillText('按数字键选择要修改的项目，然后按下新的按键', cx, startY + bindings.length * rowH + 12);

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
      if (!ok) {
        // 冲突，忽略（用户会看到没变化）
      }
      this.editingAction = null;
      return true;
    }

    // 恢复默认
    if (key === 'backspace') {
      resetKeybinds();
      return true;
    }

    // 关闭面板
    if (key === 'k' || key === 'escape') {
      this.showKeybindPanel = false;
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
