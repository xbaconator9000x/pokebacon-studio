// Project-side event pages. Later matching pages have priority.
export const MAX_SCENE_PAGES=16;
export function scenePages(runtime){return Array.isArray(runtime?.pages)&&runtime.pages.length?runtime.pages:null;}
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
function copyActions(steps,newId){
 if(!Array.isArray(steps))throw Error('Cannot duplicate a page with invalid actions.');
 return steps.map(step=>{
  if(!step||typeof step!=='object'||Array.isArray(step))throw Error('Cannot duplicate an invalid event action.');
  const copy=structuredClone(step),id=newId();
  if(typeof id!=='string'||!id.trim())throw Error('A copied event action needs a stable ID.');
  copy.id=id;
  for(const key of ['yes','no','then','else','cancel'])if(copy[key]!==undefined)copy[key]=copyActions(copy[key],newId);
  if(copy.choices!==undefined){
   if(!Array.isArray(copy.choices))throw Error('Cannot duplicate an invalid choice list.');
   copy.choices=copy.choices.map(choice=>({...choice,steps:copyActions(choice.steps||[],newId)}));
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
 const pages=enableScenePages(runtime,newId);
 pages.push(page);
 return page;
}
export function chooseScenePage(runtime,satisfies){
 const pages=scenePages(runtime);if(!pages)return null;
 for(let i=pages.length-1;i>=0;i--){
  const page=pages[i];
  if(!page||!Array.isArray(page.conditions))continue;
  if(page.enabled!==false&&page.conditions.every(satisfies))return page;
 }
 return null;
}
export function pageStructureIssues(runtime){
 if(runtime?.pages===undefined)return[];
 if(!Array.isArray(runtime.pages)||!runtime.pages.length||runtime.pages.length>MAX_SCENE_PAGES)return['An event needs 1–16 pages.'];
 const ids=new Set(),errors=[];
 runtime.pages.forEach((page,i)=>{
  const at='Page '+(i+1);
  if(!page||typeof page!=='object'||Array.isArray(page)){errors.push(at+' is not a valid event page.');return;}
  if(typeof page.id!=='string'||!page.id.trim()||ids.has(page.id))errors.push(at+' has a missing or duplicate stable ID.');
  if(page.id)ids.add(page.id);
  if(typeof page.name!=='string'||!page.name.trim()||page.name.length>120)errors.push(at+' needs a name of 1–120 characters.');
  if(!Array.isArray(page.conditions)||page.conditions.length>32)errors.push(at+' has an invalid prerequisite list.');
  if(!Array.isArray(page.steps)||!page.steps.length||page.steps.length>256)errors.push(at+' needs 1–256 actions.');
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
