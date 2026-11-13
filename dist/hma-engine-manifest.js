// Portable, exact-source-pinned review packages for native HMA expansion.
// No built-in engine addresses are fabricated; a manifest records a HUMAN
// reviewed ROM-specific plan, not an official engine compatibility profile.
import {romFingerprint} from './rom-project.js';
import {gbaCountEngine} from './hma-engine-count.js';
import {hexState} from './native-hex-workspace.js';
import {validateTable} from './hma-table-workspace.js';
import {planSafeTableExpansion} from './hma-pointer-navigation.js';
const TYPE='pokebacon-hma-reviewed-dependencies',MAX_JSON=65536;
function safeShape(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function layout(table){
 return {id:table.id,address:table.address,stride:table.stride,count:table.count,
  fields:table.fields.map(f=>({name:f.name,type:f.type,offset:f.offset,...(f.length!==undefined?{length:f.length}:{})}))};
}
function assertKeys(obj,keys,label){
 if(!safeShape(obj)||Object.keys(obj).some(key=>!keys.includes(key)))
  throw Error('Invalid or unexpected '+label+' fields in engine review manifest.');
}
function dryRun(project,sourceId,source,table,metadata,{removeExisting=false}={}){
 const workspace=project.hexStudio?structuredClone(project.hexStudio):{version:1,sources:{}};
 if(workspace.sources?.[sourceId]&&removeExisting){
  workspace.sources[sourceId].repoints=(workspace.sources[sourceId].repoints||[]).filter(p=>p.tableId!==table.id);
 }
 const temp={hexStudio:workspace};
 const result=planSafeTableExpansion(temp,sourceId,source,table,metadata.pointerSites,{
  newCount:metadata.suggestedNewCount,countSite:metadata.primaryCount.at,countWidth:metadata.primaryCount.width,
  extraCountSites:metadata.extraCountSites,engineSites:metadata.thumbSites,seed:'zero'
 });
 return result;
}
/** A user-review manifest contains no native ROM bytes, credentials or app
 * project data. Its SHA is recomputed from all original source bytes. */
export async function createEngineReviewManifest(project,sourceId,source,table){
 validateTable(table,source.length);
 const plan=(hexState(project,sourceId)?.repoints||[]).find(p=>p.tableId===table.id);
 if(!plan||plan.newCount===undefined)throw Error('Queue a guarded native table expansion before exporting a dependency review.');
 const config={
  pointerSites:plan.sites.slice(),primaryCount:{at:plan.countSite,width:plan.countWidth},
  extraCountSites:(plan.extraCountSites||[]).map(x=>({...x})),
  thumbSites:(plan.engineSites||[]).map(({at,kind})=>({at,kind})),
  suggestedNewCount:plan.newCount
 };
 dryRun(project,sourceId,source,table,config,{removeExisting:true});
 const sha256=await romFingerprint(source);
 const engine=gbaCountEngine(source);
 return {kind:TYPE,version:1,source:{sha256,length:source.length,gameCode:engine.code,engineFamily:engine.family},
  table:layout(table),...config,provenance:'user-reviewed; raw Thumb opcode matching is not proof of code reachability or table ownership'};
}
/** Safe read-only validation of an externally supplied dependency manifest.
 * No sidecar or source ID is silently rewritten. The actual ROM bytes win. */
export async function inspectEngineReviewManifest(project,sourceId,source,table,raw){
 const input=typeof raw==='string'?raw:JSON.stringify(raw);
 if(typeof input!=='string'||input.length<2||input.length>MAX_JSON)throw Error('Engine review manifest exceeds the 64 KiB limit.');
 let manifest;
 try{manifest=JSON.parse(input);}catch{throw Error('Invalid engine review manifest JSON.');}
 assertKeys(manifest,['kind','version','source','table','pointerSites','primaryCount','extraCountSites','thumbSites','suggestedNewCount','provenance'],'manifest');
 if(manifest.kind!==TYPE||manifest.version!==1||!Array.isArray(manifest.pointerSites)||
  !Array.isArray(manifest.extraCountSites)||!Array.isArray(manifest.thumbSites)||
  !Number.isInteger(manifest.suggestedNewCount))
  throw Error('Unsupported or incomplete engine dependency manifest.');
 assertKeys(manifest.source,['sha256','length','gameCode','engineFamily'],'source');
 assertKeys(manifest.table,['id','address','stride','count','fields'],'table');
 assertKeys(manifest.primaryCount,['at','width'],'primary count');
 for(const entry of manifest.extraCountSites)assertKeys(entry,['at','width'],'additional count');
 for(const entry of manifest.thumbSites)assertKeys(entry,['at','kind'],'Thumb site');
 if(manifest.pointerSites.length>64||manifest.extraCountSites.length>16||manifest.thumbSites.length>16)
  throw Error('Engine dependency manifest exceeds reviewed site limits.');
 if(!/^[a-f0-9]{64}$/.test(manifest.source.sha256)||manifest.source.length!==source.length)
  throw Error('The engine dependency manifest has invalid original ROM provenance.');
 validateTable(table,source.length);
 if(JSON.stringify(manifest.table)!==JSON.stringify(layout(table)))
  throw Error('The native table layout does not match the reviewed manifest.');
 const family=gbaCountEngine(source);
 if(manifest.source.gameCode!==family.code||manifest.source.engineFamily!==family.family)
  throw Error('The ROM header family does not match the manifest.');
 if(manifest.source.sha256!==await romFingerprint(source))
  throw Error('The source SHA-256 does not match this engine dependency manifest. Open the exact original ROM revision.');
 // A cryptographic source match does not imply the listed *semantic*
 // dependencies are correct. Run full original-byte and compiler preflight.
 const review=dryRun(project,sourceId,source,table,manifest);
 return {manifest,review,verifiedSourceSha256:manifest.source.sha256,
  limitation:'All sites structurally match the exact source. Engine code reachability and table-specific semantics still require independent review.'};
}
