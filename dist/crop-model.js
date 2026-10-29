import{rebaseLayerDecisions}from'./project-authority.js';
import {LIMIT,LAYERS} from './model.js';
import {sourceIndex} from './source-cells.js';
import {removeFieldObject} from './field-model.js';
import {gateBounds} from './gate-cells.js';
import {flattenActions,sceneActions} from './authoring-model.js';

const contains=(r,p)=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height;
const intersects=(r,o)=>o.x+o.w>r.x&&o.y+o.h>r.y&&o.x<r.x+r.width&&o.y<r.y+r.height;
export function cropPlan(project,mapId,rect){
  const map=project.maps.find(m=>m.id===mapId);if(!map)throw Error('Map not found.');
  const r={x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  if(!Object.values(r).every(Number.isInteger)||r.width<1||r.height<1||r.width>LIMIT||r.height>LIMIT)throw Error('Use whole tiles, from 1 to 256 on each side.');
  if(project.maps.reduce((n,m)=>n+m.width*m.height,0)-map.width*map.height+r.width*r.height>400000)throw Error('This size exceeds the project’s 400,000 tile limit.');
  const blockers=[];
  for(const a of map.nativeAssemblies||[])if(intersects(r,a)&&(a.x<r.x||a.y<r.y||a.x+a.w>r.x+r.width||a.y+a.h>r.y+r.height))blockers.push(a.name+' · crop would cut a complete object');
  for(const l of project.links)for(const end of ['from','to'])if(l[end].mapId===mapId&&!contains(r,l[end]))blockers.push((l.label||'Connection')+' · '+(end==='to'?'arrival':'entrance'));
  for(const other of project.maps)for(const n of other.markers)for(const step of [...flattenActions(n.runtime?.steps),...flattenActions(n.runtime?.repeatSteps)])if(step.type==='warp'&&step.to?.mapId===mapId&&!contains(r,step.to))blockers.push((n.title||'Event')+' · scripted arrival');
  for(const n of map.markers)if(contains(r,n)&&n.runtime?.action==='scene')for(const s of sceneActions(n))if(s.type==='path'&&s.points?.some(p=>!contains(r,p)))blockers.push(n.title+' · drawn character path');
  const offset=map.rom?.cropOffset||{x:0,y:0};
  for(const [key,type]of [['npcs','npc'],['warps','warp'],['triggers','trigger'],['signs','sign']])for(const e of map.rom?.events?.[key]||[]){
    if(type==='npc'&&map.fieldRemovedNPCs?.includes(e.index))continue;
    if(type==='npc'&&map.fieldObjects?.some(o=>o.rom?.index===e.index&&!contains(r,o)))continue;
    if(type==='warp'&&project.links.some(l=>l.runtime&&[['from',l.rom?.originalFrom],['to',l.rom?.originalTo]].some(([end,p])=>p?.mapId===mapId&&p.x===e.x&&p.y===e.y&&l[end].mapId!==mapId)))continue;
    const marker=map.markers.find(n=>n.rom?.index===e.index&&(n.rom.type===type||type==='sign'&&typeof n.rom.type==='number'));
    const p=marker||{x:e.x-offset.x,y:e.y-offset.y};
    if(!contains(r,p))blockers.push('Original '+type+' '+e.index+' · '+p.x+', '+p.y);
  }
  for(const n of map.markers)if(n.npc&&!contains(r,n))blockers.push((n.title||'NPC')+' · character');
  const objects=map.objects.filter(o=>!intersects(r,o)),markers=map.markers.filter(n=>!contains(r,n)),fields=(map.fieldObjects||[]).filter(o=>!contains(r,o)),gates=(map.gates||[]).filter(g=>{const b=gateBounds(g);return b.x<r.x||b.y<r.y||b.x+b.w>r.x+r.width||b.y+b.h>r.y+r.height;});
  return{rect:r,blockers:[...new Set(blockers)],removed:{objects:objects.length,markers:markers.length,fields:fields.length,gates:gates.length},removedObjectIds:objects.map(o=>o.id),removedGateIds:gates.map(g=>g.id),newCells:r.width*r.height-Math.max(0,Math.min(map.width,r.x+r.width)-Math.max(0,r.x))*Math.max(0,Math.min(map.height,r.y+r.height)-Math.max(0,r.y))};
}
export function cropMap(project,mapId,rect){
  const plan=cropPlan(project,mapId,rect);if(plan.blockers.length)throw Error('Keep these exits / events inside the crop, or move them first: '+plan.blockers.slice(0,4).join('; ')+(plan.blockers.length>4?' …':''));
  const map=project.maps.find(m=>m.id===mapId),r=plan.rect,ow=map.width,oh=map.height;
  for(const o of map.fieldObjects||[])if(o.permanent&&o.solvedPosition&&!contains(r,o.solvedPosition))throw Error('The crop removes a permanent boulder’s solved tile. Change the puzzle before cropping.');
  const copy=old=>{const cells=Array(r.width*r.height).fill(null);for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const ox=x+r.x,oy=y+r.y;if(ox>=0&&oy>=0&&ox<ow&&oy<oh)cells[y*r.width+x]=old[oy*ow+ox];}return cells;};
  const source=map.rom?Array.from({length:ow*oh},(_,i)=>sourceIndex(map,i%ow,Math.floor(i/ow))):null;
  for(const k of LAYERS)map.layers[k]=copy(map.layers[k]);
  for(const k of ['movement','wallCells','layerPriorityDecisions'])if(map[k])map[k]=copy(map[k]);
  if(source){map.rom.sourceCells=copy(source);const old=map.rom.cropOffset||{x:0,y:0};map.rom.cropOffset={x:old.x+r.x,y:old.y+r.y};}
  const shift=p=>{p.x-=r.x;p.y-=r.y;};
  const removedBuildings=map.objects.filter(o=>plan.removedObjectIds.includes(o.id)&&o.building);
  map.objects=map.objects.filter(o=>!plan.removedObjectIds.includes(o.id));map.objects.forEach(shift);
  map.nativeAssemblies=(map.nativeAssemblies||[]).filter(a=>intersects(r,a));map.nativeAssemblies.forEach(shift);
  map.markers=map.markers.filter(n=>contains(r,n));map.markers.forEach(shift);
  for(const n of map.markers)if(n.runtime?.action==='scene'){const area=n.runtime.area;if(area){const x=Math.max(0,area.x-r.x),y=Math.max(0,area.y-r.y),right=Math.min(r.width,area.x+area.width-r.x),bottom=Math.min(r.height,area.y+area.height-r.y);n.runtime.area={x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};}for(const s of sceneActions(n))if(s.type==='path')for(const point of s.points||[])shift(point);else if(s.type==='rockfall')shift(s);}
  for(const o of [...map.fieldObjects||[]])if(!contains(r,o))removeFieldObject(map,o.id);else {shift(o);if(o.solvedPosition)shift(o.solvedPosition);}
  if(map.gates){map.gates=map.gates.filter(g=>!plan.removedGateIds.includes(g.id));map.gates.forEach(shift);}
  if(map.reference)shift(map.reference);
  if(map.generator?.entrance)shift(map.generator.entrance);
  if(map.rooms)map.rooms=map.rooms.flatMap(room=>{const old=room.rect,x1=Math.max(0,Math.min(old.x1,old.x2)-r.x),y1=Math.max(0,Math.min(old.y1,old.y2)-r.y),x2=Math.min(r.width-1,Math.max(old.x1,old.x2)-r.x),y2=Math.min(r.height-1,Math.max(old.y1,old.y2)-r.y);return x2-x1>=2&&y2-y1>=3?[{...room,rect:{x1,y1,x2,y2}}]:[];});
  for(const l of project.links){for(const end of ['from','to'])if(l[end].mapId===mapId)shift(l[end]);if(l.seam){const axis=['north','south'].includes(l.seam.direction)?'x':'y';l.seam.offset=l.from[axis]-l.to[axis];}}
  for(const other of project.maps)for(const n of other.markers){if(n.runtime?.steps){n.runtime.steps=n.runtime.steps.filter(s=>!plan.removedGateIds.includes(s.gateId));if(!n.runtime.steps.length&&n.runtime.action!=='scene')delete n.runtime;else for(const s of [...flattenActions(n.runtime.steps),...flattenActions(n.runtime.repeatSteps)])if(s.type==='warp'&&s.to?.mapId===mapId)shift(s.to);}}
  for(const o of removedBuildings){for(const other of project.maps)if(other.generator?.buildingId===o.id)delete other.generator.buildingId;for(const l of project.links)if(l.buildingId===o.id)delete l.buildingId;}
  map.width=r.width;map.height=r.height;rebaseLayerDecisions(project,map,r.x,r.y);delete project.nativeArtworkPacks;return plan;
}
