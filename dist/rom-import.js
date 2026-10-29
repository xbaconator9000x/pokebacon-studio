import{indexNativeStory}from'./native-story.js';
import{nativeRenderTile}from'./render-intent.js';
import {npcTemplates} from './npc.js';
import {indexedSpritePNG} from './sprite-png.js';
import {disassembleScript} from './script-engine.js';
import {nativeLayerTypes} from './native-priority.js';
import {clone,newMap,newProject,uid,addLink,inBounds,LIMIT} from './model.js';
import {nativeMovementDefaults} from './movement-defaults.js';

export function pinsForEvents(events,reader){
  const pins=[];
  for(const n of events.npcs)pins.push({id:uid(),x:n.x,y:n.y,kind:'npc',title:`NPC ${n.localId} · sprite ${n.sprite}`,text:'NPC placement from the ROM. Use this pin to describe changes to this character or their position.',rom:{type:'npc',...n}});
  for(const n of events.warps.filter(w=>w.elevation!==255)){const target=reader.byKey(n.target);pins.push({id:uid(),x:n.x,y:n.y,kind:'event',title:target?`Door / warp to ${target.label}`:'Door / warp',text:target?`Destination map ${n.target}, arrival warp ${n.warp}. Import the destination map to show this connection.`:'The destination is selected by the game or is not present in this map table.',rom:{type:'warp',...n}});}
  for(const n of events.signs)pins.push({id:uid(),x:n.x,y:n.y,kind:n.type>=5&&n.type<=7?'event':'sign',title:n.type>=5&&n.type<=7?`Hidden item ${n.index+1}`:`Sign / interaction ${n.index+1}`,text:'Interaction event from the ROM. Add the desired change here.',rom:{...n,type:'sign',signType:n.type}});
  for(const n of events.triggers)pins.push({id:uid(),x:n.x,y:n.y,kind:'event',title:`Event trigger ${n.index+1}`,text:'A game event can activate on this tile. Add the desired change here.',rom:{type:'trigger',...n}});
  for(const pin of pins){
    const n=pin.rom;
    if(n.type==='sign'&&n.signType>=5&&n.signType<=7){pin.text='Hidden item '+(n.itemId??'unknown')+' · collection ID '+(n.hiddenItemId??'unknown')+'. This is an item record, not dialogue.';continue;}
    if(!n.script)continue;
    try{const decoded=disassembleScript(reader.bytes,n.script,reader.engine,true);n.scriptSource=decoded.source;n.dialogue=decoded.texts;pin.text=decoded.texts.map(t=>t.text).join('\n\n')||'Native script with no decoded dialogue. Inspect its commands before changing it.';if(decoded.texts.length)pin.title=pin.title+' · '+decoded.texts[0].text.replace(/\\[npl]/g,' ').slice(0,55);}
    catch(error){n.scriptDecodeError=error.message;pin.text='Native script preserved. Decoding is incomplete: '+error.message;}
  }
  for(const pin of pins){pin.rom.displayTitle=pin.title;pin.rom.displayText=pin.text;}
  return pins;
}
function endpoints(a,b,connection){
  const off=connection.offset,vertical=connection.direction===1||connection.direction===2;
  if(connection.direction>4)return{from:{x:Math.floor(a.width/2),y:Math.floor(a.height/2)},to:{x:Math.floor(b.width/2),y:Math.floor(b.height/2)}};
  const aSize=vertical?a.width:a.height,bSize=vertical?b.width:b.height,start=Math.max(0,off),end=Math.min(aSize,off+bSize)-1;
  if(end<start)return null;const mid=Math.floor((start+end)/2),other=mid-off;
  if(connection.direction===1)return{from:{x:mid,y:a.height-1},to:{x:other,y:0}};
  if(connection.direction===2)return{from:{x:mid,y:0},to:{x:other,y:b.height-1}};
  if(connection.direction===3)return{from:{x:0,y:mid},to:{x:b.width-1,y:other}};
  return{from:{x:a.width-1,y:mid},to:{x:0,y:other}};
}
function same(a,b){return a.mapId===b.mapId&&a.x===b.x&&a.y===b.y;}
export function wireRomLinks(project){
  // Built interiors use a ROM template, not that template's original exits.
  // They keep their authored portals and have no native event table to scan.
  const maps=project.maps.filter(m=>m.rom&&!m.rom.isCopy&&!m.rom.generated);
  for(const map of maps){
    const info=map.rom,warps=info.events?.warps||[],connections=info.connections||[];
    if(!warps.length&&!connections.length)continue;
    info.connectedEvents??=[];
    const add=(target,fromPoint,toPoint,eventId,kind,label)=>{
      if(info.removedWarps?.some(w=>eventId==='warp-'+w.index)||info.connectedEvents.includes(eventId)||!inBounds(map,fromPoint.x,fromPoint.y)||!inBounds(target,toPoint.x,toPoint.y))return;
      const from={mapId:map.id,x:fromPoint.x,y:fromPoint.y},to={mapId:target.id,x:toPoint.x,y:toPoint.y};
      const reverse=project.links.find(l=>same(l.from,to)&&same(l.to,from)&&l.rom?.sourceId===info.sourceId);
      if(reverse){reverse.twoWay=true;(reverse.rom.events??=[]).push(`${info.key}:${eventId}`);}
      else{const l=addLink(project,from,to,kind,false,label);l.rom={sourceId:info.sourceId,events:[`${info.key}:${eventId}`],originalFrom:clone(from),originalTo:clone(to)};}
      info.connectedEvents.push(eventId);
    };
    for(const w of warps.filter(w=>w.elevation!==255)){const target=maps.find(m=>m.rom.sourceId===info.sourceId&&m.rom.key===w.target),arrival=target?.rom.events?.warps?.find(a=>a.index===w.warp);if(target&&arrival)add(target,w,arrival,`warp-${w.index}`,'door','Door / warp');}
    for(let i=0;i<connections.length;i++){if(info.disabledConnections?.includes(i))continue;const con=connections[i],target=maps.find(m=>m.rom.sourceId===info.sourceId&&m.rom.key===con.target);if(!target)continue;const points=endpoints(map,target,con);if(points)add(target,points.from,points.to,`edge-${i}`,con.direction>4?'warp':con.kind,con.kind[0].toUpperCase()+con.kind.slice(1)+' exit');}
  }
}

export async function importRomMaps(existing,reader,keys,{sourceId,includeEvents=true,includeStory=true,asNew=true,encodeAtlas,progress=()=>{}}){
  const selected=[...new Set(keys)].map(k=>reader.byKey(k)).filter(Boolean);if(!selected.length)throw new Error('Choose at least one map.');
  if(selected.length>80)throw new Error('Import up to 80 maps into one project.');
  for(const map of selected)if(map.layout.width>LIMIT||map.layout.height>LIMIT)throw new Error(`${map.name} is larger than ${LIMIT} × ${LIMIT} tiles. It can be previewed but not imported into this editor.`);
  const target=asNew?newProject((reader.title||reader.filename)+' maps'):clone(existing);
  if(asNew)target.maps=[];
  const toImport=selected.filter(s=>!target.maps.some(m=>m.rom?.sourceId===sourceId&&m.rom.key===s.key&&!m.rom.isCopy));
  if(target.maps.length+toImport.length>80)throw new Error('This would exceed the 80 map limit. Start a new project for this import.');
  if(target.maps.reduce((n,m)=>n+m.width*m.height,0)+toImport.reduce((n,m)=>n+m.layout.width*m.layout.height,0)>400000)throw new Error('Choose fewer maps. The project limit is 400,000 tiles.');
  target.romSources??=[];if(!target.romSources.some(s=>s.id===sourceId))target.romSources.push({id:sourceId,...reader.summary()});
  let people=[];if(includeEvents)try{people=npcTemplates(reader);}catch{}
  for(let index=0;index<toImport.length;index++){
    const source=toImport[index];progress(`Importing ${source.label} (${index+1}/${toImport.length})…`);
    const atlasId=`rom-${sourceId.slice(0,12)}-${reader.pairKey(source)}`,atlas=reader.atlas(source),attributeEngine=reader.profile(source).attributeEngine,layerIds=Array.from({length:atlas.metatileLayers||2},(_,l)=>atlasId+'-layer-'+l);
    if(!target.assets.some(a=>a.id===atlasId)){
      const data=await encodeAtlas(atlas);
      target.assets.push({id:atlasId,name:`ROM ${reader.pairKey(source)} · ${source.label}`,width:atlas.width,height:atlas.height,tileSize:16,data,category:'ROM tiles',rom:{sourceId,primary:source.layout.primary,secondary:source.layout.secondary,count:atlas.count,engine:reader.engine,rendererVersion:3,metatileLayers:atlas.metatileLayers||2}});
    }
    for(let l=0;l<layerIds.length;l++)if(!target.assets.some(a=>a.id===layerIds[l])){const data=await encodeAtlas({...atlas,pixels:atlas.layers[l]});target.assets.push({id:layerIds[l],name:`ROM ${reader.pairKey(source)} · ${['Lower tiles','Upper tiles','Above player'][l]}`,width:atlas.width,height:atlas.height,tileSize:16,data,category:'ROM layers',rom:{sourceId,primary:source.layout.primary,secondary:source.layout.secondary,count:atlas.count,engine:reader.engine,rendererVersion:3,metatileLayers:atlas.metatileLayers||2,layer:l}});}
    const map=newMap(source.name,source.layout.width,source.layout.height),blocks=reader.blocks(source),events=reader.events(source);
    map.background='#000000';map.world={x:(target.maps.length%4)*280,y:Math.floor(target.maps.length/4)*240};
    for(let i=0;i<blocks.length;i++){const id=blocks[i]&1023,tile={sx:(id%16)*16,sy:Math.floor(id/16)*16,size:16};for(let l=0;l<layerIds.length;l++)map.layers[['ground','details','overhead'][l]][i]=nativeRenderTile({a:layerIds[l],...tile},attributeEngine==='frlg'?(atlas.attrs[id]>>>29)&3:(atlas.attrs[id]>>>12)&15,l,layerIds.length);}
    const warnings=reader.mapWarnings(source);
    map.rom={sourceId,engine:reader.engine,attributeEngine,layerTypes:nativeLayerTypes(atlas.attrs,attributeEngine),nativeLayerSplit:true,key:source.key,bank:source.bank,index:source.index,label:source.label,atlasId,layerAtlasIds:layerIds,rendererVersion:3,metatileLayers:atlas.metatileLayers||2,headerAddress:source.address,layoutAddress:source.layout.address,blocksAddress:source.layout.blocks,scriptsAddress:source.scripts,originalWidth:map.width,originalHeight:map.height,originalBlocks:Array.from(blocks),attributes:Array.from(reader.atlas(source).attrs),dark:reader.u8(source.address+21)===1,weather:reader.u8(source.address+22),events,connections:reader.connections(source),connectedEvents:[],warnings};
    map.rom.tileDefaults=nativeMovementDefaults(blocks,atlas.attrs,attributeEngine);map.rom.nativeLayerSplit=true;
    if(includeEvents){map.markers=pinsForEvents(events,reader);for(const n of map.markers.filter(n=>n.rom?.type==='npc')){const t=people.find(t=>t.graphics===n.rom.sprite);if(!t)continue;const id='native-npc-'+sourceId+'-'+t.graphics;if(!target.assets.some(a=>a.id===id)){if(target.assets.length>=512)continue;target.assets.push({id,name:t.name,width:t.width,height:t.height,tileSize:16,data:indexedSpritePNG(t)});}n.rom.npcAppearance={assetId:id,sourceId,graphics:t.graphics,mapKey:t.mapKey,index:t.index};}}
    map.notes=`Imported from ${reader.filename}. ROM map ${source.key}: ${source.label}.\nDescribe the edits you want below. The source ROM is unchanged.${warnings.length?'\n\nPreview note: '+warnings.join(' '):''}`;
    target.maps.push(map);
  }
  if(includeEvents&&includeStory&&toImport.length){const previous=target.nativeStory?.[sourceId],mapKeys=[...new Set([...(previous?.mapKeys||[]),...toImport.map(m=>m.key)])];progress('Importing native story events…');const graph=await indexNativeStory(reader,{mapKeys,previous,progress:n=>progress('Reading story: '+n+' commands…')});target.nativeStory??={};target.nativeStory[sourceId]=graph;}
  wireRomLinks(target);
  const first=target.maps.find(m=>m.rom?.sourceId===sourceId&&m.rom.key===selected[0].key&&!m.rom.isCopy);
  if(first)target.activeMapId=first.id;
  return{project:target,added:toImport.length};
}

// Refresh display metadata only: authored actions and native script pointers stay intact.
export function hydrateNativeEvents(project,reader,sourceId){
 let changed=false,templates=[];try{templates=npcTemplates(reader);}catch{}
 for(const map of project.maps){if(map.rom?.sourceId!==sourceId||map.rom.generated)continue;
 const source=reader.byKey(map.rom.key);if(!source||source.address!==map.rom.headerAddress)continue;
 const fresh=pinsForEvents(reader.events(source),reader);
 for(const n of map.markers){if(!n.rom)continue;const f=fresh.find(f=>f.rom.type===n.rom.type&&f.rom.index===n.rom.index);if(!f)continue;
 for(const k of ['scriptSource','dialogue','scriptDecodeError'])if(f.rom[k]!==undefined){n.rom[k]=f.rom[k];changed=true;}
 if(/^(Interaction event from the ROM|NPC placement from the ROM|A game event can activate)/.test(n.text||'')){n.text=f.text;changed=true;}
 if(n.rom.type!=='npc'||n.rom.npcAppearance)continue;const t=templates.find(t=>t.graphics===n.rom.sprite);if(!t)continue;
 const id='native-npc-'+sourceId+'-'+t.graphics;if(!project.assets.some(a=>a.id===id)){if(project.assets.length>=512)continue;project.assets.push({id,name:t.name,width:t.width,height:t.height,tileSize:16,data:indexedSpritePNG(t)});}
 n.rom.npcAppearance={assetId:id,sourceId,graphics:t.graphics,mapKey:t.mapKey,index:t.index};changed=true;
 }
 }return changed;
}
