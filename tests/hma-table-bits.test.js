import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {stageROMHex,installROMHexEdits} from '../dist/native-hex-workspace.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {saveTableDefinition,tableRecord,setTableBitRange} from '../dist/hma-table-workspace.js';
const ID='b'.repeat(64),AT=0x7900;
function fixture(){
 const source=syntheticROM(),project=newProject(),table={id:'flags',name:'Verified flag rows',address:AT,stride:11,count:6,fields:[{name:'flags',type:'u32',offset:0},{name:'small',type:'u8',offset:4},{name:'signed',type:'s16',offset:5},{name:'next',type:'ptr',offset:7}]};
 saveTableDefinition(project,ID,source,table);
 for(let r=0;r<6;r++){source.set([0x12,0x34,0x56,0x78,0xa0+r,0xff,0xff,0,0,0,0],AT+r*11);}
 return{source,project,table};
}
test('native 32-bit top flag and cross-byte ranges preserve unrelated bits',()=>{
 const {source,project,table}=fixture(),before=source.slice();
 let result=setTableBitRange(project,ID,source,table,'flags',0,0,31,1,1);
 assert.equal(result.rows,1);
 assert.equal(tableRecord(project,ID,source,table,0).values.flags,0xf8563412);
 result=setTableBitRange(project,ID,source,table,'flags',0,0,6,7,'0x41');
 const expected=((0xf8563412n&~(127n<<6n))|(65n<<6n));
 assert.equal(tableRecord(project,ID,source,table,0).values.flags,Number(expected));
 assert.equal(tableRecord(project,ID,source,table,0).values.small,0xa0);
 const out=new RomOutput(source);installROMHexEdits(project,ID,source,out);
 assert.equal(new DataView(out.bytes.buffer).getUint32(AT,true),Number(expected));
 assert.deepEqual(source,before);
});
test('batch flag edit compares staged values and remains reversible across split project saves',()=>{
 const {source,project,table}=fixture(),previous=captureEdit(project),original=source.slice();
 stageROMHex(project,ID,source,AT+11,Uint8Array.of(0xFF));
 const report=setTableBitRange(project,ID,source,table,'flags',0,5,1,2,0);
 assert.equal(report.rows,6);
 assert.equal(tableRecord(project,ID,source,table,1).values.flags&0x07,0x01);
 const delta=finishEdit(project,previous);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(restored);
 assert.deepEqual(tableRecord(restored,ID,source,table,2),tableRecord(project,ID,source,table,2));
 applyEdit(project,delta,false);
 assert.equal(tableRecord(project,ID,source,table,1).values.flags&0xff,0x12);
 applyEdit(project,delta,true);
 assert.equal(tableRecord(project,ID,source,table,1).values.flags&0x07,0x01);
 assert.deepEqual(source,original);
});
test('invalid masks, unsupported types and oversized ranges cannot stage partial writes',()=>{
 const {source,project,table}=fixture(),saved=JSON.stringify(project);
 for(const call of [
  ()=>setTableBitRange(project,ID,source,table,'flags',0,0,32,1,1),
  ()=>setTableBitRange(project,ID,source,table,'flags',0,0,31,2,1),
  ()=>setTableBitRange(project,ID,source,table,'flags',0,0,7,0,1),
  ()=>setTableBitRange(project,ID,source,table,'flags',0,0,3,2,4),
  ()=>setTableBitRange(project,ID,source,table,'flags',0,0,0,2,''),
  ()=>setTableBitRange(project,ID,source,table,'flags',0,0,0,2,'nan'),
  ()=>setTableBitRange(project,ID,source,table,'small',5,6,0,1,1),
  ()=>setTableBitRange(project,ID,source,table,'signed',0,0,0,1,1),
  ()=>setTableBitRange(project,ID,source,table,'next',0,0,0,1,1),
  ()=>setTableBitRange(project,ID,source,table,'wrong',0,0,0,1,1),
  ()=>setTableBitRange(project,ID,source,{...table,count:300},'flags',0,299,0,1,1)
 ]){assert.throws(call);assert.equal(JSON.stringify(project),saved);}
});
test('phone typed-cell controls expose bounded exact bit edits in source-bound UI',()=>{
 const text=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const part of ['hmaCellEditBits','hmaBitsStart','hmaBitsWidth','hmaBitsValue','hmaBitsLastRow','setTableBitRange('])assert.ok(text.includes(part),part);
});
