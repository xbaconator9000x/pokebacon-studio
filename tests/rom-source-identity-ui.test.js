import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
test('ROM opening computes canonical SHA-256 in all WebViews without weak implicit fallback',()=>{
 assert.ok(app.includes('const fingerprint=await romFingerprint(reader.bytes)'), 'canonical source digest');
 assert.ok(!app.includes("else id=reader.code+'-'+reader.size+'-'+reader.mapTable"),'weak ID fallback removed');
 assert.ok(app.includes('inspectROMSourceBinding(subject,reader,fingerprint)'));
 assert.ok(app.includes('if(binding.status==='));
});
test('legacy ID approval requires actual consent and a complete native baseline review',()=>{
 for(const text of ['legacySourceConsent','I confirm this is the original ROM','approveLegacyROMBinding(restored,reader,fingerprint,binding.legacyId)','change(()=>approveLegacyROMBinding(project,reader,fingerprint,binding.legacyId))','finishOpenedROM(reader,binding.legacyId'])assert.ok(app.includes(text),text);
 assert.ok(app.includes('Legacy source mismatch'));
 assert.ok(app.includes('binding.problems.slice(0,5)'));
});
test('every refused legacy source has separate canonical ROM opening without silently changing project IDs',()=>{
 for(const text of ['legacyOpenSeparate','finishOpenedROM(reader,fingerprint','if(project!==originalProject)throw Error','if(binding.status===','matchedExport?{status:'])assert.ok(app.includes(text),text);
});
