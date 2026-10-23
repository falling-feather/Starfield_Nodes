import type { FrontierStation, GameNode, GameState, MineralDeposit, Point } from './types';
import { ENERGY_COSTS } from './data/balance';
import { TICK_INTERVAL } from './data/runtime';
import { isWormholeHubActive } from './terrain-poly';

const STEP = TICK_INTERVAL / 1000;
export function mineralAt(state: GameState, point: Point): MineralDeposit | undefined {
  return state.mission?.frontier?.deposits.find(d => Math.hypot(point.x-d.x,point.y-d.y) <= d.radius);
}
export function mineYield(state: GameState, node: GameNode): number {
  const deposit = mineralAt(state, node);
  if (!deposit || !node.connected || node.owner !== 'player' || node.status === 'destroyed' || node.currentEnergy < Math.max(node.activationThreshold,ENERGY_COSTS.mine)) return 0;
  return deposit.perSecond * STEP * (1 + (node.level - 1) * .16 + (node.evolved ? .3 : 0));
}
export function recordMining(state: GameState, mine: GameNode): number {
  const output = mineYield(state, mine), deposit = mineralAt(state,mine), runtime = state.frontier;
  if (!runtime || !deposit || !output) return 0;
  runtime.mined[deposit.id] = (runtime.mined[deposit.id] ?? 0) + output;
  if (!deposit.home) runtime.harvested += output;
  return output;
}
export type StationStatus = { kind:'complete'|'missing'|'disconnected'|'unpowered'|'locked'|'gate'|'working'; label:string; node?:GameNode; progress:number };
export function stationStatus(state: GameState, site: FrontierStation): StationStatus {
  const progress=state.frontier?.progress[site.id] ?? 0;
  const status=(kind:StationStatus['kind'],label:string,node?:GameNode):StationStatus=>({kind,label,node,progress});
  if(progress>=site.seconds) return status('complete','数据已保存');
  if(site.after && (state.frontier?.progress[site.after] ?? 0) < (state.mission!.frontier!.stations.find(s=>s.id===site.after)!.seconds)) return status('locked','先完成前一阶段');
  const candidates=state.nodes.filter(n=>n.owner==='player'&&n.type===site.nodeType&&n.status!=='destroyed'&&Math.hypot(n.x-site.x,n.y-site.y)<=site.radius);
  if(!candidates.length) return status('missing',`在标记范围内建造${site.nodeType==='beacon'?'信标':'中继'}`);
  const node=candidates.find(n=>n.connected&&n.currentEnergy>=n.activationThreshold+site.energyPerTick) ?? candidates.find(n=>n.connected) ?? candidates[0];
  if(!node.connected) return status('disconnected','线路未接入核心',node);
  if(site.needsGate&&!state.nodes.some(n=>n.type==='relay'&&n.owner==='player'&&n.connected&&n.currentEnergy>=n.activationThreshold&&isWormholeHubActive(state,n.x,n.y,['relay']))) return status('gate','等待双端虫洞中继供电',node);
  if(node.currentEnergy<node.activationThreshold+site.energyPerTick) return status('unpowered','供电不足 · 进度保留',node);
  return status('working',`持续供电 · ${site.energyPerTick * 2} 能量/秒`,node);
}
/** 每个经济 Tick 扣除实际任务能量；已完成数据与部分进度不随断电、回收或重建丢失。 */
export function advanceFrontier(state: GameState): void {
  const config=state.mission?.frontier,runtime=state.frontier;
  if(!config||!runtime||state.gameOver||state.levelWon) return;
  state.resources += .35 * STEP; // 单份低速应急补给，不随核心数或矿机等级叠加。
  for(const site of config.stations){
    const status=stationStatus(state,site);
    if(status.kind!=='working') {
      if(status.node && ['unpowered','disconnected','gate'].includes(status.kind)) runtime.powerWaitTicks++;
      continue;
    }
    runtime.workingTicks++;
    runtime.lastWorked[site.id]=state.tick;
    status.node!.currentEnergy -= site.energyPerTick;
    runtime.progress[site.id]=Math.min(site.seconds,status.progress+STEP);
  }
}
/** 反馈已结算 Tick 的真实工作，避免扣费后的储能被误报为停工。 */
export function stationDisplayStatus(state:GameState,site:FrontierStation):StationStatus {
  const result=stationStatus(state,site);
  if(result.kind==='unpowered'&&state.frontier?.lastWorked[site.id]===state.tick&&result.node!.currentEnergy>=result.node!.activationThreshold)
    return {...result,kind:'working',label:`持续供电 · ${site.energyPerTick * 2} 能量/秒`};
  return result;
}
export function frontierStatus(state: GameState): { complete:boolean; ratio:number; label:string; detail:string } | null {
  const config=state.mission?.frontier,runtime=state.frontier;
  if(!config||!runtime)return null;
  if(config.goal.kind==='harvest'){
    const amount=config.goal.amount,harvested=runtime.harvested;
    return { complete:harvested>=amount,ratio:Math.min(1,harvested/amount),label:`远端开采 ${Math.floor(harvested)} / ${amount}`,detail:'仅计算基地外矿脉 · 消费资源不扣任务进度' };
  }
  const completed=config.stations.filter(s=>(runtime.progress[s.id]??0)>=s.seconds).length;
  const best=config.stations.map(s=>Math.min(1,(runtime.progress[s.id]??0)/s.seconds)).sort((a,b)=>b-a).slice(0,config.goal.count);
  return {complete:completed>=config.goal.count,ratio:best.reduce((a,b)=>a+b,0)/config.goal.count,label:`已恢复 ${completed} / ${config.goal.count} 处设施`,detail:config.stations.some(s=>s.after)?'分阶段供电 · 已完成阵地可以回收转场':'任意两处即可 · 可并行观测或逐处转场'};
}
