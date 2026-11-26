// Game-data profile for Emerald-based hacks that keep their tables in their own
// places (found by structure, not by header pointers). Species use a 24-byte
// record; moves a 16-byte one. Only fields whose meaning is confirmed are
// editable: stats, types, catch rate, gender ratio, egg cycles and friendship
// for species; effect, power, type, accuracy, PP and chance for moves.
const BASE=0x08000000;
const nameOk=(b,at,len)=>{if(at<0||at+len>b.length)return false;const e=b.subarray(at,at+len),f=e.indexOf(0xff);return f>0&&e[0]!==0;};
const statOk=(b,at)=>{const r=b.subarray(at,at+24);if(at+24>b.length||r[6]>24||r[7]>24||r[8]===0)return false;let s=0;for(let i=0;i<6;i++){if(!r[i])return false;s+=r[i];}return s>=60&&s<=900;};
function run(b,start,step,ok){let n=0;while(ok(start+n*step))n++;return n;}
export function discoverRseGameData(b,sourceSha256){
 if(b.length<0x200000)return null;
 // Species names: an all-"?" first entry followed by a long run of names.
 let names=-1;
 for(let at=0;at+11*300<Math.min(b.length,0x1200000);at+=4){
  if(b[at]!==0xac||b[at+9]!==0xac||b[at+10]!==0xff||b[at+4]!==0xac)continue;
  const n=run(b,at+11,11,x=>nameOk(b,x,11))+1;
  if(n>=300){names=at;break;}
 }
 if(names<0)return null;
 // Move names follow the species names: "-" then "Pound", 13 bytes apart.
 const pound=[0xca,0xe3,0xe9,0xe2,0xd8,0xff];
 let moveNames=-1;
 for(let at=names+300*11;at<names+1200*11&&at+26<b.length;at++){
  if(b[at]===0xae&&b[at+1]===0xff&&pound.every((v,i)=>b[at+13+i]===v)){moveNames=at;break;}
 }
 if(moveNames<0)return null;
 const nameCount=Math.floor((moveNames-names)/11);
 const moveNameCount=run(b,moveNames+13,13,x=>nameOk(b,x,13))+1;
 // Base stats: a zero record followed by a long run of plausible records.
 let stats=-1,statCount=0;
 for(let at=0;at+24*300<Math.min(b.length,0x1200000);at+=4){
  if(!statOk(b,at+24))continue;
  let z=true;for(let i=0;i<24;i++)if(b[at+i]){z=false;break;}
  if(!z)continue;
  const n=run(b,at+24,24,x=>statOk(b,x))+1;
  if(n>=300){stats=at;statCount=n;break;}
 }
 if(stats<0)return null;
 // Moves: 16-byte records; entry 1 is Pound (power 40, accuracy 100, PP 35).
 let moves=-1;
 for(let at=0;at+16*300<b.length&&moves<0;at++){
  if(b[at]===0x00&&b[at+1]===40&&b[at+2]===0&&b[at+3]===100&&b[at+4]===35&&b[at+16]===0&&b[at+17]===50&&b[at+18]===1&&b[at+19]===100&&b[at+20]===25)moves=at-16;
 }
 if(moves<0)return null;
 // Items: 32-byte records, name first, price at +30. Entry 1 is Master Ball.
 let items=-1,itemCount=0;
 const master=[0xc7,0xd5,0xe7,0xe8,0xd9,0xe6,0,0xbc,0xd5,0xe0,0xe0,0xff],ultra=[0xcf,0xe0,0xe8,0xe6,0xd5,0,0xbc,0xd5,0xe0,0xe0,0xff];
 for(let at=0;at+32*100<b.length&&items<0;at++){
  if(b[at]===0xc7&&master.every((v,i)=>b[at+i]===v)&&ultra.every((v,i)=>b[at+32+i]===v)){items=at-32;itemCount=run(b,items+32,32,x=>nameOk(b,x,14))+1;}
 }
 // Trainers: 40-byte records, party flags first (1 = moves, 2 = held item),
 // name at +4, party count at +32 and party pointer at +36. A table of trainer
 // class names (13 bytes each) sits immediately before the first record.
 const trainerOk=x=>{if(x<0||x+40>b.length||b[x]>3)return false;const f=b.subarray(x+4,x+16).indexOf(0xff);if(f<0)return false;const n=b[x+32]|b[x+33]<<8,q=(b[x+36]|b[x+37]<<8|b[x+38]<<16|b[x+39]<<24>>>0)-BASE;return b[x+34]===0&&b[x+35]===0&&n>=1&&n<=6&&q>=0&&q<b.length;};
 let trainers=-1,trainerCount=0,trainerClasses=-1,trainerClassCount=0;
 for(let at=0;at+40*200<Math.min(b.length,0x1200000)&&trainers<0;at+=4){
  if(!trainerOk(at)||!trainerOk(at+40)||!trainerOk(at+80))continue;
  let s=at;while(trainerOk(s-40))s-=40;
  const n=run(b,s,40,trainerOk);
  if(n>=200){trainers=s;trainerCount=n;}else at=s+n*40;
 }
 if(trainers>=0){let top=0;for(let i=0;i<trainerCount;i++)top=Math.max(top,b[trainers+i*40+1]);
  trainerClassCount=top+1;trainerClasses=trainers-trainerClassCount*13;let good=0;
  for(let i=0;i<trainerClassCount;i++)if(nameOk(b,trainerClasses+i*13,13))good++;
  if(trainerClasses<0||good<trainerClassCount*0.9)trainers=-1;}
 const speciesCount=Math.min(nameCount,statCount);
 const moveOk=x=>x+16<=b.length&&b[x+2]<=24&&b[x+3]<=100&&b[x+4]>=1&&b[x+4]<=64&&b[x+5]<=100;
 const moveCount=Math.min(moveNameCount,run(b,moves+16,16,moveOk)+1);
 const capabilities={species:true,moves:true,items:items>=0,trainers:trainers>=0,encounters:false};
 return{version:2,rse:true,sourceSha256,capabilities,speciesCount,moveCount,itemCount,abilityCount:0,trainerCount:trainers>=0?trainerCount:0,trainerClassCount:trainers>=0?trainerClassCount:0,
  speciesNames:names,baseStats:stats,statsStride:24,moveNames,moves,moveStride:16,learnsets:null,evolutions:null,evolutionSlots:5,speciesAbilities:null,
  items,itemStride:32,itemNames:-1,abilityNames:-1,trainers,trainerClasses,wild:-1,wildCount:0,
  itemFields:['name','price'],rseTrainers:true,speciesFields:['stats','types','catchRate','genderRatio','eggCycles','friendship'],typeMax:24};
}
// Names may hold glyphs the shared decoder does not know; show them as "?" so
// the table stays readable (an unchanged name is never written back).
function tolerantName(fixedName,b,at,n){
 try{return fixedName(b,at,n);}catch{
  let s='';for(let i=at;i<at+n&&b[i]!==0xff;i++){try{s+=fixedName(Uint8Array.of(b[i],0xff),0,2)||' ';}catch{s+='?';}}
  return s.trim();}
}
export function readRseSpecies(b,p,id,fixedName){
 const a=p.baseStats+id*24;
 return{id,name:tolerantName(fixedName,b,p.speciesNames+id*11,11),stats:Array.from(b.slice(a,a+6)),types:[b[a+6],b[a+7]],catchRate:b[a+8],baseExp:0,evYield:[0,0,0,0,0,0],items:[0,0],genderRatio:b[a+9],eggCycles:b[a+10],friendship:b[a+11],growthRate:0,eggGroups:[0,0],abilities:[0,0],learnset:[],evolutions:[]};
}
export function readRseItem(b,p,id,fixedName){
 const a=p.items+id*32,v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 return{id,name:tolerantName(fixedName,b,a,14),price:v.getUint16(a+30,true),holdEffect:b[a+26],holdEffectParam:b[a+27],descriptionAddress:-1,pocket:0,type:0};
}

// Party members: +0 personality (u32, 0 = random), +4 IV quality, +6 level,
// +8 species, then a held item (u16) and/or four moves, and two trailing
// bytes whose meaning is not decoded (kept as they are).
const partyStride=flags=>[12,20,16,24][flags&3];
export function readRseTrainer(b,p,id,fixedName){
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),a=p.trainers+id*40,flags=b[a]&3,stride=partyStride(flags),count=b[a+32],start=v.getUint32(a+36,true)-BASE,party=[];
 for(let j=0;j<count;j++){
  const at=start+j*stride,moveAt=at+(flags&2?12:10);
  party.push({ivQuality:v.getUint16(at+4,true),level:b[at+6],species:v.getUint16(at+8,true),heldItem:flags&2?v.getUint16(at+10,true):0,moves:flags&1?Array.from({length:4},(_,i)=>v.getUint16(moveAt+i*2,true)):[]});
 }
 return{id,name:tolerantName(fixedName,b,a+4,12),trainerClass:b[a+1],sprite:b[a+3],genderMusic:b[a+2],customMoves:!!(flags&1),heldItems:!!(flags&2),doubleBattle:!!b[a+24],ai:v.getUint32(a+28,true),items:Array.from({length:4},(_,i)=>v.getUint16(a+16+i*2,true)),party};
}
// Re-encode a party, keeping each member's personality and trailing bytes.
export function encodeRseParty(b,p,id,tr){
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),a=p.trainers+id*40,oldFlags=b[a]&3,oldStride=partyStride(oldFlags),oldCount=b[a+32],oldStart=v.getUint32(a+36,true)-BASE;
 if(!Array.isArray(tr.party)||tr.party.length<1||tr.party.length>6)throw Error('A trainer needs one to six Pok\u00E9mon.');
 const flags=(tr.customMoves?1:0)|(tr.heldItems?2:0),stride=partyStride(flags),out=new Uint8Array(stride*tr.party.length),dv=new DataView(out.buffer);
 tr.party.forEach((m,i)=>{
  const at=i*stride;
  if(i<oldCount){const o=oldStart+i*oldStride;out.set(b.subarray(o,o+4),at);out.set(b.subarray(o+oldStride-2,o+oldStride),at+stride-2);}
  const n=(x,lo,hi,l)=>{if(!Number.isInteger(x)||x<lo||x>hi)throw Error(l+' must be a whole number from '+lo+' to '+hi+'.');return x;};
  dv.setUint16(at+4,n(m.ivQuality??0,0,65535,'IV quality'),true);out[at+6]=n(m.level,1,100,'Level');dv.setUint16(at+8,n(m.species,1,p.speciesCount-1,'Species'),true);
  if(flags&2)dv.setUint16(at+10,n(m.heldItem??0,0,p.itemCount-1,'Held item'),true);
  if(flags&1){const mv=m.moves||[];for(let k=0;k<4;k++)dv.setUint16(at+(flags&2?12:10)+k*2,n(mv[k]??0,0,p.moveCount-1,'Move'),true);}
 });
 return{flags,count:tr.party.length,bytes:out};
}
export function readRseTrainerClass(b,p,i,fixedName){return tolerantName(fixedName,b,p.trainerClasses+i*13,13);}
