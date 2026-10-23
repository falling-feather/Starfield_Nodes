import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementStatus, connectNodes } from '../src/construction';
import { createTechState } from '../src/tech';
import { updateVisibility } from '../src/visibility';
import { state, node } from './fixtures';

test('construction quote applies both territory and researched economy bonuses', () => {
  const s = state();
  s.nodes = [node('core', 500, 500)];
  updateVisibility(s);
  const tech = createTechState();
  tech.tree.find((t) => t.id === 'economic_boom')!.unlocked = true;
  const quote = placementStatus(s, 'energy', 650, 500, tech);
  assert.equal(quote.valid, true);
  assert.equal(quote.cost, 16);
});
test('unknown territory is not a back door to unlimited scouting by construction', () => {
  const s = state();
  s.nodes = [node('core', 500, 500)];
  updateVisibility(s);
  assert.equal(placementStatus(s, 'beacon', 1700, 1200, createTechState()).valid, false);
});
test('a quoted position on an existing structure is rejected', () => {
  const s = state();
  s.nodes = [node('core', 500, 500)];
  updateVisibility(s);
  assert.equal(placementStatus(s, 'turret', 500, 500, createTechState()).valid, false);
});

test('connection failures explain the actual obstacle and never charge a rejected action', () => {
  const s = state(), core = node('core', 500, 400), relay = node('relay', 900, 400), tech = createTechState();
  s.nodes = [core, relay];
  const funds = s.resources;
  const tooFar = connectNodes(s, core.id, relay.id, 'standard', tech);
  assert.ok(!tooFar.ok && /距离.*中继/.test(tooFar.reason));
  assert.equal(s.resources, funds);
  relay.x = 600; relay.owner = 'neutral';
  const neutral = connectNodes(s, core.id, relay.id, 'standard', tech);
  assert.ok(!neutral.ok && /接管/.test(neutral.reason));
  relay.owner = 'player';
  s.terrainZones = [{ id: 'rock', type: 'asteroid', x: 550, y: 400, radius: 20 }];
  const blocked = connectNodes(s, core.id, relay.id, 'standard', tech);
  assert.ok(!blocked.ok && /岩带/.test(blocked.reason));
  s.terrainZones = [];
  assert.ok(connectNodes(s, core.id, relay.id, 'standard', tech).ok);
  const after = s.resources;
  const duplicate = connectNodes(s, core.id, relay.id, 'standard', tech);
  assert.ok(!duplicate.ok && /已有/.test(duplicate.reason));
  assert.equal(s.resources, after);
});
