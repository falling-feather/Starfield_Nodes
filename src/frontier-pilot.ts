import type { GameState,GameNode,NodeType } from './types';
import type { TechState } from './tech';
import { buildNode,connectNodes,recruitNode,upgradeNode,sellNode,placementStatus } from './construction';
import { EDGE_CONFIGS } from './data/edges';

export const FRONTIER_STRATEGIES=['choke','outpost','parallel','sequential','trunk','island','ring'] as const;
export type FrontierStrategy=typeof FRONTIER_STRATEGIES[number];
export function isFrontierStrategy(value:string|null):value is FrontierStrategy {return FRONTIER_STRATEGIES.some(s=>s===value);}
interface PlanNode { key:string;type:NodeType;x:number;y:number;parent?:string;level:number;afterSite?:string;untilSite?:string;afterBuilt?:string }
interface Run { runtime:GameState['frontier'];plan:PlanNode[];block:string }
const runs=new WeakMap<GameState,Run>();
export function frontierPilotBlock(state:GameState):string {return runs.get(state)?.block??'';}

/** 三张作者地图的对照建造顺序，仅由 benchmark 使用，不限制正常玩家的塔位或路线。 */
function layout(state:GameState,strategy:FrontierStrategy):PlanNode[]{
  const core=state.nodes.find(n=>n.type==='core'&&n.owner==='player')!;
  const plan:PlanNode[]=[];
  const add=(key:string,type:NodeType,x:number,y:number,parent='base',level=1,conditions:Partial<PlanNode>={})=>{plan.push({key,type,x,y,parent,level,...conditions});};
  add('base-gun','turret',core.x+130,core.y+10,'base',2);
  add('base-energy','energy',core.x-125,core.y+10,'base',2);
  if(strategy==='ring'){
    add('camp-power','energy',core.x-140,core.y+110,'base',3);
    add('camp-sensor','beacon',core.x-75,core.y-100);
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;add(`ring-${i}`,'turret',core.x+Math.cos(a)*180,core.y+Math.sin(a)*180,'base',2);}
    add('camp-repair','repair',core.x+85,core.y+95);
    return plan;
  }
  if(state.mission!.frontier!.goal.kind==='harvest'){
    if(strategy==='outpost'){
      add('gap-west','relay',590,600,'base-gun');
      add('gap-power','energy',760,600,'gap-west',2);
      add('gap-east','relay',925,600,'gap-power',2);
      add('south-turn','relay',1080,650,'gap-east',2);
      add('rich-power','energy',1170,785,'south-turn',2);
      add('rich-mine','mine',1190,910,'rich-power',2);
      add('rich-gun','turret',1320,865,'rich-power',3);
      add('rich-power','energy',1170,785,'south-turn',3);
      add('rich-repair','repair',1250,785,'rich-power');
      add('rich-mine','mine',1190,910,'rich-power',3);
    }else{
      add('north-power','energy',500,480,'base-gun',2);
      add('north-relay','relay',590,390,'north-power',2);
      add('shallow-mine','mine',650,325,'north-relay',2);
      add('choke-power','energy',670,480,'north-relay',2);
      add('choke-gun','turret',760,600,'choke-power',3);
      add('choke-power','energy',670,480,'north-relay',3);
      add('choke-repair','repair',650,580,'choke-power');
      add('shallow-mine','mine',650,325,'north-relay',3);
    }
    return plan;
  }
  if(state.mission!.frontier!.stations.length===3){
    const sequential=strategy==='sequential';
    const south:Partial<PlanNode>=sequential?{afterSite:'north-array'}:{};
    add('north-root','energy',510,570,'base-gun');
    add('north-scout','beacon',530,475,'north-root');
    add('north-leg','relay',650,430,'north-root',2);
    add('north-mine','mine',740,300,'north-leg',2);
    add('north-power','energy',875,300,'north-mine',2);
    add('north-relay','relay',1030,300,'north-power',2);
    add('north-gun','turret',990,380,'north-relay',2);
    add('north-beacon','beacon',1130,290,'north-relay',1,sequential?{untilSite:'north-array'}:{});
    add('south-root','energy',610,810,'base-gun',1,south);
    add('south-scout','beacon',650,840,'south-root',1,south);
    add('south-leg','relay',760,920,'south-root',2,south);
    add('south-turn','relay',930,1020,'south-leg',2,south);
    add('south-scout2','beacon',975,945,'south-turn',1,south);
    add('south-relay','relay',1100,1060,'south-turn',2,south);
    add('south-power','energy',1210,1000,'south-relay',2,south);
    add('south-gun','turret',1320,1050,'south-power',2,south);
    add('south-beacon','beacon',1290,1130,'south-power',1,south);
    if(!sequential){
    add('north-power','energy',875,300,'north-mine',3,{afterBuilt:'south-beacon'});
    add('south-power','energy',1210,1000,'south-relay',3,{...south,afterBuilt:'south-beacon'});
    add('north-booster','energy',1110,385,'north-relay',2,{afterBuilt:'south-beacon'});
    add('north-repair','repair',840,440,'north-leg',1,{afterBuilt:'south-beacon'});
    add('south-repair','repair',1160,1030,'south-power',1,{...south,afterBuilt:'south-beacon'});
    add('north-gun','turret',990,380,'north-relay',3,{afterBuilt:'south-beacon'});
    add('south-gun','turret',1320,1050,'south-power',3,{...south,afterBuilt:'south-beacon'});
    }
    return plan;
  }
  const trunk=strategy==='trunk';
  add('near-power','energy',590,700,'base-gun',trunk?3:2);
  add('near-gate','relay',700,700,'near-power',3);
  add('far-gate','relay',1540,520,'',3);
  add('near-mine-link','relay',680,860,'near-gate',2);
  add('near-mine','mine',690,1010,'near-mine-link',2);
  if(trunk){
    add('north-link','relay',1640,410,'far-gate',3);
    add('north-gun','turret',1770,340,'north-link',2);
    add('north-beacon','beacon',1710,280,'north-link');
    add('south-link','relay',1625,690,'far-gate',3,{afterSite:'calibration'});
    add('south-mid','relay',1690,820,'south-link',3,{afterSite:'calibration'});
    add('south-link2','relay',1765,960,'south-mid',3,{afterSite:'calibration'});
    add('south-gun','turret',1900,1020,'south-link2',2,{afterSite:'calibration'});
    add('south-beacon','beacon',1840,1070,'south-link2',1,{afterSite:'calibration'});
    add('near-power','energy',590,700,'base-gun',4,{afterBuilt:'south-beacon'});
    add('north-gun','turret',1770,340,'north-link',3,{afterBuilt:'south-beacon'});
    add('south-gun','turret',1900,1020,'south-link2',3,{afterBuilt:'south-beacon'});
  }else{
    add('remote-core','core',1650,400,'far-gate');
    add('north-gun','turret',1770,340,'remote-core',2);
    add('north-beacon','beacon',1710,280,'remote-core');
    add('remote-power','energy',1670,550,'remote-core',2);
    add('south-link','relay',1625,690,'remote-power',2);
    add('south-power','energy',1690,820,'south-link',2);
    add('far-mine','mine',1660,850,'south-power',2);
    add('south-link2','relay',1765,960,'south-power',2,{afterSite:'calibration'});
    add('south-gun','turret',1900,1020,'south-link2',2,{afterSite:'calibration'});
    add('south-beacon','beacon',1840,1070,'south-link2',1,{afterSite:'calibration'});
    add('south-power','energy',1690,820,'south-link',3,{afterBuilt:'south-beacon'});
    add('south-repair','repair',1840,925,'south-link2',1,{afterBuilt:'south-beacon'});
    add('north-gun','turret',1770,340,'remote-core',3,{afterBuilt:'south-beacon'});
    add('south-gun','turret',1900,1020,'south-link2',3,{afterBuilt:'south-beacon'});
  }
  return plan;
}

/** 所有设施、升级、回收和链路均通过玩家命令付费；不修改资金、伤害、视野或任务进度。 */
export function frontierPilot(state:GameState,tech:TechState,allowed:NodeType[],strategy:FrontierStrategy):void {
  const config=state.mission?.frontier;if(!config||!state.frontier||state.gameOver||state.levelWon)return;
  let run=runs.get(state);if(!run||run.runtime!==state.frontier){run={runtime:state.frontier,plan:layout(state,strategy),block:''};runs.set(state,run);}
  const find=(step:PlanNode):GameNode|undefined=>state.nodes.find(n=>n.type===step.type&&n.status!=='destroyed'&&Math.hypot(n.x-step.x,n.y-step.y)<8);
  const byKey=(key:string):GameNode|undefined=>key==='base'?state.nodes.find(n=>n.type==='core'&&n.owner==='player'&&n.status!=='destroyed'):run!.plan.filter(s=>s.key===key).map(find).find(Boolean);
  const completed=(id:string)=>{const site=config.stations.find(s=>s.id===id);return !!site&&(state.frontier!.progress[id]??0)>=site.seconds;};
  const linkType=strategy==='trunk'?'heavy':'standard';
  for(const step of run.plan){
    if(step.afterSite&&!completed(step.afterSite))continue;
    if(step.afterBuilt&&!byKey(step.afterBuilt))continue;
    let node=find(step);
    if(step.untilSite&&completed(step.untilSite)){
      if(node?.owner==='player'&&sellNode(state,node).ok)return;
      continue;
    }
    if(!node){
      if(!allowed.includes(step.type)){run.block=`未携带 ${step.type}`;return;}
      const quote=placementStatus(state,step.type,step.x,step.y,tech);
      if(!quote.valid){run.block=`${step.key}: ${quote.reason}`;return;}
      if(step.parent&&state.resources<quote.cost+EDGE_CONFIGS[linkType].cost){run.block=`${step.key}: 等待建造及链路资金`;return;}
      const built=buildNode(state,step.type,step.x,step.y,tech);if(built.ok){run.block='';return;}run.block=built.reason;return;
    }
    if(node.owner==='neutral'){
      const result=recruitNode(state,node,tech);run.block=result.ok?'':`${step.key}: ${result.reason}`;return;
    }
    const parent=step.parent?byKey(step.parent):undefined;
    if(step.parent&&!parent){run.block=`${step.key}: 上游设施缺失`;return;}
    if(parent&&!state.edges.some(e=>(e.sourceId===parent.id&&e.targetId===node!.id)||(e.targetId===parent.id&&e.sourceId===node!.id))){
      const result=connectNodes(state,parent.id,node.id,linkType,tech);run.block=result.ok?'':`${step.key}: ${result.reason}`;return;
    }
    if(!node.connected){run.block=`${step.key}: 等待核心网络`;return;}
    if(node.level<step.level){const result=upgradeNode(state,node,tech);run.block=result.ok?'':`${step.key}: ${result.reason}`;return;}
  }
  run.block='';
}
