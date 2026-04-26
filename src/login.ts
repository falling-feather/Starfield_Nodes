// ===== 登录/档案选择界面 =====
import type { SaveProfile } from './save';
import {
  loadProfiles, saveProfile, createProfile,
  getActiveProfileName, setActiveProfileName, deleteProfile,
} from './save';
import { COLORS, FONT, withAlpha } from './ui-tokens';
import { themeBus, THEMES, getThemeName } from './themes';

export class LoginScreen {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private profiles: SaveProfile[] = [];
  private selectedIndex = 0;
  private inputMode: 'select' | 'create' = 'select';
  private newName = '';
  private onLogin: (profile: SaveProfile) => void;
  private resolved = false;
  /** 可点击区域 */
  private hitAreas: { action: string; x: number; y: number; w: number; h: number; idx?: number }[] = [];

  constructor(canvas: HTMLCanvasElement, onLogin: (profile: SaveProfile) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onLogin = onLogin;
    this.profiles = loadProfiles();

    // 如果已有活跃档案，自动选中
    const active = getActiveProfileName();
    if (active) {
      const idx = this.profiles.findIndex(p => p.name === active);
      if (idx >= 0) this.selectedIndex = idx;
    }

    this.bindEvents();
    this.render();
  }

  private bindEvents(): void {
    const keyHandler = (e: KeyboardEvent) => {
      if (this.resolved) return;

      if (this.inputMode === 'create') {
        if (e.key === 'Escape') {
          this.inputMode = 'select';
          this.newName = '';
        } else if (e.key === 'Enter' && this.newName.trim().length > 0) {
          this.createAndSelect(this.newName.trim());
        } else if (e.key === 'Backspace') {
          this.newName = this.newName.slice(0, -1);
        } else if (e.key.length === 1 && this.newName.length < 16) {
          this.newName += e.key;
        }
        this.render();
        return;
      }

      // select mode
      if (e.key === 'ArrowUp') {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      } else if (e.key === 'ArrowDown') {
        this.selectedIndex = Math.min(this.profiles.length, this.selectedIndex + 1);
      } else if (e.key === 'Enter') {
        if (this.selectedIndex < this.profiles.length) {
          this.selectProfile(this.profiles[this.selectedIndex]);
        } else {
          this.inputMode = 'create';
          this.newName = '';
        }
      } else if (e.key === 'Delete' && this.selectedIndex < this.profiles.length) {
        const name = this.profiles[this.selectedIndex].name;
        deleteProfile(name);
        this.profiles = loadProfiles();
        this.selectedIndex = Math.min(this.selectedIndex, this.profiles.length);
      }
      this.render();
    };

    const clickHandler = (e: MouseEvent) => {
      if (this.resolved) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const area of this.hitAreas) {
        if (mx >= area.x && mx <= area.x + area.w && my >= area.y && my <= area.y + area.h) {
          if (area.action === 'profile' && area.idx !== undefined) {
            this.selectedIndex = area.idx;
            this.selectProfile(this.profiles[area.idx]);
          } else if (area.action === 'create') {
            this.inputMode = 'create';
            this.newName = '';
            this.render();
          } else if (area.action === 'delete' && area.idx !== undefined) {
            deleteProfile(this.profiles[area.idx].name);
            this.profiles = loadProfiles();
            this.selectedIndex = Math.min(this.selectedIndex, this.profiles.length);
            this.render();
          } else if (area.action === 'confirm_create') {
            if (this.newName.trim().length > 0) {
              this.createAndSelect(this.newName.trim());
            }
          } else if (area.action === 'cancel_create') {
            this.inputMode = 'select';
            this.newName = '';
            this.render();
          }
          return;
        }
      }
    };

    const moveHandler = (e: MouseEvent) => {
      if (this.resolved || this.inputMode !== 'select') return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const area of this.hitAreas) {
        if ((area.action === 'profile' || area.action === 'create') &&
          mx >= area.x && mx <= area.x + area.w && my >= area.y && my <= area.y + area.h) {
          if (area.idx !== undefined) this.selectedIndex = area.idx;
          else this.selectedIndex = this.profiles.length; // "新建"选项
          this.render();
          return;
        }
      }
    };

    window.addEventListener('keydown', keyHandler);
    this.canvas.addEventListener('click', clickHandler);
    this.canvas.addEventListener('mousemove', moveHandler);
    // 主题切换后重绘
    const themeHandler = () => { if (!this.resolved) this.render(); };
    themeBus.addEventListener('change', themeHandler);

    const interval = setInterval(() => {
      if (this.resolved) {
        window.removeEventListener('keydown', keyHandler);
        this.canvas.removeEventListener('click', clickHandler);
        this.canvas.removeEventListener('mousemove', moveHandler);
        themeBus.removeEventListener('change', themeHandler);
        clearInterval(interval);
      }
    }, 500);
  }

  private selectProfile(profile: SaveProfile): void {
    setActiveProfileName(profile.name);
    this.resolved = true;
    this.onLogin(profile);
  }

  private createAndSelect(name: string): void {
    // 重名检查
    if (this.profiles.some(p => p.name === name)) {
      this.newName = '';
      return;
    }
    const profile = createProfile(name);
    saveProfile(profile);
    this.profiles = loadProfiles();
    this.inputMode = 'select';
    this.selectProfile(profile);
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    this.hitAreas = [];

    // 背景
    ctx.fillStyle = COLORS.bg.pure;
    ctx.fillRect(0, 0, w, h);

    // 星空点缀
    for (let i = 0; i < 60; i++) {
      const sx = Math.sin(i * 7.3) * 0.5 + 0.5;
      const sy = Math.sin(i * 13.1) * 0.5 + 0.5;
      ctx.fillStyle = withAlpha(COLORS.text.primary, 0.1 + Math.sin(i) * 0.2);
      ctx.fillRect(sx * w, sy * h, 1.5, 1.5);
    }

    const cx = w / 2;

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 20;
    ctx.shadowColor = COLORS.accent.cyan;
    ctx.fillStyle = COLORS.accent.cyan;
    ctx.font = 'bold 36px monospace';
    ctx.fillText('星 域 节 点', cx, h * 0.18);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.text.disabled;
    ctx.font = FONT.sm;
    ctx.fillText('STARFIELD NODES', cx, h * 0.24);

    // 输入模式
    if (this.inputMode === 'create') {
      ctx.fillStyle = COLORS.accent.purple;
      ctx.font = FONT.base;
      ctx.fillText('输入玩家名称:', cx, h * 0.38);

      ctx.strokeStyle = COLORS.accent.purple;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 120, h * 0.42, 240, 32);
      ctx.fillStyle = COLORS.text.primary;
      ctx.font = FONT.lg;
      ctx.fillText(this.newName + '▌', cx, h * 0.42 + 16);

      // 确认按钮
      const btnY = h * 0.48 + 8;
      const confirmX = cx - 120;
      const cancelX = cx + 10;
      const btnW = 110;
      const btnH = 30;

      const hasName = this.newName.trim().length > 0;
      ctx.fillStyle = hasName ? withAlpha(COLORS.accent.purple, 0.2) : 'rgba(50,50,50,0.2)';
      ctx.strokeStyle = hasName ? COLORS.accent.purple : COLORS.text.border;
      ctx.fillRect(confirmX, btnY, btnW, btnH);
      ctx.strokeRect(confirmX, btnY, btnW, btnH);
      ctx.fillStyle = hasName ? COLORS.accent.purple : COLORS.text.border;
      ctx.font = '13px monospace';
      ctx.fillText('确认', confirmX + btnW / 2, btnY + btnH / 2);
      this.hitAreas.push({ action: 'confirm_create', x: confirmX, y: btnY, w: btnW, h: btnH });

      ctx.fillStyle = 'rgba(100,100,100,0.2)';
      ctx.strokeStyle = COLORS.text.faint;
      ctx.fillRect(cancelX, btnY, btnW, btnH);
      ctx.strokeRect(cancelX, btnY, btnW, btnH);
      ctx.fillStyle = COLORS.text.muted;
      ctx.fillText('取消', cancelX + btnW / 2, btnY + btnH / 2);
      this.hitAreas.push({ action: 'cancel_create', x: cancelX, y: btnY, w: btnW, h: btnH });

      ctx.fillStyle = COLORS.text.faint;
      ctx.font = '11px monospace';
      ctx.fillText('键盘输入名称 · [Enter] 确认 · [Esc] 取消', cx, h * 0.56);

      ctx.restore();
      return;
    }

    // 档案列表
    ctx.fillStyle = COLORS.text.muted;
    ctx.font = '13px monospace';
    ctx.fillText('⟨ 选择或创建玩家档案 ⟩', cx, h * 0.33);

    const listStartY = h * 0.40;
    const itemH = 60;

    for (let i = 0; i <= this.profiles.length; i++) {
      const iy = listStartY + i * itemH;
      const selected = i === this.selectedIndex;

      if (i < this.profiles.length) {
        const p = this.profiles[i];
        // 档案卡片
        ctx.fillStyle = selected ? withAlpha(COLORS.accent.cyan, 0.1) : COLORS.bg.panelDim;
        ctx.strokeStyle = selected ? COLORS.accent.cyan : COLORS.text.borderFaint;
        ctx.lineWidth = 1;
        ctx.fillRect(cx - 200, iy, 400, 48);
        ctx.strokeRect(cx - 200, iy, 400, 48);
        this.hitAreas.push({ action: 'profile', x: cx - 200, y: iy, w: 360, h: 48, idx: i });

        ctx.textAlign = 'left';
        ctx.fillStyle = selected ? COLORS.accent.cyan : COLORS.text.body;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(p.name, cx - 180, iy + 18);

        ctx.fillStyle = COLORS.text.faint;
        ctx.font = '11px monospace';
        ctx.fillText(
          `最高分: ${p.stats.highScore}  最高波次: ${p.stats.highWave}  游戏次数: ${p.stats.totalGamesPlayed}`,
          cx - 180, iy + 36
        );

        // 删除按钮（始终显示，选中时高亮）
        const delX = cx + 162;
        const delY = iy + 8;
        const delW = 32;
        const delH = 32;
        ctx.fillStyle = selected ? withAlpha(COLORS.accent.redSoft, 0.15) : 'rgba(50,50,50,0.3)';
        ctx.strokeStyle = selected ? COLORS.accent.redSoft : COLORS.text.border;
        ctx.fillRect(delX, delY, delW, delH);
        ctx.strokeRect(delX, delY, delW, delH);
        ctx.textAlign = 'center';
        ctx.fillStyle = selected ? COLORS.accent.redSoft : COLORS.text.disabled;
        ctx.font = FONT.sm;
        ctx.fillText('✕', delX + delW / 2, delY + delH / 2);
        this.hitAreas.push({ action: 'delete', x: delX, y: delY, w: delW, h: delH, idx: i });
      } else {
        // "新建档案" 选项
        ctx.fillStyle = selected ? withAlpha(COLORS.accent.purple, 0.15) : 'rgba(20,20,40,0.6)';
        ctx.strokeStyle = selected ? COLORS.accent.purple : COLORS.text.borderFaint;
        ctx.lineWidth = 1;
        ctx.fillRect(cx - 200, iy, 400, 48);
        ctx.strokeRect(cx - 200, iy, 400, 48);
        this.hitAreas.push({ action: 'create', x: cx - 200, y: iy, w: 400, h: 48 });

        ctx.textAlign = 'center';
        ctx.fillStyle = selected ? COLORS.accent.purple : COLORS.text.faint;
        ctx.font = FONT.sm;
        ctx.fillText('+ 新建玩家档案', cx, iy + 26);
      }
    }

    // 底部提示
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text.border;
    ctx.font = '11px monospace';
    ctx.fillText('点击选择 · [↑↓] 导航 · [Del] 删除 · [Shift+T] 主题', cx, h * 0.92);

    // 右下角主题指示
    const theme = THEMES[getThemeName()];
    if (theme) {
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.text.faint;
      ctx.font = FONT.xs;
      ctx.fillText(`主题: ${theme.label}`, w - 16, h - 14);
    }

    ctx.restore();
  }
}
