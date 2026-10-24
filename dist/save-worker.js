import{resolveDatabaseName}from'./storage-upgrade.js';
import {commitSave} from './project-store.js';
let db;const ready=resolveDatabaseName().then(databaseName=>new Promise((resolve,reject)=>{const r=indexedDB.open(databaseName,4);r.onsuccess=()=>{db=r.result;db.onversionchange=()=>db.close();resolve();};r.onerror=()=>reject(r.error);}));let queue=Promise.resolve();self.onmessage=e=>{const {id,header,parts}=e.data;queue=queue.catch(()=>{}).then(async()=>{try{await ready;await commitSave(db,{header,parts});self.postMessage({id});}catch(error){self.postMessage({id,error:error.message});}});};
