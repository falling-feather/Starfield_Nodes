import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEdge, processNodeEffects } from '../src/graph';
import { updateParticles } from '../src/particles';
import { updateVisibility } from '../src/visibility';
import { state, node, enemy } from './fixtures';

test('a chain strike records the actual hit path and never reveals an undetected target', () => {
  const s = state(),
    tower = node('arc', 500, 500);
  s.nodes = [node('core', 400, 400), tower];
  const a = enemy('scout', 550, 500),
    b = enemy('heavy', 620, 500),
    hidden = enemy('stealth', 540, 500);
  s.enemies = [a, b, hidden];
  updateVisibility(s);
  processNodeEffects(s);
  assert.equal(s.strikeEffects?.length, 1);
  assert.deepEqual(s.strikeEffects[0].points, [
    { x: 500, y: 500 },
    { x: 550, y: 500 },
    { x: 620, y: 500 },
  ]);
  assert.ok(a.hp < 100 && b.hp < 100);
  assert.equal(hidden.hp, 100);
  a.x = 900;
  assert.equal(s.strikeEffects[0].points[1].x, 550);
  updateParticles(s, 0.3);
  assert.equal(s.strikeEffects.length, 0);
});

test('a Tesla conductor respects both interruption and hidden-target detection', () => {
  const s = state(),
    tower = node('tesla', 500, 500),
    relay = node('relay', 650, 500);
  s.nodes = [node('core', 400, 400), tower, relay];
  const wire = createEdge(tower.id, relay.id);
  wire.disruptedTimer = 3;
  s.edges = [wire];
  const visible = enemy('scout', 550, 500),
    hidden = enemy('stealth', 550, 500);
  s.enemies = [visible, hidden];
  updateVisibility(s);
  processNodeEffects(s);
  assert.equal(visible.hp, 100);
  wire.disruptedTimer = 0;
  processNodeEffects(s);
  assert.ok(visible.hp < 100);
  assert.equal(hidden.hp, 100);
});
