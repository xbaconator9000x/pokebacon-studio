import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {romFingerprint} from '../dist/rom-project.js';
import {RomOutput} from '../dist/rom-writer.js';
import {saveTableDefinition} from '../dist/hma-table-workspace.js';
import {planSafeTableExpansion,installSafeTableRepoints} from '../dist/hma-pointer-navigation.js';
import {createEngineReviewManifest,inspectEngineReviewManifest} from '../dist/hma-engine-manifest.js';
const BASE=0x08000000,TABLE=0x7400,COUNT=0x558,COUNT2=0x55c,POINTERS=[0x540,0x544],CMP=0x5a0;
const view=source=>new DataView(source.buffer,source.byteOffset,source.byteLength);
async function fixture(){
 const source=syntheticROM();source.set(new TextEncoder().encode('BPRE'),0xac);
 for(const at of POINTERS)view(source).setUint32(at,BASE+TABLE,true);
 view(source).setUint16(COUNT,4,true);view(source).setUint16(COUNT2,4,true);view(source).setUint16(CMP,0x2b04,true);
 const id=await romFingerprint(source);
 const project=newProject(),table={id:'portable-native',name:'Portable native metadata',address:TABLE,count:4,stride:4,fields:[{name:'id',type:'u16',offset:0},{name:'power',type:'u16',offset:2}]};
 saveTableDefinition(project,id,source,table);
 return {id,source,project,table};
}
test('exports minimal dependency metadata pinned to exact source SHA without ROM or authored byte arrays',async()=>{
 const {project,source,id,table}=await fixture();
 planSafeTableExpansion(project,id,source,table,POINTERS,{newCount:7,countSite:COUNT,countWidth:2,extraCountSites:[{at:COUNT2,width:2}],engineSites:[{at:CMP,kind:'thumb-cmp'}]});
 const manifest=await createEngineReviewManifest(project,id,source,table);
 assert.equal(manifest.source.sha256,id);
 assert.equal(manifest.source.gameCode,'BPRE');
 assert.deepEqual(manifest.pointerSites,POINTERS);
 assert.equal(manifest.extraCountSites.length,1);
 assert.deepEqual(manifest.thumbSites,[{at:CMP,kind:'thumb-cmp'}]);
 assert.equal(manifest.suggestedNewCount,7);
 const exported=JSON.stringify(manifest);assert.ok(exported.length<2000);
 assert.ok(!exported.includes('extraBytes'));
 assert.ok(!exported.includes('romSources'));
 assert.ok(!exported.includes('sourceGzip'));
 assert.ok(!exported.includes('originalBlocks'));
 const empty=newProject();saveTableDefinition(empty,id,source,table);
 const before=JSON.stringify(empty);
 const imported=await inspectEngineReviewManifest(empty,id,source,table,exported);
 assert.equal(imported.review.newCount,7);
 assert.equal(imported.verifiedSourceSha256,id);
 assert.equal(JSON.stringify(empty),before,'review may not mutate the destination project');
 const config=imported.manifest;
 planSafeTableExpansion(empty,id,source,table,config.pointerSites,{
  newCount:config.suggestedNewCount,countSite:config.primaryCount.at,countWidth:config.primaryCount.width,
  extraCountSites:config.extraCountSites,engineSites:config.thumbSites
 });
 const output=new RomOutput(source),[report]=installSafeTableRepoints(empty,id,source,output);
 assert.equal(report.newCount,7);assert.equal(report.countFields,2);assert.equal(report.engineInstructions,1);
 assert.equal(view(output.bytes).getUint16(COUNT2,true),7);
 assert.equal(view(output.bytes).getUint16(CMP,true),0x2b07);
});
test('a changed revision with identical ROM game code and geometry cannot import a source-pinned profile',async()=>{
 const {project,source,id,table}=await fixture();
 planSafeTableExpansion(project,id,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2});
 const manifest=await createEngineReviewManifest(project,id,source,table);
 const wrong=source.slice();wrong[wrong.length-2]^=0x55;
 assert.equal(String.fromCharCode(...wrong.subarray(0xac,0xb0)),'BPRE');
 const dest=newProject();saveTableDefinition(dest,id,wrong,table);
 const before=JSON.stringify(dest);
 await assert.rejects(()=>inspectEngineReviewManifest(dest,id,wrong,table,manifest),/source SHA-256/);
 assert.equal(JSON.stringify(dest),before);
});
test('manifest rejects mutated table layouts, source metadata, pointer/count sites and arbitrary fields',async()=>{
 const {project,source,id,table}=await fixture();
 planSafeTableExpansion(project,id,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2,extraCountSites:[{at:COUNT2,width:2}],engineSites:[{at:CMP,kind:'thumb-cmp'}]});
 const manifest=await createEngineReviewManifest(project,id,source,table);
 const dest=newProject();saveTableDefinition(dest,id,source,table);
 const tamper=[
  x=>{x.source.sha256='f'.repeat(64);},
  x=>{x.source.engineFamily='emerald';},
  x=>{x.table.stride=8;},
  x=>{x.table.fields[0].offset=2;},
  x=>{x.pointerSites=[POINTERS[0]];},
  x=>{x.primaryCount.at=COUNT+1;},
  x=>{x.extraCountSites=[{at:COUNT,width:2}];},
  x=>{x.thumbSites=[{at:CMP,kind:'thumb-movs'}];},
  x=>{x.unexpected='never trust unspecified fields';},
  x=>{x.suggestedNewCount=5000;}
 ];
 for(const change of tamper){
  const copy=structuredClone(manifest);change(copy);
  const before=JSON.stringify(dest);
  await assert.rejects(()=>inspectEngineReviewManifest(dest,id,source,table,copy),undefined,JSON.stringify(copy).slice(0,150));
  assert.equal(JSON.stringify(dest),before);
 }
});
test('manifest JSON parser and source/layout rules reject invalid untrusted metadata without side effects',async()=>{
 const {project,source,id,table}=await fixture();
 for(const input of ['','{broken JSON','a'.repeat(70000),'{ "__proto__": {}, "kind":"x" }']){
  await assert.rejects(()=>inspectEngineReviewManifest(project,id,source,table,input));
 }
 await assert.rejects(()=>createEngineReviewManifest(project,id,source,table),/Queue a guarded/);
});
test('phone editor integrates file review, separate user confirmation, and explicit JSON export',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const item of ['hmaGrowManifestFile','hmaGrowManifestValidate','hmaGrowManifestReport','hmaGrowExtraCounts','hmaExportEngineManifest','inspectEngineReviewManifest(','createEngineReviewManifest(','hmaGrowReviewed'])assert.ok(ui.includes(item),item);
 assert.match(ui,/checked=false/,'import does not pre-check user acceptance');
});
