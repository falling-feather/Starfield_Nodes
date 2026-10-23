import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNode, connectNodes, upgradeNode, recruitNode, sellNode } from '../src/construction';
import { createTechState, researchTech } from '../src/tech';
import { updateVisibility } from '../src/visibility';
import { state, node } from './fixtures';

test('building and connecting use the same rules and update paused planning feedback immediately', () => {
  const s = state(),
    core = node('core', 500, 500),
    tech = createTechState();
  s.nodes = [core];
  updateVisibility(s);
  const build = buildNode(s, 'energy', 650, 500, tech);
  assert.ok(build.ok);
  if (!build.ok) return;
  assert.equal(s.resources, 176);
  assert.equal(build.value.connected, false);
  const connect = connectNodes(s, core.id, build.value.id, 'standard', tech);
  assert.ok(connect.ok);
  assert.equal(s.resources, 171);
  assert.equal(build.value.connected, true);
  assert.equal(s.resourcesSpent, 29);
  assert.equal(connectNodes(s, core.id, build.value.id, 'standard', tech).ok, false);
  assert.equal(s.resources, 171);
});
test('a researched structural bonus applies to new buildings and survives upgrading', () => {
  const s = state(),
    core = node('core', 500, 500),
    tech = createTechState();
  s.resources = 1000;
  s.nodes = [core];
  updateVisibility(s);
  tech.tree.find((t) => t.id === 'reinforced_nodes')!.unlocked = true;
  const built = buildNode(s, 'turret', 650, 500, tech);
  assert.ok(built.ok);
  if (!built.ok) return;
  connectNodes(s, core.id, built.value.id, 'standard', tech);
  assert.ok(upgradeNode(s, built.value, tech).ok);
  assert.equal(built.value.level, 2);
  assert.equal(built.value.hp, built.value.maxHp);
});
test('an unseen neutral station cannot be recruited as a way to scout the map', () => {
  const s = state();
  s.nodes = [node('core', 100, 100), node('relay', 1700, 1100)];
  s.nodes[1].owner = 'neutral';
  updateVisibility(s);
  assert.equal(recruitNode(s, s.nodes[1], createTechState()).ok, false);
  assert.equal(s.resources, 200);
});

test('recycling rejects neutral and protected facilities, but lets a player recover a disconnected building', () => {
  const s = state(),
    core = node('core', 500, 500),
    a = node('energy', 620, 500);
  s.nodes = [core, a];
  a.owner = 'neutral';
  updateVisibility(s);
  assert.equal(sellNode(s, a).ok, false);
  assert.equal(s.resources, 200);
  a.owner = 'player';
  a.connected = false;
  assert.equal(sellNode(s, a).ok, true);
  assert.equal(s.resources, 215);
  assert.equal(sellNode(s, a).ok, false);
  assert.equal(s.resources, 215);
  s.nodes.push(node('core', 800, 500));
  s.protectedCoreIds = new Set([core.id]);
  assert.equal(sellNode(s, core).ok, false);
});

test('the spending ledger counts a successful research once and excludes a rejected repeat', () => {
  const s=state(),tech=createTechState();s.resources=1000;
  const choice=tech.tree.find(t=>t.requires.length===0)!;
  assert.equal(researchTech(choice.id,tech,s),true);
  assert.equal(s.resourcesSpent,1000-s.resources);
  const spent=s.resourcesSpent;assert.equal(researchTech(choice.id,tech,s),false);assert.equal(s.resourcesSpent,spent);
});
