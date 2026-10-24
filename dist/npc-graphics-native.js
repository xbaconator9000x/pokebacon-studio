// Append independent object graphics IDs. Keep native IDs, dynamic variables,
// the source's 152–154 special dispatch and native palette allocations intact.
import {STOCK_FIRE_RED_SHA} from './verified-frlg.js';
import {discoverFieldGraphics} from './field-profile.js';
import {encodeSprite4bpp,encodeSpritePalette} from './native-sprites.js';
const BASE=0x08000000,FIRST=155,LIMIT=240,NATIVE_COUNT=152;
const PROFILES={
 [STOCK_FIRE_RED_SHA]:{tableRef:0x5f2f4,clamp:0x5f2e0}
};
export function customNPCGraphicsPlan(project,extraGroups=[]){
 const ids=new Set(extraGroups);for(const map of project.maps)for(const n of map.markers)if(n.npc?.customOnly&&n.runtime?.enabled!==false)ids.add(n.npc.spriteGroupId);
 if(ids.size>LIMIT-FIRST)throw Error('This engine supports up to 85 independent custom overworld styles per export.');
 const groups=[],bindings=new Map();for(const id of ids){const group=project.spriteStudio?.groups.find(g=>g.id===id),view=group?.views.overworld;if(!view)throw Error('A placed custom NPC is missing its overworld sprite group.');if(![1,9].includes(view.frames.length))throw Error(group.name+': use one static frame or nine native overworld frames.');if(![[16,16],[16,32],[32,32]].some(([w,h])=>view.width===w&&view.height===h))throw Error(group.name+': native character slots support 16 × 16, 16 × 32 or 32 × 32 artwork.');const graphics=FIRST+groups.length;bindings.set(id,{graphics,groupId:id});groups.push(group);}
 return {groups,bindings};
}
export function installCustomNPCGraphics(reader,hash,output,plan){
 if(!plan.groups.length)return {reports:[],warnings:[]};const p=PROFILES[hash],field=discoverFieldGraphics(reader);if(!p||!field)throw Error('The opened ROM needs a compatible graphics-accessor adapter for independent NPC artwork.');
 const signature=[151,41,0,217,16,33,3,72,137,0,9,24,8,104,2,188,8,71];if(reader.ptr(p.tableRef)!==field.table||!signature.every((v,i)=>reader.u8(p.clamp+i)===v))throw Error('The native object graphics accessor failed verification.');
 const bytes=output.bytes,view=()=>new DataView(output.bytes.buffer),ptr=at=>view().getUint32(at,true)-BASE;
 const palettes=[];for(let i=0;i<16;i++){const row=field.paletteTable+i*8,tag=reader.u16(row+4);if(tag<0x1103||tag>0x1106)continue;const at=ptr(row);if(at<0||at+32>output.bytes.length)throw Error('A field palette is missing.');palettes.push({tag,slot:tag-0x1101,colours:Array.from({length:16},(_,n)=>view().getUint16(at+n*2,true)&0x7fff)});}
 if(palettes.length!==4)throw Error('The ordinary NPC palette set could not be verified.');
 const table=new Uint8Array(LIMIT*4),tv=new DataView(table.buffer);table.set(bytes.slice(field.table,field.table+NATIVE_COUNT*4));for(let id=NATIVE_COUNT;id<LIMIT;id++)tv.setUint32(id*4,reader.u32(field.table+16*4),true);
 const reports=[],warnings=[],descriptors=new Map();
 for(const group of plan.groups){const ow=group.views.overworld,binding=plan.bindings.get(group.id),donor=ow.width===32?53:ow.height===16?16:55,info=reader.ptr(field.table+donor*4),header=output.bytes.slice(info,info+36);if(reader.u16(info+8)!==ow.width||reader.u16(info+10)!==ow.height)throw Error('A native character dimension template changed.');
  const paletteBytes=encodeSpritePalette(group.normal),gv=new DataView(paletteBytes.buffer),colours=Array.from({length:16},(_,i)=>gv.getUint16(i*2,true)),counts=Array(16).fill(0);for(const f of ow.frames)for(const n of f){if(!Number.isInteger(n)||n<0||n>15)throw Error(group.name+': invalid palette index.');counts[n]++;}
  let best;for(const pal of palettes){let distance=0;const remap=[0];for(let i=1;i<16;i++){let nearest=1,d=Infinity;for(let j=1;j<16;j++){const a=colours[i],b=pal.colours[j],v=((a&31)-(b&31))**2+((a>>>5&31)-(b>>>5&31))**2+((a>>>10&31)-(b>>>10&31))**2;if(v<d){d=v;nearest=j;}}remap[i]=nearest;distance+=d*counts[i];}if(!best||distance<best.distance)best={...pal,remap,distance};}
  if(group.nativePalettePolicy==='exact'&&best.distance)throw Error(group.name+': colours do not exactly fit a native field palette. Choose nearest-colour fitting or edit its palette.');
  const frameSize=ow.width*ow.height/2,frames=new Uint8Array(frameSize*9);let changed=0;
  for(let i=0;i<9;i++){const frame=ow.frames[ow.frames.length===1?0:i];if(frame.length!==ow.width*ow.height)throw Error(group.name+': frame dimensions are invalid.');const mapped=frame.map(n=>{if(n&&colours[n]!==best.colours[best.remap[n]])changed++;return best.remap[n];});frames.set(encodeSprite4bpp(mapped,ow.width,ow.height),i*frameSize);}
  const art=output.allocate(frames,'Independent NPC: '+group.name),images=new Uint8Array(9*8),iv=new DataView(images.buffer);for(let i=0;i<9;i++){iv.setUint32(i*8,BASE+art+i*frameSize,true);iv.setUint16(i*8+4,frameSize,true);}const imageTable=output.allocate(images,'NPC frame descriptors: '+group.name),hv=new DataView(header.buffer);hv.setUint16(2,best.tag,true);header[12]=(header[12]&0xf0)|best.slot;hv.setUint32(28,BASE+imageTable,true);const installed=output.allocate(header,'NPC graphics info: '+group.name);tv.setUint32(binding.graphics*4,BASE+installed,true);descriptors.set(group.id,{info:installed,images:imageTable,tag:best.tag,slot:best.slot,width:ow.width,height:ow.height});reports.push('Independent NPC graphics '+binding.graphics+': '+group.name+' · nine frames');if(changed)warnings.push(group.name+': '+changed+' overworld pixels fitted to an existing field palette. Existing NPC art and palettes are retained.');
 }
 const at=output.allocate(table,'Expanded independent NPC graphics table');output.int(p.tableRef,BASE+at);output.int(p.clamp,0x29ef,2);return {reports,warnings,descriptors,table:at};
}
