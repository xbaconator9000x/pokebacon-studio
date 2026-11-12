import {sceneIssues} from './authoring-model.js';

// Fail before ROM allocator, script graph scans or graphics compilation. A
// saved visual draft can be incomplete, but a playable export must never
// silently skip it, render a damaged page, or partially install its scripts.
// Only the maps selected for this original ROM are evaluated.
export function assertNativeSceneExportReady(project,maps){
 let checked=0;
 for(const map of maps){
  for(const marker of map.markers||[]){
   if(marker.runtime?.action!=='scene'||marker.runtime.enabled===false)continue;
   let issues;
   try{issues=sceneIssues(marker,project,map,{native:true});}
   catch(error){throw Error((map.name||'Map')+' / '+(marker.title||'Scene')+': imported scene data needs repair — '+error.message);}
   const error=issues.find(issue=>issue.severity!=='warning');
   if(error)throw Error((map.name||'Map')+' / '+(marker.title||'Scene')+' / '+error.path+': '+error.message+' No ROM was exported; your draft remains saved.');
   checked++;
  }
 }
 return{scenes:checked,maps:maps.length};
}
