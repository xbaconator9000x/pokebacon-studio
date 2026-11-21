import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {installROMHexEdits} from '../dist/native-hex-workspace.js';
import {parseHMAToml,importHMAToml,hmaMetadata,hmaListLabels,validateTable,saveTableDefinition,tableDefinitions,tableRecord,editTableField,renameHMATomlNumericLabel,renameHMATomlNumericLabels} from '../dist/hma-table-workspace.js';
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

test('HMA TOML inline comments preserve quoted hashes and recognize strict native addresses',()=>{
 const raw=[
  '[[NamedAnchors]]',"Name = '''literal''' # comment",'Address = 0x000680 # native offset',"Format = '''[value::]2 # inside''' # comment",
  '[[OffsetPointer]]','Address = 0x000304 # pointer site','Offset = -8 # delta'
 ].join('\n');
 const meta=parseHMAToml(raw,{romLength:0x1000});
 assert.equal(meta.anchors.length,1);
 assert.equal(meta.anchors[0].name,'literal');
 assert.equal(meta.anchors[0].format,'[value::]2 # inside');
 assert.equal(meta.anchors[0].at,0x680);
 assert.equal(meta.offsetPointers.length,1);
 assert.equal(meta.offsetPointers[0].offset,-8);
 assert.equal(meta.raw,raw);
});
test('HMA duplicate native keys and coercible non-integer addresses fail closed',()=>{
 for(const bad of ['','true','1e3','0xGG','0.5','0x100junk']){
  const meta=parseHMAToml(['[[NamedAnchors]]',"Name = '''unsafe'''",'Address = '+bad,"Format = '''[value::]2'''"].join('\n'),{romLength:0x1000});
  assert.equal(meta.anchors.length,0,bad);
 }
 const raw=['[[NamedAnchors]]',"Name = '''first'''","Name = '''second'''",'Address = 0x680',"Format = '''[value::]2'''",'[[OffsetPointer]]','Address = 0x300','Address = 0x304','Offset = 4'].join('\n');
 const meta=parseHMAToml(raw,{romLength:0x1000});
 assert.equal(meta.anchors.length,0);
 assert.equal(meta.offsetPointers.length,0);
 assert.match(meta.warnings.join(' '),/Duplicate HMA TOML key/);
 assert.equal(meta.raw,raw);
});

test('HMA numeric label lists decode standard TOML arrays without accepting malformed native labels',()=>{
 const rom=syntheticROM(),p=newProject(),id='7'.repeat(64);
 const set=entry=>importHMAToml(p,id,rom,['[[List]]',"Name = '''native.labels'''",'0 = '+entry].join('\n'));
 set('["Alpha", "Beta", "Gamma"]');
 assert.deepEqual(hmaListLabels(p,id,rom,'native.labels').map(x=>x.label),['Alpha','Beta','Gamma']);
 set("['Literal', 'Second']");
 assert.deepEqual(hmaListLabels(p,id,rom,'native.labels').map(x=>x.label),['Literal','Second']);
 set('["A\\tB", "C"]');
 assert.throws(()=>hmaListLabels(p,id,rom,'native.labels'),/Invalid, overlapping/);
 for(const malformed of ['["A" "B"]','["A", 7]','["A", "B" garbage]','["A", "unterminated]','["A\\q"]']){
  set(malformed);
  assert.throws(()=>hmaListLabels(p,id,rom,'native.labels'),/HMA|TOML|Incomplete/);
 }
});

test('HMA multiline numeric labels retain quoted hashes and refuse duplicate native keys after save/reopen',()=>{
 const rom=syntheticROM(),p=newProject(),id='8'.repeat(64);
 const set=rows=>importHMAToml(p,id,rom,['[[List]]',"Name = '''native.multiline'''",...rows].join('\n'));
 set(['0 = [',' "A#literal", # comment',' "B", # comment','] # comment']);
 assert.deepEqual(hmaListLabels(p,id,rom,'native.multiline').map(x=>x.label),['A#literal','B']);
 const plan=planSave(p),parts=new Map(plan.parts.map(x=>[x.id,structuredClone(x.value)]));
 const restored=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(k=>parts.get(k)));
 assert.deepEqual(hmaListLabels(restored,id,rom,'native.multiline').map(x=>x.label),['A#literal','B']);
 set(['0 = ["A"]','0 = ["B"]']);
 assert.throws(()=>hmaListLabels(p,id,rom,'native.multiline'),/duplicate TOML keys/);
 set(['0 = ["A"]','1 = ["B"]']);
 assert.deepEqual(hmaListLabels(p,id,rom,'native.multiline').map(x=>x.label),['A','B']);
});

test('multiline HMA arrays respect quoted brackets, comments and inline closing brackets across save/reopen',()=>{
 const source=syntheticROM(),p=newProject();
 const raw= ['[[List]]', "Name = 'brackets'", '0 = ["A]#", # outside', ' "B", "C["] # end', '[[NamedAnchors]]', "Name = 'following'", 'Address = 0x680', "Format = '[value.]3'"].join('\n');
 importHMAToml(p,sourceId,source,raw);
 const plan=planSave(p),parts=new Map(plan.parts.map(x=>[x.id,structuredClone(x.value)]));
 const restored=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(k=>parts.get(k)));
 assert.deepEqual(hmaListLabels(restored,sourceId,source,'brackets'),[{value:0,label:'A]#'},{value:1,label:'B'},{value:2,label:'C['}]);
 assert.equal(hmaMetadata(restored,sourceId,source).anchors[0].name,'following');
 assert.equal(hmaMetadata(restored,sourceId,source).raw,raw);
 const broken="[[List]]\nName = 'broken'\n0 = ['A'\n[[NamedAnchors]]\nName = 'fake'\nAddress = 0x680\nFormat = '[value.]3'";
 importHMAToml(p,sourceId,source,broken);
 assert.equal(hmaMetadata(p,sourceId,source).anchors.length,0);
 assert.throws(()=>hmaListLabels(p,sourceId,source,'broken'));
});

test('HMA standalone numeric label writeback survives split save and preserves source and TOML',()=>{
 const source=syntheticROM(),project=newProject(),original=source.slice();
 const raw="[[List]]\r\nName = 'weather'\r\n0 = 'Clear' # keep\r\n7 = 'Rain'\r\n[[NamedAnchors]]\r\nName = 'native'\r\nAddress = 0x680\r\nFormat = '[value.]3'";
 importHMAToml(project,sourceId,source,raw);
 assert.deepEqual(renameHMATomlNumericLabel(project,sourceId,source,'weather',7,'Snow'),{code:7,label:'Snow'});
 assert.equal(hmaMetadata(project,sourceId,source).raw,raw.replace("7 = 'Rain'","7 = 'Snow'"));
 const saved=planSave(project),parts=new Map(saved.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(saved.header),savedProjectKeys(saved.header).map(k=>parts.get(k)));
 assert.deepEqual(hmaListLabels(restored,sourceId,source,'weather'),[{value:0,label:'Clear'},{value:7,label:'Snow'}]);
 assert.deepEqual(source,original);
 assert.throws(()=>renameHMATomlNumericLabel(restored,sourceId,source,'weather',8,'Invalid'));
 assert.deepEqual(renameHMATomlNumericLabel(restored,sourceId,source,'weather',7,"O'Reilly"),{code:7,label:"O'Reilly"});
 assert.match(hmaMetadata(restored,sourceId,source).raw,/7 = "O'Reilly"/);
 assert.deepEqual(renameHMATomlNumericLabel(restored,sourceId,source,'weather',7,'Snow "Day"'),{code:7,label:'Snow "Day"'});
 assert.match(hmaMetadata(restored,sourceId,source).raw,/7 = 'Snow "Day"'/);
 assert.throws(()=>renameHMATomlNumericLabel(restored,sourceId,source,'weather',7,`Both ' and "`),/both TOML quote delimiters/);
 const unchanged=hmaMetadata(restored,sourceId,source).raw;
 assert.throws(()=>renameHMATomlNumericLabel(restored,sourceId,source,'weather',7,'Bad\nlabel'),/Invalid HMA numeric label/);
 assert.equal(hmaMetadata(restored,sourceId,source).raw,unchanged,'rejected edits must not mutate saved metadata');
 assert.deepEqual(hmaListLabels(restored,sourceId,source,'weather').map(x=>x.label),['Clear','Snow "Day"']);
});

test('atomic multi-list HMA label writeback survives split save and rolls back failures',()=>{
 const source=syntheticROM(),p=newProject();
 importHMAToml(p,sourceId,source,["[[List]]","Name = 'weather'","0 = 'Clear' # keep","7 = 'Rain'","[[List]]","Name = 'terrain'","1 = 'Grass'"].join('\n'));
 assert.deepEqual(renameHMATomlNumericLabels(p,sourceId,source,[{listName:'weather',code:7,label:'Snow'},{listName:'terrain',code:1,label:'Rock'}]),{updated:2});
 const changed=hmaMetadata(p,sourceId,source).raw;
 const saved=planSave(p),parts=new Map(saved.parts.map(x=>[x.id,structuredClone(x.value)]));
 const reopened=assembleSavedProject(structuredClone(saved.header),savedProjectKeys(saved.header).map(k=>parts.get(k)));
 assert.deepEqual(hmaListLabels(reopened,sourceId,source,'weather').map(x=>x.label),['Clear','Snow']);
 assert.deepEqual(hmaListLabels(reopened,sourceId,source,'terrain').map(x=>x.label),['Rock']);
 for(const edits of [[{listName:'weather',code:0,label:'Sunny'},{listName:'terrain',code:999,label:'Missing'}],[{listName:'weather',code:7,label:'Ice'},{listName:'weather',code:7,label:'Again'}],[{listName:'weather',code:7,label:'Ice'},{listName:'terrain',code:1,label:'Bad\nlabel'}]]){
  assert.throws(()=>renameHMATomlNumericLabels(reopened,sourceId,source,edits));
  assert.equal(hmaMetadata(reopened,sourceId,source).raw,changed);
 }
 assert.throws(()=>renameHMATomlNumericLabels(reopened,sourceId,source,[]));
});

test('atomic HMA quote switching survives split save and retains comments',()=>{
 const rom=syntheticROM(),original=rom.slice(),p=newProject();
 importHMAToml(p,sourceId,rom,["[[List]]","Name = 'weather'","0 = 'Clear' # keep","7 = 'Rain'","[[List]]","Name = 'terrain'","1 = \"Rock\" # keep"].join('\r\n'));
 assert.deepEqual(renameHMATomlNumericLabels(p,sourceId,rom,[{listName:'weather',code:0,label:"O'Reilly"},{listName:'terrain',code:1,label:'Rock "Face"'}]),{updated:2});
 const raw=hmaMetadata(p,sourceId,rom).raw;
 assert.match(raw,/0 = "O'Reilly" # keep/);
 assert.match(raw,/1 = 'Rock "Face"' # keep/);
 assert.ok(raw.includes('\r\n'));
 const save=planSave(p),parts=new Map(save.parts.map(x=>[x.id,structuredClone(x.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 assert.equal(hmaMetadata(reopened,sourceId,rom).raw,raw);
 assert.deepEqual(hmaListLabels(reopened,sourceId,rom,'weather'),[{value:0,label:"O'Reilly"},{value:7,label:'Rain'}]);
 const unchanged=hmaMetadata(reopened,sourceId,rom).raw;
 assert.throws(()=>renameHMATomlNumericLabels(reopened,sourceId,rom,[{listName:'weather',code:7,label:'Sunny'},{listName:'terrain',code:1,label:`Both ' and "`}]),/both TOML quote delimiters/);
 assert.equal(hmaMetadata(reopened,sourceId,rom).raw,unchanged);
 assert.deepEqual(rom,original);
});
