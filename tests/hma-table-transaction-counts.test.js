import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {saveTableDefinition} from '../dist/hma-table-workspace.js';
import {planSafeTableExpansion,installSafeTableRepoints} from '../dist/hma-pointer-navigation.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {stageROMHex} from '../dist/native-hex-workspace.js';
const ID='e'.repeat(64),BASE=0x08000000,TABLE=0x7400,TABLE2=0x7800,COUNT=0x558,COUNT2=0x55c,COUNT3=0x570,POINTER=0x540,POINTER2=0x548;
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
function fixture(){
 const source=syntheticROM(),project=newProject(),table={id:'first-table',name:'First verified native table',address:TABLE,stride:4,count:4,fields:[{name:'data',offset:0,type:'u32'}]};
 for(const [site,target] of [[POINTER,TABLE],[POINTER2,TABLE2]])view(source).setUint32(site,BASE+target,true);
 for(const count of [COUNT,COUNT2,COUNT3])view(source).setUint16(count,4,true);
 saveTableDefinition(project,ID,source,table);
 return{source,project,table};
}
test('multiple reviewed literal count fields update atomically and preserve the original ROM',()=>{
 const {source,project,table}=fixture(),before=source.slice();
 const plan=planSafeTableExpansion(project,ID,source,table,[POINTER],{newCount:7,countSite:COUNT,countWidth:2,extraCountSites:[{at:COUNT2,width:2},{at:COUNT3,width:2}],seed:'zero'});
 assert.equal(plan.extraCountSites.length,2);
 const output=new RomOutput(source),report=installSafeTableRepoints(project,ID,source,output)[0];
 assert.equal(report.countFields,3);assert.equal(report.newCount,7);
 for(const site of [COUNT,COUNT2,COUNT3])assert.equal(view(output.bytes).getUint16(site,true),7);
 assert.deepEqual(source,before);
 const saved=planSave(project),parts=new Map(saved.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(saved.header),savedProjectKeys(saved.header).map(k=>parts.get(k)));
 validateProject(restored);
 const repeat=installSafeTableRepoints(restored,ID,source,new RomOutput(source))[0];
 assert.equal(repeat.countFields,3);
});
test('count-field overlaps, stale values, width limits and source ownership reject without project mutation',()=>{
 const {source,project,table}=fixture(),before=JSON.stringify(project);
 const options={newCount:7,countSite:COUNT,countWidth:2};
 for(const extraCountSites of [
  [{at:COUNT,width:2}],[{at:COUNT+1,width:1}],[{at:POINTER,width:4}],
  [{at:TABLE,width:2}],[{at:COUNT3,width:3}],[{at:COUNT3+1,width:2}],
  [{at:COUNT3,width:2},{at:COUNT3+1,width:1}]
 ]){
  assert.throws(()=>planSafeTableExpansion(project,ID,source,table,[POINTER],{...options,extraCountSites}),undefined,JSON.stringify(extraCountSites));
  assert.equal(JSON.stringify(project),before);
 }
 const busy=fixture();stageROMHex(busy.project,ID,busy.source,COUNT3,Uint8Array.of(6));
 const prior=JSON.stringify(busy.project);
 assert.throws(()=>planSafeTableExpansion(busy.project,ID,busy.source,busy.table,[POINTER],{...options,extraCountSites:[{at:COUNT3,width:2}]}),/staged binary edit/);
 assert.equal(JSON.stringify(busy.project),prior);
});
test('late second-table allocation failure does not mutate the caller output at all',()=>{
 const {source,project,table}=fixture(),second={id:'second-table',name:'Other native table',address:TABLE2,count:4,stride:4,fields:[{name:'data',type:'u32',offset:0}]};
 saveTableDefinition(project,ID,source,second);
 planSafeTableExpansion(project,ID,source,table,[POINTER],{newCount:5,countSite:COUNT,countWidth:2});
 planSafeTableExpansion(project,ID,source,second,[POINTER2],{newCount:6,countSite:COUNT2,countWidth:2});
 const output=new RomOutput(source);
 const before=output.bytes.slice(),beforeCursor=output.cursor,allocations=structuredClone(output.allocations),writes=structuredClone(output.writes);
 const normal=output.allocate;
 output.allocate=function(...args){
  if(this.allocations.length>=1)throw Error('Simulated second allocation out of ROM space');
  return normal.apply(this,args);
 };
 assert.throws(()=>installSafeTableRepoints(project,ID,source,output),/Simulated second allocation/);
 assert.deepEqual(output.bytes,before);
 assert.equal(output.cursor,beforeCursor);
 assert.deepEqual(output.allocations,allocations);
 assert.deepEqual(output.writes,writes);
 assert.equal(view(output.bytes).getUint16(COUNT,true),4);
 assert.equal(view(output.bytes).getUint16(COUNT2,true),4);
});
test('successful multi-table relocation commits output bytes and allocation ledger once',()=>{
 const {source,project,table}=fixture(),second={id:'second-table',name:'Other native table',address:TABLE2,count:4,stride:4,fields:[{name:'data',type:'u32',offset:0}]};
 saveTableDefinition(project,ID,source,second);
 planSafeTableExpansion(project,ID,source,table,[POINTER],{newCount:5,countSite:COUNT,countWidth:2,extraCountSites:[{at:COUNT3,width:2}]});
 planSafeTableExpansion(project,ID,source,second,[POINTER2],{newCount:6,countSite:COUNT2,countWidth:2});
 const output=new RomOutput(source),reports=installSafeTableRepoints(project,ID,source,output);
 assert.equal(reports.length,2);
 assert.equal(output.allocations.length,2);
 for(const [site,report] of [[POINTER,reports[0]],[POINTER2,reports[1]]])
  assert.equal(view(output.bytes).getUint32(site,true),BASE+report.newAddress);
 assert.equal(view(output.bytes).getUint16(COUNT,true),5);
 assert.equal(view(output.bytes).getUint16(COUNT3,true),5);
 assert.equal(view(output.bytes).getUint16(COUNT2,true),6);
});
test('two table plans cannot overlap a primary pointer and a secondary count field',()=>{
 const {source,project,table}=fixture(),second={id:'second-table',name:'Other native table',address:TABLE2,count:4,stride:4,fields:[{name:'data',type:'u32',offset:0}]};
 saveTableDefinition(project,ID,source,second);
 planSafeTableExpansion(project,ID,source,table,[POINTER],{newCount:5,countSite:COUNT,countWidth:2});
 // Overwrite the second pointer's upper 08 byte with the old count of 4,
 // and set a direct table pointer at a different location for the second table.
 const fake=0x54b;source[fake]=4;
 view(source).setUint32(0x550,BASE+TABLE2,true);
 // The original second table pointer remains an unreviewed direct user;
 // pointer completeness blocks before output can be touched.
 assert.throws(()=>planSafeTableExpansion(project,ID,source,second,[0x550],{newCount:5,countSite:COUNT2,countWidth:2,extraCountSites:[{at:fake,width:1}]}),/Unreviewed|count field/);
});
