// HMA pointer inspection is read-only: an aligned 0x08/0x09 word is a
// candidate reference, never proof that the site is safe to rewrite.
import {hexState} from './native-hex-workspace.js';
import {hmaMetadata,tableDefinitions,validateTable} from './hma-table-workspace.js';
const BASE=0x08000000,MAX=32*1024*1024;
const check=(source,site)=>source instanceof Uint8Array&&Number.isInteger(site)&&site>=0&&site+4<=source.length;
function patches(project,id){return new Map((hexState(project,id)?.patches||[]).map(p=>[p.at,p.after]));}
function u32(source,at,edits){let n=0;for(let i=0;i<4;i++)n|=(edits.get(at+i)??source[at+i])<<(8*i);return n>>>0;}
function ownership(project,id,source){
 const result=new Map();
 for(const table of tableDefinitions(project,id,source))for(let row=0;row<table.count;row++)
  for(const field of table.fields.filter(f=>f.type==='ptr'))result.set(table.address+row*table.stride+field.offset,{kind:'typed-table',name:table.name,row,field:field.name});
 for(const {at,offset} of hmaMetadata(project,id,source).offsetPointers)
  if(!result.has(at))result.set(at,{kind:'hma-offset-pointer',offset});
 return result;
}
export function pointerAt(project,id,source,at){
 if(!check(source,at))throw Error('Choose a complete four-byte source ROM pointer.');
 const raw=u32(source,at,patches(project,id)),offset=raw-BASE;
 const owner=ownership(project,id,source).get(at)||null;
 const adjusted=owner?.kind==='hma-offset-pointer'?offset+owner.offset:offset;
 return{site:at,raw,at:adjusted,valid:Number.isInteger(adjusted)&&adjusted>=512&&adjusted<source.length,kind:owner?.kind||'candidate',owner};
}
export function findROMReferences(project,id,source,target,{limit=128,from=0,scanUnaligned=false}={}){
 if(!(source instanceof Uint8Array)||source.length>MAX||source.length<512)throw Error('Open an original GBA ROM first.');
 if(!Number.isInteger(target)||target<512||target>=source.length)throw Error('Reference target must be an original source-ROM address.');
 if(!Number.isInteger(limit)||limit<1||limit>1024)throw Error('Reference list must fit 1–1,024 entries.');
 if(!Number.isInteger(from)||from<0||from>=source.length)throw Error('Reference scan offset is outside the ROM.');
 const meta=hmaMetadata(project,id,source),known=ownership(project,id,source),edit=patches(project,id),out=[];
 const baseTarget=BASE+target;
 // Exact normal pointers plus explicit HMA offset-pointer locations. The
 // discovery scan never authorizes mutation: only a matching all-users
 // allowlist may approve a subsequent copy-on-write relink.
 const start=scanUnaligned?from:Math.ceil(from/4)*4,step=scanUnaligned?1:4,pattern=Uint8Array.of(baseTarget&255,baseTarget>>>8&255,baseTarget>>>16&255,baseTarget>>>24&255);
 for(let at=start;at+4<=source.length;at+=step){
  // Full-width packed-pointer discovery is fast when using a fixed native
  // little-endian byte pattern; do not parse millions of unrelated words.
  if(scanUnaligned&&(edit.get(at)??source[at])!==pattern[0]||scanUnaligned&&(edit.get(at+1)??source[at+1])!==pattern[1]||scanUnaligned&&(edit.get(at+2)??source[at+2])!==pattern[2]||scanUnaligned&&(edit.get(at+3)??source[at+3])!==pattern[3])continue;
  const value=scanUnaligned?baseTarget:u32(source,at,edit),owner=known.get(at);
  const adjusted=value-BASE+(owner?.kind==='hma-offset-pointer'?owner.offset:0);
  if(adjusted!==target)continue;
  const anchors=meta.anchors.filter(a=>a.at===target).slice(0,5).map(a=>a.name);
  out.push({at,raw:value,kind:owner?.kind||'candidate',owner:owner||null,anchors});
  if(out.length>=limit)break;
 }
 for(const [at,owner]of known)if((scanUnaligned||at%4)&&at>=from&&at+4<=source.length&&!out.some(r=>r.at===at)){
  const value=u32(source,at,edit);
  if(value-BASE+(owner.kind==='hma-offset-pointer'?owner.offset:0)===target){
   out.push({at,raw:value,kind:owner.kind,owner,anchors:meta.anchors.filter(a=>a.at===target).slice(0,5).map(a=>a.name)});
   if(out.length>=limit)break;
  }
 }
 return out.sort((a,b)=>a.at-b.at);
}
function firstInteriorPointer(project,id,source,start,length){
 if(length<=1)return null;
 const edits=patches(project,id),end=start+length,known=ownership(project,id,source);
 const read=at=>edits.get(at)??source[at];
 // Reject any direct pointer to a byte inside the block, even one at an
 // unaligned native script-command offset. Such pointers would remain aimed
 // at the old block after a naive start-only copy/repoint.
 for(let at=0;at+4<=source.length;at++){
  const hi=read(at+3);if(hi!==0x08&&hi!==0x09)continue;
  const value=(read(at)|(read(at+1)<<8)|(read(at+2)<<16)|(hi<<24))>>>0;
  const target=value-BASE;
  if(target>start&&target<end)return{site:at,target};
 }
 // HMA's OffsetPointer can target an interior value despite its stored word
 // being outside the direct original range.
 for(const [at,owner]of known)if(owner.kind==='hma-offset-pointer'){
  const target=u32(source,at,edits)-BASE+owner.offset;
  if(target>start&&target<end)return{site:at,target};
 }
 return null;
}
export function validatedRepointSites(project,id,source,target,sites,{length=1}={}){
 if(!Array.isArray(sites)||!sites.length||sites.length>64||new Set(sites).size!==sites.length)throw Error('Select 1–64 distinct pointer source addresses.');
 for(const at of sites){
  if(!check(source,at))throw Error('Pointer source is outside ROM.');
  const p=pointerAt(project,id,source,at);
  if(!p.valid||p.at!==target||p.kind==='hma-offset-pointer')throw Error('Repoint requires an unoffset direct pointer to the table at 0x'+target.toString(16).toUpperCase()+'.');
 }
 const interior=firstInteriorPointer(project,id,source,target,length);
 if(interior)throw Error('An interior table pointer at 0x'+interior.site.toString(16).toUpperCase()+' targets original offset 0x'+interior.target.toString(16).toUpperCase()+'. Relocation is blocked until interior pointers are explicitly supported.');
 // Scan every aligned original source word and all manually documented
 // unaligned pointers. Missing ANY known direct user blocks repointing.
 const actual=findROMReferences(project,id,source,target,{limit:65,scanUnaligned:true});
 if(actual.length>64||actual.some(x=>x.kind==='hma-offset-pointer'||!sites.includes(x.at)))
  throw Error('Unreviewed/offset pointer users exist for this table. Include all verified direct users or keep the original address.');
 // The raw scan cannot prove unaligned bytecode pointers are absent. Never
 // report this as generalized automatic HMA pointer ownership.
 return{sites:sites.slice().sort((a,b)=>a-b),candidates:actual,limitation:'Scans raw packed/direct little-endian pointer bytes at every address plus HMA offset/typed sites; computed pointers and semantic engine ownership remain unverified.'};
}
export function planSafeTableRepoint(project,id,source,table,sites){
 validateTable(table,source.length);
 const state=hexState(project,id),pending=state?.repoints||[];
 if(pending.length>=32)throw Error('At most 32 table copy-on-write repoints per ROM.');
 if(pending.some(p=>p.tableId===table.id||p.sites.some(site=>sites.includes(site))))throw Error('Another queued relink uses this table or pointer source.');
 const reviewed=validatedRepointSites(project,id,source,table.address,sites,{length:table.stride*table.count});
 const plan={tableId:table.id,address:table.address,length:table.stride*table.count,sites:reviewed.sites};
 project.hexStudio??={version:1,sources:{}};project.hexStudio.sources??={};project.hexStudio.sources[id]??={patches:[],tables:[],hmaToml:''};
 project.hexStudio.sources[id].repoints??=[];
 project.hexStudio.sources[id].repoints.push(plan);
 return plan;
}
export function installSafeTableRepoints(project,id,source,output){
 const queued=hexState(project,id)?.repoints||[];
 if(!queued.length)return[];
 if(!output?.bytes||typeof output.allocate!=='function'||typeof output.int!=='function')throw Error('Native writer is required for safe repoints.');
 if(queued.length>32)throw Error('Too many source table repoints.');
 const definitions=tableDefinitions(project,id,source),reviews=[];
 // Preflight all plans before touching *any* output buffer.
 for(const p of queued){
  const table=definitions.find(t=>t.id===p.tableId);
  if(!table||table.address!==p.address||table.stride*table.count!==p.length)throw Error('Source table definition changed after repoint planning.');
  validatedRepointSites(project,id,source,p.address,p.sites,{length:p.length});
  if(p.address<512||p.length<1||p.address+p.length>source.length)throw Error('Repoint copy exceeds the original ROM.');
  for(const at of p.sites){
   if(output.writes.some(w=>at<w.address+w.length&&at+4>w.address)||u32(output.bytes,at,new Map())!==BASE+p.address)
    throw Error('Other native edits overlap a table pointer site at 0x'+at.toString(16).toUpperCase());
  }
  for(const other of reviews)if(p.sites.some(at=>other.sites.includes(at)))throw Error('Duplicate table pointer ownership.');
  // Repointing copies data from final compiled bytes: it reflects staged
  // typed edits, while original source bytes remain available for recovery.
  reviews.push({plan:p,sites:p.sites});
 }
 const results=[];
 for(const {plan,sites}of reviews){
  const copy=output.bytes.slice(plan.address,plan.address+plan.length);
  const address=output.allocate(copy,'Reviewed HMA table copy: '+plan.tableId);
  for(const site of sites)output.int(site,BASE+address);
  results.push({tableId:plan.tableId,oldAddress:plan.address,newAddress:address,bytes:copy.length,updatedPointers:sites.length});
 }
 return results;
}
