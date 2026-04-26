// ===== 关卡选择界面 =====
import type { LevelConfig } from './levels';
import { LEVELS, getUnlockedLevels } from './levels';
import { COLORS, FONT, withAlpha } from './ui-tokens';

export class LevelSelectScreen {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onSelect: (level: LevelConfig) => void;
  private selectedIdx = 0;
  private unlockedLevels: LevelConfig[];
  private clearedIds: number[];
  private animFrameId = 0;
  private time = 0;
  private keyHandler: (e: KeyboardEvent) => void;
  private clickHandler: (e: MouseEvent) => void;
  private moveHandler: (e: MouseEvent) => void;
  /** 点击区域 */
  private hitAreas: { idx: number; x: number; y: number; w: number; h: number }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    clearedLevelIds: number[],
    onSelect: (level: LevelConfig) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onSelect = onSelect;
    this.clearedIds = clearedLevelIds;
    this.unlockedLevels = getUnlockedLevels(clearedLevelIds);

    this.keyHandler = (e: KeyboardEvent) => this.handleKey(e);
    this.clickHandler = (e: MouseEvent) => this.handleClick(e);
    this.moveHandler = (e: MouseEvent) => this.handleMove(e);
    window.addEventListener('keydown', this.keyHandler);
    this.canvas.addEventListener('click', this.clickHandler);
    this.canvas.addEventListener('mousemove', this.moveHandler);
    this.loop();
  }

  private destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.canvas.removeEventListener('click', this.clickHandler);
    this.canvas.removeEventListener('mousemove', this.moveHandler);
    cancelAnimationFrame(this.animFrameId);
  }

  private handleKey(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') {
      this.selectedIdx = Math.max(0, this.selectedIdx - 1);
    } else if (key === 'arrowdown' || key === 's') {
      this.selectedIdx = Math.min(this.unlockedLevels.length - 1, this.selectedIdx + 1);
    } else if (key === 'enter') {
      const level = this.unlockedLevels[this.selectedIdx];
      if (level) {
        this.destroy();
        this.onSelect(level);
      }
    }
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (const area of this.hitAreas) {
      if (mx >= area.x && mx <= area.x + area.w && my >= area.y && my <= area.y + area.h) {
        const level = this.unlockedLevels[area.idx];
        if (level) {
          this.destroy();
          this.onSelect(level);
        }
        return;
      }
    }
  }

  private handleMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (const area of this.hitAreas) {
      if (mx >= area.x && mx <= area.x + area.w && my >= area.y && my <= area.y + area.h) {
        this.selectedIdx = area.idx;
        return;
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
    this.hitAreas = [];

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = COLORS.accent.cyan;
    ctx.fillText('〈 选择关卡 〉', w / 2, 60);

    // 关卡列表（按屏幕高度自适应）
    const startY = 100;
    const availableH = Math.max(280, h - 160);
    const itemH = Math.max(58, Math.min(80, Math.floor(availableH / Math.max(LEVELS.length, 1))));
    const panelW = Math.min(760, Math.max(460, w - 120));
    const panelX = w / 2 - panelW / 2;

    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i];
      const y = startY + i * itemH;
      const isUnlocked = this.unlockedLevels.includes(level);
      const isCleared = this.clearedIds.includes(level.id);
      const isSelected = isUnlocked && this.unlockedLevels[this.selectedIdx]?.id === level.id;

      // 选中高亮框
      if (isSelected) {
        const pulse = Math.sin(this.time * 4) * 0.15 + 0.85;
        ctx.strokeStyle = withAlpha(COLORS.accent.cyan, 0.6 * pulse);
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, y - 4, panelW, itemH - 8);
        ctx.fillStyle = withAlpha(COLORS.accent.cyan, 0.05);
        ctx.fillRect(panelX, y - 4, panelW, itemH - 8);
      }

      // 记录可点击区域
      if (isUnlocked) {
        const uIdx = this.unlockedLevels.indexOf(level);
        if (uIdx >= 0) {
          this.hitAreas.push({ idx: uIdx, x: panelX, y: y - 4, w: panelW, h: itemH - 8 });
        }
      }

      // 关卡编号
      ctx.textAlign = 'left';
      ctx.font = `bold ${Math.max(13, Math.min(16, itemH * 0.24))}px monospace`;
      if (!isUnlocked) {
        ctx.fillStyle = COLORS.text.borderFaint;
      } else if (isCleared) {
        ctx.fillStyle = COLORS.accent.green;
      } else {
        ctx.fillStyle = COLORS.accent.cyanSoft;
      }
      const statusIcon = !isUnlocked ? '🔒' : isCleared ? '★' : '○';
      ctx.fillText(`${statusIcon}  第${level.id}关 — ${level.name}`, panelX + 16, y + itemH * 0.30);

      // 描述
      ctx.font = FONT.xs;
      ctx.fillStyle = isUnlocked ? COLORS.text.muted : COLORS.text.borderFaint;
      ctx.fillText(level.description, panelX + 16, y + itemH * 0.62);

      // 右侧信息
      if (isUnlocked) {
        ctx.textAlign = 'right';
        ctx.font = `11px monospace`;
        const objText = {
          survive: `生存${level.targetWaves}波`,
          boss: `击败Boss(第${level.bossWave}波)`,
          protect: '保护所有核心',
          timed: `限时${level.timeLimit}s`,
        }[level.objective];
        ctx.fillStyle = COLORS.text.faint;
        ctx.fillText(objText, panelX + panelW - 16, y + itemH * 0.30);

        ctx.fillStyle = COLORS.text.disabled;
        ctx.fillText(`${level.worldWidth}×${level.worldHeight} | ×${level.difficultyMult}`, panelX + panelW - 16, y + itemH * 0.62);
      }
    }

    // 操作提示
    ctx.textAlign = 'center';
    ctx.font = FONT.xs;
    ctx.fillStyle = COLORS.text.disabled;
    ctx.fillText('点击选择 · ↑↓ 导航 · Enter 确认', w / 2, h - 40);

    ctx.restore();
  }
}
