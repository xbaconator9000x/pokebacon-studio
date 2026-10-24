import {interiorAssets} from './interior-model.js';
import {clone,uid,newProject,validateProject} from './model.js';

const COLLECTIONS=['terrainSets','prefabs','roomStyles','wallStyles','gateStyles','buildingTemplates','interiorTemplates'];
const EMPTY=()=>({id:'shared',format:'shattered-library-1',version:1,assets:[],terrainSets:[],prefabs:[],roomStyles:[],wallStyles:[],gateStyles:[],buildingTemplates:[],interiorTemplates:[],deleted:[],migrated:[],updatedAt:''});
export function definitionAssets(key,item){return [...new Set(key==='interiorTemplates'?interiorAssets(item):key==='terrainSets'?[item.assetId,...(item.variants||[]),...(item.eraseTile?[item.eraseTile.a]:[])]:key==='prefabs'?[item.assetId,item.sourceAssetId].filter(Boolean):key==='gateStyles'?[item.closedAssetId,item.openAssetId].filter(Boolean):key==='buildingTemplates'?[item.assetId,item.extensionXAssetId,item.extensionYAssetId,item.extensionXYAssetId].filter(Boolean):key==='wallStyles'?[item.assetId]:[item.floor.a,item.wall.a])];}
export function validateLibrary(value,catalog=[]){
 if(value?.format!=='shattered-library-1'||value.version!==1)throw new Error('Choose an exported Shattered object library (.library.json).');
 value={wallStyles:[],gateStyles:[],buildingTemplates:[],interiorTemplates:[],...value};
 if(!Array.isArray(value.assets)||value.assets.length>4096||COLLECTIONS.some(k=>!Array.isArray(value[k])||value[k].length>2048))throw new Error('This library is too large or incomplete.');
 const result={...EMPTY(),...clone(value),id:'shared'},ids=new Set();
 for(const a of result.assets){if(ids.has(a.id))throw new Error('Duplicate library image ID.');ids.add(a.id);}
 // Reuse project validation in bounded groups without weakening its limits.
 for(const key of COLLECTIONS)for(let at=0;at<result[key].length;at+=128){const p=newProject('Library validation'),items=result[key].slice(at,at+128),refs=new Set(items.flatMap(v=>definitionAssets(key,v)));p[key]=items;p.assets=result.assets.filter(a=>refs.has(a.id));validateProject(p,catalog);}
 for(let at=0;at<result.assets.length;at+=256){const p=newProject('Library artwork validation');p.assets=result.assets.slice(at,at+256);validateProject(p,catalog);}
 for(const key of COLLECTIONS){const seen=new Set();for(const item of result[key]){if(seen.has(item.id))throw new Error('Duplicate library template ID.');seen.add(item.id);}}
 result.deleted=Array.isArray(result.deleted)?result.deleted.filter(v=>typeof v==='string').slice(-4096):[];result.migrated=Array.isArray(result.migrated)?result.migrated.filter(v=>typeof v==='string').slice(-4096):[];return result;
}

/** A device-wide collection, independent of map-project history. Writes serialize. */
export class SharedLibrary {
 constructor({catalog=[],builtin={},write=async()=>{}}={}){this.catalog=catalog;this.builtin=builtin;this.write=write;this.value=EMPTY();this.queue=Promise.resolve();}
 upgrade(key,item){if(key!=='prefabs')return item;const builtin=(this.builtin[key]||[]).find(v=>v.id===item.id);if(builtin&&item.assetId===builtin.assetId&&builtin.legacyNames?.includes(item.name))return {...item,name:builtin.name,category:builtin.legacyCategories?.includes(item.category)?builtin.category:item.category,tags:builtin.tags};return item;}
 upgradeProject(project){for(const key of COLLECTIONS)if(project[key])project[key]=project[key].map(v=>this.upgrade(key,v));for(const map of project.maps||[])for(const o of map.objects||[]){const p=this.builtin.prefabs?.find(p=>p.id===o.prefabId);if(p&&o.assetId===p.assetId&&p.legacyNames?.includes(o.name))o.name=p.name;}return project;}
 load(value){if(value){this.value=validateLibrary(value,this.catalog);for(const key of COLLECTIONS)this.value[key]=this.value[key].map(v=>this.upgrade(key,v));}return this.value;}
 asset(id){return this.value.assets.find(a=>a.id===id);}
 list(key,project={}){const defaults=this.builtin[key]||[],deleted=new Set(this.value.deleted),items=[...this.value[key],...defaults,...(project[key]||[])],seen=new Set();return items.filter(v=>{if(seen.has(v.id)||deleted.has(v.id))return false;seen.add(v.id);return true;}).map(v=>this.upgrade(key,v));}
 has(key,id){return this.value[key].some(v=>v.id===id);}
 async transact(update){const task=this.queue.catch(()=>{}).then(async()=>{const next=clone(this.value),result=update(next);next.updatedAt=new Date().toISOString();const used=new Set(COLLECTIONS.flatMap(key=>next[key].flatMap(item=>definitionAssets(key,item))));next.assets=next.assets.filter(a=>used.has(a.id));validateLibrary(next,this.catalog);await this.write(next);this.value=next;return result;});this.queue=task;return task;}
 async save(key,item,lookup,extra=[]){return this.transact(next=>{
  if(!COLLECTIONS.includes(key))throw new Error('Unsupported library collection.');
  const assets=new Map(extra.map(a=>[a.id,a]));for(const id of definitionAssets(key,item)){const a=assets.get(id)||lookup(id)||next.assets.find(a=>a.id===id);if(!a)throw new Error('The template artwork is missing.');if(!this.catalog.some(c=>c.id===id))assets.set(id,a);}
  for(const a of assets.values()){next.assets=next.assets.filter(v=>v.id!==a.id);next.assets.push(clone(a));}
  next[key]=next[key].filter(v=>v.id!==item.id);next[key].push({...clone(item),updatedAt:Date.now()});next.deleted=next.deleted.filter(id=>id!==item.id);return item;
 });}
 async duplicate(key,item,lookup){const copy={...clone(item),id:uid(),name:item.name+' copy'};await this.save(key,copy,lookup);return copy;}
 async remove(key,id){return this.transact(next=>{next[key]=next[key].filter(v=>v.id!==id);if(!next.deleted.includes(id))next.deleted.push(id);});}
 async migrate(projects,lookup){projects=projects.filter(p=>p&&!this.value.migrated.includes(p.id));if(!projects.length)return 0;return this.transact(next=>{
  const migrated=new Set(next.migrated),already=new Set(COLLECTIONS.flatMap(k=>next[k].map(v=>k+':'+v.id))),assets=new Map(next.assets.map(a=>[a.id,a]));let count=0;
  for(const project of projects.filter(Boolean).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))){
   if(migrated.has(project.id))continue;
   for(const key of COLLECTIONS)for(const original of project[key]||[]){const item=this.upgrade(key,original);
    if(next.deleted.includes(item.id))continue;const builtin=(this.builtin[key]||[]).find(v=>v.id===item.id);if(builtin&&JSON.stringify(item)===JSON.stringify(builtin))continue;
    if(key==='terrainSets'&&builtin&&item.assetId===builtin.assetId&&builtin.legacyNames?.includes(item.name))continue;
    const refs=definitionAssets(key,item),found=refs.map(id=>project.assets?.find(a=>a.id===id)||assets.get(id)||lookup(id));if(found.some(v=>!v))continue;
    const legacy={'garden-house':'Garden house','house-sign':'Wooden sign','small-pot':'Small potted plant','bookcase':'Bookcase','television':'Television','computer':'Computer','pink-rug':'Pink rug','yellow-rug':'Patterned rug'};if(key==='prefabs'&&legacy[item.id]===item.name&&item.assetId.startsWith('ekat-'))continue;
    const token=key+':'+item.id;if(already.has(token))continue;
    next[key].push(clone(item));already.add(token);count++;for(const a of found)if(!this.catalog.some(c=>c.id===a.id))assets.set(a.id,clone(a));
   }
   migrated.add(project.id);
  }
  next.assets=[...assets.values()];next.migrated=[...migrated];return count;
 });}
 attach(project,key,item){
  const refs=definitionAssets(key,item),assets=refs.map(id=>this.asset(id)).filter(Boolean),add=assets.filter(a=>!project.assets.some(v=>v.id===a.id));if(project.assets.length+add.length>512)throw new Error('This project is full. Start another map project to use more library artwork.');
  project.assets.push(...clone(add));project[key]??=[];project[key]=project[key].filter(v=>v.id!==item.id);project[key].push(clone(item));
 }
 export(){const copy=clone(this.value);copy.migrated=[];return copy;}
 async import(value,lookup){const imported=validateLibrary(value,this.catalog);return this.transact(next=>{
  const assets=new Map(next.assets.map(a=>[a.id,a])),remap=new Map();for(const a of imported.assets){const exists=assets.get(a.id);if(exists&&JSON.stringify(exists)!==JSON.stringify(a)){const id=uid();remap.set(a.id,id);assets.set(id,{...a,id});}else assets.set(a.id,a);}
  let count=0;for(const key of COLLECTIONS)for(const source of imported[key]){const item=clone(source);if(key==='interiorTemplates'){for(const layer of Object.values(item.layers))for(const cell of layer)if(cell)cell.a=remap.get(cell.a)||cell.a;for(const o of item.objects||[])o.assetId=remap.get(o.assetId)||o.assetId;}else if(key==='gateStyles'){for(const field of ['closedAssetId','openAssetId'])if(item[field])item[field]=remap.get(item[field])||item[field];}else if(key==='roomStyles'){for(const part of ['wall','floor'])item[part].a=remap.get(item[part].a)||item[part].a;}else{item.assetId=remap.get(item.assetId)||item.assetId;for(const field of ['extensionXAssetId','extensionYAssetId','extensionXYAssetId'])if(item[field])item[field]=remap.get(item[field])||item[field];if(item.sourceAssetId)item.sourceAssetId=remap.get(item.sourceAssetId)||item.sourceAssetId;}
   if(item.variants)item.variants=item.variants.map(id=>remap.get(id)||id);if(item.eraseTile?.a)item.eraseTile.a=remap.get(item.eraseTile.a)||item.eraseTile.a;
   const existing=next[key].find(v=>v.id===item.id);if(existing&&JSON.stringify(existing)===JSON.stringify(item))continue;if(existing){item.id=uid();item.name+=' (imported)';}next[key].push(item);next.deleted=next.deleted.filter(id=>id!==item.id);count++;
  }
  next.assets=[...assets.values()];return count;
 });}
}
