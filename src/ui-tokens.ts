// ===== UI 设计 Token =====
// 统一收口颜色 / 字号 / 间距 / 圆角 / 动画时长，便于全局风格调整与主题化。
// 使用规约：
//   - 业务代码尽量从这里导入常量，避免散落的硬编码十六进制颜色与魔术数字。
//   - 旧代码中的硬编码值会按需逐步替换，以降低一次性改动的回归风险。

/** 主题强调色（节点 / 文字 / 边框等高亮使用） */
const _DEFAULT_COLORS = {
  // 强调色
  accent: {
    cyan: '#8fdfd3', // 主色（HUD 波次、连线高亮等）
    cyanSoft: '#94c9dd', // 次级蓝青（提示、信息）
    purple: '#b5b4e0', // 科技 / 强化
    pink: '#d8b5ce', // 进化
    green: '#9bd8b9', // 资源 / 成功
    greenSoft: '#83b99e',
    yellow: '#dfbd83', // 分数 / 警告
    yellowHi: '#e4cb95', // 时间加速等强提示
    red: '#ea9d8a', // 危险 / 敌人
    redSoft: '#f0b0a0', // 出售 / 错误
    blue: '#9abfdf', // 连线
    crystal: '#c3b2dd', // 晶体
  },

  /** 中性灰阶（文字、禁用、分隔） */
  text: {
    primary: '#e7f0f4',
    high: '#c9dbe4',
    body: '#abc0cd',
    muted: '#92aabb',
    faint: '#7f98a9',
    disabled: '#6c899b',
    border: '#444444',
    borderFaint: '#415c70',
  },

  /** 背景 / 遮罩 */
  bg: {
    overlay: 'rgba(0,0,0,0.7)', // HUD 顶栏
    panel: 'rgba(10,10,30,0.92)', // 浮层面板
    panelDim: 'rgba(20,20,40,0.8)',
    card: 'rgba(0,0,0,0.88)',
    pure: '#050e19',
  },

  /** 描边/分隔常用 */
  border: {
    cyanFaint: 'rgba(0,255,255,0.3)',
    cyanGhost: 'rgba(0,255,255,0.08)',
  },
};

export type ColorPalette = typeof _DEFAULT_COLORS;

/** 默认调色板的不可变快照（仅用于主题切换时回退） */
export const DEFAULT_COLORS: ColorPalette = JSON.parse(JSON.stringify(_DEFAULT_COLORS));

/**
 * 全局可变调色板。业务代码读取它，主题切换时由 themes.ts 深度覆盖其字段。
 * 注意：仍然按引用使用 `COLORS.accent.cyan` 等，主题切换会就地修改字段值。
 */
export const COLORS: ColorPalette = JSON.parse(JSON.stringify(_DEFAULT_COLORS));

/** 字号（Canvas 文本） */
export const FONT = {
  xs: '12px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  sm: '14px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  md: '15px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  base: '16px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  lg: '18px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  xl: '20px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  xxl: '24px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  display: '28px "Segoe UI", "Microsoft YaHei UI", sans-serif',
  hero: '32px "Segoe UI", "Microsoft YaHei UI", sans-serif',
} as const;

/** 间距（px） */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 圆角（px） */
export const RADIUS = {
  sm: 4,
  md: 6,
  lg: 10,
} as const;

/** 动画时长（毫秒） */
export const ANIM = {
  /** 微动效（按钮反馈、Tooltip） */
  micro: 120,
  /** 面板淡入淡出 */
  short: 180,
  /** 屏幕级过渡淡出 */
  mid: 280,
  /** 关键过渡淡入 */
  long: 420,
  /** 屏幕切换：默认淡出（变黑）时长 */
  screenFadeOut: 260,
  /** 屏幕切换：默认淡入（露出）时长 */
  screenFadeIn: 320,
  /** 进入游戏：略长的淡入，营造蓄势感 */
  enterGameIn: 420,
  /** 进入游戏：选卡→战场的淡出 */
  enterGameOut: 320,
  /** 结束关卡：更慢的淡出，保留情绪余韵 */
  exitGameOut: 480,
  /** 结束关卡淡入 */
  exitGameIn: 360,
  /** 首屏初始淡入 */
  bootFadeIn: 420,
  /** HUD 顶栏进入淡入（关卡开始） */
  hudFadeIn: 450,
  /** 节点环形菜单展开（缩放+透明，含 easeOutBack 微弹） */
  radialMenuIn: 220,
} as const;

/** 把 #rrggbb 转成 rgba(r,g,b,a)。已经是 rgba(...) 的字符串原样返回。 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba') || color.startsWith('rgb')) return color;
  if (color[0] !== '#' || color.length !== 7) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
