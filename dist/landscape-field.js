import {randomFor} from './town-plan.js';

// World-coordinate fields keep neighbouring maps on the same landscape.
export function landscapeHash(seed,x,y){let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^(seed|0);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
export function landscapeNoise(seed,x,y,scale=24){const fx=x/scale,fy=y/scale,ix=Math.floor(fx),iy=Math.floor(fy),smooth=t=>t*t*(3-2*t),sx=smooth(fx-ix),sy=smooth(fy-iy),mix=(a,b,t)=>a+(b-a)*t;return mix(mix(landscapeHash(seed,ix,iy),landscapeHash(seed,ix+1,iy),sx),mix(landscapeHash(seed,ix,iy+1),landscapeHash(seed,ix+1,iy+1),sx),sy);}
export function woodlandDensity(seed,x,y){return landscapeNoise(seed,x,y,27)*.7+landscapeNoise(seed^0x7345,x,y,9)*.3;}

export function planWaterways(plan,enabled=true){
 if(!enabled)return{features:[],has:()=>false};const routes=plan.nodes.filter(n=>n.kind==='route'),by=new Map(routes.map(n=>[n.id,n])),random=randomFor(plan.seed^0x8ba321),features=[];
 const candidates=plan.edges.filter(e=>by.has(e.from)&&by.has(e.to)).map(e=>({e,r:random()})).sort((a,b)=>a.r-b.r),used=new Set();
 for(const{e}of candidates){if(features.length>=Math.max(1,Math.floor(routes.length/5))||used.has(e.from)||used.has(e.to))continue;const a=by.get(e.from),b=by.get(e.to),horizontal=a.y===b.y,lo=horizontal?Math.min(a.x,b.x)*64:Math.min(a.y,b.y)*64,constant=(horizontal?a.y:a.x)*64+(random()<.5?19:45),start=lo+17,end=lo+111;features.push({kind:'stream',horizontal,constant,start,end,seed:Math.floor(random()*4294967296),nodes:[a.id,b.id]});used.add(a.id);used.add(b.id);}
 if(!features.length&&routes.length){const n=routes[Math.floor(random()*routes.length)];features.push({kind:'pond',x:n.x*64+20+Math.floor(random()*24),y:n.y*64+20+Math.floor(random()*24),rx:6,ry:4,seed:n.seed,nodes:[n.id]});}
 const allowed=new Set(routes.map(n=>n.x+','+n.y)),has=(x,y)=>{if(!allowed.has(Math.floor(x/64)+','+Math.floor(y/64)))return false;return features.some(f=>{if(f.kind==='pond')return((x-f.x)/f.rx)**2+((y-f.y)/f.ry)**2<1;const along=f.horizontal?x:y,across=f.horizontal?y:x,clamped=Math.max(f.start,Math.min(f.end,along)),bend=(landscapeNoise(f.seed,clamped,0,22)-.5)*13,centre=f.constant+bend,radius=3.1+landscapeNoise(f.seed^31,clamped,0,11)*1.4;return((along-clamped)/radius)**2+((across-centre)/radius)**2<=1;});};return{features,has};
}

class Heap{
 constructor(){this.items=[];}
 push(item){const a=this.items;a.push(item);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p;}a[i]=item;}
 pop(){const a=this.items,head=a[0],tail=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=tail[0])break;a[i]=a[j];i=j;}a[i]=tail;}return head;}
 get length(){return this.items.length;}
}
export function landscapeRoute(node,{worldSeed=node.seed,water=null}={}){
 const random=randomFor(node.seed),size=64,hub={x:22+2*Math.floor(random()*11),y:22+2*Math.floor(random()*11)},line=new Set(),points=[],key=(x,y)=>y*size+x;
 const draw=(a,b)=>{let{x,y}=a;line.add(key(x,y));while(x!==b.x||y!==b.y){if(x!==b.x)x+=Math.sign(b.x-x);else y+=Math.sign(b.y-y);line.add(key(x,y));}};
 const interior=e=>({x:e==='west'?6:e==='east'?58:32,y:e==='north'?6:e==='south'?58:32}),edge=e=>({x:e==='west'?0:e==='east'?63:32,y:e==='north'?0:e==='south'?63:32});
 for(const e of node.exits){const start=interior(e.edge);draw(edge(e.edge),start);const dist=new Float64Array(1024).fill(Infinity),previous=new Int32Array(1024).fill(-1),queue=new Heap(),index=p=>p.y/2*32+p.x/2,s=index(start),goal=index(hub);dist[s]=0;queue.push([0,s]);
  while(queue.length){const[cost,i]=queue.pop();if(cost!==dist[i])continue;if(i===goal)break;const x=i%32*2,y=Math.floor(i/32)*2;for(const[dx,dy]of[[2,0],[-2,0],[0,2],[0,-2]]){const xx=x+dx,yy=y+dy;if(xx<6||yy<6||xx>58||yy>58)continue;const j=yy/2*32+xx/2,gx=node.x*64+xx,gy=node.y*64+yy,terrain=landscapeNoise(worldSeed,gx,gy,16),wet=water?.has(gx,gy),step=line.has(key(xx,yy))?.35:1+terrain*2.7+(wet?5:0),next=cost+step;if(next<dist[j]){dist[j]=next;previous[j]=i;queue.push([next,j]);}}}
  if(!Number.isFinite(dist[goal]))throw Error('No bounded route could reach its clearing.');let at=goal;while(at!==s){const before=previous[at];if(before<0)throw Error('The route reconstruction was interrupted.');draw({x:at%32*2,y:Math.floor(at/32)*2},{x:before%32*2,y:Math.floor(before/32)*2});at=before;}points.push(edge(e.edge));
 }
 if(node.exits.length>1){const protectedCells=new Set(points.map(p=>key(p.x,p.y))),neighbours=i=>[i%64?i-1:-1,i%64<63?i+1:-1,i-64,i+64].filter(j=>line.has(j)),todo=[...line].filter(i=>!protectedCells.has(i)&&neighbours(i).length<2);while(todo.length){const i=todo.pop();if(!line.has(i)||protectedCells.has(i)||neighbours(i).length>1)continue;const adjacent=neighbours(i);line.delete(i);todo.push(...adjacent);}}
 const road=new Set();for(const i of line){const x=i%64,y=Math.floor(i/64);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<64&&yy<64)road.add(key(xx,yy));}}
 const clearing=node.exits.length===1?{...hub,rx:6,ry:5}:null;return{road,clearing,spine:line};
}

export function forestThreshold(node,plan,x,y){
 const base=n=>n?.biome==='forest'?.32:.57;let value=base(node),weight=1;
 for(const[edge,nx,ny,distance]of[['west',node.x-1,node.y,x],['east',node.x+1,node.y,63-x],['north',node.x,node.y-1,y],['south',node.x,node.y+1,63-y]]){if(distance>=10||!node.exits.some(e=>e.edge===edge))continue;const neighbour=plan.nodes.find(n=>n.x===nx&&n.y===ny);if(!neighbour)continue;const w=(10-distance)/10;value+=base(neighbour)*w;weight+=w;}
 return value/weight;
}
export function openRegionEdge(node,x,y,size=64){return node.exits.some(e=>e.edge==='west'&&x===0||e.edge==='east'&&x===size-1||e.edge==='north'&&y===0||e.edge==='south'&&y===size-1);}
