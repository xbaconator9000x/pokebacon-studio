import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {stageROMHex,hexDiffSummary,revertROMHexRange,installROMHexEdits} from '../dist/native-hex-workspace.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
const ID='b'.repeat(64),AT=0x7200;
test('selective revert removes only selected staged source bytes and remains undoable',()=>{
 const source=syntheticROM(),project=newProject(),pristine=source.slice();
 const original=Array.from(source.slice(AT,AT+8));
 stageROMHex(project,ID,source,AT,Uint8Array.of(...original.map((x,i)=>(x+i+1)%256)));
 const before=captureEdit(project);
 const res=revertROMHexRange(project,ID,source,AT+1,3);
 assert.equal(res.removed,3);assert.equal(res.changed,3);
 const diff=hexDiffSummary(project,ID,source);
 assert.equal(diff.changedBytes,5);
 const out=new RomOutput(source);installROMHexEdits(project,ID,source,out);
 for(let i=0;i<8;i++)assert.equal(out.bytes[AT+i],i>=1&&i<=3?original[i]:(original[i]+i+1)%256);
 const change=finishEdit(project,before);
 applyEdit(project,change,false);
 assert.equal(hexDiffSummary(project,ID,source).changedBytes,8);
 applyEdit(project,change,true);
 assert.equal(hexDiffSummary(project,ID,source).changedBytes,5);
 assert.deepEqual(source,pristine);
 const plan=planSave(project),parts=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(plan.header),savedProjectKeys(plan.header).map(key=>parts.get(key)));
 validateProject(restored);
 assert.equal(hexDiffSummary(restored,ID,source).changedBytes,5);
});
test('empty and invalid revert ranges do not create state or change earlier staged edits',()=>{
 const source=syntheticROM(),project=newProject();
 assert.deepEqual(revertROMHexRange(project,ID,source,AT,3),{changed:0,removed:0,total:0});
 assert.equal(project.hexStudio,undefined);
 stageROMHex(project,ID,source,AT,Uint8Array.of(source[AT]^0x55));
 const before=JSON.stringify(project);
 for(const [at,len] of [[-1,1],[AT,0],[AT,4097],[source.length-1,2],[AT,1.5]]){
  assert.throws(()=>revertROMHexRange(project,ID,source,at,len));
  assert.equal(JSON.stringify(project),before);
 }
});
test('the native edit review screen exposes bounded per-range revert and source jump buttons',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const label of ['data-hma-revert','revertROMHexRange(','Revert selected ROM bytes','Revert range','data-hma-diff'])assert.ok(ui.includes(label),label);
});
