import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels';
import {
  initializeMap,
  distributeEnergy,
  updateConnectedStatus,
  processNodeEffects,
} from '../src/graph';
import { connectNodes, recruitNode } from '../src/construction';
import { createTechState } from '../src/tech';
import { updateVisibility, isPositionVisible } from '../src/visibility';
import { pointInPolygon } from '../src/terrain-poly';
import { secondaryObjectiveStatus } from '../src/mission-objectives';
import { state } from './fixtures';

test('a powered near-end relay scouts the partner, then powers a recruited cold remote relay', () => {
  const level = LEVELS.find((l) => l.id === 7)!,
    s = state(),
    tech = createTechState();
  s.resources = 1000;
  initializeMap(s, level);
  updateConnectedStatus(s);
  updateVisibility(s);
  const gates = s.terrainPolygons.filter((p) => p.type === 'wormhole'),
    near = gates[0],
    far = gates[1];
  const core = s.nodes.find((n) => n.type === 'core')!,
    energy = s.nodes.find((n) => n.type === 'energy' && n.owner === 'player')!;
  const local = s.nodes.find((n) => n.type === 'relay' && pointInPolygon(n.x, n.y, near))!,
    remote = s.nodes.find((n) => n.type === 'relay' && pointInPolygon(n.x, n.y, far))!;
  assert.ok(connectNodes(s, core.id, energy.id, 'standard', tech).ok);
  assert.ok(recruitNode(s, local, tech).ok);
  assert.ok(connectNodes(s, energy.id, local.id, 'standard', tech).ok);
  const tick = () => {
    s.tick++;
    s.elapsedSeconds += 0.5;
    distributeEnergy(s);
    updateConnectedStatus(s);
    processNodeEffects(s);
    updateVisibility(s);
  };
  for (let i = 0; i < 12; i++) tick();
  assert.ok(local.currentEnergy >= local.activationThreshold);
  assert.equal(isPositionVisible(s, remote.x, remote.y), true);
  assert.ok(recruitNode(s, remote, tech).ok);
  for (let i = 0; i < 20; i++) tick();
  assert.equal(remote.connected, true);
  assert.ok(remote.currentEnergy >= remote.activationThreshold);
  assert.equal(secondaryObjectiveStatus(s)!.complete, true);
});
