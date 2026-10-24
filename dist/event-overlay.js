export function drawEventOverlay(ctx,map,scale){
 ctx.save();ctx.lineWidth=1.5/scale;ctx.font=10/Math.max(.75,scale)+'px system-ui';
 for(const n of map.markers){if(!n.runtime||n.runtime.enabled===false)continue;const r=n.runtime;ctx.fillStyle='#c4ad4233';ctx.strokeStyle='#d2b54f';
  if(r.area){const a=r.area;ctx.fillRect(a.x*16,a.y*16,a.width*16,a.height*16);ctx.strokeRect(a.x*16,a.y*16,a.width*16,a.height*16);}
  if(r.trigger==='radius'){ctx.beginPath();ctx.arc((n.x+.5)*16,(n.y+.5)*16,(r.radius||2)*16,0,Math.PI*2);ctx.fill();ctx.stroke();}
  const visit=steps=>{for(const s of steps||[]){if(s.type==='path'&&s.points?.length){ctx.beginPath();s.points.forEach((p,i)=>ctx[i?'lineTo':'moveTo']((p.x+.5)*16,(p.y+.5)*16));ctx.stroke();for(const p of s.points){ctx.beginPath();ctx.arc((p.x+.5)*16,(p.y+.5)*16,2.5/scale,0,Math.PI*2);ctx.fill();}}for(const k of ['then','else','yes','no','cancel'])if(Array.isArray(s[k]))visit(s[k]);for(const choice of s.choices||[])visit(choice.steps);}};visit(r.steps);visit(r.repeatSteps);
  ctx.fillStyle='#1b3629';ctx.fillText(n.title,(n.x+1)*16,(n.y+.5)*16);
 }ctx.restore();
}
