import{MASKS,normalizeMask}from'./smart-model.js';
const walk={mode:'walk',collision:0,elevation:3,behavior:0,layerType:1};
export function paintRegionWater(map,node,road,water,waterAsset,pierId,{occupied=()=>false}={}){
 const w=map.width,h=map.height,gx=node.worldX??node.x*64,gy=node.worldY??node.y*64,wet=(x,y)=>water.has(gx+x,gy+y),cells=new Set(),bridges=new Set();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!wet(x,y)||occupied(x,y))continue;const i=y*w+x;cells.add(i);if(road.has(i))bridges.add(i);}
 for(const i of cells){const x=i%w,y=Math.floor(i/w);let sx,sy,a=waterAsset.id,rule={...walk,mode:'water',elevation:1,behavior:0x10};
  if(bridges.has(i)){const has=(xx,yy)=>xx>=0&&yy>=0&&xx<w&&yy<h&&bridges.has(yy*w+xx);sx=(!has(x-1,y)?0:!has(x+1,y)?2:1)*16;sy=(!has(x,y-1)?0:!has(x,y+1)?2:1)*16;a=pierId;rule=walk;}
  else{let mask=0;for(const[dx,dy,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(wet(x+dx,y+dy))mask|=bit;const t=MASKS.indexOf(normalizeMask(mask));sx=t%8*16;sy=Math.floor(t/8)*16;}
  map.layers.ground[i]={a,sx,sy,size:16};map.movement[i]={...rule};
 }
 return{cells,bridges};
}

// The sea follows exposed region edges. Shared world coordinates bend each
// shoreline; nearby interior map joins remain land unless both sides are sea.
export function coastalWater(plan){
 const by=new Map(plan.nodes.map(n=>[n.x+','+n.y,n])),coasts=[];
 for(const n of plan.nodes.filter(n=>n.biome==='coastal'&&n.settings?.features?.water!==false))for(const[edge,dx,dy]of [['north',0,-1],['south',0,1],['west',-1,0],['east',1,0]])if(!by.has((n.x+dx)+','+(n.y+dy)))coasts.push({node:n,edge});
 const has=(x,y)=>coasts.some(({node:n,edge})=>{
  const gx=n.worldX??n.x*64,gy=n.worldY??n.y*64,w=n.width||64,h=n.height||64,lx=x-gx,ly=y-gy,along=['north','south'].includes(edge)?x:y;
  if(lx< -1||ly< -1||lx>w||ly>h)return false;
  const distance=edge==='north'?ly:edge==='south'?h-1-ly:edge==='west'?lx:w-1-lx,
   depth=7+Math.sin((along+plan.seed%97)/13)*1.5+Math.sin((along-plan.seed%53)/7)*.8;
  // Taper the sea away from an inland neighbour, without clipping a tree or
  // letting a shoreline end abruptly against the next settlement.
  let taper=1;for(const[dx,dy,d]of [[-1,0,lx],[1,0,w-1-lx],[0,-1,ly],[0,1,h-1-ly]]){const other=by.get((n.x+dx)+','+(n.y+dy));if(other&&(other.biome!=='coastal'||other.settings?.features?.water===false))taper=Math.min(taper,Math.max(0,d/8));}
  return distance<depth*taper&&taper>0;
 });return{features:coasts.map(c=>({kind:'coast',node:c.node.id,edge:c.edge})),has};
}
