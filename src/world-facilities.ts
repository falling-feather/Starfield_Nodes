import type { GameState,GameNode,Point } from './types';
import { drawFacility } from './facility-art';
import { turretAttackRange,sniperAttackRange,factoryAttackRange,hasFiringLine } from './weapon-geometry';
import { UI_FONT } from './canvas-ui';
import { NODE_PRESENTATION } from './presentation';
import { baseSensorRadius } from './visibility';
import { mineralAt, stationDisplayStatus } from './frontier';

const outlineCache=new WeakMap<GameState,{key:string;terrain:GameState['terrainPolygons'];points:Point[]}>();
export function drawFrontierSites(ctx:CanvasRenderingContext2D,state:GameState):void {
  const config=state.mission?.frontier;if(!config)return;
  const z=state.camera.zoom;
  ctx.save();
  for(const d of config.deposits){
    const occupied=state.nodes.find(n=>n.type==='mine'&&n.status!=='destroyed'&&mineralAt(state,n)?.id===d.id);
    ctx.beginPath();ctx.arc(d.x,d.y,d.radius,0,Math.PI*2);ctx.strokeStyle=occupied?'#d9bf8360':'#d9bf83a8';ctx.lineWidth=1/z;ctx.setLineDash([3/z,7/z]);ctx.stroke();ctx.setLineDash([]);
    if(!occupied){
      for(let i=0;i<4;i++){
        const x=d.x+(i-1.5)*13,y=d.y+Math.sin(i*2)*8;
        ctx.beginPath();ctx.moveTo(x-7,y+6);ctx.lineTo(x-2,y-15-i*2);ctx.lineTo(x+6,y+2);ctx.lineTo(x+2,y+10);ctx.closePath();ctx.fillStyle=i%2?'#a78755':'#d0b47a';ctx.fill();
      }
    }
    ctx.save();ctx.translate(d.x,d.y+d.radius+12/z);ctx.scale(1/z,1/z);ctx.font=`11px ${UI_FONT}`;ctx.textAlign='center';ctx.fillStyle='#d6bd8d';ctx.fillText(`${d.label} · 基础 ${d.perSecond}/s`,0,0);ctx.restore();
  }
  for(const site of config.stations){
    const status=stationDisplayStatus(state,site),done=status.kind==='complete',col=done?'#a6d8be':'#a8c6e2';
    ctx.beginPath();ctx.arc(site.x,site.y,site.radius,0,Math.PI*2);ctx.strokeStyle=done?'#a6d8be50':'#9cbdd77a';ctx.lineWidth=1/z;ctx.setLineDash([6/z,7/z]);ctx.stroke();ctx.setLineDash([]);
    if(status.progress>0){ctx.beginPath();ctx.arc(site.x,site.y,site.radius+4/z,-Math.PI/2,-Math.PI/2+Math.PI*2*status.progress/site.seconds);ctx.strokeStyle=col;ctx.lineWidth=2/z;ctx.stroke();}
    if(status.kind==='missing'||status.kind==='locked'){
      ctx.beginPath();ctx.moveTo(site.x,site.y-16);ctx.lineTo(site.x+16,site.y);ctx.lineTo(site.x,site.y+16);ctx.lineTo(site.x-16,site.y);ctx.closePath();ctx.fillStyle='#172d3be0';ctx.fill();ctx.strokeStyle=col;ctx.stroke();
    }
    ctx.save();ctx.translate(site.x,site.y+(site.radius+24/z));ctx.scale(1/z,1/z);ctx.fillStyle=col;ctx.textAlign='center';ctx.font=`12px ${UI_FONT}`;ctx.fillText(site.label,0,0);ctx.font=`10px ${UI_FONT}`;ctx.fillStyle='#92a9b7';ctx.fillText(done?'数据已保存':`${Math.floor(status.progress)} / ${site.seconds}s · ${status.label}`,0,18);ctx.restore();
  }
  ctx.restore();
}
export function drawWeaponCoverage(ctx:CanvasRenderingContext2D,state:GameState,node:GameNode,multiplier=1):void {
  const range=node.type==='turret'?turretAttackRange(state,node,multiplier):node.type==='sniper'?sniperAttackRange(state,node,multiplier):node.type==='factory'?factoryAttackRange(multiplier):0;
  if(!range)return;
  const key=`${node.type}:${node.x}:${node.y}:${range}`,cached=outlineCache.get(state);
  let points=cached?.key===key&&cached.terrain===state.terrainPolygons?cached.points:undefined;
  if(!points){
    points=[];
    for(let i=0;i<=72;i++){
      const a=i/72*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);let lo=0,hi=range;
      for(let j=0;j<9;j++){const mid=(lo+hi)/2;if(node.type==='factory'||hasFiringLine(state,node,{x:node.x+dx*mid,y:node.y+dy*mid}))lo=mid;else hi=mid;}
      points.push({x:node.x+dx*lo,y:node.y+dy*lo});
    }
    outlineCache.set(state,{key,terrain:state.terrainPolygons,points});
  }
  ctx.save();ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#e9b48c08';ctx.fill();ctx.strokeStyle='#e2c49c8a';ctx.lineWidth=1/state.camera.zoom;ctx.setLineDash([5/state.camera.zoom,6/state.camera.zoom]);ctx.stroke();ctx.restore();
}
export function drawWorldFacility(ctx:CanvasRenderingContext2D,node:GameNode,state:GameState,multiplier=1):void {
  const selected=state.selectedNodeId===node.id,zoom=state.camera.zoom;
  if(node.status==='destroyed'){
    ctx.save();ctx.translate(node.x,node.y);ctx.fillStyle='#53616b70';ctx.beginPath();ctx.moveTo(-14,-4);ctx.lineTo(1,-11);ctx.lineTo(16,4);ctx.lineTo(-4,12);ctx.closePath();ctx.fill();ctx.restore();return;
  }
  if(selected){
    drawWeaponCoverage(ctx,state,node,multiplier);
    if(node.type==='beacon'||node.type==='radar'){
      const source=state.visibility.sources.find(s=>s.x===node.x&&s.y===node.y),r=source?.radius??baseSensorRadius(node.type,state.mission);
      ctx.save();ctx.beginPath();ctx.arc(node.x,node.y,r,0,Math.PI*2);ctx.strokeStyle='#a2c5e477';ctx.lineWidth=1/zoom;ctx.setLineDash([3/zoom,8/zoom]);ctx.stroke();ctx.restore();
    }
  }
  const powered=node.owner==='player'&&node.connected&&node.currentEnergy>=node.activationThreshold;
  drawFacility(ctx,node.type,node.x,node.y,node.radius+4,{powered,neutral:node.owner==='neutral',evolved:node.evolved,facing:node.facing,time:state.elapsedSeconds,level:node.level,hit:node.hitFlash});
  if(!selected&&zoom<.67&&node.hp>=node.maxHp&&powered)return;
  ctx.save();ctx.translate(node.x,node.y);ctx.scale(1/zoom,1/zoom);
  const base=(node.radius+14)*zoom;
  if(node.owner==='player'&&(selected||node.hp<node.maxHp||!powered)){
    const bw=36;ctx.fillStyle='#273c47';ctx.fillRect(-bw/2,base,bw,3);ctx.fillStyle=node.hp/node.maxHp<.35?'#eb9685':'#9bceba';ctx.fillRect(-bw/2,base,bw*Math.max(0,node.hp/node.maxHp),3);
    ctx.fillStyle='#233b47';ctx.fillRect(-bw/2,base+6,bw,2);ctx.fillStyle=powered?'#92cadd':'#dabd87';ctx.fillRect(-bw/2,base+6,bw*Math.min(1,Math.max(0,node.currentEnergy/node.maxEnergy)),2);
  }
  if(selected||node.owner==='neutral'||(!powered&&node.owner==='player')){
    ctx.textAlign='center';ctx.font=`12px ${UI_FONT}`;ctx.textBaseline='top';ctx.fillStyle=node.owner==='neutral'?'#a8bac4':powered?'#dae9e9':'#ddc49b';
    ctx.fillText(node.owner==='neutral'?'废弃 · 可接管':!node.connected?'未接入':!powered?'待充能':NODE_PRESENTATION[node.type].name,0,base+13);
  }
  ctx.restore();
}
