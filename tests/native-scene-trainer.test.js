import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {compileScript} from '../dist/script-engine.js';
import {indexNativeStory} from '../dist/native-story.js';
import {newProject,validateProject} from '../dist/model.js';
import {sceneIssues} from '../dist/authoring-model.js';
import {sceneSource} from '../dist/scene-compiler.js';
import {previewNativeVisualImport,applyNativeVisualImport} from '../dist/native-scene-import.js';
import {nativeTrainerId,nativeTrainerLocalId,nativeTrainerFlagSource,applyNativeTrainerFlagPreview} from '../dist/native-trainer-bridge.js';
import {cloneSceneForNewEvent,enableScenePages,addScenePage} from '../dist/scene-pages.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {RomOutput} from '../dist/rom-writer.js';
const BASE=0x08000000;
let serial=0;const uid=()=> 'trainer-source-'+(++serial);
const BATTLE='@start:\nlockall\ntrainerbattle 1 23 0 @intro @defeat @after\n@after:\nsettrainerflag 23\ncleartrainerflag 24\nreleaseall\nend\n@intro:\n= I challenge you!$\n@defeat:\n= You beat me.$\n';
async function fixture(script=BATTLE){
 const bytes=syntheticROM(),dv=new DataView(bytes.buffer);
 bytes.set(compileScript(script,0x5000,'frlg').bytes,0x5000);
 bytes[0x3000]=2;dv.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<2;i++){bytes[0x3200+i*24]=i+1;dv.setInt16(0x3204+i*24,2+i,true);dv.setInt16(0x3206+i*24,2,true);dv.setUint32(0x3210+i*24,BASE+0x5000,true);}
 const reader=await new GbaMaps(bytes).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const roots=graph.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 const project=newProject('Native trainer fixture'),map=project.maps[0];
 map.rom={sourceId:'trainer-fixture',key:'0.0',engine:'frlg'};
 map.markers=roots.map((r,i)=>({id:'npc-'+i,title:'Trainer '+i,text:'Original imported trainer.',x:i+2,y:2,kind:'npc',rom:{type:'npc',index:i,localId:i+1}}));
 project.nativeStory={'trainer-fixture':graph};
 return{bytes,reader,graph,roots,project,map};
}
function reopen(project){const plan=planSave(project),data=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));return assembleSavedProject(plan.header,savedProjectKeys(plan.header).map(k=>data.get(k)));}
test('standard native trainer battle, original local ID and explicit defeated-state changes survive export and native reindex',async()=>{
 const f=await fixture(),before=structuredClone(f.project),draft=previewNativeVisualImport(f.project,'trainer-fixture',f.graph,f.roots[0],{newId:uid});
 assert.equal(draft.supported,true,draft.reason);
 assert.deepEqual(draft.steps.map(s=>s.type),['battle','nativeTrainerFlag','nativeTrainerFlag']);
 assert.deepEqual([draft.steps[0].trainerId,draft.steps[0].nativeLocalId,draft.steps[0].intro,draft.steps[0].defeat],[23,0,'I challenge you!','You beat me.']);
 assert.deepEqual(draft.steps.slice(1).map(s=>[s.trainerId,s.value]),[[23,true],[24,false]]);
 assert.deepEqual(f.project,before);
 const {marker}=applyNativeVisualImport(f.project,'trainer-fixture',f.graph,f.roots[0],uid);
 assert.equal(f.map.markers[1].runtime,undefined);
 assert.deepEqual(sceneIssues(marker,f.project,f.map),[]);
 validateProject(f.project);
 const project=reopen(f.project),scene=project.maps[0].markers[0];
 assert.equal(scene.runtime.steps[0].nativeLocalId,0);
 assert.equal(scene.runtime.steps[0].trainerId,23);
 const script=sceneSource(scene,{project,map:project.maps[0],gameProfile:{engine:'frlg',trainerCount:200}});
 assert.match(script,/trainerbattle 1 23 0 /);
 assert.match(script,/settrainerflag 23/);
 assert.match(script,/cleartrainerflag 24/);
 const output=new RomOutput(f.bytes);
 output.write(0x6000,compileScript(script,0x6000,'frlg').bytes);
 output.int(f.roots[0].reference,BASE+0x6000);
 const indexed=await indexNativeStory(await new GbaMaps(output.bytes).discover(),{mapKeys:['0.0']});
 const roots=indexed.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(roots[0].address,0x6000);assert.equal(roots[1].address,0x5000);
 const battle=Object.values(indexed.nodes).find(n=>n.code===92&&n.args[1].value===23&&n.at>=0x6000);
 assert.ok(battle);assert.equal(battle.args[0].value,1);assert.equal(battle.args[2].value,0);
 assert.equal(battle.args[5].value,BASE+battle.end,'post-battle continuation stays in the new visual script');
 assert.ok(Object.values(indexed.nodes).some(n=>n.code===97&&n.args[0].value===23));
 assert.ok(Object.values(indexed.nodes).some(n=>n.code===98&&n.args[0].value===24));
 assert.ok(Object.values(indexed.texts).some(t=>t.text==='I challenge you!'));
 assert.ok(Object.values(indexed.texts).some(t=>t.text==='You beat me.'));
 assert.deepEqual(Array.from(output.bytes.slice(0x5000,0x5018)),Array.from(f.bytes.slice(0x5000,0x5018)));
 const clone=cloneSceneForNewEvent(scene,uid);
 assert.equal(clone.runtime.steps[0].nativeLocalId,undefined,'cloning clears original script-local identity');
 assert.equal(scene.runtime.steps[0].nativeLocalId,0,'original remains unaltered');
});
test('unsupported trainerbattle variants and detached post-battle scripts stay native, without mutating imported event',async()=>{
 const scripts=[
 '@start:\ntrainerbattle 0 23 0 @intro @defeat\nend\n@intro:\n= Challenge.$\n@defeat:\n= Lost.$\n',
 '@start:\ntrainerbattle 1 23 0 @intro @defeat @post\nend\n@post:\nreleaseall\nend\n@intro:\n= Challenge.$\n@defeat:\n= Lost.$\n'
 ];
 for(const script of scripts){
  const f=await fixture(script),before=JSON.stringify(f.project);
  const preview=previewNativeVisualImport(f.project,'trainer-fixture',f.graph,f.roots[0],{newId:uid});
  assert.equal(preview.supported,false);
  assert.match(preview.reason,/trainer battle variant|continuation|native/i);
  assert.throws(()=>applyNativeVisualImport(f.project,'trainer-fixture',f.graph,f.roots[0],uid));
  assert.equal(JSON.stringify(f.project),before);
 }
 const f=await fixture();
 const battle=Object.values(f.graph.nodes).find(n=>n.code===92);
 delete f.graph.texts[battle.args[4].value-BASE];
 const preview=previewNativeVisualImport(f.project,'trainer-fixture',f.graph,f.roots[0],{newId:uid});
 assert.equal(preview.supported,false);assert.match(preview.reason,/dialogue bytes/);
});
test('trainer identifiers, defeated state preview and invalid source local parameters fail closed',async()=>{
 for(const invalid of [null,undefined,-1,0,65536,1.5,'','0x17','-1']){
  assert.throws(()=>nativeTrainerId(invalid),/Original ROM trainer ID/);
 }
 assert.equal(nativeTrainerId('65535'),65535);
 assert.equal(nativeTrainerLocalId(0),0);
 assert.throws(()=>nativeTrainerLocalId(65536),/Native trainer local ID/);
 const original=new Set([23]),defeated=applyNativeTrainerFlagPreview({trainerId:24,value:true},original);
 assert.deepEqual([...original],[23]);assert.deepEqual([...defeated].sort((a,b)=>a-b),[23,24]);
 const reset=applyNativeTrainerFlagPreview({trainerId:23,value:false},defeated);
 assert.equal(reset.has(23),false);assert.equal(defeated.has(23),true);
 assert.equal(nativeTrainerFlagSource({trainerId:23,value:false}),'cleartrainerflag 23');
 const f=await fixture();const {marker}=applyNativeVisualImport(f.project,'trainer-fixture',f.graph,f.roots[0],uid);
 marker.runtime.steps[0].nativeLocalId=65536;
 assert.ok(sceneIssues(marker,f.project,f.map).some(x=>/local ID/.test(x.message)));
 assert.throws(()=>sceneSource(marker,{project:f.project,map:f.map,gameProfile:{engine:'frlg',trainerCount:200}}),/local ID/);
 marker.runtime.steps[0].nativeLocalId=0;marker.runtime.steps[1].trainerId=500;
 assert.throws(()=>sceneSource(marker,{project:f.project,map:f.map,gameProfile:{engine:'frlg',trainerCount:200}}),/opened ROM/);
});
test('Android-first scene inspector exposes native trainer status, battle messages and source local ID review',()=>{
 const ui=readFileSync(new URL('../dist/scene-ui.js',import.meta.url),'utf8');
 assert.match(ui,/nativeTrainerFlag:'Set \/ clear trainer defeated state'/);
 assert.match(ui,/Original trainer local ID/);
 assert.match(ui,/Mark trainer defeated/);
 assert.match(ui,/applyNativeTrainerFlagPreview\(s,p\.trainerFlags\)/);
 assert.match(ui,/does not simulate winning/);
});

test('same-NPC page copies retain the source trainer parameter, while new-NPC scenes rebind',async()=>{
 const f=await fixture(),{marker}=applyNativeVisualImport(f.project,'trainer-fixture',f.graph,f.roots[0],uid);
 enableScenePages(marker.runtime,uid);
 assert.equal(marker.runtime.pages[0].steps[0].nativeLocalId,0);
 const page=addScenePage(marker.runtime,uid,marker.runtime.pages[0]);
 assert.equal(page.steps[0].nativeLocalId,0,'same-event page copy must not alter the battle parameter');
 const cloned=cloneSceneForNewEvent(marker,uid);
 assert.equal(cloned.runtime.pages[0].steps[0].nativeLocalId,undefined);
 assert.equal(cloned.runtime.pages[1].steps[0].nativeLocalId,undefined);
 assert.equal(marker.runtime.pages[0].steps[0].nativeLocalId,0);
 assert.equal(marker.runtime.pages[1].steps[0].nativeLocalId,0);
});
