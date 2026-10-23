import type { NodeType } from '../types';

/** 固定功能色、轮廓与透明素材。界面换肤不改变设施识别含义。 */
export const FACILITY_ART: Record<NodeType, {
  color: string;
  silhouette: string;
  sprite: string;
  aims?: boolean;
  bounds: readonly [number, number, number, number];
}> = {
  core: { color: '#b9eee7', silhouette: '四翼星核', sprite: './art/facilities/core.webp', bounds: [58, 61, 1137, 1110] },
  energy: { color: '#9bd85b', silhouette: '三叶电池', sprite: './art/facilities/energy.webp', bounds: [46, 68, 1161, 1069] },
  turret: { color: '#f17c67', silhouette: '短管重炮', sprite: './art/facilities/turret.webp', bounds: [40, 97, 1174, 1022], aims: true },
  mine: { color: '#efbd4e', silhouette: '双爪钻机', sprite: './art/facilities/mine.webp', bounds: [139, 58, 976, 1085] },
  relay: { color: '#55d3d5', silhouette: '窄身双叉', sprite: './art/facilities/relay.webp', bounds: [377, 64, 500, 1126] },
  beacon: { color: '#ba9cf0', silhouette: '四瓣望远镜', sprite: './art/facilities/beacon.webp', bounds: [60, 70, 1135, 1086] },
  repair: { color: '#67d6a4', silhouette: '十字维修臂', sprite: './art/facilities/repair.webp', bounds: [35, 72, 1186, 1114] },
  factory: { color: '#7e9eec', silhouette: '双舱机库', sprite: './art/facilities/factory.webp', bounds: [11, 168, 1233, 906] },
  shield: { color: '#70a8f5', silhouette: '弧形护盾', sprite: './art/facilities/shield.webp', bounds: [67, 166, 1121, 930] },
  tesla: { color: '#efdb71', silhouette: '双极电网', sprite: './art/facilities/tesla.webp', bounds: [81, 147, 1092, 960] },
  magnet: { color: '#e38dbd', silhouette: '粉色马蹄磁铁', sprite: './art/facilities/magnet.webp', bounds: [83, 95, 1088, 1067] },
  trap: { color: '#ef6861', silhouette: '锯齿地雷', sprite: './art/facilities/trap.webp', bounds: [95, 65, 1063, 1111] },
  sniper: { color: '#eda752', silhouette: '细长轨道炮', sprite: './art/facilities/sniper.webp', bounds: [291, 11, 672, 1213], aims: true },
  buffer: { color: '#4ccbb6', silhouette: '双联蓄电池', sprite: './art/facilities/buffer.webp', bounds: [38, 154, 1180, 941] },
  collector: { color: '#c1cf6e', silhouette: '三指抓取器', sprite: './art/facilities/collector.webp', bounds: [43, 69, 1168, 1107] },
  interceptor: { color: '#58b7ed', silhouette: '扇形导弹巢', sprite: './art/facilities/interceptor.webp', bounds: [67, 167, 1120, 907], aims: true },
  radar: { color: '#a0d4ee', silhouette: '扇面雷达', sprite: './art/facilities/radar.webp', bounds: [41, 89, 1172, 1076] },
  portal: { color: '#b291ef', silhouette: '断环跃迁门', sprite: './art/facilities/portal.webp', bounds: [30, 91, 1194, 1056] },
  blackhole: { color: '#8b79d5', silhouette: '三钩引力井', sprite: './art/facilities/blackhole.webp', bounds: [69, 83, 1129, 1073] },
  echo: { color: '#e9bc98', silhouette: '侧向共振波阵', sprite: './art/facilities/echo.webp', bounds: [49, 118, 1160, 1026] },
  toxin: { color: '#b2d653', silhouette: '三罐喷雾器', sprite: './art/facilities/toxin.webp', bounds: [76, 67, 1102, 982] },
  arc: { color: '#679ff0', silhouette: '闪电分叉塔', sprite: './art/facilities/arc.webp', bounds: [43, 75, 1162, 1104] },
  kamikaze: { color: '#ed7298', silhouette: '四瓣爆破芯', sprite: './art/facilities/kamikaze.webp', bounds: [81, 63, 1092, 1084] },
};
