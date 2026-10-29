// Native 16x16 metatiles own a separate background priority attribute.
// pret/pokefirered include/global.fieldmap.h and src/field_camera.c:
// 0 = middle/top, 1 = bottom/middle, 2 = bottom/top backgrounds.
export const NATIVE_PRIORITIES=['Normal · middle + top','Covered · bottom + middle','Split · bottom + top'];
export function nativeLayerType(map,x,y){
 const r=map.rom;if(!r)return null;const i=y*map.width+x,g=map.layers.ground?.[i],d=map.layers.details?.[i],native=t=>t&&[r.atlasId,...(r.layerAtlasIds||[])].includes(t.a);const t=native(g)?g:d?.a===r.layerAtlasIds?.[1]?d:null;if(!t||t.size!==16)return null;
 const id=Math.floor(t.sy/16)*16+Math.floor(t.sx/16);let value=r.layerTypes?.[id];
 if(value===undefined&&['frlg','rse'].includes(r.engine)&&r.attributes?.[id]!==undefined)value=(r.attributeEngine??r.engine)==='frlg'?(r.attributes[id]>>>29)&3:(r.attributes[id]>>>12)&15;
 return Number.isInteger(value)&&value>=0&&value<=2?value:null;
}
export function nativeLayerTypes(attributes,engine){return Array.from(attributes,n=>engine==='frlg'?(n>>>29)&3:(n>>>12)&15);}
