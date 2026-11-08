// Actual IndexedDB API regression using the same maintained shim as other CI
// browser checks. This is not a physical Android storage test.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {newProject} from '../dist/model.js';
import {ProjectStore,PARTS_STORE,readProject,planSave,commitSave,saveScopeForEdit} from '../dist/project-store.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
const require=createRequire(import.meta.url),runtime=process.env.MAP_STUDIO_QA_RUNTIME;
const {indexedDB}=require(runtime?runtime+'/fake-indexeddb':'fake-indexeddb');
const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('storage-regression',1);r.onupgradeneeded=()=>{r.result.createObjectStore('projects',{keyPath:'id'});r.result.createObjectStore(PARTS_STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
try{
 for(const engine of ['pokefirered','pokeemerald','cfru','shiny']){
  const p=newProject(engine);p.sourceEngine={version:1,engine,archiveId:'source-'+'a'.repeat(64),name:'Original',features:{},sprites:[],music:[]};
  const store=new ProjectStore(db);await store.save(p,{all:true});
  const before=captureEdit(p);p.sourceEngine.name='Changed';const edit=finishEdit(p,before);
  for(const forward of [true,false,true]){applyEdit(p,edit,forward);await store.save(p,saveScopeForEdit(edit)||{all:true});assert.deepEqual((await readProject(db,p.id)).sourceEngine,p.sourceEngine);}
  // A real structured-clone failure aborts the transaction, retaining its
  // previous header and section data together.
  const saved=await readProject(db,p.id),bad=planSave(p);
  bad.header.name='Must not commit';bad.parts.push({id:'invalid',projectId:p.id,value:()=>{}});
  await assert.rejects(commitSave(db,bad));assert.deepEqual(await readProject(db,p.id),saved);
  // Failed worker requests fall back to the transactional foreground path.
  const fallback=new ProjectStore(db,{workerFactory:()=>({postMessage(){throw Error('worker unavailable');},terminate(){}})});
  p.sourceEngine.name='Recovered';await fallback.save(p,{all:true});assert.equal((await readProject(db,p.id)).sourceEngine.name,'Recovered');
  store.close();fallback.close();
 }
 console.log('PASS four engines: IndexedDB source settings undo/redo, transaction abort preservation and worker-post failure fallback');
}finally{db.close();}
