import {needsQuest,validateEvent} from './event-model.js';
import {verifiedQuestSource} from './quest-runtime.js';
import {hasHMRules,hmNeedsQuest} from './hm-rules.js';
// This is an authoring preflight. Only compilation and emulator tests establish native correctness.
export function releaseAudit(project,{sourceHash=null,startMapId=null}={}) {
 const findings=[],add=(severity,code,message,mapId)=>findings.push({severity,code,message,...(mapId?{mapId}:{})});
 const maps=project.maps||[],byId=new Map(maps.map(m=>[m.id,m])),edges=new Map(maps.map(m=>[m.id,new Set()]));
 const connect=(from,to)=>{if(byId.has(from)&&byId.has(to))edges.get(from).add(to);};
 let persistent=hasHMRules(project)&&hmNeedsQuest(project);
 for(const map of maps){
  if(map.cartographer?.notes?.length)add('warning','cartographer-review',map.name+': '+map.cartographer.notes.join(' '),map.id);
  if(!map.rom)add('error','unbound-map',map.name+': assign a native ROM map slot before export.',map.id);
  for(const marker of map.markers||[]){if(!marker.runtime||marker.runtime.enabled===false)continue;
   persistent ||= needsQuest(marker);
   try{validateEvent(marker,project,map);}catch(e){add('error','event-invalid',map.name+': '+e.message,map.id);}
   for(const step of marker.runtime.steps||[]){if(step.type==='warp')connect(map.id,step.to?.mapId);}
  }
 }
 for(const link of project.links||[]){if(!link.runtime&&!link.seam)continue;
  const from=link.from,to=link.to;
  for(const endpoint of [from,to]){const map=byId.get(endpoint?.mapId);if(!map||!Number.isInteger(endpoint.x)||!Number.isInteger(endpoint.y)||endpoint.x<0||endpoint.y<0||endpoint.x>=map.width||endpoint.y>=map.height)add('error','exit-invalid','A playable connection has a missing or out-of-bounds endpoint.');}
  connect(from?.mapId,to?.mapId);
  if(link.twoWay||link.seam)connect(to?.mapId,from?.mapId);
 }
 if(persistent&&!verifiedQuestSource(sourceHash))add('error','save-adapter','Saved quest progress or persistent field rules require a verified save adapter for the opened ROM.');
 if(!sourceHash)add('warning','rom-not-open','Open the target ROM to check native compatibility and compile capacity.');
 if(project.sourceEngine)add('warning','source-build','Source configuration requires an external toolchain. Binary map/event edits are not source-map edits.');
 if(startMapId){if(!byId.has(startMapId))add('error','start-missing','The selected starting map does not exist.');else{const reached=new Set([startMapId]),queue=[startMapId];for(let i=0;i<queue.length;i++)for(const id of edges.get(queue[i])||[])if(!reached.has(id)){reached.add(id);queue.push(id);}for(const map of maps)if(!reached.has(map.id))add('warning','reachability-unproven',map.name+': no authored connection from the selected start was found. Native scripts may provide another route.',map.id);}}
 add('warning','playtest-required','Compile and test the exported ROM: new game, progression, save, reload, completion and a fresh boot. Editor preview does not verify these.');
 return {format:'pokebacon-release-audit',version:1,readyToCompile:!findings.some(f=>f.severity==='error'),persistentStateRequired:!!persistent,findings};
}
