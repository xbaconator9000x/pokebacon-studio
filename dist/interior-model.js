import {newMap,uid,LAYERS,inBounds} from './model.js';
import {addPortal,setMovement} from './world-model.js';
export function interiorAssets(t){return [...new Set([...LAYERS.flatMap(k=>(t.layers?.[k]||[]).filter(Boolean).map(c=>c.a)),...(t.objects||[]).map(o=>o.assetId)])];}
export function validateInterior(t,assetIds){
  if(!t||typeof t.id!=='string'||typeof t.name!=='string'||![t.width,t.height].every(n=>Number.isInteger(n)&&n>=1&&n<=256)||!t.entry||!inBounds(t,t.entry.x,t.entry.y))throw Error('An interior template has invalid dimensions or entrance.');
  if(t.layers&&t.layers.objects===undefined)t.layers.objects=Array(t.width*t.height).fill(null);
  for(const k of LAYERS){if(!Array.isArray(t.layers?.[k])||t.layers[k].length!==t.width*t.height)throw Error('An interior template has an incomplete tile layer.');for(const c of t.layers[k])if(c&&(!assetIds.has(c.a)||![c.sx,c.sy,c.size].every(Number.isFinite)||c.sx<0||c.sy<0||c.size<1||c.size>128))throw Error('An interior template has missing artwork.');}
  if(!Array.isArray(t.objects||[])||(t.objects||[]).length>5000)throw Error('An interior has too many furniture objects.');
  for(const o of t.objects||[])if(!assetIds.has(o.assetId)||![o.x,o.y,o.w,o.h,o.sx,o.sy,o.sw,o.sh].every(Number.isFinite)||o.w<=0||o.h<=0||o.sw<=0||o.sh<=0)throw Error('An interior furniture object has invalid artwork.');
  if(t.movement&&(!Array.isArray(t.movement)||t.movement.length!==t.width*t.height||t.movement.some(r=>r&&!['original','walk','block','behind','water','ledge_south','ledge_north','ledge_west','ledge_east'].includes(r.mode))))throw Error('An interior has invalid walking rules.');
  return t;
}
export function mapFromInterior(t,name=t.name){
  const map=newMap(name,t.width,t.height);map.layers=structuredClone(t.layers);map.layers.objects??=Array(map.width*map.height).fill(null);map.objects=structuredClone(t.objects||[]).map(o=>({...o,id:uid()}));if(t.movement)map.movement=structuredClone(t.movement);map.background=t.background||'#000000';map.notes=t.notes||'';map.generator={type:'interior-template',templateId:t.id,entrance:{...t.entry}};return map;
}
export function linkInteriorToBuilding(project,exterior,object,t,{name=t.name,sourceId=exterior.rom?.sourceId||null,templateKey=null}={}){
  const map=mapFromInterior(t,name);map.world={x:exterior.world.x+280,y:exterior.world.y};map.generator={...map.generator,type:'building',buildingId:object.id,exteriorId:exterior.id};
  map.rom={sourceId,generated:true,interiorKind:t.kind||'house',mapType:8,originalWidth:0,originalHeight:0,originalBlocks:[],...(templateKey?{templateKey}:{})};
  const from={mapId:exterior.id,x:Math.round(object.x+object.building.entrance.x),y:Math.round(object.y+object.building.entrance.y)},to={mapId:map.id,...t.entry};
  project.maps.push(map);const link=addPortal(project,from,to,{label:object.name+' entrance',twoWay:true});link.buildingId=object.id;object.building.interiorId=map.id;setMovement(exterior,from.x,from.y,{mode:'walk',elevation:3});setMovement(map,to.x,to.y,{mode:'walk',elevation:3});return map;
}
export function templateFromMap(map,{id=uid(),name=map.name,category='My interiors',entry}={}){
  if(!entry)throw Error('Choose a walkable entrance tile for the saved interior.');
  const objects=structuredClone(map.objects);for(const o of objects){delete o.id;delete o.portalId;delete o.portalEnd;delete o.building;delete o.tree;}
  return{id,name,category,width:map.width,height:map.height,background:map.background,entry:{...entry},layers:structuredClone(map.layers),movement:structuredClone(map.movement||Array(map.width*map.height).fill(null)),objects,notes:map.notes||'',source:'Saved from '+map.name};
}
export function stampInterior(map,t,x,y,{replaceObjects=true}={}){
  if(![x,y].every(Number.isInteger)||x<0||y<0||x+t.width>map.width||y+t.height>map.height)throw Error('The entire interior must fit inside this map. Use Crop / resize to add space first.');
  const overlaps=o=>o.x+o.w>x&&o.y+o.h>y&&o.x<x+t.width&&o.y<y+t.height;
  if(map.gates?.some(g=>overlaps({...g,y:g.y-g.h+1})))throw Error('Move the existing gate away from this room footprint first.');
  if(replaceObjects&&map.objects.some(o=>(o.building?.interiorId||o.portalId)&&overlaps(o)))throw Error('Move the linked building / doorway before replacing its room area.');
  if(map.objects.length+(t.objects||[]).length>5000)throw Error('This map has reached its object limit.');
  for(const k of LAYERS)for(let yy=0;yy<t.height;yy++)for(let xx=0;xx<t.width;xx++)map.layers[k][(y+yy)*map.width+x+xx]=structuredClone(t.layers[k]?.[yy*t.width+xx]||null);
  map.movement??=Array(map.width*map.height).fill(null);
  for(let yy=0;yy<t.height;yy++)for(let xx=0;xx<t.width;xx++){const at=(y+yy)*map.width+x+xx;map.movement[at]=structuredClone(t.movement?.[yy*t.width+xx]||{mode:'walk',elevation:3});if(map.wallCells)map.wallCells[at]=null;}
  if(replaceObjects)map.objects=map.objects.filter(o=>!overlaps(o));
  map.objects.push(...structuredClone(t.objects||[]).map(o=>({...o,id:uid(),x:o.x+x,y:o.y+y})));return{x:x+t.entry.x,y:y+t.entry.y};
}
