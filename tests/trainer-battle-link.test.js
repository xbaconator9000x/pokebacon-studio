import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectTrainerBattle,nativeStoryTrainerSlot} from '../dist/trainer-battle-link.js';
import {trainerPartySource,encodeTrainerParty} from '../dist/native-trainer-party.js';
import {editsFor,validateGameEdits} from '../dist/game-edits.js';
import {newProject,validateProject} from '../dist/model.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {RomOutput} from '../dist/rom-writer.js';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {compileScript} from '../dist/script-engine.js';
import {GbaMaps} from '../dist/rom.js';
import {indexNativeStory} from '../dist/native-story.js';
import {previewNativeVisualImport,applyNativeVisualImport} from '../dist/native-scene-import.js';
import {sceneSource} from '../dist/scene-compiler.js';

const HASH='c'.repeat(64),BASE=0x08000000;
function fixture({bytes=new Uint8Array(16384).fill(0xff),trainerId=1,partyAt=0x1000}={}){
 const profile={sourceSha256:HASH,capabilities:{trainers:true},trainers:0x200,trainerCount:30,
   speciesCount:550,moveCount:500,itemCount:600,expandedTrainerParty:false};
 const at=profile.trainers+trainerId*40,v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 bytes.fill(0,at,at+40);bytes[at]=3;bytes[at+32]=2;v.setUint32(at+36,BASE+partyAt,true);
 const members=[{ivQuality:55,level:18,species:25,heldItem:13,moves:[1,2,3,4]},
                {ivQuality:90,level:23,species:66,heldItem:14,moves:[5,6,7,8]}];
 for(let i=0;i<members.length;i++){
  const x=partyAt+i*16,m=members[i];
  bytes.fill(0,x,x+16);v.setUint16(x,m.ivQuality,true);bytes[x+2]=m.level;
  v.setUint16(x+4,m.species,true);v.setUint16(x+6,m.heldItem,true);
  m.moves.forEach((move,j)=>v.setUint16(x+8+j*2,move,true));
 }
 const rows=Array.from({length:30},(_,id)=>({id,name:'Trainer '+id,party:[],
   customMoves:false,heldItems:false,doubleBattle:false}));
 rows[trainerId]={id:trainerId,name:'Original Grunt',party:members,
   customMoves:true,heldItems:true,doubleBattle:false,items:[0,0,0,0]};
 const context={hash:HASH,reader:{bytes},profile,data:{trainers:rows}};
 const project=newProject('Trainer battle link');
 return{bytes,profile,at,partyAt,members,context,project,trainerId};
}
test('linked battle resolves a verified native trainer, exact source slot, untouched project',()=>{
 const f=fixture(),before=structuredClone(f.project);
 const found=inspectTrainerBattle(f.context,f.project,1);
 assert.equal(found.id,1);assert.equal(found.name,'Original Grunt');
 assert.equal(found.sourceSha256,HASH);assert.equal(found.sourceAddress,f.at);
 assert.equal(found.sourcePartyAddress,f.partyAt);assert.equal(found.sourcePartyCount,2);
 assert.deepEqual(found.party,f.members);assert.equal(found.hasStagedEdits,false);
 found.party[0].species=999;assert.equal(f.members[0].species,25,'view cannot edit source data');
 assert.deepEqual(f.project,before,'view-only lookup must not create project edits');
});
test('visual event resolves staged trainer data from the same original ROM, without changing unrelated edits',()=>{
 const f=fixture(),before=f.bytes.slice(),newParty=structuredClone(f.members);
 newParty[0].species=150;newParty[1].level=40;
 const edits=editsFor(f.project,HASH,true);
 edits.trainers[1]={party:newParty,name:'Edited Grunt'};
 const foreign=editsFor(f.project,'d'.repeat(64),true);
 foreign.trainers[1]={party:structuredClone(f.members)};
 const found=inspectTrainerBattle(f.context,f.project,1);
 assert.equal(found.hasStagedEdits,true);
 assert.equal(found.name,'Edited Grunt');
 assert.equal(found.party[0].species,150);assert.equal(found.party[1].level,40);
 assert.deepEqual(f.bytes,before,'staging and lookup must leave original ROM byte-identical');
 assert.equal(foreign.trainers[1].party[0].species,25);
});
test('native trainer IDs, stale source digests, unsupported tables and unused slots all fail closed',()=>{
 const f=fixture();
 for(const id of [0,-1,30,31,65536,1.2,'1',null,undefined])
  assert.throws(()=>inspectTrainerBattle(f.context,f.project,id),/trainer|original/i);
 assert.throws(()=>inspectTrainerBattle({...f.context,hash:'d'.repeat(64)},f.project,1),/original source ROM|verify|unavailable/i);
 assert.throws(()=>inspectTrainerBattle({...f.context,profile:{...f.profile,capabilities:{trainers:false}}},f.project,1),/unavailable/);
 assert.throws(()=>inspectTrainerBattle({...f.context,data:{trainers:[]}},f.project,1),/outside/);
 f.bytes[f.at]=0x83;
 assert.throws(()=>inspectTrainerBattle(f.context,f.project,1),/Unrecognised trainer party flags/);
 f.bytes[f.at]=3;f.bytes[f.at+32]=0;
 const v=new DataView(f.bytes.buffer);v.setUint32(f.at+36,0,true);
 assert.throws(()=>inspectTrainerBattle(f.context,f.project,1),/unused source slot/);
});
test('a malformed staged team cannot be presented as a verified valid trainer battle',()=>{
 const f=fixture(),edits=editsFor(f.project,HASH,true);
 edits.trainers[1]={party:[{...f.members[0],level:101}]};
 assert.throws(()=>inspectTrainerBattle(f.context,f.project,1),/Trainer level/);
 edits.trainers[1]={party:[{...f.members[0],moves:[1,2,3,600]}]};
 assert.throws(()=>inspectTrainerBattle(f.context,f.project,1),/Trainer move/);
 edits.trainers[1]={party:[{...f.members[0],species:0}]};
 assert.throws(()=>inspectTrainerBattle(f.context,f.project,1),/Trainer species/);
});
test('linked team and battle action survive split project save/reopen with original source ownership',()=>{
 const f=fixture(),edits=editsFor(f.project,HASH,true),newParty=structuredClone(f.members);
 newParty[0].species=150;edits.trainers[1]={party:newParty};
 validateGameEdits(f.project);validateProject(f.project);
 const plan=planSave(f.project),parts=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(structuredClone(plan.header),
  savedProjectKeys(plan.header).map(k=>parts.get(k)));
 assert.equal(inspectTrainerBattle(f.context,restored,1).party[0].species,150);
 assert.equal(restored.romEdits[HASH].trainers[1].party[0].species,150);
 assert.equal(Object.keys(restored.romEdits).length,1);
});
test('synthetic native ROM trainer battle keeps its trainer ID and unrelated shared trainer party after independent edit',async()=>{
 const bytes=syntheticROM(),view=new DataView(bytes.buffer),trainerId=23,otherId=24;
 const script='@start:\nlockall\ntrainerbattle 1 23 0 @intro @defeat @after\n@after:\nreleaseall\nend\n@intro:\n= Battle now.$\n@defeat:\n= Well fought.$\n';
 bytes.set(compileScript(script,0x5000,'frlg').bytes,0x5000);
 bytes[0x3000]=2;view.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<2;i++){bytes[0x3200+i*24]=i+1;view.setInt16(0x3204+i*24,i+2,true);
  view.setInt16(0x3206+i*24,2,true);view.setUint32(0x3210+i*24,BASE+0x5000,true);}
 // Two trainer headers deliberately share the same original party bytes.
 const profile={sourceSha256:HASH,capabilities:{trainers:true},trainers:0x7000,
  trainerCount:30,speciesCount:550,moveCount:500,itemCount:600};
 const first=profile.trainers+trainerId*40,second=profile.trainers+otherId*40,partyAt=0x7600;
 for(const at of [first,second]){bytes.fill(0,at,at+40);bytes[at]=3;bytes[at+32]=1;
  view.setUint32(at+36,BASE+partyAt,true);}
 bytes.fill(0,partyAt,partyAt+16);view.setUint16(partyAt,55,true);bytes[partyAt+2]=18;
 view.setUint16(partyAt+4,25,true);view.setUint16(partyAt+6,13,true);
 for(let i=0;i<4;i++)view.setUint16(partyAt+8+i*2,i+1,true);
 const original=bytes.slice(partyAt,partyAt+16),otherHeader=bytes.slice(second,second+40);
 const reader=await new GbaMaps(bytes).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const root=graph.roots.find(x=>x.kind==='npcs'&&x.mapKey==='0.0');
 const project=newProject('Real native trainer event'),map=project.maps[0];
 map.rom={sourceId:HASH,key:'0.0',engine:'frlg'};
 map.markers=[{id:'original-trainer',kind:'npc',title:'Original trainer',x:2,y:2,
  rom:{type:'npc',index:root.index,localId:1}}];
 const preview=previewNativeVisualImport(project,HASH,graph,root);
 assert.equal(preview.supported,true,preview.reason);
 const {marker}=applyNativeVisualImport(project,HASH,graph,root,()=> 'native-step');
 assert.equal(marker.runtime.steps[0].trainerId,trainerId);
 const team={customMoves:true,heldItems:true,party:[{ivQuality:55,level:35,species:150,heldItem:14,moves:[9,10,11,12]}]};
 editsFor(project,HASH,true).trainers[trainerId]=team;
 const context={reader:{bytes},hash:HASH,profile,data:{trainers:Array.from({length:30},(_,id)=>({id,name:'Trainer '+id,party:id===trainerId?team.party:[],customMoves:true,heldItems:true}))}};
 assert.equal(inspectTrainerBattle(context,project,trainerId).party[0].level,35);
 const reopening=JSON.parse(JSON.stringify(project)),recovered=reopening.maps[0].markers[0];
 const updatedScript=sceneSource(recovered,{project:reopening,map:reopening.maps[0],gameProfile:{engine:'frlg',trainerCount:30}});
 const out=new RomOutput(bytes),compiled=compileScript(updatedScript,0x6000,'frlg');
 out.write(0x6000,compiled.bytes);
 out.int(root.reference,BASE+0x6000);
 const encoded=encodeTrainerParty(bytes,profile,trainerId,team),newAddress=out.allocate(encoded.bytes,'Trainer party');
 const header=bytes.slice(first,first+40),hv=new DataView(header.buffer);
 header[0]=encoded.flags;header[32]=encoded.count;hv.setUint32(36,BASE+newAddress,true);out.write(first,header);
 assert.deepEqual([...out.bytes.slice(partyAt,partyAt+16)],[...original],'shared original party data is immutable');
 assert.deepEqual([...out.bytes.slice(second,second+40)],[...otherHeader],'another trainer header is unaffected');
 assert.equal(new DataView(out.bytes.buffer).getUint32(first+36,true),BASE+newAddress);
 assert.equal(new DataView(out.bytes.buffer).getUint16(newAddress+4,true),150);
 assert.equal(out.bytes[newAddress+2],35);
 const updated=await indexNativeStory(await new GbaMaps(out.bytes).discover(),{mapKeys:['0.0']});
 const battle=Object.values(updated.nodes).find(n=>n.code===92&&n.at>=0x6000&&n.args[1]?.value===23);
 assert.ok(battle,'native compiled trainerbattle still resolves the original slot');
 assert.equal(battle.args[2].value,0,'original script local ID zero is preserved');
 assert.ok(Object.values(updated.texts).some(t=>t.text==='Battle now.'));
});
test('scene and Game Workshop use the verified source and return to unsaved action after team save',()=>{
 const scene=readFileSync(new URL('../dist/scene-ui.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../dist/game-ui.js',import.meta.url),'utf8');
 assert.match(scene,/id="sceneEditTrainerTeam"/);
 assert.match(scene,/collectAction\(\);\s*try\{const sourceId=/);
 assert.match(scene,/expectedSourceId:sourceId/);
 assert.match(scene,/onSaved:\(\)=>\{api\.close\(\);editAction\(s,back\);\}/);
 assert.match(ui,/inspectTrainerBattle\(c,api\.project\(\),id\)/);
 assert.match(ui,/expectedSourceId&&session\.id!==expectedSourceId/);
 assert.match(ui,/if\(onSaved\)\{onSaved\(\);return false;\}/);
});

test('original ROM story resolves only one reachable standard trainerbattle slot, respecting command edits',()=>{
 const a=0x5000,b=0x5008,root={id:'npc01',kind:'npcs',address:a};
 const graph={nodes:{[a]:{at:a,code:92,args:[{value:1},{value:23}],edges:[]}},edits:{commands:{},flows:{}}};
 assert.equal(nativeStoryTrainerSlot(graph,root),23);
 graph.edits.commands[a]={args:[1,24]};
 assert.equal(nativeStoryTrainerSlot(graph,root),24,'uses pending original native command edit');
 graph.edits.commands[a]={args:[4,24]};
 assert.equal(nativeStoryTrainerSlot(graph,root),null,'unsupported native battle type cannot be assumed safe');
 graph.edits.commands[a]={args:[1,24]};
 graph.nodes[b]={at:b,code:92,args:[{value:1},{value:25}],edges:[]};
 graph.nodes[a].edges=[{to:b,kind:'next',field:a+0x1000}]; // Ordinary fallthrough is not an editable pointer argument.
 assert.equal(nativeStoryTrainerSlot(graph,root),null,'multiple distinct trainer teams are ambiguous');
 graph.edits.commands[b]={args:[1,24]};
 assert.equal(nativeStoryTrainerSlot(graph,root),24,'multiple references to one team are unambiguous');
 graph.edits.flows.npc01={steps:[]};
 assert.equal(nativeStoryTrainerSlot(graph,root),null,'authored replacement has different script semantics');
 delete graph.edits.flows.npc01;
 assert.equal(nativeStoryTrainerSlot(graph,{...root,kind:'signs'}),null,'ordinary sign is not a trainer NPC event');
});
test('native story inspector exposes original trainer team navigation without converting native event scripts',()=>{
 const ui=readFileSync(new URL('../dist/native-story-ui.js',import.meta.url),'utf8');
 assert.match(ui,/nativeStoryTrainerSlot\(g,root\)/);
 assert.match(ui,/id="nativeStoryTrainerTeam"/);
 assert.match(ui,/disabled=linkedTrainer===null/);
 assert.match(ui,/openTrainer\(linkedTrainer,\{expectedSourceId:session\(\)\.id\}\)/);
 assert.match(ui,/Trainer sight &amp; patrol/,'existing native NPC movement controls retained');
});
