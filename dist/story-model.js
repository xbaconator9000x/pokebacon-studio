import {uid} from './model.js';
import {prepareScene} from './authoring-model.js';
export function storyData(project){return project.story??={version:1,beats:[],links:[]};}
export function storyEvent(project,beat){const map=project.maps.find(m=>m.id===beat?.mapId),event=map?.markers.find(n=>n.id===beat?.eventId);return {map,event};}
export function addStoryBeat(project,values={}){const data=storyData(project);if(data.beats.length>=512)throw Error('Use up to 512 story cards.');const i=data.beats.length,beat={id:uid(),title:'New story beat',type:'note',summary:'',status:'planned',x:i%4*280,y:Math.floor(i/4)*180,...values};data.beats.push(beat);return beat;}
export function addStoryLink(project,from,to){const data=storyData(project);if(from===to)throw Error('Choose another story card.');if(![from,to].every(id=>data.beats.some(b=>b.id===id)))throw Error('Choose existing story cards.');if(data.links.length>=2048)throw Error('Too many story connections.');if(data.links.some(l=>l.from===from&&l.to===to))return data.links.find(l=>l.from===from&&l.to===to);const link={id:uid(),from,to,label:'Next',applyPrerequisite:false};data.links.push(link);return link;}
export function applyStoryPrerequisite(project,link,enabled){
 const data=storyData(project),from=storyEvent(project,data.beats.find(b=>b.id===link.from)).event,to=storyEvent(project,data.beats.find(b=>b.id===link.to)).event;
 if(enabled&&(!from||!to||from.runtime?.action!=='scene'||to.runtime?.action!=='scene'))throw Error('Bind both cards to visual scenes before applying a saved prerequisite.');
 if(enabled){prepareScene(project,from);prepareScene(project,to);to.runtime.conditions??=[];if(!to.runtime.conditions.some(c=>c.kind==='event'&&c.eventId===from.id&&c.value!==false)){to.runtime.conditions.push({kind:'event',eventId:from.id,value:true,storyLinkId:link.id});}}
 else for(const map of project.maps)for(const event of map.markers)if(event.runtime?.conditions)event.runtime.conditions=event.runtime.conditions.filter(c=>c.storyLinkId!==link.id);
 link.applyPrerequisite=!!enabled;
}
export function rebindStoryBeat(project,beat,values){
 const links=storyData(project).links.filter(l=>l.applyPrerequisite&&(l.from===beat.id||l.to===beat.id));
 for(const link of links)applyStoryPrerequisite(project,link,false);
 Object.assign(beat,values);
 // Rebinding must never leave a condition attached to the former scene.
 for(const link of links){const data=storyData(project),from=storyEvent(project,data.beats.find(b=>b.id===link.from)).event,to=storyEvent(project,data.beats.find(b=>b.id===link.to)).event;if(from?.runtime?.action==='scene'&&to?.runtime?.action==='scene')applyStoryPrerequisite(project,link,true);}
}
export function syncStoryScenes(project){const data=storyData(project);let added=0;for(const map of project.maps)for(const n of map.markers)if(n.runtime&&!data.beats.some(b=>b.eventId===n.id)){addStoryBeat(project,{title:n.title,type:'scene',mapId:map.id,eventId:n.id,status:n.runtime.enabled===false?'draft':'ready',summary:n.runtime.action==='scene'?'Visual scene · '+n.runtime.trigger:'Interaction · '+n.runtime.action});added++;}return added;}
export function validateStory(project){const s=project.story;if(s===undefined)return;if(!s||s.version!==1||!Array.isArray(s.beats)||!Array.isArray(s.links)||s.beats.length>512||s.links.length>2048)throw Error('Invalid story workspace.');const ids=new Set();for(const b of s.beats){if(!b||typeof b.id!=='string'||ids.has(b.id)||typeof b.title!=='string'||b.title.length>120||typeof b.summary!=='string'||b.summary.length>8000||![b.x,b.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6))throw Error('Invalid story card.');ids.add(b.id);}const edges=new Set();for(const l of s.links){if(!l||typeof l.id!=='string'||edges.has(l.id)||!ids.has(l.from)||!ids.has(l.to)||l.from===l.to||typeof l.label!=='string'||l.label.length>120)throw Error('Invalid story connection.');edges.add(l.id);}}
