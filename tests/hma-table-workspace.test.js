import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {installROMHexEdits} from '../dist/native-hex-workspace.js';
import {parseHMAToml,importHMAToml,hmaMetadata,validateTable,saveTableDefinition,tableDefinitions,tableRecord,editTableField} from '../dist/hma-table-workspace.js';
const sourceId='6'.repeat(64);
test('HMA TOML extracts recognized anchors/offset pointers and retains every unsupported source directive losslessly',()=>{
 const raw=[
 '# HexManiacAdvance metadata',
 '[General]',"ApplicationVersion = '''0.5.6.1'''",
 '[[NamedAnchors]]',"Name = '''data.header.title'''",'Address = 0x0000A0',"Format = '''asc12'''",
 '[[NamedAnchors]]',"Name = '''custom.table'''",'Address = 0x000680',"Format = '''[value. bits: unknown]20'''",
 '[[NamedAnchors]]',"Name = '''out.of.bounds'''",'Address = 0xFFFFFF',"Format = '''[bad:]500'''",
 '[[OffsetPointer]]','Address = 0x000304','Offset = -8',
 '[[List]]',"Name = '''special.types'''",'0 = [',"  '''Bird''',","  '''Electric''',",']',
 '[[UnknownHMACategory]]',"Custom = '''keep this even if unsupported'''"
 ].join('\n')+'\n';
 const source=syntheticROM(),p=newProject(),before=JSON.stringify(p);
 const meta=parseHMAToml(raw,{romLength:source.length});
 assert.equal(meta.anchors.length,2,JSON.stringify(meta.warnings));
 assert.equal(meta.anchors[1].name,'custom.table');
 assert.equal(meta.anchors[1].at,0x680);
 assert.equal(meta.offsetPointers[0].offset,-8);
 assert.ok(meta.warnings.some(w=>/out-of-range/.test(w)));
 assert.equal(meta.raw,raw);
 assert.equal(JSON.stringify(p),before);
 const result=importHMAToml(p,sourceId,source,raw);
 assert.equal(result.anchors,2);
 assert.equal(hmaMetadata(p,sourceId,source).raw,raw);
 assert.throws(()=>parseHMAToml('x'.repeat(2*1024*1024+1)),/under 2 MiB/);
 const plan=planSave(p),parts=new Map(plan.parts.map(x=>[x.id,structuredClone(x.value)]));
 const restored=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(k=>parts.get(k)));
 assert.equal(hmaMetadata(restored,sourceId,source).raw,raw);
 validateProject(restored);
});
test('typed tables read/write signed, unsigned, pointers and ASCII with exact native little-endian source bytes',()=>{
 const source=syntheticROM(),p=newProject(),table={id:'aipom-key',name:'Original Aipom controls',address:0x680,stride:18,count:3,fields:[
 {name:'level',type:'u8',offset:0},{name:'growth',type:'s16',offset:1},{name:'flags',type:'u32',offset:3},{name:'ref',type:'ptr',offset:7},{name:'label',type:'ascii',offset:11,length:7}]};
 saveTableDefinition(p,sourceId,source,table);
 const pristine=source.slice(table.address,table.address+table.stride);
 assert.equal(tableDefinitions(p,sourceId,source).length,1);
 editTableField(p,sourceId,source,table,0,'level','0x64');
 editTableField(p,sourceId,source,table,0,'growth','-20');
 editTableField(p,sourceId,source,table,0,'flags','0xAABBCCDD');
 editTableField(p,sourceId,source,table,0,'ref','0x08000500');
 editTableField(p,sourceId,source,table,0,'label','Aipom');
 const row=tableRecord(p,sourceId,source,table,0);
 assert.equal(row.values.level,100);
 assert.equal(row.values.growth,-20);
 assert.equal(row.values.flags,0xAABBCCDD);
 assert.equal(row.values.ref,0x08000500);
 assert.equal(row.values.label,'Aipom');
 const out=new RomOutput(source);installROMHexEdits(p,sourceId,source,out);
 const dv=new DataView(out.bytes.buffer);
 assert.equal(out.bytes[0x680],100);
 assert.equal(dv.getInt16(0x681,true),-20);
 assert.equal(dv.getUint32(0x683,true),0xAABBCCDD);
 assert.equal(dv.getUint32(0x687,true),0x08000500);
 assert.deepEqual([...out.bytes.slice(0x68b,0x692)],[65,105,112,111,109,0,0]);
 assert.deepEqual(source.slice(table.address,table.address+table.stride),pristine);
 assert.throws(()=>editTableField(p,sourceId,source,table,0,'ref','0x09000500'),/valid 0x08/);
 assert.throws(()=>editTableField(p,sourceId,source,table,0,'label','É'),/printable ASCII/);
 assert.throws(()=>editTableField(p,sourceId,source,table,4,'level','1'),/out of range/);
});
test('unknown format, overlapping columns, bad table stride/count and invalid field lengths are never staged',()=>{
 const source=syntheticROM(),p=newProject(),before=JSON.stringify(p);
 const base={id:'unsafe',name:'Bad',address:0x600,stride:4,count:1,fields:[{name:'left',type:'u16',offset:0},{name:'right',type:'u32',offset:1}]};
 assert.throws(()=>validateTable(base,source.length),/Overlapping|Invalid/);
 assert.throws(()=>saveTableDefinition(p,sourceId,source,base));
 for(const row of [{...base,fields:[{name:'bad',type:'pokemon-text',offset:0}]},{...base,fields:[{name:'ok',type:'u16',offset:3}]},{...base,stride:0,fields:[{name:'ok',type:'u8',offset:0}]},{...base,count:100000,fields:[{name:'ok',type:'u8',offset:0}]}])
  assert.throws(()=>validateTable(row,source.length));
 assert.equal(JSON.stringify(p),before,'all invalid layouts leave project untouched');
});
