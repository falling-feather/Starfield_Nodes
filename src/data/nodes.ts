// 节点配置数据层
// 抽离自 types.ts（Phase B-1：数据/平衡体系化第一步）
// 数值与外观集中维护，便于后续平衡调参与配置驱动扩展。
import type { NodeType } from '../types';
import { FACILITY_ART } from './facility-art';

export const NODE_CONFIGS: Record<
  NodeType,
  {
    maxEnergy: number;
    maxHp: number;
    activationThreshold: number;
    radius: number;
    glowColor: string;
    cost: number;
    description: string;
  }
> = {
  core: {
    maxEnergy: 200,
    maxHp: 500,
    activationThreshold: 0,
    radius: 28,
    glowColor: FACILITY_ART.core.color,
    cost: 320,
    description: '核心基地 - 产生能量',
  },
  energy: {
    maxEnergy: 80,
    maxHp: 120,
    activationThreshold: 20,
    radius: 16,
    glowColor: FACILITY_ART.energy.color,
    cost: 30,
    description: '能量站 - 中继并放大能量',
  },
  turret: {
    maxEnergy: 60,
    maxHp: 150,
    activationThreshold: 30,
    radius: 18,
    glowColor: FACILITY_ART.turret.color,
    cost: 50,
    description: '炮塔 - 攻击敌人',
  },
  mine: {
    maxEnergy: 50,
    maxHp: 100,
    activationThreshold: 15,
    radius: 14,
    glowColor: FACILITY_ART.mine.color,
    cost: 40,
    description: '矿机 - 产生资源',
  },
  shield: {
    // §24 调优 ③：maxHp 200 -> 300（×1.5），增强 wave 8-9 阵地韧性
    // §29.3 复核：autoUpgrade 下边际为零（升到 level 5 后 maxHp×2.25 主导），但保留为 manual play 兜底
    maxEnergy: 100,
    maxHp: 300,
    activationThreshold: 40,
    radius: 20,
    glowColor: FACILITY_ART.shield.color,
    cost: 60,
    description: '护盾 - 保护附近节点',
  },
  relay: {
    maxEnergy: 100,
    maxHp: 75,
    activationThreshold: 10,
    radius: 12,
    glowColor: FACILITY_ART.relay.color,
    cost: 20,
    description: '中继器 - 低成本转发能量',
  },
  tesla: {
    maxEnergy: 70,
    maxHp: 110,
    activationThreshold: 0,
    radius: 17,
    glowColor: FACILITY_ART.tesla.color,
    cost: 65,
    description: '连锁塔 - 电网伤害经过的敌人',
  },
  beacon: {
    maxEnergy: 50,
    maxHp: 75,
    activationThreshold: 15,
    radius: 14,
    glowColor: FACILITY_ART.beacon.color,
    cost: 35,
    description: '信标 - 揭示大范围迷雾',
  },
  factory: {
    maxEnergy: 80,
    maxHp: 150,
    activationThreshold: 35,
    radius: 19,
    glowColor: FACILITY_ART.factory.color,
    cost: 80,
    description: '工厂 - 生成防御无人机',
  },
  magnet: {
    maxEnergy: 60,
    maxHp: 120,
    activationThreshold: 20,
    radius: 16,
    glowColor: FACILITY_ART.magnet.color,
    cost: 45,
    description: '磁力塔 - 减速附近敌人',
  },
  trap: {
    maxEnergy: 40,
    maxHp: 50,
    activationThreshold: 25,
    radius: 13,
    glowColor: FACILITY_ART.trap.color,
    cost: 55,
    description: '陷阱 - 一次性范围爆炸',
  },
  repair: {
    maxEnergy: 90,
    maxHp: 160,
    activationThreshold: 30,
    radius: 17,
    glowColor: FACILITY_ART.repair.color,
    cost: 70,
    description: '维修站 - 修复附近节点HP',
  },
  sniper: {
    maxEnergy: 70,
    maxHp: 100,
    activationThreshold: 35,
    radius: 15,
    glowColor: FACILITY_ART.sniper.color,
    cost: 85,
    description: '狙击手 - 超远射程高伤害',
  },
  buffer: {
    maxEnergy: 80,
    maxHp: 130,
    activationThreshold: 30,
    radius: 16,
    glowColor: FACILITY_ART.buffer.color,
    cost: 75,
    description: '缓冲器 - 强化附近节点能量',
  },
  collector: {
    maxEnergy: 60,
    maxHp: 90,
    activationThreshold: 15,
    radius: 14,
    glowColor: FACILITY_ART.collector.color,
    cost: 60,
    description: '采集器 - 收集附近战场资源',
  },
  interceptor: {
    maxEnergy: 65,
    maxHp: 140,
    activationThreshold: 20,
    radius: 16,
    glowColor: FACILITY_ART.interceptor.color,
    cost: 65,
    description: '拦截器 - 快速点防御攻击',
  },
  radar: {
    maxEnergy: 55,
    maxHp: 80,
    activationThreshold: 15,
    radius: 14,
    glowColor: FACILITY_ART.radar.color,
    cost: 55,
    description: '雷达 - 锁定敌人造成持续伤害',
  },
  portal: {
    maxEnergy: 60,
    maxHp: 70,
    activationThreshold: 20,
    radius: 13,
    glowColor: FACILITY_ART.portal.color,
    cost: 65,
    description: '传送门 - 将敌人传送回远处',
  },
  blackhole: {
    maxEnergy: 70,
    maxHp: 90,
    activationThreshold: 25,
    radius: 12,
    glowColor: FACILITY_ART.blackhole.color,
    cost: 70,
    description: '黑洞 - 引力拉拽+碾压伤害',
  },
  echo: {
    maxEnergy: 50,
    maxHp: 65,
    activationThreshold: 20,
    radius: 13,
    glowColor: FACILITY_ART.echo.color,
    cost: 65,
    description: '回声塔 - 复制相邻节点的能力',
  },
  toxin: {
    maxEnergy: 45,
    maxHp: 55,
    activationThreshold: 12,
    radius: 12,
    glowColor: FACILITY_ART.toxin.color,
    cost: 50,
    description: '毒雾 - 持续毒伤+减速整个区域',
  },
  arc: {
    maxEnergy: 50,
    maxHp: 60,
    activationThreshold: 15,
    radius: 13,
    glowColor: FACILITY_ART.arc.color,
    cost: 50,
    description: '电弧链 - 闪电链弹跳多个目标',
  },
  kamikaze: {
    maxEnergy: 80,
    maxHp: 40,
    activationThreshold: 75,
    radius: 11,
    glowColor: FACILITY_ART.kamikaze.color,
    cost: 35,
    description: '自爆 - 充能满后核爆摧毁敌人',
  },
};

/** 默认节点光晕色快照（用于主题切换时回退） */
export const DEFAULT_NODE_GLOW: Record<NodeType, string> = (() => {
  const out = {} as Record<NodeType, string>;
  for (const k of Object.keys(NODE_CONFIGS) as NodeType[]) {
    out[k] = NODE_CONFIGS[k].glowColor;
  }
  return out;
})();
