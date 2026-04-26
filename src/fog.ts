// ===== 战争迷雾系统 =====
import type { GameState } from './types';

/**
 * 战争迷雾 - 通过离屏 canvas 生成 alpha mask
 * 已激活的节点周围可见，其余区域被迷雾覆盖
 */
export class FogOfWar {
  private fogCanvas: OffscreenCanvas;
  private fogCtx: OffscreenCanvasRenderingContext2D;
  private revealRadius = 200;   // 节点视野半径
  private coreRevealRadius = 350; // 核心节点视野
  enabled = true;

  constructor(worldWidth: number, worldHeight: number) {
    // 使用较低分辨率以节省性能
    const scale = 0.25;
    const w = Math.max(1, Math.floor(worldWidth * scale));
    const h = Math.max(1, Math.floor(worldHeight * scale));
    this.fogCanvas = new OffscreenCanvas(w, h);
    this.fogCtx = this.fogCanvas.getContext('2d')!;
  }

  /** 在主渲染之后调用，绘制迷雾遮罩 */
  renderFog(ctx: CanvasRenderingContext2D, state: GameState): void {
    if (!this.enabled) return;

    const fctx = this.fogCtx;
    const fw = this.fogCanvas.width;
    const fh = this.fogCanvas.height;
    const scaleX = fw / state.worldWidth;
    const scaleY = fh / state.worldHeight;

    // 重置为全黑（不可见）
    fctx.fillStyle = 'rgba(0,0,0,1)';
    fctx.fillRect(0, 0, fw, fh);

    // 用 "destination-out" 在节点位置挖洞
    fctx.globalCompositeOperation = 'destination-out';

    for (const node of state.nodes) {
      if (node.status === 'destroyed') continue;

      let r = node.type === 'core'
        ? this.coreRevealRadius
        : node.type === 'beacon'
        ? 500 // 信标揭示超大范围迷雾
        : this.revealRadius;

      // 天气星云遮挡 — 节点在云中时视野缩小
      for (const c of state.weatherClouds) {
        const dx = node.x - c.x, dy = node.y - c.y;
        if (dx * dx + dy * dy < c.radius * c.radius) {
          r *= 0.65;
          break;
        }
      }

      const fx = node.x * scaleX;
      const fy = node.y * scaleY;
      const fr = r * scaleX;

      const grad = fctx.createRadialGradient(fx, fy, fr * 0.3, fx, fy, fr);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      fctx.fillStyle = grad;
      fctx.beginPath();
      fctx.arc(fx, fy, fr, 0, Math.PI * 2);
      fctx.fill();
    }

    fctx.globalCompositeOperation = 'source-over';

    // 将迷雾绘制到主画布（世界空间内）
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(
      this.fogCanvas,
      0, 0, fw, fh,
      0, 0, state.worldWidth, state.worldHeight
    );
    ctx.restore();
  }

  resize(worldWidth: number, worldHeight: number): void {
    const scale = 0.25;
    const w = Math.max(1, Math.floor(worldWidth * scale));
    const h = Math.max(1, Math.floor(worldHeight * scale));
    this.fogCanvas = new OffscreenCanvas(w, h);
    this.fogCtx = this.fogCanvas.getContext('2d')!;
  }
}
