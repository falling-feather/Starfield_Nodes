import { drawEnemyFleet } from './fleet-art';
import { drawRockMass } from './terrain-art';
import { drawWorldFacility, drawFrontierSites } from './world-facilities';
import { FACILITY_ART } from './data/facility-art';
import { ENEMY_SUPPORT } from './data/spawn';
import { COMBAT } from './data/balance';
import { enemyRoute } from './navigation';
import { UI_FONT, MONO_FONT, minimapRect } from './canvas-ui';
import { canDetectEnemy, isPositionExplored } from './visibility';
// ===== Canvas 渲染引擎 =====
import type { GameState, GameNode, Camera, TerrainZone, TerrainPolygon } from './types';
import type { PolygonEditor } from './polygon-editor';
import {
  MAX_EDGE_LENGTH,
  TERRITORY_RADIUS,
  EXPANDED_TERRITORY_RADIUS,
  TICK_INTERVAL,
} from './data/runtime';
import { EDGE_CONFIGS } from './data/edges';
import { dist, isOvercharged, radarField } from './graph';
import { FogOfWar } from './fog';
import { COLORS } from './ui-tokens';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private time: number = 0;
  private starField: { x: number; y: number; size: number; brightness: number }[] = [];
  private shakeIntensity: number = 0;
  private nodeIndex = new Map<string, GameNode>();
  private terrainTextures = new Map<string, OffscreenCanvas>();
  private atlas: HTMLImageElement;
  maxEdgeLength: number = MAX_EDGE_LENGTH;
  rangeMultiplier = 1;
  fog: FogOfWar;

  constructor(canvas: HTMLCanvasElement, worldWidth: number, worldHeight: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.fog = new FogOfWar(worldWidth, worldHeight);
    this.generateStarField();
    this.atlas = new Image();
    this.atlas.src = `${import.meta.env.BASE_URL}art/stellar-atlas.webp`;
  }

  private generateStarField(): void {
    this.starField = [];
    for (let i = 0; i < 110; i++) {
      this.starField.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.2 + Math.random() * 0.5,
      });
    }
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.scale(dpr, dpr);
  }

  render(state: GameState, dt: number): void {
    this.time = state.elapsedSeconds;
    this.nodeIndex.clear();
    for (const node of state.nodes) this.nodeIndex.set(node.id, node);
    const ctx = this.ctx;
    const w = state.canvasWidth;
    const h = state.canvasHeight;
    const cam = state.camera;

    // 屏幕震动（核心受攻击时 + 外部触发）
    const core = state.nodes.find((n) => n.type === 'core');
    if (core && core.hitFlash > 0.1 && core.hp < core.maxHp && !state.paused) {
      this.shakeIntensity = Math.max(this.shakeIntensity, Math.min(2.4, core.hitFlash * 2));
    }
    // 合并外部震动（节点摧毁等）
    if (state.screenShake > 0) {
      this.shakeIntensity = Math.max(this.shakeIntensity, state.screenShake);
      state.screenShake = 0;
    }
    this.shakeIntensity *= Math.pow(0.01, dt * Math.max(1, state.timeScale));
    if (state.paused || state.gameOver || state.levelWon) this.shakeIntensity = 0;

    ctx.save();
    if (this.shakeIntensity > 0.5) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(sx, sy);
    }

    // 清空画布
    ctx.fillStyle = '#06111e';
    ctx.fillRect(-5, -5, w + 10, h + 10);

    if (this.atlas.complete && this.atlas.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.drawImage(this.atlas, 0, 0, w, h);
      ctx.restore();
    }
    const accent = state.mission?.accent ?? '#8de0d4';
    const atmosphere = ctx.createRadialGradient(
      w * 0.78,
      h * 0.28,
      0,
      w * 0.65,
      h * 0.5,
      Math.max(w, h) * 0.8,
    );
    atmosphere.addColorStop(0, this.withAlpha(accent, 0.065));
    atmosphere.addColorStop(1, this.withAlpha(accent, 0));
    ctx.fillStyle = atmosphere;
    ctx.fillRect(-5, -5, w + 10, h + 10);
    this.drawStarField(w, h, cam);

    // === 进入世界空间 ===
    ctx.save();
    ctx.translate(-cam.x * cam.zoom, -cam.y * cam.zoom);
    ctx.scale(cam.zoom, cam.zoom);

    // 绘制网格
    this.drawGrid(state);

    // 绘制地形
    this.drawTerrain(state);

    // 绘制核心领地
    this.drawTerritories(state);

    // 绘制连线
    this.drawEdges(state);

    // 绘制特斯拉电弧
    this.drawTeslaArcs(state);

    // 绘制维修站治疗光环
    this.drawRepairAuras(state);

    // 绘制狙击手射程指示

    // 绘制缓冲器增幅光环
    this.drawBufferAuras(state);

    // V1.4.2 跨虫洞虚拟连线（在 buffer aura 之后画，覆盖在其上面）
    this.drawCrossWormholeFx(state);

    // 绘制采集器收集特效
    this.drawCollectorFields(state);

    // 绘制拦截器防御场
    this.drawInterceptorFields(state);

    // 绘制雷达扫描效果
    this.drawRadarSweeps(state);

    // 绘制传送门漩涡效果
    this.drawPortalVortex(state);

    // 绘制黑洞引力场效果
    this.drawBlackholeFields(state);

    // 绘制回声塔连线波纹
    this.drawEchoWaves(state);

    // 绘制毒雾区域效果
    this.drawToxinClouds(state);

    // 绘制电弧链闪电效果
    this.drawStrikeEffects(state);

    // 绘制自爆充能光效
    this.drawKamikazeCharge(state);

    // 绘制流动粒子
    this.drawFlowParticles(state);

    // 绘制节点
    const margin = 120;
    for (const node of state.nodes) {
      if (
        node.x < cam.x - margin ||
        node.y < cam.y - margin ||
        node.x > cam.x + w / cam.zoom + margin ||
        node.y > cam.y + h / cam.zoom + margin
      )
        continue;
      if (node.owner === 'neutral' && !isPositionExplored(state, node.x, node.y)) continue;
      this.drawNode(node, state);
    }

    // 绘制敌人
    this.drawHealerAuras(state);
    this.drawEnemyPaths(state);
    this.drawEnemies(state);

    // 绘制飞弹
    this.drawProjectiles(state);

    // 绘制通用粒子
    this.drawParticles(state);

    // 绘制拖拽连线预览
    if (state.draggingFrom) {
      this.drawDragLine(state);
    }

    // 绘制选中高亮
    if (state.selectedNodeId) {
      const sel = state.nodes.find((n) => n.id === state.selectedNodeId);
      if (sel) this.drawSelectionRing(sel);
    }

    // 绘制批量选中高亮
    if (state.selectedNodeIds.length > 0) {
      for (const id of state.selectedNodeIds) {
        const node = state.nodes.find((n) => n.id === id);
        if (node) this.drawBatchSelectionRing(node);
      }
    }

    // 天气星云
    this.drawWeatherClouds(state);

    // 战争迷雾（在世界空间内绘制）
    this.fog.renderFog(ctx, state);
    drawFrontierSites(ctx,state);
    this.drawMissionSignals(state);

    ctx.restore(); // 退出世界空间

    // === 屏幕空间 UI ===
    // 迷你地图
    this.drawMinimap(state);

    ctx.restore(); // 结束震动偏移
  }

  private drawMissionSignals(state: GameState): void {
    const ctx = this.ctx,
      cam = state.camera;
    const objective = state.mission?.secondaryObjective;
    const signals = [...(state.mission?.entryPoints ?? [])];
    if (objective?.kind === 'observatory')
      signals.push({ ...objective.position, label: '远端观测点' });
    for (const entry of signals) {
      const active =
        state.wave >= (entry.fromWave ?? 1) && state.wave <= (entry.untilWave ?? Infinity);
      if (!active) continue;
      const wx = entry.x * state.worldWidth,
        wy = entry.y * state.worldHeight,
        sx = (wx - cam.x) * cam.zoom,
        sy = (wy - cam.y) * cam.zoom;
      const x = Math.max(70, Math.min(state.canvasWidth - 80, sx));
      let y = Math.max(225, Math.min(state.canvasHeight - 190, sy));
      // Keep boundary signals clear of the objective and optional boss panels.
      if (x < 360) y = Math.max(350, y);
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(1 / cam.zoom, 1 / cam.zoom);
      // Convert back to screen coordinates within the world transform.
      ctx.translate(x, y);
      ctx.strokeStyle = '#d8a18499';
      ctx.fillStyle = '#d8aa8c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + Math.sin(this.time * 2) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `10px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(entry.label, 0, 25);
      ctx.restore();
    }
  }

  private drawStarField(w: number, h: number, cam: Camera): void {
    const ctx = this.ctx;
    for (const star of this.starField) {
      const flicker = star.brightness + Math.sin(this.time * 2 + star.x * 100) * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.1, flicker)})`;
      // 微弱视差效果
      const parallax = 0.1;
      const sx = (((star.x * w * 2 - cam.x * parallax) % w) + w) % w;
      const sy = (((star.y * h * 2 - cam.y * parallax) % h) + h) % h;
      ctx.fillRect(sx, sy, star.size, star.size);
    }
  }

  private drawGrid(state: GameState): void {
    const ctx = this.ctx,
      cam = state.camera,
      size = 80;
    const left = Math.max(0, Math.floor(cam.x / size) * size),
      top = Math.max(0, Math.floor(cam.y / size) * size);
    const right = Math.min(state.worldWidth, cam.x + state.canvasWidth / cam.zoom),
      bottom = Math.min(state.worldHeight, cam.y + state.canvasHeight / cam.zoom);
    ctx.strokeStyle = '#7ba5bd10';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = left; x <= right; x += size) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = top; y <= bottom; y += size) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  private drawTerritories(state: GameState): void {
    const ctx = this.ctx;
    const cores = state.nodes.filter((n) => n.type === 'core' && n.status !== 'destroyed');
    if (cores.length === 0) return;

    const colors = [
      'rgba(0,200,255,0.04)',
      'rgba(255,100,200,0.04)',
      'rgba(100,255,150,0.04)',
      'rgba(255,200,50,0.04)',
      'rgba(150,100,255,0.04)',
    ];

    for (let i = 0; i < cores.length; i++) {
      const c = cores[i];
      const r = c.expanded ? EXPANDED_TERRITORY_RADIUS : TERRITORY_RADIUS;
      const color = colors[i % colors.length];
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== 地形渲染 =====
  private drawTerrain(state: GameState): void {
    for (const zone of state.terrainZones) {
      switch (zone.type) {
        case 'nebula':
          this.drawNebula(zone);
          break;
        case 'asteroid':
          this.drawAsteroid(zone);
          break;
        case 'wormhole':
          this.drawWormhole(zone, state);
          break;
      }
    }
    // V1.3.0: 多边形地形
    const cam = state.camera,
      right = cam.x + state.canvasWidth / cam.zoom,
      bottom = cam.y + state.canvasHeight / cam.zoom;
    for (const poly of state.terrainPolygons) {
      if (
        poly.bbox.maxX < cam.x - 60 ||
        poly.bbox.minX > right + 60 ||
        poly.bbox.maxY < cam.y - 60 ||
        poly.bbox.minY > bottom + 60
      )
        continue;
      switch (poly.type) {
        case 'nebula':
          this.drawNebulaPolygon(poly);
          break;
        case 'asteroid':
          this.drawAsteroidPolygon(poly);
          break;
        case 'wormhole':
          this.drawWormholePolygon(poly, state);
          break;
      }
    }
  }

  /** 在 ctx 上追踪多边形路径 */
  private tracePolygon(poly: TerrainPolygon): void {
    const ctx = this.ctx;
    const v = poly.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
  }

  private drawNebulaPolygon(poly: TerrainPolygon): void {
    const ctx = this.ctx,
      b = poly.bbox,
      w = b.maxX - b.minX,
      h = b.maxY - b.minY;
    let texture = this.terrainTextures.get(poly.id);
    if (!texture) {
      const scale = Math.min(1, 900 / Math.max(w, h));
      texture = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
      const t = texture.getContext('2d')!;
      t.scale(scale, scale);
      t.translate(-b.minX, -b.minY);
      t.beginPath();
      poly.vertices.forEach((p, i) => (i ? t.lineTo(p.x, p.y) : t.moveTo(p.x, p.y)));
      t.closePath();
      t.clip();
      t.fillStyle = '#203c5333';
      t.fillRect(b.minX, b.minY, w, h);
      for (let i = 0; i < 12; i++) {
        const u = (Math.sin(i * 12.9898 + poly.centroid.x) * 43758.5453) % 1,
          v = (Math.sin(i * 7.173 + poly.centroid.y) * 15731.7) % 1;
        const x = b.minX + Math.abs(u) * w,
          y = b.minY + Math.abs(v) * h,
          r = Math.max(w, h) * (0.22 + (i % 4) * 0.06);
        const g = t.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(98,150,180,.14)');
        g.addColorStop(0.5, 'rgba(73,118,157,.08)');
        g.addColorStop(1, 'rgba(42,81,120,0)');
        t.fillStyle = g;
        t.fillRect(b.minX, b.minY, w, h);
      }
      this.terrainTextures.set(poly.id, texture);
    }
    ctx.save();
    ctx.drawImage(texture, b.minX, b.minY, w, h);
    ctx.strokeStyle = '#94b9db3d';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    this.tracePolygon(poly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#86a8c278';
    ctx.font = `11px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('星云 · 增幅与减速', poly.centroid.x, poly.centroid.y);
    ctx.restore();
  }

  private drawAsteroidPolygon(poly:TerrainPolygon):void {drawRockMass(this.ctx,poly);}

  private drawWormholePolygon(poly: TerrainPolygon, state: GameState): void {
    const ctx = this.ctx,
      c = poly.centroid,
      r = Math.min(poly.bbox.maxX - poly.bbox.minX, poly.bbox.maxY - poly.bbox.minY) * 0.42;
    const gates = state.terrainPolygons.filter((p) => p.type === 'wormhole'),
      index = gates.indexOf(poly);
    const active = state.nodes.some(
      (n) =>
        n.type === 'relay' &&
        n.connected &&
        n.currentEnergy >= n.activationThreshold &&
        Math.hypot(n.x - c.x, n.y - c.y) < r,
    );
    ctx.save();
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 1.5);
    g.addColorStop(0, '#020b17e8');
    g.addColorStop(0.48, active ? '#5cbcb84d' : '#52799f26');
    g.addColorStop(0.75, '#6db5cb18');
    g.addColorStop(1, '#6db5cb00');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - r * 1.5, c.y - r * 1.5, r * 3, r * 3);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(
        c.x,
        c.y,
        r * (0.35 + i * 0.13),
        r * (0.18 + i * 0.1),
        this.time * 0.13 + i * 0.25,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = active ? '#9de3d59c' : '#7eaec96b';
      ctx.lineWidth = i === 3 ? 2 : 1;
      ctx.stroke();
    }
    ctx.strokeStyle = '#8fc5d13b';
    ctx.setLineDash([3, 7]);
    this.tracePolygon(poly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = active ? '#b3e8df' : '#7fa5b9';
    ctx.font = `11px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `虫洞 ${String.fromCharCode(65 + index)} · ${active ? '上行接通' : '等待中继'}`,
      c.x,
      c.y + r + 24,
    );
    ctx.restore();
  }

  private drawNebula(zone: TerrainZone): void {
    const ctx = this.ctx;
    const r = zone.radius;
    const pulse = Math.sin(this.time * 0.5 + zone.x * 0.01) * 0.04 + 0.14;

    ctx.save();
    const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, r);
    grad.addColorStop(0, `rgba(100,50,180,${pulse})`);
    grad.addColorStop(0.4, `rgba(70,30,150,${pulse * 0.7})`);
    grad.addColorStop(0.7, `rgba(50,20,120,${pulse * 0.4})`);
    grad.addColorStop(1, 'rgba(40,15,100,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, r, 0, Math.PI * 2);
    ctx.fill();

    // 漂浮星尘点缀
    const seed = Math.floor(zone.x * 7 + zone.y * 13);
    for (let i = 0; i < 8; i++) {
      const angle =
        (((seed + i * 137.5) % 360) * Math.PI) / 180 + this.time * 0.1 * ((i % 2) * 2 - 1);
      const d = (((seed * (i + 1)) % 100) / 100) * r * 0.7;
      const sx = zone.x + Math.cos(angle) * d;
      const sy = zone.y + Math.sin(angle) * d;
      ctx.fillStyle = `rgba(180,120,255,${0.15 + Math.sin(this.time + i) * 0.08})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 标签
    ctx.fillStyle = 'rgba(150,100,220,0.35)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('星云区', zone.x, zone.y - r + 14);
    ctx.restore();
  }

  private drawAsteroid(zone: TerrainZone): void {
    const ctx = this.ctx;
    const r = zone.radius;

    ctx.save();
    // 暗色区域
    const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, r);
    grad.addColorStop(0, 'rgba(80,60,40,0.18)');
    grad.addColorStop(0.7, 'rgba(60,45,30,0.12)');
    grad.addColorStop(1, 'rgba(40,30,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, r, 0, Math.PI * 2);
    ctx.fill();

    // 边界虚线（危险指示）
    ctx.strokeStyle = 'rgba(255,100,50,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 小岩石碎片（确定性伪随机）
    const seed = Math.floor(zone.x * 7 + zone.y * 13);
    for (let i = 0; i < 14; i++) {
      const angle = (((seed + i * 137.5) % 360) * Math.PI) / 180;
      const d = (((seed * (i + 1) + i * 97) % 100) / 100) * r * 0.8;
      const rx = zone.x + Math.cos(angle) * d;
      const ry = zone.y + Math.sin(angle) * d;
      const size = 2 + ((seed + i * 31) % 4);

      ctx.fillStyle = `rgba(120,90,60,${0.25 + ((seed + i) % 3) * 0.08})`;
      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 + ((seed + i * 3) % 10) * 0.1;
        const rr = size * (0.6 + ((seed + i + j) % 4) * 0.15);
        const px = rx + Math.cos(a) * rr;
        const py = ry + Math.sin(a) * rr;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,100,50,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ 小行星带', zone.x, zone.y - r + 14);
    ctx.restore();
  }

  private drawWormhole(zone: TerrainZone, state: GameState): void {
    const ctx = this.ctx;
    const r = zone.radius;
    const rotAngle = this.time * 2;

    ctx.save();
    // 中心光晕
    const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, r);
    grad.addColorStop(0, 'rgba(0,200,255,0.25)');
    grad.addColorStop(0.5, 'rgba(100,0,200,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, r, 0, Math.PI * 2);
    ctx.fill();

    // 旋转环
    for (let ring = 3; ring >= 0; ring--) {
      const ringR = (r * (ring + 1)) / 4;
      const alpha = 0.25 - ring * 0.04;
      ctx.strokeStyle = `rgba(0,200,255,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, ringR, rotAngle + ring * 0.5, rotAngle + ring * 0.5 + Math.PI * 1.5);
      ctx.stroke();
    }

    // 配对连线（只绘制一次，id 较小的那端画连线）
    if (zone.linkedId && zone.id < zone.linkedId) {
      const linked = state.terrainZones.find((z) => z.id === zone.linkedId);
      if (linked) {
        ctx.strokeStyle = 'rgba(0,200,255,0.06)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 12]);
        ctx.beginPath();
        ctx.moveTo(zone.x, zone.y);
        ctx.lineTo(linked.x, linked.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 标签
    ctx.fillStyle = 'rgba(0,200,255,0.45)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('虫洞', zone.x, zone.y - r - 6);
    ctx.restore();
  }

  private drawEdges(state: GameState): void {
    const ctx = this.ctx,
      cam = state.camera;
    ctx.save();
    for (const edge of state.edges) {
      const a = this.nodeIndex.get(edge.sourceId),
        b = this.nodeIndex.get(edge.targetId);
      if (!a || !b || a.status === 'destroyed' || b.status === 'destroyed') continue;
      const right = cam.x + state.canvasWidth / cam.zoom,
        bottom = cam.y + state.canvasHeight / cam.zoom;
      if (
        (a.x < cam.x - 30 && b.x < cam.x - 30) ||
        (a.x > right + 30 && b.x > right + 30) ||
        (a.y < cam.y - 30 && b.y < cam.y - 30) ||
        (a.y > bottom + 30 && b.y > bottom + 30)
      )
        continue;
      const interrupted = edge.disruptedTimer > 0,
        powered = a.connected && b.connected,
        color = EDGE_CONFIGS[edge.type].color || '#8ed9cd';
      const flow = Math.min(1, Math.abs(edge.energyFlow) / edge.throughput),
        selected = state.selectedNodeId === a.id || state.selectedNodeId === b.id;
      ctx.lineWidth = edge.type === 'heavy' ? 3 : 1.5;
      ctx.strokeStyle = interrupted
        ? '#df9988'
        : powered
          ? this.withAlpha(color, 0.35 + flow * 0.5)
          : '#516c7a';
      ctx.setLineDash(interrupted ? [4, 7] : powered ? [] : [3, 6]);
      ctx.lineDashOffset = -this.time * (interrupted ? 12 : 4);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (flow > 0.02 && !interrupted) {
        ctx.strokeStyle = this.withAlpha(color, 0.08 + flow * 0.06);
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const count = 1 + Math.floor(flow * 2);
        for (let i = 0; i < count; i++) {
          let t =
            (this.time * (0.22 + flow * 0.36) * EDGE_CONFIGS[edge.type].flowSpeedMult + i / count) %
            1;
          if (edge.energyFlow < 0) t = 1 - t;
          ctx.fillStyle = this.withAlpha(color, 0.7);
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2 + flow, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2;
      if (interrupted) {
        ctx.fillStyle = '#e7ad97';
        ctx.font = `13px ${MONO_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('×', x, y - 6);
      } else if (selected) {
        ctx.fillStyle = '#081725e8';
        ctx.fillRect(x - 32, y - 20, 64, 17);
        ctx.fillStyle = flow > 0.85 ? '#e3c28b' : '#8bb5c0';
        ctx.font = `10px ${MONO_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${(Math.abs(edge.energyFlow)*1000/TICK_INTERVAL).toFixed(1)}/${edge.throughput*1000/TICK_INTERVAL}/s`, x, y - 8);
      }
    }
    ctx.restore();
  }

  private drawFlowParticles(state: GameState): void {
    const ctx = this.ctx;

    // Build edge and node maps for O(1) lookup
    const edgeMap = new Map(state.edges.map((e) => [e.id, e]));
    const nodeMap = this.nodeIndex;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const fp of state.flowParticles) {
      const edge = edgeMap.get(fp.edgeId);
      if (!edge) continue;
      const source = nodeMap.get(edge.sourceId);
      const target = nodeMap.get(edge.targetId);
      if (!source || !target) continue;

      const x = source.x + (target.x - source.x) * (fp.reverse ? 1 - fp.progress : fp.progress);
      const y = source.y + (target.y - source.y) * (fp.reverse ? 1 - fp.progress : fp.progress);

      const alpha = 1 - Math.abs(fp.progress - 0.5) * 2;
      // 光晕
      const grad = ctx.createRadialGradient(x, y, 0, x, y, fp.size * 2.5);
      grad.addColorStop(0, this.withAlpha(fp.color, alpha * 0.6));
      grad.addColorStop(0.6, this.withAlpha(fp.color, alpha * 0.15));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, fp.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
      // 核心
      ctx.fillStyle = this.withAlpha(fp.color, alpha * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, fp.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawNode(node: GameNode, state: GameState): void {
    drawWorldFacility(this.ctx,node,state,this.rangeMultiplier);
  }

  private drawSelectionRing(node: GameNode): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = COLORS.text.primary;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawBatchSelectionRing(node: GameNode): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = COLORS.accent.green;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = -this.time * 15;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** 治疗者绿色治疗光环 */
  private drawHealerAuras(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    for (const source of state.enemies) {
      if (
        !canDetectEnemy(state, source) ||
        (source.type !== 'healer' && source.type !== 'shielder')
      )
        continue;
      const healing = source.type === 'healer',
        radius = healing ? ENEMY_SUPPORT.healer.range : ENEMY_SUPPORT.shielder.range,
        color = healing ? '#92d2ad' : '#91bce0';
      const glow = ctx.createRadialGradient(source.x, source.y, 10, source.x, source.y, radius);
      glow.addColorStop(0, this.withAlpha(color, 0.08));
      glow.addColorStop(1, this.withAlpha(color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(source.x - radius, source.y - radius, radius * 2, radius * 2);
      ctx.strokeStyle = this.withAlpha(color, 0.25);
      ctx.lineWidth = 1;
      ctx.setLineDash(healing ? [2, 7] : [6, 5]);
      ctx.beginPath();
      ctx.arc(source.x, source.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (healing) {
        const phase =
          (state.elapsedSeconds / ((ENEMY_SUPPORT.healer.intervalTicks * TICK_INTERVAL) / 1000)) %
          1;
        ctx.strokeStyle = this.withAlpha(color, (1 - phase) * 0.4);
        ctx.beginPath();
        ctx.arc(source.x, source.y, 12 + phase * (radius - 12), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `500 13px ${UI_FONT}`;
      ctx.fillStyle = color;
      ctx.fillText(healing ? '＋' : '◇', source.x, source.y - radius * 0.2);
      for (const other of state.enemies) {
        if (
          other === source ||
          !canDetectEnemy(state, other) ||
          Math.hypot(other.x - source.x, other.y - source.y) > radius
        )
          continue;
        if (healing ? other.hp >= other.maxHp : other.damageReduction <= 0) continue;
        ctx.strokeStyle = this.withAlpha(color, 0.17);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** 绘制敌人路径预判线 */
  private drawEnemyPaths(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    for (const enemy of state.enemies) {
      if (!canDetectEnemy(state, enemy) || !enemy.targetNodeId) continue;
      const target = state.nodes.find((n) => n.id === enemy.targetNodeId);
      if (!target || target.status === 'destroyed') continue;

      const d = dist(enemy, target);
      // 只在一定距离内显示路径
      if (d > 600) continue;

      // 隐形敌人不显示路径
      if (enemy.type === 'stealth') continue;

      const alpha = Math.max(0.04, 0.15 - d * 0.0002);
      ctx.strokeStyle = `rgba(255,80,80,${alpha})`;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 8]);
      ctx.lineDashOffset = -this.time * 20;
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      for (const point of enemyRoute(enemy)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawEnemies(state:GameState):void {drawEnemyFleet(this.ctx,state);}

  private drawProjectiles(state: GameState): void {
    const ctx = this.ctx;
    for (const proj of state.projectiles) {
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = proj.color;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawParticles(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    // 叠加模式产生发光效果
    ctx.globalCompositeOperation = 'lighter';

    for (const p of state.particles) {
      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio * 0.8;
      const r = p.size * lifeRatio;

      // 外层光晕
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      grad.addColorStop(0, this.withAlpha(p.color, alpha * 0.5));
      grad.addColorStop(0.5, this.withAlpha(p.color, alpha * 0.15));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // 核心亮点
      ctx.fillStyle = this.withAlpha(p.color, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawDragLine(state: GameState): void {
    const source = state.nodes.find((n) => n.id === state.draggingFrom);
    if (!source) return;

    const ctx = this.ctx;
    const d = dist(source, { x: state.mouseX, y: state.mouseY });
    const valid = d <= this.maxEdgeLength;

    const ecfg = EDGE_CONFIGS[state.selectedEdgeType];
    const edgeColor = ecfg.color || '#00ffff';

    ctx.save();
    ctx.strokeStyle = valid ? this.withAlpha(edgeColor, 0.5) : 'rgba(255,0,0,0.5)';
    ctx.lineWidth = ecfg.lineWidth * 0.75;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(state.mouseX, state.mouseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 最大连线距离指示圆
    ctx.strokeStyle = 'rgba(0,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(source.x, source.y, this.maxEdgeLength, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // ===== 特斯拉电弧效果 =====
  private drawTeslaArcs(state: GameState): void {
    const ctx = this.ctx;
    const teslaNodes = this.effectNodes(state, 'tesla');
    if (teslaNodes.length === 0) return;

    const nodeMap = this.nodeIndex;

    for (const tesla of teslaNodes) {
      const teslaEdges = state.edges.filter(
        (e) => e.disruptedTimer <= 0 && (e.sourceId === tesla.id || e.targetId === tesla.id),
      );

      for (const edge of teslaEdges) {
        const otherId = edge.sourceId === tesla.id ? edge.targetId : edge.sourceId;
        const other = nodeMap.get(otherId);
        if (!other || other.status === 'destroyed') continue;

        // 绘制锯齿形电弧
        ctx.save();
        ctx.strokeStyle = `rgba(204,255,0,${0.3 + Math.random() * 0.4})`;
        ctx.lineWidth = 1 + Math.random();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ccff00';

        const segments = 8 + Math.floor(Math.random() * 4);
        ctx.beginPath();
        ctx.moveTo(tesla.x, tesla.y);

        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const mx = tesla.x + (other.x - tesla.x) * t;
          const my = tesla.y + (other.y - tesla.y) * t;
          // 电弧偏移
          const perpX = -(other.y - tesla.y);
          const perpY = other.x - tesla.x;
          const len = Math.sqrt(perpX * perpX + perpY * perpY);
          const offset = (Math.random() - 0.5) * 16;
          ctx.lineTo(mx + (perpX / len) * offset, my + (perpY / len) * offset);
        }
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ===== 维修站治疗光环 =====
  private drawRepairAuras(state: GameState): void {
    const ctx = this.ctx;
    const repairNodes = this.effectNodes(state, 'repair');
    if (repairNodes.length === 0) return;

    for (const repair of repairNodes) {
      const ev = repair.evolved;
      const range = isOvercharged(repair)
        ? ev
          ? COMBAT.repairPulse.range.e
          : COMBAT.repairPulse.range.n
        : ev
          ? COMBAT.repair.range.e
          : COMBAT.repair.range.n;
      if(state.selectedNodeId!==repair.id&&!state.nodes.some(n=>n.owner==='player'&&n.hp<n.maxHp&&n.status!=='destroyed'&&dist(n,repair)<=range))continue;
      const pulse = Math.sin(this.time * 2 + repair.pulsePhase) * 0.3 + 0.7;

      // 外圈治疗范围（虚线圈）
      ctx.save();
      ctx.strokeStyle = `rgba(68,255,136,${0.35 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.beginPath();
      ctx.arc(repair.x, repair.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 外层柔和光环
      const outerGrad = ctx.createRadialGradient(
        repair.x,
        repair.y,
        range * 0.5,
        repair.x,
        repair.y,
        range,
      );
      outerGrad.addColorStop(0, `rgba(68,255,136,${0.06 * pulse})`);
      outerGrad.addColorStop(1, 'rgba(68,255,136,0)');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(repair.x, repair.y, range, 0, Math.PI * 2);
      ctx.fill();

      // 内层渐变光环（更亮）
      const auraGrad = ctx.createRadialGradient(
        repair.x,
        repair.y,
        repair.radius * 0.5,
        repair.x,
        repair.y,
        range * 0.6,
      );
      auraGrad.addColorStop(0, `rgba(68,255,136,${0.18 * pulse})`);
      auraGrad.addColorStop(0.5, `rgba(68,255,136,${0.08 * pulse})`);
      auraGrad.addColorStop(1, 'rgba(68,255,136,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(repair.x, repair.y, range * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // 旋转十字标志（更醒目）
      ctx.strokeStyle = `rgba(68,255,136,${0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#44ff88';
      const rot = this.time * 0.8;
      const crossR = repair.radius + 10;
      for (let i = 0; i < 4; i++) {
        const a = rot + (i / 4) * Math.PI * 2;
        const inner = repair.radius + 3;
        ctx.beginPath();
        ctx.moveTo(repair.x + Math.cos(a) * inner, repair.y + Math.sin(a) * inner);
        ctx.lineTo(repair.x + Math.cos(a) * crossR, repair.y + Math.sin(a) * crossR);
        ctx.stroke();
      }

      // 浮动治疗粒子（更多、更亮）
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#44ff88';
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + this.time * 0.5;
        const dist = range * 0.35 + Math.sin(this.time * 3 + i * 1.2) * range * 0.25;
        const px = repair.x + Math.cos(angle) * dist;
        const py = repair.y + Math.sin(angle) * dist;
        const pAlpha = 0.5 + Math.sin(this.time * 4 + i) * 0.3;
        ctx.fillStyle = `rgba(68,255,136,${pAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 狙击手射程指示 =====
  // ===== 自爆充能光效 =====
  private drawKamikazeCharge(state: GameState): void {
    const ctx = this.ctx;
    const kamikazes = this.effectNodes(state, 'kamikaze');
    if (kamikazes.length === 0) return;

    for (const k of kamikazes) {
      const chargeRatio = k.currentEnergy / k.maxEnergy;
      if (chargeRatio < 0.1) continue;

      ctx.save();

      // 充能光环 — 随充能比例变红变亮
      const r = Math.floor(255);
      const g = Math.floor(255 * (1 - chargeRatio) * 0.7);
      const b = Math.floor(68 * (1 - chargeRatio));
      const alpha = 0.1 + chargeRatio * 0.3;
      const pulseSize = k.radius * (1.5 + chargeRatio * 2);

      const chargeGrad = ctx.createRadialGradient(k.x, k.y, k.radius * 0.5, k.x, k.y, pulseSize);
      chargeGrad.addColorStop(0, `rgba(${r},${g},${b},${alpha + 0.1})`);
      chargeGrad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.5})`);
      chargeGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = chargeGrad;
      ctx.beginPath();
      ctx.arc(k.x, k.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // 临界闪烁（>80%充能）
      if (chargeRatio > 0.8) {
        const flash = 0.3 + 0.3 * Math.sin(this.time * 10);
        ctx.strokeStyle = `rgba(255,50,50,${flash})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff3333';
        ctx.beginPath();
        ctx.arc(k.x, k.y, k.radius * 2, 0, Math.PI * 2);
        ctx.stroke();

        // 警告爆炸环
        const warnR = k.evolved ? 250 : 150;
        ctx.strokeStyle = `rgba(255,68,68,${flash * 0.3})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(k.x, k.y, warnR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 电弧链闪电效果 =====
  private effectNodes(state: GameState, type: GameNode['type']): GameNode[] {
    return state.nodes.filter(
      (node) =>
        node.type === type &&
        node.owner === 'player' &&
        node.status !== 'destroyed' &&
        node.currentEnergy >= node.activationThreshold,
    );
  }

  private drawStrikeEffects(state: GameState): void {
    const ctx = this.ctx;
    for (const strike of state.strikeEffects) {
      ctx.save();
      if(strike.kind==='drone'){
        const a=strike.points[0],b=strike.points[strike.points.length-1],t=1-strike.life/strike.maxLife;
        const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        ctx.translate(x,y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.globalAlpha=Math.min(1,strike.life*10);
        ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-7,-6);ctx.lineTo(-3,0);ctx.lineTo(-7,6);ctx.closePath();ctx.fillStyle='#c8d8dd';ctx.fill();ctx.fillStyle=strike.color;ctx.fillRect(-8,-1,4,2);ctx.restore();continue;
      }
      ctx.globalAlpha = Math.max(0, strike.life / strike.maxLife);
      ctx.strokeStyle = strike.color;
      ctx.shadowColor = strike.color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = strike.kind === 'beam' ? 2 : 1.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const first = strike.points[0];
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < strike.points.length; i++) {
        const a = strike.points[i - 1],
          b = strike.points[i],
          dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.max(1, Math.hypot(dx, dy));
        if (strike.kind === 'arc')
          for (let j = 1; j < 5; j++) {
            const t = j / 5,
              jitter = Math.sin(this.time * 22 + i * 9 + j * 17) * Math.min(6, length * 0.035);
            ctx.lineTo(
              a.x + dx * t - (dy / length) * jitter,
              a.y + dy * t + (dx / length) * jitter,
            );
          }
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  // ===== 毒雾区域效果 =====
  private drawToxinClouds(state: GameState): void {
    const ctx = this.ctx;
    const toxins = this.effectNodes(state, 'toxin');
    if (toxins.length === 0) return;

    for (const toxin of toxins) {
      const ev = toxin.evolved;
      const range = isOvercharged(toxin)
        ? COMBAT.toxin.range.oc
        : ev
          ? COMBAT.toxin.range.e
          : COMBAT.toxin.range.n;

      ctx.save();

      // 毒雾渐变圆
      const fogGrad = ctx.createRadialGradient(
        toxin.x,
        toxin.y,
        toxin.radius,
        toxin.x,
        toxin.y,
        range,
      );
      fogGrad.addColorStop(0, 'rgba(102,204,68,0.15)');
      fogGrad.addColorStop(0.5, 'rgba(80,180,50,0.08)');
      fogGrad.addColorStop(1, 'rgba(102,204,68,0)');
      ctx.fillStyle = fogGrad;
      ctx.beginPath();
      ctx.arc(toxin.x, toxin.y, range, 0, Math.PI * 2);
      ctx.fill();

      // 漂浮毒气泡
      const bubbleCount = ev ? 8 : 5;
      for (let i = 0; i < bubbleCount; i++) {
        const angle = (i / bubbleCount) * Math.PI * 2 + this.time * 0.3;
        const r = range * (0.3 + 0.4 * Math.sin(this.time * 0.8 + i * 1.2));
        const bx = toxin.x + Math.cos(angle) * r;
        const by = toxin.y + Math.sin(angle) * r;
        const bSize = 3 + 2 * Math.sin(this.time * 2 + i);
        const alpha = 0.2 + 0.1 * Math.sin(this.time * 1.5 + i * 0.7);

        ctx.fillStyle = `rgba(102,204,68,${alpha})`;
        ctx.beginPath();
        ctx.arc(bx, by, bSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // 边界毒圈
      ctx.strokeStyle = `rgba(102,204,68,${0.15 + 0.05 * Math.sin(this.time * 2)})`;
      ctx.lineWidth = ev ? 2 : 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(toxin.x, toxin.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  // ===== 回声塔波纹效果 =====
  private drawEchoWaves(state: GameState): void {
    const ctx = this.ctx;
    const echos = this.effectNodes(state, 'echo');
    if (echos.length === 0) return;

    for (const echo of echos) {
      const ev = echo.evolved;

      ctx.save();

      // 找相邻节点并绘制回声波纹连线
      for (const edge of state.edges) {
        let neighborId: string | null = null;
        if (edge.sourceId === echo.id) neighborId = edge.targetId;
        else if (edge.targetId === echo.id) neighborId = edge.sourceId;
        if (!neighborId) continue;
        const neighbor = state.nodes.find((n) => n.id === neighborId);
        if (
          !neighbor ||
          neighbor.status === 'destroyed' ||
          neighbor.type === 'echo' ||
          neighbor.type === 'core'
        )
          continue;

        // 波纹沿连线从 echo 向 neighbor 扩散
        const dx = neighbor.x - echo.x;
        const dy = neighbor.y - echo.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) continue;

        // 脉冲点沿连线移动
        const pulseCount = ev ? 3 : 2;
        for (let p = 0; p < pulseCount; p++) {
          const t = (this.time * 1.2 + p / pulseCount) % 1;
          const px = echo.x + dx * t;
          const py = echo.y + dy * t;
          const alpha = 0.4 * (1 - Math.abs(t - 0.5) * 2);
          const size = ev ? 5 : 4;

          ctx.fillStyle = `rgba(136,221,204,${alpha})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#88ddcc';
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 中心脉冲环
      const pulseR = echo.radius * (1.5 + 0.5 * Math.sin(this.time * 4));
      ctx.strokeStyle = `rgba(136,221,204,${0.3 + 0.15 * Math.sin(this.time * 3)})`;
      ctx.lineWidth = ev ? 2 : 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#88ddcc';
      ctx.beginPath();
      ctx.arc(echo.x, echo.y, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 黑洞引力场效果 =====
  private drawBlackholeFields(state: GameState): void {
    const ctx = this.ctx;
    const bhs = this.effectNodes(state, 'blackhole');
    if (bhs.length === 0) return;

    for (const bh of bhs) {
      const ev = bh.evolved;
      const range = isOvercharged(bh)
        ? COMBAT.blackhole.range.oc
        : ev
          ? COMBAT.blackhole.range.e
          : COMBAT.blackhole.range.n;
      const crushRange = isOvercharged(bh)
        ? COMBAT.blackhole.crushRange.oc
        : ev
          ? COMBAT.blackhole.crushRange.e
          : COMBAT.blackhole.crushRange.n;

      ctx.save();

      // 外圈 — 暗紫扭曲引力场
      const outerGrad = ctx.createRadialGradient(bh.x, bh.y, crushRange, bh.x, bh.y, range);
      outerGrad.addColorStop(0, 'rgba(136,68,170,0.12)');
      outerGrad.addColorStop(1, 'rgba(136,68,170,0)');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, range, 0, Math.PI * 2);
      ctx.fill();

      // 吸积环 — 旋转的扭曲环
      const rings = ev ? 4 : 3;
      for (let i = 0; i < rings; i++) {
        const r = crushRange + (range - crushRange) * (i / rings);
        const rotation = this.time * (1.5 + i * 0.5) * (i % 2 === 0 ? 1 : -1);
        const alpha = 0.15 + 0.05 * Math.sin(this.time * 3 + i);
        ctx.strokeStyle = `rgba(160,80,200,${alpha})`;
        ctx.lineWidth = ev ? 1.5 : 1;
        ctx.beginPath();
        ctx.ellipse(bh.x, bh.y, r, r * 0.4, rotation, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 中心黑核 — 强烈暗色
      const coreGrad = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, crushRange);
      coreGrad.addColorStop(0, 'rgba(20,0,30,0.6)');
      coreGrad.addColorStop(0.6, 'rgba(80,30,120,0.3)');
      coreGrad.addColorStop(1, 'rgba(136,68,170,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, crushRange, 0, Math.PI * 2);
      ctx.fill();

      // 事件视界边缘高光
      ctx.strokeStyle = `rgba(200,120,255,${0.2 + 0.1 * Math.sin(this.time * 5)})`;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#aa66dd';
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, crushRange, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 传送门漩涡效果 =====
  private drawPortalVortex(state: GameState): void {
    const ctx = this.ctx;
    const portals = this.effectNodes(state, 'portal');
    if (portals.length === 0) return;

    for (const portal of portals) {
      const ev = portal.evolved;
      const range = isOvercharged(portal)
        ? COMBAT.portal.range.oc
        : ev
          ? COMBAT.portal.range.e
          : COMBAT.portal.range.n;

      ctx.save();

      // 范围圈 — 紫色虚线
      ctx.strokeStyle = 'rgba(204,136,255,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(portal.x, portal.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 漩涡旋转螺旋线
      const arms = ev ? 3 : 2;
      const spiralTime = this.time * 2;
      for (let a = 0; a < arms; a++) {
        const baseAngle = (a / arms) * Math.PI * 2 + spiralTime;
        ctx.strokeStyle = `rgba(204,136,255,${ev ? 0.4 : 0.3})`;
        ctx.lineWidth = ev ? 2 : 1.5;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#cc88ff';
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
          const r = t * range * 0.8;
          const angle = baseAngle + t * Math.PI * 2;
          const sx = portal.x + Math.cos(angle) * r;
          const sy = portal.y + Math.sin(angle) * r;
          if (t === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // 中心光晕
      const pulseAlpha = 0.15 + 0.1 * Math.sin(this.time * 4);
      const coreGrad = ctx.createRadialGradient(
        portal.x,
        portal.y,
        0,
        portal.x,
        portal.y,
        portal.radius * 2.5,
      );
      coreGrad.addColorStop(0, `rgba(204,136,255,${pulseAlpha + 0.15})`);
      coreGrad.addColorStop(0.5, `rgba(160,100,220,${pulseAlpha})`);
      coreGrad.addColorStop(1, 'rgba(204,136,255,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(portal.x, portal.y, portal.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 雷达扫描效果 =====
  private drawRadarSweeps(state: GameState): void {
    const ctx = this.ctx;
    const radars = this.effectNodes(state, 'radar');
    if (radars.length === 0) return;

    for (const radar of radars) {
      const range = radarField(state, radar).range;

      ctx.save();

      // 范围圈
      ctx.strokeStyle = 'rgba(170,221,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(radar.x, radar.y, range, 0, Math.PI * 2);
      ctx.stroke();

      // 旋转扫描扇形
      const sweepAngle = this.time * 1.5;
      const sweepWidth = Math.PI * 0.35;
      const sweepGrad = ctx.createRadialGradient(
        radar.x,
        radar.y,
        radar.radius,
        radar.x,
        radar.y,
        range,
      );
      sweepGrad.addColorStop(0, 'rgba(170,221,255,0.15)');
      sweepGrad.addColorStop(0.7, 'rgba(170,221,255,0.05)');
      sweepGrad.addColorStop(1, 'rgba(170,221,255,0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(radar.x, radar.y);
      ctx.arc(radar.x, radar.y, range, sweepAngle, sweepAngle + sweepWidth);
      ctx.closePath();
      ctx.fill();

      // 扫描线（扇形前沿亮线）
      ctx.strokeStyle = 'rgba(170,221,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#aaddff';
      ctx.beginPath();
      ctx.moveTo(radar.x, radar.y);
      ctx.lineTo(radar.x + Math.cos(sweepAngle) * range, radar.y + Math.sin(sweepAngle) * range);
      ctx.stroke();

      // 同心圆距离标记
      ctx.strokeStyle = 'rgba(170,221,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.shadowBlur = 0;
      for (let r = range * 0.33; r < range; r += range * 0.33) {
        ctx.beginPath();
        ctx.arc(radar.x, radar.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ===== 拦截器防御场 =====
  private drawInterceptorFields(state: GameState): void {
    const ctx = this.ctx;
    const interceptors = this.effectNodes(state, 'interceptor');
    if (interceptors.length === 0) return;

    for (const node of interceptors) {
      const ev = node.evolved;
      const range = ev ? COMBAT.interceptor.range.e : COMBAT.interceptor.range.n;
      const pulse = Math.sin(this.time * 3 + node.pulsePhase) * 0.2 + 0.8;

      ctx.save();

      // 防御范围（蓝色实线圈）
      ctx.strokeStyle = `rgba(102,170,255,${0.3 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, range, 0, Math.PI * 2);
      ctx.stroke();

      // 旋转防御弧线（3段）
      ctx.strokeStyle = `rgba(102,170,255,${0.45 * pulse})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#66aaff';
      const rot = this.time * 1.2;
      for (let i = 0; i < 3; i++) {
        const start = rot + (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, range - 3, start, start + Math.PI * 0.4);
        ctx.stroke();
      }

      // 内层淡蓝渐变
      const grad = ctx.createRadialGradient(
        node.x,
        node.y,
        node.radius,
        node.x,
        node.y,
        range * 0.6,
      );
      grad.addColorStop(0, `rgba(102,170,255,${0.08 * pulse})`);
      grad.addColorStop(1, 'rgba(102,170,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, range * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 采集器收集特效 =====
  private drawCollectorFields(state: GameState): void {
    const ctx = this.ctx;
    const collectors = this.effectNodes(state, 'collector');
    if (collectors.length === 0) return;

    for (const col of collectors) {
      const ev = col.evolved;
      const range = isOvercharged(col)
        ? COMBAT.collector.range.oc
        : ev
          ? COMBAT.collector.range.e
          : COMBAT.collector.range.n;
      const pulse = Math.sin(this.time * 2 + col.pulsePhase) * 0.2 + 0.8;

      ctx.save();

      // 范围圈（浅蓝虚线）
      ctx.strokeStyle = `rgba(136,221,255,${0.25 * pulse})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = this.time * 20; // 向内收缩动画
      ctx.beginPath();
      ctx.arc(col.x, col.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 内层吸引渐变
      const grad = ctx.createRadialGradient(col.x, col.y, col.radius, col.x, col.y, range * 0.5);
      grad.addColorStop(0, `rgba(136,221,255,${0.1 * pulse})`);
      grad.addColorStop(1, 'rgba(136,221,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(col.x, col.y, range * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // 向内飘动的资源粒子（菱形◆符号）
      ctx.shadowBlur = 3;
      ctx.shadowColor = '#88ddff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + this.time * 0.4;
        // 粒子从外圈向中心飘动
        const phase = (this.time * 0.8 + i * 0.5) % 1;
        const r = range * (1 - phase) * 0.8;
        const px = col.x + Math.cos(angle) * r;
        const py = col.y + Math.sin(angle) * r;
        const alpha = phase < 0.2 ? phase * 5 : phase > 0.8 ? (1 - phase) * 5 : 1;
        ctx.fillStyle = `rgba(136,221,255,${0.4 * alpha * pulse})`;
        ctx.fillText('◆', px, py);
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== V1.4.2 跨虫洞虚拟连线 =====
  private drawCrossWormholeFx(state: GameState): void {
    const fxList = state.crossWormholeFx;
    if (!fxList || fxList.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    for (const fx of fxList) {
      const alpha = Math.min(1, fx.ttl / 30);
      ctx.strokeStyle = fx.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = fx.kind === 'relay' ? 2.5 : 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.shadowBlur = 8;
      ctx.shadowColor = fx.color;
      ctx.beginPath();
      ctx.moveTo(fx.ax, fx.ay);
      ctx.lineTo(fx.bx, fx.by);
      ctx.stroke();
      // 端点光圈
      ctx.setLineDash([]);
      ctx.fillStyle = fx.color;
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath();
      ctx.arc(fx.ax, fx.ay, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx.bx, fx.by, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ===== 缓冲器增幅光环 =====
  private drawBufferAuras(state: GameState): void {
    const ctx = this.ctx;
    const bufferNodes = this.effectNodes(state, 'buffer');
    if (bufferNodes.length === 0) return;
    for (const buffer of bufferNodes) {
      const ev = buffer.evolved;
      const range = isOvercharged(buffer)
        ? ev
          ? COMBAT.bufferPulse.range.e
          : COMBAT.bufferPulse.range.n
        : ev
          ? COMBAT.buffer.range.e
          : COMBAT.buffer.range.n;
      const pulse = Math.sin(this.time * 2.5 + buffer.pulsePhase) * 0.25 + 0.75;

      ctx.save();

      // 范围圈（金色虚线）
      ctx.strokeStyle = `rgba(255,204,0,${0.3 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -this.time * 25;
      ctx.beginPath();
      ctx.arc(buffer.x, buffer.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 内层金色渐变
      const auraGrad = ctx.createRadialGradient(
        buffer.x,
        buffer.y,
        buffer.radius * 0.5,
        buffer.x,
        buffer.y,
        range * 0.65,
      );
      auraGrad.addColorStop(0, `rgba(255,204,0,${0.12 * pulse})`);
      auraGrad.addColorStop(0.6, `rgba(255,220,80,${0.05 * pulse})`);
      auraGrad.addColorStop(1, 'rgba(255,204,0,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(buffer.x, buffer.y, range * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // 向上飘动的能量箭头粒子
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ffcc00';
      ctx.fillStyle = `rgba(255,220,80,${0.5 * pulse})`;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + this.time * 0.3;
        const r = range * 0.3 + Math.sin(this.time * 2 + i * 1.5) * range * 0.15;
        const px = buffer.x + Math.cos(angle) * r;
        const py = buffer.y + Math.sin(angle) * r - Math.abs(Math.sin(this.time * 3 + i)) * 8;
        ctx.fillText('↑', px, py);
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 天气星云 =====
  private drawWeatherClouds(state: GameState): void {
    const ctx = this.ctx;
    for (const c of state.weatherClouds) {
      // 根据剩余寿命淡入/淡出
      const fadeIn = Math.min(1, c.life > 260 ? (300 - c.life) / 40 : 1);
      const fadeOut = Math.min(1, c.life / 40);
      const alpha = c.opacity * fadeIn * fadeOut;
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      // 绘制多层渐变圆形模拟星云
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
      grad.addColorStop(0, 'rgba(80, 40, 120, 0.6)');
      grad.addColorStop(0.4, 'rgba(60, 30, 100, 0.3)');
      grad.addColorStop(0.8, 'rgba(40, 20, 80, 0.1)');
      grad.addColorStop(1, 'rgba(20, 10, 40, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 迷你地图 =====
  private drawMinimap(state: GameState): void {
    const ctx = this.ctx;
    const cam = state.camera;
    const rect = minimapRect(
      state.canvasWidth,
      state.canvasHeight,
      state.worldWidth,
      state.worldHeight,
    );
    const mapW = rect.w,
      mapH = rect.h,
      mx = rect.x,
      my = rect.y;
    const scaleX = mapW / state.worldWidth;
    const scaleY = mapH / state.worldHeight;

    ctx.save();
    ctx.globalAlpha = 0.85;

    ctx.textAlign = 'right';
    ctx.fillStyle = '#a2bfce';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText('战术航图 · 点击定位', mx + mapW, my - 10);
    // 背景
    ctx.fillStyle = 'rgba(5,18,30,0.9)';
    ctx.strokeStyle = 'rgba(0,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mapW, mapH);
    ctx.strokeRect(mx, my, mapW, mapH);

    // 绘制地形区域
    for (const zone of state.terrainZones) {
      const zx = mx + zone.x * scaleX;
      const zy = my + zone.y * scaleY;
      const zr = zone.radius * Math.min(scaleX, scaleY);
      if (zone.type === 'nebula') {
        ctx.fillStyle = 'rgba(100,50,180,0.25)';
      } else if (zone.type === 'asteroid') {
        ctx.fillStyle = 'rgba(120,90,50,0.3)';
      } else {
        ctx.fillStyle = 'rgba(0,200,255,0.35)';
      }
      ctx.beginPath();
      ctx.arc(zx, zy, Math.max(zr, 2), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const poly of state.terrainPolygons) {
      ctx.fillStyle =
        poly.type === 'asteroid'
          ? 'rgba(171,163,135,.24)'
          : poly.type === 'nebula'
            ? 'rgba(103,145,191,.18)'
            : 'rgba(116,205,216,.3)';
      ctx.beginPath();
      poly.vertices.forEach((p, i) =>
        i
          ? ctx.lineTo(mx + p.x * scaleX, my + p.y * scaleY)
          : ctx.moveTo(mx + p.x * scaleX, my + p.y * scaleY),
      );
      ctx.closePath();
      ctx.fill();
    }
    for(const d of state.mission?.frontier?.deposits??[]){ctx.fillStyle=d.home?'#abaf8c':'#d8bd88';ctx.fillRect(mx+d.x*scaleX-2,my+d.y*scaleY-2,4,4);}
    for(const site of state.mission?.frontier?.stations??[]){
      const xx=mx+site.x*scaleX,yy=my+site.y*scaleY,done=(state.frontier?.progress[site.id]??0)>=site.seconds;
      ctx.beginPath();ctx.moveTo(xx,yy-4);ctx.lineTo(xx+4,yy);ctx.lineTo(xx,yy+4);ctx.lineTo(xx-4,yy);ctx.closePath();ctx.fillStyle=done?'#a4d5bd':'#a8c4e2';ctx.fill();
    }
    // 绘制连线
    ctx.strokeStyle = 'rgba(0,255,255,0.2)';
    ctx.lineWidth = 0.5;
    for (const edge of state.edges) {
      const s = state.nodes.find((n) => n.id === edge.sourceId);
      const t = state.nodes.find((n) => n.id === edge.targetId);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(mx + s.x * scaleX, my + s.y * scaleY);
      ctx.lineTo(mx + t.x * scaleX, my + t.y * scaleY);
      ctx.stroke();
    }

    // 绘制节点
    for (const node of state.nodes) {
      if (
        node.status === 'destroyed' ||
        (node.owner === 'neutral' && !isPositionExplored(state, node.x, node.y))
      )
        continue;
      ctx.fillStyle = node.owner === 'neutral' ? '#889aa8' : FACILITY_ART[node.type].color;
      ctx.beginPath();
      ctx.arc(
        mx + node.x * scaleX,
        my + node.y * scaleY,
        node.type === 'core' ? 3 : 1.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // 绘制敌人
    for (const enemy of state.enemies) {
      if (!canDetectEnemy(state, enemy)) continue;
      if (enemy.type === 'boss') {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(mx + enemy.x * scaleX, my + enemy.y * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'disruptor') {
        ctx.fillStyle = '#ff88ff';
        ctx.fillRect(mx + enemy.x * scaleX - 1.5, my + enemy.y * scaleY - 1.5, 3, 3);
      } else {
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(mx + enemy.x * scaleX - 1, my + enemy.y * scaleY - 1, 2, 2);
      }
    }

    // 视口矩形
    const left=Math.max(0,cam.x),top=Math.max(0,cam.y),right=Math.min(state.worldWidth,cam.x+state.canvasWidth/cam.zoom),bottom=Math.min(state.worldHeight,cam.y+state.canvasHeight/cam.zoom);
    const vpX = mx + left * scaleX;
    const vpY = my + top * scaleY;
    const vpW = Math.max(0,right-left)*scaleX;
    const vpH = Math.max(0,bottom-top)*scaleY;
    ctx.strokeStyle = COLORS.text.primary;
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX, vpY, vpW, vpH);

    ctx.restore();
  }

  // 辅助方法：给颜色加透明度
  private withAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * V1.3.2 dev-only：在世界空间内绘制多边形编辑器叠加层
   * 由 game.ts 在 renderer.render 之后调用（独立 save/restore + 摄像机变换）
   */
  drawPolygonEditorOverlay(state: GameState, editor: PolygonEditor): void {
    if (!editor.active) return;
    const ctx = this.ctx;
    const cam = state.camera;

    const typeColor: Record<string, string> = {
      nebula: '#7da6ff',
      asteroid: '#ff9b6b',
      wormhole: '#a8dcff',
    };

    ctx.save();
    ctx.translate(-cam.x * cam.zoom, -cam.y * cam.zoom);
    ctx.scale(cam.zoom, cam.zoom);

    // 1) 已闭合草稿：实线 + 半透明填充 + 序号标签
    editor.drafts.forEach((p, idx) => {
      const color = typeColor[p.type] ?? '#ffffff';
      ctx.beginPath();
      p.vertices.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = color + '33';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / cam.zoom;
      ctx.stroke();
      // 顶点点（被拖动的顶点高亮成绿色）
      for (let vi = 0; vi < p.vertices.length; vi++) {
        const [x, y] = p.vertices[vi];
        const isDrag =
          editor.dragTarget &&
          editor.dragTarget.draftIdx === idx &&
          editor.dragTarget.vertexIdx === vi;
        ctx.fillStyle = isDrag ? '#00ff88' : color;
        ctx.beginPath();
        ctx.arc(x, y, (isDrag ? 5 : 3) / cam.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      // 序号标签（质心）
      const cx = p.vertices.reduce((s, v) => s + v[0], 0) / p.vertices.length;
      const cy = p.vertices.reduce((s, v) => s + v[1], 0) / p.vertices.length;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${14 / cam.zoom}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${idx + 1} ${p.type}`, cx, cy);
    });

    // 2) 进行中顶点：虚线连接 + 红色顶点
    if (editor.pendingVertices.length > 0) {
      const color = typeColor[editor.currentType] ?? '#ffffff';
      ctx.save();
      ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.beginPath();
      editor.pendingVertices.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
      // 顶点
      for (let i = 0; i < editor.pendingVertices.length; i++) {
        const [x, y] = editor.pendingVertices[i];
        ctx.fillStyle = i === 0 ? '#ffeb3b' : '#ff5252';
        ctx.beginPath();
        ctx.arc(x, y, 4 / cam.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `${11 / cam.zoom}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, x, y - 10 / cam.zoom);
      }
    }

    ctx.restore();

    // 3) 屏幕空间提示横幅（顶部）
    ctx.save();
    const w = state.canvasWidth;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#7da6ff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `[多边形编辑器] 类型=${editor.currentType}  顶点=${editor.pendingVertices.length}  草稿=${editor.drafts.length}  ` +
        `| N/A/W=切类型  Click=加点/拖顶点  R-Click=删顶点  Enter=闭合  Backspace=撤销  Esc=清进行中  Ctrl+L=载入  Ctrl+S=导出  Ctrl+D=清空  Ctrl+E=退出`,
      8,
      14,
    );
    ctx.restore();
  }
}
