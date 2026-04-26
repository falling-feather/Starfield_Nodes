// ===== 屏幕切换淡入淡出过渡 =====
// 通过 DOM 覆盖层实现，与 canvas 渲染完全解耦，避免与各屏幕 RAF 循环冲突。

import { ANIM } from './ui-tokens';

let overlay: HTMLDivElement | null = null;
let busy = false;

const FADE_OUT_MS = ANIM.screenFadeOut;
const FADE_IN_MS = ANIM.screenFadeIn;

function ensureOverlay(): HTMLDivElement {
  if (overlay) return overlay;
  const el = document.createElement('div');
  el.id = 'screen-transition';
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:#000',
    'opacity:0',
    'pointer-events:none',
    'z-index:9999',
    `transition:opacity ${FADE_OUT_MS}ms ease`,
  ].join(';');
  document.body.appendChild(el);
  overlay = el;
  return el;
}

/**
 * 用淡入淡出包装屏幕切换。
 * @param switchFn 在屏幕完全变黑时被调用，应在此销毁旧屏幕并构造新屏幕
 * @param opts 可选参数，length 控制总过渡时长（毫秒），默认 580
 */
export function transitionTo(
  switchFn: () => void,
  opts?: { fadeOutMs?: number; fadeInMs?: number },
): Promise<void> {
  const el = ensureOverlay();
  const outMs = opts?.fadeOutMs ?? FADE_OUT_MS;
  const inMs = opts?.fadeInMs ?? FADE_IN_MS;

  // 防止短时间内连点导致并发切换
  if (busy) {
    // 直接吞掉本次切换；用户已在过渡中，无需再次触发
    return Promise.resolve();
  }
  busy = true;

  return new Promise(resolve => {
    el.style.transition = `opacity ${outMs}ms ease`;
    el.style.pointerEvents = 'auto';
    // 触发布局后再设置 opacity，确保 transition 生效
    requestAnimationFrame(() => {
      el.style.opacity = '1';
    });

    window.setTimeout(() => {
      try {
        switchFn();
      } catch (err) {
        // 切换异常也要确保过渡可恢复
        console.error('[transition] switchFn error:', err);
      }
      // 给新屏幕一帧时间完成首次渲染，再开始淡入
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = `opacity ${inMs}ms ease`;
          el.style.opacity = '0';
          window.setTimeout(() => {
            el.style.pointerEvents = 'none';
            busy = false;
            resolve();
          }, inMs);
        });
      });
    }, outMs);
  });
}

/** 立即覆盖一层不透明黑（用于初次进入时避免闪烁）。需要手动 fadeIn */
export function instantBlack(): void {
  const el = ensureOverlay();
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.style.pointerEvents = 'auto';
}

/** 立即开始淡入（与 instantBlack 配合） */
export function fadeIn(durationMs = FADE_IN_MS): Promise<void> {
  return new Promise(resolve => {
    const el = ensureOverlay();
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${durationMs}ms ease`;
      el.style.opacity = '0';
      window.setTimeout(() => {
        el.style.pointerEvents = 'none';
        resolve();
      }, durationMs);
    });
  });
}
