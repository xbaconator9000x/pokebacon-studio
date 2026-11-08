// Editor annotations only: never adds an NPC or changes native visibility.
export function itemMarkerStyle(n){
 if(n.runtime?.itemAppearance==='hidden')return 'hidden';
 if(n.runtime?.itemAppearance==='visible')return 'visible';
 if(n.rom?.type==='sign'&&n.rom.signType>=5&&n.rom.signType<=7)return 'hidden';
 // Older pickup drafts lack appearance metadata. Do not turn NPC gifts into balls.
 const steps=n.runtime?.steps;
 if(!n.npc&&n.rom?.type!=='npc'&&steps?.length===1&&steps[0].type==='item'&&steps[0].operation==='give')return 'visible';
 return null;
}
export function drawItemMarker(ctx,x,y,size,style){
 ctx.save();ctx.translate(x,y);ctx.lineWidth=Math.max(.8,size*.14);ctx.strokeStyle='#182630';
 if(style==='hidden'){ctx.globalAlpha*=.7;ctx.setLineDash([size*.25,size*.2]);}
 ctx.beginPath();ctx.arc(0,0,size,Math.PI,Math.PI*2);ctx.closePath();ctx.fillStyle=style==='hidden'?'#b58cde':'#ed5555';ctx.fill();
 ctx.beginPath();ctx.arc(0,0,size,0,Math.PI);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();
 ctx.beginPath();ctx.arc(0,0,size,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size,0);ctx.stroke();
 ctx.beginPath();ctx.arc(0,0,size*.29,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.stroke();
 if(style==='hidden'){ctx.fillStyle='#182630';ctx.font=`bold ${size*.72}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',0,-size*.55);}
 ctx.restore();
}
