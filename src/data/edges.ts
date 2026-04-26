// 边类型配置数据层
// 抽离自 types.ts（Phase B-1）
import type { EdgeType } from '../types';

export const EDGE_CONFIGS: Record<EdgeType, {
  throughput: number;
  cost: number;
  crystalCost: number;     // 晶体消耗
  color: string;
  name: string;
  description: string;
  lineWidth: number;
  flowSpeedMult: number;   // 流动粒子速度倍率
  amplifyBonus: number;    // 传输增幅比例 (0 = 无增幅)
}> = {
  standard: {
    throughput: 8, cost: 5, crystalCost: 0, color: '', name: '标准',
    description: '基础连线', lineWidth: 2, flowSpeedMult: 1, amplifyBonus: 0,
  },
  fast: {
    throughput: 14, cost: 12, crystalCost: 0, color: '#44ddff', name: '高速',
    description: '高吞吐快速传输', lineWidth: 2, flowSpeedMult: 2, amplifyBonus: 0,
  },
  heavy: {
    throughput: 20, cost: 15, crystalCost: 0, color: '#ff8800', name: '大容量',
    description: '超大带宽传输', lineWidth: 4, flowSpeedMult: 0.7, amplifyBonus: 0,
  },
  amplify: {
    throughput: 8, cost: 20, crystalCost: 3, color: '#cc66ff', name: '增幅',
    description: '传输能量+30% (需3✧)', lineWidth: 2, flowSpeedMult: 1.2, amplifyBonus: 0.3,
  },
};

/** 边色快照（用于主题切换回退） */
export const DEFAULT_EDGE_COLORS: Record<EdgeType, string> = (() => {
  const out = {} as Record<EdgeType, string>;
  for (const k of Object.keys(EDGE_CONFIGS) as EdgeType[]) {
    out[k] = EDGE_CONFIGS[k].color;
  }
  return out;
})();
