import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {exportTableCSV,importTableCSV,saveTableDefinition,tableRecord} from '../dist/hma-table-workspace.js';
import {stageROMHex,installROMHexEdits} from '../dist/native-hex-workspace.js';
import {RomOutput} from '../dist/rom-writer.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
const ID='e'.repeat(64),AT=0x7700;
function fixture(){
 const source=syntheticROM(),project=newProject(),table={id:'csv',name:'Source table',address:AT,stride:13,count:8,fields:[
  {name:'level',type:'u8',offset:0},{name:'growth',type:'s16',offset:1},
  {name:'link',type:'ptr',offset:3},{name:'label',type:'ascii',offset:7,length:5}
 ]};
 saveTableDefinition(project,ID,source,table);
 for(let i=0;i<8;i++)source[AT+13*i+12]=0x90+i;
 return{source,project,table};
}
test('CSV export encodes staged typed edits, source row IDs and quoted ASCII correctly',()=>{
 const {source,project,table}=fixture();
 stageROMHex(project,ID,source,AT+7,Uint8Array.of(65,44,34,66,0)); // A,"B
 let csv=exportTableCSV(project,ID,source,table,{start:0,end:0});
 assert.equal(csv.split('\r\n')[0],'row,level,growth,link,label');
 assert.ok(csv.includes('"A,""B"'));
 assert.throws(()=>exportTableCSV(project,ID,source,table,{start:-1,end:2}),/range/);
 assert.throws(()=>exportTableCSV(project,ID,source,table,{start:2,end:9}),/range/);
});
test('CSV import supports reordered subsets, decimal/hex numbers, pointer validation and atomic writer export',()=>{
 const {source,project,table}=fixture(),original=source.slice();
 const input='row,label,link,level,growth\r\n3,"A,""B",0x08000500,99,-20\r\n1,Door,0x00000000,0x3A,200\r\n';
 const result=importTableCSV(project,ID,source,table,input);
 assert.equal(result.records,2);assert.equal(result.cells,8);
 assert.deepEqual(tableRecord(project,ID,source,table,3).values,{level:99,growth:-20,link:0x08000500,label:'A,"B'});
 assert.equal(tableRecord(project,ID,source,table,1).values.level,58);
 const out=new RomOutput(source);installROMHexEdits(project,ID,source,out);
 assert.equal(out.bytes[AT+3*13],99);
 assert.deepEqual(source,original);
 const csv=exportTableCSV(project,ID,source,table,{start:3,end:3});
 const second=newProject();saveTableDefinition(second,ID,source,table);
 const back=importTableCSV(second,ID,source,table,csv);
 assert.equal(back.records,1);
 assert.deepEqual(tableRecord(second,ID,source,table,3).values,tableRecord(project,ID,source,table,3).values);
});
test('CSV malformed headers, quoting, duplicate/missing rows, numeric overflow and rogue fields cannot stage anything',()=>{
 const {source,project,table}=fixture();
 const before=JSON.stringify(project);
 const rejects=[
  'row,unknown\n1,9\n',
  'row,level,level\n1,2,3\n',
  'index,level\n1,2\n',
  'row,level\n1,2\n1,4\n',
  'row,level\n100,5\n',
  'row,level\n1,999\n',
  'row,link\n1,0x09007000\n',
  'row,level\n1,"unterminated',
  'row,label\n1,"quote"oops\n',
  'row,level,link\n1,7\n',
  'row,level\nnot-a-row,5\n',
  'row,level\n',
  'row,level\n1,5\n'.repeat(257)
 ];
 for(const text of rejects){assert.throws(()=>importTableCSV(project,ID,source,table,text),undefined,text);assert.equal(JSON.stringify(project),before,'partial CSV writes on '+text.slice(0,30));}
});
test('failed late CSV row value leaves prior edits untouched; split save/reopen retains successful import',()=>{
 const {source,project,table}=fixture();
 importTableCSV(project,ID,source,table,'row,level\n1,44\n');
 const prior=JSON.stringify(project);
 assert.throws(()=>importTableCSV(project,ID,source,table,'row,level\n1,55\n2,99\n3,not-a-number\n'));
 assert.equal(JSON.stringify(project),prior);
 const save=planSave(project),parts=new Map(save.parts.map(x=>[x.id,structuredClone(x.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.equal(tableRecord(reopened,ID,source,table,1).values.level,44);
});
test('phone UI integrates table CSV export and asynchronous validated import',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const name of ['hmaExportTableCSV','hmaImportTableCSV','hmaTableCSVFile','hmaTableCSVStage','exportTableCSV(','importTableCSV(','file.text()'])assert.ok(ui.includes(name),name);
});
