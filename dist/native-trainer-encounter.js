// Original Gen III ObjectEventTemplate (pret/pokefirered global.fieldmap.h).
// Normal object: four-bit movement ranges share byte 10; byte 11 is reserved.
// Trainer type and sight/berry value are u16 at +12 and +14.
const SIZE=24, u16=(b,i)=>b[i]|b[i+1]<<8;
const field=(v,min,max,name)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(name+' must be a whole number from '+min+' to '+max+'.');return v;};
export function readTrainerEncounter(row){
 if(!(row instanceof Uint8Array)||row.length!==SIZE)throw Error('An original NPC needs a 24-byte record.');
 if(row[2]!==0)throw Error('This NPC uses a nonstandard event union; trainer editing is disabled.');
 return{localId:row[0],trainerType:u16(row,12),sightRange:u16(row,14),rangeX:row[10]&15,rangeY:row[10]>>>4,movementType:row[9]};
}
export function validateTrainerEncounter(v){
 if(!v||typeof v!=='object')throw Error('Choose trainer encounter settings.');
 return{trainerType:field(v.trainerType,1,2,'Trainer behaviour'),sightRange:field(v.sightRange,1,15,'Trainer sight distance'),rangeX:field(v.rangeX,0,15,'Patrol range X'),rangeY:field(v.rangeY,0,15,'Patrol range Y')};
}
export function stageTrainerEncounter(project,reader,sourceId,root,values){
 if(!sourceId||root?.kind!=='npcs'||!Number.isInteger(root.index))throw Error('Choose an original NPC trainer.');
 const map=project.maps.find(m=>m.rom?.sourceId===sourceId&&m.rom.key===root.mapKey&&!m.rom.isCopy);
 const native=reader.byKey(root.mapKey);
 if(!map||!native)throw Error('Import the original source map first.');
 const marker=map.markers.find(n=>n.rom?.type==='npc'&&n.rom.index===root.index);
 const original=reader.events(native).npcs.find(n=>n.index===root.index);
 if(!marker||!original||marker.rom.localId!==original.localId||!reader.valid(original.address,SIZE))throw Error('Original NPC identity is missing or ambiguous.');
 const before=Array.from(reader.bytes.slice(original.address,original.address+SIZE)),info=readTrainerEncounter(Uint8Array.from(before));
 if(![1,2].includes(info.trainerType))throw Error('This object is not a standard trainer; berry-tree and custom data must remain untouched.');
 const after=validateTrainerEncounter(values);
 return{map,marker,edit:{version:1,sourceId,mapKey:root.mapKey,index:root.index,localId:info.localId,before,after}};
}
export function applyTrainerEncounters(reader,native,map,events,sourceId){
 const edits=map.markers.filter(n=>n.rom?.type==='npc'&&n.rom.trainerEncounter);
 if(!edits.length)return false;
 if(map.rom?.generated||map.rom?.isCopy||map.rom?.sourceId!==sourceId||map.rom.key!==native.key)throw Error('Trainer edits need their unchanged original source map.');
 const planned=[],used=new Set();
 for(const n of edits){
  const e=n.rom.trainerEncounter,idx=e.index,record=events.npcs[idx];
  if(e.version!==1||e.sourceId!==sourceId||e.mapKey!==native.key||n.rom.index!==idx||used.has(idx)||!record)throw Error('Trainer source binding is stale or duplicated.');
  if(record.length!==SIZE||record[0]!==e.localId||!Array.isArray(e.before)||e.before.length!==SIZE||record.some((b,i)=>b!==e.before[i]))throw Error('Trainer source bytes changed; review the matched ROM.');
  if(![1,2].includes(readTrainerEncounter(record).trainerType))throw Error('The source object is not a standard trainer.');
  const v=validateTrainerEncounter(e.after),copy=record.slice(),view=new DataView(copy.buffer,copy.byteOffset,SIZE);
  copy[10]=v.rangeX|(v.rangeY<<4);view.setUint16(12,v.trainerType,true);view.setUint16(14,v.sightRange,true);
  used.add(idx);planned.push([idx,copy]);
 }
 for(const[idx,copy]of planned)events.npcs[idx]=copy;
 return true;
}
