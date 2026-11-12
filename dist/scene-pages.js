// Project-side event pages. Later matching pages have priority.
export const MAX_SCENE_PAGES=16;
export function scenePages(runtime){return Array.isArray(runtime?.pages)&&runtime.pages.length?runtime.pages:null;}
// Keep the mobile scene list accurate even when the original flat action queue
// was moved into event pages; imported broken pages remain visible for repair.
export function scenePageSummary(runtime){const pages=scenePages(runtime);if(!pages)return (Array.isArray(runtime?.steps)?runtime.steps.length:0)+' actions';const actions=pages.reduce((count,page)=>count+(Array.isArray(page?.steps)?page.steps.length:0),0);return actions+' actions · '+pages.length+' page'+(pages.length===1?'':'s');}
export function enableScenePages(runtime,newId){
 if(!runtime||runtime.action!=='scene')throw Error('Only visual scenes can have event pages.');
 if(runtime.pages!==undefined&&!scenePages(runtime))throw Error('Invalid existing event pages. Repair the saved page list before editing.');
 if(!scenePages(runtime)){
  const id=newId();
  if(typeof id!=='string'||!id.trim())throw Error('A new event page needs a stable ID.');
  runtime.pages=[{id,name:'Page 1',enabled:true,conditions:[],steps:runtime.steps||[]}];
  runtime.steps=[];
 }
 return runtime.pages;
}
// Duplicating an event page must allocate new identities for *all* nested
// actions. Keeping the original action IDs causes collisions when two pages
// are subsequently edited, linked or copied through the project editor.
function copyActions(steps,newId,depth=0){
 if(depth>8)throw Error('Cannot duplicate a page nested more than eight levels.');
 if(!Array.isArray(steps)||steps.length>256)throw Error('Cannot duplicate a page with invalid actions.');
 return steps.map(step=>{
  if(!step||typeof step!=='object'||Array.isArray(step))throw Error('Cannot duplicate an invalid event action.');
  const copy=structuredClone(step),id=newId();
  if(typeof id!=='string'||!id.trim())throw Error('A copied event action needs a stable ID.');
  copy.id=id;
  for(const key of ['yes','no','then','else','cancel'])if(copy[key]!==undefined)copy[key]=copyActions(copy[key],newId,depth+1);
  if(copy.choices!==undefined){
   if(!Array.isArray(copy.choices))throw Error('Cannot duplicate an invalid choice list.');
   copy.choices=copy.choices.map(choice=>({...choice,steps:copyActions(choice.steps||[],newId,depth+1)}));
  }
  return copy;
 });
}
export function addScenePage(runtime,newId,from=null){
 if(!runtime||runtime.action!=='scene')throw Error('Only visual scenes can have event pages.');
 if(runtime.pages!==undefined&&!scenePages(runtime))throw Error('Invalid existing event pages. Repair the saved page list before editing.');
 if(scenePages(runtime)?.length>=MAX_SCENE_PAGES)throw Error('An event supports at most 16 pages.');
 const number=(scenePages(runtime)?.length||1)+1;
 const page=from?{...structuredClone(from),id:newId(),name:from.name+' copy',conditions:structuredClone(from.conditions),steps:copyActions(from.steps,newId)}
  :{id:newId(),name:'Page '+number,enabled:true,conditions:[],steps:[{id:newId(),type:'say',text:'Hello there!',fit:true}]};
 // Validate the draft *before* enabling pages so malformed input cannot
 // partially consume the existing unsplit scene actions.
 if(pageStructureIssues({pages:[page]}).length)throw Error('The new event page is incomplete or invalid.');
 // Validate the *whole* destination, including collisions with existing
 // pages and action IDs. For a first conversion, prepare the base page in a
 // temporary array and commit only after every ID has been checked.
 let pages=scenePages(runtime);
 if(!pages){
  const id=newId();
  if(typeof id!=='string'||!id.trim())throw Error('A new event page needs a stable ID.');
  pages=[{id,name:'Page 1',enabled:true,conditions:[],steps:runtime.steps||[]}];
 }
 const candidate=[...pages,page],issues=pageStructureIssues({pages:candidate});
 if(issues.length)throw Error('Cannot add event page: '+issues[0]);
 runtime.pages=candidate;
 runtime.steps=[];
 return page;
}
export function chooseScenePage(runtime,satisfies){
 const pages=scenePages(runtime);if(!pages)return null;
 for(let i=pages.length-1;i>=0;i--){
  const page=pages[i];
  if(!page||!Array.isArray(page.conditions)||page.conditions.some(c=>!c||typeof c!=='object'||typeof c.kind!=='string')||!Array.isArray(page.steps))continue;
  if(page.enabled!==false&&page.conditions.every(satisfies))return page;
 }
 return null;
}
// Validate the shape of imported/recovered page actions before the editor tries
// to render, duplicate or export them. Detailed action *meaning* is validated by
// sceneIssues; structural corruption belongs to the explicit repair flow.
function nestedActionIssues(steps,path,ids,stats,depth=0){
 const errors=[];
 if(depth>8)return[path+' is nested too deeply (maximum 8 levels).'];
 if(!Array.isArray(steps))return[path+' must be an action list.'];
 if(steps.length>256)return[path+' has more than 256 actions.'];
 for(let i=0;i<steps.length;i++){
  if(++stats.total>1024){errors.push('The event page list has too many actions to inspect.');break;}
  const at=path+' / action '+(i+1),action=steps[i];
  if(!action||typeof action!=='object'||Array.isArray(action)){errors.push(at+' is not a valid action.');continue;}
  if(typeof action.type!=='string'||!action.type.trim())errors.push(at+' needs an action type.');
  if(action.id!==undefined){
   if(typeof action.id!=='string'||!action.id.trim()||ids.has(action.id))errors.push(at+' has a missing or duplicate stable action ID.');
   else ids.add(action.id);
  }
  for(const key of ['then','else','yes','no','cancel'])if(action[key]!==undefined)errors.push(...nestedActionIssues(action[key],at+' / '+key,ids,stats,depth+1));
  if(action.choices!==undefined){
   if(!Array.isArray(action.choices)||action.choices.length>16)errors.push(at+' has an invalid answer list.');
   else action.choices.forEach((choice,j)=>{
    if(!choice||typeof choice!=='object'||Array.isArray(choice)){errors.push(at+' / answer '+(j+1)+' is invalid.');return;}
    if(choice.steps!==undefined)errors.push(...nestedActionIssues(choice.steps,at+' / answer '+(j+1),ids,stats,depth+1));
   });
  }
 }
 return errors;
}
export function pageStructureIssues(runtime){
 if(runtime?.pages===undefined)return[];
 if(!Array.isArray(runtime.pages)||!runtime.pages.length||runtime.pages.length>MAX_SCENE_PAGES)return['An event needs 1–16 pages.'];
 const ids=new Set(),actionIds=new Set(),stats={total:0},errors=[];
 runtime.pages.forEach((page,i)=>{
  const at='Page '+(i+1);
  if(!page||typeof page!=='object'||Array.isArray(page)){errors.push(at+' is not a valid event page.');return;}
  if(typeof page.id!=='string'||!page.id.trim()||ids.has(page.id))errors.push(at+' has a missing or duplicate stable ID.');
  if(page.id)ids.add(page.id);
  if(typeof page.name!=='string'||!page.name.trim()||page.name.length>120)errors.push(at+' needs a name of 1–120 characters.');
  if(page.enabled!==undefined&&typeof page.enabled!=='boolean')errors.push(at+' has an invalid enabled setting.');
  if(!Array.isArray(page.conditions)||page.conditions.length>32)errors.push(at+' has an invalid prerequisite list.');
  else page.conditions.forEach((condition,j)=>{if(!condition||typeof condition!=='object'||Array.isArray(condition)||typeof condition.kind!=='string')errors.push(at+' / prerequisite '+(j+1)+' is invalid.');});
  if(!Array.isArray(page.steps)||!page.steps.length||page.steps.length>256)errors.push(at+' needs 1–256 actions.');
  else errors.push(...nestedActionIssues(page.steps,at,actionIds,stats));
 });
 return errors;
}

/** Repair an imported page list explicitly without discarding the original on failure. */
export function replaceScenePagesFromJson(runtime,text){
 if(!runtime||runtime.action!=='scene'||typeof text!=='string'||text.length>2_000_000)throw Error('A scene page repair must be JSON of up to 2 MB.');
 let pages;try{pages=JSON.parse(text);}catch{throw Error('Page repair JSON is not valid. The original pages are untouched.');}
 const issues=pageStructureIssues({pages});
 if(issues.length)throw Error(issues[0]+' The original pages are untouched.');
 runtime.pages=structuredClone(pages);
 return runtime.pages;
}
