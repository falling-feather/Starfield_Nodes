// 主题选择面板：DOM 浮层，独立于 canvas 渲染循环
// 通过 Shift+T 唤出/关闭；点击或方向键+Enter 切换；Esc/点击遮罩关闭。
import { listThemes, getThemeName, applyTheme, themeBus } from './themes';
import { COLORS, FONT, withAlpha } from './ui-tokens';
import { pushModal } from './focus-stack';

let overlay: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let disposeModal: (() => void) | null = null;
let themeChangeHandler: (() => void) | null = null;
let highlightIdx = 0;
/** V1.2.5：缓存 item 元素，避免 mouseenter → renderList 整体重建导致无限循环 */
let itemEls: HTMLDivElement[] = [];

function buildOverlay(): void {
  overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99998;
    background: ${withAlpha(COLORS.bg.pure, 0.55)};
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 180ms ease-out;
    backdrop-filter: blur(2px);
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeThemePicker();
  });

  panel = document.createElement('div');
  panel.style.cssText = `
    min-width: 280px; padding: 20px 24px;
    background: ${COLORS.bg.panel};
    border: 1px solid ${COLORS.border.cyanFaint};
    border-radius: 8px;
    box-shadow: 0 8px 32px ${withAlpha(COLORS.accent.cyan, 0.25)};
    font-family: ${FONT.body};
    color: ${COLORS.text.primary};
    transform: translateY(-8px);
    transition: transform 180ms ease-out;
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  buildList();

  requestAnimationFrame(() => {
    if (overlay) overlay.style.opacity = '1';
    if (panel) panel.style.transform = 'translateY(0)';
  });
}

/** 一次性构建所有 item，仅在打开/主题色变化时重建 */
function buildList(): void {
  if (!panel) return;
  const themes = listThemes();
  const current = getThemeName();
  highlightIdx = Math.max(0, themes.findIndex((t) => t.name === current));

  panel.innerHTML = '';
  itemEls = [];

  const title = document.createElement('div');
  title.textContent = '选择主题';
  title.style.cssText = `
    font-size: ${FONT.lg}; font-weight: 600; margin-bottom: 12px;
    color: ${COLORS.accent.cyan};
    letter-spacing: 1px;
  `;
  panel.appendChild(title);

  themes.forEach((t, i) => {
    const item = document.createElement('div');
    item.dataset.idx = String(i);
    item.dataset.name = t.name;
    item.style.cssText = `
      padding: 8px 12px; margin: 2px 0; border-radius: 4px; cursor: pointer;
      font-size: ${FONT.md};
      transition: background 120ms, border-color 120ms, color 120ms;
    `;
    // hover 只更新高亮索引和样式，不重建 DOM（修复 V1.2.4 无限重渲染 bug）
    item.addEventListener('mouseenter', () => {
      if (highlightIdx !== i) {
        highlightIdx = i;
        updateItemStyles();
      }
    });
    item.addEventListener('click', () => {
      applyTheme(t.name);
      closeThemePicker();
    });
    panel!.appendChild(item);
    itemEls.push(item);
  });

  const hint = document.createElement('div');
  hint.textContent = '鼠标点击 / ↑↓ 选择 · Enter 应用 · Esc 关闭';
  hint.style.cssText = `
    margin-top: 12px; padding-top: 10px;
    border-top: 1px solid ${COLORS.border.cyanGhost};
    font-size: ${FONT.xs}; color: ${COLORS.text.muted};
    text-align: center; letter-spacing: 0.5px;
  `;
  panel.appendChild(hint);

  updateItemStyles();
}

/** 仅更新现有 item 的活跃 / 高亮样式 */
function updateItemStyles(): void {
  const themes = listThemes();
  const current = getThemeName();
  itemEls.forEach((el, i) => {
    const t = themes[i];
    if (!t) return;
    const active = t.name === current;
    const focused = i === highlightIdx;
    el.textContent = (active ? '● ' : '○ ') + t.label;
    el.style.color = active ? COLORS.accent.cyan : COLORS.text.body;
    el.style.background = focused ? withAlpha(COLORS.accent.cyan, 0.12) : 'transparent';
    el.style.borderTop = el.style.borderBottom = el.style.borderLeft = el.style.borderRight = `1px solid ${focused ? COLORS.border.cyanFaint : 'transparent'}`;
  });
}

export function openThemePicker(): void {
  if (overlay) return;
  buildOverlay();

  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeThemePicker();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const len = listThemes().length;
      highlightIdx = (highlightIdx + 1) % len;
      updateItemStyles();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const len = listThemes().length;
      highlightIdx = (highlightIdx - 1 + len) % len;
      updateItemStyles();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const t = listThemes()[highlightIdx];
      if (t) {
        applyTheme(t.name);
        closeThemePicker();
      }
    } else if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
      // 允许 Shift+T 在打开状态下再次按下来关闭面板
      e.preventDefault();
      closeThemePicker();
    }
  };
  disposeModal = pushModal(handler);

  // 主题变更后刷新面板配色（实时响应）
  themeChangeHandler = () => {
    if (!overlay || !panel) return;
    overlay.style.background = withAlpha(COLORS.bg.pure, 0.55);
    panel.style.background = COLORS.bg.panel;
    panel.style.borderColor = COLORS.border.cyanFaint;
    panel.style.boxShadow = `0 8px 32px ${withAlpha(COLORS.accent.cyan, 0.25)}`;
    buildList();
  };
  themeBus.addEventListener('change', themeChangeHandler);
}

export function closeThemePicker(): void {
  if (!overlay) return;
  if (disposeModal) {
    disposeModal();
    disposeModal = null;
  }
  if (themeChangeHandler) {
    themeBus.removeEventListener('change', themeChangeHandler);
    themeChangeHandler = null;
  }
  const o = overlay;
  const p = panel;
  overlay = null;
  panel = null;
  o.style.opacity = '0';
  if (p) p.style.transform = 'translateY(-8px)';
  setTimeout(() => {
    o.remove();
  }, 200);
}

export function toggleThemePicker(): void {
  if (overlay) closeThemePicker();
  else openThemePicker();
}
