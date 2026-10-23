import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuLayout, pageWindow, pageForIndex, moveGridFocus } from '../src/screen-layout';
import { minimapRect, inspectorRect } from '../src/canvas-ui';

test('desktop configurations reserve readable cards and navigation inside the available screen', () => {
  for (const [width, height] of [[1024, 640], [1366, 768], [1920, 1080]]) {
    const layout = menuLayout(width, height);
    assert.ok(layout.cardWidth >= 220, `${width}: card width`);
    assert.ok(layout.cardHeight >= 168, `${height}: card height`);
    assert.ok(layout.columns >= 2 && layout.columns <= 4);
    assert.ok(layout.rows >= 1 && layout.rows <= 3);
    assert.ok(layout.header + layout.footer + layout.padding * 2 + layout.contentHeight <= height);
    assert.equal(layout.pageSize, layout.columns * layout.rows);
  }
  assert.equal(menuLayout(1024, 640).pageSize, 4);
});

test('pagination keeps every facility reachable and retains the focused item across resizing', () => {
  const count = 23, capacity = 4, visited: number[] = [];
  for (let page = 0; page < Math.ceil(count / capacity); page++) {
    const window = pageWindow(count, capacity, page);
    visited.push(...Array.from({ length: window.end - window.start }, (_, i) => window.start + i));
  }
  assert.deepEqual(visited, Array.from({ length: count }, (_, i) => i));
  for (const viewport of [[1024, 640], [1366, 768], [1920, 1080]]) {
    const size = menuLayout(viewport[0], viewport[1]).pageSize;
    const window = pageWindow(count, size, pageForIndex(18, count, size));
    assert.ok(window.start <= 18 && window.end > 18);
  }
  assert.deepEqual(pageWindow(0, 4, 5), { page: 0, pages: 1, start: 0, end: 0 });
  assert.equal(moveGridFocus(2, 'ArrowDown', 11, 3), 5);
  assert.equal(moveGridFocus(0, 'ArrowLeft', 11, 3), 10);
  assert.equal(moveGridFocus(8, 'ArrowDown', 11, 4), 0);
  assert.equal(moveGridFocus(3, 'ArrowUp', 11, 4), 7);
});

test('the tactical map and its caption stay below the inspector for any world aspect ratio', () => {
  for (const [width, height] of [[1024, 640], [1366, 768], [1920, 1080]]) {
    const inspector = inspectorRect(width);
    for (const [worldWidth, worldHeight] of [[1800, 1200], [2000, 1400], [2200, 1400], [1000, 1800]]) {
      const map = minimapRect(width, height, worldWidth, worldHeight);
      assert.ok(map.y - 18 > inspector.y + inspector.h, `${width}×${height}: clear map caption`);
      assert.ok(map.y + map.h <= height - 140);
      assert.ok(map.x >= 0 && map.x + map.w <= width - 20);
      assert.ok(Math.abs(map.w / map.h - worldWidth / worldHeight) < .02);
    }
  }
});
