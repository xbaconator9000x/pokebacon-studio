/**
 * Standards-compliant SHA-256 for Android WebViews without WebCrypto.
 * The old WebView fallback accidentally carried incorrect round constants.
 * Preserve that exact historical algorithm separately for source-ID audits;
 * never silently re-key an existing project using a legacy digest.
 */
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const LEGACY_K=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,2643470780,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757379,1396182291,1695183700,198958881,2117941368,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);
const INIT=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const rotate=(x,n)=>(x>>>n)|(x<<(32-n));
function view(input){
 if(input instanceof Uint8Array)return input;
 if(input instanceof ArrayBuffer)return new Uint8Array(input);
 if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
 throw Error('SHA-256 requires an ArrayBuffer or typed byte array.');
}
async function digest(input,constants){
 const src=view(input),length=src.byteLength,bitLength=length*8;
 if(!Number.isSafeInteger(bitLength))throw Error('SHA-256 input is too large.');
 const paddedLength=Math.ceil((length+9)/64)*64,padded=new Uint8Array(paddedLength);
 padded.set(src);padded[length]=0x80;
 const lengthWords=new DataView(padded.buffer);
 lengthWords.setUint32(paddedLength-8,Math.floor(bitLength/0x100000000),false);
 lengthWords.setUint32(paddedLength-4,bitLength>>>0,false);
 const words=new Uint32Array(64),hash=INIT.slice();
 for(let offset=0;offset<paddedLength;offset+=64){
  for(let i=0;i<16;i++){
   const at=offset+i*4;
   words[i]=(padded[at]<<24|padded[at+1]<<16|padded[at+2]<<8|padded[at+3])>>>0;
  }
  for(let i=16;i<64;i++){
   const a=words[i-15],b=words[i-2];
   const sigma0=rotate(a,7)^rotate(a,18)^(a>>>3);
   const sigma1=rotate(b,17)^rotate(b,19)^(b>>>10);
   words[i]=(words[i-16]+sigma0+words[i-7]+sigma1)>>>0;
  }
  let[a,b,c,d,e,f,g,h]=hash;
  for(let i=0;i<64;i++){
   const big1=rotate(e,6)^rotate(e,11)^rotate(e,25);
   const choice=(e&f)^(~e&g);
   const t1=(h+big1+choice+constants[i]+words[i])>>>0;
   const big0=rotate(a,2)^rotate(a,13)^rotate(a,22);
   const majority=(a&b)^(a&c)^(b&c);
   const t2=(big0+majority)>>>0;
   h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  const work=[a,b,c,d,e,f,g,h];
  for(let i=0;i<8;i++)hash[i]=(hash[i]+work[i])>>>0;
  // Yield during large GBA ROM hashes so older Android WebViews remain responsive.
  if(offset&&offset%262144===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return hash.map(n=>n.toString(16).padStart(8,'0')).join('');
}
export async function sha256(input){return digest(input,K);}
export async function legacyPokebaconSha256(input){return digest(input,LEGACY_K);}
