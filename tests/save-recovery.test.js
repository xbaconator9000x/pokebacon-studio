import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectStore,savingError} from '../dist/project-store.js';
import {newProject} from '../dist/model.js';
// Minimal IndexedDB stand-in: records what a committed transaction wrote and
// can fail the way a full or interrupted device does.
function fakeDB({fail=null}={}){const db={writes:[],commits:0,transaction(){const tx={objectStore(name){return{put(v){if(fail==='throw-quota'){const e=Error('quota');e.name='QuotaExceededError';throw e;}tx.pending.push([name,v]);}};},pending:[],abort(){tx.aborted=true;},error:null};queueMicrotask(()=>{if(tx.aborted)return;if(fail==='abort'){tx.error=Error('interrupted');tx.onabort?.();return;}db.commits++;db.writes.push(...tx.pending);tx.oncomplete?.();});return tx;}};return db;}
const scope={all:true};
test('worker that never answers times out and the save still commits directly',async()=>{
 const db=fakeDB(),p=newProject('Timeout'),store=new ProjectStore(db,{workerTimeoutMs:20,workerFactory:()=>({postMessage(){},terminate(){this.ended=true;}})});
 await store.save(p,scope);assert.equal(db.commits,1);assert.ok(db.writes.length>0);assert.equal(store.worker,null);
 await store.save(p,{all:true});assert.equal(db.commits,2,'later saves keep working without the worker');
});
test('worker error fails over to a direct commit',async()=>{
 const db=fakeDB(),p=newProject('Worker error'),store=new ProjectStore(db,{workerFactory:()=>{const w={terminate(){},postMessage(){queueMicrotask(()=>w.onerror?.(new Event('error')));}};return w;}});
 await store.save(p,scope);assert.equal(db.commits,1);
});
test('postMessage failure fails over to a direct commit',async()=>{
 const db=fakeDB(),p=newProject('Post fail'),store=new ProjectStore(db,{workerFactory:()=>({terminate(){},postMessage(){throw Error('clone failed');}})});
 await store.save(p,scope);assert.equal(db.commits,1);
});
test('a full device gives a plain-language error and keeps the last saved state',async()=>{
 const p=newProject('Quota'),good=fakeDB(),store=new ProjectStore(good);await store.save(p,scope);const known=store.known;
 const full=fakeDB({fail:'throw-quota'});store.db=full;p.name='Changed';
 await assert.rejects(()=>store.save(p,{all:true}),/Device storage is full.*export a project backup.*still open/);
 assert.equal(full.commits,0);assert.equal(store.known,known,'failed save does not advance the known state');
});
test('an interrupted transaction rejects, writes nothing and a retry succeeds',async()=>{
 const p=newProject('Interrupted'),bad=fakeDB({fail:'abort'}),store=new ProjectStore(bad);
 await assert.rejects(()=>store.save(p,scope),/interrupted/);assert.equal(bad.writes.length,0);
 store.db=fakeDB();await store.save(p,scope);assert.equal(store.db.commits,1);
});
test('savingError leaves other errors alone',()=>{const e=Error('boom');assert.equal(savingError(e),e);assert.match(savingError('x').message,/x/);});
