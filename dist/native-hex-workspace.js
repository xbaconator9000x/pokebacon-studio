// Bounded ROM byte editing. Source arrays are immutable; saved projects keep
// sparse original-byte preconditions, never a second, untracked ROM image.
const LIMIT=32*1024*1024,MAX_EDITS=65536,MAX_BATCH=4096;
const validAt=(at,length)=>Number.isInteger(at)&&at>=0&&at<length;
const store=(project,sourceId,create=false)=>{
 if(typeof sourceId!=='string'||!sourceId||sourceId.length>128)throw Error('Attach a source ROM with a stable identity.');
 if(create){project.hexStudio??={version:1,sources:{}};project.hexStudio.sources??={};project.hexStudio.sources[sourceId]??={patches:[],tables:[],hmaToml:''};}
 const root=project.hexStudio;
 if(!root)return null;
 if(root.version!==1||!root.sources||typeof root.sources!=='object')throw Error('Unsupported saved hex workspace format.');
 return root.sources[sourceId]||null;
};
export function hexState(project,sourceId){return store(project,sourceId);}
export function stagedHexCount(project,sourceId){return store(project,sourceId)?.patches?.length||0;}
export function parseROMOffset(text,length){
 let s=String(text??'').trim();
 if(/^0x[0-9a-f]+$/i.test(s))s='0x'+s.slice(2);
 else if(/^[0-9a-f]+h$/i.test(s))s='0x'+s.slice(0,-1);
 else if(!/^[0-9]+$/.test(s))throw Error('Use a decimal offset or 0x-prefixed hex offset.');
 const value=Number(s);
 if(!validAt(value,length))throw Error('The ROM offset is out of range.');
 return value;
}
export function hexInput(text){
 const input=String(text||'').trim();
 if(!input)throw Error('Enter at least one hexadecimal byte.');
 const compact=input.replace(/[\s,;:_-]+/g,'').replace(/0x/gi,'');
 if(!/^[0-9a-f]+$/i.test(compact)||compact.length%2)throw Error('Hex bytes must contain pairs of 0–9 / A–F digits.');
 if(compact.length>MAX_BATCH*2)throw Error('Edit at most 4,096 contiguous bytes per action.');
 return Uint8Array.from(compact.match(/../g).map(x=>parseInt(x,16)));
}
export function formatHex(bytes){return Array.from(bytes,x=>x.toString(16).toUpperCase().padStart(2,'0')).join(' ');}
function checked(state,source){
 if(!(source instanceof Uint8Array)||source.length<512||source.length>LIMIT)throw Error('Open the matching unmodified GBA source ROM.');
 const rows=state?.patches||[],prev=new Set();
 if(!Array.isArray(rows)||rows.length>MAX_EDITS)throw Error('Invalid or excessive saved ROM edits.');
 for(const row of rows){
  if(!validAt(row.at,source.length)||!Number.isInteger(row.before)||row.before<0||row.before>255||!Number.isInteger(row.after)||row.after<0||row.after>255||prev.has(row.at)||source[row.at]!==row.before)throw Error('Saved hex patch no longer matches original ROM at 0x'+Number(row.at||0).toString(16)+'. Open the matching original ROM.');
  prev.add(row.at);
 }
 return rows;
}
export function stagedROMByte(project,sourceId,source,at){
 if(!validAt(at,source.length))throw Error('ROM byte offset is outside the source.');
 const row=store(project,sourceId)?.patches?.find(row=>row.at===at);
 return row?row.after:source[at];
}
export function stageROMHex(project,sourceId,source,at,bytes){
 if(!validAt(at,source.length)||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_BATCH||at+bytes.length>source.length)throw Error('Choose 1–4,096 bytes within the original ROM.');
 const previous=store(project,sourceId),old=checked(previous,source),byAt=new Map(old.map(row=>[row.at,{...row}]));
 if(byAt.size+bytes.length>MAX_EDITS)throw Error('The project is at the 65,536 edited-byte safety limit. Export a ROM copy before making more changes.');
 let changed=0;
 for(let i=0;i<bytes.length;i++){const where=at+i,before=source[where],after=bytes[i],existing=byAt.get(where);if(existing?.after!==after&&(!existing||existing.after!==after))changed++;
  if(after===before)byAt.delete(where);else byAt.set(where,{at:where,before,after});
 }
 // Commit the complete valid draft only after every range check; undo/redo
 // uses the same outer project history as other studio edits.
 if(!changed)return {changed:0,total:old.length};
 const destination=store(project,sourceId,true);destination.patches=[...byAt.values()].sort((a,b)=>a.at-b.at);
 return{changed,total:destination.patches.length};
}
export function hexRows(project,sourceId,source,at,{rows=16}={}){
 if(!validAt(at,source.length))throw Error('ROM hex viewport is out of bounds.');
 const from=Math.floor(at/16)*16,result=[],edits=new Map(checked(store(project,sourceId),source).map(p=>[p.at,p]));
 for(let r=0;r<rows&&from+r*16<source.length;r++){
  const address=from+r*16,columns=[];
  for(let i=0;i<16&&address+i<source.length;i++){
   const pos=address+i,p=edits.get(pos),byte=p?p.after:source[pos];
   columns.push({at:pos,byte,original:source[pos],edited:!!p,ascii:byte>=32&&byte<=126?String.fromCharCode(byte):'.'});
  }
  result.push({address,columns});
 }
 return result;
}
export function findROMHex(project,sourceId,source,needle,{from=0,limit=32}={}){
 if(!(needle instanceof Uint8Array)||!needle.length||needle.length>256)throw Error('Search for 1–256 bytes.');
 if(!Number.isInteger(from)||from<0||from>=source.length)throw Error('Choose a valid starting offset.');
 const patches=new Map(checked(store(project,sourceId),source).map(p=>[p.at,p.after])),results=[];
 outer:for(let at=from;at+needle.length<=source.length;at++){
  for(let i=0;i<needle.length;i++)if((patches.get(at+i)??source[at+i])!==needle[i])continue outer;
  results.push(at);if(results.length>=limit)break;
 }
 return results;
}
export function hexDiffSummary(project,sourceId,source,{limit=100}={}){
 const patches=checked(store(project,sourceId),source),spans=[];
 for(const patch of patches){const last=spans.at(-1);
  if(last&&last.at+last.before.length===patch.at){last.before.push(patch.before);last.after.push(patch.after);}
  else spans.push({at:patch.at,before:[patch.before],after:[patch.after]});
 }
 return {changedBytes:patches.length,spans:spans.slice(0,limit),spanCount:spans.length};
}
// Preflight *all* writes against source and compiler output before mutating.
// A map, graphics, script or game-data edit with overlapping ownership aborts
// the whole hex batch, even when the desired end value is coincidentally equal.
export function installROMHexEdits(project,sourceId,source,output){
 const rows=checked(store(project,sourceId),source);
 if(!rows.length)return {bytes:0,spans:0};
 if(!output?.bytes||typeof output.write!=='function')throw Error('Use the native ROM writer to apply hex edits.');
 const overlaps=output.writes||[];
 for(const row of rows){
  if(row.at>=output.bytes.length)throw Error('The compiled ROM no longer contains source address 0x'+row.at.toString(16)+'.');
  if(overlaps.some(w=>row.at>=w.address&&row.at<w.address+w.length)||output.bytes[row.at]!==row.before)
   throw Error('Native editor ownership conflict at 0x'+row.at.toString(16).toUpperCase()+': another editor or allocation writes here. Reconcile the edit before export.');
 }
 let spans=0;
 for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j].at===rows[j-1].at+1)j++;
  output.write(rows[i].at,Uint8Array.from(rows.slice(i,j).map(x=>x.after)));spans++;i=j;
 }
 return{bytes:rows.length,spans};
}
