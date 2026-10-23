import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, node, enemy } from './fixtures';
import { FRONTIER_LEVELS } from '../src/data/frontier-levels';
import { initializeMap, createEdge, processNodeEffects, distributeEnergy, updateConnectedStatus } from '../src/graph';
import { createTechState } from '../src/tech';
import { placementStatus, buildNode, sellNode, sellQuote } from '../src/construction';
import { updateVisibility, canDetectEnemy } from '../src/visibility';
import { updateEnemies } from '../src/entities';
import { advanceFrontier, frontierStatus, mineYield, stationStatus } from '../src/frontier';
import { turretAttackRange, hasFiringLine } from '../src/weapon-geometry';
import { buildTerrainPolygon } from '../src/terrain-poly';
import { missionOutcome } from '../src/mission-objectives';

function expedition(index = 0) {
  const s = state();
  const level = FRONTIER_LEVELS[index];
  s.resources = level.startResources;
  initializeMap(s, level);
  updateConnectedStatus(s);
  updateVisibility(s);
  s.visibility.explored.fill(1);
  return { s, level, tech: createTechState() };
}

test('frontier mines use exclusive mineral deposits while other construction remains free', () => {
  const { s, tech } = expedition();
  assert.match(placementStatus(s, 'mine', 200, 200, tech).reason, /矿脉/);
  assert.equal(placementStatus(s, 'turret', 200, 200, tech).valid, true);
  const deposit = s.mission!.frontier!.deposits.find(d => !d.home)!;
  const first = buildNode(s, 'mine', deposit.x, deposit.y, tech);
  assert.equal(first.ok, true);
  assert.match(placementStatus(s, 'mine', deposit.x + 65, deposit.y, tech).reason, /占用/);
  if (first.ok) {
    sellNode(s, first.value);
    assert.equal(placementStatus(s, 'mine', deposit.x, deposit.y, tech).valid, true);
  }
});

test('home income never advances the remote extraction objective; off-grid mines yield nothing', () => {
  const { s } = expedition();
  const home = s.nodes.find(n => n.type === 'mine')!;
  assert.ok(mineYield(s, home) > 0);
  for (let i = 0; i < 20; i++) { processNodeEffects(s); advanceFrontier(s); }
  assert.equal(s.frontier!.harvested, 0);
  assert.equal(frontierStatus(s)!.complete, false);
  const d = s.mission!.frontier!.deposits.find(d => !d.home)!;
  const mine = node('mine', d.x, d.y);
  mine.connected = false;
  s.nodes.push(mine);
  assert.equal(mineYield(s, mine), 0);
});

test('an upgraded mine improves a fixed deposit without exponential income', () => {
  const { s } = expedition();
  const d = s.mission!.frontier!.deposits.find(d => !d.home)!;
  const mine = node('mine', d.x, d.y);
  s.nodes.push(mine);
  const base = mineYield(s, mine);
  mine.level = 5; mine.evolved = true;
  assert.ok(mineYield(s, mine) > base && mineYield(s, mine) <= base * 2.5);
  const before = s.frontier!.harvested;
  processNodeEffects(s);
  assert.ok(s.frontier!.harvested > before);
});

test('survey progress spends real energy, pauses on a severed network and survives rebuilding', () => {
  const { s } = expedition(1);
  const site = s.mission!.frontier!.stations[0];
  const beacon = node(site.nodeType, site.x, site.y);
  s.nodes.push(beacon);
  assert.equal(stationStatus(s, site).kind, 'working');
  const energy = beacon.currentEnergy;
  advanceFrontier(s);
  assert.ok(beacon.currentEnergy < energy);
  const progress = s.frontier!.progress[site.id];
  assert.ok(progress > 0);
  beacon.connected = false;
  advanceFrontier(s);
  assert.equal(s.frontier!.progress[site.id], progress);
  beacon.status = 'destroyed';
  assert.equal(stationStatus(s, site).kind, 'missing');
  s.nodes.push(node(site.nodeType, site.x, site.y));
  advanceFrontier(s);
  assert.ok(s.frontier!.progress[site.id] > progress);
});

test('survey permits any two sites, including sequential operation, but waiting waves does not win', () => {
  const { s, level } = expedition(1);
  s.wave = 100;
  assert.equal(missionOutcome(s, level, false), null);
  const sites = s.mission!.frontier!.stations;
  for (const site of [sites[0], sites[2]]) {
    const beacon = node(site.nodeType, site.x, site.y);
    s.nodes.push(beacon);
    for (let i = 0; i < site.seconds * 2; i++) {
      beacon.currentEnergy = beacon.maxEnergy;
      advanceFrontier(s);
    }
    beacon.status = 'destroyed';
  }
  assert.equal(frontierStatus(s)!.complete, true);
  assert.equal(missionOutcome(s, level, false), 'won');
  s.nodes.find(n => n.type === 'core')!.status = 'destroyed';
  assert.equal(missionOutcome(s, level, false), 'lost');
});

test('ordinary tower coverage stays local through level, evolution and research', () => {
  const s = state(), tower = node('turret', 100, 100);
  const start = turretAttackRange(s, tower);
  tower.level = 5; tower.evolved = true;
  assert.ok(turretAttackRange(s, tower, 1.3) <= start * 2.2);
});

test('rocks block direct fire and projectiles; support drones retain an indirect role', () => {
  const s = state();
  s.nodes = [node('core', 200, 200), node('turret', 250, 200)];
  s.enemies = [enemy('scout', 400, 200)];
  s.terrainPolygons = [buildTerrainPolygon({ type:'asteroid', vertices:[[310,100],[330,100],[330,300],[310,300]] })];
  updateVisibility(s);
  assert.equal(hasFiringLine(s, s.nodes[1], s.enemies[0]), false);
  processNodeEffects(s);
  assert.equal(s.projectiles.length, 0);
  s.terrainPolygons = [];
  processNodeEffects(s);
  assert.equal(s.projectiles.length, 1);
});

test('support drones can attack beyond rock cover at their own configured range', () => {
  const s=state();s.nodes=[node('core',200,200),node('factory',250,200)];s.enemies=[enemy('swarm',530,200)];
  s.terrainPolygons=[buildTerrainPolygon({type:'asteroid',vertices:[[310,100],[340,100],[340,300],[310,300]]})];
  updateVisibility(s);processNodeEffects(s);
  assert.ok(s.enemies[0].hp<100);
});

test('wormhole relays carry bounded real energy and bootstrap the remote side', () => {
  const { s } = expedition(2);
  const gates = s.terrainPolygons.filter(p => p.type === 'wormhole');
  const relays = gates.map(g => s.nodes.find(n => n.type === 'relay' && Math.hypot(n.x-g.centroid.x,n.y-g.centroid.y)<10)!);
  const core = s.nodes.find(n => n.type === 'core')!;
  for (const relay of relays) relay.owner = 'player';
  s.edges = [createEdge(core.id, relays[0].id)];
  relays[0].currentEnergy = relays[0].maxEnergy;
  relays[1].currentEnergy = 0;
  updateConnectedStatus(s);
  distributeEnergy(s);
  assert.ok(relays[1].currentEnergy > 0 && relays[1].currentEnergy <= 14);
  assert.ok(relays[0].currentEnergy >= relays[0].activationThreshold);
});

test('redeployment refunds actual spending and discounted construction cannot mint resources', () => {
  const {s,tech}=expedition();
  tech.tree.find(t=>t.effect.type==='reduce_cost')!.unlocked=true;
  const before=s.resources;
  const built=buildNode(s,'relay',460,730,tech);
  assert.equal(built.ok,true);
  if(!built.ok)return;
  const paid=before-s.resources,refund=sellQuote(s,built.value).refund;
  assert.equal(refund,Math.floor(paid*.75));
  sellNode(s,built.value);
  assert.ok(s.resources<before);
});

test('stealth attackers briefly reveal themselves on contact, so a base can retaliate', () => {
  const s=state(),core=node('core',500,500),attacker=enemy('stealth',502,500);
  s.nodes=[core];s.enemies=[attacker];updateVisibility(s);
  assert.equal(canDetectEnemy(s,attacker),false);
  updateEnemies(s,1/60);
  assert.ok(core.hp<core.maxHp);
  assert.equal(canDetectEnemy(s,attacker),true);
  s.elapsedSeconds=2;
  assert.equal(canDetectEnemy(s,attacker),false);
});

test('relay upgrades reduce trunk resistance without creating energy or bypassing link capacity', () => {
  function transfer(level:number){
    const s=state(),core=node('core',300,300),relay=node('relay',450,300),load=node('beacon',600,300);
    core.currentEnergy=0;relay.level=level;relay.maxEnergy=76;relay.currentEnergy=60.8;load.currentEnergy=25;
    s.nodes=[core,relay,load];s.edges=[createEdge(core.id,relay.id,'heavy'),createEdge(relay.id,load.id,'heavy')];
    const before=s.nodes.reduce((a,n)=>a+n.currentEnergy,0);distributeEnergy(s);
    assert.ok(s.nodes.reduce((a,n)=>a+n.currentEnergy,0)<=before+15.00001);
    assert.ok(s.edges[1].energyFlow<=s.edges[1].throughput);
    return s.edges[1].energyFlow;
  }
  assert.ok(transfer(3)>transfer(1));
});

test('repair stations spend energy on actual repairs and keep their reserve when nobody is hurt', () => {
  const s=state(),core=node('core',400,400),repair=node('repair',500,400);s.nodes=[core,repair];
  const energy=repair.currentEnergy;processNodeEffects(s);assert.equal(repair.currentEnergy,energy);
  core.hp-=40;const hp=core.hp;processNodeEffects(s);assert.ok(core.hp>hp);assert.ok(repair.currentEnergy<energy);
});

test('a mine at its activation threshold produces instead of burning its supply for no output', () => {
  const {s}=expedition(),d=s.mission!.frontier!.deposits.find(d=>!d.home)!;
  const mine=node('mine',d.x,d.y);mine.currentEnergy=mine.activationThreshold;s.nodes=[s.nodes[0],mine];
  const resources=s.resources;processNodeEffects(s);assert.ok(s.resources>resources);assert.equal(mine.currentEnergy,mine.activationThreshold-5);
});

test('a projectile travels to an obstacle before being blocked and cannot damage through it', () => {
  const s=state(),target=enemy('scout',400,200);s.nodes=[node('core',200,200)];s.enemies=[target];
  s.terrainPolygons=[buildTerrainPolygon({type:'asteroid',vertices:[[310,100],[330,100],[330,300],[310,300]]})];
  s.projectiles=[{x:250,y:200,targetId:target.id,speed:8,damage:22,color:'#fff'}];
  updateEnemies(s,1/60);assert.equal(s.projectiles.length,1);
  for(let i=0;i<12;i++)updateEnemies(s,1/60);
  assert.equal(s.projectiles.length,0);assert.equal(target.hp,100);
});

test('a passive line converges instead of swapping stored energy forever', () => {
  const s=state(),core=node('core',100,300),a=node('relay',250,300),b=node('relay',400,300);
  a.maxEnergy=b.maxEnergy=100;a.currentEnergy=65;b.currentEnergy=35;
  const root=createEdge(core.id,a.id,'heavy');root.throughput=0;
  s.nodes=[core,a,b];s.edges=[root,createEdge(a.id,b.id,'heavy')];
  for(let i=0;i<60;i++)distributeEnergy(s);
  assert.ok(Math.abs(a.currentEnergy-b.currentEnergy)<.6);
  assert.ok(Math.abs(a.currentEnergy+b.currentEnergy-100)<.00001);
});

test('researched core production adds real energy and respects storage capacity', () => {
  const s=state(),core=node('core',300,300);s.nodes=[core];core.currentEnergy=0;
  const bonus={damageMultiplier:1,rangeMultiplier:1,coreProduction:10};processNodeEffects(s,bonus);assert.equal(core.currentEnergy,10);
  core.currentEnergy=195;processNodeEffects(s,bonus);assert.equal(core.currentEnergy,200);
});

test('a branched grid converges without losing energy or starving one equal branch', () => {
  const s=state(),core=node('core',100,500),hub=node('relay',250,500);hub.maxEnergy=100;hub.currentEnergy=100;hub.level=3;
  const leaves=Array.from({length:5},(_,i)=>{const n=node('relay',400,300+i*80);n.maxEnergy=100;n.currentEnergy=0;return n;});
  const root=createEdge(core.id,hub.id,'heavy');root.throughput=0;s.nodes=[core,hub,...leaves];s.edges=[root,...leaves.map(n=>createEdge(hub.id,n.id,'heavy'))];
  for(let i=0;i<100;i++)distributeEnergy(s);
  const values=[hub,...leaves].map(n=>n.currentEnergy);
  assert.ok(Math.max(...values)-Math.min(...values)<.7);
  assert.ok(Math.abs(values.reduce((a,b)=>a+b,0)-100)<.00001);
});

test('an independent far core preserves a local circuit when the incoming gate trunk is severed', () => {
  const s=state(),core=node('core',100,300),plant=node('energy',200,300),near=node('relay',300,300),far=node('relay',1000,300),beacon=node('beacon',1180,300);
  s.terrainPolygons=[buildTerrainPolygon({id:'a',linkedId:'b',type:'wormhole',vertices:[[270,270],[330,270],[330,330],[270,330]]}),buildTerrainPolygon({id:'b',linkedId:'a',type:'wormhole',vertices:[[970,270],[1030,270],[1030,330],[970,330]]})];
  s.nodes=[core,plant,near,far,beacon];const incoming=createEdge(plant.id,near.id);s.edges=[createEdge(core.id,plant.id),incoming,createEdge(far.id,beacon.id)];updateConnectedStatus(s);assert.equal(beacon.connected,true);
  incoming.disruptedTimer=3;updateConnectedStatus(s);assert.equal(beacon.connected,false);
  const remote=node('core',1100,400);s.nodes.push(remote);s.edges.push(createEdge(remote.id,far.id),createEdge(remote.id,beacon.id));updateConnectedStatus(s);assert.equal(beacon.connected,true);
});

test('multiple freely placed gate relays share one channel and all receive energy', () => {
  const s=state(),core=node('core',150,300),a=node('relay',300,300),b=node('relay',300,336),c=node('relay',1000,300),d=node('relay',1000,336);
  c.currentEnergy=d.currentEnergy=0;
  s.terrainPolygons=[buildTerrainPolygon({id:'a',linkedId:'b',type:'wormhole',vertices:[[260,260],[340,260],[340,340],[260,340]]}),buildTerrainPolygon({id:'b',linkedId:'a',type:'wormhole',vertices:[[960,260],[1040,260],[1040,340],[960,340]]})];
  s.nodes=[core,a,b,c,d];s.edges=[createEdge(core.id,a.id),createEdge(core.id,b.id)];updateConnectedStatus(s);
  const before=s.nodes.reduce((n,p)=>n+p.currentEnergy,0);distributeEnergy(s);
  assert.equal(c.connected,true);assert.equal(d.connected,true);assert.ok(c.currentEnergy>0&&d.currentEnergy>0);
  assert.ok(c.currentEnergy+d.currentEnergy<=14.00001);
  assert.ok(Math.abs(before-s.nodes.reduce((n,p)=>n+p.currentEnergy,0))<.00001);
});
