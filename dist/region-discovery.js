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

// Read the live FireRed Town Map literals after checking the native loader.
// This also follows pages relocated by an earlier Studio export.
export function discoverFireRedRegion(reader){
 const b=reader.bytes;if(!b||b.length<0xc3d40)return null;
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const anchors=[[0xc0330,'002336f0a5fa4be0'],[0xc035c,'263123f10bfc35e0'],[0xc0370,'0968034a16e00000'],[0xc0388,'0968034a0ae00000'],[0xc03a4,'891823f1e7fb11e0'],[0xc3d38,'08500003e4990302']];
 for(const[at,hex]of anchors)if(Array.from(b.slice(at-8,at),n=>n.toString(16).padStart(2,'0')).join('')!==hex)return null;
 const ptr=at=>{const n=v.getUint32(at,true)-0x08000000;return n>=512&&n<b.length?n:null;};
 const p={label:'Verified FireRed Town Map',palette:ptr(0xc02ec),tiles:ptr(0xc0330),pages:[0xc035c,0xc0370,0xc0388,0xc03a4].map(ptr),names:ptr(0xc0c94),xy:ptr(0xc3d3c),wh:ptr(0xc3d38),count:109};
 if([p.palette,p.tiles,p.names,p.xy,p.wh,...p.pages].some(n=>n===null)||ptr(0xc2d10)!==p.palette||ptr(0xc4db8)!==p.names)return null;
 return p;
}
