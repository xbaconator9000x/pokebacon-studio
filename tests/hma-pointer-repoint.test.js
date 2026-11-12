import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {stageROMHex} from '../dist/native-hex-workspace.js';
import {importHMAToml,saveTableDefinition,tableRecord,fixedNumericHMATable} from '../dist/hma-table-workspace.js';
import {pointerAt,findROMReferences,validatedRepointSites,planSafeTableRepoint,installSafeTableRepoints} from '../dist/hma-pointer-navigation.js';
const BASE=0x08000000,ID='a'.repeat(64),TABLE=0x7000,SITE1=0x540,SITE2=0x544;
const view=(bytes)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
function scenario(){
 const source=syntheticROM(),dv=view(source);
 for(const site of [SITE1,SITE2])dv.setUint32(site,BASE+TABLE,true);
 for(let i=0;i<16;i++)source[TABLE+i]=i+1;
 const project=newProject('HMA pointer audit'),table={id:'hma-test-table',name:'Test records',address:TABLE,stride:4,count:4,fields:[{name:'value',type:'u32',offset:0}]};
 saveTableDefinition(project,ID,source,table);
 return{source,project,table};
}
test('exact GBA little-endian pointers, aligned raw sources and documented HMA offset pointers are inspectable',()=>{
 const {source,project,table}=scenario(),dv=view(source);
 assert.deepEqual(findROMReferences(project,ID,source,TABLE).map(x=>x.at),[SITE1,SITE2]);
 assert.equal(pointerAt(project,ID,source,SITE1).raw,BASE+TABLE);
 assert.equal(pointerAt(project,ID,source,SITE1).at,TABLE);
 assert.equal(pointerAt(project,ID,source,SITE1).kind,'candidate');
 assert.deepEqual(validatedRepointSites(project,ID,source,TABLE,[SITE1,SITE2]).sites,[SITE1,SITE2]);
 assert.throws(()=>validatedRepointSites(project,ID,source,TABLE,[SITE1]),/Unreviewed/);
 const raw=["[[NamedAnchors]]","Name = '''test.records'''","Address = 0x007000","Format = '''[value::]4'''","[[OffsetPointer]]","Address = 0x000550","Offset = 8"].join('\n');
 dv.setUint32(0x550,BASE+TABLE-8,true);
 importHMAToml(project,ID,source,raw);
 assert.equal(pointerAt(project,ID,source,0x550).at,TABLE);
 assert.equal(pointerAt(project,ID,source,0x550).kind,'hma-offset-pointer');
 assert.deepEqual(findROMReferences(project,ID,source,TABLE).map(x=>x.at),[SITE1,SITE2,0x550]);
 assert.throws(()=>validatedRepointSites(project,ID,source,TABLE,[SITE1,SITE2]),/Unreviewed|offset pointer/);
 assert.throws(()=>pointerAt(project,ID,source,source.length-2),/complete four-byte/);
});
test('copy-on-write repoint preserves existing source table and rewrites all documented direct users',async()=>{
 const {source,project,table}=scenario(),before=source.slice(),history=captureEdit(project);
 stageROMHex(project,ID,source,TABLE,Uint8Array.of(0xAB)); // this edit must flow into copied table data
 const plan=planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2]);
 assert.equal(plan.length,16);
 assert.equal(plan.sites.length,2);
 assert.deepEqual(source,before,'planning never changes source');
 const output=new RomOutput(source);
 const {installROMHexEdits}=await import('../dist/native-hex-workspace.js');
 installROMHexEdits(project,ID,source,output);
 const reports=installSafeTableRepoints(project,ID,source,output);
 assert.equal(reports.length,1);
 assert.equal(reports[0].updatedPointers,2);
 const relocated=reports[0].newAddress;
 assert.ok(relocated>=source.length);
 assert.equal(view(output.bytes).getUint32(SITE1,true),BASE+relocated);
 assert.equal(view(output.bytes).getUint32(SITE2,true),BASE+relocated);
 assert.equal(output.bytes[relocated],0xAB);
 assert.deepEqual(output.bytes.slice(relocated+1,relocated+16),before.slice(TABLE+1,TABLE+16));
 assert.equal(source[TABLE],before[TABLE]);
 assert.equal(tableRecord(project,ID,source,table,0).values.value&0xff,0xAB);
 const native=await new GbaMaps(output.bytes,'Repointed fixture.gba').discover();
 assert.equal(native.byKey('0.0').layout.width,4);
 assert.deepEqual(source,before);
 const delta=finishEdit(project,history);
 assert.ok(delta.root.some(x=>x[0]==='hexStudio'));
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reloaded=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reloaded);
 assert.deepEqual(reloaded.hexStudio.sources[ID].repoints,[plan]);
 const output2=new RomOutput(source);installROMHexEdits(reloaded,ID,source,output2);
 assert.deepEqual(installSafeTableRepoints(reloaded,ID,source,output2),reports);
 applyEdit(project,delta,false);assert.equal(project.hexStudio.sources[ID].repoints?.length||0,0);
 applyEdit(project,delta,true);assert.equal(project.hexStudio.sources[ID].repoints.length,1);
});
test('changed original pointer, arbitrary extra user, duplicate site and compiler ownership abort repoint before writes',()=>{
 const {source,project,table}=scenario();
 assert.throws(()=>planSafeTableRepoint(project,ID,source,table,[SITE1,SITE1]),/distinct/);
 assert.equal(project.hexStudio.sources[ID].repoints,undefined);
 const plan=planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2]);
 assert.throws(()=>planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2]),/Another queued/);
 const output=new RomOutput(source);output.write(SITE2,Uint8Array.of(0xff));
 const snapshot=output.bytes.slice(),count=output.writes.length;
 assert.throws(()=>installSafeTableRepoints(project,ID,source,output),/overlap/);
 assert.deepEqual(output.bytes,snapshot);
 assert.equal(output.writes.length,count);
 const modified=source.slice();view(modified).setUint32(0x54c,BASE+TABLE,true);
 assert.throws(()=>installSafeTableRepoints(project,ID,modified,new RomOutput(modified)),/Unreviewed/);
 assert.equal(project.hexStudio.sources[ID].repoints[0].tableId,plan.tableId);
});
test('supported inline fixed HMA numeric table formats become editable layouts; complex syntax stays read-only',()=>{
 const anchor={name:'data.battles.test',at:TABLE,format:'[level. attack: experience::]4'};
 const parsed=fixedNumericHMATable(anchor,0x20000);
 assert.equal(parsed.address,TABLE);
 assert.equal(parsed.count,4);
 assert.equal(parsed.stride,7);
 assert.deepEqual(parsed.fields.map(x=>[x.name,x.type,x.offset]),[['level','u8',0],['attack','u16',1],['experience','u32',3]]);
 for(const unsafe of ['[name""11]412','[name<"">]4','[flags|a:]3','[value.]data.count','[A. A:]4','[value.]99999','[value<>]3','[value.]0'])
  assert.equal(fixedNumericHMATable({...anchor,format:unsafe},0x20000),null,unsafe);
 const {project,source}=scenario();
 saveTableDefinition(project,ID,source,{...parsed,id:'hma-different',name:'Verified numeric table'});
 assert.equal(tableRecord(project,ID,source,{...parsed,id:'hma-different',name:'Verified numeric table'},0).at,TABLE);
});

test('hidden unaligned bytecode pointer blocks repoint, even though the basic aligned lookup misses it',()=>{
 const {project,source,table}=scenario();
 const packed=0x559;view(source).setUint32(packed,BASE+TABLE,true);
 assert.deepEqual(findROMReferences(project,ID,source,TABLE).map(x=>x.at),[SITE1,SITE2]);
 assert.deepEqual(findROMReferences(project,ID,source,TABLE,{scanUnaligned:true}).map(x=>x.at),[SITE1,SITE2,packed]);
 assert.throws(()=>planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2]),/Unreviewed/);
 assert.equal(project.hexStudio.sources[ID].repoints,undefined);
 const planned=planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2,packed]);
 assert.equal(planned.sites.length,3);
 const output=new RomOutput(source);
 const [result]=installSafeTableRepoints(project,ID,source,output);
 assert.equal(result.updatedPointers,3);
 assert.equal(view(output.bytes).getUint32(packed,true),BASE+result.newAddress);
});

test('direct and HMA-biased interior pointers veto a table move before any native output changes',()=>{
 const {project,source,table}=scenario();
 view(source).setUint32(0x550,BASE+TABLE+4,true);
 assert.throws(()=>planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2]),/interior table pointer/);
 assert.equal(project.hexStudio.sources[ID].repoints,undefined);
 view(source).setUint32(0x550,0,true);
 importHMAToml(project,ID,source,["[[OffsetPointer]]","Address = 0x000554","Offset = 4"].join('\n'));
 view(source).setUint32(0x554,BASE+TABLE,true);
 assert.throws(()=>planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2]),/interior table pointer/);
 assert.equal(project.hexStudio.sources[ID].repoints,undefined);
});

test('header pointer sites are refused at planning time instead of creating invalid saved projects',()=>{
 const {project,source,table}=scenario();
 const site=0x180;view(source).setUint32(site,BASE+TABLE,true);
 assert.throws(()=>planSafeTableRepoint(project,ID,source,table,[SITE1,SITE2,site]),/GBA header/);
 assert.equal(project.hexStudio.sources[ID].repoints,undefined);
});
