import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distributeEnergy, createEdge, processNodeEffects } from '../src/graph';
import { state, node } from './fixtures';

test('a fully charged line is connected but has no fabricated energy flow', () => {
  const s = state(),
    core = node('core', 500, 500),
    target = node('turret', 620, 500);
  core.currentEnergy = core.maxEnergy;
  target.currentEnergy = target.maxEnergy;
  s.nodes = [core, target];
  s.edges = [createEdge(core.id, target.id)];
  distributeEnergy(s);
  assert.equal(s.edges[0].active, false);
  assert.equal(s.edges[0].energyFlow, 0);
});

test('scarce energy is shared equally between equal demands, independent of edge order', () => {
  const run = (reverse: boolean) => {
    const s = state(),
      core = node('core', 500, 500),
      a = node('turret', 620, 460),
      b = node('turret', 620, 540);
    core.currentEnergy = 0;
    a.currentEnergy = 0;
    b.currentEnergy = 0;
    s.nodes = [core, a, b];
    s.edges = [createEdge(core.id, a.id), createEdge(core.id, b.id)];
    if (reverse) s.edges.reverse();
    distributeEnergy(s);
    return [a.currentEnergy, b.currentEnergy];
  };
  const normal = run(false),
    reversed = run(true);
  assert.ok(normal[0] > 0);
  assert.ok(Math.abs(normal[0] - normal[1]) < 1e-8);
  assert.deepEqual(normal, reversed);
});

test('interrupted lines neither transfer nor display active flow', () => {
  const s = state(),
    core = node('core', 500, 500),
    target = node('turret', 620, 500);
  target.currentEnergy = 0;
  s.nodes = [core, target];
  const edge = createEdge(core.id, target.id);
  edge.disruptedTimer = 2;
  s.edges = [edge];
  distributeEnergy(s);
  assert.equal(target.currentEnergy, 0);
  assert.equal(edge.energyFlow, 0);
  assert.equal(edge.active, false);
});

test('routing preserves the operating reserve of a defensive consumer', () => {
  const s = state(),
    core = node('core', 500, 500),
    turret = node('turret', 620, 500),
    buffer = node('buffer', 720, 500);
  core.currentEnergy = 0;
  turret.currentEnergy = turret.activationThreshold;
  buffer.currentEnergy = 0;
  s.nodes = [core, turret, buffer];
  s.edges = [createEdge(core.id, turret.id), createEdge(turret.id, buffer.id)];
  distributeEnergy(s);
  assert.ok(turret.currentEnergy >= turret.activationThreshold);
});

test('idle projectile and drone weapons do not spend firing energy without a target', () => {
  for (const type of ['turret', 'sniper', 'factory'] as const) {
    const s = state(),
      weapon = node(type, 500, 500);
    s.tick = 12;
    s.nodes = [weapon];
    const before = weapon.currentEnergy;
    processNodeEffects(s);
    assert.equal(weapon.currentEnergy, before, type);
  }
});

test('energy-station upgrades increase actual production, not only storage capacity', () => {
  const s = state(),
    a = node('energy', 500, 500),
    b = node('energy', 700, 500);
  a.currentEnergy = 30;
  b.currentEnergy = 30;
  b.level = 3;
  s.nodes = [a, b];
  processNodeEffects(s);
  assert.equal(a.currentEnergy, 33);
  assert.equal(b.currentEnergy, 39);
});
