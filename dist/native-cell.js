import{sourceBlock}from'./source-cells.js';
// Read the current native tile, including attributes not visible in the picture.
export function nativeCellRule(map,x,y){
 const r=map.rom,i=y*map.width+x,t=map.layers.ground?.[i],native=t&&[r?.atlasId,...r?.layerAtlasIds||[]].includes(t.a)&&t.size===16;
 if(!r)return null;const word=sourceBlock(map,x,y)??r.originalBlocks?.[i]??0x3000,id=native?Math.floor(t.sy/16)*16+Math.floor(t.sx/16):word&1023,attr=r.attributes?.[id];if(attr===undefined)return null;
 const behavior=attr&((r.attributeEngine??r.engine)==='frlg'?511:255),collision=word>>>10&3,elevation=word>>>12&15,layerType=(r.attributeEngine??r.engine)==='frlg'?attr>>>29&3:attr>>>12&15;
 return{mode:collision?'block':behavior===16?'water':'walk',collision,elevation,behavior,layerType,nativeAttribute:attr>>>0};
}
