// Defaults travel with artwork. Removing/moving art removes/moves its rule too.
export function terrainMovement(style){
 if(style?.movementMode)return style.movementMode;
 return /\b(water|surf|lake|ocean)\b/i.test([style?.name,style?.category,style?.id].join(' '))?'water':'walk';
}
export function automaticTileRule(map,x,y){
 const i=y*map.width+x;
 for(const layer of ['objects','details','ground']){
  const tile=map.layers[layer]?.[i];if(!tile)continue;
  if(tile.movementMode&&tile.movementMode!=='original')return {mode:tile.movementMode,...(tile.movementBehavior!==undefined?{behavior:tile.movementBehavior}:{}),automatic:true};
  if(tile.nativeRule)return {...tile.nativeRule,automatic:true};
 }
 return null;
}
export function objectDefaults(p){
 if(p.collisionMask)return {collisionChoice:'mask',collisionMask:structuredClone(p.collisionMask)};
 if(p.footprint)return {collisionChoice:p.collisionChoice&&p.collisionChoice!=='keep'?p.collisionChoice:'footprint',footprint:structuredClone(p.footprint)};
 if(p.collisionChoice&&p.collisionChoice!=='keep')return {collisionChoice:p.collisionChoice};
 const text=[p.name,p.category,...(Array.isArray(p.tags)?p.tags:[])].join(' '),w=p.w||1,h=p.h||1;
 if(/\b(rugs?|carpets?|mats?|floors?|flowers?|grass|paths?|decals?|shadows?)\b/i.test(text))return {collisionChoice:'walk'};
 if(/\b(trees?|palms?|plants?|signs?|lamps?|pillars?|statues?|bookshel(?:f|ves)|bookcases?|wardrobes?)\b/i.test(text)&&h>1)return {collisionChoice:'footprint',footprint:{x:/\b(trees?|palms?)\b/i.test(text)?Math.floor((w-1)/2):0,y:h-1,w:/\b(trees?|palms?)\b/i.test(text)?1:w,h:1}};
 return {collisionChoice:'solid'};
}
export function nativeMovementDefaults(blocks,attributes=[],engine=null){
 const counts=new Map(),best=[];
 for(const word of blocks){const id=word&1023,key=id+':'+(word>>>10),n=(counts.get(key)||0)+1;counts.set(key,n);if(!best[id]||n>best[id].count){const behavior=(attributes[id]||0)&(engine==='rse'?255:511);best[id]={count:n,mode:behavior===0x10?'water':word&0xc00?'block':'walk',collision:word>>>10&3,elevation:word>>>12&15,behavior,...(engine?{layerType:engine==='frlg'?(attributes[id]>>>29)&3:(attributes[id]>>>12)&15}:{})};}}
 return best.map(r=>r?(({count,...rule})=>rule)(r):null);
}
export function resizeObjectRules(object,w,h){
 const patch={};if(object.renderMask&&Number.isInteger(w)&&Number.isInteger(h))patch.renderMask=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>object.renderMask[Math.min(object.renderMask.length-1,Math.floor(y*object.h/h))]?.[Math.min(Math.ceil(object.w)-1,Math.floor(x*object.w/w))]||'behind'));
 if(object.footprint){const f=object.footprint;patch.footprint={x:f.x*w/object.w,y:f.y*h/object.h,w:f.w*w/object.w,h:f.h*h/object.h};}
 if(object.collisionMask){if(Number.isInteger(w)&&Number.isInteger(h))patch.collisionMask=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>object.collisionMask[Math.min(object.h-1,Math.floor(y*object.h/h))]?.[Math.min(object.w-1,Math.floor(x*object.w/w))]??null));else if(object.collisionChoice==='mask')patch.collisionChoice='base';}
 return patch;
}
export function withNativeRule(map,tile){
 if(!tile||map.autoCollision===false||!map.rom||![map.rom.atlasId,...(map.rom.layerAtlasIds||[])].includes(tile.a))return tile;
 const id=Math.floor(tile.sy/16)*16+Math.floor(tile.sx/16),rule=map.rom.tileDefaults?.[id];
 return rule?{...tile,nativeRule:{...rule}}:tile;
}
