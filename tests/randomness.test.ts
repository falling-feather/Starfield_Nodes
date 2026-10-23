import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setSeed, rand } from '../src/rng';
import { createNode, updateOvercharge } from '../src/graph';
import { updateEnemies } from '../src/entities';
import { OVERCHARGE } from '../src/data/balance';
import { state, node, enemy } from './fixtures';

test('node pulse animation and overcharge particles do not alter the gameplay random stream', () => {
  const s = state(),
    station = node('energy', 500, 500);
  s.nodes = [station];
  station.overchargeBuildup = OVERCHARGE.buildup - 1;
  setSeed(52);
  const expected = rand();
  setSeed(52);
  createNode(100, 100, 'turret');
  updateOvercharge(s);
  assert.ok(s.particles.length > 0);
  assert.equal(rand(), expected);
});

test('death particles do not change the next enemy-spawn random value', () => {
  const s = state(),
    target = enemy('scout', 500, 500);
  target.hp = 0;
  s.enemies = [target];
  setSeed(53);
  const expected = rand();
  setSeed(53);
  updateEnemies(s, 1 / 60);
  assert.ok(s.particles.length > 0);
  assert.equal(rand(), expected);
});
