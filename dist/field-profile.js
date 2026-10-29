import{discoverObjectGraphics}from'./rom-npc-profile.js';
import{discoverExpandedFieldGraphics}from'./expanded-field-graphics.js';
// Bounded, read-only FRLG profile discovery. No literal ROM offsets are used.
// Reference: pret/pokefirered field_moves.inc, flash.inc, event_object_movement.c.
import { SCRIPT_DATA } from './script-data.js';
const CMDS=new Map(SCRIPT_DATA.frlg.map(c=>[c.name,c]));
function matchCommands(r,at,commands){
  const start=at,fields=[];
  for(const [name,...args]of commands){const c=CMDS.get(name);if(!c||r.u8(at++)!==c.code)return null;
    for(let i=0;i<c.params.length;i++){const w=c.params[i].width;if(!r.valid(at,w))return null;const v=w===1?r.u8(at):w===2?r.u16(at):r.u32(at);if(args[i]!==null&&v!==args[i])return null;if(args[i]===null&&w===4&&r.ptr(at)<0)return null;fields.push({name,arg:i,at,value:v});at+=w;}}
  return {start,end:at,fields};
}
const gotoIf=(c)=>['goto_if',c,null],msg=(kind)=>[['loadword',0,null],['callstd',kind]];
function canonical(r,p,kind){
 const badge={cut:0x821,rocksmash:0x825,strength:0x823}[kind],move={cut:15,rocksmash:249,strength:70}[kind],effect={cut:2,rocksmash:37,strength:40}[kind];
 const prefix=[['special',0x187],['compare_var_to_value',0x800d,2],gotoIf(1),['lockall'],['checkflag',badge],gotoIf(0),...(kind==='strength'?[['checkflag',0x805],gotoIf(1)]:[]),['checkpartymove',move],['compare_var_to_value',0x800d,6],gotoIf(1),['setfieldeffectargument',0,0x800d],...(kind==='strength'?[]:[['bufferpartymonnick',0,0x800d],['buffermovename',1,move]]),...msg(5),['compare_var_to_value',0x800d,0],gotoIf(1),...(kind==='strength'?[]:msg(4)),['closemessage'],['dofieldeffect',effect],['waitstate'],['goto',null],['end']];
 const m=matchCommands(r,p,prefix);if(!m)return null;
 const body=(m.fields.filter(f=>f.name==='goto').at(-1)?.value??0)-0x08000000;
 const tail=kind==='strength'?[['setflag',0x805],...msg(3),['end']]:[['applymovement',0x800f,null],['waitmovement',0],['removeobject',0x800f],...(kind==='rocksmash'?[['special',0xab],['compare_var_to_value',0x800d,0],gotoIf(1),['waitstate']]:[]),['releaseall'],['end']];
 const t=matchCommands(r,body,tail);if(!t)return null;
 let movement=null;if(kind!=='strength'){movement=(t.fields.find(f=>f.name==='applymovement'&&f.arg===1)?.value??0)-0x08000000;if(r.u8(movement)!==(kind==='cut'?0x69:0x68)||r.u8(movement+1)!==0xfe)return null;}
 const bad=(m.fields.find(f=>f.name==='goto_if'&&f.arg===1&&r.u8(f.at-1)===0)?.value??0)-0x08000000;
 if(!matchCommands(r,bad,[...msg(3),...(kind==='cut'?[['releaseall']]:[]),['end']]))return null;
 return {address:p,bodyAddress:body,movementAddress:movement,badgeFlag:badge,moveId:move,fieldEffectId:effect,validatedBytes:m.end-p,requirement:'badge-and-party-move'};
}
function discoverSprites(r){
 const infos=new Set();for(let p=0;p<r.size-36;p+=4){if(r.u16(p)!==65535||r.u16(p+4)!==0x11ff||r.u16(p+6)!==128||r.u16(p+8)!==16||r.u16(p+10)!==16||!(r.u8(p+12)&64))continue;if(![16,20,24,28,32].every(k=>r.valid(r.ptr(p+k),4)))continue;const a=r.ptr(p+28);if(!r.valid(r.ptr(a),128)||r.u16(a+4)!==128)continue;infos.add(p);}
 const tables=[];for(let t=0;t<r.size-98*4;t+=4){const inf=[95,96,97].map(i=>r.ptr(t+i*4));if(inf.every(p=>infos.has(p))&&inf.map(p=>r.u16(p+2)).join(',')===[0x1105,0x1106,0x1106].join(','))tables.push(t);}
 const tags=[0x1103,0x1104,0x1105,0x1106,0x1107,0x1108,0x1109,0x110a,0x1100,0x1101,0x1102,0x110b,0x110c,0x1110,0x1111,0x1113],pals=[];
 for(let p=0;p<r.size-tags.length*8;p+=4){if(r.u16(p+4)!==tags[0])continue;if(tags.every((tag,i)=>r.u16(p+i*8+4)===tag&&r.u16(p+i*8+6)===0&&r.valid(r.ptr(p+i*8),32)&&Array.from({length:16},(_,j)=>r.u16(r.ptr(p+i*8)+j*2)).every(c=>c<0x8000)))pals.push(p);}
 if(tables.length!==1||pals.length!==1)return null;
 const result={table:tables[0],paletteTable:pals[0],sprites:{}};for(const id of[95,96,97]){const info=r.ptr(tables[0]+id*4),paletteTag=r.u16(info+2),images=r.ptr(info+28);result.sprites[id]={id,info,width:16,height:16,size:128,paletteTag,palette:r.ptr(pals[0]+tags.indexOf(paletteTag)*8),images,pixels:r.ptr(images)};}return result;
}
const profiles=new WeakMap();
const actionProfiles=new WeakMap();
const graphicsProfiles=new WeakMap();
export function discoverFieldGraphics(reader){if(!graphicsProfiles.has(reader))graphicsProfiles.set(reader,discoverExpandedFieldGraphics(reader)||(reader.engine==='frlg'?discoverSprites(reader):null)||discoverObjectGraphics(reader));return graphicsProfiles.get(reader);}
function discoverActions(reader){
 const r=reader;if(r.engine!=='frlg')return null;
 const byKind={cut:[],rocksmash:[],strength:[]},kinds={95:'cut',96:'rocksmash',97:'strength'};
 for(const map of r.maps)for(const e of r.events(map).npcs){const kind=kinds[e.sprite];if(!kind||e.script<0||byKind[kind].some(x=>x.address===e.script))continue;const match=canonical(r,e.script,kind);if(match)byKind[kind].push({...match,example:{mapKey:map.key,localId:e.localId,address:e.address}});}
 if(Object.values(byKind).some(v=>v.length!==1))return null;
 // Native Flash helper has no pointer fields and must be unique.
 const flash=[];for(let p=0;p<r.size-6;p++)if(r.u8(p)===0x9a&&r.u8(p+1)===0&&r.u8(p+2)===0x99&&r.u16(p+3)===0&&r.u8(p+5)===2)flash.push(p);
 if(flash.length!==1)return null;
 return {engine:'frlg',scripts:Object.fromEntries(Object.entries(byKind).map(([k,v])=>[k,v[0]])),flash:{scriptAddress:flash[0],caveHeaderOffset:21,caveValue:1,activeFlag:0x806,badgeFlag:0x820,moveId:148,animateOpcode:0x9a,setLevelOpcode:0x99,async:true},strength:{activeFlag:0x805,graphicsId:97,resetOnMapLoad:true},limits:{mapObjectTemplates:64,simultaneouslyVisibleObjects:16,defaultRemovalFlag:0,permanentFlagsAllocated:false,removal:'visit-local-template-coordinates'},signature:'canonical-native-field-scripts+unique-flash-script'};
}
export function discoverFieldActions(reader){if(!actionProfiles.has(reader))actionProfiles.set(reader,discoverActions(reader));return actionProfiles.get(reader);}
function discover(reader){const actions=discoverFieldActions(reader),graphics=actions&&discoverFieldGraphics(reader);return actions&&graphics?{...actions,...graphics}:null;}
export function spritePixels(reader,sprite){const out=new Uint8ClampedArray(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const v=reader.u8(sprite.pixels+(Math.floor(y/8)*2+Math.floor(x/8))*32+(y%8)*4+Math.floor(x%8/2))>>>((x&1)*4)&15,c=reader.u16(sprite.palette+v*2),a=(y*16+x)*4;out[a]=(c&31)*255/31;out[a+1]=(c>>>5&31)*255/31;out[a+2]=(c>>>10&31)*255/31;out[a+3]=v?255:0;}return out;}

export function discoverFieldProfile(reader){if(!profiles.has(reader))profiles.set(reader,discover(reader));return profiles.get(reader);}
