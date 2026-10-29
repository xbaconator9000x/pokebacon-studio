import{makeZipAsync}from'./zip.js';
export function archiveProject(project){
 // The archive already carries the complete original source as a binary file.
 // Keeping its base64 gzip copy in the JSON duplicates it and increases peak
 // Android bridge memory. Authored project fields and source identities remain.
 const{romRoundTrip,...copy}=project;return copy;
}
export function makeROMArchive(compiled,source,project,filename,options={}){
 return makeZipAsync([[filename,compiled],['original-source.gba',source],['project.pokebacon.json',JSON.stringify(archiveProject(project))],['EDITING.txt','Open project.pokebacon.json to retain editable objects, layers, collision and exits. Open original-source.gba as its source ROM when compiling again. The other GBA file is the playable result. This archive stores the full original source separately rather than duplicating it inside the JSON.']],options);
}
