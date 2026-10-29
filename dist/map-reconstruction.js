import{addRecognisedStamp}from'./reconstruction-stamps.js';
import{captureNativeAssembly}from'./native-assemblies.js';
import{movementAt}from'./world-model.js';
import{nativeCellRule}from'./native-cell.js';
import{patchData}from'./reconstruction-ground.js';
const copy=v=>structuredClone(v),inside=(r,p)=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.w&&p.y<r.y+r.h;
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const stable=v=>JSON.stringify(v);
export function reconstructionEvents(project,map,r){
 const found=[];for(const [kind,rows]of Object.entries(map.rom?.events||{}))if(Array.isArray(rows))for(const p of rows){const q={x:p.x-(map.rom.cropOffset?.x||0),y:p.y-(map.rom.cropOffset?.y||0)};if(inside(r,q))found.push('Native '+kind);}
 for(const p of [...map.markers,...map.fieldObjects||[],...map.gates||[]])if(inside(r,p))found.push(p.title||p.name||'Event');
 for(const l of project.links)for(const k of ['from','to'])if(l[k].mapId===map.id&&inside(r,l[k]))found.push('Map connection');
 return [...new Set(found)];
}
export function reconstructionSnapshot(map,r){const layers=Object.fromEntries(Object.keys(map.layers).map(k=>[k,[]])),movement=[];for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const i=(r.y+y)*map.width+r.x+x;for(const k of Object.keys(layers))layers[k].push(copy(map.layers[k][i]??null));movement.push(copy(map.movement?.[i]??null));}return{layers,movement};}
export function inferReconstructionGround(map,r){
 const choices=new Map();for(let y=Math.max(0,r.y-1);y<=Math.min(map.height-1,r.y+r.h);y++)for(let x=Math.max(0,r.x-1);x<=Math.min(map.width-1,r.x+r.w);x++){
 if(inside(r,{x,y})||map.objects.some(o=>inside(o,{x,y}))||(map.nativeAssemblies||[]).some(o=>inside(o,{x,y})))continue;
 const rule=movementAt(map,x,y);if(rule.collision||![0,2].includes(rule.behavior??0)||rule.behind)continue;
 const i=y*map.width+x;if(!map.layers.ground[i])continue;const layers=Object.fromEntries(Object.keys(map.layers).map(k=>[k,copy(map.layers[k][i]??null)])),key=stable(layers)+':'+rule.elevation;
 const old=choices.get(key);if(old)old.count++;else choices.set(key,{x,y,count:1,layers});
 }return [...choices.values()].sort((a,b)=>b.count-a.count||a.y-b.y||a.x-b.x)[0]||null;
}
export async function scanReconstruction({project,map,image,templates,signal,scriptAudit=null,maxCandidates=500,yieldEvery=1,onProgress=()=>{}}){
 if(!map.rom?.nativeLayerSplit)throw Error('Import native map planes before reconstructing objects.');
 const width=map.width*16,height=map.height*16;if(image.width!==width||image.height!==height||image.pixels.length!==width*height*4)throw Error('The map preview does not match its tile grid.');
 const stride=map.width+1,prefix=new Uint32Array((map.width+1)*(map.height+1));for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const blocked=!!map.wallCells?.[y*map.width+x]||[...map.objects,...map.nativeAssemblies||[]].some(o=>inside(o,{x,y}));prefix[(y+1)*stride+x+1]=Number(blocked)+prefix[y*stride+x+1]+prefix[(y+1)*stride+x]-prefix[y*stride+x];}const occupied=r=>prefix[(r.y+r.h)*stride+r.x+r.w]-prefix[r.y*stride+r.x+r.w]-prefix[(r.y+r.h)*stride+r.x]+prefix[r.y*stride+r.x];const candidates=[],footprints=new Set();let examined=0,truncated=false;const valid=templates.filter(t=>!t.stampOnly&&t.pixels&&t.pixels.length===t.w*t.h*1024&&t.overlay&&t.w<=map.width&&t.h<=map.height&&t.w>=1&&t.h>=1).sort((a,b)=>(b.recognitionPriority||0)-(a.recognitionPriority||0));
 scan:for(const t of valid){if(signal?.aborted)throw new DOMException('Reconstruction cancelled.','AbortError');
 const opaque=[];let translucent=false;for(let i=0;i<t.pixels.length;i+=4){if(t.pixels[i+3]&&t.pixels[i+3]!==255)translucent=true;if(t.pixels[i+3]===255)opaque.push(i);}if(translucent||opaque.length<32){examined++;continue;}
 const samples=[...new Set(Array.from({length:16},(_,i)=>opaque[Math.floor(i*(opaque.length-1)/15)]))];
 for(let y=0;y<=map.height-t.h;y++)for(let x=0;x<=map.width-t.w;x++){
 const r={x,y,w:t.w,h:t.h};if(occupied(r))continue;
 const at=i=>((y*16+Math.floor(i/4/(t.w*16)))*width+x*16+(i/4)%(t.w*16))*4;
 const equal=i=>{const j=at(i);return image.pixels[j]===t.pixels[i]&&image.pixels[j+1]===t.pixels[i+1]&&image.pixels[j+2]===t.pixels[i+2]&&image.pixels[j+3]===255;};
 if(!samples.every(equal)||!opaque.every(equal))continue;
 const key=[x,y,t.w,t.h].join(':');if(footprints.has(key))continue;footprints.add(key);
 const events=reconstructionEvents(project,map,r);if(scriptAudit&&!scriptAudit.complete)events.push('Incomplete script audit');if(scriptAudit?.cells.some(i=>inside(r,{x:i%map.width,y:Math.floor(i/map.width)})))events.push('Script-controlled tiles');candidates.push({...r,templateId:t.id,name:t.name,kind:t.kind||'object',evidence:'Exact opaque pixels',events,underlay:inferReconstructionGround(map,r),source:reconstructionSnapshot(map,r),conflict:false});
 if(candidates.length>=maxCandidates){truncated=true;break scan;}
 }examined++;onProgress(examined,valid.length);if(examined%Math.max(1,yieldEvery)===0)await new Promise(r=>setTimeout(r,0));
 }
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)if(overlaps(candidates[i],candidates[j]))candidates[i].conflict=candidates[j].conflict=true;
 if(truncated)for(const c of candidates)c.conflict=true;const occupiedIds=new Set();for(const c of candidates){const t=valid.find(t=>t.id===c.templateId);for(let i=0;i<c.w*c.h;i++){if(!t.overlay.mask[i])continue;const tile=map.layers.ground[(c.y+Math.floor(i/c.w))*map.width+c.x+i%c.w];if(tile&&[map.rom.atlasId,...map.rom.layerAtlasIds||[]].includes(tile.a))occupiedIds.add(tile.sy/16*16+tile.sx/16);}}for(const c of candidates)c.occupiedIds=[...occupiedIds];return{candidates,examined,truncated};
}
export function registerReconstruction(project,map,candidate){
 if(stable(reconstructionSnapshot(map,candidate))!==stable(candidate.source))throw Error('The map changed after scanning. Scan it again.');
 if((map.nativeAssemblies||[]).some(a=>overlaps(a,candidate))||map.objects.some(a=>overlaps(a,candidate)))throw Error('Choose one interpretation for overlapping objects.');
 const t=project.romObjects?.find(t=>t.id===candidate.templateId);if(!t?.overlay||t.w!==candidate.w||t.h!==candidate.h)throw Error('The recognised object template is missing or has changed.');
 const captured=captureNativeAssembly(map,candidate,{name:candidate.name}),data=reconstructionSnapshot(map,candidate),events=reconstructionEvents(project,map,candidate);
 events.push(...candidate.events.filter(e=>!events.includes(e)));const a={id:captured.id,templateId:t.id,name:candidate.name,x:candidate.x,y:candidate.y,w:candidate.w,h:candidate.h,locked:true,before:copy(data),expected:{layers:copy(data.layers),rules:copy(data.movement)},entrances:[],reconstruction:{version:1,underlayApproved:false,protectedEvents:events.length>0,events,inferred:copy(candidate.underlay),evidence:candidate.evidence,backgroundRepairs:copy(t.backgroundRepairs||[]),backgroundColours:copy(t.backgroundColours||[]),surfaceHint:t.surfaceHint||'floor',occupiedIds:copy(candidate.occupiedIds||[]),renderIntents:copy(captured.renderIntents),nativeRules:copy(captured.rules),nativeTiles:copy(captured.layers),sourceRect:{x:candidate.x,y:candidate.y}}};
 a.reconstruction.stampId=addRecognisedStamp(project,map,t,captured).id;(map.nativeAssemblies??=[]).push(a);return a;
}
export function approveReconstructionGround(project,map,id,x,y){
 const a=map.nativeAssemblies?.find(a=>a.id===id);if(!a?.reconstruction)throw Error('Choose a reconstructed object.');if(a.reconstruction.protectedEvents||reconstructionEvents(project,map,a).length)throw Error('This object overlaps native events or connections and must stay fixed.');
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=map.width||y>=map.height||inside(a,{x,y}))throw Error('Choose an uncovered ground tile outside the object.');
 if((map.nativeAssemblies||[]).some(o=>inside(o,{x,y}))||map.objects.some(o=>inside(o,{x,y})))throw Error('Choose uncovered terrain, not another object.');
 const i=y*map.width+x;if(!map.layers.ground[i])throw Error('Choose a tile with ground artwork.');const rule=movementAt(map,x,y,{objects:[]});if(rule.collision)throw Error('Choose uncovered walkable ground or water, not a blocked tile.');const movement={mode:rule.mode,collision:rule.collision,elevation:rule.elevation,...(Number.isInteger(rule.behavior)?{behavior:rule.behavior}:{}),...(Number.isInteger(rule.layerType)?{layerType:rule.layerType}:{})};
 a.before={layers:Object.fromEntries(Object.keys(map.layers).map(k=>[k,Array.from({length:a.w*a.h},()=>copy(map.layers[k][i]??null))])),movement:Array.from({length:a.w*a.h},()=>copy(movement))};a.reconstruction.underlayApproved=true;a.reconstruction.ground={x,y};return a;
}
export function approveReconstructionPatch(project,map,id,cells){const a=map.nativeAssemblies?.find(a=>a.id===id);if(!a?.reconstruction)throw Error('Choose a reconstructed object.');if(a.reconstruction.protectedEvents||reconstructionEvents(project,map,a).length)throw Error('This object contains native events or connections and must stay fixed.');if(!Array.isArray(cells)||cells.length!==a.w*a.h||cells.some(c=>!c?.layers||!c.rule))throw Error('Complete every tile in the background patch.');if(!a.reconstruction.nativeRules){if(a.reconstruction.relocated)throw Error('Reconstruct this legacy moved object from its original source ROM.');const source=captureNativeAssembly(map,a);a.reconstruction.nativeRules=copy(source.rules);a.reconstruction.nativeTiles=copy(source.layers);a.reconstruction.occupiedIds=[...new Set(source.layers.ground.filter(Boolean).map(t=>t.sy/16*16+t.sx/16))];}a.before=patchData(cells);a.reconstruction.underlayApproved=true;a.reconstruction.patchVersion=1;delete a.reconstruction.ground;return a;}
