import{crc32}from'./zip.js';
// UPS1 XOR patches. Input, output and patch CRCs are mandatory; ROMs are copied.
export function applyUPS(source,patch){
 source=source instanceof Uint8Array?source:new Uint8Array(source);patch=patch instanceof Uint8Array?patch:new Uint8Array(patch);
 if(patch.length<18||String.fromCharCode(...patch.subarray(0,4))!=='UPS1')throw Error('Choose a valid UPS patch.');
 const v=new DataView(patch.buffer,patch.byteOffset,patch.byteLength),end=patch.length-12;if(crc32(patch.subarray(0,-4))!==v.getUint32(patch.length-4,true))throw Error('The UPS patch checksum does not match.');
 let at=4;const number=()=>{let value=0,shift=1;for(let i=0;i<8;i++){if(at>=end)throw Error('The UPS patch is truncated.');const b=patch[at++];value+=(b&127)*shift;if(!Number.isSafeInteger(value))throw Error('The UPS patch offset is too large.');if(b&128)return value;shift*=128;value+=shift;}throw Error('The UPS patch offset is too large.');};
 const inputSize=number(),outputSize=number(),inputCRC=v.getUint32(end,true),outputCRC=v.getUint32(end+4,true),sourceCRC=crc32(source),forward=source.length===inputSize&&sourceCRC===inputCRC,reverse=!forward&&source.length===outputSize&&sourceCRC===outputCRC;
 if(!forward&&!reverse)throw Error('This UPS patch needs a different original ROM. Its size or checksum does not match.');
 const size=forward?outputSize:inputSize;if(size<0x200||size>32*1024*1024||inputSize>32*1024*1024||outputSize>32*1024*1024)throw Error('The patched GBA ROM must be between 512 bytes and 32 MB.');
 const bytes=new Uint8Array(size);bytes.set(source.subarray(0,size));let offset=0;const max=Math.max(inputSize,outputSize);
 while(at<end){offset+=number();if(offset>max)throw Error('The UPS patch writes outside the ROM.');let ended=false;while(at<end){const b=patch[at++];if(!b){offset++;ended=true;break;}if(offset>=max)throw Error('The UPS patch writes outside the ROM.');if(offset<size)bytes[offset]=(source[offset]||0)^b;offset++;}if(!ended)throw Error('The UPS patch has an unterminated XOR record.');}
 if(crc32(bytes)!==(forward?outputCRC:inputCRC))throw Error('The patched ROM checksum does not match.');return{bytes,reverse};
}
