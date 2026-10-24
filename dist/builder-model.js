import {assertObjectPlacement} from './native-assemblies.js';
import{uid,newMap,inBounds,setTile}from'./model.js';
import{buildRoom}from'./smart-model.js';
import{setMovement,addPortal}from'./world-model.js';
import{objectDefaults}from'./movement-defaults.js';

export function buildingAxes(t){return{x:!!(t.repeatX?.length||t.extensionXAssetId),y:!!(t.repeatY?.length||t.extensionYAssetId)};}
export function fitBuildingRect(t,rect,map){const a=buildingAxes(t),x=Math.min(rect.x1,rect.x2),y=Math.min(rect.y1,rect.y2),w=a.x?Math.max(t.minW||t.w,Math.abs(rect.x2-rect.x1)+1):t.w,h=a.y?Math.max(t.minH||t.h,Math.abs(rect.y2-rect.y1)+1):t.h;if(x<0||y<0||x+t.w>map.width||y+t.h>map.height)throw Error('Leave room for the complete building inside the map.');return{x1:x,y1:y,x2:x+Math.min(64,w,map.width-x)-1,y2:y+Math.min(64,h,map.height-y)-1};}

export function expandAxis(base,size,repeats=[],insertions=null){
 if(!Number.isInteger(base)||!Number.isInteger(size)||base<1||size<base||size>64)throw Error('Use a whole building size between its minimum and 64 tiles.');
 if(insertions?.length&&size>base){const spots=[...new Set(insertions)];if(spots.some(i=>!Number.isInteger(i)||i<0||i>base))throw Error('A structural extension has an invalid insertion point.');const counts=Array(base+1).fill(0);for(let i=0;i<size-base;i++)counts[spots[i%spots.length]]++;return counts.flatMap((n,i)=>[...Array(n).fill(-1),...(i<base?[i]:[])]);}
 const allowed=[...new Set(repeats)].filter(i=>Number.isInteger(i)&&i>=0&&i<base),counts=Array(base).fill(1);
 if(size>base&&!allowed.length)throw Error('This template has no repeating section on that axis. Keep its original size.');
 for(let i=0;i<size-base;i++)counts[allowed[i%allowed.length]]++;
 return counts.flatMap((n,i)=>Array(n).fill(i));
}
export function planBuilding(template,rect,map){
 const x=Math.min(rect.x1,rect.x2),y=Math.min(rect.y1,rect.y2),w=Math.abs(rect.x2-rect.x1)+1,h=Math.abs(rect.y2-rect.y1)+1;
 const minW=template.minW||template.w,minH=template.minH||template.h;
 if(w<minW||h<minH)throw Error(template.name+' needs at least '+minW+' × '+minH+' tiles.');
 if(map&&(!inBounds(map,x,y)||x+w>map.width||y+h>map.height))throw Error('The complete building must fit inside the map.');
 if(map)assertObjectPlacement(map,{x,y,w,h});
 const columns=expandAxis(template.w,w,template.repeatX,template.extensionXAssetId?template.insertX:null),rows=expandAxis(template.h,h,template.repeatY,template.extensionYAssetId?template.insertY:null),entrance={x:columns.indexOf(template.entrance.x),y:rows.lastIndexOf(template.entrance.y)};
 if(entrance.x<0||entrance.y<0)throw Error('This template has no valid entrance.');
 return{x,y,w,h,columns,rows,entrance};
}
export function drawBuilding(ctx,image,template,plan,{extensionX=null,extensionY=null,extensionXY=null}={}){
 ctx.imageSmoothingEnabled=false;
 for(let y=0;y<plan.h;y++)for(let x=0;x<plan.w;x++){
  const col=plan.columns[x],row=plan.rows[y];
  if(col===-1&&row===-1){if(!extensionXY)throw Error('The building’s corner extension artwork is missing.');ctx.drawImage(extensionXY,0,0,16,16,x*16,y*16,16,16);}
  else if(col===-1){if(!extensionX)throw Error('The building’s width extension artwork is missing.');ctx.drawImage(extensionX,0,row*16,16,16,x*16,y*16,16,16);}
  else if(row===-1){if(!extensionY)throw Error('The building’s height extension artwork is missing.');ctx.drawImage(extensionY,col*16,0,16,16,x*16,y*16,16,16);}
  else ctx.drawImage(image,(template.sx||0)+col*16,(template.sy||0)+row*16,16,16,x*16,y*16,16,16);
 }
}
export function buildingObject(template,plan,assetId){const fitted=template.collisionMask&&plan.w===template.w&&plan.h===template.h,depth=Math.max(1,Math.ceil(plan.h/2));return{id:uid(),assetId,sx:0,sy:0,sw:plan.w*16,sh:plan.h*16,x:plan.x,y:plan.y,w:plan.w,h:plan.h,name:template.name,flipX:false,flipY:false,collisionChoice:fitted?'mask':'footprint',...(fitted?{collisionMask:structuredClone(template.collisionMask)}:{footprint:{x:0,y:plan.h-depth,w:plan.w,h:depth}}),building:{templateId:template.id,entrance:{...plan.entrance},kind:template.kind,region:template.region}};}
export function prefabObject(p,x,y){return{id:uid(),assetId:p.assetId,sx:p.sx||0,sy:p.sy||0,sw:p.sw||p.w*16,sh:p.sh||p.h*16,x,y,w:p.w,h:p.h,name:p.name,prefabId:p.id,flipX:!!p.flipX,flipY:!!p.flipY,nineSlice:p.nineSlice||0,...objectDefaults(p)};}
export function makeInterior(project,exterior,object,template,recipe,{width,height,name,decorate=true,prefabs=[],themes=[]}={}){
 if(project.maps.length>=80)throw Error('This project has 80 maps. Start another project before adding an interior.');
 const theme=themes.find(t=>t.id===recipe?.themeId)||themes[0];if(!theme)throw Error('This interior needs a floor and wallpaper theme.');
 width=Math.max(recipe?.minW||12,Math.min(64,width||recipe?.width||16));height=Math.max(recipe?.minH||12,Math.min(64,height||recipe?.height||14));
 if(project.maps.reduce((n,m)=>n+m.width*m.height,0)+width*height>400000)throw Error('This interior would exceed the project tile limit.');
 const map=newMap(name||template.name+' · interior',width,height),entrance={x:Math.floor(width/2),y:height-1};
 map.world={x:exterior.world.x+280,y:exterior.world.y+project.maps.filter(m=>m.generator?.exteriorId===exterior.id).length*210};
 map.generator={type:'interior',templateId:template.id,kind:template.kind,region:template.region,exteriorId:exterior.id,buildingId:object.id,entrance};
 buildRoom(map,{x1:0,y1:0,x2:width-1,y2:height-1},theme);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)setMovement(map,x,y,{mode:y<(theme.wall.rows||3)||x===0||x===width-1||y===height-1?'block':'walk',elevation:3});
 const add=(id,x,y,choice)=>{const p=prefabs.find(p=>p.id===id);if(!p)return false;x=Math.round(x);y=Math.round(y);if(x<1||y<1||x+p.w>width-1||y+p.h>height-1)return false;if(x<=entrance.x&&x+p.w>entrance.x&&y+p.h>height-4)return false;const o=prefabObject(p,x,y);if(choice)o.collisionChoice=choice;map.objects.push(o);return true;};
 if(decorate)for(const p of recipe?.placements||[]){const def=prefabs.find(a=>a.id===p.id);if(!def)continue;const x=p.anchor==='right'?width-1-def.w-(p.x||1):p.anchor==='center'?Math.floor((width-def.w)/2)+(p.x||0):p.x;const y=p.bottom?height-def.h-p.bottom:p.y;add(p.id,x,y,p.collisionChoice);}
 setMovement(map,entrance.x,entrance.y,{mode:'walk',elevation:3});setMovement(map,entrance.x,entrance.y-1,{mode:'walk',elevation:3});
 const door={mapId:exterior.id,x:Math.round(object.x+object.building.entrance.x),y:Math.round(object.y+object.building.entrance.y)};
 map.rom={sourceId:exterior.rom?.sourceId||null,generated:true,templateKey:null,interiorKind:template.kind,originalWidth:0,originalHeight:0,originalBlocks:[]};
 project.maps.push(map);const link=addPortal(project,door,{mapId:map.id,...entrance},{twoWay:true,label:template.name+' entrance'});link.buildingId=object.id;object.building.interiorId=map.id;return map;
}
export function treeFootprint(p){return p.footprint||{x:Math.max(0,Math.floor((p.w-1)/2)),y:p.h-1,w:Math.min(1,p.w),h:1};}
export function objectDrawOrder(map){const trees=map.objects.filter(o=>o.tree).sort((a,b)=>a.y+a.h-b.y-b.h||a.x-b.x);let i=0;return map.objects.map(o=>o.tree?trees[i++]:o);}
export function plantTree(map,p,x,y,{spacing=1,erase=false}={}){
 const foot=treeFootprint(p),left=Math.round(x-foot.x),top=Math.round(y-foot.y);
 if(erase){const before=map.objects.length;map.objects=map.objects.filter(o=>!o.tree||Math.abs(o.x+(o.footprint?.x||0)-x)>=spacing||Math.abs(o.y+(o.footprint?.y||o.h-1)-y)>=spacing);return before!==map.objects.length;}
 if(left<0||top<0||left+p.w>map.width||top+p.h>map.height)return false;
 for(const o of map.objects){if(!o.tree)continue;const f=o.footprint||{x:0,y:o.h-1,w:o.w,h:1};if(Math.abs(o.x+f.x-x)<spacing&&Math.abs(o.y+f.y-y)<spacing)return false;}
 assertObjectPlacement(map,{x:left,y:top,w:p.w,h:p.h});
 const o=prefabObject(p,left,top);o.tree=true;o.footprint=foot;o.collisionChoice=map.autoCollision===false?'keep':'footprint';map.objects.push(o);return true;
}
export function validateBuilder(project,assetIds){
 if(!Array.isArray(project.buildingTemplates||[])||(project.buildingTemplates||[]).length>2048)throw Error('The building collection is too large.');
 for(const t of project.buildingTemplates||[]){
  if(!t||typeof t.id!=='string'||typeof t.name!=='string'||!assetIds.has(t.assetId)||['X','Y','XY'].some(a=>t['extension'+a+'AssetId']&&!assetIds.has(t['extension'+a+'AssetId']))||![t.w,t.h].every(n=>Number.isInteger(n)&&n>=1&&n<=64)||!t.entrance||!Number.isInteger(t.entrance.x)||!Number.isInteger(t.entrance.y)||t.entrance.x<0||t.entrance.y<0||t.entrance.x>=t.w||t.entrance.y>=t.h)throw Error('A building template has invalid artwork or entrance.');
  for(const [axis,size]of [['X',t.w],['Y',t.h]]){const repeat=t['repeat'+axis]||[],insert=t['insert'+axis]||[];if(!Array.isArray(repeat)||!Array.isArray(insert)||repeat.some(n=>!Number.isInteger(n)||n<0||n>=size)||insert.some(n=>!Number.isInteger(n)||n<0||n>size)||t['extension'+axis+'AssetId']&&!insert.length)throw Error('A building template has invalid resize rules.');}
  if(t.extensionXAssetId&&t.extensionYAssetId&&!t.extensionXYAssetId)throw Error('A building needs corner extension artwork for resizing both ways.');
 }
 for(const m of project.maps)for(const o of m.objects){if(o.building&&(!o.building.entrance||![o.building.entrance.x,o.building.entrance.y].every(Number.isInteger)))throw Error('A building entrance is invalid.');if(o.footprint&&(![o.footprint.x,o.footprint.y,o.footprint.w,o.footprint.h].every(Number.isFinite)||o.footprint.x<0||o.footprint.y<0||o.footprint.w<=0||o.footprint.h<=0||o.footprint.x+o.footprint.w>o.w||o.footprint.y+o.footprint.h>o.h))throw Error('An object collision footprint is invalid.');}
}
