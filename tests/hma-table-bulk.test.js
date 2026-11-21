import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {RomOutput} from '../dist/rom-writer.js';
import {GbaMaps} from '../dist/rom.js';
import {stageROMHex,installROMHexEdits,stagedROMByte} from '../dist/native-hex-workspace.js';
import {saveTableDefinition,tableRecord,copyTableRecord,swapTableRecords,fillTableColumn,findTableRows} from '../dist/hma-table-workspace.js';
const ID='d'.repeat(64),AT=0x7000;
function fixture(){
 const source=syntheticROM(),project=newProject();
 const table={id:'rowtools',name:'Verified fixed records',address:AT,stride:12,count:8,fields:[
  {name:'level',type:'u8',offset:0},{name:'growth',type:'s16',offset:1},
  {name:'ref',type:'ptr',offset:3},{name:'label',type:'ascii',offset:7,length:4}
 ]};
 for(let i=0;i<8;i++){
  source[AT+12*i]=i+1;source[AT+12*i+11]=0x80+i;
  source.set(Uint8Array.of(65+i,0,0,0),AT+12*i+7);
 }
 saveTableDefinition(project,ID,source,table);
 return{source,project,table};
}
test('copy duplicates a full source row, including opaque bytes and staged edits, without touching the original ROM',()=>{
 const {source,project,table}=fixture(),original=source.slice();
 stageROMHex(project,ID,source,AT,Uint8Array.of(77));
 const result=copyTableRecord(project,ID,source,table,0,2);
 assert.equal(result.rows,1);
 assert.equal(stagedROMByte(project,ID,source,AT+24),77);
 assert.equal(stagedROMByte(project,ID,source,AT+35),0x80);
 assert.equal(tableRecord(project,ID,source,table,2).values.level,77);
 assert.deepEqual(source,original);
 assert.throws(()=>copyTableRecord(project,ID,source,table,0,0),/different/);
});
test('swap exchanges entire pre-edited rows, stays undoable, and exports a native reindexable ROM',async()=>{
 const {source,project,table}=fixture(),original=source.slice(),before=captureEdit(project);
 stageROMHex(project,ID,source,AT+12,Uint8Array.of(91));
 swapTableRecords(project,ID,source,table,0,1);
 assert.equal(tableRecord(project,ID,source,table,0).values.level,91);
 assert.equal(tableRecord(project,ID,source,table,1).values.level,1);
 assert.equal(stagedROMByte(project,ID,source,AT+11),0x81);
 const out=new RomOutput(source);installROMHexEdits(project,ID,source,out);
 assert.equal(out.bytes[AT],91);assert.equal(out.bytes[AT+12],1);
 const native=await new GbaMaps(out.bytes,'Row operations.gba').discover();
 assert.equal(native.byKey('0.0').layout.width,4);
 assert.deepEqual(source,original);
 const delta=finishEdit(project,before);applyEdit(project,delta,false);
 assert.equal(project.hexStudio?.sources?.[ID]?.patches?.length||0,0);
 applyEdit(project,delta,true);assert.equal(tableRecord(project,ID,source,table,0).values.level,91);
});
test('bounded fill and staged typed search traverse numeric values and ASCII safely',()=>{
 const {source,project,table}=fixture();
 assert.equal(fillTableColumn(project,ID,source,table,'growth',2,6,'-32').rows,5);
 for(let i=2;i<=6;i++)assert.equal(tableRecord(project,ID,source,table,i).values.growth,-32);
 assert.deepEqual(findTableRows(project,ID,source,table,'growth',-32,{limit:3}).map(r=>r.index),[2,3,4]);
 assert.deepEqual(findTableRows(project,ID,source,table,'growth','-32',{from:4}).map(r=>r.index),[4,5,6]);
 assert.deepEqual(findTableRows(project,ID,source,table,'label','c').map(r=>r.index),[2]);
 assert.deepEqual(findTableRows(project,ID,source,table,'level','0x01').map(r=>r.index),[0]);
 const before=JSON.stringify(project);
 for(const bad of [()=>fillTableColumn(project,ID,source,table,'growth',0,8,'1'),()=>fillTableColumn(project,ID,source,table,'growth',0,1,'999999'),()=>fillTableColumn(project,ID,source,table,'missing',0,1,'1'),()=>findTableRows(project,ID,source,table,'level','bogus'),()=>findTableRows(project,ID,source,table,'level','1',{limit:1000})])assert.throws(bad);
 assert.equal(JSON.stringify(project),before);
});
test('a late safety-budget failure rolls back all earlier rows of one bulk operation',()=>{
 const {source,project,table}=fixture(),patches=[];
 for(let at=0x8000;at<0x8000+65535;at++)patches.push({at,before:source[at],after:(source[at]+1)&255});
 project.hexStudio.sources[ID].patches=patches;
 const before=project.hexStudio.sources[ID].patches;
 assert.throws(()=>fillTableColumn(project,ID,source,table,'level',0,1,'180'),/65,536/);
 assert.equal(project.hexStudio.sources[ID].patches,before,'draft operation does not commit partial rows');
 assert.equal(stagedROMByte(project,ID,source,AT),1);
});
test('row tools survive split save/reopen and source-verified writer ownership rejection',()=>{
 const {source,project,table}=fixture();
 fillTableColumn(project,ID,source,table,'label',3,4,'SAFE');
 const save=planSave(project),parts=new Map(save.parts.map(x=>[x.id,structuredClone(x.value)]));
 const reopened=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopened);
 assert.equal(tableRecord(reopened,ID,source,table,3).values.label,'SAFE');
 const out=new RomOutput(source);out.write(AT+3*12+7,Uint8Array.of(0xAA));
 assert.throws(()=>installROMHexEdits(reopened,ID,source,out),/ownership conflict/);
 const good=new RomOutput(source);installROMHexEdits(reopened,ID,source,good);
 assert.equal(String.fromCharCode(...good.bytes.slice(AT+3*12+7,AT+3*12+11)),'SAFE');
});
test('real mobile hex workspace exposes table search, copy/swap and bounded fill actions',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const marker of ['data-table-rowtool','hmaRowOperation','hmaRowDestination','hmaBulkFill','hmaFillField','hmaTableSearch','hmaTableClearSearch','findTableRows(','copyTableRecord(','swapTableRecords(','fillTableColumn('])assert.ok(ui.includes(marker),marker);
});
