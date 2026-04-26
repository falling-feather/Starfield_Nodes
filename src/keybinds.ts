// ===== 快捷键自定义系统 =====

/** 可自定义的操作 */
export type KeyAction =
  | 'pause'
  | 'mute'
  | 'achievements'
  | 'techTree'
  | 'upgrade'
  | 'sell'
  | 'restart'
  | 'timeScale';

export interface KeybindEntry {
  action: KeyAction;
  label: string;
  key: string; // e.key 小写
}

/** 默认按键映射 */
const DEFAULTS: Record<KeyAction, string> = {
  pause: 'p',
  mute: 'm',
  achievements: 'a',
  techTree: 't',
  upgrade: 'u',
  sell: 'x',
  restart: 'r',
  timeScale: 'g',
};

/** 操作显示名称 */
const LABELS: Record<KeyAction, string> = {
  pause: '暂停',
  mute: '静音',
  achievements: '成就',
  techTree: '科技树',
  upgrade: '升级',
  sell: '出售',
  restart: '重新开始',
  timeScale: '加速',
};

const STORAGE_KEY = 'starfield_nodes_keybinds';

let bindings: Record<KeyAction, string> = { ...DEFAULTS };

/** 从 localStorage 加载自定义按键 */
export function loadKeybinds(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<KeyAction, string>>;
      for (const action of Object.keys(DEFAULTS) as KeyAction[]) {
        if (saved[action]) bindings[action] = saved[action];
      }
    }
  } catch { /* ignore */ }
}

/** 保存自定义按键到 localStorage */
export function saveKeybinds(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

/** 获取某操作当前绑定的键 */
export function getKey(action: KeyAction): string {
  return bindings[action];
}

/** 设置某操作的绑定键，返回是否成功（键冲突时返回 false） */
export function setKey(action: KeyAction, key: string): boolean {
  // 检查冲突：数字键、- 键留给建造
  if (/^[0-9\-]$/.test(key)) return false;
  // 检查与其他操作冲突
  for (const a of Object.keys(bindings) as KeyAction[]) {
    if (a !== action && bindings[a] === key) return false;
  }
  bindings[action] = key;
  saveKeybinds();
  return true;
}

/** 恢复默认按键 */
export function resetKeybinds(): void {
  bindings = { ...DEFAULTS };
  saveKeybinds();
}

/** 获取全部绑定条目（用于 UI 渲染） */
export function getAllBindings(): KeybindEntry[] {
  return (Object.keys(DEFAULTS) as KeyAction[]).map(action => ({
    action,
    label: LABELS[action],
    key: bindings[action],
  }));
}

/** 根据按下的 key 查找对应的操作 */
export function getActionForKey(key: string): KeyAction | null {
  for (const action of Object.keys(bindings) as KeyAction[]) {
    if (bindings[action] === key) return action;
  }
  return null;
}

// 启动时自动加载
loadKeybinds();
