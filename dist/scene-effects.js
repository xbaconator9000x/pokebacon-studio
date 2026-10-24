import {verifiedQuestSource} from './quest-runtime.js';
import {verifiedFRLGSource} from './verified-frlg.js';
import {MAP_WEATHER} from './map-environment.js';
const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
export function effectIssues(s,map){
 if(s.type==='shake')return !integer(s.x,0,16)||!integer(s.y,0,16)||!integer(s.count,2,100)||s.count%2||!integer(s.interval,1,60)?['Shake needs X/Y 0–16, an even count 2–100, and interval 1–60.']:[];
 if(s.type==='weather')return MAP_WEATHER.some(([id])=>id===s.weather)?[]:['Choose a supported weather.'];
 if(s.type==='rockfall'){const n=map.markers.find(n=>n.id===s.actorId)||map.fieldObjects?.find(o=>o.id===s.actorId);return !n||(!['strength','rocksmash'].includes(n.kind)&&!n.npc&&n.rom?.type!=='npc')||!integer(s.x,0,map.width-1)||!integer(s.y,0,map.height-1)||!integer(s.height,1,8)||s.y-s.height<0?['Choose a rock NPC and a landing tile with 1–8 clear tiles above it.']:[];}
 return[];
}
export function effectSource(s,{sourceHash,actor,serial=0,engine}){
 if(s.type==='shake'&&engine&&engine!=='frlg')throw Error('Screen shake needs a verified special-function adapter for this engine.');
 if(s.type==='shake'&&!engine&&!verifiedQuestSource(sourceHash))throw Error('Screen shake needs a verified native special-function adapter.');
 const commands=[],data=[];
 if(s.type==='shake'){
  if(effectIssues(s,{markers:[]}).length)throw Error(effectIssues(s,{markers:[]})[0]);
  // pret/pokefirered: SPECIAL_ShakeScreen = 0x136. Native task resumes scripts.
  commands.push('setvar 0x8004 '+s.x,'setvar 0x8005 '+s.y,'setvar 0x8006 '+s.count,'setvar 0x8007 '+s.interval,'special 0x136','waitstate');
 }else if(s.type==='weather'){
  if(effectIssues(s,{}).length)throw Error('Choose supported weather.');commands.push('setweather '+s.weather,'doweather');
 }else if(s.type==='rockfall'){
  if(!integer(s.height,1,8)||!integer(s.x,0,255)||!integer(s.y,s.height,255))throw Error('Invalid rockfall landing or height.');
  const id=actor(s.actorId),label='@rockfall_'+serial;
  commands.push('setobjectxyperm '+id+' '+s.x+' '+(s.y-s.height),'addobject '+id,'setobjectxy '+id+' '+s.x+' '+(s.y-s.height),'applymovement '+id+' '+label,'waitmovement '+id,'setobjectxyperm '+id+' '+s.x+' '+s.y);
  data.push(label+':',...Array(s.height).fill('walk_fast_down'),'step_end');
 }else throw Error('Unknown scene effect.');return{commands,data};
}
