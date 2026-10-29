import {hmAllowed} from './hm-rules.js';
// Shared authoring data. References are stable IDs; drafts may contain unresolved IDs.
import {effectIssues} from './scene-effects.js';
import {uid,inBounds} from './model.js';
import {addQuestFlag} from './quest-model.js';
import {wrapDialogue,movementAt} from './world-model.js';

export const STUDIO_COLLECTIONS=['variables','actors','items','music','dialogues','sequences','options'];
export const DIRECTIONS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export function authoring(project){return project.authoring??={version:1,variables:[],actors:[],items:[],music:[],dialogues:[],sequences:[],options:[],presentation:{texts:{},scenes:[],playerLooks:[]}};}
export function readAuthoring(project){return project.authoring||{version:1,variables:[],actors:[],items:[],music:[],dialogues:[],sequences:[],options:[],presentation:{texts:{},scenes:[],playerLooks:[]}};}
export function addVariable(project,name,{bits=8,kind='counter',id=uid()}={}){
  if(![4,8,16].includes(bits))throw Error('Use a 4, 8 or 16-bit counter.');
  const data=authoring(project),existing=data.variables.find(v=>v.id===id);if(existing)return existing;
  const next=(project.questFlags||[]).reduce((n,q)=>Math.max(n,q.slot+1),0);if(next+bits>1024)throw Error('Not enough project save bits remain for this counter.');
  const v={id,name:String(name||'Counter').slice(0,80),bits,kind,bitIds:[]};
  for(let i=0;i<bits;i++){const q=addQuestFlag(project,v.name+' · bit '+i);q.hidden=true;q.ownerId=id;v.bitIds.push(q.id);}data.variables.push(v);return v;
}
export function completionFlag(project,n){if(!n.runtime.completionFlag){const q=addQuestFlag(project,'Completed: '+n.title);q.hidden=true;q.ownerId=n.id;n.runtime.completionFlag=q.id;}return n.runtime.completionFlag;}
export function prepareScene(project,n){completionFlag(project,n);if(['radius','area'].includes(n.runtime.trigger)&&!n.runtime.areaActiveFlag){const q=addQuestFlag(project,'Inside: '+n.title);q.hidden=true;q.ownerId=n.id;n.runtime.areaActiveFlag=q.id;}const a=authoring(project);for(const c of [...n.runtime.conditions||[],...sceneActions(n).flatMap(s=>s.conditions||[])])if(c.kind==='visited'&&c.mapId){a.presentation.visitFlags??={};if(!a.presentation.visitFlags[c.mapId]){const q=addQuestFlag(project,'Visited: '+(project.maps.find(m=>m.id===c.mapId)?.name||c.mapId));q.hidden=true;q.ownerId=c.mapId;a.presentation.visitFlags[c.mapId]=q.id;}}}
export function newScene(project,x,y){return{id:uid(),x,y,title:'New scene',kind:'event',text:'',runtime:{action:'scene',trigger:'interact',enabled:true,blocksMovement:false,repeat:'always',conditions:[],steps:[{id:uid(),type:'say',text:'Hello there!',fit:true,scroll:false}],repeatSteps:[]}};}
export function flattenActions(steps,depth=0){if(depth>8)throw Error('Keep branching within eight levels.');if(steps!==undefined&&!Array.isArray(steps))throw Error('An action queue must be a list.');const out=[];for(const s of steps||[]){if(!s||typeof s.type!=='string')throw Error('An action has an invalid type.');out.push(s);for(const key of ['then','else','yes','no','cancel'])if(s[key])out.push(...flattenActions(s[key],depth+1));for(const c of s.choices||[])out.push(...flattenActions(c.steps,depth+1));if(out.length>256)throw Error('Keep one scene within 256 actions.');}return out;}
export function sceneActions(n){return [...flattenActions(n.runtime?.steps),...flattenActions(n.runtime?.repeatSteps)];}
export function findEvent(project,id){for(const map of project.maps){const marker=map.markers.find(n=>n.id===id);if(marker)return{map,n:marker};}return null;}
export function sceneCells(n,map){const r=n.runtime;
  if(r.trigger==='radius'){const radius=Math.max(1,Math.min(8,Math.round(r.radius||2))),out=[];for(let y=n.y-radius;y<=n.y+radius;y++)for(let x=n.x-radius;x<=n.x+radius;x++)if(inBounds(map,x,y)&&Math.abs(x-n.x)+Math.abs(y-n.y)<=radius)out.push({x,y});return out;}
  if(r.trigger==='area'){const a=r.area;if(!a||![a.x,a.y,a.width,a.height].every(Number.isInteger)||a.width<1||a.height<1||a.width>256||a.height>256)return[];const out=[];for(let y=Math.max(0,a.y);y<Math.min(map.height,a.y+a.height);y++)for(let x=Math.max(0,a.x);x<Math.min(map.width,a.x+a.width);x++)if(inBounds(map,x,y))out.push({x,y});return out;}
  return[{x:n.x,y:n.y}];
}
export function pathDirections(points){const out=[];for(let i=1;i<(points||[]).length;i++){let x=points[i-1].x,y=points[i-1].y;const to=points[i];while(x!==to.x||y!==to.y){const d=x<to.x?'right':x>to.x?'left':y<to.y?'down':'up';out.push(d);x+=DIRECTIONS[d][0];y+=DIRECTIONS[d][1];if(out.length>256)throw Error('Keep a drawn path within 256 tile steps.');}}return out;}
export function compareValue(a,operator,b){return({eq:a===b,ne:a!==b,gt:a>b,ge:a>=b,lt:a<b,le:a<=b})[operator||'ge']??false;}
export function conditionMet(c,project,state={}){
  const flags=state.quests||state.flags||new Set(),vars=state.variables||new Map();
  if(c.kind==='flag')return flags.has(c.flagId)===(c.value!==false);
  if(c.kind==='event'){const n=findEvent(project,c.eventId)?.n;return !!n&&flags.has(n.runtime?.completionFlag)===(c.value!==false);}
  if(c.kind==='variable'||c.kind==='option')return compareValue(vars.get(c.variableId)||0,c.operator,c.value||0);
  if(c.kind==='badge')return state.hmBadges?.has(+c.badge)||false;
  if(c.kind==='hm')return project.hmRules?.moves?.[c.hm]?hmAllowed(project,c.hm,state):state.hmMoves?.has(c.hm)||false;
  if(c.kind==='item')return (state.bag?.get(c.itemRef||+c.itemId)||0)>=(c.quantity||1);
  if(c.kind==='visited')return flags.has(readAuthoring(project).presentation.visitFlags?.[c.mapId])===(c.value!==false);
  if(c.kind==='money')return (state.money||0)>=(c.amount||0);
  return false;
}
export function conditionIssues(c,p,path='Requirement'){
  const a=readAuthoring(p),error=message=>[{path,message,severity:'error'}];if(!c)return error('Choose a requirement.');
  if(c.kind==='flag'&&!p.questFlags?.some(q=>q.id===c.flagId))return error('Choose a saved flag, or create it later.');
  if(['variable','option'].includes(c.kind)&&!a.variables.some(v=>v.id===c.variableId))return error('Choose a saved counter / option.');
  if(c.kind==='event'&&!findEvent(p,c.eventId))return error('Choose the linked event.');
  if(c.kind==='visited'&&!p.maps.some(m=>m.id===c.mapId))return error('Choose the location to visit.');
  if(c.kind==='badge'&&(!Number.isInteger(+c.badge)||+c.badge<1||+c.badge>8))return error('Choose a badge.');
  if(c.kind==='hm'&&!['cut','fly','surf','strength','flash','rocksmash','waterfall','dive'].includes(c.hm))return error('Choose an HM.');
  if(c.kind==='item'&&!(c.itemRef?a.items.some(v=>v.id===c.itemRef):Number.isInteger(+c.itemId)&&+c.itemId>0))return error('Choose an item.');
  if(!['flag','variable','option','event','visited','badge','hm','item','money'].includes(c.kind))return error('Choose a requirement type.');return[];
}
export function sceneIssues(n,p,map,{native=false}={}){
  const issues=[],r=n.runtime,a=readAuthoring(p),add=(path,message,severity='error')=>issues.push({path,message,severity});
  if(!r||r.action!=='scene')return issues;
  if(!inBounds(map,n.x,n.y))add('Trigger','Place the event inside its map.');
  if(r.trigger==='area'&&(!r.area||!sceneCells(n,map).length))add('Trigger','Draw a trigger area.');
  if(!['interact','step','radius','area','enter','portal'].includes(r.trigger))add('Trigger','Choose a trigger.');
  if(native&&(r.trigger==='portal'||r.trigger==='enter'&&!map.rom?.generated))add('Trigger','Native '+r.trigger+' hooks are not verified for this map. Use a step or drawn area at the arrival tile. Map-enter scenes are supported on newly generated maps.');
  if(native&&['area','radius'].includes(r.trigger)&&sceneCells(n,map).length>200)add('Trigger','Use an area of at most 200 tiles for native coordinate events.');
  for(const [i,c]of (r.conditions||[]).entries())issues.push(...conditionIssues(c,p,'Requirement '+(i+1)));
  if(!r.steps?.length)add('Actions','Add at least one action.');
  const actions=sceneActions(n);if(actions.length>256)add('Actions','Keep one scene within 256 actions.');
  for(const [i,s]of actions.entries()){
    const at='Action '+(i+1);for(const message of effectIssues(s,map))add(at,message);if(s.type==='completeField'&&!map.fieldObjects?.some(o=>o.id===s.targetId&&o.permanent))add(at,'Choose a permanent HM object.');
    if(['say','choice','answers'].includes(s.type)){const value=s.dialogueId?a.dialogues.find(d=>d.id===s.dialogueId)?.text:s.text;if(!value?.trim())add(at,s.dialogueId?'The linked dialogue is missing.':'Write the dialogue / question.');else try{wrapDialogue(value);}catch(e){add(at,e.message);}}
    if(s.type==='answers'&&(!s.id||!Array.isArray(s.choices)||s.choices.length<2||s.choices.length>4||s.choices.some(c=>!c.label?.trim()||c.label.length>24)))add(at,'Add two to four labelled answers (up to 24 characters each).');
    if(!['say','choice','answers','if','path','face','emote','visible','wait','flag','set','add','item','money','cry','music','sound','fade','warp','heal','gate','hm','stop','abort','shop','battle','giveMon','portrait','shake','weather','rockfall','completeField','respawn'].includes(s.type))add(at,'This action type is not supported.');
    if(['set','add'].includes(s.type)&&(!Number.isInteger(+s.value)||Math.abs(+s.value)>65535))add(at,'Use a whole number between -65,535 and 65,535.');
    if(['cry','portrait','giveMon'].includes(s.type)&&(!Number.isInteger(+s.species)||+s.species<1))add(at,'Choose a native Pokémon.');
    if(s.type==='giveMon'&&(!Number.isInteger(+s.level)||+s.level<1||+s.level>100))add(at,'Use a level from 1 to 100.');
    if(s.type==='battle'&&(!Number.isInteger(+s.trainerId)||+s.trainerId<1))add(at,'Choose a native trainer.');
    if(s.type==='shop'&&(!s.items?.length||s.items.length>50||s.items.some(i=>typeof i==='string'?!a.items.some(v=>v.id===i):!Number.isInteger(i)||i<1)))add(at,'Choose 1–50 shop items.');
    if(s.type==='if'){if(!s.conditions?.length)add(at,'Add a branch condition.');for(const c of s.conditions||[])issues.push(...conditionIssues(c,p,at));}
    if(['set','add'].includes(s.type)&&!a.variables.some(v=>v.id===s.variableId))add(at,'Choose a saved counter.');
    if(s.type==='respawn'&&(!Number.isInteger(s.healId)||s.healId<1||s.healId>20))add(at,'Use a healing checkpoint from 1 to 20.');
    if(s.type==='flag'&&!p.questFlags?.some(q=>q.id===s.flagId))add(at,'Choose a saved flag.');
    if(['path','face','emote','visible'].includes(s.type)&&s.actorId!=='player'&&s.actorId!=='self'&&!map.markers.some(m=>m.id===s.actorId&&(m.npc||m.rom?.type==='npc')))add(at,'Choose a character placed on this map.');
    if(s.actorId==='self'&&['path','face','emote','visible'].includes(s.type)&&!n.npc&&n.rom?.type!=='npc')add(at,'This event has no character appearance. Choose Player or another NPC.');
    if(s.type==='path'){if(!s.points?.length||s.points.length<2)add(at,'Draw the movement path.');else{try{const dirs=pathDirections(s.points);let{x,y}=s.points[0];for(const d of dirs){x+=DIRECTIONS[d][0];y+=DIRECTIONS[d][1];if(!inBounds(map,x,y)||movementAt(map,x,y,{ignoreFieldObjects:true}).collision){add(at,'The path crosses blocked or out-of-bounds ground.');break;}}}catch(e){add(at,e.message);}}}
    if(s.type==='gate'&&!map.gates?.some(g=>g.id===s.gateId))add(at,'Choose a gate on this map.');
    if(s.type==='warp'){const m=p.maps.find(m=>m.id===s.to?.mapId);if(!m||!inBounds(m,s.to.x,s.to.y))add(at,'Choose a destination tile.');}
    if(s.type==='item'&&s.itemRef&&!a.items.some(v=>v.id===s.itemRef))add(at,'The custom item is missing.');
    if(s.type==='music'&&s.trackId&&!a.music.some(t=>t.id===s.trackId))add(at,'The imported track is missing.');
    if(s.type==='cry'&&(!Number.isInteger(+s.species)||+s.species<1))add(at,'Choose a Pokémon cry.');
    if(s.type==='wait'&&(!Number.isInteger(+s.frames)||+s.frames<1||+s.frames>36000))add(at,'Use 1–36,000 frames.');
  }
  if(r.counterId&&!a.variables.some(v=>v.id===r.counterId))add('Repeat','The linked interaction counter is missing.');return issues;
}
export function usedAuthoring(p){const music=new Set(),items=new Set(),actors=new Set();for(const map of p.maps){if(map.audio?.trackId)music.add(map.audio.trackId);for(const n of map.markers){if(n.runtime?.enabled===false)continue;if(n.npc?.actorId)actors.add(n.npc.actorId);for(const c of n.runtime?.conditions||[])if(c.itemRef)items.add(c.itemRef);for(const s of sceneActions(n)){if(s.trackId)music.add(s.trackId);if(s.itemRef)items.add(s.itemRef);if(s.type==='shop')for(const id of s.items||[])if(typeof id==='string')items.add(id);for(const c of s.conditions||[])if(c.itemRef)items.add(c.itemRef);}}}const opening=readAuthoring(p).presentation?.scenes?.find(s=>s.id===readAuthoring(p).presentation?.nativeTimelineId);for(const step of opening?.steps||[])if(step.trackId)music.add(step.trackId);return{music,items,actors};}
export function authoringIssues(p,{native=false}={}){const out=[];for(const map of p.maps)for(const n of map.markers)if(n.runtime?.enabled!==false)for(const issue of sceneIssues(n,p,map,{native}))out.push({...issue,eventId:n.id,mapId:map.id,path:map.name+' / '+n.title+' / '+issue.path});return out;}
export function validateAuthoring(p){if(p.authoring===undefined)return;const a=p.authoring;if(!a||a.version!==1||JSON.stringify(a).length>48e6)throw Error('The game-authoring data is too large or invalid.');for(const key of STUDIO_COLLECTIONS){if(!Array.isArray(a[key])||a[key].length>512)throw Error('Too many '+key+' in this project.');const ids=new Set();for(const r of a[key]){if(!r||typeof r.id!=='string'||ids.has(r.id)||typeof r.name!=='string'||r.name.length>120)throw Error('An authoring record has an invalid ID or name.');ids.add(r.id);}}for(const v of a.variables)if(![4,8,16].includes(v.bits)||!Array.isArray(v.bitIds)||v.bitIds.length!==v.bits||v.bitIds.some(id=>!p.questFlags?.some(q=>q.id===id)))throw Error('A persistent counter has invalid save bits.');}
