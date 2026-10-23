import type { GameState,Enemy } from './types';
import { canDetectEnemy } from './visibility';
import { ENEMY_COLORS } from './data/enemies';

/** 敌军采用飞行器剪影，朝向来自真实移动；与固定设施的承重底盘区分。 */
export function drawEnemyFleet(ctx:CanvasRenderingContext2D,state:GameState):void {
  const cam=state.camera;
  for(const enemy of state.enemies){
    if(!canDetectEnemy(state,enemy)||enemy.x<cam.x-65||enemy.y<cam.y-65||enemy.x>cam.x+state.canvasWidth/cam.zoom+65||enemy.y>cam.y+state.canvasHeight/cam.zoom+65)continue;
    craft(ctx,enemy,state);
  }
}
function craft(ctx:CanvasRenderingContext2D,enemy:Enemy,state:GameState):void {
  const accent=ENEMY_COLORS[enemy.type],r=enemy.radius+3;
  ctx.save();ctx.translate(enemy.x,enemy.y);
  ctx.beginPath();ctx.ellipse(3,8,r*1.1,r*.5,0,0,Math.PI*2);ctx.fillStyle='#00000040';ctx.fill();
  ctx.rotate(enemy.facing??Math.PI);ctx.scale(r/12,r/12);
  const flash=enemy.hitFlash>.05,top=flash?'#f1f5ef':'#b69e98',side=flash?'#e0e8e6':'#6a4f52',dark='#332e3c';
  const poly=(points:[number,number][],fill:string)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  if(enemy.type==='heavy'||enemy.type==='boss'){
    const big=enemy.type==='boss';
    poly([[-13,-10],[5,-12],[17,0],[5,12],[-13,10],[-8,0]],dark);
    poly([[-12,-8],[4,-10],[15,0],[3,7],[-10,6],[-5,-1]],top);
    poly([[-10,6],[3,7],[15,0],[5,12],[-13,10]],side);
    poly([[2,-7],[10,0],[2,5],[-4,0]],accent);
    for(const y of [-11,9]){ctx.fillStyle=dark;ctx.fillRect(-8,y,12,3);ctx.fillStyle=accent;ctx.fillRect(-12,y,3,3);}
    if(big){poly([[-1,-15],[9,-11],[12,-5],[3,-8]],side);poly([[0,15],[9,11],[12,5],[3,8]],side);}
  }else if(enemy.type==='disruptor'){
    poly([[-14,-10],[-2,-5],[6,-12],[3,-2],[14,0],[3,3],[6,12],[-3,6],[-14,10],[-8,0]],side);
    poly([[-9,-7],[0,-3],[10,0],[0,4],[-9,7],[-4,0]],top);
    poly([[-2,-3],[4,0],[-2,3],[-6,0]],accent);
  }else if(enemy.type==='healer'||enemy.type==='shielder'){
    poly([[-12,-7],[3,-10],[14,0],[3,10],[-12,7],[-7,0]],side);
    poly([[-10,-6],[3,-8],[12,0],[2,5],[-9,4]],top);
    ctx.fillStyle=accent;ctx.fillRect(-4,-3,8,6);
    if(enemy.type==='shielder'){ctx.beginPath();ctx.ellipse(2,0,18,13,0,-1.3,1.3);ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.stroke();}
  }else{
    const wing=enemy.type==='stealth'?14:enemy.type==='swarm'?8:11;
    poly([[-12,-wing],[3,-4],[15,0],[3,5],[-12,wing],[-6,0]],dark);
    poly([[-10,-wing+2],[2,-3],[14,0],[-2,2],[-8,0]],top);
    poly([[-8,0],[-2,2],[14,0],[2,6],[-10,wing]],side);
    poly([[0,-2],[8,0],[0,2],[-5,0]],accent);
    if(enemy.type==='splitter'){poly([[-13,-3],[-7,0],[-13,4],[-18,0]],accent);}
  }
  ctx.fillStyle=accent;ctx.fillRect(-12,-2,3,4);
  ctx.restore();
  if(enemy.hp<enemy.maxHp||enemy.type==='boss'){
    const width=enemy.type==='boss'?58:26;ctx.save();ctx.translate(enemy.x,enemy.y+enemy.radius+10/state.camera.zoom);ctx.scale(1/state.camera.zoom,1/state.camera.zoom);ctx.fillStyle='#382c35';ctx.fillRect(-width/2,0,width,2);ctx.fillStyle=accent;ctx.fillRect(-width/2,0,width*Math.max(0,enemy.hp/enemy.maxHp),2);ctx.restore();
  }
}
