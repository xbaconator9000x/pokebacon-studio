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
 const learn=discoverLearnsetTable(b,speciesCount0(names,nameCount,statCount),Math.min(moveNameCount,run(b,moves+16,16,x=>x+16<=b.length&&b[x+2]<=24&&b[x+3]<=100&&b[x+4]>=1&&b[x+4]<=64&&b[x+5]<=100)+1));
 const evo=discoverEvolutionTable(b,speciesCount0(names,nameCount,statCount));
 const abil=discoverAbilityTable(b,stats,speciesCount0(names,nameCount,statCount));
 const tr=discoverTrainerTable(b);
 const trainers=tr?tr.trainers:-1,trainerCount=tr?tr.count:0,trainerClasses=tr?tr.classes:-1,trainerClassCount=tr?tr.classCount:0;
 const speciesCount=Math.min(nameCount,statCount);
 const moveOk=x=>x+16<=b.length&&b[x+2]<=24&&b[x+3]<=100&&b[x+4]>=1&&b[x+4]<=64&&b[x+5]<=100;
 const moveCount=Math.min(moveNameCount,run(b,moves+16,16,moveOk)+1);
 const capabilities={species:true,moves:true,items:items>=0,trainers:trainers>=0,encounters:false};
 return{version:2,rse:true,sourceSha256,capabilities,speciesCount,moveCount,itemCount,abilityCount:abil?abil.count:0,trainerCount:trainers>=0?trainerCount:0,trainerClassCount:trainers>=0?trainerClassCount:0,
  speciesNames:names,baseStats:stats,statsStride:24,speciesLayout:{stride:24,nameBase:names,nameStride:11,nameLen:11,abilities:abil?20:void 0,types:8,catchRate:8,genderRatio:9,eggCycles:10,friendship:11},moveNames,moves,moveStride:16,learnsets:learn?learn.table:null,learnsetStride:learn?4:void 0,evolutions:evo?evo.table:null,evolutionSlots:evo?evo.slots:5,evolutionStride:evo?evo.slots*8:void 0,speciesAbilities:null,
  items,itemStride:32,itemLayout:{stride:32,nameBase:items,nameStride:32,nameLen:14,price:{at:30,sh:0,bits:16},holdAt:26},itemNames:-1,abilityNames:abil?abil.base:-1,trainers,trainerClasses,wild:-1,wildCount:0,
  itemFields:['name','price'],rseTrainers:true,speciesFields:['stats','types','catchRate','genderRatio','eggCycles','friendship',...(abil?['abilities']:[]),...(learn?['learnset']:[]),...(evo?['evolutions']:[])],typeMax:24};
}
// Names may hold glyphs the shared decoder does not know; show them as "?" so
// the table stays readable (an unchanged name is never written back).
function tolerantName(fixedName,b,at,n){
 try{return fixedName(b,at,n);}catch{
  let s='';for(let i=at;i<at+n&&b[i]!==0xff;i++){try{s+=fixedName(Uint8Array.of(b[i],0xff),0,2)||' ';}catch{s+='?';}}
  return s.trim();}
}
export function readRseSpecies(b,p,id,fixedName){
 const L=p.speciesLayout,a=p.baseStats+id*L.stride;
 return{id,name:tolerantName(fixedName,b,L.nameBase+id*L.nameStride,L.nameLen),stats:Array.from(b.slice(a,a+6)),types:[b[a+6],b[a+7]],catchRate:b[a+8],baseExp:0,evYield:[0,0,0,0,0,0],items:[0,0],genderRatio:L.genderRatio?b[a+L.genderRatio]:0,eggCycles:L.eggCycles?b[a+L.eggCycles]:0,friendship:L.friendship?b[a+L.friendship]:0,growthRate:0,eggGroups:[0,0],abilities:L.abilities===undefined?[0,0]:[b[a+L.abilities],b[a+L.abilities+1]],learnset:[],evolutions:[]};
}
export function getField(b,a,f){let v=0;for(let i=3;i>=0;i--)v=v*256+(b[a+f.at+i]||0);return Math.floor(v/2**f.sh)%2**f.bits;}
export function setField(b,a,f,x){const m=2**f.bits-1;if(!Number.isInteger(x)||x<0||x>m)throw Error('Value must be a whole number from 0 to '+m+'.');let v=0;for(let i=3;i>=0;i--)v=v*256+(b[a+f.at+i]||0);const old=Math.floor(v/2**f.sh)%2**f.bits;v+=(x-old)*2**f.sh;for(let i=0;i<4;i++){b[a+f.at+i]=v%256;v=Math.floor(v/256);}}
function layoutName(fixedName,b,L,id){
 if(L.namePtr!==undefined){const q=(b[id*L.stride+L.base+L.namePtr]|b[id*L.stride+L.base+L.namePtr+1]<<8|b[id*L.stride+L.base+L.namePtr+2]<<16|b[id*L.stride+L.base+L.namePtr+3]<<24>>>0)-BASE;return q>=0&&q<b.length?tolerantName(fixedName,b,q,24):'';}
 return tolerantName(fixedName,b,L.nameBase+id*L.nameStride,L.nameLen);
}
export function readRseItem(b,p,id,fixedName){
 const L=p.itemLayout,a=p.items+id*L.stride,hold=L.holdAt;
 return{id,name:layoutName(fixedName,b,{...L,base:p.items},id),price:getField(b,a,L.price),holdEffect:hold===undefined?0:b[a+hold],holdEffectParam:hold===undefined?0:b[a+hold+1],descriptionAddress:-1,pocket:0,type:0};
}
export function readLayoutMove(b,p,id,fixedName){
 const L=p.moveLayout,a=p.moves+id*L.stride,f=k=>L.fields[k]?getField(b,a,L.fields[k]):0;
 return{id,name:layoutName(fixedName,b,{...L,base:p.moves},id),effect:0,power:f('power'),type:0,accuracy:f('accuracy'),pp:f('pp'),secondaryChance:0,target:0,priority:0,flags:0};
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
export function readRseTrainerClass(b,p,i,fixedName){if(p.trainerLayout)return 'Class kept as is';return tolerantName(fixedName,b,p.trainerClasses+i*13,13);}

// Trainers: 40-byte records, party flags first (1 = moves, 2 = held item),
// name at +4, party count at +32 and party pointer at +36. The table of trainer
// class names (13 bytes each) sits immediately before the first record.
export function discoverTrainerTable(b){
 const trainerOk=x=>{if(x<0||x+40>b.length||b[x]>3)return false;const f=b.subarray(x+4,x+16).indexOf(0xff);if(f<0)return false;const n=b[x+32]|b[x+33]<<8,q=(b[x+36]|b[x+37]<<8|b[x+38]<<16|b[x+39]<<24>>>0)-BASE;return b[x+34]===0&&b[x+35]===0&&n>=1&&n<=6&&q>=0&&q<b.length;};
 // Entry 0 is a placeholder in most games: no name and no party.
 const noneOk=x=>x>=0&&x+40<=b.length&&b[x+4]===0xff&&b[x+32]===0&&b[x+36]===0&&b[x+39]===0;
 for(let at=0;at+40*200<Math.min(b.length,0x1200000);at+=4){
  if(!trainerOk(at)||!trainerOk(at+40)||!trainerOk(at+80))continue;
  let s=at;while(trainerOk(s-40))s-=40;
  const n=run(b,s,40,trainerOk);
  if(n<200){at=s+n*40;continue;}
  let start=s,count=n;if(noneOk(s-40)){start=s-40;count++;}
  let top=0;for(let i=0;i<count;i++)top=Math.max(top,b[start+i*40+1]);
  const classCount=top+1,classes=start-Math.ceil(classCount*13/4)*4;let good=0;
  if(classes<0)return null;
  for(let i=0;i<classCount;i++)if(nameOk(b,classes+i*13,13)||(i===0&&b[classes]===0xff))good++;
  if(good<classCount*0.9)return null;
  return{trainers:start,count,classes,classCount};
 }
 return null;
}

// Games whose species records start with the six base stats (every decomp and
// expansion release, and most hacks). The record size is measured from
// Bulbasaur, Ivysaur and Venusaur, so any release works. Only the stats and
// the catch rate (byte 8) are treated as editable; type numbering and the rest
// differ between releases.
const ENC=s=>[...s].map(c=>c>='A'&&c<='Z'?0xbb+c.charCodeAt(0)-65:0xd5+c.charCodeAt(0)-97);
export function findAllBytes(b,pat,limit){return findAll(b,pat,limit);}
function findAll(b,pat,limit=64){const out=[];const first=pat[0];for(let i=b.indexOf(first);i>=0&&i+pat.length<=b.length&&out.length<limit;i=b.indexOf(first,i+1)){let ok=true;for(let k=1;k<pat.length;k++)if(b[i+k]!==pat[k]){ok=false;break;}if(ok)out.push(i);}return out;}
export function discoverAnchoredSpecies(b,sourceSha256){
 const bul=findAll(b,[45,49,49,45,65,65]),ivy=findAll(b,[60,62,63,60,80,80]),ven=findAll(b,[80,82,83,80,100,100]);
 let hit=null;
 for(const x of bul)for(const y of ivy){const S=y-x;if(S<20||S>1024)continue;if(ven.includes(y+S)){if(hit)return null;hit={x,S};}}
 if(!hit)return null;
 const S=hit.S,start=hit.x-S;
 // Names: inline in each record, or a separate table.
 let nameBase=-1,nameStride=0;
 const bn=ENC('Bulbasaur'),inn=ENC('Ivysaur');
 for(let off=0;off+inn.length<S&&nameBase<0;off++){
  if(bn.every((v,i)=>b[hit.x+off+i]===v)&&b[hit.x+off+bn.length]===0xff&&inn.every((v,i)=>b[hit.x+S+off+i]===v)){nameBase=start+off;nameStride=S;}
 }
 if(nameBase<0){
  const nb=findAll(b,[...bn,0xff]).filter(x=>x>0),ni=findAll(b,[...inn,0xff]);
  for(const x of nb)for(const y of ni){const d=y-x;if(d>=10&&d<=24){nameBase=x-d;nameStride=d;}}
 }
 if(nameBase<0)return null;
 const nameValid=i=>{const a=nameBase+i*nameStride;let n=0;for(;n<12&&b[a+n]!==0xff;n++){const c=b[a+n];if(!(c===0||c>=0xa1&&c<=0xee||[0xab,0xac,0xad,0xae,0xb0,0xb4,0x1b,0xf0,0xba,0xb8,0x2e].includes(c)))return false;}return n>0&&n<12&&b[a]!==0;};
 const valid=i=>{const a=start+i*S;if(a+S>b.length)return false;for(let k=0;k<6;k++)if(!b[a+k])return false;return b[a+6]<40&&b[a+7]<40&&nameValid(i);};
 let last=3,miss=0;for(let i=4;miss<20;i++){if(valid(i)){last=i;miss=0;}else miss++;}
 const speciesCount=last+1;
 const am=discoverAnchoredMoves(b),ai=discoverAnchoredItems(b);
 const lt=am&&ai?discoverLayoutTrainers(b,speciesCount,am.moveCount,ai.itemCount):null;
 const capabilities={species:true,moves:!!am,items:!!ai,trainers:!!lt,encounters:false};
 return{version:2,rse:true,sourceSha256,capabilities,speciesCount,moveCount:am?am.moveCount:0,itemCount:ai?ai.itemCount:0,moveLayout:am?am.moveLayout:void 0,itemLayout:ai?ai.itemLayout:void 0,itemFields:ai?['price']:void 0,abilityCount:0,trainerCount:lt?lt.trainerCount:0,trainerClassCount:lt?1:0,trainerLayout:lt?lt.trainerLayout:void 0,
  speciesNames:nameBase,baseStats:start,statsStride:S,speciesLayout:{stride:S,nameBase,nameStride,nameLen:11,types:0,catchRate:8,genderRatio:0,eggCycles:0,friendship:0},
  moveNames:-1,moves:am?am.moves:-1,learnsets:null,evolutions:null,evolutionSlots:5,speciesAbilities:null,items:ai?ai.items:-1,itemNames:-1,abilityNames:-1,trainers:lt?lt.trainers:-1,trainerClasses:-1,wild:-1,wildCount:0,
  speciesFields:['name','stats','catchRate'],typeMax:0};
}

// Table of records with a pointer to a name string, found from known entries:
// entries are matched by name, then field positions by known values.
const ENC2=s=>[...s].map(c=>c===' '?0:c==='é'?0x1b:c>='A'&&c<='Z'?0xbb+c.charCodeAt(0)-65:c>='a'&&c<='z'?0xd5+c.charCodeAt(0)-97:c==='-'?0xae:0xac);
function ptrLocs(b,names,inline){
 const out=new Set();
 for(const n of names){const e=ENC2(n);for(const at of findAll(b,[...e,0xff],16)){if(inline){out.add(at);continue;}const x=at+BASE,pat=[x&255,x>>8&255,x>>16&255,x>>>24];for(const q of findAll(b,pat,64))if(q%4===0)out.add(q);}}
 return out;
}
function anchoredTable(b,anchors,specs,maxStride,inline){
 // anchors: [{id,names:[variants]}] ; specs: {field:{bits:[..],values:[..]}}
 const locs=anchors.map(a=>ptrLocs(b,a.names,inline));
 const [a0,a1]=anchors;
 for(const p0 of locs[0])for(const p1 of locs[1]){
  const d=p1-p0,k=a1.id-a0.id;
  if(d<=0||d%k)continue;const S=d/k;if(S<12||S>maxStride||S%4)continue;
  if(!anchors.every((a,i)=>locs[i].has(p0+(a.id-a0.id)*S)))continue;
  for(let nameOff=0;nameOff<S;nameOff+=4){
   const base=p0-a0.id*S-nameOff;if(base<0)break;
   const fields={};let ok=true;
   for(const [name,spec] of Object.entries(specs)){
    let found=null;
    for(const bits of spec.bits){for(let at=0;at+4<=S&&!found;at++)for(let sh=0;sh+bits<=32&&!found;sh++){
     const f={at,sh,bits};if(anchors.every((a,i)=>getField(b,base+a.id*S,f)===spec.values[i]))found=f;}if(found)break;}
    if(!found){ok=false;break;}fields[name]=found;
   }
   if(ok)return{base,stride:S,fields,nameOff};
  }
 }
 return null;
}
function countPtrRecords(b,base,S,miss,off){
 let last=0,m=0;for(let i=1;m<miss;i++){const a=base+i*S+off;if(a+S>b.length)break;const q=(b[a]|b[a+1]<<8|b[a+2]<<16|b[a+3]<<24>>>0)-BASE;let ok=false;
  if(q>0&&q<b.length&&b[q]!==0xff){let n=0;while(n<24&&b[q+n]!==0xff&&(b[q+n]===0||b[q+n]>=0xa1&&b[q+n]<=0xee||[0xab,0xac,0xad,0xae,0xb0,0xb4,0x1b,0xf0,0xba,0xb8,0x2e].includes(b[q+n])))n++;ok=n>0&&n<24&&b[q+n]===0xff;}
  if(ok){last=i;m=0;}else m++;}
 return last+1;
}
export function discoverAnchoredMoves(b){
 const v=(n)=>[n,n.toUpperCase()];
 const A=[[1,'Pound',40,100,35],[2,'Karate Chop',50,100,25],[4,'Comet Punch',18,85,15],[5,'Mega Punch',80,85,20],[6,'Pay Day',40,100,20]];
 const anchors=A.map(x=>({id:x[0],names:v(x[1])}));
 const t=anchoredTable(b,anchors,{power:{bits:[9,8,7],values:A.map(x=>x[2])},accuracy:{bits:[7,8],values:A.map(x=>x[3])},pp:{bits:[8,6],values:A.map(x=>x[4])}},128);
 if(!t)return null;
 const count=countPtrRecords(b,t.base,t.stride,12,t.nameOff);
 return{moves:t.base,moveLayout:{stride:t.stride,namePtr:t.nameOff,fields:t.fields},moveCount:count};
}
export function discoverAnchoredItems(b){
 // Two known orderings of the first Poké Balls: older and newer releases.
 const orders=[[[1,'Master Ball',0],[2,'Ultra Ball',800],[3,'Great Ball',600]],[[1,'Poké Ball',200],[2,'Great Ball',600],[3,'Ultra Ball',800],[4,'Master Ball',0]]];
 for(const A of orders){
  const anchors=A.map(x=>({id:x[0],names:[x[1],x[1].toUpperCase()]}));
  const specs={price:{bits:[32,16],values:A.map(x=>x[2])}};
  const t=anchoredTable(b,anchors,specs,160);
  if(t)return{items:t.base,itemLayout:{stride:t.stride,namePtr:t.nameOff,price:t.fields.price},itemCount:countPtrRecords(b,t.base,t.stride,24,t.nameOff)};
  const u=anchoredTable(b,anchors,specs,160,true);
  if(u&&u.nameOff+14<=u.stride){let last=0,miss=0;for(let i=1;miss<24;i++){const a=u.base+i*u.stride;if(a+u.stride>b.length)break;let n=0;while(n<14&&b[a+u.nameOff+n]!==0xff)n++;if(n>0&&n<14&&b[a+u.nameOff]!==0){last=i;miss=0;}else miss++;}
   return{items:u.base,itemLayout:{stride:u.stride,nameBase:u.base+u.nameOff,nameStride:u.stride,nameLen:14,price:u.fields.price},itemCount:last+1};}
 }
 return null;
}

function speciesCount0(names,nameCount,statCount){return Math.min(nameCount,statCount);}
// Ability names: 13-byte records headed by a "-------" placeholder. Found from
// the abilities most species use, which must name real abilities; a table is
// accepted only when every ability byte of every species points inside it.
export function discoverAbilityTable(b,stats,speciesCount){
 const mark=[0xae,0xae,0xae,0xae,0xae,0xae,0xae,0xff];
 for(const at of findAll(b,mark,32)){
  if(b[at-1]===0xae)continue;
  let count=0;while(count<512){const a=at+count*13;if(a+13>b.length)break;let n=0;while(n<13&&b[a+n]!==0xff)n++;if(n===13||(count>0&&n===0))break;let ok=true;for(let i=0;i<n;i++){const c=b[a+i];if(!(c===0||c>=0xa1&&c<=0xee||[0xab,0xac,0xad,0xae,0xb0,0xb4,0x1b,0xf0,0xba,0xb8,0x2e].includes(c)))ok=false;}if(!ok)break;count++;}
  if(count<50)continue;
  let fit=true;for(let i=1;i<speciesCount;i++){const a=stats+i*24;if(b[a+20]>=count||b[a+21]>=count){fit=false;break;}}
  if(fit)return{base:at,count};
 }
 return null;
}

// Level-up lists: a table of one pointer per species to entries of
// (move u16, level u16), ended by move 0xffff. Found by structure.
export function discoverLearnsetTable(b,speciesCount,moveCount){
 const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const listOk=(q,allowEmpty)=>{if(q<0||q+4>b.length||q%2)return false;let prev=0;for(let n=0;n<100;n++){if(q+n*4+4>b.length)return false;const m=dv.getUint16(q+n*4,true),l=dv.getUint16(q+n*4+2,true);if(m===0xffff)return n>0||allowEmpty;if(m<1||m>=moveCount||l>100||l<prev)return false;prev=l;}return false;};
 const ptrOk=(a,first)=>{const v=dv.getUint32(a,true);return v>=BASE&&v<BASE+b.length&&listOk(v-BASE,first);};
 let run=0;
 for(let a=0;a+4<=Math.min(b.length,0x1e00000);a+=4){
  if(ptrOk(a,run===0||run===1)){run++;if(run>=speciesCount){const t=a-(run-1)*4;if(ptrOk(t,true)&&ptrOk(t+4,false))return{table:t};}}else run=0;
 }
 return null;
}

// Evolutions: per species a fixed number of 8-byte slots (method, parameter,
// target species, zero). Empty slots are all zero and only follow used ones.
export function discoverEvolutionTable(b,count){
 const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
 for(const K of [8,5,6,7,4]){
  const S=K*8;
  for(let a=0;a+count*S<=Math.min(b.length,0x1e00000);a+=4){
   let used=0,ok=true;
   for(let i=0;i<count&&ok;i++){let empty=false;for(let k=0;k<K;k++){const o=a+i*S+k*8,m=dv.getUint16(o,true),p=dv.getUint16(o+2,true),t=dv.getUint16(o+4,true),z=dv.getUint16(o+6,true);
    if(m===0){if(p||t||z){ok=false;break;}empty=true;}else{if(empty||m>64||t<1||t>=count||z){ok=false;break;}used++;}}}
   if(ok&&used>=count/4)return{table:a,slots:K};
  }
 }
 return null;
}

// Wild encounter headers: 20-byte rows (bank, map, 0, 0, then pointers for
// land, water, rock smash and fishing) ended by a row starting 0xff 0xff.
export function discoverWildTable(b,speciesCount,isReferenced){
 const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const ptr=a=>{const v=dv.getUint32(a,true);return v>=BASE&&v<BASE+b.length?v-BASE:-1;};
 const mon=(p,n)=>{if(p<0||p+n*4>b.length)return false;for(let i=0;i<n;i++){const q=p+i*4,m=dv.getUint16(q+2,true);if(b[q]<1||b[q]>100||b[q+1]<b[q]||b[q+1]>100||m<1||m>=speciesCount)return false;}return true;};
 const row=a=>{if(b[a+2]||b[a+3])return false;let g=0;for(let k=0;k<4;k++){if(dv.getUint32(a+4+k*4,true)===0)continue;const i=ptr(a+4+k*4);if(i<0||i+8>b.length||b[i]>100||b[i+1]!==0)return false;if(!mon(ptr(i+4),[12,5,5,10][k]))return false;g++;}return g>0;};
 const seen=new Set();
 for(let a=0;a+20<=b.length;a+=4){
  if(seen.has(a)||!row(a))continue;
  let n=0,x=a;while(x+20<=b.length&&row(x)){seen.add(x);n++;x+=20;}
  if(n>=20&&b[x]===255&&b[x+1]===255){let s=a;while(s-20>=0&&row(s-20))s-=20;if(!isReferenced||isReferenced(s))return{table:s,count:n+(a-s)/20};}
 }
 return null;
}

// Trainer tables of pokeemerald-expansion releases. The record size and field
// positions differ between releases, so they are found from the first
// trainers (Sawyer, then five Aqua grunts): the name locates each record, the
// party pointer is the field that leads to party arrays, the party member size
// is the common step between those arrays, and the party size is the field
// that matches the gaps between them.
function gcd(a,b){while(b)[a,b]=[b,a%b];return a;}
export function discoverLayoutTrainers(b,speciesCount,moveCount,itemCount){
 const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const nameLocs=n=>{const out=[];for(const v of [n.toUpperCase(),n[0]+n.slice(1).toLowerCase()])for(const at of findAll(b,[...ENC2(v),0xff],64))out.push(at);return out;};
 const sawyer=nameLocs('SAWYER'),grunt=new Set(nameLocs('GRUNT'));
 const ptrAt=a=>{if(a<0||a+4>b.length)return -1;const v=dv.getUint32(a,true);return v>=BASE&&v<BASE+b.length&&(v&3)===0?v-BASE:-1;};
 const cands=[];
 for(let S=24;S<=128;S+=4){
  for(const s0 of sawyer)if([1,2,3,4,5].filter(k=>grunt.has(s0+k*S)).length>=3)cands.push([s0,S]);
  for(const g of grunt){let run=0;while(grunt.has(g+run*S))run++;if(run>=4&&!grunt.has(g-S))cands.push([g-S,S]);}
 }
 for(const [s0,S] of cands){
  const org=s0-S-S; // origin of record 1 is name - S; fields are read from there
  const rec=i=>s0+(i-1)*S-S,N=i=>{const a=rec(i);return a;};
  for(let rel=(4-N(1)%4)%4;rel<2*S;rel+=4){
   if(![1,2,3,4,5,6].every(i=>ptrAt(N(i)+rel)>0))continue;
   // gather records
   const ptrs=[];let last=0,miss=0;
   for(let i=1;miss<4;i++){const a=N(i);if(a+2*S>b.length)break;const q=ptrAt(a+rel);if(q>0&&q+40<b.length){ptrs.push([i,q]);last=i;miss=0;}else miss++;}
   if(last<50)continue;
   const uniq=[...new Set(ptrs.map(x=>x[1]))].sort((x,y)=>x-y);
   const diffs=[];for(let i=1;i<uniq.length;i++)if(uniq[i]-uniq[i-1]<=7*64)diffs.push(uniq[i]-uniq[i-1]);
   let M=0;for(let c=28;c<=64&&!M;c+=4)if(diffs.length>=30&&diffs.filter(d=>d%c===0).length>=diffs.length*0.9)M=c;
   if(!M)continue;
   const monOk=q=>dv.getUint16(q+20,true)>0&&dv.getUint16(q+20,true)<speciesCount&&b[q+26]>=1&&b[q+26]<=100&&dv.getUint16(q+22,true)<itemCount+1&&[0,1,2,3].every(k=>dv.getUint16(q+12+k*2,true)<moveCount);
   const sizeOf=new Map();uniq.forEach((q,i)=>{if(i+1<uniq.length)sizeOf.set(q,(uniq[i+1]-q)/M);});
   let good=0,tot=0;for(const [,q] of ptrs){const n=sizeOf.get(q);if(!n||n>6)continue;tot++;let ok=true;for(let k=0;k<n;k++)if(!monOk(q+k*M)){ok=false;break;}if(ok)good++;}
   if(tot<30||good<tot*0.95)continue;
   // party size field
   let size=null;
   for(const bits of [8,3]){for(let at=0;at<2*S&&!size;at++)for(let sh=0;sh+bits<=32&&!size;sh++){if(bits===8&&sh%8)continue;const f={at,sh,bits};let m=0,t=0;for(const [i,q] of ptrs){const n=sizeOf.get(q);if(!n||n>6)continue;t++;if(getField(b,N(i),f)===n)m++;}if(t>=30&&m>=t*0.95)size=f;}if(size)break;}
   if(!size)continue;
   return{trainers:N(1)-S+0,trainerLayout:{stride:S,partyAt:rel,sizeAt:size,monStride:M,nameAt:S,species:20,level:26,held:22,moves:12,nameLen:11},trainerCount:last+1};
  }
 }
 return null;
}
export function readLayoutTrainer(b,p,id,fixedName){
 const L=p.trainerLayout,a=p.trainers+id*L.stride,dv=new DataView(b.buffer,b.byteOffset,b.byteLength),count=getField(b,a,L.sizeAt),q=dv.getUint32(a+L.partyAt,true)-BASE,party=[];
 for(let j=0;j<count;j++){const m=q+j*L.monStride;party.push({ivQuality:0,level:b[m+L.level],species:dv.getUint16(m+L.species,true),heldItem:dv.getUint16(m+L.held,true),moves:Array.from({length:4},(_,k)=>dv.getUint16(m+L.moves+k*2,true))});}
 return{id,name:tolerantName(fixedName,b,a+L.nameAt,L.nameLen),trainerClass:0,sprite:0,genderMusic:0,customMoves:true,heldItems:true,doubleBattle:false,ai:0,items:[0,0,0,0],party};
}
export function encodeLayoutParty(b,p,id,tr){
 const L=p.trainerLayout,a=p.trainers+id*L.stride,dv=new DataView(b.buffer,b.byteOffset,b.byteLength),oldCount=getField(b,a,L.sizeAt),oldQ=dv.getUint32(a+L.partyAt,true)-BASE;
 if(!Array.isArray(tr.party)||tr.party.length<1||tr.party.length>6)throw Error('A trainer needs one to six Pok\u00E9mon.');
 const out=new Uint8Array(L.monStride*tr.party.length),od=new DataView(out.buffer);
 const n=(x,lo,hi,l)=>{if(!Number.isInteger(x)||x<lo||x>hi)throw Error(l+' must be a whole number from '+lo+' to '+hi+'.');return x;};
 tr.party.forEach((m,i)=>{
  const at=i*L.monStride,src=oldQ+Math.min(i,oldCount-1)*L.monStride;out.set(b.subarray(src,src+L.monStride),at);
  out[at+L.level]=n(m.level,1,100,'Level');od.setUint16(at+L.species,n(m.species,1,p.speciesCount-1,'Species'),true);od.setUint16(at+L.held,n(m.heldItem??0,0,p.itemCount||65535,'Held item'),true);
  const mv=m.moves||[];for(let k=0;k<4;k++)od.setUint16(at+L.moves+k*2,n(mv[k]??0,0,p.moveCount-1,'Move'),true);
 });
 return out;
}
