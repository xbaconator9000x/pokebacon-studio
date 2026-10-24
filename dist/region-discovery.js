import{decompressLZ,decodeText}from'./rom.js';
const cache=new WeakMap();
// Classic Emerald 8-bit region artwork. Resource structure and native pointer
// references identify the adapter; a filename or the opened ROM's digest does not.
export function discoverEmeraldRegion(reader){
 if(cache.has(reader))return cache.get(reader);let result=null;
 if(reader.engine!=='rse'||!reader.bytes||typeof reader.ptr!=='function')return null;
 const r=reader,b=r.bytes,locations=Object.create(r);if(!r.nameTable)locations.findRegionNames?.();const entries=locations.nameTable;
 if(!Number.isInteger(entries))return null;
 let count=0;for(;count<256;count++){const at=entries+count*8;if(!r.valid(at,8))break;const p=r.ptr(at+4),dims=[...b.slice(at,at+4)];if(dims.some(n=>n>64))break;if(r.u32(at+4)===0)continue;if(p<512)break;let end=p;while(end<Math.min(b.length,p+80)&&b[end]!==255)end++;const text=decodeText(b,p,80);if(end===Math.min(b.length,p+80)||text&&text.length>48)break;}
 if(count<30)return null;
 const graphics=[];
 for(let at=512;at+4<b.length;at+=4){if(b[at]!==16||b[at+1]!==64||b[at+2]!==58||b[at+3]!==0)continue;
  try{const tiles=decompressLZ(b,at,14912);if(tiles.length!==14912||tiles.some(n=>n<112||n>=144))continue;const palette=at-64;if(Array.from({length:32},(_,i)=>r.u16(palette+i*2)).some(n=>n&32768))continue;graphics.push({tiles:at,palette});}catch{}
 }
 const refs=new Map([entries,...graphics.flatMap(g=>[g.tiles,g.palette])].map(at=>[at,[]]));for(let at=512;at+4<b.length;at+=4){const ptr=r.ptr(at);if(refs.has(ptr))refs.get(ptr).push(at);}
 const candidates=[];
 for(const g of graphics){const tileRefs=refs.get(g.tiles),paletteRefs=refs.get(g.palette);if(!tileRefs.length||!paletteRefs.length||tileRefs.length>32||paletteRefs.length>32||!refs.get(entries).length)continue;
  const mapRefs=new Map();for(const ref of tileRefs)for(let at=Math.max(512,ref-0x800);at<Math.min(b.length-4,ref+0x800);at+=4){const ptr=r.ptr(at);if(ptr>=512&&b[ptr]===16&&b[ptr+1]===0&&b[ptr+2]===16&&b[ptr+3]===0){if(!mapRefs.has(ptr))mapRefs.set(ptr,[]);mapRefs.get(ptr).push(at);}}
  for(const tilemap of mapRefs.keys())try{const raw=decompressLZ(b,tilemap,4096);if(raw.length===4096&&raw.every(n=>n<233)&&new Set(raw).size>=20)candidates.push({engine:'emerald',label:'Detected Emerald world map',...g,tilemap,entries,count});}catch{}
 }
 if(candidates.length===1)result=Object.freeze(candidates[0]);
 cache.set(reader,result);return result;
}
