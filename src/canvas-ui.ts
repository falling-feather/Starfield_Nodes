import type { GameState } from './types';
export const UI_FONT = '"Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
export const MONO_FONT = '"Cascadia Code", Consolas, monospace';

export function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = '#0b1c2bed',
  border = '#7eafbf35',
  radius = 8,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Character-based wrapping also handles Chinese text and long unspaced labels. */
export function wrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 20,
  maxLines = 3,
): number {
  const chars = Array.from(text);
  let line = '',
    lines = 0;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (
      char === '\n' ||
      (ctx.measureText(line + char).width > width && !/[，。！？；：、）】》]/.test(char))
    ) {
      if (lines === maxLines - 1) {
        while (line && ctx.measureText(line + '…').width > width) line = line.slice(0, -1);
        ctx.fillText(line + '…', x, y + lines * lineHeight);
        return maxLines * lineHeight;
      }
      ctx.fillText(line, x, y + lines * lineHeight);
      lines++;
      line = char === '\n' ? '' : char;
    } else line += char;
  }
  if (line) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines++;
  }
  return lines * lineHeight;
}

export function minimapRect(
  width: number,
  height: number,
  worldWidth: number,
  worldHeight: number,
): { x: number; y: number; w: number; h: number } {
  const inspector = inspectorRect(width);
  const maxWidth = Math.min(232, Math.max(160, width * .15));
  const maxHeight = Math.min(168, Math.max(48, height - inspector.y - inspector.h - 184));
  const scale = Math.min(maxWidth / worldWidth, maxHeight / worldHeight);
  const w = Math.round(worldWidth * scale), h = Math.round(worldHeight * scale);
  return { x: width - w - 22, y: height - 128 - h - 24, w, h };
}

export function inspectorRect(width: number): { x: number; y: number; w: number; h: number } {
  return { x: width - 304, y: 116, w: 282, h: 230 };
}

export function objectiveRect(state: GameState, collapsed: boolean): { x: number; y: number; w: number; h: number } {
  const config = state.mission?.frontier;
  const rows = config ? config.goal.kind === 'harvest' ? config.deposits.filter(deposit => !deposit.home).length : config.stations.length : 0;
  const h = collapsed ? 108 : config ? 156 + rows * 47 : state.protectedCoreIds?.size ? 200 : 158;
  return { x: 22, y: 93, w: 300, h };
}
