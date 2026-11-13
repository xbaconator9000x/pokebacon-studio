import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {installROMHexEdits,stageROMHex} from '../dist/native-hex-workspace.js';
import {saveTableDefinition,tableRecord} from '../dist/hma-table-workspace.js';
import {planSafeTableExpansion,expandedTablePlan,expandedTableRecord,editExpandedTableField,discardTableRepoint,installSafeTableRepoints,planSafeTableRepoint} from '../dist/hma-pointer-navigation.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {planSave,assembleSavedProject,savedProjectKeys} from '../dist/project-store.js';

const ID='9'.repeat(64),BASE=0x08000000,TABLE=0x7000,POINTERS=[0x540,0x544],COUNT=0x558;
const view=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
function fixture({width=2}={}){
 const source=syntheticROM(),project=newProject('Safe HMA growth fixture');
 for(const at of POINTERS)view(source).setUint32(at,BASE+TABLE,true);
 if(width===1)source[COUNT]=4;else if(width===2)view(source).setUint16(COUNT,4,true);else view(source).setUint32(COUNT,4,true);
 const table={id:'native-records',name:'Native source-bound records',address:TABLE,stride:12,count:4,fields:[
  {name:'level',type:'u8',offset:0},{name:'growth',type:'s16',offset:1},
  {name:'pointer',type:'ptr',offset:3},{name:'label',type:'ascii',offset:7,length:5}
 ]};
 for(let row=0;row<4;row++){
  source.set([10+row,3+row,0,0,0,0,0,65+row,0,0,0,0],TABLE+row*12);
 }
 saveTableDefinition(project,ID,source,table);
 return {source,project,table};
}
test('reviewed table expansion allocates new rows, rewrites all pointers and patches verified native count',()=>{
 const {source,project,table}=fixture(),before=source.slice();
 stageROMHex(project,ID,source,TABLE+3*12,Uint8Array.of(77));
 const planned=planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2,seed:'copy-last'});
 assert.equal(planned.oldCount,4);assert.equal(planned.newCount,6);assert.equal(planned.appendedBytes,24);
 assert.equal(expandedTableRecord(project,ID,source,table,4).values.level,77,'copied from staged last native row');
 const change=editExpandedTableField(project,ID,source,table,4,'level','45');
 assert.equal(change.changed,1);
 editExpandedTableField(project,ID,source,table,4,'growth','-300');
 editExpandedTableField(project,ID,source,table,5,'pointer','0x08001000');
 editExpandedTableField(project,ID,source,table,5,'label','Aipom');
 assert.equal(expandedTableRecord(project,ID,source,table,4).values.growth,-300);
 assert.equal(expandedTableRecord(project,ID,source,table,5).values.pointer,0x08001000);
 const output=new RomOutput(source);installROMHexEdits(project,ID,source,output);
 const [report]=installSafeTableRepoints(project,ID,source,output);
 assert.equal(report.oldCount,4);assert.equal(report.newCount,6);assert.equal(report.appendedRows,2);assert.equal(report.bytes,72);
 for(const at of POINTERS)assert.equal(view(output.bytes).getUint32(at,true),BASE+report.newAddress);
 assert.equal(view(output.bytes).getUint16(COUNT,true),6);
 assert.equal(output.bytes[report.newAddress+48],45);
 assert.equal(view(output.bytes).getInt16(report.newAddress+49,true),-300);
 assert.equal(view(output.bytes).getUint32(report.newAddress+60+3,true),0x08001000);
 assert.equal(String.fromCharCode(...output.bytes.slice(report.newAddress+60+7,report.newAddress+60+12)).replace(/\0+$/,''),'Aipom');
 assert.equal(view(source).getUint16(COUNT,true),4,'source native count unchanged');
 assert.deepEqual(source,before,'source ROM byte-for-byte unchanged');
});
test('queued growth is saved/restored and new row edits are reversible without rekeying original table',()=>{
 const {source,project,table}=fixture(),before=captureEdit(project);
 planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:5,countSite:COUNT,countWidth:2,seed:'zero'});
 assert.equal(expandedTableRecord(project,ID,source,table,4).values.level,0);
 editExpandedTableField(project,ID,source,table,4,'label','SAFE');
 const delta=finishEdit(project,before);
 assert.ok(delta.root.some(([key])=>key==='hexStudio'));
 const plan=planSave(project),parts=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(k=>parts.get(k)));
 validateProject(restored);
 assert.equal(expandedTableRecord(restored,ID,source,table,4).values.label,'SAFE');
 const output=new RomOutput(source),[report]=installSafeTableRepoints(restored,ID,source,output);
 assert.equal(report.newCount,5);
 applyEdit(project,delta,false);
 assert.equal(expandedTablePlan(project,ID,source,table),null);
 applyEdit(project,delta,true);
 assert.equal(expandedTableRecord(project,ID,source,table,4).values.label,'SAFE');
 assert.equal(tableRecord(project,ID,source,table,0).values.level,10);
});
test('one-byte and four-byte native length sites are encoded at exact width',()=>{
 for(const width of [1,4]){
  const {source,project,table}=fixture({width});
  planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:7,countSite:COUNT,countWidth:width});
  const out=new RomOutput(source),[report]=installSafeTableRepoints(project,ID,source,out);
  assert.equal(report.newCount,7);
  if(width===1)assert.equal(out.bytes[COUNT],7);
  else assert.equal(view(out.bytes).getUint32(COUNT,true),7);
  for(const at of POINTERS)assert.equal(view(out.bytes).getUint32(at,true),BASE+report.newAddress);
 }
});
test('late count-site compiler conflict blocks expansion with no allocation or partial writes',()=>{
 const {source,project,table}=fixture();
 planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:6,countSite:COUNT,countWidth:2});
 const out=new RomOutput(source);out.write(COUNT,Uint8Array.of(4,0));
 const snapshot=out.bytes.slice(),n=out.writes.length;
 assert.throws(()=>installSafeTableRepoints(project,ID,source,out),/count field/);
 assert.deepEqual(out.bytes,snapshot);assert.equal(out.writes.length,n);
});
test('unsafe lengths, missing users, count mismatch, interior pointers and linked lengths veto growth',()=>{
 const {source,project,table}=fixture(),original=JSON.stringify(project);
 const plan=options=>planSafeTableExpansion(project,ID,source,table,POINTERS,options);
 const base={newCount:6,countSite:COUNT,countWidth:2};
 for(const bad of [
  {...base,newCount:4},{...base,newCount:70},{...base,countSite:COUNT+1},
  {...base,countSite:POINTERS[0]},{...base,countWidth:3},{...base,seed:'invalid'}
 ]){assert.throws(()=>plan(bad));assert.equal(JSON.stringify(project),original);}
 assert.throws(()=>planSafeTableExpansion(project,ID,source,table,[POINTERS[0]],base),/Unreviewed/);
 assert.equal(JSON.stringify(project),original);
 const dynamic={...table,linkedLength:{anchor:'another.table',delta:0,verifiedBaseCount:4}};
 assert.throws(()=>planSafeTableExpansion(project,ID,source,dynamic,POINTERS,base),/Linked-length/);
 assert.equal(JSON.stringify(project),original);
 view(source).setUint32(0x560,BASE+TABLE+2,true);
 assert.throws(()=>plan(base),/interior table pointer/);
 assert.equal(JSON.stringify(project),original);
});
test('staged native count, bad appended pointer and stale table plan reject without half-written project',()=>{
 const {source,project,table}=fixture();
 stageROMHex(project,ID,source,COUNT,Uint8Array.of(7));
 const previous=JSON.stringify(project);
 assert.throws(()=>planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:5,countSite:COUNT,countWidth:2}),/staged binary edit/);
 assert.equal(JSON.stringify(project),previous);
 // Remove staged count conflict; invalid appended field must not alter plan.
 stageROMHex(project,ID,source,COUNT,Uint8Array.of(4));
 planSafeTableExpansion(project,ID,source,table,POINTERS,{newCount:5,countSite:COUNT,countWidth:2});
 const recorded=JSON.stringify(project);
 assert.throws(()=>editExpandedTableField(project,ID,source,table,4,'pointer','0x09001000'),/Pointer/);
 assert.throws(()=>editExpandedTableField(project,ID,source,table,4,'label','Too long for cell'),/ASCII/);
 assert.equal(JSON.stringify(project),recorded);
 assert.throws(()=>planSafeTableRepoint(project,ID,source,table,POINTERS),/Another queued/);
 assert.equal(discardTableRepoint(project,ID,source,table).removed,1);
 assert.equal(expandedTablePlan(project,ID,source,table),null);
});
test('Android native tables expose queue, verification, edit and undo controls for appended records',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const key of ['hmaGrowTable','hmaGrowCountSite','hmaGrowCountWidth','hmaGrowReviewed','hmaGrowSeed','hmaUnqueueTable','expandedTableRecord(','editExpandedTableField(','pendingAllocation'])assert.ok(ui.includes(key),key);
});
