import{CORE_ID}from'./playtest-core.js';
export function playtestStorage(db){
 const get=id=>new Promise((resolve,reject)=>{if(!db){resolve(null);return;}const r=db.transaction('playtests').objectStore('playtests').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const put=value=>new Promise((resolve,reject)=>{if(!db){reject(Error('Test saving is unavailable. Export a .sav before closing.'));return;}const tx=db.transaction('playtests','readwrite');tx.objectStore('playtests').put(value);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('Test save could not be stored. Export your .sav before closing.'));});
 return{get,put,ramKey:(projectId,source)=>'ram:'+projectId+':'+source,stateKey:hash=>'resume:'+CORE_ID+':'+hash};
}
