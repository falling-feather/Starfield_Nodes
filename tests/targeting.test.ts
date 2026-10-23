import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processNodeEffects } from '../src/graph';
import { updateVisibility } from '../src/visibility';
import { state, node, enemy } from './fixtures';

test('turrets spread fire when an existing projectile already covers a target health', () => {
  const s = state();
  s.nodes = [node('core', 400, 400), node('turret', 500, 500), node('turret', 510, 500)];
  const a = enemy('scout', 600, 500),
    b = enemy('scout', 620, 500);
  a.hp = 10;
  b.hp = 10;
  s.enemies = [a, b];
  updateVisibility(s);
  processNodeEffects(s);
  assert.equal(s.projectiles.length, 2);
  assert.equal(new Set(s.projectiles.map((p) => p.targetId)).size, 2);
});

test('aimed facility sprites follow the enemy that actually receives their shot', () => {
  for (const [type, overcharged] of [['turret', false], ['sniper', false], ['interceptor', false], ['interceptor', true]] as const) {
    const s = state(), weapon = node(type, 500, 500), target = enemy('scout', 560, 560);
    weapon.facing = -.5;
    if (overcharged) weapon.overchargeTicks = 3;
    s.nodes = [node('core', 400, 400), weapon];
    s.enemies = [target];
    updateVisibility(s);
    processNodeEffects(s);
    assert.ok(s.projectiles.some(p => p.targetId === target.id), `${type} fires`);
    assert.equal(weapon.facing, Math.PI / 4, `${type} points at its actual target`);
  }
});
