import type { TerrainPolygon } from './types';
const cache=new WeakMap<TerrainPolygon,{signature:string;image:OffscreenCanvas}>();
/** 岩带的明暗体积与碰撞多边形共用轮廓，投影只作为光照。 */
export function drawRockMass(ctx:CanvasRenderingContext2D,poly:TerrainPolygon):void {
  const b=poly.bbox,w=b.maxX-b.minX,h=b.maxY-b.minY,margin=24;
  const signature=poly.vertices.map(v=>`${v.x},${v.y}`).join(';');
  let entry=cache.get(poly);
  if(!entry||entry.signature!==signature){
    const scale=Math.min(1,1000/Math.max(w,h)),image=new OffscreenCanvas(Math.ceil((w+margin*2)*scale),Math.ceil((h+margin*2)*scale));
    const t=image.getContext('2d')!;t.scale(scale,scale);t.translate(margin-b.minX,margin-b.minY);
    const path=()=>{t.beginPath();poly.vertices.forEach((v,i)=>i?t.lineTo(v.x,v.y):t.moveTo(v.x,v.y));t.closePath();};
    path();t.shadowColor='#00000090';t.shadowBlur=19;t.shadowOffsetY=12;t.fillStyle='#203541';t.fill();t.shadowBlur=0;t.shadowOffsetY=0;
    t.save();path();t.clip();
    const gradient=t.createLinearGradient(b.minX,b.minY,b.maxX,b.maxY);gradient.addColorStop(0,'#536b76');gradient.addColorStop(.4,'#324c5c');gradient.addColorStop(1,'#1c3343');t.fillStyle=gradient;t.fillRect(b.minX,b.minY,w,h);
    const c=poly.centroid,inner=poly.vertices.map(v=>({x:c.x+(v.x-c.x)*.89,y:c.y+(v.y-c.y)*.89}));
    const colors=['#526d79','#425c6b','#354f60','#2b4556','#324f60','#496775'];
    for(let i=0;i<inner.length;i++){
      const a=inner[i],z=inner[(i+1)%inner.length];
      t.beginPath();t.moveTo(a.x,a.y);t.lineTo(z.x,z.y);t.lineTo(c.x+Math.sin(i*3)*w*.13,c.y+Math.cos(i*2)*h*.09);t.closePath();t.fillStyle=colors[i%colors.length];t.fill();
      const outerA=poly.vertices[i],outerB=poly.vertices[(i+1)%inner.length];
      t.beginPath();t.moveTo(outerA.x,outerA.y);t.lineTo(outerB.x,outerB.y);t.lineTo(z.x,z.y);t.lineTo(a.x,a.y);t.closePath();t.fillStyle=outerB.y<outerA.y?'#6c8286':'#20394b';t.fill();
      t.beginPath();t.moveTo(a.x,a.y);t.lineTo(z.x,z.y);t.strokeStyle='#a3babc20';t.lineWidth=1.3;t.stroke();
    }
    for(let i=0;i<Math.ceil(w*h/18000);i++){
      const px=b.minX+(Math.sin(i*93.7+c.x)*.5+.5)*w,py=b.minY+(Math.cos(i*39.4+c.y)*.5+.5)*h;
      t.beginPath();t.moveTo(px-13,py-9);t.lineTo(px+8,py-3);t.lineTo(px+19,py+18);t.strokeStyle='#c6d0c220';t.lineWidth=1;t.stroke();
      t.fillStyle='#122b3b55';t.beginPath();t.ellipse(px,py,7+i%11,4+i%5,.6,0,Math.PI*2);t.fill();
    }
    t.restore();path();t.strokeStyle='#a4bfc168';t.lineWidth=1.2;t.stroke();
    entry={signature,image};cache.set(poly,entry);
  }
  ctx.drawImage(entry.image,b.minX-margin,b.minY-margin,w+margin*2,h+margin*2);
}
