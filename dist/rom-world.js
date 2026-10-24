/** Verified native map-group accessor; no guessed game-code/offset fallback. */
export function discoverNewMapSupport(reader){
 if(reader.bankCount>=128)return null;
 const signature=[0,4,9,4,3,74,128,11,128,24,0,104,137,11,9,24,8,104,112,71],refs=[];
 for(let at=0;at<reader.size-4;at+=4)if(reader.ptr(at)===reader.mapTable)refs.push(at);
 // Classic add/ldr accessor and the register-indexed accessor used by newer
 // expansion builds implement the same u16 bank/map -> two pointer loads.
 const indexed=[3,75,0,4,128,11,195,88,9,4,137,11,200,88,112,71];
 const classic=refs.some(at=>at>=20&&signature.every((v,i)=>reader.bytes[at-20+i]===v));
 const expansion=refs.some(at=>at>=16&&(at&3)===0&&indexed.every((v,i)=>reader.bytes[at-16+i]===v));
 if(!refs.length||!classic&&!expansion)return null;
 return{bank:reader.bankCount,refs,accessor:expansion?'indexed':'classic'};
}
export function sourceForMap(reader,map){
 if(!map.rom?.generated)return reader.byKey(map.rom?.key);
 const selected=reader.byKey(map.rom.templateKey);if(selected)return selected;
 if([1,2,3,4].includes(map.rom?.mapType)){const type=map.rom.mapType===4?4:1;const outdoor=reader.maps.find(m=>m.type===type);if(outdoor)return outdoor;}
 return reader.maps.find(m=>m.type===8&&m.layout.width>=8&&m.layout.height>=8)||reader.maps.find(m=>m.type===8)||reader.maps[0];
}
