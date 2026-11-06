import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='docs/feature-audit/';
const inventory=JSON.parse(fs.readFileSync(base+'inventory.json'));
const upstream=JSON.parse(fs.readFileSync(base+'upstream-evidence.json'));
const ids=new Set(),refs=new Set(upstream.records.map(record=>record.id));
for(const row of inventory.features){
 assert.ok(!ids.has(row.id),'duplicate capability '+row.id);ids.add(row.id);
 assert.ok(Object.hasOwn(inventory.statusDefinitions,row.status),'unknown status '+row.id);
 for(const key of ['name','category','whyNeeded','complexity','priority','dependencies','reuseRecommendation','acceptanceCriteria','verification'])assert.ok(row[key],row.id+' missing '+key);
 for(const ref of row.references)assert.ok(refs.has(ref),'unknown upstream '+ref);
 for(const path of [...row.sourceEvidence,...row.testEvidence])assert.ok(fs.existsSync(path),'missing evidence '+path);
 assert.ok(row.acceptanceCriteria.length>=2);
 assert.equal(row.verification.released,false,'no release has been accepted for this audit');
 if(row.status==='fully_verified')assert.equal(row.verification.gameplayVerified,true);
}
for(const record of upstream.records){assert.match(record.commit,/^[a-f0-9]{40}$/);assert.ok(record.sourceEvidence.length);}
console.log('PASS '+ids.size+' capability records, '+refs.size+' pinned upstream references, evidence paths and status fields');
