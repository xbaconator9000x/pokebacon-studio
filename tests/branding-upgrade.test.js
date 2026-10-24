import test from 'node:test';import assert from 'node:assert/strict';
import{newProject,validateProject}from'../dist/model.js';
import{upgradeFormat}from'../dist/format-upgrade.js';
import{resolveDatabaseName,migratePreferences}from'../dist/storage-upgrade.js';
const previous=String.fromCharCode(115,104,97,116,116,101,114,101,100);
test('previous project backups upgrade while unrelated signatures remain invalid',()=>{
 const p=newProject();p.format=previous+'-map-studio';validateProject(p);assert.equal(p.format,'pokebacon-map-studio');p.format='unrelated';assert.throws(()=>validateProject(p),/Choose/);
});
test('previous library and music signatures upgrade exactly',()=>{
 assert.equal(upgradeFormat({format:previous+'-library-1'},'pokebacon-library-1',0x66f697d7).format,'pokebacon-library-1');
 assert.equal(upgradeFormat({format:previous+'-music'},'pokebacon-music',0x1d25d43d).format,'pokebacon-music');
 assert.equal(upgradeFormat({format:'unrelated'},'pokebacon-music',0x1d25d43d).format,'unrelated');
});
test('foreground and worker discover the existing database without deleting it',async()=>{
 const name=previous+'-map-studio-v1';assert.equal(await resolveDatabaseName({databases:async()=>[{name}]}),name);
 assert.equal(await resolveDatabaseName({databases:async()=>[]}), 'pokebacon-map-studio-v1');
 assert.equal(await resolveDatabaseName({databases:async()=>[{name},{name:'pokebacon-map-studio-v1'}]}),'pokebacon-map-studio-v1');
 await assert.rejects(resolveDatabaseName({databases:async()=>[{name},{name:'second-map-studio-v1'}]}),/Several/);
});
test('preferences migrate without deleting earlier settings or overwriting current choices',()=>{
 const values=new Map([[previous+'-active-project','p1'],[previous+'-toolbar-v1','old'],['pokebacon-toolbar-v1','new']]);
 const store={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 migratePreferences(store);assert.equal(values.get('pokebacon-active-project'),'p1');assert.equal(values.get(previous+'-active-project'),'p1');assert.equal(values.get('pokebacon-toolbar-v1'),'new');
});
