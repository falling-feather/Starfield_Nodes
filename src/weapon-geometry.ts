import type { GameNode, GameState, Point } from './types';
import { COMBAT, TERRAIN_SYNERGY } from './data/balance';
import { isNearAsteroidPolygonEdge, lineBlockedByAsteroidPolygon } from './terrain-poly';

export function hasFiringLine(state: GameState, a: Point, b: Point): boolean {
  if(lineBlockedByAsteroidPolygon(state,a.x,a.y,b.x,b.y)) return false;
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  return !state.terrainZones.some(z=>{
    if(z.type!=='asteroid')return false;
    const t=len?Math.max(0,Math.min(1,((z.x-a.x)*dx+(z.y-a.y)*dy)/len)):0;
    return Math.hypot(z.x-a.x-t*dx,z.y-a.y-t*dy)<=z.radius;
  });
}
function edgeBonus(state:GameState,node:GameNode):number {
  return isNearAsteroidPolygonEdge(state,node.x,node.y,TERRAIN_SYNERGY.asteroidEdgeRange)?TERRAIN_SYNERGY.asteroidTurretRangeBonus:1;
}
export function turretAttackRange(state:GameState,node:GameNode,multiplier=1):number {
  return (COMBAT.turret.rangeBase+COMBAT.turret.rangePerLevel*(node.level-1))*multiplier*(node.evolved?COMBAT.turret.evolvedRangeMult:1)*edgeBonus(state,node);
}
export function sniperAttackRange(state:GameState,node:GameNode,multiplier=1):number {
  return (COMBAT.sniper.rangeBase+COMBAT.sniper.rangePerLevel*node.level)*multiplier*(node.evolved?1.2:1)*edgeBonus(state,node);
}
export function factoryAttackRange(multiplier=1):number { return COMBAT.factory.range*multiplier; }
