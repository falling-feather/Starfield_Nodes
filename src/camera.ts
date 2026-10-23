import type { Camera, Point } from './types';

/** Frame every starting base, leaving the HUD and construction strip clear. */
export function createInitialCamera(
  worldWidth: number,
  worldHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  normalizedCores: readonly Point[] = [{ x: 0.5, y: 0.5 }],
): Camera {
  const xs = normalizedCores.map((point) => point.x * worldWidth),
    ys = normalizedCores.map((point) => point.y * worldHeight),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const zoom = Math.min(
      1,
      viewportWidth / (maxX - minX + 520),
      (viewportHeight - 200) / (maxY - minY + 460),
    ),
    x = (minX + maxX) / 2 - viewportWidth / (2 * zoom),
    y = (minY + maxY) / 2 - (viewportHeight - 56) / (2 * zoom);
  return { x, y, zoom, targetX: x, targetY: y, targetZoom: zoom };
}
