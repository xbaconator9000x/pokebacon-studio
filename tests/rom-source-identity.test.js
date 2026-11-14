import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {newProject,validateProject} from '../dist/model.js';
import {planSave,assembleSavedProject,savedProjectKeys} from '../dist/project-store.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {legacyROMSourceKey,inspectROMSourceBinding,approveLegacyROMBinding} from '../dist/rom-source-identity.js';
const hash=source=>createHash('sha256').update(source).digest('hex');
async function scenario(){
 const source=syntheticROM(),reader=await new GbaMaps(source,'Original fixture.gba').discover();
 const key=legacyROMSourceKey(reader),map=reader.maps[0],project=newProject();
 project.maps[0].rom={
  sourceId:key,engine:reader.engine,key:map.key,headerAddress:map.address,
  layoutAddress:map.layout.address,blocksAddress:map.layout.blocks,scriptsAddress:map.scripts,
  originalWidth:map.layout.width,originalHeight:map.layout.height,
  originalBlocks:Array.from(reader.blocks(map))
 };
 project.romSources=[{id:key,...reader.summary()}];
 project.hexStudio={version:1,sources:{[key]:{patches:[],tables:[],hmaToml:'HMA metadata stays bound'}}};
 project.romEdits={[key]:{items:{1:{price:123}}}};
 return {source,reader,project,key,fingerprint:hash(source)};
}
test('canonical sources never acquire legacy records or unexpected project IDs',async()=>{
 const {reader,project,fingerprint}=await scenario();
 assert.equal(inspectROMSourceBinding(newProject(),reader,fingerprint).status,'canonical');
 project.maps[0].rom.sourceId=fingerprint;
 assert.equal(inspectROMSourceBinding(project,reader,fingerprint).status,'existing-canonical');
 assert.equal(legacyROMSourceKey(reader),reader.code+'-'+reader.size+'-'+reader.mapTable);
 assert.throws(()=>inspectROMSourceBinding(project,reader,'not-a-sha'),/SHA-256/);
});
test('legacy source review is read-only and explicitly upgrades a matching original without rekeying edits',async()=>{
 const {source,reader,project,key,fingerprint}=await scenario(),before=structuredClone(project);
 const audit=inspectROMSourceBinding(project,reader,fingerprint);
 assert.equal(audit.status,'review-legacy');assert.equal(audit.verifiedMaps,1);
 assert.deepEqual(project,before);
 const snapshot=captureEdit(project);
 const result=approveLegacyROMBinding(project,reader,fingerprint,key);
 assert.equal(result.sourceId,key);
 assert.equal(project.maps[0].rom.sourceId,key);
 assert.equal(project.hexStudio.sources[key].hmaToml,'HMA metadata stays bound');
 assert.equal(project.romEdits[key].items[1].price,123);
 assert.equal(project.romSources[0].verifiedSha256,fingerprint);
 assert.equal(inspectROMSourceBinding(project,reader,fingerprint).status,'verified-legacy');
 const change=finishEdit(project,snapshot);assert.ok(change.root.some(([k])=>k==='romSources'));
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const recovered=assembleSavedProject(structuredClone(save.header),savedProjectKeys(save.header).map(k=>parts.get(k)));
 assert.equal(recovered.romSources[0].verifiedSha256,fingerprint);
 applyEdit(project,change,false);
 assert.equal(project.romSources[0].verifiedSha256,undefined);
 applyEdit(project,change,true);
 assert.equal(project.romSources[0].verifiedSha256,fingerprint);
 assert.deepEqual(source,reader.bytes);
});
test('changed native map baseline or forged stale source descriptor is blocked before any mutation',async()=>{
 const {project,reader,key,fingerprint}=await scenario();
 const saved=JSON.stringify(project);
 project.maps[0].rom.originalBlocks[0]^=1;
 const altered=JSON.stringify(project);
 const inspect=inspectROMSourceBinding(project,reader,fingerprint);
 assert.equal(inspect.status,'blocked-legacy');
 assert.ok(inspect.problems.some(p=>/original tile/.test(p)));
 assert.throws(()=>approveLegacyROMBinding(project,reader,fingerprint,key),/no longer safe/);
 assert.equal(JSON.stringify(project),altered);
 project.maps[0].rom.originalBlocks[0]^=1;
 assert.equal(JSON.stringify(project),saved);
 project.romSources[0].mapTable++;
 assert.equal(inspectROMSourceBinding(project,reader,fingerprint).status,'blocked-legacy');
});
test('previously attested weak ID cannot be rebound to a different ROM with the same weak code-size-mapTable',async()=>{
 const {source,reader,project,key,fingerprint}=await scenario();
 approveLegacyROMBinding(project,reader,fingerprint,key);
 const modified=source.slice();modified[modified.length-3]^=0x11;
 const reader2=await new GbaMaps(modified,'Different revision.gba').discover();
 assert.equal(legacyROMSourceKey(reader2),key);
 const status=inspectROMSourceBinding(project,reader2,hash(modified));
 assert.equal(status.status,'blocked-legacy');
 assert.match(status.problems[0],/previously verified/);
 assert.throws(()=>approveLegacyROMBinding(project,reader2,hash(modified),key),/no longer safe/);
 assert.equal(project.romSources[0].verifiedSha256,fingerprint);
});
test('unverified legacy IDs are never silently accepted with missing baselines, missing source records or extra collisions',async()=>{
 const {reader,project,fingerprint,key}=await scenario();
 delete project.maps[0].rom.originalBlocks;
 assert.equal(inspectROMSourceBinding(project,reader,fingerprint).status,'blocked-legacy');
 project.romSources=[];
 assert.equal(inspectROMSourceBinding(project,reader,fingerprint).status,'blocked-legacy');
 project.romSources=[{id:key,...reader.summary(),verifiedSha256:'bad'}];
 assert.equal(inspectROMSourceBinding(project,reader,fingerprint).status,'blocked-legacy');
});
test('an authentic existing sidecar fingerprint preserves its legacy source ID without unnecessary review',async()=>{
 const {reader,project,fingerprint,key}=await scenario();
 project.romRoundTrip={sourceId:key,sourceFingerprint:fingerprint};
 const inspect=inspectROMSourceBinding(project,reader,fingerprint);
 assert.equal(inspect.status,'verified-sidecar');assert.equal(inspect.sourceId,key);
});
