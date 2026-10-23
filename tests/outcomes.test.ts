import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missionOutcome } from '../src/mission-objectives';
import { LEVELS } from '../src/levels';
import { state, node } from './fixtures';

test('a core lost on the winning frame remains a loss', () => {
  const s = state(),
    core = node('core', 500, 500);
  core.status = 'destroyed';
  core.hp = 0;
  s.nodes = [core];
  s.wave = 11;
  assert.equal(missionOutcome(s, LEVELS.find(l => l.id === 1)!, false), 'lost');
});
test('removing one protected initial core cannot bypass the protection objective', () => {
  const s = state(),
    a = node('core', 500, 500),
    b = node('core', 900, 500);
  s.nodes = [a, b];
  s.protectedCoreIds = new Set([a.id, b.id]);
  s.wave = 30;
  assert.equal(missionOutcome(s, LEVELS.find(l => l.id === 5)!, false), 'won');
  s.nodes = [b];
  assert.equal(missionOutcome(s, LEVELS.find(l => l.id === 5)!, false), 'lost');
});
test('defeating a boss alone does not bypass a disconnected remote observatory', () => {
  const s = state();
  s.mission = LEVELS.find(l => l.id === 3)!.tactics;
  s.nodes = [node('core', 500, 500)];
  assert.equal(missionOutcome(s, LEVELS.find(l => l.id === 3)!, true), null);
  const o = s.mission!.secondaryObjective!;
  if (o.kind !== 'observatory') throw Error('Wrong fixture');
  s.nodes.push(node('beacon', o.position.x * s.worldWidth, o.position.y * s.worldHeight));
  assert.equal(missionOutcome(s, LEVELS.find(l => l.id === 3)!, true), 'won');
});
