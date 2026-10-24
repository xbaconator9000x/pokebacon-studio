// MP2K sequence and instrument format, based on primary pret/pokefirered sources.
// All discovery/extraction is bounded and read-only. Unsupported extensions fail closed.
export const BASE=0x08000000;
export const WAIT=[...Array.from({length:25},(_,i)=>i),28,30,32,36,40,42,44,48,52,54,56,60,64,66,68,72,76,78,80,84,88,90,92,96];
export const PRIMARY_URLS=[
 'https://github.com/pret/pokefirered/blob/master/sound/MPlayDef.s',
 'https://github.com/pret/pokefirered/blob/master/src/m4a_1.s',
 'https://github.com/pret/pokefirered/blob/master/src/m4a.c',
 'https://github.com/pret/pokefirered/blob/master/src/m4a_tables.c',
 'https://github.com/pret/pokefirered/blob/master/asm/macros/music_voice.inc',
 'https://github.com/pret/pokefirered/blob/master/include/gba/m4a_internal.h',
 'https://github.com/ipatix/agbplay/blob/master/src/agbplay/MP2KScanner.cpp',
 'https://github.com/ipatix/agbplay/blob/master/src/agbplay/MP2KChnPCM.cpp',
];
export class Rom {
 constructor(bytes){this.bytes=bytes;this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
 valid(at,n=1){return Number.isInteger(at)&&at>=0&&Number.isInteger(n)&&n>=0&&at+n<=this.bytes.length;}
 require(at,n=1){if(!this.valid(at,n))throw Error(`Out of bounds: 0x${at.toString(16)} + ${n}`);}
 u8(at){this.require(at);return this.bytes[at];}
 u16(at){this.require(at,2);return this.view.getUint16(at,true);}
 u32(at){this.require(at,4);return this.view.getUint32(at,true);}
 ptr(at,n=1){const p=this.u32(at)-BASE;this.require(p,n);return p;}
}

export function isSongEntry(r,at){
 if(!r.valid(at,8))return false;
 // Cheap rejection keeps a full-ROM scan from throwing millions of errors.
 const candidate=r.u32(at)-BASE;if(!r.valid(candidate,8))return false;
 if(r.u8(at+5)||r.u8(at+7)||r.u8(at+4)!==r.u8(at+6))return false;
 try {
  const h=candidate;
  const n=r.u8(h);if(n>16||r.u8(h+1)!==0)return false;
  // Some real zero-track headers have nonzero reverb: do not reject those.
  if(!n&&!r.u32(h))return true;
  r.ptr(h+4);r.require(h,8+4*n);
  for(let i=0;i<n;i++)r.ptr(h+8+i*4);
  return true;
 } catch{return false;}
}

export function scanRom(r){
 const references=new Map();
 for(let at=0x200;at+4<=r.bytes.length;at+=4){const p=r.u32(at)-BASE;if(r.valid(p)&&(p&3)===0){const rows=references.get(p)||[];rows.push(at);references.set(p,rows);}}
 const found=[];
 for(let at=0x200;at+32<=r.bytes.length;at+=4){
  if(!isSongEntry(r,at))continue;
  let count=1;while(count<65534&&isSongEntry(r,at+count*8))count++;
  if(count<4)continue;
  const refs=references.get(at)||[];
  if(refs.length)found.push({table:at,count,references:refs,precedingLiterals:refs.map(a=>({at:a-4,value:r.u32(a-4)}))});
  at+=(count-1)*8;
 }
 return found;
}

/** Trace BOTH outcomes of conditional/repeat branches; retain call-stack,
 * running-status, program and raw note-key state. No music is executed.
 * Byte spans and pointers are exact observed decoder fields, not a byte scan.
 * Defaults program/key to0 conservatively; the native initial tone is PSG1.
 * This may include unused program0 dependencies if a track never emits VOICE.
 */
export function traceSong(r,table,id,{maxStates=500000}={}){
 const entry=table+id*8,h=r.ptr(entry,8),n=r.u8(h),bank=r.ptr(h+4);
 if(n>16||r.u8(h+1)!==0)throw Error('Unsupported song header');
 const pointers=new Map(),spans=new Map(),pairs=new Set(),commands={},xc={},seen=new Set(),queue=[];
 const pointer=(offset,kind)=>{const target=r.ptr(offset);pointers.set(offset,{offset,target,kind});return target;};
 pointer(entry,'song-header');pointer(h+4,'voice-bank');
 for(let i=0;i<n;i++)queue.push({pc:pointer(h+8+i*4,'track'),last:0,program:0,key:0,stack:[]});
 while(queue.length){
  let {pc,last,program,key,stack}=queue.pop();
  for(;;){
   const state=[pc,last,program,key,...stack].join(':');if(seen.has(state))break;seen.add(state);
   if(seen.size>maxStates)throw Error(`State budget exceeded (${maxStates})`);
   const start=pc;let cmd=r.u8(pc),explicit=cmd>=0x80;
   if(explicit){pc++;if(cmd>=0xbd)last=cmd;}else{cmd=last;if(cmd<0x80)throw Error('Uninitialized running status');}
   commands[cmd]=(commands[cmd]||0)+1;
   const span=()=>spans.set(`${start}:${pc}:${cmd}`,{start,end:pc,cmd,explicit});
   if(cmd>=0xcf){
    if(r.u8(pc)<0x80){key=r.u8(pc++);if(r.u8(pc)<0x80){pc++;if(r.u8(pc)<0x80)pc++;}}
    pairs.add(`${program}:${key}`);span();continue;
   }
   if(cmd<=0xb0){span();continue;}
   if(cmd===0xb1){span();break;}
   if(cmd===0xb2){const to=pointer(pc,'goto');pc+=4;span();pc=to;continue;}
   if(cmd===0xb3){if(stack.length>=3)throw Error('Pattern stack exceeds3');const to=pointer(pc,'pattern');pc+=4;span();stack=[...stack,pc];pc=to;continue;}
   if(cmd===0xb4){span();if(stack.length){pc=stack.at(-1);stack=stack.slice(0,-1);}continue;}
   if(cmd===0xb5){const count=r.u8(pc++),to=pointer(pc,'repeat');pc+=4;span();if(!count){pc=to;continue;}queue.push({pc:to,last,program,key,stack});continue;}
   if(cmd===0xb9){const op=r.u8(pc);r.require(pc,3);pc+=3;if(op>=6&&op<=17){const to=pointer(pc,'memory-branch');pc+=4;queue.push({pc:to,last,program,key,stack});}else if(op>17)throw Error('Unknown MEMACC operation');span();continue;}
   if(cmd===0xbd){program=r.u8(pc++);if(program>127)throw Error('Program exceeds127');span();continue;}
   if([0xba,0xbb,0xbc,0xbe,0xbf,0xc0,0xc1,0xc2,0xc3,0xc4,0xc5,0xc8].includes(cmd)){r.require(pc);pc++;span();continue;}
   if(cmd===0xcc){r.require(pc,2);pc+=2;span();throw Error('PORT rejected: hardware-register write');}
   if(cmd===0xcd){
    const sub=r.u8(pc++);xc[sub]=(xc[sub]||0)+1;
    if(sub===0||sub===3){span();break;}
    const size=sub===1||sub===13?4:sub===12?2:[2,4,5,6,7,8,9,10,11].includes(sub)?1:-1;
    if(size<0)throw Error(`Unknown XCMD ${sub}`);r.require(pc,size);if(sub===1)pointer(pc,'xwave');pc+=size;span();continue;
   }
   if(cmd===0xce){if(r.u8(pc)<0x80)pc++;span();continue;}
   throw Error(`Unknown command0x${cmd.toString(16)}`);
  }
 }
 return {id,entry,header:h,trackCount:n,bank,player:r.u16(entry+4),states:seen.size,commands,xc,usedPairs:[...pairs].map(s=>{const[program,key]=s.split(':').map(Number);return{program,key};}),pointers:[...pointers.values()],spans:[...spans.values()]};
}

/** Resolve only actually-used (program,raw key) instruments. Returned bank
 * rows retain their original indices for sparse destination bank allocation.
 * This does NOT perform packing or relocation and has not been playtested.
 */
export function collectDependencies(r,song,{maxSampleBytes=8*1024*1024}={}){
 const rows=new Map(),samples=new Map(),waves=new Map(),maps=new Map(),pointers=new Map();
 function ptr(at,kind){const target=r.ptr(at);pointers.set(at,{offset:at,target,kind});return target;}
 function tone(bank,index,key,depth=0){
  const at=bank+index*12;r.require(at,12);const type=r.u8(at);
  rows.set(at,{start:at,length:12,bank,index,type});
  if(type&0xc0){
   if(depth)throw Error(`Nested split/drum row0x${at.toString(16)}`);
   const sub=ptr(at+4,'subbank');let child=key;
   if(type&0x40){const map=ptr(at+8,'keymap');r.require(map,128);maps.set(map,{start:map,length:128});child=r.u8(map+key);}
   tone(sub,child,key,depth+1);return;
  }
  const hardware=type&7;
  if(hardware===0){
   const sample=ptr(at+4,'sample');r.require(sample,16);const format=r.u16(sample),size=r.u32(sample+12),loop=r.u32(sample+8);
   if(!size||size>=0x80000000)throw Error('Unsupported zero/negative-size sample extension');
   if(format!==0&&format!==1)throw Error(`Unsupported sample type${format}`);
   const length=16+(format===1?Math.ceil(size/64)*33:size);
   if(length>maxSampleBytes)throw Error('Sample exceeds research budget');r.require(sample,length);
   if(loop>size)throw Error('Sample loop exceeds decoded size');
   samples.set(sample,{start:sample,length,format,decodedSize:size,loopStart:loop,flags:r.u16(sample+2),frequency:r.u32(sample+4)});
  }else if(hardware===3){const wave=ptr(at+4,'psg-wave');r.require(wave,16);waves.set(wave,{start:wave,length:16});}
  else if(![1,2,4].includes(hardware))throw Error(`Unsupported tone hardware${hardware}`);
 }
 for(const pair of song.usedPairs)tone(song.bank,pair.program,pair.key);
 // XWAVE modifies the current tone. Its dependency type needs tone-state
 // tracking not implemented here; fail closed instead of guessing PCM/PSG.
 if(song.pointers.some(p=>p.kind==='xwave'))throw Error('XWAVE closure needs current tone-type tracking');
 if(song.xc[2])throw Error('XTYPE closure needs mutated tone-type tracking');
 return {rows:[...rows.values()],samples:[...samples.values()],waves:[...waves.values()],keymaps:[...maps.values()],pointers:[...pointers.values()]};
}

