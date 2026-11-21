import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {stageROMHex,installROMHexEdits} from '../dist/native-hex-workspace.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {saveTableDefinition,tableRecord,previewTableCSV,importTableCSV,adjustTableColumn} from '../dist/hma-table-workspace.js';
const ID='c'.repeat(64),AT=0x7400;
function fixture(){
 const source=syntheticROM(),project=newProject(),table={id:'batch',name:'Native numeric records',address:AT,stride:8,count:8,fields:[{name:'level',type:'u8',offset:0},{name:'growth',type:'s16',offset:1},{name:'flag',type:'u32',offset:3}]};
 for(let i=0;i<8;i++){source[AT+i*8]=10+i;source[AT+i*8+1]=i+1;source[AT+i*8+7]=0xb1;}
 saveTableDefinition(project,ID,source,table);return{source,project,table};
}
test('CSV dry-run previews typed native results without touching project, ROM, or edit history',()=>{
 const {source,project,table}=fixture(),before=JSON.stringify(project),rom=source.slice();
 const csv='row,growth,level\r\n2,-10,77\r\n1,-8,64\r\n';
 const preview=previewTableCSV(project,ID,source,table,csv);
 assert.equal(preview.records,2);assert.equal(preview.cells,4);
 assert.equal(preview.changedRows,2);assert.ok(preview.changedBytes>0);
 assert.deepEqual(preview.samples.map(x=>x.row),[1,2]);
 assert.equal(preview.samples[0].before.level,11);assert.equal(preview.samples[0].after.level,64);
 assert.equal(preview.samples[1].after.growth,-10);
 assert.equal(JSON.stringify(project),before);assert.deepEqual(source,rom);
 const applied=importTableCSV(project,ID,source,table,csv);
 assert.equal(applied.records,preview.records);
 assert.equal(tableRecord(project,ID,source,table,1).values.level,64);
 const out=new RomOutput(source);installROMHexEdits(project,ID,source,out);
 assert.equal(out.bytes[AT+8],64);assert.deepEqual(source,rom);
});
test('invalid CSV previews and existing staged edits cannot produce partial changes',()=>{
 const {source,project,table}=fixture();
 stageROMHex(project,ID,source,AT,Uint8Array.of(12));
 const before=JSON.stringify(project);
 for(const csv of ['row,level\n1,20\n2,256\n','row,unknown\n1,2\n','row,flag\n1,4294967296\n','row,level\n1,12\n1,14\n']){
  assert.throws(()=>previewTableCSV(project,ID,source,table,csv));
  assert.equal(JSON.stringify(project),before);
 }
 assert.equal(previewTableCSV(project,ID,source,table,'row,level\n0,12\n').changedBytes,0);
 assert.equal(JSON.stringify(project),before);
});
test('atomic signed arithmetic operates on staged values, preserves padding and survives split saves',()=>{
 const {source,project,table}=fixture(),before=source.slice();
 stageROMHex(project,ID,source,AT,Uint8Array.of(20));
 assert.equal(adjustTableColumn(project,ID,source,table,'level',0,2,'-3').rows,3);
 assert.equal(tableRecord(project,ID,source,table,0).values.level,17);
 assert.equal(tableRecord(project,ID,source,table,2).values.level,9);
 const saved=JSON.stringify(project);
 assert.throws(()=>adjustTableColumn(project,ID,source,table,'level',0,7,'300'),/u8/);
 assert.equal(JSON.stringify(project),saved);
 adjustTableColumn(project,ID,source,table,'growth',0,7,'-4');
 assert.equal(tableRecord(project,ID,source,table,7).values.growth,4);
 const out=new RomOutput(source);installROMHexEdits(project,ID,source,out);
 for(let row=0;row<8;row++)assert.equal(out.bytes[AT+row*8+7],0xb1);
 assert.deepEqual(source,before);
 const save=planSave(project),part=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>part.get(k)));
 validateProject(reopened);assert.equal(tableRecord(reopened,ID,source,table,0).values.level,17);
});
test('unbounded row ranges, pointer arithmetic and non-integer deltas are rejected atomically',()=>{
 const {source,project,table}=fixture(),prior=JSON.stringify(project);
 for(const fn of [
  ()=>adjustTableColumn(project,ID,source,table,'level',0,8,1),
  ()=>adjustTableColumn(project,ID,source,table,'level',-1,2,1),
  ()=>adjustTableColumn(project,ID,source,table,'level',0,2,''),
  ()=>adjustTableColumn(project,ID,source,table,'level',0,2,1.5),
  ()=>adjustTableColumn(project,ID,source,table,'missing',0,2,1)
 ]){assert.throws(fn);assert.equal(JSON.stringify(project),prior);}
});
test('touch table UI requires review before CSV staging and allows signed column deltas',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const name of ['hmaTableCSVPreview','hmaTableCSVApply','previewTableCSV(','Stage reviewed CSV','hmaBulkAdjust','hmaAdjustDelta','adjustTableColumn('])assert.ok(ui.includes(name),name);
});
