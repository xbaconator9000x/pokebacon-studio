import {nativeLayerTypes} from './native-priority.js';
import {sourceBlock} from './source-cells.js';
import {nativeMovementDefaults} from './movement-defaults.js';

export async function exposeNativeLayers(project,map,reader,encode){
 if(!map.rom||map.rom.generated)return false;const source=reader.byKey(map.rom.key);if(!source)return false;
 const atlas=reader.atlas(source),info=map.rom;let changed=false;if(info.engine!==reader.engine||!info.layerTypes){info.engine=reader.engine;info.layerTypes=nativeLayerTypes(atlas.attrs,reader.engine);changed=true;}
 if(!info.tileDefaults){info.tileDefaults=nativeMovementDefaults(info.originalBlocks||reader.blocks(source),atlas.attrs,reader.engine);changed=true;}
 if(info.nativeLayerSplit)return changed;
 const ids=Array.from({length:atlas.metatileLayers||2},(_,i)=>info.atlasId+'-layer-'+i),base=project.assets.find(a=>a.id===info.atlasId);
 if(!base)return changed;
 for(let l=0;l<ids.length;l++)if(!project.assets.some(a=>a.id===ids[l])){project.assets.push({...base,id:ids[l],name:base.name+' · '+['Lower tiles','Upper tiles','Above player'][l],data:await encode({...atlas,pixels:atlas.layers[l]}),rom:{...base.rom,layer:l}});}
 for(let i=0;i<map.layers.ground.length;i++){
  const tile=map.layers.ground[i],word=sourceBlock(map,i%map.width,Math.floor(i/map.width));
  // Keep every authored tile and decoration intact; split untouched source cells.
  if(!tile||tile.a!==info.atlasId||tile.terrain||tile.nativeRule||map.layers.details[i]||word===undefined||Math.floor(tile.sy/16)*16+Math.floor(tile.sx/16)!==(word&1023))continue;
  map.layers.ground[i]={...tile,a:ids[0]};map.layers.details[i]={...tile,a:ids[1]};if(ids[2]&&!map.layers.overhead[i])map.layers.overhead[i]={...tile,a:ids[2]};
 }
 info.layerAtlasIds=ids;info.nativeLayerSplit=true;return true;
}
