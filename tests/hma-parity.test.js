import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='docs/feature-audit/';
const parity=JSON.parse(fs.readFileSync(root+'hma-parity.json','utf8'));
const inventory=JSON.parse(fs.readFileSync(root+'inventory.json','utf8'));
const ids=new Set(inventory.features.map(feature=>feature.id));
const statuses=new Set(Object.keys(parity.statusDefinitions));
test('HMA parity contract tracks stable baseline, newest 0.6.x deltas and every feature with unique audited identities',()=>{
 assert.equal(parity.schemaVersion,1);
 assert.ok(parity.sourceProduct.stableBaseline==='v0.5.6.1');
 assert.match(parity.sourceProduct.additionalCoverage,/0\.6\.0.*0\.6\.1/);
 assert.ok(parity.features.length>=101,'do not regress the 101-item HMA baseline contract');
 assert.equal(new Set(parity.features.map(feature=>feature.id)).size,parity.features.length,'duplicate HMA feature IDs');
 assert.equal(parity.features.filter(feature=>feature.baseline.includes('0.6.0')).length,10,'keep newer HMA capabilities distinct from stable baseline');
 assert.equal(new Set(parity.features.map(feature=>feature.category)).size,8);
 for(const feature of parity.features){
  assert.match(feature.id,/^HMA-[A-Z0-9]+-\d{2,3}$/,feature.name);
  assert.ok(feature.name?.length>=8,feature.id+' missing user-facing function');
  assert.ok(feature.acceptance?.length>=30,feature.id+' missing independently testable behavior');
  assert.ok(['P0','P1','P2'].includes(feature.priority),feature.id+' invalid priority');
  assert.ok(statuses.has(feature.parityStatus),feature.id+' unsupported status');
  assert.ok(feature.upstream?.length,feature.id+' missing HMA source documentation');
  for(const url of feature.upstream)assert.match(url,/^https:\/\/github\.com\/haven1433\/HexManiacAdvance\//,feature.id+' invalid primary source');
  for(const id of feature.inventoryIds)assert.ok(ids.has(id),feature.id+' links nonexistent broad capability '+id);
 }
});
test('HMA-only gaps remain explicit and cannot be counted as completed by general inventory links',()=>{
 const gaps=parity.features.filter(feature=>feature.inventoryIds.length===0);
 assert.equal(gaps.length,9,'update HMA parity README and inventory crosswalk whenever mapping new requirements');
 for(const marker of [/Raw byte\/hex/,/HMA TOML/,/Generic typed ROM table/,/Miscellaneous lookup/,/Trainer payout/,/THUMB disassembly/,/Python scripting/,/IPS patches/,/THUMB code region/])
  assert.ok(gaps.some(f=>marker.test(f.name)),'untracked HMA-specific gap '+marker);
 assert.ok(parity.features.some(f=>f.name.includes('battle')&&f.inventoryIds.includes('UI04')));
 assert.ok(parity.features.some(f=>f.name.includes('map')&&f.inventoryIds.includes('MAP09')));
 const docs=fs.readFileSync(root+'HMA_PARITY.md','utf8');
 assert.match(docs,/101 atomic HMA features/);
 assert.match(docs,/nine HMA requirements/);
 assert.match(docs,/no green-by-assumption/i);
});
test('parity verification requires direct ROM/game evidence, not an implementation flag or passing CI alone',()=>{
 for(const f of parity.features){
  if(f.parityStatus!=='verified')continue;
  const v=f.verification;
  assert.ok(v&&v.sourceSha256&&v.engine&&v.revision&&v.ciRunUrl&&v.exportReimport&&v.sourcePreserved&&v.uiEvidence,'verified entry lacks native acceptance evidence: '+f.id);
  assert.match(v.ciRunUrl,/^https:\/\/github\.com\/xbaconator9000x\/pokebacon-studio\/actions\/runs\/\d+$/,f.id);
  if(v.runtimeRelevant!==false)assert.ok(v.emulatorArtifact&&v.gameBehaviorAccepted,'verified runtime behavior lacks emulator proof: '+f.id);
 }
 assert.ok(parity.features.some(f=>f.parityStatus==='not_verified'),'source tests cannot imply all HMA features are verified');
});
