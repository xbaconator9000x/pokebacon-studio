import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {installROMHexEdits,stageROMHex} from '../dist/native-hex-workspace.js';
import {parseHMAToml,saveTableDefinition,fixedNumericHMATable,tableRecord,editTableField,replaceTableColumnMatches} from '../dist/hma-table-workspace.js';
import {pointerAt} from '../dist/hma-pointer-navigation.js';
const ID='f'.repeat(64),AT=0x7800,BASE=0x08000000;
const original={name:'data.pokemon.names',at:0x8000,format:'[name""11]4'};
const anchor={name:'data.custom.entries',at:AT,format:'[offset:|z flags:|h script<>]data.pokemon.names+2'};
function fixture(){
 const source=syntheticROM(),project=newProject(),table=fixedNumericHMATable(anchor,source.length,{anchors:[original,anchor]});
 assert.ok(table);
 saveTableDefinition(project,ID,source,table);
 return {source,project,table};
}
test('HMA numeric hex/signed modifiers, pointer fields and matched literal row count become source-bound layouts',()=>{
 const {source,project,table}=fixture(),before=source.slice();
 assert.deepEqual(table.fields,[{name:'offset',type:'s16',offset:0},{name:'flags',type:'u16',offset:2,display:'hex'},{name:'script',type:'ptr',offset:4}]);
 assert.equal(table.stride,8);assert.equal(table.count,6);
 assert.deepEqual(table.linkedLength,{anchor:'data.pokemon.names',delta:2,verifiedBaseCount:4});
 editTableField(project,ID,source,table,0,'offset','-77');
 editTableField(project,ID,source,table,0,'flags','0xABCD');
 editTableField(project,ID,source,table,0,'script','0x08000900');
 assert.deepEqual(tableRecord(project,ID,source,table,0).values,{offset:-77,flags:0xABCD,script:BASE+0x900});
 assert.equal(pointerAt(project,ID,source,AT+4).at,0x900);
 const output=new RomOutput(source);installROMHexEdits(project,ID,source,output);
 const dv=new DataView(output.bytes.buffer);
 assert.equal(dv.getInt16(AT,true),-77);assert.equal(dv.getUint16(AT+2,true),0xABCD);assert.equal(dv.getUint32(AT+4,true),BASE+0x900);
 assert.deepEqual(source,before);
 const plan=planSave(project),part=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(k=>part.get(k)));
 validateProject(reopened);assert.equal(reopened.hexStudio.sources[ID].tables[0].linkedLength.anchor,'data.pokemon.names');
});
test('unsupported or ambiguous HMA formats cannot silently become editable layouts',()=>{
 const source=syntheticROM();
 const formats=['[x.]missing.anchor','[x.]data.pokemon.names+99','[x.]data.pokemon.names-99','[x.]data.pokemon.names+4000','[x.]data.pokemon.names+abc','[x.]other.dynamic','[description<"">]4','[sprite<\`lzs4x8x8\`>]4','[flags.|t|on:|off:]4','[flags:|foo]4','[script<\`xse\`>]4','[flags:|h flags::]4','[value.]!0000'];
 for(const fmt of formats)assert.equal(fixedNumericHMATable({...anchor,format:fmt},source.length,{anchors:[original,anchor]}),null,fmt);
 assert.equal(fixedNumericHMATable({...anchor,format:'[value.]data.pokemon.names'},source.length,{anchors:[original,{...original}]}),null,'ambiguous length anchor');
 assert.equal(fixedNumericHMATable({...anchor,format:'[value.]data.pokemon.names'},source.length,{anchors:[{...original,format:'[name<>]other.dynamic'}]}),null);
 assert.equal(fixedNumericHMATable({...anchor,format:'[script<>]4'},source.length)?.fields[0].type,'ptr');
 assert.equal(fixedNumericHMATable({...anchor,format:'[offset:|z]4'},source.length)?.fields[0].type,'s16');
});
test('strict exact typed find-and-replace changes staged values and retains uninterpreted bytes',()=>{
 const {source,project,table}=fixture(),originalSource=source.slice();
 for(let row=0;row<6;row++)source[AT+row*8+2]=row%2?1:2;
 const snapshot=source.slice();
 stageROMHex(project,ID,source,AT+1*8+2,Uint8Array.of(2));
 const report=replaceTableColumnMatches(project,ID,source,table,'flags','2','0xAA',{start:0,end:5});
 assert.equal(report.matches,4);
 for(let row=0;row<6;row++)assert.equal(tableRecord(project,ID,source,table,row).values.flags,row===3||row===5?1:0xAA);
 const out=new RomOutput(source);installROMHexEdits(project,ID,source,out);
 for(let row=0;row<6;row++)assert.equal(out.bytes[AT+row*8+2],row===3||row===5?1:0xAA);
 assert.deepEqual(source,snapshot);assert.notDeepEqual(originalSource,snapshot);
});
test('late invalid replacement, no matches, staged comparisons and >256 matches remain atomic',()=>{
 const {source,project,table}=fixture();
 editTableField(project,ID,source,table,0,'offset','-50');
 const saved=JSON.stringify(project);
 assert.throws(()=>replaceTableColumnMatches(project,ID,source,table,'script','0','0x09000900'),/Pointer/);
 assert.throws(()=>replaceTableColumnMatches(project,ID,source,table,'offset','0','-99999'),/s16/);
 assert.throws(()=>replaceTableColumnMatches(project,ID,source,table,'missing','0','1'),/column/);
 assert.equal(JSON.stringify(project),saved);
 assert.equal(replaceTableColumnMatches(project,ID,source,table,'offset','-50','-50').matches,1);
 assert.equal(JSON.stringify(project),saved);
 assert.equal(replaceTableColumnMatches(project,ID,source,table,'offset','-100','-90').matches,0);
 assert.equal(JSON.stringify(project),saved);
 const huge={...table,count:300};for(let row=0;row<300;row++){source[AT+row*8]=0;source[AT+row*8+1]=0;}
 assert.throws(()=>replaceTableColumnMatches(project,ID,source,huge,'offset','0','1'),/More than 256/);
 assert.equal(JSON.stringify(project),saved);
});
test('HMA metadata parser and phone UI expose linked typed imports, exact replace and row jump',()=>{
 const toml=['[[NamedAnchors]]',"Name = '''data.pokemon.names'''","Address = 0x008000","Format = '''[name\"\"11]4'''",'[[NamedAnchors]]',"Name = '''data.custom.entries'''","Address = 0x007800","Format = '''[offset:|z flags:|h script<>]data.pokemon.names+2'''"].join('\n');
 const parsed=parseHMAToml(toml,{romLength:syntheticROM().length});
 assert.equal(parsed.anchors.length,2);
 assert.equal(fixedNumericHMATable(parsed.anchors[1],0x200000,{anchors:parsed.anchors})?.count,6);
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const label of ['hmaBulkReplace','hmaReplaceOld','hmaReplaceNew','hmaGoRow','hmaJumpRow','replaceTableColumnMatches(','anchors:meta.anchors','Import typed table'])assert.ok(ui.includes(label),label);
});
