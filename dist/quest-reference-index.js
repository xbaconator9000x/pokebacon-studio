// Read-only cross-project references for persistent quest flags and counters.
// Uses the exact authoring structures consumed by the native scene compiler;
// does not allocate save bits, rewrite graph links or change a project.
export function questReferenceIndex(project,{limit=5000}={}){
 const flags=new Map((project.questFlags||[]).map(q=>[q.id,[]]));
 const variables=new Map((project.authoring?.variables||[]).map(v=>[v.id,[]]));
 const missing=[],references=[];let count=0;
 function add(kind,id,source,detail){
  if(typeof id!=='string'||!id)return;
  if(++count>limit)throw Error('The quest reference index exceeded its '+limit+'-reference safety limit.');
  const row={kind,id,...source,detail},table=kind==='flag'?flags:variables;
  if(!table.has(id))missing.push(row);
  else table.get(id).push(row);
  references.push(row);
 }
 function conditions(list,source,prefix){
  if(!Array.isArray(list))return;
  list.forEach((c,i)=>{
   if(!c||typeof c!=='object')return;
   const detail=prefix+' requirement '+(i+1);
   if(c.kind==='flag')add('flag',c.flagId,source,detail);
   if(['variable','option'].includes(c.kind))add('variable',c.variableId,source,detail);
   if(c.kind==='event'&&c.eventId){
    const related=(project.maps||[]).flatMap(m=>m.markers||[]).find(n=>n.id===c.eventId);
    if(related?.runtime?.completionFlag)add('flag',related.runtime.completionFlag,source,detail+' (linked completion)');
   }
   if(c.kind==='visited'&&c.mapId){const id=project.authoring?.presentation?.visitFlags?.[c.mapId];if(id)add('flag',id,source,detail+' (map visited)');}
  });
 }
 function walk(steps,source,prefix,depth=0){
  if(depth>8||!Array.isArray(steps))return;
  steps.forEach((step,i)=>{
   if(!step||typeof step!=='object')return;
   const path=prefix+' action '+(i+1)+' ('+(step.type||'unknown')+')';
   if(step.type==='flag')add('flag',step.flagId,source,path);
   if(['set','add'].includes(step.type))add('variable',step.variableId,source,path);
   if(step.type==='quest')add('flag',step.questId,source,path);
   if(step.type==='completeField')add('flag',step.completionFlag,source,path);
   conditions(step.conditions,source,path);
   for(const key of ['then','else','yes','no','cancel'])walk(step[key],source,path+' / '+key,depth+1);
   if(Array.isArray(step.choices))step.choices.forEach((c,j)=>walk(c?.steps,source,path+' / option '+(j+1),depth+1));
  });
 }
 for(const map of project.maps||[]){
  for(const n of map.markers||[]){
   const r=n.runtime;if(!r||r.enabled===false)continue;
   const source={mapId:map.id,mapName:map.name,eventId:n.id,eventName:n.title||'Untitled event',category:'scene'};
   for(const [key,label] of [['completionFlag','Completion state'],['areaActiveFlag','Area-entry latch'],['onceFlag','One-time event']])if(r[key])add('flag',r[key],source,label);
   if(r.counterId)add('variable',r.counterId,source,'Interaction counter');
   conditions(r.conditions,source,'Event');
   if(Array.isArray(r.pages)&&r.pages.length){r.pages.forEach((page,i)=>{if(!page||page.enabled===false)return;conditions(page.conditions,source,'Page '+(i+1));walk(page.steps,source,'Page '+(i+1));});}
   else walk(r.steps,source,'Event');
   walk(r.repeatSteps,source,'Repeat');
  }
  for(const field of map.fieldObjects||[]){
   const source={mapId:map.id,mapName:map.name,eventId:null,eventName:field.name||field.kind||'Field object',category:'field'};
   for(const key of ['completionFlag','permanentFlag','activeFlag','openedFlag'])if(field[key])add('flag',field[key],source,'Field state · '+key);
  }
 }
 for(const v of project.authoring?.variables||[])for(const id of v.bitIds||[])add('flag',id,{mapId:null,mapName:'Project',eventId:null,eventName:v.name,category:'storage'},'Reserved counter storage bit');
 for(const [mapId,id]of Object.entries(project.authoring?.presentation?.visitFlags||{}))add('flag',id,{mapId,mapName:project.maps?.find(m=>m.id===mapId)?.name||'Map',eventId:null,eventName:'Map visit tracking',category:'presentation'},'Visited location marker');
 return{flags,variables,missing,references,usedFlags:[...flags].filter(([,refs])=>refs.length).length,usedVariables:[...variables].filter(([,refs])=>refs.length).length};
}
