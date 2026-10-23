import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processMissionEvents } from '../src/mission-events';
import { createEdge } from '../src/graph';
import { MISSION_TACTICS } from '../src/data/missions';
import { state, node, enemy } from './fixtures';

test('scheduled interference is announced before interrupting a line', () => {
  const s = state();
  s.mission = MISSION_TACTICS[8];
  s.nodes = [node('core', 500, 500), node('relay', 620, 500)];
  s.edges = [createEdge(s.nodes[0].id, s.nodes[1].id)];
  s.tick = 66;
  s.elapsedSeconds = 33;
  processMissionEvents(s);
  assert.match(s.alert!.text, /即将/);
  assert.equal(s.edges[0].disruptedTimer, 0);
  s.tick = 72;
  s.elapsedSeconds = 36;
  processMissionEvents(s);
  assert.equal(s.edges[0].disruptedTimer, 3);
});
test('a boss phase transition triggers once, rather than on every frame', () => {
  const s = state();
  s.mission = MISSION_TACTICS[3];
  s.elapsedSeconds = 200;
  const boss = enemy('boss', 100, 100);
  boss.hp = 50;
  s.enemies = [boss];
  processMissionEvents(s);
  assert.equal(s.signalBlackoutUntil, 207);
  s.elapsedSeconds = 201;
  processMissionEvents(s);
  assert.equal(s.signalBlackoutUntil, 207);
});
