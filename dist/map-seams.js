import{addLink}from'./model.js';
export const EDGES={north:{code:2,opposite:'south'},south:{code:1,opposite:'north'},west:{code:3,opposite:'east'},east:{code:4,opposite:'west'}};
export const FACINGS=['auto','north','south','west','east'];
export const isSeamLink=l=>!!l?.seam||!!(EDGES[l?.kind]&&l.rom?.events?.some(s=>/:edge-\d+$/.test(s))&&!l.runtime);
export function seamSettings(link){const direction=link.seam?.direction||link.kind,axis=['north','south'].includes(direction)?'x':'y';return{direction,offset:link.seam?.offset??link.from[axis]-link.to[axis]};}
export function seamGeometry(a,b,direction,offset){
 if(!EDGES[direction]||!Number.isInteger(offset)||Math.abs(offset)>1024)throw Error('Choose north, south, east or west and a whole-tile offset between −1024 and 1024.');
 const vertical=['north','south'].includes(direction),size=vertical?'width':'height',start=Math.max(0,offset),end=Math.min(a[size],offset+b[size]);
 if(end<=start)throw Error('These edges do not overlap. Adjust the offset so at least one tile joins.');
 const mid=Math.floor((start+end-1)/2),other=mid-offset;
 const from=vertical?{mapId:a.id,x:mid,y:direction==='north'?0:a.height-1}:{mapId:a.id,x:direction==='west'?0:a.width-1,y:mid};
 const to=vertical?{mapId:b.id,x:other,y:direction==='north'?b.height-1:0}:{mapId:b.id,x:direction==='west'?b.width-1:0,y:other};
 return{from,to,overlap:end-start,start,end,vertical};
}
export function disableNativeSeam(project,link){
 for(const token of link.rom?.events||[]){const match=/^(.+):edge-(\d+)$/.exec(token);if(!match)continue;const map=project.maps.find(m=>m.rom?.sourceId===link.rom.sourceId&&m.rom.key===match[1]&&!m.rom.isCopy);if(map){map.rom.disabledConnections??=[];const index=+match[2];if(!map.rom.disabledConnections.includes(index))map.rom.disabledConnections.push(index);}}
}
export function saveSeamLink(project,draft){
 const old=project.links.find(l=>l.id===draft.id),a=project.maps.find(m=>m.id===draft.from?.mapId),b=project.maps.find(m=>m.id===draft.to?.mapId);
 if(!a||!b||a===b)throw Error('Choose two different maps for a continuous edge.');
 const seam=draft.seam||seamSettings(draft),geometry=seamGeometry(a,b,seam.direction,seam.offset),twoWay=draft.twoWay!==false;
 const ends=[[a.id,seam.direction],...(twoWay?[[b.id,EDGES[seam.direction].opposite]]:[])];
 for(const l of project.links){if(l.id===old?.id||!isSeamLink(l))continue;const s=seamSettings(l),occupied=[[l.from.mapId,s.direction],...(l.twoWay?[[l.to.mapId,EDGES[s.direction].opposite]]:[])];if(ends.some(([id,d])=>occupied.some(([other,edge])=>id===other&&edge===d)))throw Error('That map edge already has a continuous connection. Edit or remove it first.');}
 if(!old&&project.links.length>=2000)throw Error('This project has reached its connection limit.');
 if(old)disableNativeSeam(project,old);
 const link=old||addLink(project,geometry.from,geometry.to,seam.direction,twoWay,draft.label||'Continuous edge');
 Object.assign(link,{from:geometry.from,to:geometry.to,kind:seam.direction,twoWay,label:draft.label||'Continuous edge',seam:{direction:seam.direction,offset:seam.offset}});delete link.runtime;return link;
}
export function seamAt(project,mapId,x,y){
 for(const l of project.links){if(!isSeamLink(l))continue;const s=seamSettings(l),forward=l.from.mapId===mapId,reverse=l.twoWay&&l.to.mapId===mapId;if(!forward&&!reverse)continue;
 const direction=forward?s.direction:EDGES[s.direction].opposite,offset=forward?s.offset:-s.offset,a=project.maps.find(m=>m.id===mapId),b=project.maps.find(m=>m.id===(forward?l.to:l.from).mapId);
 if(!a||!b)continue;const exit=direction==='north'?y===-1:direction==='south'?y===a.height:direction==='west'?x===-1:x===a.width;if(!exit)continue;
 const target={mapId:b.id,x:direction==='west'?b.width-1:direction==='east'?0:x-offset,y:direction==='north'?b.height-1:direction==='south'?0:y-offset};
 if(target.x>=0&&target.y>=0&&target.x<b.width&&target.y<b.height)return{link:l,to:target};
 }return null;
}
export function validateSeams(project){for(const l of project.links){if(!l.seam)continue;const a=project.maps.find(m=>m.id===l.from.mapId),b=project.maps.find(m=>m.id===l.to.mapId);if(!a||!b||a===b)throw Error('A continuous edge needs two different maps.');seamGeometry(a,b,l.seam.direction,l.seam.offset);if(l.runtime)throw Error('A continuous edge cannot also be a portal.');}}

export function linkPinLabel(link,end){
 if(isSeamLink(link)){const s=seamSettings(link),direction=end==='from'?s.direction:EDGES[s.direction]?.opposite;return{north:'↑',south:'↓',west:'←',east:'→'}[direction]||'↔';}
 return link.twoWay?'⇄':end==='from'?'OUT':'IN';
}
