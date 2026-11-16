// Source-bound Gen III trainer-party serializer. Every ROM-visible byte has a
// known layout; unknown party flags and damaged pointers are refused instead
// of being interpreted as a vanilla party.
const BASE=0x08000000;
const u16=(a,at)=>a[at]|a[at+1]<<8;
const u32=(a,at)=>(a[at]|a[at+1]<<8|a[at+2]<<16|a[at+3]<<24)>>>0;
const integer=(value,min,max,name)=>{if(!Number.isInteger(value)||value<min||value>max)throw Error(name+' must be a whole number from '+min+' to '+max+'.');return value;};
function layout(flags,profile){
 if(!Number.isInteger(flags)||(flags&~3)!==0)throw Error('Unrecognised trainer party flags; this engine needs a verified party adapter.');
 const customMoves=!!(flags&1),heldItems=!!(flags&2),expanded=!!(profile.expandedTrainerParty&&customMoves&&heldItems);
 return{flags,customMoves,heldItems,expanded,stride:expanded?32:customMoves?16:8,movesAt:expanded?22:heldItems?8:6,itemAt:expanded?20:6};
}
export function trainerPartySource(source,profile,id){
 if(!(source instanceof Uint8Array)||!profile||profile.capabilities?.trainers===false)throw Error('Use a source ROM with a verified trainer table.');
 integer(id,0,profile.trainerCount-1,'Trainer ID');
 const at=profile.trainers+id*40;
 if(!Number.isInteger(at)||at<0||at+40>source.length)throw Error('Trainer record is outside this ROM.');
 const flags=source[at],kind=layout(flags,profile),count=source[at+32],pointer=u32(source,at+36);
 integer(count,0,6,'Trainer party size');
 if(!count){if(pointer!==0)throw Error('Unused trainer has a nonempty party pointer; its layout needs review.');return{at,kind,count,start:null,bytes:new Uint8Array()};}
 const start=pointer-BASE;
 if(pointer<BASE||start%4!==0||start<0||start+kind.stride*count>source.length)throw Error('Trainer party pointer points outside a valid aligned source table.');
 const bytes=source.slice(start,start+kind.stride*count);
 for(let i=0;i<count;i++){
  const off=i*kind.stride,lv=bytes[off+2],species=u16(bytes,off+4);
  if(lv<1||lv>100||species<1||species>=profile.speciesCount)throw Error('Trainer party contains an invalid species or level. Editing is disabled until this layout is verified.');
 }
 return{at,kind,count,start,bytes};
}
export function encodeTrainerParty(source,profile,id,trainer){
 const original=trainerPartySource(source,profile,id);
 if(!trainer||typeof trainer!=='object')throw Error('Missing trainer data.');
 const flags=(trainer.customMoves?1:0)|(trainer.heldItems?2:0),kind=layout(flags,profile),party=trainer.party;
 if(!Array.isArray(party)||party.length<1||party.length>6)throw Error('A native trainer party needs one to six Pokémon.');
 if(trainer.doubleBattle&&party.length<2)throw Error('Double battle needs at least two Pokémon.');
 const matching=flags===original.kind.flags&&party.length===original.count;
 const bytes=matching?original.bytes.slice():new Uint8Array(party.length*kind.stride);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 for(let i=0;i<party.length;i++){
  const mon=party[i],at=i*kind.stride;
  if(!mon||typeof mon!=='object')throw Error('Trainer party member '+(i+1)+' is missing.');
  view.setUint16(at,integer(mon.ivQuality??0,0,255,'Trainer IV quality'),true);
  bytes[at+2]=integer(mon.level,1,100,'Trainer level');
  view.setUint16(at+4,integer(mon.species,1,profile.speciesCount-1,'Trainer species'),true);
  if(kind.expanded){
   bytes[at+6]=integer(mon.ability??3,0,4,'Trainer ability selection');
   bytes[at+7]=integer(mon.nature??0,0,24,'Trainer nature');
   for(const [name,offset,max,defaultValue]of [['ivSpread',8,31,Math.round((mon.ivQuality??0)*31/255)],['evSpread',14,255,0]]){
    const values=mon[name]??Array(6).fill(defaultValue);
    if(!Array.isArray(values)||values.length!==6)throw Error('Trainer '+name+' requires six values.');
    values.forEach((value,j)=>bytes[at+offset+j]=integer(value,0,max,'Trainer '+name));
   }
   view.setUint16(at+30,integer(mon.teraType??0,0,255,'Trainer Tera type'),true);
  }
  if(kind.heldItems)view.setUint16(at+kind.itemAt,integer(mon.heldItem??0,0,profile.itemCount-1,'Trainer held item'),true);
  if(kind.customMoves){
   if(!Array.isArray(mon.moves)||mon.moves.length!==4)throw Error('Custom trainer moves need four slots, using zero for empty.');
   mon.moves.forEach((move,j)=>view.setUint16(at+kind.movesAt+j*2,integer(move,0,profile.moveCount-1,'Trainer move'),true));
  }
 }
 return{bytes,flags,count:party.length,stride:kind.stride,before:original};
}
