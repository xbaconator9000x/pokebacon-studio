import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {importHMAToml,fixedNumericHMATable,saveTableDefinition} from '../dist/hma-table-workspace.js';
import {planLinkedTableExpansionGroup,verifyLinkedExpansionGroups} from '../dist/hma-linked-expansion.js';
import {expandedTableRecord,editExpandedTableField,installSafeTableRepoints,discardTableRepoint,planSafeTableExpansion} from '../dist/hma-pointer-navigation.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {stageROMHex} from '../dist/native-hex-workspace.js';
import {readFileSync} from 'node:fs';
const ID='a'.repeat(64),BASE=0x08000000;
const ADDRESS=[0x7400,0x7800,0x7c00],POINTER=[0x540,0x548,0x550],COUNT=0x558;
const TOML=['[[NamedAnchors]]',"Name = '''Species'''",'Address = 0x007400',"Format = '''[id::]4'''",'[[NamedAnchors]]',"Name = '''Moves'''",'Address = 0x007800',"Format = '''[move::]Species+2'''",'[[NamedAnchors]]',"Name = '''Forms'''",'Address = 0x007C00',"Format = '''[form::]Species-1'''"].join('\n');
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
function fixture(){
 const source=syntheticROM(),project=newProject('HMA linked dependency source');
 importHMAToml(project,ID,source,TOML);
 const parsed=['Species','Moves','Forms'].map((name,i)=>fixedNumericHMATable({name,at:ADDRESS[i],format:["[id::]4","[move::]Species+2","[form::]Species-1"][i]},source.length,
  {anchors:[{name:'Species',at:ADDRESS[0],format:'[id::]4'},{name:'Moves',at:ADDRESS[1],format:'[move::]Species+2'},{name:'Forms',at:ADDRESS[2],format:'[form::]Species-1'}]}));
 parsed.forEach((table,i)=>{saveTableDefinition(project,ID,source,table);
  view(source).setUint32(POINTER[i],BASE+ADDRESS[i],true);
  for(let row=0;row<table.count;row++)view(source).setUint32(ADDRESS[i]+row*4,100*(i+1)+row,true);
 });
 view(source).setUint16(COUNT,4,true);
 const members=parsed.map((t,i)=>({tableId:t.id,sites:[POINTER[i]],...(i===0?{countSite:COUNT,countWidth:2}:{})}));
 return{source,project,parsed,members};
}
function queue(f,extra={}){
 return planLinkedTableExpansionGroup(f.project,ID,f.source,{anchorName:'Species',newBaseCount:6,members:f.members,seed:'copy-last',...extra});
}
test('linked HMA three-table source group plans atomically and exports derived 6/8/5 counts',()=>{
 const f=fixture(),before=f.source.slice();
 const result=queue(f);
 assert.equal(result.tables.length,3);
 assert.deepEqual(result.tables.map(t=>t.newCount),[6,8,5]);
 validateProject(f.project);
 const state=f.project.hexStudio.sources[ID];
 assert.equal(state.repoints.length,3);
 assert.deepEqual(verifyLinkedExpansionGroups(f.project,ID,f.source,state.repoints),[result.groupId]);
 assert.equal(expandedTableRecord(f.project,ID,f.source,f.parsed[1],6).values.move,205);
 editExpandedTableField(f.project,ID,f.source,f.parsed[1],6,'move',888);
 editExpandedTableField(f.project,ID,f.source,f.parsed[2],3,'form',999);
 const out=new RomOutput(f.source),receipt=installSafeTableRepoints(f.project,ID,f.source,out);
 assert.deepEqual(receipt.map(x=>x.newCount),[6,8,5]);
 assert.equal(view(out.bytes).getUint16(COUNT,true),6);
 for(let i=0;i<3;i++)assert.equal(view(out.bytes).getUint32(POINTER[i],true),BASE+receipt[i].newAddress);
 assert.equal(view(out.bytes).getUint32(receipt[1].newAddress+6*4,true),888);
 assert.equal(view(out.bytes).getUint32(receipt[2].newAddress+3*4,true),999);
 for(let i=0;i<3;i++)assert.equal(view(out.bytes).getUint32(ADDRESS[i],true),100*(i+1),'old original tables remain intact');
 assert.deepEqual(f.source,before);
});
test('source-pinned linked group retains queue and appended changes through project split save/reopen',()=>{
 const f=fixture(),receipt=queue(f);
 editExpandedTableField(f.project,ID,f.source,f.parsed[0],4,'id',777);
 const plan=planSave(f.project),parts=new Map(plan.parts.map(x=>[x.id,structuredClone(x.value)]));
 const reopened=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(key=>parts.get(key)));
 validateProject(reopened);
 assert.equal(expandedTableRecord(reopened,ID,f.source,f.parsed[0],4).values.id,777);
 assert.deepEqual(verifyLinkedExpansionGroups(reopened,ID,f.source,reopened.hexStudio.sources[ID].repoints),[receipt.groupId]);
 assert.equal(installSafeTableRepoints(reopened,ID,f.source,new RomOutput(f.source)).length,3);
});
test('reviewing an incomplete HMA dependency group is rejected before mutating project',()=>{
 const f=fixture(),before=structuredClone(f.project);
 assert.throws(()=>queue(f,{members:f.members.slice(0,2)}),/every HMA table|Include every/i);
 assert.deepEqual(f.project,before);
});
test('a missing or unverifiable native count/pointer source fails before queueing any group',()=>{
 const f=fixture(),before=structuredClone(f.project);
 assert.throws(()=>queue(f,{members:[{...f.members[0],countSite:0x600},...f.members.slice(1)]}),/native count|count field/i);
 assert.deepEqual(f.project,before);
 assert.throws(()=>queue(f,{members:[{...f.members[0],sites:[]},...f.members.slice(1)]}),/pointer/i);
 assert.deepEqual(f.project,before);
});
test('group planning rejects invented independent dependent count fields and oversized growth',()=>{
 const f=fixture(),before=structuredClone(f.project);
 assert.throws(()=>queue(f,{members:[f.members[0],{...f.members[1],countSite:0x600},f.members[2]]}),/Dependent|independent/i);
 assert.throws(()=>queue(f,{newBaseCount:100}),/1–64|additional|exceed/i);
 assert.deepEqual(f.project,before);
});
test('tampered or partly discarded groups fail closed on save and export',()=>{
 const f=fixture();queue(f);
 let p=f.project.hexStudio.sources[ID].repoints;
 p.pop();
 assert.throws(()=>validateProject(f.project),/linked HMA expansion group is incomplete/i);
 assert.throws(()=>installSafeTableRepoints(f.project,ID,f.source,new RomOutput(f.source)),/incomplete/i);
 const g=fixture();queue(g);
 g.project.hexStudio.sources[ID].repoints[1].newCount++;
 assert.throws(()=>validateProject(g.project),/linked HMA|dependency/i);
 assert.throws(()=>installSafeTableRepoints(g.project,ID,g.source,new RomOutput(g.source)),/linked|count|inconsistent/i);
});
test('second linked table allocation failure cannot alter output, pointers, count or other compiled edits',()=>{
 const f=fixture();queue(f);
 const out=new RomOutput(f.source);
 out.write(0x6000,Uint8Array.of(7,9,12));const old=out.bytes.slice(),writes=structuredClone(out.writes),allocs=structuredClone(out.allocations);
 const originalAllocate=out.allocate;let attempt=0;
 out.allocate=function(...args){if(++attempt===2)throw Error('synthetic linked table allocation failed');return originalAllocate.apply(this,args);};
 assert.throws(()=>installSafeTableRepoints(f.project,ID,f.source,out),/synthetic linked table allocation failed/);
 assert.deepEqual(out.bytes,old);assert.deepEqual(out.writes,writes);assert.deepEqual(out.allocations,allocs);
 assert.equal(view(out.bytes).getUint16(COUNT,true),4);
});
test('original staged table edits cannot overwrite linked reviewed native count fields',()=>{
 const f=fixture();
 stageROMHex(f.project,ID,f.source,COUNT,Uint8Array.of(7));
 const before=structuredClone(f.project);
 assert.throws(()=>queue(f),/staged binary edit/i);
 assert.deepEqual(f.project,before);
});

test('original HMA anchor cannot grow alone and grouped unqueue removes all dependent plans',()=>{
 const f=fixture(),before=structuredClone(f.project);
 assert.throws(()=>planSafeTableExpansion(f.project,ID,f.source,f.parsed[0],[POINTER[0]],{newCount:6,countSite:COUNT,countWidth:2}),/anchors linked HMA tables/i);
 assert.deepEqual(f.project,before);
 queue(f);
 const result=discardTableRepoint(f.project,ID,f.source,f.parsed[1]);
 assert.equal(result.removed,3);
 assert.equal(f.project.hexStudio.sources[ID].repoints.length,0);
 validateProject(f.project);
});
test('source table containing a reviewed pointer site is rejected, not copied with a stale reference',()=>{
 const f=fixture();
 // Repoint a native table internally: the source scanner now sees the
 // dependent table's own pointer as an additional live use.
 const inside=ADDRESS[0]+4;
 view(f.source).setUint32(inside,BASE+ADDRESS[1],true);
 const before=structuredClone(f.project);
 assert.throws(()=>queue(f,{members:[f.members[0],{...f.members[1],sites:[POINTER[1],inside]},f.members[2]]}),/contains an original dependency write site|pointer/i);
 assert.deepEqual(f.project,before);
});
test('Android linked table review UI exposes complete original pointer list and requires explicit confirmation',()=>{
 const dialog=readFileSync(new URL('../dist/hma-linked-ui.js',import.meta.url),'utf8');
 const work=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 assert.match(dialog,/id="hmaLinkedReviewed"/);
 assert.match(dialog,/data-linked-pointer-sites/);
 assert.match(dialog,/planLinkedTableExpansionGroup/);
 assert.match(dialog,/api\.session\(\)\.id!==sourceId/);
 assert.match(work,/id="hmaLinkedGrow"/);
 assert.match(work,/openLinkedGroupReview\(api/);
});
