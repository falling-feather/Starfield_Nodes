import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  updateVisibility,
  isPositionVisible,
  isPositionExplored,
  canDetectEnemy,
} from '../src/visibility';
import { state, node, enemy } from './fixtures';

test('neutral and disconnected nodes never grant vision', () => {
  const s = state();
  const neutral = node('energy', 900, 700),
    disconnected = node('turret', 1500, 700);
  neutral.owner = 'neutral';
  disconnected.connected = false;
  s.nodes = [node('core', 100, 100), neutral, disconnected];
  updateVisibility(s);
  assert.equal(isPositionVisible(s, 900, 700), false);
  assert.equal(isPositionVisible(s, 1500, 700), false);
});

test('power loss removes current vision but preserves exploration memory', () => {
  const s = state(),
    beacon = node('beacon', 1000, 700);
  s.nodes = [node('core', 100, 100), beacon];
  updateVisibility(s);
  assert.equal(isPositionVisible(s, 1100, 700), true);
  beacon.currentEnergy = 0;
  updateVisibility(s);
  assert.equal(isPositionVisible(s, 1100, 700), false);
  assert.equal(isPositionExplored(s, 1100, 700), true);
});

test('stealth requires a powered detector even inside ordinary vision', () => {
  const s = state();
  s.nodes = [node('core', 500, 500)];
  const target = enemy('stealth', 550, 500);
  updateVisibility(s);
  assert.equal(canDetectEnemy(s, target), false);
  s.nodes.push(node('beacon', 550, 500));
  updateVisibility(s);
  assert.equal(canDetectEnemy(s, target), true);
});

test('unchanged sensor information does not invalidate the fog texture every tick', () => {
  const s = state();
  s.nodes = [node('core', 500, 500)];
  updateVisibility(s);
  const revision = s.visibility.revision;
  updateVisibility(s);
  assert.equal(s.visibility.revision, revision);
  s.nodes.push(node('beacon', 800, 500));
  updateVisibility(s);
  assert.ok(s.visibility.revision > revision);
});
