import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject,validateProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {planSave,savedProjectKeys,assembleSavedProject,saveScopeForEdit} from '../dist/project-store.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {parseROMOffset,hexInput,formatHex,hexRows,findROMHex,stageROMHex,stagedROMByte,hexDiffSummary,stagedHexCount,installROMHexEdits,validateHexStudio} from '../dist/native-hex-workspace.js';
const sourceId='5'.repeat(64),original=()=>syntheticROM();
test('hex viewport, source-based search and bounded addresses never mutate the input ROM',()=>{
 const source=original(),project=newProject(),before=source.slice();
 assert.equal(parseROMOffset('0x200',source.length),512);
 assert.equal(parseROMOffset('512',source.length),512);
 assert.equal(parseROMOffset('0200h',source.length),512);
 for(const input of ['0x','0xzz','-1','0x20000000','hello'])assert.throws(()=>parseROMOffset(input,source.length));
 assert.deepEqual(hexInput('00 ff, A2:13'),Uint8Array.from([0,255,162,19]));
 assert.equal(formatHex(hexInput('00 ff')),'00 FF');
 for(const bad of ['0','0xQ2','', 'aa0', 'ff'.repeat(4097)])assert.throws(()=>hexInput(bad));
 assert.equal(hexRows(project,sourceId,source,0x200).length,16);
 stageROMHex(project,sourceId,source,0x200,Uint8Array.of(99,98,97));
 assert.equal(stagedROMByte(project,sourceId,source,0x201),98);
 assert.deepEqual(findROMHex(project,sourceId,source,Uint8Array.of(99,98,97),{from:0x1F0}),[0x200]);
 assert.equal(hexRows(project,sourceId,source,0x200,{rows:1})[0].columns[0].edited,true);
 assert.deepEqual(source,before);
});
test('reversible byte changes use original preconditions and coalesce overlapping staged edits',()=>{
 const source=original(),project=newProject(),at=0x6100,before=source.slice(at,at+3);
 assert.deepEqual(stageROMHex(project,sourceId,source,at,before),{changed:0,total:0});
 stageROMHex(project,sourceId,source,at,Uint8Array.of(1,2,3));
 stageROMHex(project,sourceId,source,at+1,Uint8Array.of(0,4));
 assert.equal(hexDiffSummary(project,sourceId,source).changedBytes,2);
 stageROMHex(project,sourceId,source,at,before);
 assert.equal(stagedHexCount(project,sourceId),0);
 assert.throws(()=>stageROMHex(project,sourceId,source,source.length-1,Uint8Array.of(1,2)));
 assert.throws(()=>stageROMHex(project,sourceId,source,0,Uint8Array.from({length:4097},()=>1)),/4,096/);
});
test('source mismatch, compiler ownership collision and atomic rollback protect other ROM edits',()=>{
 const source=original(),project=newProject(),at=0x6100;
 stageROMHex(project,sourceId,source,at,Uint8Array.of(11,12));
 stageROMHex(project,sourceId,source,0x6300,Uint8Array.of(31));
 const out=new RomOutput(source);out.write(at,Uint8Array.of(55));
 const snapshot=out.bytes.slice(),writes=out.writes.length;
 assert.throws(()=>installROMHexEdits(project,sourceId,source,out),/ownership conflict/);
 assert.deepEqual(out.bytes,snapshot);
 assert.equal(out.writes.length,writes);
 const mismatch=source.slice();mismatch[at]=73;
 assert.throws(()=>installROMHexEdits(project,sourceId,mismatch,new RomOutput(mismatch)),/no longer matches original/);
 const ok=new RomOutput(source),done=installROMHexEdits(project,sourceId,source,ok);
 assert.deepEqual(done,{bytes:3,spans:2});
 assert.deepEqual(ok.bytes.slice(at,at+2),Uint8Array.of(11,12));
 assert.equal(ok.bytes[0x6300],31);
 assert.equal(ok.writes.length,2);
 assert.deepEqual(source.slice(at,at+2),snapshot.slice(at,at+2).map((v,i)=>source[at+i]));
});
test('staged native edits persist with project save/restore and full history undo/redo',()=>{
 const project=newProject(),source=original(),before=captureEdit(project);
 stageROMHex(project,sourceId,source,0x510,Uint8Array.of(0xAA,0xBB));
 const delta=finishEdit(project,before);
 assert.ok(delta.root.some(row=>row[0]==='hexStudio'));
 assert.equal(saveScopeForEdit(delta),null);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 assert.ok(save.header.storageParts.sections.hexStudio);
 const reopen=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 validateProject(reopen);
 assert.deepEqual(reopen.hexStudio,project.hexStudio);
 const out=new RomOutput(source);installROMHexEdits(reopen,sourceId,source,out);
 assert.deepEqual(out.bytes.slice(0x510,0x512),Uint8Array.of(0xAA,0xBB));
 applyEdit(project,delta,false);assert.equal(project.hexStudio,undefined);
 applyEdit(project,delta,true);assert.equal(stagedROMByte(project,sourceId,source,0x511),0xBB);
});
test('untrusted project ROM edit metadata is validated, not silently accepted',()=>{
 const source=original(),project=newProject();stageROMHex(project,sourceId,source,0x700,Uint8Array.of(1));
 assert.equal(validateHexStudio(project.hexStudio),true);
 for(const bad of [{at:0x700,before:source[0x700],after:source[0x700]},{at:-1,before:0,after:1},{at:0x700,before:0,after:2}]){
  const p=structuredClone(project);p.hexStudio.sources[sourceId].patches.push(bad);
  assert.throws(()=>validateProject(p),/Invalid|duplicated|unchanged/);
 }
});
