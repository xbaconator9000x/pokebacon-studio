import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEditSet,parseEditSet,reviewEditSet,editsToApply,mergeEdits} from '../dist/edit-set.js';
const src={species:[{},{id:1,name:'AAA',stats:[1,2,3,4,5,6],catchRate:45}],moves:[{},{id:1,name:'Pound',power:40}],items:[{},{id:1,name:'Ball',price:200}],trainers:[{},{id:1,name:'SAWYER',party:[{level:5,species:1}]}],encounters:[{key:'0.1',groups:{land:{rate:20}}}]};
const edits={species:{1:{catchRate:99}},moves:{1:{power:50}},items:{1:{price:300}},trainers:{1:{party:[{level:9,species:1}]}},encounters:{'0.1':{land:{rate:10}}},sprites:[{}]};
test('an edit set round trips and reviews as clean against the same data',()=>{
 const set=parseEditSet(JSON.stringify(buildEditSet(edits,src,{name:'x'})));
 assert.equal(set.entries.length,5);assert.equal(set.skipped.sprites,1);
 const r=reviewEditSet(set,src);assert.equal(r.summary.clean,5);
 const apply=editsToApply(r);assert.deepEqual(apply.moves,{1:{power:50}});
});
test('already applied, conflicting, missing and renamed records are told apart',()=>{
 const set=buildEditSet(edits,src,{});
 const t=structuredClone(src);t.species[1].catchRate=99;t.moves[1].power=60;t.items.length=1;t.trainers[1].name='OTHER';
 const r=reviewEditSet(set,t);const by=Object.fromEntries(r.rows.map(x=>[x.key,x.status]));
 assert.equal(by.species,'already');assert.equal(by.moves,'conflict');assert.equal(by.items,'missing');assert.equal(by.trainers,'conflict');assert.equal(by.encounters,'clean');
 assert.deepEqual(editsToApply(r).moves,{});assert.deepEqual(editsToApply(r,{includeConflicts:true}).moves,{1:{power:50}});
});
test('unsupported tables and refused edits are reported',()=>{
 const set=buildEditSet(edits,src,{});
 const r=reviewEditSet(set,src,{profile:{capabilities:{trainers:false}},validate:(k)=>k==='items'?'not editable':''});
 const by=Object.fromEntries(r.rows.map(x=>[x.key,x.status]));assert.equal(by.trainers,'unsupported');assert.equal(by.items,'unsupported');
});
test('damaged files are refused and merging keeps earlier fields',()=>{
 assert.throws(()=>parseEditSet('nope'));assert.throws(()=>parseEditSet('{"format":"pokebacon-edit-set","version":1,"entries":[{"key":"x"}]}'));
 const t={species:{1:{catchRate:5,stats:[1,1,1,1,1,1]}}};assert.equal(mergeEdits(t,{species:{1:{catchRate:9}}}),1);assert.deepEqual(t.species[1],{catchRate:9,stats:[1,1,1,1,1,1]});
});
