import type { NodeType } from './types';
import { FACILITY_ART } from './data/facility-art';

export interface FacilityAppearance {
  powered?: boolean; neutral?: boolean; evolved?: boolean; facing?: number;
  time?: number; level?: number; hit?: number;
}
const sprites = new Map<NodeType, HTMLCanvasElement>();
let loading: Promise<void> | undefined;

/** 首屏就绪后再进入游戏，不让模型异步替换或丢失。只缓存小尺寸透明图，逐帧不解码原图。 */
export function loadFacilityArt(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  if (!loading) {
    const entries = Object.entries(FACILITY_ART) as [NodeType, (typeof FACILITY_ART)[NodeType]][];
    let loaded = 0;
    loading = Promise.all(entries.map(async ([type, art]) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = art.sprite;
      await image.decode();
      const surface = document.createElement('canvas');
      surface.width = surface.height = 256;
      const ctx = surface.getContext('2d');
      if (!ctx) throw new Error('设施图谱无法创建绘制上下文');
      const [sx, sy, sw, sh] = art.bounds;
      const scale = 248 / Math.max(sw, sh), w = sw * scale, h = sh * scale;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, sx, sy, sw, sh, (256 - w) / 2, (256 - h) / 2, w, h);
      sprites.set(type, surface);
      onProgress?.(++loaded, entries.length);
    })).then(() => {});
  }
  return loading;
}

/** 战场、建造栏和设施档案共享同一形象；俯视武器可围绕真实节点中心转向。 */
export function drawFacility(ctx: CanvasRenderingContext2D, type: NodeType, x: number, y: number,
  radius: number, appearance: FacilityAppearance = {}): void {
  const sprite = sprites.get(type);
  if (!sprite) return; // 正常入口在 loadFacilityArt 完成后才挂载首屏。
  const { powered = true, neutral = false, evolved = false, facing = -Math.PI / 2, level = 1, hit = 0 } = appearance;
  const art = FACILITY_ART[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= neutral ? .58 : powered ? 1 : .8;
  if (hit > .1) ctx.filter = `brightness(${1 + hit * 1.5})`;
  ctx.save();
  if (art.aims) ctx.rotate(facing + Math.PI / 2);
  ctx.drawImage(sprite, -radius * 1.2, -radius * 1.2, radius * 2.4, radius * 2.4);
  ctx.restore();
  ctx.filter = 'none';
  if (!neutral && (level > 1 || evolved)) {
    const count = evolved ? 3 : Math.min(level - 1, 4), gap = 4, start = -(count - 1) * gap / 2;
    ctx.strokeStyle = evolved ? '#ffe1a0' : art.color;
    ctx.lineWidth = 1.7;
    for (let i = 0; i < count; i++) {
      const px = start + i * gap, py = radius * 1.2 + 3;
      ctx.beginPath(); ctx.moveTo(px - 1.3, py + 2); ctx.lineTo(px, py); ctx.lineTo(px + 1.3, py + 2); ctx.stroke();
    }
  }
  ctx.restore();
}

export function paintFacilityPortraits(root: HTMLElement): void {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-facility]').forEach(canvas => {
    const type = canvas.dataset.facility as NodeType;
    const ctx = canvas.getContext('2d');
    if (!ctx || !FACILITY_ART[type]) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFacility(ctx, type, canvas.width / 2, canvas.height / 2, canvas.height * .35, { powered: true });
  });
}

export function paintTitleScene(canvas:HTMLCanvasElement):void {
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w*.48,h*.5,10,w*.48,h*.5,w*.55);glow.addColorStop(0,'#7fb9c01c');glow.addColorStop(1,'#7fb9c000');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  const stars=Array.from({length:85},(_,i)=>({x:(Math.sin(i*134.7)*.5+.5)*w,y:(Math.cos(i*73.9)*.5+.5)*h}));
  for(const s of stars){ctx.fillStyle='#b8cfd84a';ctx.fillRect(s.x,s.y,1.5,1.5);}
  const units:{type:NodeType;x:number;y:number;r:number}[]=[{type:'core',x:235,y:365,r:55},{type:'energy',x:122,y:497,r:38},{type:'mine',x:435,y:488,r:37},{type:'relay',x:391,y:272,r:28},{type:'turret',x:543,y:332,r:37},{type:'beacon',x:533,y:151,r:39}];
  for(const[a,b]of [[0,1],[0,2],[0,3],[3,4],[3,5]]){
    const x=units[a],y=units[b];ctx.beginPath();ctx.moveTo(x.x,x.y);ctx.lineTo(y.x,y.y);ctx.strokeStyle='#9ed9d18a';ctx.lineWidth=2;ctx.stroke();
    for(const t of [.3,.72]){ctx.beginPath();ctx.arc(x.x+(y.x-x.x)*t,x.y+(y.y-x.y)*t,3,0,Math.PI*2);ctx.fillStyle='#b1e7dc';ctx.fill();}
  }
  ctx.save();ctx.setLineDash([3,12]);ctx.beginPath();ctx.ellipse(370,340,245,175,-.25,0,Math.PI*2);ctx.strokeStyle='#a6c9d337';ctx.lineWidth=1;ctx.stroke();ctx.restore();
  for(const u of units)drawFacility(ctx,u.type,u.x,u.y,u.r,{powered:true,level:u.type==='core'?1:3,facing:-.55});
  ctx.fillStyle='#8faebb';ctx.font='11px "Segoe UI", "Microsoft YaHei",sans-serif';ctx.fillText('前沿侦察',555,99);ctx.fillText('能量沿连接流动',79,568);ctx.fillStyle='#d4e9e7';ctx.font='13px "Segoe UI", "Microsoft YaHei",sans-serif';ctx.fillText('每个节点，都在彼此回应。',345,605);
}
