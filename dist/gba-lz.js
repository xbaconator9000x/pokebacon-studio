// Native GBA type-0x10 LZ77. Input and output bytes stay deterministic.
export function compressGbaLZ(source){
 const input=new Uint8Array(source),out=[16,input.length&255,input.length>>>8&255,input.length>>>16&255],history=new Map();if(!input.length||input.length>0xffffff)throw Error('Invalid GBA graphics length.');
 const key=i=>input[i]|input[i+1]<<8|input[i+2]<<16,remember=i=>{if(i+2>=input.length)return;const k=key(i);if(!history.has(k))history.set(k,[]);const h=history.get(k);h.push(i);while(h.length>64||h[0]<i-4096)h.shift();};
 for(let at=0;at<input.length;){const flagsAt=out.length;out.push(0);for(let bit=7;bit>=0&&at<input.length;bit--){let length=0,distance=0;const candidates=at+2<input.length?history.get(key(at))||[]:[];for(let j=candidates.length-1;j>=0;j--){const pos=candidates[j],d=at-pos;if(d>4096)break;let n=0;while(n<18&&at+n<input.length&&input[pos+n]===input[at+n])n++;if(n>length){length=n;distance=d;if(n===18)break;}}
  if(length>=3){out[flagsAt]|=1<<bit;const d=distance-1;out.push((length-3)<<4|d>>>8,d&255);for(let i=0;i<length;i++)remember(at+i);at+=length;}else{out.push(input[at]);remember(at);at++;}
 }}return Uint8Array.from(out);
}
