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
 const speciesCount=Math.min(nameCount,statCount);
 const moveOk=x=>x+16<=b.length&&b[x+2]<=24&&b[x+3]<=100&&b[x+4]>=1&&b[x+4]<=64&&b[x+5]<=100;
 const moveCount=Math.min(moveNameCount,run(b,moves+16,16,moveOk)+1);
 const capabilities={species:true,moves:true,items:items>=0,trainers:false,encounters:false};
 return{version:2,rse:true,sourceSha256,capabilities,speciesCount,moveCount,itemCount,abilityCount:0,trainerCount:0,trainerClassCount:0,
  speciesNames:names,baseStats:stats,statsStride:24,moveNames,moves,moveStride:16,learnsets:null,evolutions:null,evolutionSlots:5,speciesAbilities:null,
  items,itemStride:32,itemNames:-1,abilityNames:-1,trainers:-1,wild:-1,wildCount:0,
  itemFields:['name','price'],speciesFields:['stats','types','catchRate','genderRatio','eggCycles','friendship'],typeMax:24};
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
