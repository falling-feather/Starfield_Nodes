import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialCamera } from '../src/camera';
import { LEVELS } from '../src/levels';

for (const [width, height] of [
  [1440, 900],
  [1024, 600],
]) {
  test(`all initial bases and starter facilities fit the usable ${width}×${height} battlefield`, () => {
    for (const level of LEVELS) {
      const starts = level.corePositions ?? [{ x: 0.5, y: 0.5 }];
      const cam = createInitialCamera(level.worldWidth, level.worldHeight, width, height, starts);
      for (const point of starts)
        for (const [dx, dy] of [
          [-155, 10],
          [160, 10],
          [0, 175],
          [0, -100],
        ]) {
          const sx = (point.x * level.worldWidth + dx - cam.x) * cam.zoom,
            sy = (point.y * level.worldHeight + dy - cam.y) * cam.zoom;
          assert.ok(
            sx >= 20 && sx <= width - 20,
            `level ${level.id}: horizontal clipping at ${sx}`,
          );
          assert.ok(sy >= 78 && sy <= height - 130, `level ${level.id}: HUD clipping at ${sy}`);
        }
    }
  });
}
