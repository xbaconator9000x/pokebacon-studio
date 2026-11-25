// Verified Thumb immediate count references for FireRed / LeafGreen / Emerald.
// Opcode matching is structural evidence, NEVER proof that code is reachable,
// table-specific or the sole bound. Explicit ROM review remains mandatory.
const FAMILY_CODE={BPR:'frlg',BPG:'frlg',BPE:'emerald'};
const KINDS={'thumb-cmp':0x2800,'thumb-movs':0x2000};
export function gbaCountEngine(source){
 if(!(source instanceof Uint8Array)||source.length<0x200)throw Error('Open the original GBA ROM.');
 const code=String.fromCharCode(...source.subarray(0xac,0xb0));
 return {code,family:/^[A-Z0-9]{4}$/.test(code)?FAMILY_CODE[code.slice(0,3)]||null:null};
}
const validSite=(source,at)=>Number.isInteger(at)&&at>=0x200&&at%2===0&&at+2<=source.length;
const word=(source,at)=>source[at]|source[at+1]<<8;
function readSite(source,site,oldCount,newCount){
 if(!site||!validSite(source,site.at)||!Object.hasOwn(KINDS,site.kind))
  throw Error('Engine count site requires an aligned source Thumb instruction and a supported cmp/movs kind.');
 if(!Number.isInteger(oldCount)||oldCount<0||oldCount>255||!Number.isInteger(newCount)||newCount<0||newCount>255)
  throw Error('Thumb imm8 bounds only support source/new row counts from 0 to 255.');
 const op=word(source,site.at),type=KINDS[site.kind];
 if((op&0xf800)!==type||(op&0xff)!==oldCount)
  throw Error('The selected Thumb opcode does not compare/load the original table count.');
 if(site.originalWord!==undefined&&site.originalWord!==op)
  throw Error('The saved engine count opcode differs from the original ROM.');
 return {at:site.at,kind:site.kind,originalWord:op,newWord:(op&0xff00)|newCount,register:(op>>>8)&7};
}
export function verifyEngineCountSites(source,oldCount,newCount,sites,{code,family}={}){
 if(!Array.isArray(sites)||sites.length>16)throw Error('Review at most 16 distinct source Thumb count dependencies.');
 const game=gbaCountEngine(source);
 if(sites.length&&(!game.family||code!==undefined&&code!==game.code||family!==undefined&&family!==game.family))
  throw Error('Engine instruction patching requires a matching original FireRed/LeafGreen/Emerald source game code.');
 const used=new Set(),entries=[];
 for(const item of sites){
  const found=readSite(source,item,oldCount,newCount);
  if(used.has(found.at))throw Error('The engine count-site list repeats a Thumb instruction.');
  used.add(found.at);entries.push(found);
 }
 return {engine:game.family,code:game.code,sites:entries};
}
/** Read-only, bounded candidate discovery. Matching a Thumb opcode/imm8 is
 * not confirmation of its engine semantics. Never auto-apply findings. */
export function scanThumbCountCandidates(source,count,{from=0x200,maxScan=262144,limit=24}={}){
 const game=gbaCountEngine(source);
 if(!game.family)throw Error('Thumb code search is currently restricted to recognized FRLG/Emerald game codes.');
 if(!Number.isInteger(count)||count<0||count>255)throw Error('Thumb imm8 count must be within 0–255.');
 if(!Number.isInteger(from)||from<0x200||from%2||from>=source.length||
    !Number.isInteger(maxScan)||maxScan<2||maxScan>1048576||
    !Number.isInteger(limit)||limit<1||limit>64)
  throw Error('Choose a 2-byte-aligned code search window, at most 1 MiB.');
 const max=Math.min(source.length-1,from+maxScan),hits=[];
 let at=from;
 for(;at+1<max;at+=2){
  const op=word(source,at);
  if((op&0xff)!==count)continue;
  const kind=(op&0xf800)===0x2800?'thumb-cmp':(op&0xf800)===0x2000?'thumb-movs':null;
  if(kind){hits.push({at,kind,register:(op>>>8)&7,originalWord:op});if(hits.length===limit){at+=2;break;}}
 }
 return {engine:game.family,code:game.code,candidates:hits,nextFrom:at+1<source.length?at:null,scanned:at-from,limitation:'Matching opcodes are candidates, not verified table-specific runtime dependencies.'};
}
