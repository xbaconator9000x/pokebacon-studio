// Native tileset pointers independently locate metatiles and attributes.
// This optional footer records their count when they are stored separately.
const MAGIC='PBTS0001';
function hashParts(parts){let h=2166136261;for(const a of parts)for(const b of a){h^=b;h=Math.imul(h,16777619)>>>0;}return h;}
export function describeTilesetStorage(header,count,attributeSize,stride,metatiles,attributes){
 const out=new Uint8Array(40);out.set(header.subarray(0,24));out.set([...MAGIC].map(c=>c.charCodeAt(0)),24);const v=new DataView(out.buffer);v.setUint16(32,count,true);out[34]=attributeSize;out[35]=stride;v.setUint32(36,hashParts([metatiles,attributes]),true);return out;
}
export function storedTilesetCount(reader,header,attributeSize,stride){
 if(!reader.valid(header,40)||![...MAGIC].every((c,i)=>reader.u8(header+24+i)===c.charCodeAt(0)))return null;
 const count=reader.u16(header+32);if(count<1||count>1024||reader.u8(header+34)!==attributeSize||reader.u8(header+35)!==stride)return null;
 const meta=reader.ptr(header+12),attrs=reader.ptr(header+(reader.engine==='frlg'?20:16));
 if(meta<512||attrs<512||!reader.valid(meta,count*stride)||!reader.valid(attrs,count*attributeSize))return null;
 return hashParts([reader.bytes.subarray(meta,meta+count*stride),reader.bytes.subarray(attrs,attrs+count*attributeSize)])===reader.u32(header+36)?count:null;
}
