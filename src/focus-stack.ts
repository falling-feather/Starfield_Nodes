// 模态焦点栈：当存在打开的模态窗口时，键盘事件只交给栈顶处理器，并阻断所有其它 window keydown 监听。
// 主窗口（登录、选关、节点选择、过场、游戏内 input）使用普通冒泡监听；
// 模态（主题切换、ESC 暂停菜单等）通过 pushModal 注册并自动获得独占焦点。
//
// 用法：
//   const dispose = pushModal((e) => { ... });   // 打开模态时
//   dispose();                                   // 关闭模态时
//
// 注意：本模块在被首次 import 时即注册 capture-phase 监听，main.ts 必须在登录屏幕之前 import 它。

type Handler = (e: KeyboardEvent) => void;

const stack: Handler[] = [];

window.addEventListener(
  'keydown',
  (e) => {
    if (stack.length === 0) return;
    // 阻断所有其它 window keydown 监听（包括随后注册的冒泡阶段）
    e.stopImmediatePropagation();
    const top = stack[stack.length - 1];
    top(e);
  },
  true,
);

export function pushModal(handler: Handler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function isModalOpen(): boolean {
  return stack.length > 0;
}

export function topModal(): Handler | null {
  return stack.length === 0 ? null : stack[stack.length - 1];
}
