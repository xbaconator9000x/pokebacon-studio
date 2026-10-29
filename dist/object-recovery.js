import {clone,uid} from './model.js';
import {movementAt} from './world-model.js';
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const rect=o=>({x:Math.floor(o.x),y:Math.floor(o.y),w:Math.ceil(o.x+o.w)-Math.floor(o.x),h:Math.ceil(o.y+o.h)-Math.floor(o.y)});
// Recover only where the authored composite still agrees with the current ROM.
// A conflict is left untouched; no guessed ground or script replacement.
export async function recoverPlacedObjects(current,saved,render){
 const project=clone(current),report={restored:0,conflicts:[],maps:0};
 for(const a of saved.assets){const old=project.assets.find(v=>v.id===a.id);if(old&&JSON.stringify(old)!==JSON.stringify(a))throw Error('An image ID has different contents in these projects: '+a.id);if(!old)project.assets.push(clone(a));}
 if(project.assets.length>512)throw Error('The combined recovery exceeds the 512-image project limit. Recover fewer maps at once.');
 for(const original of saved.maps){if(!original.objects?.length)continue;if(!original.rom?.key){report.conflicts.push({map:original.name,reason:'Generated room needs an explicit native map binding',objects:original.objects.length});continue;}const map=project.maps.find(m=>m.rom?.key===original.rom.key&&m.width===original.width&&m.height===original.height);if(!map){report.conflicts.push({map:original.name,reason:'No matching native map and dimensions',objects:original.objects.length});continue;}
 const groups=[];for(const o of original.objects){const r=rect(o);let group={objects:[o],rect:r};for(let i=groups.length-1;i>=0;i--)if(hit(group.rect,groups[i].rect)){const q=groups.splice(i,1)[0],a=group.rect,b=q.rect;group.objects.push(...q.objects);group.rect={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.max(a.x+a.w,b.x+b.w)-Math.min(a.x,b.x),h:Math.max(a.y+a.h,b.y+b.h)-Math.min(a.y,b.y)};}groups.push(group);}
 const source=await render(project,original),native=await render(project,map),base={...original,objects:[],fieldObjects:[]};let touched=false;
 for(const g of groups){const r=g.rect;if(r.x<0||r.y<0||r.x+r.w>map.width||r.y+r.h>map.height||map.objects.some(o=>hit(rect(o),r))){report.conflicts.push({map:map.name,reason:'Footprint is outside the map or overlaps an editable object',objects:g.objects.length});continue;}
 let different=0,total=0;for(let y=r.y*16;y<(r.y+r.h)*16;y++)for(let x=r.x*16;x<(r.x+r.w)*16;x++){const i=(y*map.width*16+x)*4;total++;if([0,1,2,3].some(c=>source.pixels[i+c]!==native.pixels[i+c]))different++;}
 if(different){report.conflicts.push({map:map.name,x:r.x,y:r.y,objects:g.objects.length,reason:'Artwork differs at '+different+' / '+total+' pixels'});continue;}
 for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){const i=y*map.width+x;for(const k of ['ground','details','objects','overhead'])map.layers[k][i]=clone(original.layers[k]?.[i]??null);map.movement??=Array(map.width*map.height).fill(null);const rule=movementAt(base,x,y);map.movement[i]={mode:rule.mode,collision:rule.collision,elevation:rule.elevation,behind:rule.behind,...(Number.isInteger(rule.behavior)?{behavior:rule.behavior}:{}),...(Number.isInteger(rule.layerType)?{layerType:rule.layerType}:{})};}
 for(const o of g.objects){const next=clone(o);next.id=uid();delete next.portalId;delete next.building;map.objects.push(next);}report.restored+=g.objects.length;touched=true;
 }if(touched)report.maps++;
 }return{project,report};
}
