import{coastalWater}from'./region-water.js';
import {randomFor} from './town-plan.js';

// World-coordinate fields keep neighbouring maps on the same landscape.
export function landscapeHash(seed,x,y){let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^(seed|0);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
export function landscapeNoise(seed,x,y,scale=24){const fx=x/scale,fy=y/scale,ix=Math.floor(fx),iy=Math.floor(fy),smooth=t=>t*t*(3-2*t),sx=smooth(fx-ix),sy=smooth(fy-iy),mix=(a,b,t)=>a+(b-a)*t;return mix(mix(landscapeHash(seed,ix,iy),landscapeHash(seed,ix+1,iy),sx),mix(landscapeHash(seed,ix,iy+1),landscapeHash(seed,ix+1,iy+1),sx),sy);}
// Adapt the upstream multi-scale terrain approach to deterministic world coordinates.
export function landscapeHeight(seed,x,y){return landscapeNoise(seed^0x2a71,x,y,96)*.5+landscapeNoise(seed^0x6b19,x,y,48)*.26+landscapeNoise(seed^0xa951,x,y,24)*.16+landscapeNoise(seed^0x9182,x,y,12)*.08;}
export function woodlandDensity(seed,x,y){return landscapeNoise(seed,x,y,27)*.7+landscapeNoise(seed^0x7345,x,y,9)*.3;}

export function planWaterways(plan,enabled=true){
 if(!enabled)return{features:[],has:()=>false};const coast=coastalWater(plan);const routes=plan.nodes.filter(n=>n.kind==='route'&&n.biome!=='underground'&&n.settings?.features?.water!==false),by=new Map(routes.map(n=>[n.id,n])),random=randomFor(plan.seed^0x8ba321),features=[];
 const candidates=plan.edges.filter(e=>by.has(e.from)&&by.has(e.to)).map(e=>({e,r:random()})).sort((a,b)=>a.r-b.r),used=new Set();
 for(const{e}of candidates){if(features.length>=Math.max(1,Math.floor(routes.length/5))||used.has(e.from)||used.has(e.to))continue;const a=by.get(e.from),b=by.get(e.to),horizontal=a.y===b.y,lo=horizontal?Math.min(a.worldX??a.x*64,b.worldX??b.x*64):Math.min(a.worldY??a.y*64,b.worldY??b.y*64),constant=(horizontal?(a.worldY??a.y*64):(a.worldX??a.x*64))+(random()<.5?.3:.7)*(horizontal?(a.height||64):(a.width||64)),start=lo+12,end=lo+(horizontal?(a.width||64)+(b.width||64):(a.height||64)+(b.height||64))-12;features.push({kind:'stream',horizontal,constant,start,end,seed:Math.floor(random()*4294967296),nodes:[a.id,b.id]});used.add(a.id);used.add(b.id);}
 for(const n of routes){const chance=n.climate?.habitat==='jungle'?.65:n.biome==='forest'?.4:n.biome==='desert'?.1:.25;if(landscapeHash(n.seed,9,2)>chance)continue;features.push({kind:'pond',x:(n.worldX??n.x*64)+12+Math.floor(landscapeHash(n.seed,7,1)*((n.width||64)-24)),y:(n.worldY??n.y*64)+12+Math.floor(landscapeHash(n.seed,3,5)*((n.height||64)-24)),rx:3+Math.floor(landscapeHash(n.seed,4,8)*4),ry:2+Math.floor(landscapeHash(n.seed,6,9)*4),seed:n.seed,nodes:[n.id]});}
 if(!features.length&&routes.length){const n=routes[Math.floor(random()*routes.length)];features.push({kind:'pond',x:(n.worldX??n.x*64)+12+Math.floor(random()*((n.width||64)-24)),y:(n.worldY??n.y*64)+12+Math.floor(random()*((n.height||64)-24)),rx:6,ry:4,seed:n.seed,nodes:[n.id]});}
 const has=(x,y)=>{if(!routes.some(n=>x>=(n.worldX??n.x*64)&&x<(n.worldX??n.x*64)+(n.width||64)&&y>=(n.worldY??n.y*64)&&y<(n.worldY??n.y*64)+(n.height||64)))return coast.has(x,y);if(coast.has(x,y))return true;return features.some(f=>{if(f.kind==='pond')return((x-f.x)/f.rx)**2+((y-f.y)/f.ry)**2<1;const along=f.horizontal?x:y,across=f.horizontal?y:x,clamped=Math.max(f.start,Math.min(f.end,along)),bend=(landscapeNoise(f.seed,clamped,0,22)-.5)*13,centre=f.constant+bend,radius=3.1+landscapeNoise(f.seed^31,clamped,0,11)*1.4;return((along-clamped)/radius)**2+((across-centre)/radius)**2<=1;});};return{features:[...features,...coast.features],has};
}

class Heap{
 constructor(){this.items=[];}
 push(item){const a=this.items;a.push(item);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p;}a[i]=item;}
 pop(){const a=this.items,head=a[0],tail=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=tail[0])break;a[i]=a[j];i=j;}a[i]=tail;}return head;}
 get length(){return this.items.length;}
}
export function landscapeRoute(node,{worldSeed=node.seed,water=null,sidePaths=true}={}){
 const random=randomFor(node.seed),size=node.width||64,height=node.height||64,columns=size/2,hub={x:Math.floor(size/4)*2-10+2*Math.floor(random()*11),y:Math.floor(height/4)*2-10+2*Math.floor(random()*11)},line=new Set(),points=[],key=(x,y)=>y*size+x;
 const draw=(a,b)=>{let{x,y}=a;line.add(key(x,y));while(x!==b.x||y!==b.y){if(x!==b.x)x+=Math.sign(b.x-x);else y+=Math.sign(b.y-y);line.add(key(x,y));}};
 const interior=e=>({x:e==='west'?6:e==='east'?size-6:size/2,y:e==='north'?6:e==='south'?height-6:height/2}),edge=e=>({x:e==='west'?0:e==='east'?size-1:size/2,y:e==='north'?0:e==='south'?height-1:height/2});
 for(const e of node.exits){let start=interior(e.edge);draw(edge(e.edge),start);
  const dx=hub.x-start.x,dy=hub.y-start.y,length=Math.hypot(dx,dy),bend=(random()<.5?-1:1)*(6+Math.floor(random()*7)),snap=(v,max)=>Math.max(6,Math.min(max-6,Math.round(v/2)*2)),
   waypoint={x:snap((start.x+hub.x)/2-(length?dy/length:0)*bend,size),y:snap((start.y+hub.y)/2+(length?dx/length:0)*bend,height)},
   targets=length>16?[waypoint,hub]:[hub];
  for(const target of targets){const dist=new Float64Array(size*height/4).fill(Infinity),previous=new Int32Array(size*height/4).fill(-1),queue=new Heap(),index=p=>p.y/2*columns+p.x/2,s=index(start),goal=index(target);dist[s]=0;queue.push([0,s]);
  while(queue.length){const[cost,i]=queue.pop();if(cost!==dist[i])continue;if(i===goal)break;const x=i%columns*2,y=Math.floor(i/columns)*2;for(const[dx,dy]of[[2,0],[-2,0],[0,2],[0,-2]]){const xx=x+dx,yy=y+dy;if(xx<6||yy<6||xx>size-6||yy>height-6)continue;const j=yy/2*columns+xx/2,gx=(node.worldX??node.x*64)+xx,gy=(node.worldY??node.y*64)+yy,terrain=landscapeNoise(worldSeed,gx,gy,16),slope=Math.abs(landscapeHeight(worldSeed,gx,gy)-landscapeHeight(worldSeed,(node.worldX??node.x*64)+x,(node.worldY??node.y*64)+y)),wet=water?.has(gx,gy),step=line.has(key(xx,yy))?.35:1+terrain*2.7+slope*90+(wet?5:0),next=cost+step;if(next<dist[j]){dist[j]=next;previous[j]=i;queue.push([next,j]);}}}
  if(!Number.isFinite(dist[goal]))throw Error('No bounded route could reach its clearing.');let at=goal;while(at!==s){const before=previous[at];if(before<0)throw Error('The route reconstruction was interrupted.');draw({x:at%columns*2,y:Math.floor(at/columns)*2},{x:before%columns*2,y:Math.floor(before/columns)*2});at=before;}start=target;}points.push(edge(e.edge));
 }
 if(node.exits.length>1){const protectedCells=new Set(points.map(p=>key(p.x,p.y))),neighbours=i=>[i%size?i-1:-1,i%size<size-1?i+1:-1,i-size,i+size].filter(j=>line.has(j)),todo=[...line].filter(i=>!protectedCells.has(i)&&neighbours(i).length<2);while(todo.length){const i=todo.pop();if(!line.has(i)||protectedCells.has(i)||neighbours(i).length>1)continue;const adjacent=neighbours(i);line.delete(i);todo.push(...adjacent);}}
 const sideClearings=[];if(sidePaths)for(let tries=0;tries<20&&sideClearings.length<2;tries++){const p={x:8+2*Math.floor(random()*(size-16)/2),y:8+2*Math.floor(random()*(height-16)/2)},near=[...line].map(i=>({x:i%size,y:Math.floor(i/size)})).sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y))[0],distance=Math.abs(near.x-p.x)+Math.abs(near.y-p.y);if(distance<8||distance>18||sideClearings.some(c=>Math.abs(c.x-p.x)+Math.abs(c.y-p.y)<10))continue;draw(near,p);sideClearings.push({...p,rx:4,ry:3});}
 const road=new Set();for(const i of line){const x=i%size,y=Math.floor(i/size);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<size&&yy<height)road.add(key(xx,yy));}}
 const clearing=node.exits.length===1?{...hub,rx:6,ry:5}:null;return{road,clearing,sideClearings,spine:line};
}

export function forestThreshold(node,plan,x,y){
 const base=n=>n?.biome==='forest'?(n.climate?.habitat==='jungle'?.2:n.climate?.habitat==='pine forest'?.4:.32):.57;let value=base(node),weight=1;
 for(const[edge,nx,ny,distance]of[['west',node.x-1,node.y,x],['east',node.x+1,node.y,(node.width||64)-1-x],['north',node.x,node.y-1,y],['south',node.x,node.y+1,(node.height||64)-1-y]]){if(distance>=10||!node.exits.some(e=>e.edge===edge))continue;const neighbour=plan.nodes.find(n=>n.x===nx&&n.y===ny);if(!neighbour)continue;const w=(10-distance)/10;value+=base(neighbour)*w;weight+=w;}
 return value/weight;
}
export function openRegionEdge(node,x,y,size=64){return node.exits.some(e=>e.edge==='west'&&x===0||e.edge==='east'&&x===(node.width||size)-1||e.edge==='north'&&y===0||e.edge==='south'&&y===(node.height||size)-1);}
