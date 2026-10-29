import {newMap,uid} from './model.js';
import {addPortal} from './world-model.js';
// Explicit catalogue audit. Height alone cannot distinguish a tall roof from storeys.
const floors={
 '3d0c79f1627022e1-firered-0':2,'included-kanto-pallet-coral-townhouse':2,
 '3d0c79f1627022e1-firered-city-office':3,'3d0c79f1627022e1-firered-city-home':2,
 'cdfb9e1f83f72c05-heart-soul-1':2,'cdfb9e1f83f72c05-heart-soul-2':2,'cdfb9e1f83f72c05-heart-soul-3':2,
 'cdfb9e1f83f72c05-heart-soul-city-highrise':4,'cdfb9e1f83f72c05-heart-soul-city-office':2,
 '7aa25bbf568f7cfc-unbound-1':2,'included-johto-new-bark-gabled-home':2,'included-johto-new-bark-small-home':2,'included-johto-new-bark-yellow-door-home':2,
 'included-kanto-pewter-museum':2,'included-kanto-celadon-green-offices':3,
 'included-native-v32-building-celadon-mansion':3,'included-native-v32-building-saffron-silph-tower':11,
 'included-johto-ecruteak-tall-temple':5
};
export function buildingFloorCount(t){const n=t.floorCount??floors[t.id]??(t.kind==='centre'&&['firered','heart-soul'].includes(t.profileId)?2:1);if(!Number.isInteger(n)||n<1||n>11)throw Error('Building floors must be a whole number from 1 to 11.');return n;}
const nativeStairs={'room-firered-4-0':{x:11,y:2},'room-firered-5-4':{x:1,y:7},'room-tre-42-4':{x:1,y:7},'room-heart-soul-2-0':{x:1,y:7}};
export function addBuildingFloors(work,exterior,assembly,template,ground,source,library){
 const count=buildingFloorCount(template);assembly.floorCount=count;assembly.floorIds=[ground.id];ground.generator={...ground.generator,buildingId:assembly.id,floorIndex:0,floorCount:count};
 if(count===1)return;
 const staircase=library.assets.find(a=>a.id==='room-firered-4-0');if(!staircase)throw Error('The included staircase artwork is missing.');if(!work.assets.some(a=>a.id===staircase.id))work.assets.push(staircase);
 const all=[ground],sample=source.movement.findIndex((r,i)=>r?.mode==='walk'&&!r.collision&&i%source.width>1&&i%source.width<source.width-2&&Math.floor(i/source.width)>2&&Math.floor(i/source.width)<source.height-2),floorTile={a:source.assetId,sx:(sample%source.width)*16,sy:Math.floor(sample/source.width)*16,size:16},walk={mode:'walk',collision:0,elevation:3,behavior:0,layerType:1};if(sample<0)throw Error('This interior has no safe floor tile.');
 for(let i=1;i<count;i++){const m=newMap(ground.name+' · '+(i+1)+'F',ground.width,ground.height);m.rom=structuredClone(ground.rom);m.movement=structuredClone(ground.movement);m.layers=structuredClone(ground.layers);m.generator={...ground.generator,floorIndex:i};m.world={x:ground.world.x+280*i,y:ground.world.y};m.notes='Upper floor using the same interior family. Furnish and personalise before release.';for(let y=Math.max(0,source.entry.y-1);y<m.height;y++)for(let x=Math.max(0,source.entry.x-1);x<=Math.min(m.width-1,source.entry.x+1);x++){m.layers.ground[y*m.width+x]={...floorTile};m.movement[y*m.width+x]={...walk,mode:'block',collision:1};}all.push(m);work.maps.push(m);assembly.floorIds.push(m.id);}
 // Reserve separate up/down landings so intermediate floors never stack warps.
 const stair=(m,side)=>{const native=nativeStairs[source.id],existing=native&&(side==='down'||m===ground),x=existing?native.x:(side==='up'?m.width-4:2),y=existing?native.y-1:m.height-4;if(!existing)for(let yy=y;yy<y+3;yy++)for(let xx=x;xx<x+2;xx++){m.layers.ground[yy*m.width+xx]={...floorTile};m.movement[yy*m.width+xx]={...walk};}const target={x,y:y+1},entry=source.entry;let xx=entry.x,yy=Math.min(m.height-2,entry.y);while(xx!==target.x||yy!==target.y){if(xx!==target.x)xx+=Math.sign(target.x-xx);else yy+=Math.sign(target.y-yy);if(!existing||xx!==target.x||yy!==target.y)m.layers.ground[yy*m.width+xx]={...floorTile};m.movement[yy*m.width+xx]={...walk};}if(!existing)m.objects.push({id:uid(),name:side==='up'?'Stairs up':'Stairs down',assetId:staircase.id,x,y,w:2,h:2,sx:176,sy:16,sw:32,sh:32,collisionChoice:'walk'});connectInteriorLanding(m,target,floorTile);return target;};
 const project={maps:[exterior,...all],links:work.links};for(let i=0;i<all.length-1;i++){const a=stair(all[i],'up'),b=stair(all[i+1],'down'),l=addPortal(project,{mapId:all[i].id,...a},{mapId:all[i+1].id,...b},{twoWay:true,label:template.name+' · '+(i+1)+'F ↔ '+(i+2)+'F',style:'step'});l.assemblyId=assembly.id;}
}

// Imported room movement can isolate a door landing from the main room. Join it
// through the fewest blocked cells, using that room's own floor artwork.
export function connectInteriorLanding(map,point,floorTile){
 const w=map.width,h=map.height,walk=i=>i>=0&&i<w*h&&!map.movement[i]?.collision&&map.movement[i]?.mode!=='water',adj=i=>[i%w?i-1:-1,i%w<w-1?i+1:-1,i-w,i+w].filter(j=>j>=0&&j<w*h),visited=new Set();let main=[];
 for(let start=0;start<w*h;start++){if(visited.has(start)||!walk(start))continue;const cells=[start];visited.add(start);for(let i=0;i<cells.length;i++)for(const j of adj(cells[i]))if(!visited.has(j)&&walk(j)){visited.add(j);cells.push(j);}if(cells.length>main.length)main=cells;}
 const target=new Set(main),start=point.y*w+point.x;if(target.has(start))return;const queue=[start],previous=new Int32Array(w*h).fill(-1),cost=new Float64Array(w*h).fill(Infinity);cost[start]=0;let end=null;while(queue.length){queue.sort((a,b)=>cost[b]-cost[a]);const i=queue.pop();if(target.has(i)){end=i;break;}for(const j of adj(i)){if(j%w===0||j%w===w-1||j<w||j>=w*(h-1))continue;const c=cost[i]+(walk(j)?1:25);if(c<cost[j]){cost[j]=c;previous[j]=i;if(!queue.includes(j))queue.push(j);}}}if(end===null)throw Error('The interior landing cannot reach its main room.');for(let i=end;i!==start;i=previous[i])if(!walk(i)){map.layers.ground[i]={...floorTile};map.movement[i]={mode:'walk',collision:0,elevation:3,behavior:0,layerType:1};}
}
