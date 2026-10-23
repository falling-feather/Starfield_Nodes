import type { GameState, VisibilityState } from './types';

/** Exploration-memory mask; tactical visibility is owned by visibility.ts. */
export class FogOfWar {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private revision = -1;
  private model?: VisibilityState;
  private softened: OffscreenCanvas;
  enabled = true;
  constructor(width: number, height: number) {
    this.canvas = new OffscreenCanvas(Math.ceil(width / 6), Math.ceil(height / 6));
    this.ctx = this.canvas.getContext('2d')!;
    this.softened = new OffscreenCanvas(this.canvas.width, this.canvas.height);
  }
  renderFog(ctx: CanvasRenderingContext2D, state: GameState): void {
    if (!this.enabled) return;
    const v = state.visibility;
    if (this.model !== v || this.revision !== v.revision) {
      const f = this.ctx,
        scale = this.canvas.width / state.worldWidth;
      f.globalCompositeOperation = 'source-over';
      f.clearRect(0, 0, this.canvas.width, this.canvas.height);
      f.fillStyle = 'rgba(2,8,17,0.96)';
      f.fillRect(0, 0, this.canvas.width, this.canvas.height);
      f.globalCompositeOperation = 'destination-out';
      f.fillStyle = 'rgba(0,0,0,0.42)';
      for (let y = 0; y < v.rows; y++)
        for (let x = 0; x < v.cols; x++) {
          if (v.explored[y * v.cols + x])
            f.fillRect(
              x * v.cellSize * scale,
              y * v.cellSize * scale,
              v.cellSize * scale + 0.5,
              v.cellSize * scale + 0.5,
            );
        }
      for (const source of v.sources) {
        const x = source.x * scale,
          y = source.y * scale,
          r = source.radius * scale;
        const g = f.createRadialGradient(x, y, r * 0.7, x, y, r * 1.06);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = g;
        f.beginPath();
        f.arc(x, y, r * 1.06, 0, Math.PI * 2);
        f.fill();
      }
      f.globalCompositeOperation = 'source-over';
      const soft = this.softened.getContext('2d')!;
      soft.clearRect(0, 0, this.softened.width, this.softened.height);
      soft.filter = 'blur(3px)';
      soft.drawImage(this.canvas, 0, 0);
      this.revision = v.revision;
      this.model = v;
    }
    const cam = state.camera,
      left = Math.max(0, cam.x),
      top = Math.max(0, cam.y);
    const width = Math.min(state.worldWidth - left, state.canvasWidth / cam.zoom),
      height = Math.min(state.worldHeight - top, state.canvasHeight / cam.zoom);
    if (width > 0 && height > 0)
      ctx.drawImage(
        this.softened,
        (left / state.worldWidth) * this.softened.width,
        (top / state.worldHeight) * this.softened.height,
        (width / state.worldWidth) * this.softened.width,
        (height / state.worldHeight) * this.softened.height,
        left,
        top,
        width,
        height,
      );
  }
  resize(width: number, height: number): void {
    this.canvas.width = Math.ceil(width / 6);
    this.canvas.height = Math.ceil(height / 6);
    this.softened.width = this.canvas.width;
    this.softened.height = this.canvas.height;
    this.revision = -1;
  }
}
