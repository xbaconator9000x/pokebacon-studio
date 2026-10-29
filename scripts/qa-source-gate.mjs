import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(fs.readFileSync('qa/source-manifest.json'));
assert.equal(JSON.parse(fs.readFileSync('package.json')).version,manifest.version);
const xml=fs.readFileSync('android/AndroidManifest.xml','utf8');
assert.ok(xml.includes(`package="${manifest.package}"`));
assert.ok(xml.includes(`android:versionName="${manifest.version}"`));
assert.ok(xml.includes(`android:versionCode="${manifest.versionCode}"`));
assert.ok(xml.includes(`android:authorities="${manifest.package}.files"`));
assert.ok(fs.readFileSync('dist/version-ui.js','utf8').includes(`newVersion='${manifest.version}'`));
assert.ok(fs.readFileSync('dist/sw.js','utf8').includes(`v${manifest.version}`));
for(const [path,expected] of Object.entries(manifest.files)){
  assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),expected,path);
}
const deployed=fs.readdirSync('dist',{recursive:true}).filter(p=>fs.statSync('dist/'+p).isFile()).map(p=>'dist/'+p).sort();
assert.deepEqual(deployed,Object.keys(manifest.files).sort(),'Update the manifest when deployed files change');
console.log(`PASS ${manifest.version}: ${deployed.length} deployed fingerprints, Android identity and version parity`);
