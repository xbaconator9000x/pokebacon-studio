import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {installROMHexEdits} from '../dist/native-hex-workspace.js';
import {planSave,assembleSavedProject,savedProjectKeys} from '../dist/project-store.js';
import {parseHMAToml,importHMAToml,hmaListLabels,bindTableEnumList,saveTableDefinition,tableDefinitions,tableRecord,editTableField,renameHMATomlNumericLabel} from '../dist/hma-table-workspace.js';
const ID='a'.repeat(64),AT=0x7200;
const TOML=['[[List]]',"Name = '''battle.weather'''",'0 = [',"  '''Clear''',","  '''Rain''',","  '''Hail''',",']',"7 = '''Harsh sunlight'''",'[[List]]',"Name = '''battle.weather.rare'''",'10 = [',"  '''Overcast''',","  '''Fog''',",']'].join('\n');
function scenario(){
 const source=syntheticROM(),project=newProject(),table={id:'native-weather',name:'Native weather table',address:AT,stride:8,count:3,fields:[{name:'weather',type:'u8',offset:0},{name:'counter',type:'u16',offset:1},{name:'pointer',type:'ptr',offset:3}]};
 saveTableDefinition(project,ID,source,table);return {source,project,table};
}
test('multiline HMA named lists preserve source TOML and decode bounded numeric labels',()=>{
 const {source,project}=scenario(),meta=parseHMAToml(TOML,{romLength:source.length});
 assert.equal(meta.raw,TOML);assert.equal(meta.lists.length,2);
 importHMAToml(project,ID,source,TOML);
 assert.deepEqual(hmaListLabels(project,ID,source,'battle.weather'),[{value:0,label:'Clear'},{value:1,label:'Rain'},{value:2,label:'Hail'},{value:7,label:'Harsh sunlight'}]);
 assert.deepEqual(hmaListLabels(project,ID,source,'battle.weather.rare'),[{value:10,label:'Overcast'},{value:11,label:'Fog'}]);
});
test('label bindings survive split project saves, stage only native numeric values and can be cleared',()=>{
 const {source,project,table}=scenario(),before=source.slice();
 importHMAToml(project,ID,source,TOML);
 bindTableEnumList(project,ID,source,table,'weather','battle.weather');
 const labelled=tableDefinitions(project,ID,source)[0];assert.equal(labelled.fields[0].enumList,'battle.weather');
 editTableField(project,ID,source,labelled,0,'weather','7');
 const output=new RomOutput(source);installROMHexEdits(project,ID,source,output);
 assert.equal(output.bytes[AT],7);assert.deepEqual(source,before);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(restored);
 assert.equal(tableDefinitions(restored,ID,source)[0].fields[0].enumList,'battle.weather');
 assert.equal(tableRecord(restored,ID,source,labelled,0).values.weather,7);
 bindTableEnumList(restored,ID,source,labelled,'weather','');
 assert.equal(tableDefinitions(restored,ID,source)[0].fields[0].enumList,undefined);
});
test('duplicate, overlapping, incomplete and invalid lists cannot mutate tables',()=>{
 const {source,project,table}=scenario();
 const rejects=[
  TOML+'\n'+TOML,
  ['[[List]]',"Name = '''battle.weather'''",'0 = [',"  '''Zero''',","  '''One''',",']',"1 = '''Overlap'''"].join('\n'),
  ['[[List]]',"Name = '''battle.weather'''",'0 = [',"  '''Zero''',",']','1 = [',"  '''Unclosed'''"].join('\n'),
  ['[[List]]',"Name = '''battle.weather'''",'0 = [',"  '''Zero''',","  potato,",']'].join('\n')
 ];
 for(const raw of rejects){
  importHMAToml(project,ID,source,raw);const before=JSON.stringify(project);
  assert.throws(()=>hmaListLabels(project,ID,source,'battle.weather'));
  assert.throws(()=>bindTableEnumList(project,ID,source,table,'weather','battle.weather'));
  assert.equal(JSON.stringify(project),before);
 }
 importHMAToml(project,ID,source,TOML);const before=JSON.stringify(project);
 for(const field of ['pointer','missing'])assert.throws(()=>bindTableEnumList(project,ID,source,table,field,'battle.weather'),/unsigned/);
 assert.throws(()=>bindTableEnumList(project,ID,source,table,'weather','missing'),/missing|ambiguous/);
 assert.equal(JSON.stringify(project),before);
});

test('nonzero HMA numeric keys preserve literal and triple-quoted labels through split save',()=>{
 const {source,project}=scenario();
 const raw=["[[List]]","Name = 'weather.extra'","7 = 'Rain'","10 = '''Overcast'''",'12 = "Snow"'].join('\n');
 importHMAToml(project,ID,source,raw);
 const expected=[{value:7,label:'Rain'},{value:10,label:'Overcast'},{value:12,label:'Snow'}];
 assert.deepEqual(hmaListLabels(project,ID,source,'weather.extra'),expected);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 assert.deepEqual(hmaListLabels(reopened,ID,source,'weather.extra'),expected);
 assert.equal(parseHMAToml(raw,{romLength:source.length}).raw,raw);
});

test('HMA scalar and array labels decode TOML escapes consistently',()=>{
 const {source,project}=scenario();
 // Keep backslashes in the TOML input; JavaScript must not pre-decode them.
 // Numeric HMA labels intentionally allow printable ASCII only.
 const raw=['[[List]]',"Name = '''escaped.labels'''",'0 = "Hex\\u0041"','4 = ["Hex\\U00000042", "Quote\\"End"]'].join('\n');
 importHMAToml(project,ID,source,raw);
 const expected=[
  {value:0,label:'HexA'},{value:4,label:'HexB'},{value:5,label:'Quote"End'}
 ];
 assert.deepEqual(hmaListLabels(project,ID,source,'escaped.labels'),expected);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.deepEqual(hmaListLabels(reopened,ID,source,'escaped.labels'),expected);
 for(const invalid of ['\\uD800','\\U00110000','\\u12G4','\\q']){
  const broken=['[[List]]',"Name = '''invalid.labels'''",'0 = "Bad'+invalid+'"'].join('\n');
  importHMAToml(project,ID,source,broken);
  assert.throws(()=>hmaListLabels(project,ID,source,'invalid.labels'));
 }
});

test('HMA TOML rejects unsafe rounded addresses and offset-pointer deltas',()=>{
 const source=syntheticROM();
 const raw=[
  '[[NamedAnchors]]',"Name = 'safe.anchor'",'Address = 0x7200',"Format = '[value.]1'",
  '[[NamedAnchors]]',"Name = 'rounded.hex'",'Address = 0x20000000000001',"Format = '[value.]1'",
  '[[NamedAnchors]]',"Name = 'rounded.dec'",'Address = 9007199254740993',"Format = '[value.]1'",
  '[[OffsetPointer]]','Address = 0x7204','Offset = 9007199254740993',
  '[[OffsetPointer]]','Address = 0x7208','Offset = 0x20000000000001',
  '[[OffsetPointer]]','Address = 0x720c','Offset = -8'
 ].join('\n');
 const parsed=parseHMAToml(raw,{romLength:source.length});
 assert.deepEqual(parsed.anchors.map(x=>x.name),['safe.anchor']);
 assert.deepEqual(parsed.offsetPointers.map(x=>({at:x.at,offset:x.offset})),[{at:0x720c,offset:-8}]);
 assert.equal(parsed.warnings.length,4);
 const {project}=scenario();
 importHMAToml(project,ID,source,raw);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.deepEqual(parseHMAToml(reopened.hexStudio.sources[ID].hmaToml,{romLength:source.length}).offsetPointers.map(x=>x.offset),[-8]);
});


test('multiline basic TOML array labels decode escaped quotes, slashes and Unicode across saved projects',()=>{
 const {source,project}=scenario();
 const raw=[
  '[[List]]',
  "Name = 'escaped.multiline'",
  '0 = [',
  '  """Quote: \\"ok\\"""",',
  '  """Slash: \\\\ path""",',
  '  """Unicode: \\u0041 and \\U00000042"""',
  ']'
 ].join('\n');
 importHMAToml(project,ID,source,raw);
 const expected=[
  {value:0,label:'Quote: "ok"'},
  {value:1,label:'Slash: \\ path'},
  {value:2,label:'Unicode: A and B'}
 ];
 assert.deepEqual(hmaListLabels(project,ID,source,'escaped.multiline'),expected);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.equal(reopened.hexStudio.sources[ID].hmaToml,raw);
 assert.deepEqual(hmaListLabels(reopened,ID,source,'escaped.multiline'),expected);
 const malformed=raw.replace('\\u0041','\\uD800');
 importHMAToml(reopened,ID,source,malformed);
 assert.throws(()=>hmaListLabels(reopened,ID,source,'escaped.multiline'),/Unicode/);
});

test('HMA multiline TOML basic labels fold escaped newline and preserve split saves',()=>{
 const {source,project}=scenario();
 const raw=['[[List]]',"Name = 'folded.labels'",'0 = [','  """','First\\','   Second""",','  """','Alpha\\','    ','    Beta""",','  """One\\u0041"""',']'].join('\n');
 importHMAToml(project,ID,source,raw);
 const expected=[{value:0,label:'FirstSecond'},{value:1,label:'AlphaBeta'},{value:2,label:'OneA'}];
 assert.deepEqual(hmaListLabels(project,ID,source,'folded.labels'),expected);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.equal(reopened.hexStudio.sources[ID].hmaToml,raw);
 assert.deepEqual(hmaListLabels(reopened,ID,source,'folded.labels'),expected);
});


test('ordinary HMA TOML array labels reject physical newlines and preserve original bytes',()=>{
 const {source,project}=scenario(),before=source.slice();
 for(const quote of ['"',"'"]){
  const raw=['[[List]]',"Name = 'broken.newline'",'0 = [','  '+quote+'First','Second'+quote+',','  '+quote+'Next'+quote,']'].join('\n');
  importHMAToml(project,ID,source,raw);
  assert.throws(()=>hmaListLabels(project,ID,source,'broken.newline'),/newline/);
  assert.deepEqual(source,before);
 }
});

test('native typed cells reject coercive numbers atomically across save and export',()=>{
 const {source,project,table}=scenario(),original=source.slice(),before=JSON.stringify(project);
 for(const invalid of ['', ' ', '1e2', '0b11', '0o7', '01', 'Infinity', 'true', '9007199254740993']){
  assert.throws(()=>editTableField(project,ID,source,table,0,'counter',invalid),/integer|value/i);
  assert.equal(JSON.stringify(project),before);
 }
 assert.throws(()=>editTableField(project,ID,source,table,0,'counter',true),/value/i);
 editTableField(project,ID,source,table,0,'counter','0x1234');
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.equal(tableRecord(reopened,ID,source,table,0).values.counter,0x1234);
 const output=new RomOutput(source);installROMHexEdits(reopened,ID,source,output);
 assert.equal(output.bytes[AT+1],0x34);assert.equal(output.bytes[AT+2],0x12);
 assert.deepEqual(source,original);
});

test('standalone triple-quoted HMA label rename persists and preserves native bytes',()=>{
 const {source,project}=scenario(),original=source.slice();
 const raw=['[[List]]',"Name = 'triple.test'",'7 = """Sun""" # comment',"8 = '''Fog'''"].join('\n');
 importHMAToml(project,ID,source,raw);
 renameHMATomlNumericLabel(project,ID,source,'triple.test',7,'Bright');
 renameHMATomlNumericLabel(project,ID,source,'triple.test',8,'Mist');
 assert.match(project.hexStudio.sources[ID].hmaToml,/7 = """Bright""" # comment/);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.deepEqual(hmaListLabels(reopened,ID,source,'triple.test'),[{value:7,label:'Bright'},{value:8,label:'Mist'}]);
 const output=new RomOutput(source);installROMHexEdits(reopened,ID,source,output);
 assert.deepEqual(output.bytes,original);assert.deepEqual(source,original);
});
