import{cropNativePlanes,floorColours,exteriorCutout,compositePlanes}from'./object-cutouts.js';
import{newProject}from'./model.js';
import{importRomMaps}from'./rom-import.js';
import{captureNativeAssembly}from'./native-assemblies.js';
export async function readObjectRecipes(){const r=await fetch('assets/rom-object-recipes.json');if(!r.ok)throw Error('The ROM object catalogue could not be opened.');return r.json();}
export async function loadRomObjects(project,reader,sourceId,profile,encodeAtlas,preview=null){
 if(sourceId!==profile.sha256)throw Error('These object recipes belong to a different ROM revision. Use Extract to save objects from this ROM.');
 const keys=[...new Set(profile.objects.map(o=>o.key))],loaded=await importRomMaps(newProject(),reader,keys,{sourceId,asNew:true,includeEvents:false,encodeAtlas});
 const templates=[];
 for(const recipe of profile.objects){const m=loaded.project.maps.find(m=>m.rom.key===recipe.key);if(!m||reader.mapWarnings(reader.byKey(recipe.key)).length)continue;
  const t=captureNativeAssembly(m,recipe,{id:sourceId.slice(0,16)+'-'+recipe.id,name:recipe.name,category:profile.name+' · '+recipe.category,entrances:recipe.entrances});
  if(recipe.rows)for(let y=0;y<recipe.h;y++){const row=captureNativeAssembly(m,{x:recipe.x,y:recipe.rows[y],w:recipe.w,h:1});for(const k of Object.keys(t.layers))t.layers[k].splice(y*recipe.w,recipe.w,...row.layers[k]);t.rules.splice(y*recipe.w,recipe.w,...row.rules);}
  t.sourceName=profile.styleName||profile.name;t.category=t.sourceName+' · '+recipe.category;t.recipeId=recipe.id;t.profileId=profile.id;
  const raw=cropNativePlanes(reader,recipe),planes=exteriorCutout(raw.planes,raw.width,raw.height,floorColours(reader,profile,recipe)),planeAssetIds=[];
  for(const[x,y,w,h]of recipe.eraseRects||[])for(const plane of planes)for(let dy=0;dy<h;dy++)plane.fill(0,((y+dy)*raw.width+x)*4,((y+dy)*raw.width+x+w)*4);
  for(let l=0;l<planes.length;l++){const id='cutout-v2-'+t.id+'-'+l;planeAssetIds.push(id);loaded.project.assets.push({id,name:t.name+' · cutout plane '+l,width:raw.width,height:raw.height,tileSize:16,data:await encodeAtlas({width:raw.width,height:raw.height,pixels:planes[l]})});}
  const pixels=compositePlanes(planes),mask=Array.from({length:t.w*t.h},(_,i)=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(pixels[((Math.floor(i/t.w)*16+y)*raw.width+i%t.w*16+x)*4+3])return true;return false;});t.overlay={version:2,planeAssetIds,mask};t.preview=await encodeAtlas({width:raw.width,height:raw.height,pixels});
  t.entrances=reader.events(reader.byKey(recipe.key)).warps.filter(e=>e.x>=recipe.x&&e.x<recipe.x+recipe.w&&e.y>=recipe.y&&e.y<recipe.y+recipe.h).map(e=>({x:e.x-recipe.x,y:e.y-recipe.y,target:e.target,warp:e.warp}));
  templates.push(t);
 }
 return{templates,assets:loaded.project.assets.filter(a=>!project.assets.some(b=>b.id===a.id))};
}
