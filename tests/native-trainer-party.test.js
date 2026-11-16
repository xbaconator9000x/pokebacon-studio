import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trainerPartySource,encodeTrainerParty} from '../dist/native-trainer-party.js';
import {editsFor,validateGameEdits} from '../dist/game-edits.js';
import {newProject} from '../dist/model.js';

function fixture(flags=3,{expanded=false,count=2}={}){
 const source=new Uint8Array(8192).fill(0xff),profile={
  trainers:0x200,trainerCount:4,speciesCount:550,itemCount:600,moveCount:500,
  capabilities:{trainers:true},expandedTrainerParty:expanded
 },at=0x200+40,start=0x1000,v=new DataView(source.buffer);
 source[at]=flags;source[at+32]=count;
 v.setUint32(at+36,count?0x08000000+start:0,true);
 const stride=expanded&&flags===3?32:flags&1?16:8;
 for(let i=0;i<count;i++){
  const x=start+i*stride;
  source.fill(0x7b,x,x+stride);
  v.setUint16(x,65+i,true);
  source[x+2]=25+i;source[x+3]=0x77;
  v.setUint16(x+4,25+i,true);
  if(flags&2)v.setUint16(x+(stride===32?20:6),13+i,true);
  if(flags&1)for(let j=0;j<4;j++)v.setUint16(x+(stride===32?22:flags&2?8:6)+j*2,j+1+i*4,true);
  if(stride===32){source[x+6]=3;source[x+7]=12;
   source.set([1,2,3,4,5,6],x+8);source.set([11,12,13,14,15,16],x+14);
   v.setUint16(x+30,18,true);
  }
 }
 const party=Array.from({length:count},(_,i)=>({
  species:25+i,level:25+i,ivQuality:65+i,heldItem:flags&2?13+i:0,
  moves:flags&1?Array.from({length:4},(_,j)=>j+1+i*4):[],
  ...(expanded&&flags===3?{ability:3,nature:12,ivSpread:[1,2,3,4,5,6],evSpread:[11,12,13,14,15,16],teraType:18}:{})
 }));
 return{source,profile,at,start,stride,party,trainer:{party,customMoves:!!(flags&1),heldItems:!!(flags&2),doubleBattle:false}};
}

for(const flags of [0,1,2,3]){
 test('source-native party layout '+flags+' preserves untouched record bytes and round-trips changes',()=>{
  const f=fixture(flags),before=f.source.slice(),record=trainerPartySource(f.source,f.profile,1);
  assert.equal(record.count,2);assert.equal(record.kind.stride,flags&1?16:8);
  assert.equal(record.bytes[3],0x77);
  const updated=structuredClone(f.trainer);
  updated.party[0].level=34;updated.party[1].species=390;
  const packed=encodeTrainerParty(f.source,f.profile,1,updated),d=new DataView(packed.bytes.buffer);
  assert.equal(packed.flags,flags);assert.equal(packed.count,2);
  assert.equal(packed.bytes[2],34);assert.equal(packed.bytes[3],0x77,'native padding is preserved');
  assert.equal(d.getUint16(f.stride+4,true),390);
  assert.deepEqual(f.source,before,'source ROM bytes are never modified');
  assert.deepEqual(packed.bytes.slice(0,2),record.bytes.slice(0,2),'unaltered IV bytes survive');
 });
}
test('valid expanded trainer parties retain natures, held items, EV/IV spreads, Tera field and reserved bytes',()=>{
 const f=fixture(3,{expanded:true});
 const encoded=encodeTrainerParty(f.source,f.profile,1,{...f.trainer,party:f.party.map((m,i)=>({...m,level:34+i}))});
 assert.equal(encoded.stride,32);
 assert.equal(encoded.bytes[6],3);assert.equal(encoded.bytes[7],12);
 assert.deepEqual([...encoded.bytes.slice(8,14)],[1,2,3,4,5,6]);
 assert.deepEqual([...encoded.bytes.slice(14,20)],[11,12,13,14,15,16]);
 const view=new DataView(encoded.bytes.buffer);
 assert.equal(view.getUint16(20,true),13);assert.equal(view.getUint16(22,true),1);
 assert.equal(view.getUint16(30,true),18);
 assert.equal(encoded.bytes[3],0x77);
});
test('changing native party format produces zero-initialised safe padding and optional items/moves',()=>{
 const f=fixture(0),next={...f.trainer,customMoves:true,heldItems:true,
  party:f.party.map(m=>({...m,heldItem:99,moves:[1,2,3,4]}))};
 const result=encodeTrainerParty(f.source,f.profile,1,next);
 assert.equal(result.stride,16);assert.equal(result.flags,3);
 const view=new DataView(result.bytes.buffer);
 assert.equal(view.getUint16(6,true),99);assert.equal(view.getUint16(8,true),1);
 assert.equal(result.bytes[3],0,'unused alignment byte is new padding, not copied from the wrong layout');
});
test('native party editing rejects unknown trainer flags, source pointer/stride mismatch and corrupt mons',()=>{
 const f=fixture(3);
 f.source[f.at]|=0x10;
 assert.throws(()=>trainerPartySource(f.source,f.profile,1),/Unrecognised trainer party flags/);
 f.source[f.at]=3;
 const view=new DataView(f.source.buffer);
 view.setUint32(f.at+36,0x08001001,true);
 assert.throws(()=>trainerPartySource(f.source,f.profile,1),/pointer/);
 view.setUint32(f.at+36,0x08001ff8,true);
 assert.throws(()=>trainerPartySource(f.source,f.profile,1),/pointer/);
 view.setUint32(f.at+36,0x08001000,true);
 f.source[f.at+32]=7;
 assert.throws(()=>trainerPartySource(f.source,f.profile,1),/party size/);
 f.source[f.at+32]=2;view.setUint16(f.start+4,550,true);
 assert.throws(()=>trainerPartySource(f.source,f.profile,1),/invalid species or level/);
});
test('all party changes fail closed on invalid species, moves, held items, levels and double battle sizes',()=>{
 const f=fixture(3),base=structuredClone(f.trainer);
 const bad=[
  [{party:base.party.map((m,i)=>i?m:{...m,species:99999})},/Trainer species/],
  [{party:base.party.map((m,i)=>i?m:{...m,level:101})},/Trainer level/],
  [{party:base.party.map((m,i)=>i?m:{...m,heldItem:700})},/Trainer held item/],
  [{party:base.party.map((m,i)=>i?m:{...m,moves:[1,2,3,9999]})},/Trainer move/],
  [{party:[base.party[0]],doubleBattle:true},/at least two/],
  [{party:[]},/one to six/],
  [{party:Array.from({length:7},()=>base.party[0])},/one to six/],
  [{party:base.party.map((m,i)=>i?m:{...m,ivQuality:2.5})},/Trainer IV quality/]
 ];
 for(const [patch,error] of bad)assert.throws(()=>encodeTrainerParty(f.source,f.profile,1,{...base,...patch}),error);
 assert.deepEqual(encodeTrainerParty(f.source,f.profile,1,base).bytes,trainerPartySource(f.source,f.profile,1).bytes,'valid original is byte-identical');
});
test('trainer edits survive project JSON backup without breaking source ROM identity',()=>{
 const f=fixture(2),project=newProject(),hash='a'.repeat(64),patch={party:f.party.map(m=>({...m,level:50}))};
 editsFor(project,hash,true).trainers[1]=patch;
 validateGameEdits(project);
 const saved=JSON.parse(JSON.stringify(project));
 assert.deepEqual(saved.romEdits[hash].trainers[1],patch);
 assert.equal(encodeTrainerParty(f.source,f.profile,1,{...f.trainer,...saved.romEdits[hash].trainers[1]}).count,2);
});
test('mobile trainer workshop exposes move, duplicate and copy without mutating other trainer records',()=>{
 const ui=readFileSync(new URL('../dist/game-ui.js',import.meta.url),'utf8');
 const writer=readFileSync(new URL('../dist/game-data.js',import.meta.url),'utf8');
 assert.match(ui,/data-party-up/);assert.match(ui,/data-party-down/);
 assert.match(ui,/data-party-clone/);assert.match(ui,/trainerCopyTeam/);
 assert.match(ui,/structuredClone\(donor.party\)/);
 assert.match(writer,/encodeTrainerParty\(source,p,id,tr\)/);
 assert.match(writer,/output.allocate\(encoded.bytes,"Trainer party"\)/);
});
