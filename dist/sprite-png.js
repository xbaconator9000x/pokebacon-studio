import{crc32}from'./zip.js';
// Small lossless PNGs for copied native sprites. Stored DEFLATE blocks avoid
// browser-only canvas dependencies during generation and project validation.
export function indexedSpritePNG(sprite){
 const {width:w,height:h,indices,colours}=sprite;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>64||h>64||indices.length!==w*h)throw Error('Invalid native sprite dimensions.');
 const raw=new Uint8Array(h*(1+w*4));for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=indices[y*w+x],c=parseInt(colours[n].slice(1),16),i=y*(1+w*4)+1+x*4;raw.set([c>>>16,c>>>8&255,c&255,n?255:0],i);}
 const compressed=new Uint8Array(raw.length+11),dv=new DataView(compressed.buffer);compressed.set([0x78,1,1]);dv.setUint16(3,raw.length,true);dv.setUint16(5,65535-raw.length,true);compressed.set(raw,7);let a=1,b=0;for(const v of raw){a=(a+v)%65521;b=(b+a)%65521;}dv.setUint32(compressed.length-4,(b<<16|a)>>>0);
 const chunk=(name,data)=>{const out=new Uint8Array(data.length+12),v=new DataView(out.buffer);v.setUint32(0,data.length);out.set([...name].map(c=>c.charCodeAt(0)),4);out.set(data,8);v.setUint32(out.length-4,crc32(out.subarray(4,out.length-4)));return out;},header=new Uint8Array(13),hv=new DataView(header.buffer);hv.setUint32(0,w);hv.setUint32(4,h);header.set([8,6,0,0,0],8);
 const chunks=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())],png=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){png.set(c,at);at+=c.length;}
 let binary='';for(const n of png)binary+=String.fromCharCode(n);return'data:image/png;base64,'+btoa(binary);
}
