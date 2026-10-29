import{removeNativeWarp}from'./warp-removal.js';
import {addLink,inBounds,clamp} from './model.js';
import {movementAt,setMovement} from './world-model.js';
import {fieldAt,ledgeAt} from './field-model.js';
import {gateLocal} from './gate-cells.js';
import{isSeamLink,disableNativeSeam}from'./map-seams.js';

export function linkEndAt(project,mapId,x,y){
  for(const link of [...project.links].reverse())for(const end of ['from','to']){
    const p=link[end];if(p.mapId===mapId&&p.x===x&&p.y===y)return{link,end};
  }
  return null;
}
export function isNativeWarp(link){return !!link?.rom?.events?.some(s=>/:warp-\d+$/.test(s));}
export function linkArt(project,linkId,end){if(!linkId)return[];return project.maps.flatMap(map=>map.objects.filter(o=>o.portalId===linkId&&(o.portalEnd||'from')===end).map(object=>({map,object})));}
export function boundLinkEnd(project,link,end,p){
  const map=project.maps.find(m=>m.id===p.mapId);if(!map)throw Error('Choose a destination map.');
  let minX=0,minY=0,maxX=map.width-1,maxY=map.height-1;
  for(const {object:o} of linkArt(project,link.id,end)){const a=o.portalAnchor||{x:0,y:0};minX=Math.max(minX,a.x);minY=Math.max(minY,a.y);maxX=Math.min(maxX,map.width-o.w+a.x);maxY=Math.min(maxY,map.height-o.h+a.y);}
  if(minX>maxX||minY>maxY)throw Error('The doorway artwork is larger than this map.');
  return{mapId:map.id,x:clamp(Math.round(p.x),minX,maxX),y:clamp(Math.round(p.y),minY,maxY)};
}
export function checkLinkEnd(project,link,end,p,{playable=!!link.runtime}={}){
  if(isSeamLink(link))throw Error('Use Continuous edge settings to change its direction or alignment.');
  const map=project.maps.find(m=>m.id===p?.mapId);
  if(!map||!Number.isInteger(p.x)||!Number.isInteger(p.y)||!inBounds(map,p.x,p.y))throw Error('Tap a whole tile inside the map.');
  if(link.buildingId&&end==='from'){
    const building=project.maps.flatMap(m=>m.objects).find(o=>o.id===link.buildingId);
    if(building&&(p.mapId!==link.from.mapId||p.x!==link.from.x||p.y!==link.from.y))throw Error('Move the building to move its entrance. Its interior arrival can be moved here.');
  }
  for(const {object:o} of linkArt(project,link.id,end)){const a=o.portalAnchor||{x:0,y:0},x=p.x-a.x,y=p.y-a.y;if(x<0||y<0||x+o.w>map.width||y+o.h>map.height)throw Error('Leave space for the complete doorway artwork.');}
  if(!playable)return map;
  for(const other of project.links){if(other.id===link.id||!other.runtime&&!isNativeWarp(other))continue;for(const k of ['from',...(other.twoWay?['to']:[])]){const q=other[k];if(q.mapId===p.mapId&&q.x===p.x&&q.y===p.y)throw Error('A portal already uses this tile. Choose another tile.');}}
  if(fieldAt(map,p.x,p.y)||ledgeAt(map,p.x,p.y)||map.gates?.some(g=>gateLocal(g,p.x,p.y))||map.markers.some(n=>n.runtime?.enabled!==false&&n.x===p.x&&n.y===p.y&&(n.runtime?.trigger==='step'||n.runtime?.blocksMovement)))throw Error('Choose an arrival away from HM objects, ledges, gates and blocking events.');
  const ownArt=new Set(linkArt(project,link.id,end).map(x=>x.object.id));
  if(movementAt({...map,objects:map.objects.filter(o=>!ownArt.has(o.id))},p.x,p.y).objectBlocked)throw Error('That tile is inside a solid object. Choose a clear entrance or floor tile.');
  return map;
}
export function syncLinkArt(project,link){
  for(const end of ['from','to'])for(const {map,object:o} of linkArt(project,link.id,end)){
    const target=project.maps.find(m=>m.id===link[end].mapId),a=o.portalAnchor||{x:0,y:0};
    if(target!==map){if(target.objects.length>=5000)throw Error('The destination map has reached its object limit.');map.objects=map.objects.filter(v=>v.id!==o.id);target.objects.push(o);}
    o.x=link[end].x-a.x;o.y=link[end].y-a.y;
  }
}
export function saveMapLink(project,draft,{walkable=true}={}){
  const old=project.links.find(l=>l.id===draft.id),previous=old?structuredClone(old):null,next={...(old||{}),...structuredClone(draft)};
  if(!next.from||!next.to)throw Error('Tap both ends before saving the connection.');
  if(next.from.mapId===next.to.mapId&&next.from.x===next.to.x&&next.from.y===next.to.y)throw Error('Choose two different tiles.');
  if(!old&&project.links.length>=2000)throw Error('This project has reached its connection limit.');
  for(const end of ['from','to'])checkLinkEnd(project,next,end,next[end]);
  const link=old||addLink(project,next.from,next.to,next.kind||'warp',next.twoWay!==false,next.label||'Portal');
  Object.assign(link,next);if(!next.runtime)delete link.runtime;
  if(previous)for(const end of ['from','to']){const before=previous[end],after=link[end];if(before.mapId===after.mapId&&before.x===after.x&&before.y===after.y)continue;const source=project.maps.find(m=>m.id===before.mapId);if(source){
    if(previous.runtime||isNativeWarp(previous))setMovement(source,before.x,before.y,{mode:'walk',behavior:0,elevation:3});
    const markers=source.markers.filter(n=>n.rom?.type==='warp'&&n.x===before.x&&n.y===before.y);if(before.mapId===after.mapId)for(const n of markers){n.x=after.x;n.y=after.y;}else source.markers=source.markers.filter(n=>!markers.includes(n));
  }}
  syncLinkArt(project,link);
  if(walkable&&link.runtime)for(const p of [link.from,link.to]){const map=project.maps.find(m=>m.id===p.mapId);setMovement(map,p.x,p.y,{mode:'walk',elevation:3});if(map.wallCells)map.wallCells[p.y*map.width+p.x]=null;}
  return link;
}
export function removeMapLink(project,id){const link=project.links.find(l=>l.id===id);if(link&&isSeamLink(link))disableNativeSeam(project,link);if(isNativeWarp(link)){const removals=(link.rom.events||[]).filter(tag=>!project.links.some(l=>l.id!==id&&l.rom?.sourceId===link.rom.sourceId&&l.rom.events?.includes(tag))).map(tag=>{const match=/^(.+):warp-(\d+)$/.exec(tag);if(!match)return null;const map=project.maps.find(m=>m.rom?.sourceId===link.rom.sourceId&&m.rom.key===match[1]);if(!map||!map.rom.events?.warps?.some(w=>w.index===+match[2]))throw Error('The original warp map is missing from the project.');return{map,index:+match[2]};}).filter(Boolean);for(const{map,index}of removals)removeNativeWarp(map,index);}project.links=project.links.filter(l=>l.id!==id);for(const map of project.maps)map.objects=map.objects.filter(o=>o.portalId!==id);}
