import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/ui';
import { createTechState } from '../src/tech';
import { state, node } from './fixtures';
import { LEVELS } from '../src/levels';
import { minimapRect } from '../src/canvas-ui';

function canvasContext(output: string[] = []): CanvasRenderingContext2D {
  return new Proxy({globalAlpha:1},{get(target,key){
    if(key in target)return target[key as keyof typeof target];
    if(key==='measureText')return(value:string)=>({width:value.length*12});
    if(key==='fillText')return(value:string)=>output.push(value);
    if(String(key).startsWith('create'))return()=>({addColorStop(){}});
    return()=>{};
  }}) as unknown as CanvasRenderingContext2D;
}

test('selecting a building preserves the HUD and construction click targets', () => {
  const context = canvasContext();
  const s = state(),
    core = node('core', 500, 400),
    turret = node('turret', 630, 400);
  s.nodes = [core, turret];
  s.selectedNodeId = turret.id;
  const ui = new UI(context);
  ui.techState = createTechState();
  ui.render(s);
  for (const action of ['tech_tree', 'pause', 'time_scale', 'build:energy', 'build:turret'])
    assert.ok(
      ui.nodeButtons.some((button) => button.action === action),
      action,
    );
  s.selectedNodeId=null;s.selectedNodeIds=[core.id,turret.id];ui.render(s);
  assert.ok(ui.nodeButtons.some(b=>b.action==='pause'),'batch selection preserves the HUD');
  assert.ok(ui.nodeButtons.some(b=>b.action==='batch_upgrade'));
  s.selectedNodeIds=[];s.levelWon=true;ui.render(s);
  assert.deepEqual(ui.nodeButtons.map(b=>b.action).sort(),['continue','quick_restart']);
});

test('battle controls stay inside desktop viewports and clear the tactical map', () => {
  const context = canvasContext();
  const overlap = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) =>
    a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  for (const [width, height] of [[1024,640],[1366,768],[1920,1080]]) {
    const s=state(),core=node('core',500,400);
    s.canvasWidth=width;s.canvasHeight=height;s.nodes=[core];s.selectedNodeId=core.id;
    s.mission=LEVELS.find(level=>level.id===102)!.tactics;
    s.alert={text:'线路被岩带阻挡 · 改沿边缘布线',until:10};
    const ui=new UI(context);ui.techState=createTechState();
    ui.allowedNodeTypes=['energy','turret','mine','relay','beacon','repair','sniper','shield','factory'];
    ui.render(s);
    const map=minimapRect(width,height,s.worldWidth,s.worldHeight);
    for (const control of ui.nodeButtons) {
      assert.ok(control.x>=0&&control.y>=0&&control.x+control.w<=width&&control.y+control.h<=height,control.action);
      assert.ok(!overlap(control,map),control.action+' clears map');
    }
    assert.ok(ui.nodeButtons.some(control=>control.action==='dismiss_alert'));
    for(let i=0;i<ui.nodeButtons.length;i++)for(let j=i+1;j<ui.nodeButtons.length;j++)
      assert.ok(!overlap(ui.nodeButtons[i],ui.nodeButtons[j]),ui.nodeButtons[i].action+' / '+ui.nodeButtons[j].action);
  }
});

test('the fixed build feedback shows the same payable quote used by construction', () => {
  const output:string[]=[];
  const context=canvasContext(output);
  const ui=new UI(context),s=state();ui.techState=createTechState();
  ui.buildMode='energy';ui.buildPlacement={valid:true,cost:16,discount:.2,reason:''};
  ui.render(s);
  assert.ok(output.some(text=>text.includes('16 ◆')&&text.includes('领地优惠 20%')));
  output.length=0;ui.buildPlacement={valid:false,cost:16,discount:.2,reason:'与已有设施距离过近'};
  ui.render(s);
  assert.ok(output.some(text=>text.includes('与已有设施距离过近')));
  ui.resetSession();
  assert.equal(ui.buildMode,null);
  assert.equal(ui.buildPlacement,null);
});

test('the manual exposes complete successive cards through real page controls', () => {
  const output:string[]=[],ui=new UI(canvasContext(output)),s=state();
  s.canvasWidth=1024;s.canvasHeight=640;
  ui.techState=createTechState();ui.showKnowledgePanel=true;
  ui.render(s);
  assert.ok(output.includes('连接与扩张'));
  assert.ok(output.includes('规划与成长'));
  assert.ok(ui.nodeButtons.some(button=>button.action==='knowledge_next'&&button.enabled));
  assert.ok(ui.nodeButtons.some(button=>button.action==='knowledge_prev'&&!button.enabled));
  output.length=0;ui.scrollKnowledgePanel(1);ui.render(s);
  assert.ok(output.includes('支援单位'));
  assert.ok(output.includes('侦察与干扰'));
  assert.ok(!output.includes('连接与扩张'));
  assert.ok(ui.nodeButtons.some(button=>button.action==='knowledge_prev'&&button.enabled));
});
