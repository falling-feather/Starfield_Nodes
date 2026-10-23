import type { LevelConfig } from '../levels';
import type { NodeType } from '../types';

const infrastructure: NodeType[] = ['energy', 'mine', 'relay', 'beacon'];
const loadout: NodeType[] = ['energy', 'turret', 'mine', 'relay', 'beacon', 'repair', 'factory'];
const availableNodes: NodeType[] = [...loadout, 'sniper', 'magnet', 'shield', 'core'];
const shared = {
  objective: 'network' as const, targetWaves: 0, hasBoss: false, bossWave: 0, timeLimit: 0,
  nodeCount: 0, maxSelectedNodes: 7, unlockRequires: 0, startCrystals: 4,
  requiredNodes: infrastructure,
  availableNodes,
};

/** 世界坐标为作者固定布局；矿脉只限制采矿站，其余设施保持自由建造。 */
export const FRONTIER_LEVELS: LevelConfig[] = [
  {
    ...shared, id: 101, name: '岩隙采集', description: '开采远端矿脉，把经济与防线一起向外延伸。',
    worldWidth: 1800, worldHeight: 1200, corePositions: [{ x: 320 / 1800, y: .5 }],
    startResources: 440, difficultyMult: .68,
    tactics: {
      tagline: '选择值得守住的地方', accent: '#ddb67c', visionMultiplier: 1,
      briefing: '着陆区只有低产补给矿。北侧浅矿容易防守，南侧富矿回报更快，却暴露在敌军航道旁。资源与塔位由你安排。',
      challenge: '从基地外采集 360 矿物。可在岩隙集中截击，也可在富矿建立紧凑前哨；任务进度不因消费资源减少。',
      recommendedNodes: loadout, enemyPool: ['scout', 'swarm', 'heavy'], enemyUnlocks: { heavy: 4 },
      entryPoints: [{ x: .94, y: .38, label: '东部岩隙' }, { x: .94, y: .79, label: '南部矿道', fromWave: 4 }],
      frontier: {
        chapter: '01 / 资源与阵地', preparationSeconds: 42, attackSeconds: 5.5, waveSeconds: 26,
        deposits: [
          { id:'landing', label:'着陆补给', x:320,y:740,radius:90,perSecond:.8,home:true },
          { id:'shallow', label:'北侧浅矿', x:650,y:325,radius:90,perSecond:2.8 },
          { id:'rich', label:'南部富矿', x:1190,y:910,radius:90,perSecond:5 },
        ], stations: [], goal: { kind:'harvest',amount:360 },
      },
    },
    terrainPolygons: [
      { type:'asteroid',vertices:[[820,25],[970,30],[1030,210],[975,435],[860,460],[800,250]] },
      { type:'asteroid',vertices:[[850,750],[1000,715],[1050,940],[980,1170],[830,1160],[800,950]] },
      { type:'nebula',slowFactor:.6,vertices:[[1080,450],[1330,400],[1480,570],[1350,710],[1080,680]] },
    ],
  },
  {
    ...shared, id:102,name:'雾海观测', description:'三处观测阵列，选择两处恢复。',
    worldWidth:2000,worldHeight:1400,corePositions:[{x:.16,y:.5}],startResources:560,difficultyMult:.72,
    tactics:{
      tagline:'情报先于火力抵达',accent:'#9fbdd9',visionMultiplier:.86,
      briefing:'雾海中有三处观测阵列。供电的信标才能积累观测进度；断电只会暂停，已经取得的数据会保留。选择两处即可完成行动。',
      challenge:'每处需 55 秒有效观测。并行布网更快，逐段回收转场更省资金。进攻方向有预警，敌军位置需侦察确认。',
      recommendedNodes:loadout, enemyPool:['scout','stealth','swarm'],enemyUnlocks:{stealth:3},
      entryPoints:[{x:.94,y:.17,label:'北部回波'},{x:.94,y:.83,label:'南部回波',fromWave:4}],
      frontier:{
        chapter:'02 / 侦察与取舍',preparationSeconds:48,attackSeconds:6,waveSeconds:30,
        deposits:[
          {id:'landing',label:'着陆补给',x:320,y:840,radius:90,perSecond:.8,home:true},
          {id:'north-mine',label:'北部矿带',x:740,y:300,radius:90,perSecond:3.2},
          {id:'south-mine',label:'南部矿带',x:820,y:1110,radius:90,perSecond:3.8},
          {id:'east-mine',label:'雾海富矿',x:1220,y:730,radius:90,perSecond:4.5},
        ],
        stations:[
          {id:'north-array',label:'北部阵列',x:1130,y:290,radius:85,nodeType:'beacon',seconds:55,energyPerTick:4},
          {id:'east-array',label:'东部阵列',x:1620,y:700,radius:85,nodeType:'beacon',seconds:55,energyPerTick:4},
          {id:'south-array',label:'南部阵列',x:1290,y:1130,radius:85,nodeType:'beacon',seconds:55,energyPerTick:4},
        ],goal:{kind:'stations',count:2},
      },
    },
    terrainPolygons:[
      {type:'asteroid',vertices:[[920,455],[1030,425],[1110,570],[1090,800],[985,860],[900,740]]},
      {type:'asteroid',vertices:[[1410,20],[1540,40],[1580,215],[1490,310],[1390,230]]},
      {type:'nebula',slowFactor:.55,vertices:[[1020,950],[1370,900],[1520,1150],[1360,1300],[1090,1260]]},
      {type:'nebula',slowFactor:.65,vertices:[[1210,280],[1530,300],[1690,550],[1530,720],[1230,570]]},
    ],
  },
  {
    ...shared,id:103,name:'双域跃迁',description:'穿越虫洞，把供电和阵地延伸到彼岸。',
    worldWidth:2200,worldHeight:1400,corePositions:[{x:.15,y:.5}],startResources:600,difficultyMult:.76,
    tactics:{
      tagline:'先建立通路，再决定如何留下',accent:'#aebce3',visionMultiplier:.94,
      briefing:'两端中继形成真实输能通道。先从近端侦察并接管远端，再依次恢复北方校准站与南方星门。中途断电会保留充能进度。',
      challenge:'可升级跨域主干并集中供电，也可投入资源建设远端核心。北站完成后可回收旧阵地，把电力与火力转向南方。',
      recommendedNodes:['energy','turret','mine','relay','beacon','repair','core'],
      enemyPool:['scout','heavy','disruptor'],enemyUnlocks:{heavy:3,disruptor:5},
      entryPoints:[{x:.94,y:.15,label:'彼岸北航道',untilWave:5},{x:.94,y:.76,label:'彼岸南航道',fromWave:5},{x:.04,y:.85,label:'近端侧翼',fromWave:7}],
      frontier:{
        chapter:'03 / 供电与转场',preparationSeconds:50,attackSeconds:6,waveSeconds:32,
        deposits:[
          {id:'landing',label:'着陆补给',x:330,y:840,radius:90,perSecond:.8,home:true},
          {id:'near-mine',label:'近端矿带',x:690,y:1010,radius:90,perSecond:2.8},
          {id:'far-mine',label:'彼岸富矿',x:1660,y:850,radius:90,perSecond:4.8},
        ],
        stations:[
          {id:'calibration',label:'北方校准站',x:1710,y:280,radius:85,nodeType:'beacon',seconds:40,energyPerTick:4,needsGate:true},
          {id:'launch-gate',label:'南方星门',x:1840,y:1070,radius:85,nodeType:'beacon',seconds:65,energyPerTick:6,after:'calibration'},
        ],goal:{kind:'stations',count:2},
      },
    },
    terrainPolygons:[
      {id:'near-gate',linkedId:'far-gate',type:'wormhole',vertices:[[630,640],[770,640],[775,760],[625,760]]},
      {id:'far-gate',linkedId:'near-gate',type:'wormhole',vertices:[[1470,460],[1610,460],[1615,580],[1465,580]]},
      {type:'asteroid',vertices:[[920,15],[1170,15],[1260,340],[1200,700],[1120,1020],[945,1050],[880,700]]},
      {type:'nebula',slowFactor:.62,vertices:[[1420,830],[1700,750],[1910,940],[1770,1160],[1480,1090]]},
    ],
  },
];
