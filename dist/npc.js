
// Native NPC templates and fresh object records for compatible FireRed-family engines.
// Record layout, graphics info and stationary movement types: pret/pokefirered.
import{discoverFieldGraphics}from'./field-profile.js';
import{expandedFieldSprite}from'./expanded-field-graphics.js';

import{decodeSprite4bpp,decodeSpritePalette,decompressSpriteLZ}from'./native-sprites.js';
const NAMES={"16": "Little Boy", "17": "Little Girl", "18": "Youngster", "19": "Boy", "20": "Bug Catcher", "21": "Sitting Boy", "22": "Lass", "23": "Woman 1", "24": "Crush Girl", "25": "Man", "26": "Rocker", "27": "Fat Man", "28": "Woman 2", "29": "Beauty", "30": "Balding Man", "31": "Woman 3", "32": "Old Man 1", "33": "Old Man 2", "34": "Old Man Lying Down", "35": "Old Woman", "36": "Tuber male Water", "37": "Tuber F", "38": "Tuber male Land", "39": "Camper", "40": "Picnicker", "41": "Cooltrainer M", "42": "Cooltrainer F", "43": "Swimmer male Water", "44": "Swimmer female Water", "45": "Swimmer male Land", "46": "Swimmer female Land", "47": "Worker M", "48": "Worker F", "49": "Rocket M", "50": "Rocket F", "51": "Gba Kid", "52": "Poke Maniac", "53": "Biker", "54": "Black Belt", "55": "Scientist", "56": "Hiker", "57": "Fisher", "58": "Channeler", "59": "Chef", "60": "Policeman", "61": "Gentleman", "62": "Sailor", "63": "Captain", "64": "Nurse", "65": "Cable Club Receptionist", "66": "Union Room Receptionist", "67": "Unused Male Receptionist", "68": "Clerk", "69": "Mg Deliveryman", "70": "Trainer Tower Dude", "71": "Prof Oak", "72": "Blue", "73": "Bill", "74": "Lance", "75": "Agatha", "76": "Daisy", "77": "Lorelei", "78": "Mr Fuji", "79": "Bruno", "80": "Brock", "81": "Misty", "82": "Lt Surge", "83": "Erika", "84": "Koga", "85": "Sabrina", "86": "Blaine", "87": "Giovanni", "88": "Mom", "89": "Celio", "90": "Teachy Tv Host", "91": "Gym Guy"};
const PLAYER_NAMES={0:'Player base · masculine',1:'Player outfit · bike',2:'Player outfit · surf',3:'Player outfit · field action',4:'Player outfit · fishing',5:'Player outfit · device',6:'Player base · feminine',7:'Player outfit · bike',8:'Player outfit · surf',9:'Player outfit · field action',10:'Player outfit · fishing',11:'Player outfit · device',12:'Player companion / rival',13:'Player companion / rival',14:'Player companion / rival',15:'Player companion / rival'};
const cache=new WeakMap();
export function npcTemplates(reader){
 if(cache.has(reader))return cache.get(reader);const p=discoverFieldGraphics(reader),out=[];if(!p)return out;
 const examples=new Map();let donor=null;
 for(const map of reader.maps)for(const [index,e]of reader.events(map).npcs.entries()){const ref={mapKey:map.key,index};donor??=ref;if(!examples.has(e.sprite))examples.set(e.sprite,ref);}
 if(!donor)return out;
 // Object graphics store a run of image descriptors.  Earlier code read only
 // the first descriptor, which made every bundled person a static cut-out.
 // Bound each run by the next graphics descriptor so walking/turning frames
 // stay with their original actor and never bleed into a neighbour.
 const imageStarts=[];for(let graphics=0;graphics<Math.min(p.count||92,240);graphics++){const expanded=expandedFieldSprite(reader,p,graphics),info=expanded?.info??reader.ptr(p.table+graphics*4),images=expanded?.images??reader.ptr(info+28);if(reader.valid(images,8))imageStarts.push(images);}imageStarts.sort((a,b)=>a-b);
 // An appearance need not already occur on an imported map. New records are
 // initialized independently; the example reference retains older project format.
 for(let graphics=0;graphics<Math.min(p.count||92,240);graphics++)try{
  const expanded=expandedFieldSprite(reader,p,graphics),info=expanded?.info??reader.ptr(p.table+graphics*4),width=expanded?.width??reader.u16(info+8),height=expanded?.height??reader.u16(info+10),images=expanded?.images??reader.ptr(info+28),pixels=expanded?.pixels??reader.ptr(images),size=expanded?.size??reader.u16(images+4),tag=expanded?.paletteTag??reader.u16(info+2);
  if(width<8||height<8||width>64||height>64||width%8||height%8||size!==width*height/2||!reader.valid(pixels,size))continue;
  let palette=expanded?.palette??-1;if(palette<0)for(let i=0;i<(p.paletteCount||16);i++)if(reader.u16(p.paletteTable+i*8+4)===tag)palette=reader.ptr(p.paletteTable+i*8);if(!reader.valid(palette,32))continue;
  const next=imageStarts.find(at=>at>images)??reader.size,frames=[];
  for(let at=images;at+8<=next&&frames.length<32;at+=8){const framePixels=reader.ptr(at),frameSize=reader.u16(at+4);if(frameSize!==size||reader.u16(at+6)!==0||!reader.valid(framePixels,size))break;const raw=reader.u8(info+12)&128?decompressSpriteLZ(reader.bytes,framePixels).slice(0,size):reader.bytes.slice(framePixels,framePixels+size);if(raw.length!==size)break;frames.push(Array.from(decodeSprite4bpp(raw,width,height)));}
  if(!frames.length)continue;
  out.push({graphics,name:PLAYER_NAMES[graphics]||((reader.engine==='frlg'&&p.count===undefined?NAMES[graphics]:null)||'Character '+graphics),player:graphics in PLAYER_NAMES,...(examples.get(graphics)||donor),width,height,indices:frames[0],frames,colours:decodeSpritePalette(reader.bytes.slice(palette,palette+32))});
 }catch{}
 out.sort((a,b)=>a.name.localeCompare(b.name));cache.set(reader,out);return out;
}
export function npcImage(t){const c=document.createElement('canvas');c.width=t.width;c.height=t.height;const ctx=c.getContext('2d'),im=ctx.createImageData(c.width,c.height);for(let i=0;i<t.indices.length;i++){const n=t.indices[i],v=parseInt(t.colours[n].slice(1),16);im.data[i*4]=v>>>16;im.data[i*4+1]=v>>>8&255;im.data[i*4+2]=v&255;im.data[i*4+3]=n?255:0;}ctx.putImageData(im,0,0);return c.toDataURL('image/png');}
export function applyNPCAppearances(reader,map,events,{sourceHash,sourceId}={}){
 const edits=map.markers.filter(n=>n.rom?.type==='npc'&&n.rom.npcAppearance);if(!edits.length)return false;
 if(!discoverFieldGraphics(reader))throw Error('The opened ROM’s NPC graphics table could not be verified.');
 const templates=npcTemplates(reader);for(const n of edits){const a=n.rom.npcAppearance,record=events.npcs[n.rom.index];if(!record||a.sourceId!==sourceId||(record[1]!==a.graphics&&!templates.some(t=>t.graphics===a.graphics)))throw Error(n.title+': reopen the matching source ROM and choose its NPC appearance again.');record[1]=a.graphics;if(a.facing&&a.facing!=='keep'){const facing={up:7,down:8,left:9,right:10}[a.facing];if(!facing)throw Error('Choose a valid NPC facing direction.');record[9]=facing;}}
 return true;
}
export function installNPCs(reader,map,events,{sourceHash,sourceId,customGraphics=new Map()}={}){const result=new Map();if(!map.markers.some(n=>n.npc))return result;if(!discoverFieldGraphics(reader))throw Error('The opened ROM’s NPC graphics table could not be verified.');const available=npcTemplates(reader),used=new Set(events.npcs.map(a=>a[0]));for(const n of map.markers.filter(n=>n.npc&&n.runtime?.enabled!==false)){const custom=n.npc.customOnly?customGraphics.get(n.npc.spriteGroupId):null;if(n.npc.customOnly&&!custom)throw Error(n.title+': its custom overworld sprite group is not installed.');const t=n.npc,match=available.find(e=>e.graphics===t.graphics&&e.mapKey===t.mapKey&&e.index===t.index);if(!custom&&(!match||t.sourceId!==sourceId))throw Error('This NPC template belongs to a different source ROM. Choose its appearance again.');if(events.npcs.some(a=>new DataView(a.buffer,a.byteOffset,a.byteLength).getInt16(4,true)===n.x&&new DataView(a.buffer,a.byteOffset,a.byteLength).getInt16(6,true)===n.y))throw Error('Two native NPCs occupy the same tile. Move one before exporting.');const id=Array.from({length:254},(_,i)=>i+1).find(id=>!used.has(id));if(!id)throw Error('No native character IDs remain.');used.add(id);const record=new Uint8Array(24),v=new DataView(record.buffer);record.fill(0);record[0]=id;record[1]=custom?.graphics??t.graphics;v.setInt16(4,n.x,true);v.setInt16(6,n.y,true);record[8]=3;record[9]={up:7,down:8,left:9,right:10}[t.facing]||8;events.npcs.push(record);result.set(n.id,{record,localId:id});}if(events.npcs.length>64)throw Error('This map exceeds 64 native NPC and field-object templates.');return result;}
