import type { GameState, NodeType } from './types';
import type { UI } from './ui';
import { UI_FONT, panel, wrappedText, inspectorRect, objectiveRect } from './canvas-ui';
import { drawFacility } from './facility-art';
import { FACILITY_ART } from './data/facility-art';
import { NODE_PRESENTATION } from './presentation';
import { NODE_CONFIGS } from './data/nodes';
import { EDGE_CONFIGS } from './data/edges';
import { calcUpgradeCost } from './data/balance';
import { EVOLUTION_LEVEL, EVOLVABLE_TYPES, EVOLUTION_NAMES, getEvolutionCost, getEvolutionCrystalCost } from './data/evolution';
import { getKey } from './keybinds';
import { energyStationProduction, energyTerrainMultiplier } from './graph';
import { CORE_ENERGY_PRODUCTION, EXPAND_COST, EXPAND_CRYSTAL_COST } from './data/runtime';
import { getTechMultiplier } from './tech';
import { sellQuote, nearestConnection } from './construction';
import { canDetectEnemy, isPositionVisible } from './visibility';
import { frontierStatus, mineralAt, mineYield, stationDisplayStatus } from './frontier';
import { secondaryObjectiveStatus } from './mission-objectives';

const INK='#e2eeef',MUTED='#93abb7',MINT='#94dacb',GOLD='#dfc18e';
function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size=12,color=INK,weight=400):void {
  ctx.font=`${weight} ${size}px ${UI_FONT}`;ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(value,x,y);
}
function button(ctx:CanvasRenderingContext2D,ui:UI,action:string,label:string,x:number,y:number,w:number,h:number,enabled=true,active=false):void {
  panel(ctx,x,y,w,h,active?'#27434b':'#172c39',active?'#90c9c288':'#66859435',7);
  ctx.save();ctx.globalAlpha=enabled?1:.38;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`12px ${UI_FONT}`;ctx.fillStyle=active?MINT:INK;ctx.fillText(label,x+w/2,y+h/2);ctx.restore();
  ui.nodeButtons.push({action,x,y,w,h,enabled});
}
function meter(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,value:number,color=MINT):void {
  ctx.fillStyle='#29404c';ctx.fillRect(x,y,w,3);ctx.fillStyle=color;ctx.fillRect(x,y,w*Math.max(0,Math.min(1,value)),3);
}
export function drawBattleHUD(ctx:CanvasRenderingContext2D,state:GameState,ui:UI):void {
  const w=state.canvasWidth,config=state.mission?.frontier,status=frontierStatus(state);
  ctx.save();ctx.shadowBlur=0;
  const fill=ctx.createLinearGradient(0,0,0,74);fill.addColorStop(0,'#132633');fill.addColorStop(1,'#0d1d29f5');
  ctx.fillStyle=fill;ctx.fillRect(0,0,w,72);ctx.fillStyle='#7eb2bd26';ctx.fillRect(0,71,w,1);
  text(ctx,config?'FRONTIER / 星域行动':'STARFIELD / 远征',24,19,12,MUTED);
  text(ctx,ui.levelTitle,24,46,21,INK,500);
  const rx=w<1120?215:280;
  text(ctx,'建造资源',rx,20,12,MUTED);text(ctx,String(Math.floor(state.resources)),rx,47,22,MINT,500);
  if(config){
    const income=.35+state.nodes.filter(n=>n.type==='mine').reduce((sum,n)=>sum+mineYield(state,n)*2,0);
    text(ctx,`+${income.toFixed(1)}/s`,rx+65,48,12,MUTED);
  }
  text(ctx,'研究晶体',rx+128,20,12,MUTED);text(ctx,String(Math.floor(state.crystals)),rx+128,47,21,'#c8bfdf');
  const low=state.nodes.filter(n=>n.owner==='player'&&n.connected&&n.status!=='destroyed'&&n.currentEnergy<n.activationThreshold).length;
  if(w>=1250){text(ctx,'电网状态',rx+237,20,12,MUTED);text(ctx,low?`${low} 座待充能`:'供能稳定',rx+237,47,14,low?GOLD:MINT);}
  const controls:[string,string,number][]=[['overview','全域',48],['knowledge','策略',54],['tech_tree','研究',54],['pause',state.paused?'继续 ▸':'Ⅱ 暂停',74],['time_scale',`${state.timeScale}×`,44],['menu','菜单',44]];
  const total=controls.reduce((s,c)=>s+c[2]+6,0);let bx=w-total-14;
  for(const[action,label,width]of controls){button(ctx,ui,action,label,bx,22,width,32,true,action==='pause'&&state.paused);bx+=width+6;}
  const cores=state.nodes.filter(n=>n.type==='core'&&n.owner==='player'),hp=cores.reduce((s,n)=>s+Math.max(0,n.hp),0),max=cores.reduce((s,n)=>s+n.maxHp,0);
  const collapsed=ui.objectiveCollapsed,{x,y,w:pw,h:ph}=objectiveRect(state,collapsed);
  panel(ctx,x,y,pw,ph,'#0e2130ef','#7ea8ba26',12);ui.hudRects.push({x,y,w:pw,h:ph});
  text(ctx,config?.chapter ?? '本次航行',x+18,y+21,12,MUTED);
  button(ctx,ui,'objectives',collapsed?'+':'−',x+pw-44,y+11,27,22);
  text(ctx,status?.label ?? ui.levelObjectiveText,x+18,y+49,15,INK,500);
  meter(ctx,x+18,y+67,pw-36,status?.ratio ?? (hp/Math.max(1,max)),status?MINT:hp/max<.4?'#ed9a86':MINT);
  text(ctx,`核心 ${Math.ceil(hp/Math.max(1,max)*100)}% ↗`,x+18,y+88,12,MINT);
  if(cores[0])ui.nodeButtons.push({action:`focus:${cores[0].id}`,x:x+16,y:y+76,w:112,h:24,enabled:true});
  text(ctx,`发现 ${state.enemies.filter(e=>canDetectEnemy(state,e)).length} 敌人`,x+148,y+88,12,MUTED);
  const prep=(config?.preparationSeconds ?? 20)-state.elapsedSeconds;
  const next=prep>0?prep:(config?.attackSeconds ?? 3)-(state.tick/2)%(config?.attackSeconds ?? 3);
  if(!collapsed)text(ctx,prep>0?`布防时间 · ${Math.ceil(prep)} 秒`:`第 ${state.wave} 批入侵 · 下一批约 ${Math.ceil(next)} 秒`,x+18,y+114,12,prep>0?MINT:GOLD);
  if(config&&!collapsed){
    const targets=config.goal.kind==='harvest'?config.deposits.filter(d=>!d.home).map(d=>({id:d.id,label:d.label,detail:`基础 ${d.perSecond}/s · ${state.nodes.some(n=>n.type==='mine'&&n.status!=='destroyed'&&mineralAt(state,n)?.id===d.id)?'已部署':'待开采'}`,ratio:0})):config.stations.map(s=>{const st=stationDisplayStatus(state,s);return {id:s.id,label:s.label,detail:`${Math.floor(st.progress)} / ${s.seconds}s · ${st.kind==='complete'?'完成':st.kind==='working'?'观测中':st.kind==='missing'?'待部署':st.kind==='locked'?'待解锁':st.kind==='unpowered'?'待充能':'待接通'}`,ratio:st.progress/s.seconds};});
    targets.forEach((target,i)=>{
      const yy=y+143+i*47;
      ctx.fillStyle='#7eafbe1b';ctx.fillRect(x+18,yy-10,pw-36,1);
      text(ctx,target.label,x+18,yy+3,12,INK);text(ctx,target.detail,x+18,yy+21,12,MUTED);
      button(ctx,ui,`focus:${target.id}`,'定位 ↗',x+pw-83,yy-1,65,28);
      if(target.ratio>0)meter(ctx,x+18,yy+33,pw-36,target.ratio,MINT);
    });
  }else if(!collapsed){
    const secondary=secondaryObjectiveStatus(state);
    text(ctx,secondary?.label ?? (low?'检查产能、连接与链路容量':'拖拽设施连线 · 自由规划防线'),x+18,y+138,12,secondary?.complete?MINT:MUTED);
    if(state.protectedCoreIds?.size){
      [...state.protectedCoreIds].forEach((id,i)=>{const core=state.nodes.find(n=>n.id===id),ratio=core?Math.max(0,core.hp/core.maxHp):0,xx=x+18+i*138;
        text(ctx,`${i?'东侧':'西侧'}核心 ${Math.ceil(ratio*100)}% ↗`,xx,y+163,12,ratio>.4?MINT:GOLD);meter(ctx,xx,y+179,125,ratio);
        if(core)ui.nodeButtons.push({action:`focus:${id}`,x:xx,y:y+151,w:125,h:32,enabled:true});
      });
    }
  }
  const time=`${String(Math.floor(state.elapsedSeconds/60)).padStart(2,'0')}:${String(Math.floor(state.elapsedSeconds%60)).padStart(2,'0')}`;
  text(ctx,`${state.paused?'规划暂停':'行动进行中'}  /  ${time}`,w-212,91,12,state.paused?GOLD:MUTED);
  if(state.alert&&state.alert.until>state.elapsedSeconds){
    const aw=Math.min(540,w-48),ax=(w-aw)/2,ay=state.canvasHeight-174;
    panel(ctx,ax,ay,aw,39,'#2c2e32f2','#ddbf8544',8);ui.hudRects.push({x:ax,y:ay,w:aw,h:39});
    text(ctx,state.alert.text,ax+16,ay+20,12,GOLD);button(ctx,ui,'dismiss_alert','×',ax+aw-35,ay+6,27,27);
  }
  const boss=state.enemies.find(e=>e.type==='boss'&&canDetectEnemy(state,e));
  if(boss){const yy=y+ph+12;panel(ctx,x,yy,pw,60,'#302630ed','#bb8e8244',9);ui.hudRects.push({x,y:yy,w:pw,h:60});text(ctx,state.mission?.bossName??'星域首领',x+18,yy+21,13,'#e3b29c');meter(ctx,x+18,yy+41,pw-36,boss.hp/boss.maxHp,'#dd9b89');}
  ctx.restore();
}
export function drawBuildDock(ctx:CanvasRenderingContext2D,state:GameState,ui:UI):void {
  const types=ui.allowedNodeTypes??(['energy','turret','mine','relay','shield'] as NodeType[]),w=state.canvasWidth,y=state.canvasHeight-119,gap=6;
  const cw=Math.min(124,(w-48-(types.length-1)*gap)/types.length),total=types.length*cw+(types.length-1)*gap,start=(w-total)/2;
  ctx.save();ctx.shadowBlur=0;
  panel(ctx,start-10,y-9,total+20,86,'#0d202df2','#8eafb92b',13);
  types.forEach((type,i)=>{
    const x=start+i*(cw+gap),cfg=NODE_CONFIGS[type],selected=ui.buildMode===type;
    if(selected)panel(ctx,x,y,cw,66,'#274650','#9fd9d08c',8);
    ctx.fillStyle=FACILITY_ART[type].color;ctx.fillRect(x+2,y+16,3,36);
    drawFacility(ctx,type,x+27,y+35,18,{powered:state.resources>=cfg.cost});
    text(ctx,NODE_PRESENTATION[type].name,x+51,y+24,12,state.resources>=cfg.cost?INK:MUTED);
    text(ctx,`${cfg.cost} ◆`,x+51,y+46,12,selected?MINT:MUTED);
    text(ctx,String((i+1)%10),x+cw-14,y+11,12,MUTED);
    ui.nodeButtons.push({action:`build:${type}`,x,y,w:cw,h:66,enabled:true});
  });
  const edge=EDGE_CONFIGS[state.selectedEdgeType];
  button(ctx,ui,'edge_type',`Tab · ${edge.name}链路 / ${edge.cost} ◆`,w-252,state.canvasHeight-32,230,24);
  const quote=ui.buildPlacement;
  const environment=ui.buildMode==='energy'&&quote?.valid?energyTerrainMultiplier(state,{x:state.mouseX,y:state.mouseY}):1;
  const hint=ui.buildMode ? `${NODE_PRESENTATION[ui.buildMode].name} · ${quote ? `${quote.cost} ◆${quote.discount>0?` · 领地优惠 ${Math.round(quote.discount*100)}%`:''}${environment>1?` · 环境产能 ×${environment.toFixed(2)}`:''} · ${quote.valid?'点击建造':quote.reason}` : ui.buildMode==='mine'&&state.frontier?'移入矿脉范围预览':'移入已探索区域预览'} · Esc 取消` : `拖拽设施接线  ·  Ctrl + 拖拽平移  ·  ${getKey('pause').toUpperCase()} 暂停规划`;
  text(ctx,hint,22,state.canvasHeight-20,12,quote&&!quote.valid?GOLD:ui.buildMode?MINT:MUTED);
  ctx.restore();
}
export function drawInspector(ctx:CanvasRenderingContext2D,state:GameState,ui:UI):void {
  const node=state.nodes.find(n=>n.id===state.selectedNodeId&&n.status!=='destroyed');if(!node)return;
  const {x,y,w,h}=inspectorRect(state.canvasWidth);
  ctx.save();ctx.shadowBlur=0;panel(ctx,x,y,w,h,'#112633f5','#93b9c139',12);ui.hudRects.push({x,y,w,h});
  ctx.fillStyle=FACILITY_ART[node.type].color;ctx.fillRect(x+1,y+20,3,52);
  drawFacility(ctx,node.type,x+42,y+43,25,{powered:node.connected,neutral:node.owner==='neutral',evolved:node.evolved});
  text(ctx,NODE_PRESENTATION[node.type].role,x+82,y+25,12,MUTED);
  text(ctx,`${node.evolved?(EVOLUTION_NAMES[node.type]??NODE_PRESENTATION[node.type].name):NODE_PRESENTATION[node.type].name} · ${node.level} 级`,x+82,y+48,16,INK,500);
  const status=node.owner==='neutral'?'废弃设施 · 可接管':!node.connected?'离线 · 拖拽接入核心电网':node.currentEnergy<node.activationThreshold?'等待充能 · 检查供电容量':'已接入 · 运行中';
  text(ctx,status,x+18,y+83,12,node.connected?MINT:GOLD);
  text(ctx,`生命 ${Math.ceil(node.hp)} / ${node.maxHp}`,x+18,y+109,12,MUTED);
  text(ctx,`能量 ${Math.floor(node.currentEnergy)} / ${node.maxEnergy}`,x+147,y+109,12,MUTED);
  meter(ctx,x+18,y+122,114,node.hp/node.maxHp);meter(ctx,x+147,y+122,117,node.currentEnergy/node.maxEnergy,'#a2bdd9');
  let detail=node.type==='energy'?`产能 ${(energyStationProduction(state,node)*2).toFixed(1)}/s${energyTerrainMultiplier(state,node)>1?` · 环境增益 ×${energyTerrainMultiplier(state,node).toFixed(2)}`: ' · 升级改善持续供电'}`:node.type==='turret'||node.type==='sniper'?'直射武器 · 虚线为岩带遮挡后的有效射界':node.type==='factory'?'无人机可越过岩带 · 适合隔障支援':node.type==='mine'&&state.frontier?`${mineralAt(state,node)?.label??'不在矿脉'} · 当前产出 ${(mineYield(state,node)*2).toFixed(1)}/s`:node.type==='beacon'?'侦察与反隐 · 位于阵列范围内时承担任务供电':'选择连线，或直接拖拽到另一座设施';
  if(node.type==='beacon'&&state.mission?.frontier){const site=state.mission.frontier.stations.find(s=>Math.hypot(s.x-node.x,s.y-node.y)<=s.radius);if(site)detail=stationDisplayStatus(state,site).label;}
  if(node.type==='core')detail=`自充能 ${(CORE_ENERGY_PRODUCTION+(ui.techState?getTechMultiplier(ui.techState,'core_production'):0))*2}/s · ${node.expanded?'领地已扩展':`扩展需 ${EXPAND_COST}◆ 与 ${EXPAND_CRYSTAL_COST} 晶体`}`;
  ctx.font=`12px ${UI_FONT}`;ctx.fillStyle=MUTED;ctx.textAlign='left';wrappedText(ctx,detail,x+18,y+145,w-36,18,2);
  const actions:{id:string;label:string;enabled:boolean}[]=[];
  if(node.owner==='neutral')actions.push({id:'recruit',label:`接管 ${NODE_CONFIGS[node.type].cost} ◆`,enabled:state.resources>=NODE_CONFIGS[node.type].cost&&isPositionVisible(state,node.x,node.y)});
  else{
    if(node.type==='core'&&!node.expanded)actions.push({id:'expand',label:'扩展范围',enabled:node.connected&&state.resources>=EXPAND_COST&&state.crystals>=EXPAND_CRYSTAL_COST});
    const evolving=node.level>=EVOLUTION_LEVEL&&EVOLVABLE_TYPES.has(node.type),cost=evolving?getEvolutionCost(node.type):calcUpgradeCost(node.type,node.level),crystal=evolving?getEvolutionCrystalCost(node.type):0;
    if(node.type!=='core')actions.push({id:'upgrade',label:node.evolved?'已进化':`${evolving?'进化':'升级'} ${cost} ◆`,enabled:!node.evolved&&node.connected&&(node.level<EVOLUTION_LEVEL||evolving)&&state.resources>=cost&&state.crystals>=crystal});
    const nearby=!node.connected&&ui.techState&&nearestConnection(state,node,ui.techState);
    actions.push({id:nearby?'auto_connect':'connect',label:nearby?'接入最近线路':'连接线路',enabled:!state.draggingFrom});
    const quote=sellQuote(state,node);actions.push({id:'sell',label:quote.valid?`回收 +${quote.refund} ◆`:'保留核心',enabled:quote.valid});
  }
  const bw=(w-36-(actions.length-1)*6)/actions.length;
  actions.forEach((a,i)=>button(ctx,ui,a.id,a.label,x+18+i*(bw+6),y+h-44,bw,29,a.enabled));
  ctx.restore();
}
export function drawBatchInspector(ctx:CanvasRenderingContext2D,state:GameState,ui:UI):void {
  const nodes=state.nodes.filter(n=>state.selectedNodeIds.includes(n.id)&&n.status!=='destroyed');if(!nodes.length)return;
  const {x,y,w}=inspectorRect(state.canvasWidth),h=201;
  ctx.save();panel(ctx,x,y,w,h,'#112633f5','#93b9c139',12);ui.hudRects.push({x,y,w,h});
  text(ctx,'NETWORK / 批量调度',x+18,y+22,12,MUTED);text(ctx,`已选中 ${nodes.length} 座设施`,x+18,y+50,17,INK,500);
  const refund=nodes.reduce((sum,n)=>{const q=sellQuote(state,n);return sum+(q.valid?q.refund:0);},0);
  text(ctx,`可回收资源 ${refund} ◆`,x+18,y+78,12,GOLD);
  button(ctx,ui,'batch_upgrade','逐座升级',x+18,y+104,119,32);
  button(ctx,ui,'batch_sell','回收所选',x+145,y+104,119,32,refund>0);
  button(ctx,ui,'batch_clear','取消选择',x+18,y+146,w-36,30);
  ctx.restore();
}
