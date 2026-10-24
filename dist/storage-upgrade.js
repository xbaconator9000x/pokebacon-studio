// Existing browser work stays in its original database. New installs use the
// current name. Both the foreground app and save worker resolve the same name.
export async function resolveDatabaseName(db=globalThis.indexedDB){
 const current='pokebacon-map-studio-v1';if(!db?.databases)return current;
 const databases=await db.databases();if(databases.some(d=>d.name===current))return current;
 const previous=databases.filter(d=>typeof d.name==='string'&&d.name.endsWith('-map-studio-v1'));
 if(previous.length>1)throw Error('Several earlier editor databases exist. Export backups from the previous editor before upgrading.');
 return previous[0]?.name||current;
}
export function migratePreferences(storage){
 if(!storage||typeof storage.key!=='function')return;
 for(const suffix of ['active-project','welcome-seen','toolbar-v1','asset-browser-v1']){
  const next='pokebacon-'+suffix;if(storage.getItem(next)!==null)continue;
  const matches=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k!==next&&k?.endsWith('-'+suffix))matches.push(k);}
  if(matches.length===1)storage.setItem(next,storage.getItem(matches[0]));
 }
}
try{migratePreferences(globalThis.localStorage);}catch{}
