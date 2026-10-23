import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
let html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const style = html.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/);
if (!script || !style)
  throw new Error('The production HTML must contain one bundled script and stylesheet.');
const artRoot = resolve(dist, 'art');
const assetCache = new Map();
const imageTypes = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const inlineAsset = (text) => text.replace(/(?:\.\.\/|\.\/|\/)art\/([\w./-]+\.(?:webp|png|jpg|svg))/g, (_match, relative) => {
  const path = resolve(artRoot, relative);
  if (!path.startsWith(artRoot + sep)) throw new Error('An offline art path escaped the asset directory.');
  if (!assetCache.has(path)) assetCache.set(path, `data:${imageTypes[extname(path)]};base64,${readFileSync(path).toString('base64')}`);
  return assetCache.get(path);
});
const js = inlineAsset(readFileSync(resolve(dist, script[1]), 'utf8')).replace(
  /<\/script/gi,
  '<\\/script',
);
const css = inlineAsset(readFileSync(resolve(dist, style[1]), 'utf8'));
html = html
  .replace(script[0], () => `<script type="module">${js}</script>`)
  .replace(style[0], () => `<style>${css}</style>`);
html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, '');
if (/(?:\.\.\/|\.\/|\/)art\/[\w./-]+\.(?:webp|png|jpg|svg)/.test(html))
  throw new Error('An offline image reference was left external.');
if (/<script\b[^>]*\bsrc=|<link\b[^>]*\brel=["']stylesheet["']/i.test(html))
  throw new Error('The offline document still requires an external script or stylesheet.');
for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g))
  if (!match[2].startsWith('data:'))
    throw new Error(`An offline CSS resource was left external: ${match[2]}`);
if (/(?:^|[;\s])import\s*(?:\(|["'{*])/.test(js))
  throw new Error('The offline bundle must not import additional modules.');
const output = resolve(dist, '星域节点.html');
writeFileSync(output, html, 'utf8');
writeFileSync(
  resolve(dist, '运行说明.txt'),
  [
    '星域节点 · 前沿行动试玩',
    '',
    '直接双击「星域节点.html」，用 Edge 或 Chrome 打开。无需安装 Node.js、启动服务器或连接网络。',
    '建议使用桌面浏览器与横向窗口，分辨率至少 1024×600；1440×900 或以上的体验更完整。',
    '',
    '开始航行后选择「前沿行动」：岩隙采集、雾海观测、双域跃迁均可直接试玩。',
    '保留自由建造。采矿站需要部署在矿脉范围内，其余设施自由摆放，并接入核心电网。',
    '雾海观测完成任意两处阵列即可；双域跃迁依次完成校准与充能。任务进度在断电、回收和重建后保留。',
    '历史九关与原有通关记录保留在「历史航线」，其中初始星域可体验基础教学。',
    '',
    '主要操作：',
    '点击底部卡片或数字键选择节点，点击已探索空地建造。',
    '从己方节点拖拽到另一节点建立链路；新设施可在详情中付费「接入最近线路」。',
    '点击中立设施后可接管；矿点或任务面板的「定位」可跳到前沿，「全域」可查看整张地图。',
    'Ctrl + 左键拖拽平移，滚轮缩放，点击右下方航图定位。',
    'U 升级选中节点，X 回收己方节点，T 研究，H 手册。样板关按实际投入返还 75%，支持回收转场。',
    'P 暂停规划，G 切换速度，M 开关音效，Esc 打开或关闭菜单。',
    '结算后按 Enter 返回航线，R 快速重开。',
    '',
    '档案存储在当前浏览器的本机存储中。不同浏览器、文件位置或网页地址可能使用不同档案。',
    '作品无需账号、无需上传个人资料。',
    '',
    '源代码与验证说明见打包文件中的 source/README.md、source/doc/DEVELOPMENT.md。',
  ].join('\r\n'),
  'utf8',
);
console.log(`[offline] ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KiB)`);
