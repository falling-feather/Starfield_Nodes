// ===== Canvas 渲染引擎 =====
import type { GameState, GameNode, NodeType, Camera, TerrainZone } from './types';
import { MAX_EDGE_LENGTH, TERRITORY_RADIUS, EXPANDED_TERRITORY_RADIUS } from './data/runtime';
import { NODE_CONFIGS } from './data/nodes';
import { EDGE_CONFIGS } from './data/edges';
import { ENEMY_COLORS } from './data/enemies';
import { dist, isOvercharged } from './graph';
import { FogOfWar } from './fog';
import { COLORS } from './ui-tokens';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private time: number = 0;
  private starField: { x: number; y: number; size: number; brightness: number }[] = [];
  private shakeIntensity: number = 0;
  fog: FogOfWar;

  constructor(canvas: HTMLCanvasElement, worldWidth: number, worldHeight: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.fog = new FogOfWar(worldWidth, worldHeight);
    this.generateStarField();
  }

  private generateStarField(): void {
    this.starField = [];
    for (let i = 0; i < 200; i++) {
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
    this.time += dt;
    const ctx = this.ctx;
    const w = state.canvasWidth;
    const h = state.canvasHeight;
    const cam = state.camera;

    // 屏幕震动（核心受攻击时 + 外部触发）
    const core = state.nodes.find(n => n.type === 'core');
    if (core && core.hp < core.maxHp) {
      this.shakeIntensity = Math.max(this.shakeIntensity, (1 - core.hp / core.maxHp) * 4);
    }
    // 合并外部震动（节点摧毁等）
    if (state.screenShake > 0) {
      this.shakeIntensity = Math.max(this.shakeIntensity, state.screenShake);
      state.screenShake = 0;
    }
    this.shakeIntensity *= 0.9;

    ctx.save();
    if (this.shakeIntensity > 0.5) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(sx, sy);
    }

    // 清空画布
    ctx.fillStyle = '#000000';
    ctx.fillRect(-5, -5, w + 10, h + 10);

    // 星空背景（屏幕空间，微弱视差）
    this.drawStarField(w, h, cam);

    // === 进入世界空间 ===
    ctx.save();
    ctx.translate(-cam.x * cam.zoom, -cam.y * cam.zoom);
    ctx.scale(cam.zoom, cam.zoom);

    // 绘制网格
    this.drawGrid(state.worldWidth, state.worldHeight);

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
    this.drawSniperScopes(state);

    // 绘制缓冲器增幅光环
    this.drawBufferAuras(state);

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
    this.drawArcChains(state);

    // 绘制自爆充能光效
    this.drawKamikazeCharge(state);

    // 绘制流动粒子
    this.drawFlowParticles(state);

    // 绘制节点
    for (const node of state.nodes) {
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
      const sel = state.nodes.find(n => n.id === state.selectedNodeId);
      if (sel) this.drawSelectionRing(sel);
    }

    // 绘制批量选中高亮
    if (state.selectedNodeIds.length > 0) {
      for (const id of state.selectedNodeIds) {
        const node = state.nodes.find(n => n.id === id);
        if (node) this.drawBatchSelectionRing(node);
      }
    }

    // 天气星云
    this.drawWeatherClouds(state);

    // 战争迷雾（在世界空间内绘制）
    this.fog.renderFog(ctx, state);

    ctx.restore(); // 退出世界空间

    // === 屏幕空间 UI ===
    // 迷你地图
    this.drawMinimap(state);

    ctx.restore(); // 结束震动偏移
  }

  private drawStarField(w: number, h: number, cam: Camera): void {
    const ctx = this.ctx;
    for (const star of this.starField) {
      const flicker = star.brightness + Math.sin(this.time * 2 + star.x * 100) * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.1, flicker)})`;
      // 微弱视差效果
      const parallax = 0.1;
      const sx = ((star.x * w * 2 - cam.x * parallax) % w + w) % w;
      const sy = ((star.y * h * 2 - cam.y * parallax) % h + h) % h;
      ctx.fillRect(sx, sy, star.size, star.size);
    }
  }

  private drawGrid(w: number, h: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0,255,255,0.03)';
    ctx.lineWidth = 0.5;
    const gridSize = 60;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  private drawTerritories(state: GameState): void {
    const ctx = this.ctx;
    const cores = state.nodes.filter(n => n.type === 'core' && n.status !== 'destroyed');
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
        case 'nebula': this.drawNebula(zone); break;
        case 'asteroid': this.drawAsteroid(zone); break;
        case 'wormhole': this.drawWormhole(zone, state); break;
      }
    }
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
      const angle = ((seed + i * 137.5) % 360) * Math.PI / 180 + this.time * 0.1 * ((i % 2) * 2 - 1);
      const d = ((seed * (i + 1)) % 100) / 100 * r * 0.7;
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
      const angle = ((seed + i * 137.5) % 360) * Math.PI / 180;
      const d = ((seed * (i + 1) + i * 97) % 100) / 100 * r * 0.8;
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
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
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
      const ringR = r * (ring + 1) / 4;
      const alpha = 0.25 - ring * 0.04;
      ctx.strokeStyle = `rgba(0,200,255,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, ringR, rotAngle + ring * 0.5, rotAngle + ring * 0.5 + Math.PI * 1.5);
      ctx.stroke();
    }

    // 配对连线（只绘制一次，id 较小的那端画连线）
    if (zone.linkedId && zone.id < zone.linkedId) {
      const linked = state.terrainZones.find(z => z.id === zone.linkedId);
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
    const ctx = this.ctx;

    for (const edge of state.edges) {
      const source = state.nodes.find(n => n.id === edge.sourceId);
      const target = state.nodes.find(n => n.id === edge.targetId);
      if (!source || !target) continue;

      const disrupted = edge.disruptedTimer > 0;
      const active = edge.active && !disrupted;
      const cfg = EDGE_CONFIGS[edge.type];

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      if (disrupted) {
        // 被干扰的边：红色闪烁虚线
        const flicker = Math.sin(this.time * 12) * 0.3 + 0.5;
        ctx.strokeStyle = `rgba(255,100,255,${flicker})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = -this.time * 40;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      const alpha = active ? 0.6 : 0.2;
      const lw = active ? cfg.lineWidth : 1;
      const flowSpeed = 30 * cfg.flowSpeedMult;

      // === 底层发光（仅活跃边） ===
      if (active) {
        ctx.save();
        const glowColor = cfg.color || source.glowColor;
        ctx.strokeStyle = this.withAlpha(glowColor, 0.12);
        ctx.lineWidth = lw + 6;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.restore();
      }

      // === 联动高亮：buffer ↔ collector 同方直连 ===
      if (active
        && source.owner === target.owner
        && source.owner !== 'neutral'
        && ((source.type === 'buffer' && target.type === 'collector')
          || (source.type === 'collector' && target.type === 'buffer'))) {
        ctx.save();
        const pulse = 0.45 + Math.sin(this.time * 4) * 0.15;
        ctx.strokeStyle = `rgba(255, 215, 96, ${pulse})`;
        ctx.lineWidth = lw + 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.restore();
      }

      // === 联动高亮：portal ↔ interceptor 同方直连 ===
      if (active
        && source.owner === target.owner
        && source.owner !== 'neutral'
        && ((source.type === 'portal' && target.type === 'interceptor')
          || (source.type === 'interceptor' && target.type === 'portal'))) {
        ctx.save();
        const pulse = 0.45 + Math.sin(this.time * 5 + 1) * 0.18;
        ctx.strokeStyle = `rgba(255, 170, 255, ${pulse})`;
        ctx.lineWidth = lw + 2;
        ctx.setLineDash([4, 3]);
        ctx.lineDashOffset = -this.time * 60;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // === 联动高亮：tesla ↔ relay 同方直连（电网中转） ===
      if (active
        && source.owner === target.owner
        && source.owner !== 'neutral'
        && ((source.type === 'tesla' && target.type === 'relay')
          || (source.type === 'relay' && target.type === 'tesla'))) {
        ctx.save();
        const pulse = 0.40 + Math.sin(this.time * 8 + 2) * 0.20;
        ctx.strokeStyle = `rgba(120, 220, 255, ${pulse})`;
        ctx.lineWidth = lw + 2;
        ctx.setLineDash([2, 4]);
        ctx.lineDashOffset = -this.time * 90;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (edge.type === 'amplify' && active) {
        // 增幅线：双线 + 金色脉冲
        const nx = -dy / len * 3; // 法线偏移
        const ny = dx / len * 3;

        ctx.strokeStyle = `rgba(204,102,255,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.lineDashOffset = -this.time * flowSpeed;

        ctx.beginPath();
        ctx.moveTo(source.x + nx, source.y + ny);
        ctx.lineTo(target.x + nx, target.y + ny);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(source.x - nx, source.y - ny);
        ctx.lineTo(target.x - nx, target.y - ny);
        ctx.stroke();
        ctx.setLineDash([]);

        // 金色脉冲点
        const pulse = (this.time * 1.5) % 1;
        const px = source.x + dx * pulse;
        const py = source.y + dy * pulse;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,${0.8 - pulse * 0.6})`;
        ctx.fill();
      } else {
        // 标准/高速/大容量线
        if (cfg.color && active) {
          ctx.strokeStyle = this.withAlpha(cfg.color, alpha);
        } else {
          const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
          if (active) {
            gradient.addColorStop(0, this.withAlpha(source.glowColor, alpha));
            gradient.addColorStop(1, this.withAlpha(target.glowColor, alpha));
          } else {
            gradient.addColorStop(0, `rgba(100,100,100,${alpha})`);
            gradient.addColorStop(1, `rgba(100,100,100,${alpha})`);
          }
          ctx.strokeStyle = gradient;
        }

        ctx.lineWidth = lw;

        if (active) {
          if (edge.type === 'fast') {
            ctx.setLineDash([3, 2, 8, 2]); // 快速三段
          } else if (edge.type === 'heavy') {
            ctx.setLineDash([12, 4]); // 粗长段
          } else {
            ctx.setLineDash([8, 4]);
          }
          ctx.lineDashOffset = -this.time * flowSpeed;
        } else {
          ctx.setLineDash([4, 8]);
          ctx.lineDashOffset = 0;
        }

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 能量脉冲点（活跃标准/高速/大容量边）
        if (active) {
          const pulseColor = cfg.color || source.glowColor;
          const pulseCount = edge.type === 'heavy' ? 2 : 1;
          for (let p = 0; p < pulseCount; p++) {
            const t = ((this.time * cfg.flowSpeedMult * 0.8) + p * 0.5) % 1;
            const px = source.x + dx * t;
            const py = source.y + dy * t;
            const dotSize = edge.type === 'heavy' ? 3 : 2;
            const dotAlpha = 0.7 - t * 0.5;
            ctx.beginPath();
            ctx.arc(px, py, dotSize, 0, Math.PI * 2);
            ctx.fillStyle = this.withAlpha(pulseColor, dotAlpha);
            ctx.fill();
          }
        }
      }

      // === 端点装饰（活跃边） ===
      if (active) {
        const dotColor = cfg.color || source.glowColor;
        ctx.fillStyle = this.withAlpha(dotColor, 0.5);
        ctx.beginPath();
        ctx.arc(source.x, source.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(target.x, target.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawFlowParticles(state: GameState): void {
    const ctx = this.ctx;

    // Build edge and node maps for O(1) lookup
    const edgeMap = new Map(state.edges.map(e => [e.id, e]));
    const nodeMap = new Map(state.nodes.map(n => [n.id, n]));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const fp of state.flowParticles) {
      const edge = edgeMap.get(fp.edgeId);
      if (!edge) continue;
      const source = nodeMap.get(edge.sourceId);
      const target = nodeMap.get(edge.targetId);
      if (!source || !target) continue;

      const x = source.x + (target.x - source.x) * fp.progress;
      const y = source.y + (target.y - source.y) * fp.progress;

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
    const ctx = this.ctx;
    const isDestroyed = node.status === 'destroyed';
    const pulse = Math.sin(this.time * 3 + node.pulsePhase) * 0.15 + 0.85;
    const energyRatio = node.currentEnergy / node.maxEnergy;
    const isActive = !isDestroyed && node.currentEnergy >= node.activationThreshold;

    ctx.save();

    if (isDestroyed) {
      // 残骸：暗淡的破碎圆环
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#222222';
      ctx.font = `${node.radius * 0.6}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', node.x, node.y);
      ctx.restore();
      return;
    }

    // 未连接节点降低透明度
    if (!node.connected) {
      ctx.globalAlpha = 0.45;
    }

    // 中立节点 — 灰蓝色调
    const isNeutral = node.owner === 'neutral';
    const nodeGlowColor = isNeutral ? '#6688aa' : node.glowColor;

    // 外层光晕
    const glowRadius = node.radius * (1.5 + pulse * 0.3);
    const glowGrad = ctx.createRadialGradient(
      node.x, node.y, node.radius * 0.5,
      node.x, node.y, glowRadius
    );
    const glowAlpha = isActive ? 0.3 * pulse : 0.1;
    glowGrad.addColorStop(0, this.withAlpha(nodeGlowColor, glowAlpha));
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 超载视觉效果
    const oc = isOvercharged(node);
    if (oc) {
      const ocPulse = Math.sin(this.time * 8 + node.pulsePhase) * 0.3 + 0.7;
      // 外层金色光环
      const ocRadius = node.radius * (2.0 + ocPulse * 0.5);
      const ocGrad = ctx.createRadialGradient(
        node.x, node.y, node.radius,
        node.x, node.y, ocRadius
      );
      ocGrad.addColorStop(0, `rgba(255,200,0,${0.4 * ocPulse})`);
      ocGrad.addColorStop(0.5, `rgba(255,255,255,${0.2 * ocPulse})`);
      ocGrad.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = ocGrad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, ocRadius, 0, Math.PI * 2);
      ctx.fill();

      // 旋转能量环
      ctx.strokeStyle = `rgba(255,220,100,${0.6 * ocPulse})`;
      ctx.lineWidth = 2;
      const rotAngle = this.time * 4;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 4, rotAngle, rotAngle + Math.PI * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 4, rotAngle + Math.PI, rotAngle + Math.PI + Math.PI * 1.2);
      ctx.stroke();
    }

    // 蓄力指示器（即将超载 - buildup > 0）
    if (!oc && node.overchargeBuildup > 0 && node.overchargeCooldown === 0) {
      const buildupRatio = node.overchargeBuildup / 3;
      ctx.strokeStyle = `rgba(255,200,0,${0.3 + buildupRatio * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * buildupRatio);
      ctx.stroke();
    }

    // 主体圆圈
    ctx.shadowBlur = isActive ? 15 : 6;
    ctx.shadowColor = nodeGlowColor;

    // 能量环
    ctx.strokeStyle = this.withAlpha(nodeGlowColor, isActive ? 0.8 : 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 等级外观 — 等级越高边框越复杂
    if (node.level >= 2 && !node.evolved) {
      const lvAlpha = Math.min(0.6, 0.15 + node.level * 0.08);
      ctx.strokeStyle = this.withAlpha(node.glowColor, lvAlpha);
      ctx.lineWidth = 0.8;

      // Lv2+: 外环刻度线
      const ticks = Math.min(node.level * 2, 12);
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2 + this.time * 0.3;
        const inner = node.radius + 2;
        const outer = node.radius + 2 + node.level * 0.8;
        ctx.beginPath();
        ctx.moveTo(node.x + Math.cos(a) * inner, node.y + Math.sin(a) * inner);
        ctx.lineTo(node.x + Math.cos(a) * outer, node.y + Math.sin(a) * outer);
        ctx.stroke();
      }

      // Lv3+: 内部六角网格点
      if (node.level >= 3) {
        ctx.fillStyle = this.withAlpha(node.glowColor, 0.15);
        const hexR = node.radius * 0.45;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(node.x + Math.cos(a) * hexR, node.y + Math.sin(a) * hexR, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Lv4+: 角装饰
      if (node.level >= 4) {
        ctx.strokeStyle = this.withAlpha(node.glowColor, 0.3);
        ctx.lineWidth = 1;
        const cornerR = node.radius + 5;
        const cornerLen = Math.PI * 0.15;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 4;
          ctx.beginPath();
          ctx.arc(node.x, node.y, cornerR, a - cornerLen, a + cornerLen);
          ctx.stroke();
        }
      }
    }

    // 进化外环（双层菱形风格）
    if (node.evolved) {
      ctx.strokeStyle = this.withAlpha(COLORS.text.primary, 0.5 + pulse * 0.2);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      // 四角装饰点
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 4;
        const px = node.x + Math.cos(a) * (node.radius + 6);
        const py = node.y + Math.sin(a) * (node.radius + 6);
        ctx.fillStyle = COLORS.text.primary;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 能量填充（扇形）
    if (energyRatio > 0) {
      ctx.fillStyle = this.withAlpha(nodeGlowColor, 0.15 + energyRatio * 0.2);
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.arc(node.x, node.y, node.radius - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * energyRatio);
      ctx.closePath();
      ctx.fill();
    }

    // HP 条 (受损时显示)
    if (node.hp < node.maxHp) {
      const barWidth = node.radius * 2;
      const barHeight = 3;
      const barX = node.x - barWidth / 2;
      const barY = node.y - node.radius - 8;
      const hpRatio = node.hp / node.maxHp;

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,0,0,0.4)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = hpRatio > 0.5 ? COLORS.accent.green : hpRatio > 0.25 ? '#ffaa00' : COLORS.accent.red;
      ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    }

    // 节点类型图标（几何符号）
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.withAlpha(nodeGlowColor, isActive ? 0.9 : 0.5);
    ctx.font = `${node.radius * 0.7}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons: Record<NodeType, string> = {
      core: '◆',
      energy: '⚡',
      turret: '⊕',
      mine: '⛏',
      shield: '◈',
      relay: '◎',
      tesla: '☇',
      beacon: '📡',
      factory: '⚙',
      magnet: '✦',
      trap: '💥',
      repair: '🔧',
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
    const evolvedIcons: Partial<Record<NodeType, string>> = {
      turret: '⊗',
      mine: '⚒',
      shield: '◉',
      energy: '☢',
      tesla: '⚡',
      factory: '✈',
      magnet: '◎',
      repair: '⚕',
      sniper: '☠',
      buffer: '⬡',
      collector: '✦',
      interceptor: '⊠',
      radar: '⊙',
      portal: '⌘',
      blackhole: '⬤',
      echo: '⥁',
      toxin: '⚗',
      arc: '⇝',
      kamikaze: '☄',
    };
    const icon = node.evolved && evolvedIcons[node.type] ? evolvedIcons[node.type]! : icons[node.type];
    if (node.evolved) {
      ctx.fillStyle = COLORS.text.primary;
    }
    ctx.fillText(icon, node.x, node.y);

    // 中立节点标签
    if (isNeutral) {
      ctx.fillStyle = '#88aacc';
      ctx.font = '9px monospace';
      ctx.fillText('中立', node.x, node.y + node.radius + 12);
    }

    // 受击闪红
    if (node.hitFlash > 0) {
      ctx.shadowBlur = 0;
      // 内部红色填充
      ctx.fillStyle = `rgba(255,60,60,${node.hitFlash * 0.45})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      // 红色边框加粗
      ctx.strokeStyle = `rgba(255,40,40,${node.hitFlash * 0.8})`;
      ctx.lineWidth = 3 * node.hitFlash;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.stroke();
      // 外层红色冲击波
      const shockR = node.radius * (1.5 + (1 - node.hitFlash) * 1.5);
      ctx.strokeStyle = `rgba(255,80,80,${node.hitFlash * 0.4})`;
      ctx.lineWidth = 2 * node.hitFlash;
      ctx.beginPath();
      ctx.arc(node.x, node.y, shockR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
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
    const t = state.tick * 0.03;
    for (const enemy of state.enemies) {
      if (enemy.type !== 'healer' || enemy.hp <= 0) continue;
      const healRange = 120;
      const pulse = 0.3 + Math.sin(t * 2) * 0.15;

      // 光环圈
      const grad = ctx.createRadialGradient(enemy.x, enemy.y, 0, enemy.x, enemy.y, healRange);
      grad.addColorStop(0, `rgba(68, 255, 136, ${pulse * 0.15})`);
      grad.addColorStop(0.7, `rgba(68, 255, 136, ${pulse * 0.08})`);
      grad.addColorStop(1, 'rgba(68, 255, 136, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, healRange, 0, Math.PI * 2);
      ctx.fill();

      // 旋转十字标识
      ctx.strokeStyle = `rgba(68, 255, 136, ${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, healRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 治疗连线：对范围内其他敌人画绿色细线
      for (const other of state.enemies) {
        if (other === enemy || other.hp <= 0 || other.hp >= other.maxHp) continue;
        if (dist(enemy, other) <= healRange) {
          ctx.strokeStyle = `rgba(68, 255, 136, ${0.2 + Math.sin(t * 3 + other.x) * 0.1})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /** 绘制敌人路径预判线 */
  private drawEnemyPaths(state: GameState): void {
    const ctx = this.ctx;
    ctx.save();
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || !enemy.targetNodeId) continue;
      const target = state.nodes.find(n => n.id === enemy.targetNodeId);
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
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawEnemies(state: GameState): void {
    const ctx = this.ctx;

    // 预计算信标位置（用于隐形体可见性判定）
    const beacons = state.nodes.filter(
      n => n.type === 'beacon' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );

    for (const enemy of state.enemies) {
      // 隐形体：只有信标范围内可见
      if (enemy.type === 'stealth') {
        const nearBeacon = beacons.some(b => dist(b, enemy) <= 500);
        if (!nearBeacon) continue; // 不渲染
      }

      const hpRatio = enemy.hp / enemy.maxHp;
      const color = ENEMY_COLORS[enemy.type] ?? '#ff3333';

      ctx.save();
      ctx.shadowBlur = enemy.type === 'boss' ? 20 : 10;
      ctx.shadowColor = color;

      // 隐形体半透明效果
      if (enemy.type === 'stealth') ctx.globalAlpha = 0.5;

      // 敌人形状
      ctx.fillStyle = this.withAlpha(color, 0.6);
      ctx.strokeStyle = color;
      ctx.lineWidth = enemy.type === 'boss' ? 3 : 1.5;

      if (enemy.type === 'boss') {
        // Boss: 六角星
        ctx.beginPath();
        const r = enemy.radius;
        for (let i = 0; i < 6; i++) {
          const outerA = (i * Math.PI * 2) / 6 - Math.PI / 2;
          const innerA = outerA + Math.PI / 6;
          const ox = enemy.x + Math.cos(outerA) * r;
          const oy = enemy.y + Math.sin(outerA) * r;
          const ix = enemy.x + Math.cos(innerA) * r * 0.5;
          const iy = enemy.y + Math.sin(innerA) * r * 0.5;
          if (i === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
      } else if (enemy.type === 'heavy') {
        // 菱形
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y - enemy.radius);
        ctx.lineTo(enemy.x + enemy.radius, enemy.y);
        ctx.lineTo(enemy.x, enemy.y + enemy.radius);
        ctx.lineTo(enemy.x - enemy.radius, enemy.y);
        ctx.closePath();
      } else if (enemy.type === 'stealth') {
        // 隐形体: 虚线圆
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      } else if (enemy.type === 'splitter') {
        // 分裂虫: 五角形
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const px = enemy.x + Math.cos(a) * enemy.radius;
          const py = enemy.y + Math.sin(a) * enemy.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else if (enemy.type === 'disruptor') {
        // 干扰者: X 形
        ctx.beginPath();
        const r = enemy.radius;
        const w = r * 0.3;
        // 右上
        ctx.moveTo(enemy.x + w, enemy.y); ctx.lineTo(enemy.x + r, enemy.y - r + w); ctx.lineTo(enemy.x + r - w, enemy.y - r);
        // 左上
        ctx.lineTo(enemy.x, enemy.y - w); ctx.lineTo(enemy.x - r + w, enemy.y - r); ctx.lineTo(enemy.x - r, enemy.y - r + w);
        // 左下
        ctx.lineTo(enemy.x - w, enemy.y); ctx.lineTo(enemy.x - r, enemy.y + r - w); ctx.lineTo(enemy.x - r + w, enemy.y + r);
        // 右下
        ctx.lineTo(enemy.x, enemy.y + w); ctx.lineTo(enemy.x + r - w, enemy.y + r); ctx.lineTo(enemy.x + r, enemy.y + r - w);
        ctx.closePath();
      } else if (enemy.type === 'healer') {
        // 治疗者: 十字形
        ctx.beginPath();
        const r = enemy.radius;
        const w = r * 0.35;
        ctx.moveTo(enemy.x - w, enemy.y - r);
        ctx.lineTo(enemy.x + w, enemy.y - r);
        ctx.lineTo(enemy.x + w, enemy.y - w);
        ctx.lineTo(enemy.x + r, enemy.y - w);
        ctx.lineTo(enemy.x + r, enemy.y + w);
        ctx.lineTo(enemy.x + w, enemy.y + w);
        ctx.lineTo(enemy.x + w, enemy.y + r);
        ctx.lineTo(enemy.x - w, enemy.y + r);
        ctx.lineTo(enemy.x - w, enemy.y + w);
        ctx.lineTo(enemy.x - r, enemy.y + w);
        ctx.lineTo(enemy.x - r, enemy.y - w);
        ctx.lineTo(enemy.x - w, enemy.y - w);
        ctx.closePath();
      } else {
        // 三角形
        ctx.beginPath();
        const target = state.nodes.find(n => n.id === enemy.targetNodeId);
        let angle = 0;
        if (target) {
          angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        }
        for (let i = 0; i < 3; i++) {
          const a = angle + (i * Math.PI * 2) / 3 - Math.PI / 2;
          const px = enemy.x + Math.cos(a) * enemy.radius;
          const py = enemy.y + Math.sin(a) * enemy.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }

      ctx.fill();
      ctx.stroke();

      // HP 条
      if (hpRatio < 1) {
        ctx.shadowBlur = 0;
        const barW = enemy.radius * 2;
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 6, barW, 2);
        ctx.fillStyle = COLORS.accent.red;
        ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 6, barW * hpRatio, 2);
      }

      // 受击闪白
      if (enemy.hitFlash > 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${enemy.hitFlash * 0.7})`;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

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
    const source = state.nodes.find(n => n.id === state.draggingFrom);
    if (!source) return;

    const ctx = this.ctx;
    const d = dist(source, { x: state.mouseX, y: state.mouseY });
    const valid = d <= MAX_EDGE_LENGTH;

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
    ctx.arc(source.x, source.y, MAX_EDGE_LENGTH, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // ===== 特斯拉电弧效果 =====
  private drawTeslaArcs(state: GameState): void {
    const ctx = this.ctx;
    const teslaNodes = state.nodes.filter(n => n.type === 'tesla' && n.status !== 'destroyed');
    if (teslaNodes.length === 0) return;

    const nodeMap = new Map(state.nodes.map(n => [n.id, n]));

    for (const tesla of teslaNodes) {
      const teslaEdges = state.edges.filter(
        e => e.sourceId === tesla.id || e.targetId === tesla.id
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
    const repairNodes = state.nodes.filter(
      n => n.type === 'repair' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (repairNodes.length === 0) return;

    for (const repair of repairNodes) {
      const ev = repair.evolved;
      const range = ev ? 220 : 180;
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
        repair.x, repair.y, range * 0.5,
        repair.x, repair.y, range
      );
      outerGrad.addColorStop(0, `rgba(68,255,136,${0.06 * pulse})`);
      outerGrad.addColorStop(1, 'rgba(68,255,136,0)');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(repair.x, repair.y, range, 0, Math.PI * 2);
      ctx.fill();

      // 内层渐变光环（更亮）
      const auraGrad = ctx.createRadialGradient(
        repair.x, repair.y, repair.radius * 0.5,
        repair.x, repair.y, range * 0.6
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
  private drawSniperScopes(state: GameState): void {
    const ctx = this.ctx;
    const sniperNodes = state.nodes.filter(
      n => n.type === 'sniper' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (sniperNodes.length === 0) return;

    for (const sniper of sniperNodes) {
      const ev = sniper.evolved;
      const range = (250 + sniper.level * 30) * (ev ? 1.5 : 1);
      const pulse = Math.sin(this.time * 3 + sniper.pulsePhase) * 0.2 + 0.8;

      ctx.save();

      // 射程圈（淡红色虚线）
      ctx.strokeStyle = `rgba(255,102,68,${0.2 * pulse})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = -this.time * 20;
      ctx.beginPath();
      ctx.arc(sniper.x, sniper.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 十字准星（旋转）
      const rot = this.time * 0.5;
      ctx.strokeStyle = `rgba(255,102,68,${0.4 * pulse})`;
      ctx.lineWidth = 1;
      const scopeR = sniper.radius + 12;
      const scopeOuter = sniper.radius + 20;
      for (let i = 0; i < 4; i++) {
        const a = rot + (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(sniper.x + Math.cos(a) * scopeR, sniper.y + Math.sin(a) * scopeR);
        ctx.lineTo(sniper.x + Math.cos(a) * scopeOuter, sniper.y + Math.sin(a) * scopeOuter);
        ctx.stroke();
      }

      // 瞄准线 — 找到当前目标（血量最高的在射程内敌人）
      let target: { x: number; y: number } | null = null;
      let maxHp = 0;
      for (const enemy of state.enemies) {
        const d = Math.sqrt((sniper.x - enemy.x) ** 2 + (sniper.y - enemy.y) ** 2);
        if (d <= range && enemy.hp > maxHp) {
          maxHp = enemy.hp;
          target = { x: enemy.x, y: enemy.y };
        }
      }

      if (target) {
        // 激光瞄准线
        ctx.strokeStyle = `rgba(255,102,68,${0.15 + pulse * 0.1})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ff6644';
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(sniper.x, sniper.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 目标标记（小十字）
        ctx.strokeStyle = `rgba(255,102,68,${0.5 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        const crossSize = 8;
        ctx.beginPath();
        ctx.moveTo(target.x - crossSize, target.y);
        ctx.lineTo(target.x + crossSize, target.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(target.x, target.y - crossSize);
        ctx.lineTo(target.x, target.y + crossSize);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 自爆充能光效 =====
  private drawKamikazeCharge(state: GameState): void {
    const ctx = this.ctx;
    const kamikazes = state.nodes.filter(
      n => n.type === 'kamikaze' && n.status !== 'destroyed'
    );
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

      const chargeGrad = ctx.createRadialGradient(
        k.x, k.y, k.radius * 0.5,
        k.x, k.y, pulseSize
      );
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
  private drawArcChains(state: GameState): void {
    const ctx = this.ctx;
    const arcs = state.nodes.filter(
      n => n.type === 'arc' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (arcs.length === 0) return;

    for (const arc of arcs) {
      const ev = arc.evolved;
      const range = ev ? 200 : 160;

      ctx.save();

      // 范围圈（微弱电光）
      ctx.strokeStyle = 'rgba(68,170,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(arc.x, arc.y, range, 0, Math.PI * 2);
      ctx.stroke();

      // 模拟链式闪电路径
      const bounceRange = ev ? 100 : 80;
      const maxBounces = ev ? 4 : 2;
      const enemies = state.enemies.filter(e => e.hp > 0);

      // 找第一个目标
      let first: typeof enemies[0] | null = null;
      let minD = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(arc.x - e.x, arc.y - e.y);
        if (d <= range && d < minD) { first = e; minD = d; }
      }
      if (!first) { ctx.restore(); continue; }

      // 画闪电链
      const chain: { x: number; y: number }[] = [{ x: arc.x, y: arc.y }, { x: first.x, y: first.y }];
      const hit = new Set([first.id]);
      let current = first;
      for (let b = 0; b < maxBounces; b++) {
        let next: typeof enemies[0] | null = null;
        let nd = Infinity;
        for (const e of enemies) {
          if (hit.has(e.id)) continue;
          const d = Math.hypot(current.x - e.x, current.y - e.y);
          if (d <= bounceRange && d < nd) { next = e; nd = d; }
        }
        if (!next) break;
        chain.push({ x: next.x, y: next.y });
        hit.add(next.id);
        current = next;
      }

      // 绘制锯齿闪电线
      ctx.strokeStyle = `rgba(68,170,255,${0.5 + 0.2 * Math.sin(this.time * 8)})`;
      ctx.lineWidth = ev ? 2.5 : 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#44aaff';
      for (let i = 0; i < chain.length - 1; i++) {
        const from = chain[i];
        const to = chain[i + 1];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const segments = 6;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          const jitter = 8 * (1 - Math.abs(t - 0.5) * 2);
          const nx = -dy / Math.hypot(dx, dy);
          const ny = dx / Math.hypot(dx, dy);
          const offset = (Math.random() - 0.5) * 2 * jitter;
          ctx.lineTo(
            from.x + dx * t + nx * offset,
            from.y + dy * t + ny * offset
          );
        }
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 毒雾区域效果 =====
  private drawToxinClouds(state: GameState): void {
    const ctx = this.ctx;
    const toxins = state.nodes.filter(
      n => n.type === 'toxin' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (toxins.length === 0) return;

    for (const toxin of toxins) {
      const ev = toxin.evolved;
      const range = ev ? 200 : 140;

      ctx.save();

      // 毒雾渐变圆
      const fogGrad = ctx.createRadialGradient(
        toxin.x, toxin.y, toxin.radius,
        toxin.x, toxin.y, range
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
    const echos = state.nodes.filter(
      n => n.type === 'echo' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
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
        const neighbor = state.nodes.find(n => n.id === neighborId);
        if (!neighbor || neighbor.status === 'destroyed' || neighbor.type === 'echo' || neighbor.type === 'core') continue;

        // 波纹沿连线从 echo 向 neighbor 扩散
        const dx = neighbor.x - echo.x;
        const dy = neighbor.y - echo.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) continue;

        // 脉冲点沿连线移动
        const pulseCount = ev ? 3 : 2;
        for (let p = 0; p < pulseCount; p++) {
          const t = ((this.time * 1.2 + p / pulseCount) % 1);
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
    const bhs = state.nodes.filter(
      n => n.type === 'blackhole' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (bhs.length === 0) return;

    for (const bh of bhs) {
      const ev = bh.evolved;
      const range = ev ? 160 : 120;
      const crushRange = ev ? 60 : 40;

      ctx.save();

      // 外圈 — 暗紫扭曲引力场
      const outerGrad = ctx.createRadialGradient(
        bh.x, bh.y, crushRange,
        bh.x, bh.y, range
      );
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
      const coreGrad = ctx.createRadialGradient(
        bh.x, bh.y, 0,
        bh.x, bh.y, crushRange
      );
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
    const portals = state.nodes.filter(
      n => n.type === 'portal' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (portals.length === 0) return;

    for (const portal of portals) {
      const ev = portal.evolved;
      const range = ev ? 200 : 150;

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
        portal.x, portal.y, 0,
        portal.x, portal.y, portal.radius * 2.5
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
    const radars = state.nodes.filter(
      n => n.type === 'radar' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (radars.length === 0) return;

    for (const radar of radars) {
      const ev = radar.evolved;
      const range = ev ? 280 : 200;

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
        radar.x, radar.y, radar.radius,
        radar.x, radar.y, range
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
      ctx.lineTo(
        radar.x + Math.cos(sweepAngle) * range,
        radar.y + Math.sin(sweepAngle) * range
      );
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
    const interceptors = state.nodes.filter(
      n => n.type === 'interceptor' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (interceptors.length === 0) return;

    for (const node of interceptors) {
      const ev = node.evolved;
      const range = ev ? 170 : 130;
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
        node.x, node.y, node.radius,
        node.x, node.y, range * 0.6
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
    const collectors = state.nodes.filter(
      n => n.type === 'collector' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (collectors.length === 0) return;

    for (const col of collectors) {
      const ev = col.evolved;
      const range = ev ? 240 : 180;
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
      const grad = ctx.createRadialGradient(
        col.x, col.y, col.radius,
        col.x, col.y, range * 0.5
      );
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
        const alpha = phase < 0.2 ? phase * 5 : (phase > 0.8 ? (1 - phase) * 5 : 1);
        ctx.fillStyle = `rgba(136,221,255,${0.4 * alpha * pulse})`;
        ctx.fillText('◆', px, py);
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== 缓冲器增幅光环 =====
  private drawBufferAuras(state: GameState): void {
    const ctx = this.ctx;
    const bufferNodes = state.nodes.filter(
      n => n.type === 'buffer' && n.status !== 'destroyed' && n.currentEnergy >= n.activationThreshold
    );
    if (bufferNodes.length === 0) return;

    for (const buffer of bufferNodes) {
      const ev = buffer.evolved;
      const range = ev ? 200 : 160;
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
        buffer.x, buffer.y, buffer.radius * 0.5,
        buffer.x, buffer.y, range * 0.65
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
    const mapW = 180;
    const mapH = Math.floor(mapW * state.worldHeight / state.worldWidth);
    const mx = state.canvasWidth - mapW - 10;
    const my = state.canvasHeight - mapH - 60; // 在底部面板上方
    const scaleX = mapW / state.worldWidth;
    const scaleY = mapH / state.worldHeight;

    ctx.save();
    ctx.globalAlpha = 0.85;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
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

    // 绘制连线
    ctx.strokeStyle = 'rgba(0,255,255,0.2)';
    ctx.lineWidth = 0.5;
    for (const edge of state.edges) {
      const s = state.nodes.find(n => n.id === edge.sourceId);
      const t = state.nodes.find(n => n.id === edge.targetId);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(mx + s.x * scaleX, my + s.y * scaleY);
      ctx.lineTo(mx + t.x * scaleX, my + t.y * scaleY);
      ctx.stroke();
    }

    // 绘制节点
    for (const node of state.nodes) {
      if (node.status === 'destroyed') continue;
      ctx.fillStyle = node.glowColor;
      ctx.beginPath();
      ctx.arc(mx + node.x * scaleX, my + node.y * scaleY, node.type === 'core' ? 3 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制敌人
    for (const enemy of state.enemies) {
      if (enemy.type === 'stealth') continue; // 隐形体不在小地图显示
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
    const vpX = mx + cam.x * scaleX;
    const vpY = my + cam.y * scaleY;
    const vpW = (state.canvasWidth / cam.zoom) * scaleX;
    const vpH = (state.canvasHeight / cam.zoom) * scaleY;
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
}
