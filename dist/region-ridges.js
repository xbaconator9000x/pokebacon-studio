import {landscapeHeight,landscapeHash,landscapeNoise} from './landscape-field.js';
import {caveTiles} from './cave-generator.js';

export const REGION_RIDGE_ASSET={id:'region-frlg-ridges',name:'Kanto outdoor ridges and stairs',src:'assets/settlements/region-frlg-ridges.png',width:48,height:80,tileSize:16,category:'Included region terrain'};
export const REGION_CLIFF_ASSET={id:'region-frlg-cliffs',name:'Kanto joined outdoor cliffs',src:'assets/settlements/region-frlg-cliffs.png',width:128,height:96,tileSize:16,category:'Included region terrain'};
const walk={mode:'walk',collision:0,elevation:3,behavior:0,layerType:1};

export function paintHeightRidges(map,node,road,layout,{enabled=true}={}){
 if(!enabled||node.biome!=='mountain')return 0;
 const w=map.width,h=map.height,seed=map.generator.landscape.worldSeed,gx=node.worldX??node.x*64,gy=node.worldY??node.y*64,
  sample=(x,y)=>landscapeHeight(seed,gx+x,gy+y)*.55+landscapeNoise(seed^0x7a13,gx+x,gy+y,16)*.45,
  values=Array.from({length:w*h},(_,i)=>sample(Math.floor(i%w/4)*4+2,Math.floor(Math.floor(i/w)/4)*4+2)),sorted=[...values].sort((a,b)=>a-b),cutoff=sorted[Math.floor(sorted.length*.62)],
  protectedCells=new Set(),solid=Array(w*h).fill(false),clearings=[layout.clearing,...layout.sideClearings].filter(Boolean);
 for(const i of road)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=i%w+dx,y=Math.floor(i/w)+dy;if(x>=0&&y>=0&&x<w&&y<h)protectedCells.add(y*w+x);}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,nearJoin=node.exits.some(e=>e.edge==='west'&&x<4||e.edge==='east'&&x>=w-4||e.edge==='north'&&y<4||e.edge==='south'&&y>=h-4);
  solid[i]=values[i]>cutoff&&!protectedCells.has(i)&&!nearJoin&&map.movement[i].mode!=='water'&&!clearings.some(c=>((x-c.x)/(c.rx+2))**2+((y-c.y)/(c.ry+2))**2<1);
 }
 // Remove narrow teeth before choosing native inner/outer corner quadrants.
 const neighbours=i=>[i>=w?i-w:null,i<w*(h-1)?i+w:null,i%w?i-1:null,i%w<w-1?i+1:null],eroded=solid.map((on,i)=>on&&neighbours(i).every(j=>j===null||solid[j])),joined=solid.map((on,i)=>on&&(eroded[i]||neighbours(i).some(j=>j!==null&&eroded[j])));
 const tiles=caveTiles(joined,w,h,{version:2});let count=0;
 for(let i=0;i<joined.length;i++)if(joined[i]){const t=tiles[i];map.layers.ground[i]={a:REGION_CLIFF_ASSET.id,sx:t%8*16,sy:Math.floor(t/8)*16,size:16,terrain:'region-outdoor-cliffs',movementMode:'block',movementBehavior:0};map.movement[i]={...walk,mode:'block',collision:1};count++;}
 return count;
}

// Quantized height blocks select broad formations, rather than treating every
// noisy contour pixel as a cliff. Complete native caps keep the faces joined.
export function paintRegionRidges(map,node,road,{enabled=true}={}){
 if(!enabled||node.biome!=='mountain')return [];
 const w=map.width,h=map.height,seed=map.generator.landscape.worldSeed,
  gx=node.worldX??node.x*64,gy=node.worldY??node.y*64,
  occupied=new Set(),ridges=[],candidates=[];
 const free=(x,y)=>x>=3&&y>=3&&x<w-3&&y<h-3&&!road.has(y*w+x)&&!occupied.has(y*w+x)&&!map.movement[y*w+x].collision&&map.movement[y*w+x].mode!=='water';
 for(let y=6;y<h-8;y+=3)for(let x=6;x<w-8;x+=3){
  const noise=landscapeHash(node.seed,x,y),rw=6+2*Math.floor(noise*5),rh=5+Math.floor(landscapeHash(node.seed^17,x,y)*5);
  if(x+rw>=w-4||y+rh>=h-5)continue;
  let valid=true;for(let yy=y-1;yy<y+rh+2&&valid;yy++)for(let xx=x-1;xx<x+rw+1;xx++)if(!free(xx,yy)){valid=false;break;}
  if(!valid)continue;
  const stair={x:x+Math.floor(rw/2)-1,y:y+rh-1,w:2,h:1},start=(stair.y+1)*w+stair.x,
   queue=[start],previous=new Map([[start,-1]]),depth=new Map([[start,0]]);let goal;
  for(let head=0;head<queue.length;head++){
   const i=queue[head];if(road.has(i)){goal=i;break;}if(depth.get(i)>=22)continue;
   for(const j of [i+w,i-1,i+1,i-w]){const xx=j%w,yy=Math.floor(j/w);
    if(previous.has(j)||!free(xx,yy)&&!road.has(j)||xx>=x-1&&xx<=x+rw&&yy>=y-1&&yy<=y+rh-1)continue;
    previous.set(j,i);depth.set(j,depth.get(i)+1);queue.push(j);
   }
  }
  if(goal===undefined)continue;const approach=[];for(let i=goal;i!==-1;i=previous.get(i))approach.push(i);
  const distance=approach.length;
  const height=Math.floor(landscapeHeight(seed,gx+x+rw/2,gy+y+rh/2)*16);
  candidates.push({x,y,w:rw,h:rh,stair,approach,height,score:height+noise*.8-distance*.025});
 }
 candidates.sort((a,b)=>b.score-a.score);
 for(const r of candidates){
  if(ridges.length>=2)break;
  let valid=true;for(let y=r.y-1;y<r.y+r.h+2&&valid;y++)for(let x=r.x-1;x<r.x+r.w+1;x++)if(!free(x,y)){valid=false;break;}
  if(!valid||r.approach.some(i=>occupied.has(i)))continue;
  for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
   const i=y*w+x,col=x===r.x?0:x===r.x+r.w-1?2:1,row=y===r.y?0:y===r.y+r.h-1?2:1,edge=col!==1||row!==1;
   map.layers.ground[i]={a:REGION_RIDGE_ASSET.id,sx:col*16,sy:row*16,size:16};
   map.movement[i]={...walk,...(edge?{mode:'block',collision:1}:{})};occupied.add(i);
  }
  // The native stair is two cells across, not two cells stacked. The other
  // cliff edges stay solid in both the playtester and exported movement grid.
  for(let dx=0;dx<2;dx++){const i=r.stair.y*w+r.stair.x+dx;map.layers.ground[i]={a:REGION_RIDGE_ASSET.id,sx:16,sy:(dx===0?4:3)*16,size:16};map.movement[i]={...walk};}
  for(const i of r.approach){road.add(i);map.movement[i]={...walk};}
  ridges.push(r);
 }
 return ridges;
}

export function paintNativeOutcrops(map,node,road,catalog,{enabled=true}={}){
 if(!enabled||!['mountain','meadow','forest'].includes(node.biome))return [];
 const w=map.width,h=map.height,placed=[],target=node.biome==='mountain'?7:2;
 for(let k=0;k<240&&placed.length<target;k++){
  const p=catalog.patterns[Math.floor(landscapeHash(node.seed^71,k,0)*catalog.patterns.length)],
   x=3+Math.floor(landscapeHash(node.seed^83,k,1)*(w-p.w-6)),y=3+Math.floor(landscapeHash(node.seed^97,k,2)*(h-p.h-6));
  let free=true;
  for(let yy=y-1;yy<y+p.h+1&&free;yy++)for(let xx=x-1;xx<x+p.w+1;xx++){
   const i=yy*w+xx;if(road.has(i)||map.movement[i].collision||map.movement[i].mode==='water'||placed.some(r=>xx>=r.x-1&&xx<r.x+r.w+1&&yy>=r.y-1&&yy<r.y+r.h+1)){free=false;break;}
  }
  if(!free)continue;
  for(let j=0;j<p.tiles.length;j++){const t=p.tiles[j];if(t===null)continue;const i=(y+Math.floor(j/p.w))*w+x+j%p.w;
   map.layers.ground[i]={a:catalog.asset.id,sx:t%8*16,sy:Math.floor(t/8)*16,size:16};map.movement[i]={...walk,mode:'block',collision:1};
  }
  placed.push({x,y,w:p.w,h:p.h,pattern:p.name});
 }
 return placed;
}
