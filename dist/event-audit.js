// Read-only project-wide authored event health analysis. It never repairs,
// replaces or rewrites imported original GBA commands or project records.
import {sequenceOf,validateEvent} from './event-model.js';
import {sceneIssues} from './authoring-model.js';
import {scenePages} from './scene-pages.js';
export function auditEventWorkflows(project,{limit=10000}={}){
 if(!project||!Array.isArray(project.maps)||!Number.isInteger(limit)||limit<1||limit>10000)
  throw Error('Choose a project and a bounded authored-event review.');
 const records=[],tileUsers=new Map(),flagUsers=new Map();
 let scanned=0;
 for(const map of project.maps){
  for(const n of map.markers||[]){
   if(!n.runtime)continue;
   if(++scanned>limit)throw Error('The project has more authored events than the 10,000-event audit cap.');
   const issues=[],r=n.runtime,at=String(map.id)+':'+n.x+':'+n.y+':'+(r.trigger||'interact');
   const add=(severity,message)=>issues.push({severity,message});
   if(r.enabled!==false&&['step','interact'].includes(r.trigger||'interact')){
    if(!tileUsers.has(at))tileUsers.set(at,[]);
    tileUsers.get(at).push({n,issues});
   }
   try{
    if(r.action==='scene'){
     for(const issue of sceneIssues(n,project,map))add(issue.severity==='warning'?'warning':'error',issue.path+': '+issue.message);
    }else validateEvent(n,project,map);
   }catch(error){add('error',error.message);}
   let steps=[];
   try{steps=sequenceOf(n);}catch(error){add('error','Invalid nested actions: '+error.message);}
   if(r.once===true&&!r.onceFlag&&r.action!=='scene')
    add('warning','One-time event has not been saved with its persistent quest flag.');
   if(r.action==='scene'&&r.repeat==='once'&&!r.completionFlag)
    add('warning','One-time scene has no persistent completion flag.');
   const completion=r.action==='scene'?r.completionFlag:r.onceFlag;
   if(completion){
    if(!flagUsers.has(completion))flagUsers.set(completion,[]);
    flagUsers.get(completion).push({n,issues});
   }
   const inspectList=list=>{
    for(let i=0;i<list.length;i++){
     const step=list[i],later=list.slice(i+1,i+3);
     if(step?.type==='item'&&step.operation==='give'&&later.some(next=>next?.type==='item'&&next.operation==='take'))
      add('warning','Reward-first item exchange can partially complete. Replace the two item actions with one atomic Trade action.');
     for(const key of ['yes','no','then','else','cancel'])if(Array.isArray(step?.[key]))inspectList(step[key]);
     if(Array.isArray(step?.choices))for(const choice of step.choices)if(Array.isArray(choice.steps))inspectList(choice.steps);
    }
   };
   if(r.action==='scene'&&scenePages(r)){for(const page of r.pages||[])if(Array.isArray(page?.steps))inspectList(page.steps);}
   else if(Array.isArray(r.steps))inspectList(r.steps);
   if(r.action==='scene'&&r.trigger==='portal')add('warning','Portal-triggered visual scenes require a runtime adapter; use a native step trigger for confirmed ROM export.');
   records.push({mapId:map.id,mapName:map.name||String(map.id),eventId:n.id,name:n.title||'Untitled event',
    kind:r.action||'legacy',trigger:r.trigger||'interact',enabled:r.enabled!==false,issues});
  }
 }
 for(const users of tileUsers.values())if(users.length>1)
  for(const user of users)user.issues.push({severity:'warning',
   message:'Multiple authored events share this trigger and tile; native execution priority may be ambiguous.'});
 for(const users of flagUsers.values())if(users.length>1)
  for(const user of users)user.issues.push({severity:'warning',
   message:'A persistent completion flag is shared by multiple events; verify that the linked completion is intentional.'});
 const errorCount=records.reduce((n,row)=>n+row.issues.filter(x=>x.severity==='error').length,0);
 const warningCount=records.reduce((n,row)=>n+row.issues.filter(x=>x.severity==='warning').length,0);
 return {scanned,errors:errorCount,warnings:warningCount,records};
}
