/** 菜单用真实可用空间决定分页，不靠滚动或压缩正文解决溢出。 */
export function menuLayout(width: number, height: number) {
  const gutter = width >= 1600 ? Math.max(64, (width - 1510) / 2) : width <= 1150 ? 28 : Math.round(width * .042);
  const header = height < 700 ? 72 : height < 850 ? 84 : 96;
  const footer = height < 700 ? 40 : 48, padding = height < 700 ? 16 : 24;
  const sidebar = width < 1150 ? 276 : 300, gap = 24, cardGap = 12;
  const contentWidth = width - gutter * 2, contentHeight = height - header - footer - padding * 2;
  const mainWidth = contentWidth - sidebar - gap;
  const columns = Math.max(1, Math.min(4, Math.floor((mainWidth + cardGap) / 232)));
  const cardAreaHeight = contentHeight - 90 - 44;
  const rows = Math.max(1, Math.min(3, Math.floor((cardAreaHeight + cardGap) / 180)));
  return { gutter, header, footer, padding, sidebar, gap, contentWidth, contentHeight, columns, rows,
    pageSize: columns * rows, cardWidth: (mainWidth - (columns - 1) * cardGap) / columns,
    cardHeight: (cardAreaHeight - (rows - 1) * cardGap) / rows };
}
export interface PageWindow { page: number; pages: number; start: number; end: number }
export function pageWindow(total: number, capacity: number, requested: number): PageWindow {
  const size = Math.max(1, capacity), pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(0, Math.min(pages - 1, requested));
  return { page, pages, start: page * size, end: Math.min(total, (page + 1) * size) };
}
export function pageForIndex(index: number, total: number, capacity: number): number {
  return Math.floor(Math.max(0, Math.min(total - 1, index)) / Math.max(1, capacity));
}
export function moveGridFocus(index: number, key: string, count: number, columns: number): number {
  if (!count) return 0;
  if (key === 'ArrowDown') return index + columns < count ? index + columns : index % columns;
  if (key === 'ArrowUp') return index >= columns ? index - columns : index + Math.floor((count - 1 - index) / columns) * columns;
  const delta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  return ((index + delta) % count + count) % count;
}
