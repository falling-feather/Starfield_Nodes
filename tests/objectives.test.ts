import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secondaryObjectiveStatus } from '../src/mission-objectives';
import { MISSION_TACTICS } from '../src/data/missions';
import { state, node } from './fixtures';

test('a remote observatory must be owned, powered and connected to satisfy the objective', () => {
  const s = state();
  s.mission = MISSION_TACTICS[3];
  const o = s.mission.secondaryObjective!;
  assert.equal(o.kind, 'observatory');
  if (o.kind !== 'observatory') return;
  const beacon = node('beacon', o.position.x * s.worldWidth, o.position.y * s.worldHeight);
  s.nodes = [beacon];
  beacon.owner = 'neutral';
  assert.equal(secondaryObjectiveStatus(s)!.complete, false);
  beacon.owner = 'player';
  beacon.connected = false;
  assert.equal(secondaryObjectiveStatus(s)!.complete, false);
  beacon.connected = true;
  beacon.currentEnergy = 0;
  assert.equal(secondaryObjectiveStatus(s)!.complete, false);
  beacon.currentEnergy = beacon.maxEnergy;
  assert.equal(secondaryObjectiveStatus(s)!.complete, true);
});

test('a destroyed observatory explains reconstruction and accepts a powered replacement', () => {
  const s = state();
  s.mission = MISSION_TACTICS[3];
  const objective = s.mission.secondaryObjective!;
  if (objective.kind !== 'observatory') throw Error('Wrong fixture');
  const x = objective.position.x * s.worldWidth,
    y = objective.position.y * s.worldHeight;
  const original = node('beacon', x, y);
  original.hp = 0;
  original.status = 'destroyed';
  s.nodes = [original];
  assert.match(secondaryObjectiveStatus(s)!.label, /重建/);
  assert.equal(secondaryObjectiveStatus(s)!.complete, false);
  s.nodes.push(node('beacon', x, y));
  assert.equal(secondaryObjectiveStatus(s)!.complete, true);
});
