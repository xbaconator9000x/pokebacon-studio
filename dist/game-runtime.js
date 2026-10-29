import{discoverItemTable,readNativeItems}from'./rom-items.js';
import{discoverFormCapacity}from'./expanded-form-native.js';
import{discoverGameData,readGameData,discoverSceneData}from'./game-data.js';
import{discoverNativeSprites}from'./native-sprites.js';
import{digestBytes}from'./playtest-core.js';
import{identifySaveProfile}from'./save-profiles.js';
const cache=new WeakMap();
export function gameContext(reader,progress=()=>{}){if(!cache.has(reader))cache.set(reader,(async()=>{
 const hash=await digestBytes(reader.bytes),issues=[],attempt=async(name,fn)=>{try{return await fn();}catch(e){issues.push({feature:name,message:e.message});return null;}};
 identifySaveProfile(reader.bytes,hash);
 const sprites=await attempt('Sprites',()=>discoverNativeSprites(reader.bytes,{engine:reader.engine,sourceSha256:hash,progress})),profile=await attempt('Game data',()=>discoverGameData(reader,{sourceSha256:hash,progress})),forms=await attempt('Native forms',()=>discoverFormCapacity(reader.bytes,{sourceSha256:hash}));
 const itemTable=discoverItemTable(reader),nativeItems=itemTable?readNativeItems(reader,itemTable):[];
 const scriptProfile={sourceSha256:hash,engine:reader.engine,itemIds:itemTable?.validIds,speciesCount:sprites?.count||profile?.speciesCount||0,itemCount:itemTable?.count||profile?.itemCount||0,trainerCount:profile?.trainerCount||0};
 let data=profile?await attempt('Game database',()=>readGameData(reader.bytes,profile)):null;
 let resolvedProfile=data?profile:null;if(itemTable&&!resolvedProfile){resolvedProfile={sourceSha256:hash,itemTable,speciesCount:scriptProfile.speciesCount,moveCount:0,itemCount:itemTable.count,trainerCount:0,capabilities:{species:false,moves:false,items:true,trainers:false,encounters:false}};data={species:[],moves:[],items:nativeItems,abilities:[],trainers:[],trainerClasses:[],encounters:[]};}
 if(itemTable&&resolvedProfile){resolvedProfile.itemTable=itemTable;resolvedProfile.items=itemTable.base;if(itemTable.expansion)resolvedProfile.itemIcons=itemTable.expansion.icons;resolvedProfile.itemCount=itemTable.count;resolvedProfile.capabilities.items=true;data.items=nativeItems;}
 return{reader,hash,profile:resolvedProfile,scene:{profile:scriptProfile,data:{items:nativeItems.length?nativeItems:data?.items||[]}},scriptProfile,forms,data,sprites,issues};
 })().catch(e=>{cache.delete(reader);throw e;}));return cache.get(reader);}

const spriteCache=new WeakMap();
export function spriteContext(reader,progress=()=>{}){if(!spriteCache.has(reader))spriteCache.set(reader,(async()=>{const hash=await digestBytes(reader.bytes),sprites=await discoverNativeSprites(reader.bytes,{engine:reader.engine,sourceSha256:hash,progress});return{reader,hash,sprites};})().catch(e=>{spriteCache.delete(reader);throw e;}));return spriteCache.get(reader);}
