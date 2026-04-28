// ===== PvZ 风格节点选卡界面 =====
import type { NodeType } from './types';
import { NODE_CONFIGS } from './data/nodes';
import type { LevelConfig } from './levels';
import { COLORS, FONT, withAlpha } from './ui-tokens';

export class NodeSelectScreen {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private level: LevelConfig;
  private onConfirm: (selectedNodes: NodeType[]) => void;
  private available: NodeType[];
  /** 玩家选择顺序（按 push 顺序保留，不去除则用 includes 判定） */
  private selected: NodeType[] = [];
  private cursorIdx = 0;
  private animFrameId = 0;
  private time = 0;
  private keyHandler: (e: KeyboardEvent) => void;
  private clickHandler: (e: MouseEvent) => void;
  private wheelHandler: (e: WheelEvent) => void;
  /** 节点卡片点击区域 */
  private cardAreas: { idx: number; x: number; y: number; w: number; h: number }[] = [];
  /** 确认按钮区域 */
  private confirmArea: { x: number; y: number; w: number; h: number } | null = null;
  /** 卡片网格首行偏移（用于滚动） */
  private rowOffset = 0;

  constructor(
    canvas: HTMLCanvasElement,
    level: LevelConfig,
    onConfirm: (selectedNodes: NodeType[]) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.level = level;
    this.onConfirm = onConfirm;
    this.available = level.availableNodes;

    // 默认选中前 maxSelectedNodes 个（按 available 顺序入队）
    for (let i = 0; i < Math.min(level.maxSelectedNodes, this.available.length); i++) {
      this.selected.push(this.available[i]);
    }

    this.keyHandler = (e: KeyboardEvent) => this.handleKey(e);
    this.clickHandler = (e: MouseEvent) => this.handleClick(e);
    this.wheelHandler = (e: WheelEvent) => this.handleWheel(e);
    window.addEventListener('keydown', this.keyHandler);
    this.canvas.addEventListener('click', this.clickHandler);
    this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    this.loop();
  }

  private destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.canvas.removeEventListener('click', this.clickHandler);
    this.canvas.removeEventListener('wheel', this.wheelHandler);
    cancelAnimationFrame(this.animFrameId);
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const { cols, visibleRows } = this.getGridMetrics();
    const totalRows = Math.ceil(this.available.length / cols);
    const maxOffset = Math.max(0, totalRows - visibleRows);
    if (maxOffset <= 0) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.rowOffset = Math.max(0, Math.min(maxOffset, this.rowOffset + dir));
  }

  private handleKey(e: KeyboardEvent): void {
    const { cols, visibleRows } = this.getGridMetrics();
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      this.cursorIdx = Math.max(0, this.cursorIdx - 1);
    } else if (key === 'arrowright' || key === 'd') {
      this.cursorIdx = Math.min(this.available.length - 1, this.cursorIdx + 1);
    } else if (key === 'arrowup' || key === 'w') {
      this.cursorIdx = Math.max(0, this.cursorIdx - cols);
    } else if (key === 'arrowdown' || key === 's') {
      this.cursorIdx = Math.min(this.available.length - 1, this.cursorIdx + cols);
    } else if (key === ' ' || key === 'q') {
      e.preventDefault();
      const node = this.available[this.cursorIdx];
      const idx = this.selected.indexOf(node);
      if (idx >= 0) {
        this.selected.splice(idx, 1);
      } else if (this.selected.length < this.level.maxSelectedNodes) {
        this.selected.push(node);
      }
    } else if (key === 'enter') {
      if (this.selected.length > 0) {
        this.destroy();
        this.onConfirm([...this.selected]);
      }
    }

    this.ensureCursorVisible(cols, visibleRows);
  }

  private getGridMetrics(): { cols: number; visibleRows: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cardW = 88;
    const cardH = 116;
    const gapX = 10;
    const gapY = 10;

    const usableW = Math.max(360, w - 72);
    const cols = Math.max(3, Math.floor((usableW + gapX) / (cardW + gapX)));

    const usableH = Math.max(180, h - 350);
    const visibleRows = Math.max(1, Math.floor((usableH + gapY) / (cardH + gapY)));
    return { cols, visibleRows };
  }

  private ensureCursorVisible(cols: number, visibleRows: number): void {
    const cursorRow = Math.floor(this.cursorIdx / cols);
    if (cursorRow < this.rowOffset) {
      this.rowOffset = cursorRow;
    } else if (cursorRow >= this.rowOffset + visibleRows) {
      this.rowOffset = cursorRow - visibleRows + 1;
    }
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 检查卡片点击
    for (const area of this.cardAreas) {
      if (mx >= area.x && mx <= area.x + area.w && my >= area.y && my <= area.y + area.h) {
        const node = this.available[area.idx];
        this.cursorIdx = area.idx;
        const sIdx = this.selected.indexOf(node);
        if (sIdx >= 0) {
          this.selected.splice(sIdx, 1);
        } else if (this.selected.length < this.level.maxSelectedNodes) {
          this.selected.push(node);
        }
        return;
      }
    }

    // 检查确认按钮
    if (this.confirmArea && this.selected.length > 0) {
      if (mx >= this.confirmArea.x && mx <= this.confirmArea.x + this.confirmArea.w &&
        my >= this.confirmArea.y && my <= this.confirmArea.y + this.confirmArea.h) {
        this.destroy();
        this.onConfirm([...this.selected]);
      }
    }
  }

  private loop(): void {
    this.time += 0.016;
    this.render();
    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  private render(): void {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.save();
    ctx.fillStyle = COLORS.bg.pure;
    ctx.fillRect(0, 0, w, h);
    this.cardAreas = [];
    this.confirmArea = null;

    // 关卡名
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = COLORS.accent.cyan;
    ctx.fillText(`第${this.level.id}关 — ${this.level.name}`, w / 2, 50);

    // 标题
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = COLORS.text.primary;
    ctx.fillText('〈 选择出战节点 〉', w / 2, 90);

    ctx.font = '13px monospace';
    ctx.fillStyle = COLORS.text.muted;
    ctx.fillText(`已选 ${this.selected.length} / ${this.level.maxSelectedNodes}（数字键将按选择顺序绑定）`, w / 2, 120);

    // 节点卡片（自适应网格 + 行滚动）
    const { cols, visibleRows } = this.getGridMetrics();
    this.ensureCursorVisible(cols, visibleRows);
    const gapX = 10;
    const gapY = 10;
    const gridW = Math.max(320, w - 72);
    const cardW = Math.max(78, Math.min(96, Math.floor((gridW - (cols - 1) * gapX) / cols)));
    const cardH = 116;
    const actualGridW = cols * cardW + (cols - 1) * gapX;
    const startX = (w - actualGridW) / 2;
    const cardY = 160;
    const startIdx = this.rowOffset * cols;
    const endIdx = Math.min(this.available.length, (this.rowOffset + visibleRows) * cols);
    const totalRows = Math.ceil(this.available.length / cols);

    const icons: Record<string, string> = {
      core: '◆', energy: '⚡', turret: '⊕', mine: '⛏',
      shield: '◈', relay: '◎', tesla: '☇', beacon: '📡',
      factory: '⚙', magnet: '✦', trap: '💥', repair: '🔧',
      sniper: '⌖',
      buffer: '⇧',
      collector: '⊛',
      interceptor: '⊞',
      radar: '⦿',
      portal: '⊙',
      blackhole: '◐',
      echo: '⟳',
      toxin: '☣',
      arc: '↯',
      kamikaze: '💣',
    };

    for (let i = startIdx; i < endIdx; i++) {
      const type = this.available[i];
      const cfg = NODE_CONFIGS[type];
      const row = Math.floor(i / cols) - this.rowOffset;
      const col = i % cols;
      const cx = startX + col * (cardW + gapX);
      const cy = cardY + row * (cardH + gapY);
      const isCursor = i === this.cursorIdx;
      const selOrder = this.selected.indexOf(type); // -1 = 未选
      const isSelected = selOrder >= 0;

      // 卡片背景
      if (isSelected) {
        ctx.fillStyle = COLORS.border.cyanGhost;
        ctx.fillRect(cx, cy, cardW, cardH);
        ctx.strokeStyle = cfg.glowColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, cardW, cardH);
      } else {
        ctx.fillStyle = 'rgba(50,50,50,0.3)';
        ctx.fillRect(cx, cy, cardW, cardH);
        ctx.strokeStyle = COLORS.text.borderFaint;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, cardW, cardH);
      }
      this.cardAreas.push({ idx: i, x: cx, y: cy, w: cardW, h: cardH });

      // 光标指示
      if (isCursor) {
        const pulse = Math.sin(this.time * 5) * 2;
        ctx.strokeStyle = COLORS.text.primary;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -this.time * 20;
        ctx.strokeRect(cx - 2 + pulse * 0.1, cy - 2, cardW + 4, cardH + 4);
        ctx.setLineDash([]);
      }

      // 图标
      ctx.font = FONT.xxl;
      ctx.fillStyle = isSelected ? cfg.glowColor : COLORS.text.disabled;
      ctx.textAlign = 'center';
      ctx.fillText(icons[type] || '?', cx + cardW / 2, cy + 28);

      // 名称
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = isSelected ? COLORS.text.primary : COLORS.text.faint;
      const label = (cfg.description.split(' - ')[0] || type).slice(0, 7);
      ctx.fillText(label, cx + cardW / 2, cy + 52);

      // 费用
      ctx.font = '10px monospace';
      ctx.fillStyle = isSelected ? cfg.glowColor : COLORS.text.border;
      ctx.fillText(`${cfg.cost}◆`, cx + cardW / 2, cy + 70);

      // 描述
      ctx.font = '9px monospace';
      ctx.fillStyle = COLORS.text.disabled;
      const desc = cfg.description.split(' - ')[1] || '';
      const shortDesc = desc.length > 8 ? `${desc.slice(0, 8)}…` : desc;
      ctx.fillText(shortDesc, cx + cardW / 2, cy + 90);

      // 选中标记 + 绑定数字键序号（1..N，第10个显示 0）
      if (isSelected) {
        const slotKey = selOrder < 9 ? String(selOrder + 1) : '0';
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = COLORS.accent.green;
        ctx.fillText(`✓ [${slotKey}]`, cx + cardW / 2, cy + 108);
      }
    }

    if (totalRows > visibleRows) {
      ctx.font = '11px monospace';
      ctx.fillStyle = COLORS.text.faint;
      ctx.fillText(
        `第 ${this.rowOffset + 1}-${Math.min(totalRows, this.rowOffset + visibleRows)} 行 / 共 ${totalRows} 行`,
        w / 2,
        cardY + visibleRows * (cardH + gapY) + 8,
      );
    }

    // 已选节点预览
    let previewY = cardY + visibleRows * (cardH + gapY) + 34;
    previewY = Math.min(previewY, h - 125);
    ctx.textAlign = 'center';
    ctx.font = '13px monospace';
    ctx.fillStyle = COLORS.text.muted;
    ctx.fillText('出战编队:', w / 2, previewY);

    const selArr = this.selected;
    const perRow = Math.max(5, Math.floor((w - 80) / 44));
    const iconGap = 42;
    for (let i = 0; i < selArr.length; i++) {
      const type = selArr[i];
      const cfg = NODE_CONFIGS[type];
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, selArr.length - row * perRow);
      const rowStartX = (w - rowCount * iconGap) / 2;
      ctx.font = FONT.lg;
      ctx.fillStyle = cfg.glowColor;
      const cx2 = rowStartX + col * iconGap + 18;
      const cy2 = previewY + 28 + row * 24;
      ctx.fillText(icons[type] || '?', cx2, cy2);
      // 绑定数字键序号小角标
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = COLORS.accent.green;
      const slotKey = i < 9 ? String(i + 1) : '0';
      ctx.fillText(slotKey, cx2 + 12, cy2 - 8);
    }

    // 操作提示
    ctx.font = FONT.xs;
    ctx.fillStyle = COLORS.text.disabled;
    ctx.fillText('点击切换 · ←→↑↓ / WASD 移动光标 · 空格选择 · Enter 确认', w / 2, h - 32);

    // 确认按钮
    if (this.selected.length > 0) {
      const btnW = 160;
      const btnH = 36;
      const btnX = w / 2 - btnW / 2;
      const btnY = h - 78;
      ctx.fillStyle = withAlpha(COLORS.accent.green, 0.15);
      ctx.strokeStyle = COLORS.accent.green;
      ctx.lineWidth = 1.5;
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = COLORS.accent.green;
      ctx.fillText('确认出战 ▶', w / 2, btnY + btnH / 2);
      this.confirmArea = { x: btnX, y: btnY, w: btnW, h: btnH };
    }

    ctx.restore();
  }
}
