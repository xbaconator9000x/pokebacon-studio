import{MASKS,normalizeMask}from'./smart-model.js';
import{landscapeHeight,woodlandDensity}from'./landscape-field.js';
export const REGION_LEDGE_ASSET={id:'region-frlg-ledges',name:'Kanto route ledges',src:'assets/settlements/region-frlg-ledges.png',width:48,height:16,tileSize:16,category:'Included region terrain'};
export function paintRegionLedges(map,node,road,enabled=true){
 const bands=[];if(!enabled||!['meadow','forest','mountain'].includes(node.biome))return bands;const w=map.width,h=map.height,free=(x,y)=>{for(let yy=y-1;yy<=y+2;yy++)for(let xx=x-1;xx<=x+1;xx++){const i=yy*w+xx;if(road.has(i)||map.movement[i]?.collision||map.movement[i]?.mode==='water')return false;}return true;},height=(x,y)=>Math.floor(landscapeHeight((map.generator.landscape.worldSeed??node.seed)^0x57,(node.worldX??node.x*64)+x,(node.worldY??node.y*64)+y)*16);
 for(let y=5;y<h-5;y++){let run=[];const flush=()=>{if(run.length>=3&&bands.length<8){const xs=run.slice(0,12);bands.push({x:xs[0],y,length:xs.length,direction:'south'});xs.forEach((x,j)=>{const i=y*w+x;map.layers.ground[i]={a:REGION_LEDGE_ASSET.id,sx:(j===0?0:j===xs.length-1?2:1)*16,sy:0,size:16};map.movement[i]={mode:'ledge_south',collision:1,elevation:3,behavior:0x3b,layerType:1};});}run=[];};for(let x=5;x<w-5;x++){if(free(x,y)&&height(x,y)>height(x,y+1))run.push(x);else flush();}flush();}return bands;
}

export const REGION_GRASS_ASSET={id:'region-frlg-grass',name:'Kanto route encounter grass',src:'assets/settlements/region-frlg-grass.png',width:16,height:16,tileSize:16,category:'Included region terrain'};
export function paintRegionGrass(map,node,road,enabled=true){let count=0;if(!enabled||!['meadow','forest','mountain','coastal'].includes(node.biome))return count;const w=map.width;for(let y=3;y<map.height-3;y++)for(let x=3;x<w-3;x++){const i=y*w+x,r=map.movement[i];if(road.has(i)||r.collision||r.mode==='water')continue;const gx=(node.worldX??node.x*64)+x,gy=(node.worldY??node.y*64)+y;if(woodlandDensity((map.generator.landscape.worldSeed??node.seed)^0x2435,gx,gy)<(node.climate?.habitat==='dry plains'?.7:.58))continue;map.layers.ground[i]={a:REGION_GRASS_ASSET.id,sx:0,sy:0,size:16};map.movement[i]={mode:'walk',collision:0,elevation:3,behavior:2,layerType:1};count++;}return count;}

export function paintWildGround(map,node,road,smart,enabled=true){
 const token={snow:'snow-stone',desert:'desert-3'}[node.biome];if(!enabled||!token)return{count:0,asset:null};const asset=smart.assets.find(a=>a.id==='smart-ekat-s-public-tiles-autotiles-'+token);if(!asset)throw Error('The included wild-ground texture is missing.');const cells=new Set(),w=map.width;
 for(let y=3;y<map.height-3;y++)for(let x=3;x<w-3;x++){const i=y*w+x,r=map.movement[i];if(road.has(i)||r.collision||r.mode==='water')continue;if(woodlandDensity((map.generator.landscape.worldSeed??node.seed)^0x2435,(node.worldX??node.x*64)+x,(node.worldY??node.y*64)+y)>.65)cells.add(i);}
 for(const i of cells){const x=i%w,y=Math.floor(i/w);let mask=0;for(const[dx,dy,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(cells.has((y+dy)*w+x+dx))mask|=bit;const tile=MASKS.indexOf(normalizeMask(mask));map.layers.ground[i]={a:asset.id,sx:tile%8*16,sy:Math.floor(tile/8)*16,size:16};map.movement[i]={mode:'walk',collision:0,elevation:3,behavior:2,layerType:1};}
 return{count:cells.size,asset:cells.size?asset:null};
}
