import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {planSave,assembleSavedProject,savedProjectKeys} from '../dist/project-store.js';
import {saveTableDefinition} from '../dist/hma-table-workspace.js';
import {planSafeTableExpansion,installSafeTableRepoints} from '../dist/hma-pointer-navigation.js';
import {stageROMHex} from '../dist/native-hex-workspace.js';
import {gbaCountEngine,verifyEngineCountSites,scanThumbCountCandidates} from '../dist/hma-engine-count.js';
const ID='6'.repeat(64),TABLE=0x7000,POINTERS=[0x540,0x544],COUNT=0x558,CMP=0x5a0,MOVS=0x5a2;
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
function fixture({code='BPRE'}={}){
 const source=syntheticROM(),project=newProject(),table={id:'runtime-count',name:'Reviewed engine-bound records',address:TABLE,stride:4,count:4,fields:[{name:'value',type:'u32',offset:0}]};
 source.set(new TextEncoder().encode(code),0xac);
 for(const at of POINTERS)view(source).setUint32(at,0x08000000+TABLE,true);
 view(source).setUint16(COUNT,4,true);
 view(source).setUint16(CMP,0x2b04,true); // Thumb CMP r3, #4
 view(source).setUint16(MOVS,0x2104,true); // Thumb MOVS r1, #4
 for(let i=0;i<4;i++)view(source).setUint32(TABLE+4*i,i+1,true);
 saveTableDefinition(project,ID,source,table);
 return {project,source,table};
}
const dependent=[{at:CMP,kind:'thumb-cmp'},{at:MOVS,kind:'thumb-movs'}];
test('native game header distinguishes FRLG and Emerald without inferring unrelated hacks',()=>{
 for(const [code,family]of [['BPRE','frlg'],['BPGE','frlg'],['BPEE','emerald'],['TEST',null]]){
  assert.deepEqual(gbaCountEngine(fixture({code}).source),{code,family});
 }
});
test('reviewed Thumb CMP/MOVS engine dependencies retain opcode/register and patch only imm8 bounds',()=>{
 for(const code of ['BPRE','BPGE','BPEE']){
  const {source,project,table}=fixture({code}),original=source.slice();
  const reviewed=verifyEngineCountSites(source,4,6,dependent);
  assert.equal(reviewed.sites.length,2);
  assert.deepEqual(reviewed.sites.map(s=>s.newWord),[0x2b06,0x2106]);
  const plan=planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2,engineSites:dependent});
  assert.equal(plan.engineSites.length,2);
  const output=new RomOutput(source),[report]=installSafeTableRepoints(project,ID,source,output);
  assert.equal(report.engineInstructions,2);assert.equal(report.newCount,6);
  assert.equal(view(output.bytes).getUint16(CMP,true),0x2b06);
  assert.equal(view(output.bytes).getUint16(MOVS,true),0x2106);
  assert.equal(view(output.bytes).getUint16(COUNT,true),6);
  assert.equal(view(output.bytes).getUint32(POINTERS[0],true),0x08000000+report.newAddress);
  assert.deepEqual(source,original,'opening source is immutable');
 }
});
test('bounded candidate scanning discovers Thumb instructions without modifying project or claiming engine semantics',()=>{
 const {source,project}=fixture({code:'BPEE'}),before=source.slice(),snapshot=JSON.stringify(project);
 const report=scanThumbCountCandidates(source,4,{from:CMP,maxScan:6,limit:10});
 assert.deepEqual(report.candidates.map(x=>[x.at,x.kind,x.register]),[[CMP,'thumb-cmp',3],[MOVS,'thumb-movs',1]]);
 assert.equal(report.engine,'emerald');assert.ok(report.limitation.includes('not verified'));
 assert.equal(report.nextFrom,CMP+6);
 assert.deepEqual(source,before);assert.equal(JSON.stringify(project),snapshot);
 const first=scanThumbCountCandidates(source,4,{from:CMP,maxScan:6,limit:1});
 assert.equal(first.nextFrom,MOVS);
 const next=scanThumbCountCandidates(source,4,{from:first.nextFrom,maxScan:2,limit:1});
 assert.equal(next.candidates[0].at,MOVS);
});
test('wrong opcode, wrong count, duplicate sites and unknown game engine reject all writes',()=>{
 const {source,project,table}=fixture(),before=JSON.stringify(project);
 for(const bad of [
  [{at:CMP,kind:'thumb-movs'}],
  [{at:CMP,kind:'thumb-cmp'},{at:CMP,kind:'thumb-cmp'}],
  [{at:CMP+1,kind:'thumb-cmp'}],
  [{at:COUNT,kind:'thumb-cmp'}],
  [{at:CMP,kind:'unknown'}]
 ]){
  assert.throws(()=>planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2,engineSites:bad}));
  assert.equal(JSON.stringify(project),before);
 }
 const other=fixture({code:'TEST'});assert.throws(()=>verifyEngineCountSites(other.source,4,6,dependent),/FireRed|LeafGreen|Emerald/);
 assert.throws(()=>verifyEngineCountSites(source,4,256,dependent),/0 to 255/);
 assert.throws(()=>verifyEngineCountSites(source,4,6,dependent,{code:'BPEE'}),/matching original/);
});
test('compiler ownership and source opcode drift are rejected before any allocation',()=>{
 const {source,project,table}=fixture();
 planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2,engineSites:dependent});
 const out=new RomOutput(source),saved=out.bytes.slice(),n=out.writes.length;
 out.write(CMP+1,Uint8Array.of(source[CMP+1]));
 const before=out.bytes.slice(),count=out.writes.length;
 assert.throws(()=>installSafeTableRepoints(project,ID,source,out),/already owns an engine Thumb/);
 assert.deepEqual(out.bytes,before);assert.equal(out.writes.length,count);
 assert.deepEqual(saved,source);assert.equal(n,0);
 const tampered=source.slice();tampered[CMP]^=1;
 assert.throws(()=>installSafeTableRepoints(project,ID,tampered,new RomOutput(tampered)),/Thumb opcode|original ROM/);
});
test('staged edit over an engine instruction is rejected and source identity is preserved',()=>{
 const {source,project,table}=fixture();
 stageROMHex(project,ID,source,MOVS,Uint8Array.of(8));
 const before=JSON.stringify(project);
 assert.throws(()=>planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2,engineSites:dependent}),/already own an engine instruction/);
 assert.equal(JSON.stringify(project),before);
});
test('engine-bound count plans survive split save and project validation without trust escalation',()=>{
 const {source,project,table}=fixture({code:'BPEE'});
 planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2,engineSites:dependent});
 const plan=planSave(project),parts=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(k=>parts.get(k)));
 validateProject(restored);
 const out=new RomOutput(source),[report]=installSafeTableRepoints(restored,ID,source,out);
 assert.equal(report.engineInstructions,2);
 restored.hexStudio.sources[ID].repoints[0].engineSites[0].kind='unknown';
 assert.throws(()=>validateProject(restored),/engine count instruction/);
});
test('Android screen exposes ROM family, reviewed count opcodes and limited candidate selection',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const part of ['hmaGrowEngineSites','hmaEngineScan','hmaEngineScanNext','hmaEngineScanResults','scanThumbCountCandidates(','gbaCountEngine(','thumb-'])assert.ok(ui.includes(part),part);
});
