import{EXTRA_ASSETS}from'./asset-extras.js';
import{createMovementQuery}from'./world-model.js';
import{MASKS,normalizeMask}from'./smart-model.js';
import{landscapeHash}from'./landscape-field.js';
import{MAP_WEATHER}from'./map-environment.js';
export function regionAtmosphere(map,node,reader,sourceId){
 const features=node.settings.features,custom=node.settings.weather;
 if(custom!==undefined&&!MAP_WEATHER.some(([id])=>id===custom))throw Error('Choose a supported area weather.');
 if(features.weather===true||custom!==undefined){const p=landscapeHash(node.seed,2,7),habitat=node.climate?.habitat;
  const weather=custom??(node.biome==='underground'?0:node.biome==='snow'?(p<.65?4:0):node.biome==='desert'?(p<.3?8:p<.6?2:0):habitat==='jungle'?(p<.3?3:p<.5?13:p<.7?5:0):node.biome==='mountain'?(p<.1?4:p<.2?6:0):p<(node.biome==='forest'?.2:.15)?3:0);
  map.environment={weather,preview:true};
 }
 if(features.music===true&&reader&&sourceId){const type=node.kind==='settlement'?1:node.biome==='underground'?4:3,pool=[...new Set(reader.maps.filter(m=>m.type===type).map(m=>reader.u16(m.address+16)).filter(id=>id>0&&id<65535))];if(pool.length){const index=Math.floor(landscapeHash(node.seed,11,8)*pool.length);map.audio={...map.audio,nativeSongId:pool[index],nativeSourceId:sourceId};}}
}

export function regionPuddles(map,node,profile){
 if(node.settings.features.puddles!==true||profile.id!=='tre'||!['forest','meadow'].includes(node.biome))return[];
 const asset=EXTRA_ASSETS.find(a=>a.id==='emerald-puddle-terrain'),query=createMovementQuery(map),cells=new Set(),w=map.width;
 for(let y=4;y<map.height-4;y++)for(let x=4;x<map.width-4;x++){const i=y*w+x,r=query(x,y);if(r.collision||r.mode==='water'||r.behavior===2||map.layers.ground[i]?.a===profile.terrain.path)continue;if(landscapeHash(node.seed^810,Math.floor(x/4),Math.floor(y/3))>.94)cells.add(i);}
 for(const i of cells){const x=i%w,y=Math.floor(i/w);let mask=0;for(const[dx,dy,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(cells.has((y+dy)*w+x+dx))mask|=bit;const t=MASKS.indexOf(normalizeMask(mask));map.layers.details[i]={a:asset.id,sx:t%8*16,sy:Math.floor(t/8)*16,size:16,terrain:asset.id,movementMode:'walk',movementBehavior:0x16};map.movement[i]={mode:'walk',collision:0,elevation:3,behavior:0x16,layerType:1};}
 map.generator.puddleCells=cells.size;return cells.size?[asset]:[];
}
