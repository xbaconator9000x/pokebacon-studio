/* Smol/tANS decoder, translated from the primary pokeemerald-expansion format.
 * References: rh-hideout/pokeemerald-expansion include/decompress.h and src/decompress.c.
 * Bounds checked; inputs are never mutated. Also accepts standard GBA LZ77. */
const ok=(b,a,n)=>Number.isInteger(a)&&a>=0&&a+n<=b.length;
const w=(b,a)=>{if(!ok(b,a,4))throw Error('Truncated compressed graphics.');return(b[a]|b[a+1]<<8|b[a+2]<<16|b[a+3]<<24)>>>0;};
export function smolInfo(bytes,address,maxSize=65532){
 const a=w(bytes,address),mode=a&15;
 if(bytes[address]===0x10){const size=a>>>8;if(size<1||size>maxSize)throw Error('Unsupported graphics size.');return{mode:0,size};}
 if(mode<1||mode>6)throw Error('Unsupported graphics compression.');
 const b=w(bytes,address+4),size=(a>>>4&16383)*4,symSize=a>>>18,loSize=b>>>19,bitstreamSize=b>>>6&8191,initialState=b&63;
 if(!size||size>maxSize||!symSize||!loSize||symSize>size/2||loSize>size*2||bitstreamSize>size*2)throw Error('Invalid Smol graphics header.');
 return{mode,size,symSize,loSize,bitstreamSize,initialState};
}
function decodeLZ(bytes,address,size){const out=new Uint8Array(size);let s=address+4,d=0;while(d<size){if(!ok(bytes,s,1))throw Error('Truncated LZ flags.');const flags=bytes[s++];for(let bit=7;bit>=0&&d<size;bit--){if(flags&(1<<bit)){if(!ok(bytes,s,2))throw Error('Truncated LZ reference.');const a=bytes[s++],b=bytes[s++],n=(a>>>4)+3,off=((a&15)<<8|b)+1;if(off>d)throw Error('Invalid LZ reference.');for(let i=0;i<n&&d<size;i++,d++)out[d]=out[d-off];}else{if(!ok(bytes,s,1))throw Error('Truncated LZ literal.');out[d++]=bytes[s++];}}}return out;}
function table(bytes,at){const freq=new Uint16Array(16);let last=0;for(let i=0;i<3;i++){const v=w(bytes,at+i*4);for(let j=0;j<5;j++)freq[i*5+j]=v>>>(j*6)&63;last|=(v>>>30)<<(i*2);}freq[15]=last;const t=[];for(let symbol=0;symbol<16;symbol++){const f=freq[symbol];for(let y=f;y<f*2;y++){const k=6-Math.floor(Math.log2(y));if(k<0||k>6)throw Error('Invalid tANS frequency.');t.push({symbol,k,y:(y<<k)-64});}}if(t.length!==64)throw Error('Invalid tANS table.');return t;}
export function decompressSmol(bytes,address,maxSize=65532){
 const h=smolInfo(bytes,address,maxSize);if(h.mode===0)return decodeLZ(bytes,address,h.size);
 const loEncoded=[4,5,6].includes(h.mode),symEncoded=[2,3,5,6].includes(h.mode),delta=[3,6].includes(h.mode);let p=address+8,loTable,symTable;
 if(loEncoded){loTable=table(bytes,p);p+=12;}if(symEncoded){symTable=table(bytes,p);p+=12;}
 const bitStart=p,bitEnd=p+h.bitstreamSize*4;if((loEncoded||symEncoded)&&(!h.bitstreamSize||!ok(bytes,p,h.bitstreamSize*4)))throw Error('Truncated tANS stream.');
 let bit=0,state=h.initialState;const readBits=k=>{let n=0;for(let i=0;i<k;i++){const a=bitStart+(bit>>>3);if(a>=bitEnd)throw Error('Truncated tANS bits.');n|=((bytes[a]>>>(bit&7))&1)<<i;bit++;}return n;};
 const decodeNibbles=(t,n,deltaMode=false)=>{const out=new Uint8Array(n);let prev=0;for(let i=0;i<n;i++){const a=t[state];if(!a)throw Error('Invalid tANS state.');let v=a.symbol;if(deltaMode){prev=(prev+v)&15;v=prev;}out[i]=v;if(!(i===n-1&&(t===symTable||!symEncoded)))state=a.y+readBits(a.k);}return out;};
 let lo,syms;
 if(loEncoded){const nib=decodeNibbles(loTable,h.loSize*2);lo=new Uint8Array(h.loSize);for(let i=0;i<lo.length;i++)lo[i]=nib[i*2]|nib[i*2+1]<<4;}
 if(symEncoded){const nib=decodeNibbles(symTable,h.symSize*4,delta);syms=new Uint16Array(h.symSize);for(let i=0;i<syms.length;i++)syms[i]=nib[i*4]|nib[i*4+1]<<4|nib[i*4+2]<<8|nib[i*4+3]<<12;}
 p=(loEncoded||symEncoded)?bitEnd:address+8;
 if(!symEncoded){if(!ok(bytes,p,h.symSize*2))throw Error('Truncated Smol symbols.');syms=new Uint16Array(h.symSize);for(let i=0;i<syms.length;i++)syms[i]=bytes[p+i*2]|bytes[p+i*2+1]<<8;p+=h.symSize*2;}
 if(!loEncoded){if(!ok(bytes,p,h.loSize))throw Error('Truncated Smol instructions.');lo=bytes.subarray(p,p+h.loSize);}
 const out=new Uint16Array(h.size/2);let si=0,li=0,d=0;const value=()=>{if(li>=lo.length)throw Error('Truncated Smol instruction.');const x=lo[li++];if(!(x&128))return x;if(li>=lo.length)throw Error('Truncated Smol length.');return(x&127)|(lo[li++]<<7);};
 while(li<lo.length){const n=value(),off=value();if(n){if(si>=syms.length||d+n+1>out.length)throw Error('Invalid Smol run.');const symbol=syms[si++];out[d++]=symbol;if(off<1||off>d)throw Error('Invalid Smol distance.');for(let i=0;i<n;i++,d++)out[d]=out[d-off];}else{if(!off||si+off>syms.length||d+off>out.length)throw Error('Invalid Smol literals.');out.set(syms.subarray(si,si+off),d);si+=off;d+=off;}}
 if(d!==out.length||si!==syms.length)throw Error('Smol output length disagrees.');const raw=new Uint8Array(h.size);for(let i=0;i<out.length;i++){raw[i*2]=out[i]&255;raw[i*2+1]=out[i]>>>8;}return raw;
}
