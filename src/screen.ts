import { LOGO } from './presentation';
import { menuLayout } from './screen-layout';
import type { PageWindow } from './screen-layout';
let activeScreen: Screen | null = null;

export class Screen {
  readonly root: HTMLElement;
  private controller = new AbortController();
  private canvas: HTMLCanvasElement;
  private resizeCallback?: () => void;
  layout: ReturnType<typeof menuLayout>;
  constructor(canvas: HTMLCanvasElement, name: string, onKey: (event: KeyboardEvent) => void) {
    this.canvas = canvas;
    activeScreen?.destroy();
    activeScreen = this;
    canvas.style.visibility = 'hidden';
    this.root = document.createElement('main');
    this.root.className = `game-screen ${name}`;
    this.layout = menuLayout(window.innerWidth, window.innerHeight);
    this.applyLayout();
    document.body.appendChild(this.root);
    document.body.classList.add('menu-active');
    window.addEventListener('resize', () => {
      this.layout = menuLayout(window.innerWidth, window.innerHeight);
      this.applyLayout();
      this.resizeCallback?.();
    }, { signal: this.controller.signal });
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
          return;
        if (
          (event.key === 'Enter' || event.key === ' ') &&
          (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)
        )
          return;
        onKey(event);
      },
      { signal: this.controller.signal },
    );
  }
  render(content: string): void {
    const active = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement)
      ? document.activeElement.dataset.focusKey : undefined;
    const inputs = new Map(Array.from(this.root.querySelectorAll<HTMLInputElement>('input[id]'), element => [element.id, element.value]));
    this.root.innerHTML = content;
    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[id]')) {
      const value = inputs.get(input.id);
      if (value !== undefined) input.value = value;
    }
    if (active) Array.from(this.root.querySelectorAll<HTMLElement>('[data-focus-key]'))
      .find(element => element.dataset.focusKey === active)?.focus({ preventScroll: true });
  }
  onResize(callback: () => void): void { this.resizeCallback = callback; }
  private applyLayout(): void {
    const variables = { gutter: this.layout.gutter, header: this.layout.header, footer: this.layout.footer,
      padding: this.layout.padding, sidebar: this.layout.sidebar, gap: this.layout.gap };
    for (const [name, value] of Object.entries(variables)) this.root.style.setProperty(`--shell-${name}`, `${value}px`);
    this.root.style.setProperty('--card-columns', String(this.layout.columns));
    this.root.style.setProperty('--card-rows', String(this.layout.rows));
  }
  destroy(): void {
    if (activeScreen === this) activeScreen = null;
    this.controller.abort();
    this.root.remove();
    this.canvas.style.visibility = 'visible';
    document.body.classList.remove('menu-active');
  }
  header(section: string, back = false): string {
    return `<header class="screen-header"><a class="brand" href="#" data-action="home" aria-label="返回星域节点首页">${LOGO}<span>星域节点<small>STARFIELD NODES</small></span></a><div class="header-caption">${section}</div>${back ? '<button class="quiet-button" data-action="back">← 返回</button>' : '<span class="status-light">本地航行档案</span>'}</header>`;
  }
}

export function paginationControls(window: PageWindow, action: string, label: string): string {
  return `<nav class="pagination" aria-label="${label}分页"><button class="quiet-button" data-action="${action}" data-direction="-1" data-focus-key="${action}-prev" ${window.page === 0 ? 'disabled' : ''} aria-label="${label}上一页">← 上一页</button><span role="status" aria-live="polite">${window.page + 1} / ${window.pages} 页</span><button class="quiet-button" data-action="${action}" data-direction="1" data-focus-key="${action}-next" ${window.page + 1 === window.pages ? 'disabled' : ''} aria-label="${label}下一页">下一页 →</button></nav>`;
}
