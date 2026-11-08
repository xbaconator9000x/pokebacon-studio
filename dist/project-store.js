// Local storage v2 splits maps and immutable library payloads. Project exports stay portable v1 JSON.
export const PARTS_STORE='projectParts';
export const SPLIT_PROJECT_SECTIONS=Object.freeze(['sourceEngine','spriteStudio','romEdits','interiorTemplates','textEdits','regionMaps','doorAnimations','cryEdits','hmRules']);
// A map-only save intentionally omits existing split sections. History must
// request a full save whenever it changes any of them, including deletion.
export function saveScopeForEdit(edit){return edit.root.some(([key])=>key==='authoring'||SPLIT_PROJECT_SECTIONS.includes(key))?null:{mapIds:edit.maps.map(map=>map.id)};}
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export function planSave(project,{all=true,mapIds=[]}={},known={assets:new Map(),music:new Map()}){
 const prefix=project.id+':',parts=[],key=(kind,id)=>prefix+kind+':'+id,put=(kind,id,value)=>{const idKey=key(kind,id);parts.push({id:idKey,projectId:project.id,value});return idKey;};
 const assets=new Map(),music=new Map(),mapSet=new Set(mapIds),header={...project,storageFormat:'split-v1'};
 const mapKeys=project.maps.map(m=>{if(all||mapSet.has(m.id))put('map',m.id,m);return key('map',m.id);});header.maps=project.maps.map(m=>({id:m.id,name:m.name}));
 const assetKeys=project.assets.map(a=>{const signature={...a,rom:a.rom?{...a.rom}:undefined},old=known.assets.get(a.id);if(!old||Object.keys(signature).some(k=>signature[k]!==old[k]&&(k!=='rom'||JSON.stringify(signature[k])!==JSON.stringify(old[k]))))put('art',a.id,a);assets.set(a.id,signature);return key('art',a.id);});header.assets=[];
 if(project.authoring)header.authoring={...project.authoring,music:project.authoring.music.map(t=>{const {asset,...metadata}=t;if(!known.music.has(t.id)||known.music.get(t.id)!==asset)put('music',t.id,asset);music.set(t.id,asset);return{...metadata,storageAsset:key('music',t.id)};})};
 const sections={};for(const name of SPLIT_PROJECT_SECTIONS)if(project[name]!==undefined){sections[name]=key('section',name);if(all||!known.sections?.[name])put('section',name,project[name]);delete header[name];}
 header.storageParts={maps:mapKeys,assets:assetKeys,sections};return{header,parts,known:{assets,music,sections}};
}
export function commitSave(db,plan){return new Promise((resolve,reject)=>{const tx=db.transaction(['projects',PARTS_STORE],'readwrite'),store=tx.objectStore(PARTS_STORE);try{for(const part of plan.parts)store.put(part);tx.objectStore('projects').put(plan.header);}catch(error){tx.abort();reject(error);return;}tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Local save was interrupted.'));});}
// These two pure boundaries are shared by IndexedDB and lifecycle regression
// tests. Reassembly never changes the stored header or consumes saved parts.
export function savedProjectKeys(header) {
  const refs = header.storageParts;
  return [...refs.maps, ...refs.assets, ...Object.values(refs.sections || {}),
    ...(header.authoring?.music || []).map(track => track.storageAsset)];
}
export function assembleSavedProject(header, values) {
  if (!header || header.storageFormat !== 'split-v1') return header;
  if (values.length !== savedProjectKeys(header).length)
    throw Error('A saved project section is missing. Import your project backup.');
  const {storageParts: refs, storageFormat, ...project} = header;
  let at = 0;
  project.maps = refs.maps.map(() => values[at++]);
  project.assets = refs.assets.map(() => values[at++]);
  for (const name of Object.keys(refs.sections || {})) project[name] = values[at++];
  if (project.authoring) project.authoring = {...project.authoring,
    music: project.authoring.music.map(({storageAsset, ...track}) => ({...track, asset: values[at++]}))};
  return project;
}
export function readProject(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', PARTS_STORE]), request = tx.objectStore('projects').get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const header = request.result;
      if (!header || header.storageFormat !== 'split-v1') { resolve(header); return; }
      const store = tx.objectStore(PARTS_STORE);
      const gets = savedProjectKeys(header).map(key => req(store.get(key)).then(record => {
        if (!record) throw Error('A saved project section is missing. Import your project backup.');
        return record.value;
      }));
      Promise.all(gets).then(values => resolve(assembleSavedProject(header, values)), reject).catch(reject);
    };
  });
}
export class ProjectStore{
 constructor(db,{workerFactory=null}={}){this.db=db;this.known=null;this.projectId=null;this.workerFactory=workerFactory;this.jobs=new Map();this.serial=0;this.worker=null;}
 async save(project,scope){if(this.projectId!==project.id){this.known=null;this.projectId=project.id;}const plan=planSave(project,this.known?scope:{all:true},this.known||undefined);if(this.workerFactory){try{if(!this.worker){this.worker=this.workerFactory();this.worker.onmessage=e=>{const job=this.jobs.get(e.data.id);if(job){this.jobs.delete(e.data.id);e.data.error?job.reject(Error(e.data.error)):job.resolve();}};this.worker.onerror=()=>{for(const job of this.jobs.values())job.reject(Error('Background saving stopped. Your edits are still open; export a backup.'));this.jobs.clear();this.worker.terminate();this.worker=null;};}await new Promise((resolve,reject)=>{const id=++this.serial;const timer=setTimeout(()=>{this.jobs.delete(id);reject(Error('Background saving timed out.'));},15000);this.jobs.set(id,{resolve:()=>{clearTimeout(timer);resolve();},reject:e=>{clearTimeout(timer);reject(e);}});try{this.worker.postMessage({id,header:plan.header,parts:plan.parts});}catch(e){this.jobs.delete(id);clearTimeout(timer);reject(e);}});}catch(error){this.worker?.terminate();this.worker=null;this.workerFactory=null;await commitSave(this.db,plan);}}else await commitSave(this.db,plan);this.known=plan.known;return{maps:plan.parts.filter(p=>p.id.startsWith(project.id+':map:')).length,parts:plan.parts.length};}
 close(){this.worker?.terminate();this.worker=null;}
}
