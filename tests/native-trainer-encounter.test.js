import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {newProject,validateProject} from '../dist/model.js';
import {readTrainerEncounter,validateTrainerEncounter,stageTrainerEncounter,applyTrainerEncounters} from '../dist/native-trainer-encounter.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {RomOutput,installEvents} from '../dist/rom-writer.js';
const BASE=0x08000000;
async function fixture(){
 const bytes=syntheticROM(),v=new DataView(bytes.buffer);
 bytes[0x3000]=2;v.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<2;i++){const at=0x3200+i*24;
  bytes[at]=i+1;bytes[at+2]=0;v.setInt16(at+4,4+i,true);v.setInt16(at+6,3,true);bytes[at+9]=8;
  bytes[at+10]=0x21;bytes[at+11]=0xa5;v.setUint16(at+12,1,true);v.setUint16(at+14,3+i,true);
  v.setUint32(at+16,BASE+0x5000,true);v.setUint16(at+20,100+i,true);
 }
 const reader=await new GbaMaps(bytes).discover(),native=reader.byKey('0.0'),current=reader.events(native);
 const project=newProject('Original sight and patrol'),map=project.maps[0];map.rom={sourceId:'source-sha-abc',key:native.key,engine:reader.engine};
 map.markers=current.npcs.map((r,i)=>({id:'npc-'+i,kind:'npc',title:'Source trainer '+i,text:'Native NPC.',x:r.x,y:r.y,rom:{type:'npc',...r}}));
 return{bytes,reader,native,project,map,current,roots:current.npcs.map(r=>({kind:'npcs',mapKey:native.key,index:r.index}))};
}
function reopen(project){const p=planSave(project),data=new Map(p.parts.map(x=>[x.id,structuredClone(x.value)]));return assembleSavedProject(p.header,savedProjectKeys(p.header).map(k=>data.get(k)));}
test('native trainer record bitfields round-trip through project save, export and ROM reindex',async()=>{
 const f=await fixture(),record=f.bytes.slice(0x3200,0x3218),initial=readTrainerEncounter(record);
 assert.deepEqual([initial.localId,initial.trainerType,initial.sightRange,initial.rangeX,initial.rangeY],[1,1,3,1,2]);
 assert.equal(record[11],0xa5);
 const staged=stageTrainerEncounter(f.project,f.reader,'source-sha-abc',f.roots[0],{trainerType:2,sightRange:10,rangeX:4,rangeY:5});
 assert.equal(f.map.markers[0].rom.trainerEncounter,undefined,'staging is read-only');
 f.map.markers[0].rom.trainerEncounter=staged.edit;
 validateProject(f.project);
 const restored=reopen(f.project),events={npcs:f.current.npcs.map(e=>f.bytes.slice(e.address,e.address+24)),warps:[],signs:[],triggers:[]};
 assert.equal(applyTrainerEncounters(f.reader,f.native,restored.maps[0],events,'source-sha-abc'),true);
 assert.deepEqual(Array.from(events.npcs[0].slice(10,16)),[0x54,0xa5,2,0,10,0]);
 assert.deepEqual(Array.from(events.npcs[1]),Array.from(f.bytes.slice(0x3218,0x3230)));
 const output=new RomOutput(f.bytes);installEvents(output,f.native,events);
 const reread=await new GbaMaps(output.bytes).discover(),actual=reread.events(reread.byKey('0.0')).npcs;
 assert.equal(actual[0].trainerType,2);assert.equal(actual[0].sightRange,10);
 assert.deepEqual([actual[0].rangeX,actual[0].rangeY],[4,5]);
 assert.equal(actual[0].localId,1);assert.equal(actual[1].sightRange,4);
 assert.equal(actual[0].script,0x5000);
});
test('malformed second trainer cannot cause partially committed first edit',async()=>{
 const f=await fixture(),events={npcs:f.current.npcs.map(e=>f.bytes.slice(e.address,e.address+24))};
 const first=stageTrainerEncounter(f.project,f.reader,'source-sha-abc',f.roots[0],{trainerType:1,sightRange:7,rangeX:1,rangeY:1});
 const second=stageTrainerEncounter(f.project,f.reader,'source-sha-abc',f.roots[1],{trainerType:1,sightRange:9,rangeX:2,rangeY:2});
 f.map.markers[0].rom.trainerEncounter=first.edit;
 f.map.markers[1].rom.trainerEncounter=second.edit;
 const before=events.npcs.map(x=>Array.from(x));
 f.map.markers[1].rom.trainerEncounter.before[9]^=2;
 assert.throws(()=>applyTrainerEncounters(f.reader,f.native,f.map,events,'source-sha-abc'),/source bytes changed/);
 assert.deepEqual(events.npcs.map(x=>Array.from(x)),before);
 f.map.markers[1].rom.trainerEncounter.before[9]^=2;
 f.map.markers[1].rom.trainerEncounter.after.sightRange=100;
 assert.throws(()=>applyTrainerEncounters(f.reader,f.native,f.map,events,'source-sha-abc'),/Trainer sight distance/);
 assert.deepEqual(events.npcs.map(x=>Array.from(x)),before);
 assert.throws(()=>applyTrainerEncounters(f.reader,f.native,f.map,events,'different-sha'),/original source map/);
});
test('original non-trainer records, nonstandard unions and invalid values fail closed',async()=>{
 const f=await fixture(),original=f.bytes.slice(0x3200,0x3218);
 for(const x of [{trainerType:3,sightRange:3,rangeX:1,rangeY:1},{trainerType:1,sightRange:0,rangeX:1,rangeY:1},{trainerType:1,sightRange:3,rangeX:16,rangeY:1},{trainerType:1,sightRange:3,rangeX:1,rangeY:1.5}])assert.throws(()=>validateTrainerEncounter(x),/whole number/);
 original[2]=1;assert.throws(()=>readTrainerEncounter(original),/nonstandard/);
 f.bytes[0x3202]=1;
 assert.throws(()=>stageTrainerEncounter(f.project,f.reader,'source-sha-abc',f.roots[0],{trainerType:1,sightRange:3,rangeX:1,rangeY:1}),/nonstandard/);
 f.bytes[0x3202]=0;f.bytes[0x320c]=0;f.bytes[0x320d]=0;
 assert.throws(()=>stageTrainerEncounter(f.project,f.reader,'source-sha-abc',f.roots[0],{trainerType:1,sightRange:3,rangeX:1,rangeY:1}),/not a standard trainer/);
});
test('native story editor exposes encounter settings and guarded exporter',()=>{
 const ui=readFileSync(new URL('../dist/native-story-ui.js',import.meta.url),'utf8'),dialog=readFileSync(new URL('../dist/native-trainer-encounter-ui.js',import.meta.url),'utf8'),writer=readFileSync(new URL('../dist/rom-writer.js',import.meta.url),'utf8');
 assert.match(ui,/id="nativeStoryTrainer"/);assert.match(ui,/openNativeTrainerEncounter\(api,root,draw\)/);
 assert.match(dialog,/nativeTrainerSight/);assert.match(dialog,/nativeTrainerX/);assert.match(dialog,/nativeTrainerY/);
 assert.match(writer,/encounterChanged=applyTrainerEncounters/);
});
