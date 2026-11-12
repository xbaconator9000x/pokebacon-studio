import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {compileScript} from '../dist/script-engine.js';
import {indexNativeStory} from '../dist/native-story.js';
import {newProject,validateProject} from '../dist/model.js';
import {sceneActions,sceneIssues} from '../dist/authoring-model.js';
import {sceneSource} from '../dist/scene-compiler.js';
import {sceneOutline} from '../dist/scene-outline.js';
import {previewNativeVisualImport,applyNativeVisualImport} from '../dist/native-scene-import.js';
import {nativeMovementIssues,decodeNativeMovement,nativeMovementDisplay} from '../dist/native-movement-bridge.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {RomOutput} from '../dist/rom-writer.js';
const BASE=0x08000000;
let seq=0;const uid=()=> 'native-branch-'+(++seq);
const code=lines=>lines.join('\n')+'\n';
const DIAMOND=code([
 '@start:','lockall','checkflag 0x200','goto_if 1 @haskey','msgbox @need 4','goto @join',
 '@haskey:','applymovement 254 @motion','waitmovement 254','msgbox @done 6','@join:','releaseall','end',
 '@motion:','walk_up','face_right','walk_fast_left','set_visible','step_end',
 '@need:','= Find the Aipom key.$','@done:','= Thank you for the key.$'
]);
async function fixture(script=DIAMOND,{copies=2}={}){
 const source=syntheticROM(),dv=new DataView(source.buffer);
 source.set(compileScript(script,0x5000,'frlg').bytes,0x5000);
 source[0x3000]=copies;dv.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<copies;i++){source[0x3200+i*24]=i+1;dv.setInt16(0x3204+i*24,i+2,true);dv.setInt16(0x3206+i*24,2,true);dv.setUint32(0x3210+i*24,BASE+0x5000,true);}
 const reader=await new GbaMaps(source).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const roots=graph.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 const project=newProject('Movement and source-flag conversion'),map=project.maps[0];
 map.name='Viridian gate';map.rom={sourceId:'native-test',key:'0.0',engine:'frlg'};
 map.markers=roots.map((root,i)=>({id:'original-'+i,title:'Gate keeper '+(i+1),x:i+2,y:2,kind:'npc',rom:{type:'npc',index:i,localId:i+1}}));
 project.nativeStory={'native-test':graph};
 return{project,map,reader,graph,roots,source};
}
function restored(project){
 const saved=planSave(project),parts=new Map(saved.parts.map(x=>[x.id,structuredClone(x.value)]));
 return assembleSavedProject(saved.header,savedProjectKeys(saved.header).map(k=>parts.get(k)));
}
test('guarded source-native checkflag diamond converts to editable nested if/else, movement and two message modes',async()=>{
 const {project,map,graph,roots}=await fixture(),root=roots[0];
 const before=structuredClone(project),preview=previewNativeVisualImport(project,'native-test',graph,root,{newId:uid});
 assert.equal(preview.supported,true,preview.reason);
 assert.deepEqual(project,before,'native read-only preview must not change project');
 assert.deepEqual(preview.steps.map(s=>s.type),['nativeFlagIf']);
 const branch=preview.steps[0];
 assert.equal(branch.nativeFlagId,0x200);
 assert.deepEqual(branch.else.map(s=>s.type),['say']);
 assert.deepEqual(branch.then.map(s=>s.type),['nativeMovement','say']);
 assert.equal(branch.else[0].text,'Find the Aipom key.');
 assert.equal(branch.else[0].messageType,4);
 assert.equal(branch.then[1].text,'Thank you for the key.');
 assert.equal(branch.then[1].messageType,6);
 assert.equal(branch.then[0].actorId,'self');
 assert.equal(branch.then[0].wait,true);
 assert.deepEqual(branch.then[0].moves,['walk_up','face_right','walk_fast_left','set_visible']);
 const applied=applyNativeVisualImport(project,'native-test',graph,root,uid);
 assert.equal(applied.marker.id,'original-0');
 assert.equal(project.maps[0].markers[1].runtime,undefined);
 assert.deepEqual(sceneIssues(applied.marker,project,map),[]);
 const pages=sceneOutline(applied.marker.runtime);
 assert.ok(pages.some(r=>r.kind==='branch'&&r.label==='Conditions met'));
 assert.ok(pages.some(r=>r.kind==='branch'&&r.label==='Otherwise'));
 assert.deepEqual(sceneActions(applied.marker).map(s=>s.type),['nativeFlagIf','nativeMovement','say','say']);
 validateProject(project);
 const reopen=restored(project),actual=reopen.maps[0].markers[0];
 assert.equal(actual.runtime.steps[0].nativeFlagId,512);
 assert.deepEqual(actual.runtime.steps[0].then[0].moves,branch.then[0].moves);
 assert.equal(reopen.maps[0].markers[1].runtime,undefined);
});
test('compiled imported raw ROM flag/branch and movement bytes survive native GBA reindex while shared original stays live',async()=>{
 const {project,map,graph,roots,source}=await fixture();
 const {marker}=applyNativeVisualImport(project,'native-test',graph,roots[0],uid);
 const script=sceneSource(marker,{project,map,gameProfile:{engine:'frlg',speciesCount:500,itemCount:500,trainerCount:500}});
 assert.match(script,/checkflag 512/);assert.match(script,/goto_if 1 @/);
 assert.match(script,/walk_fast_left/);assert.match(script,/face_right/);assert.match(script,/set_visible/);
 const patched=new RomOutput(source);patched.write(0x6000,compileScript(script,0x6000,'frlg').bytes);
 patched.int(roots[0].reference,BASE+0x6000);
 const post=await indexNativeStory(await new GbaMaps(patched.bytes).discover(),{mapKeys:['0.0']});
 const entries=post.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(entries[0].address,0x6000);assert.equal(entries[1].address,0x5000);
 assert.ok(Object.values(post.nodes).some(n=>n.code===43&&n.args[0].value===512));
 assert.ok(Object.values(post.nodes).some(n=>n.code===6&&n.args[0].value===1));
 const rebuilt=Object.values(post.movements).find(m=>m.bytes.length===5&&m.bytes.at(-1)===254);
 assert.ok(rebuilt,'native movement bytes should be present after export');
 assert.deepEqual(decodeNativeMovement(rebuilt.bytes),['walk_up','face_right','walk_fast_left','set_visible']);
 assert.ok(Object.values(post.texts).some(t=>t.text==='Find the Aipom key.'));
 assert.ok(Object.values(post.texts).some(t=>t.text==='Thank you for the key.'));
 assert.deepEqual(source.slice(0x5000,0x5060),patched.bytes.slice(0x5000,0x5060),'original shared script retained byte-for-byte');
});
test('native movement imported without wait stays nonblocking and can target a different indexed NPC',async()=>{
 const script=code(['@start:','applymovement 2 @mov','msgbox @text 4','end','@mov:','walk_slow_up','walk_faster_right','face_down','step_end','@text:','= Excuse me.$']);
 const {project,map,graph,roots}=await fixture(script);
 const preview=previewNativeVisualImport(project,'native-test',graph,roots[0],{newId:uid});
 assert.equal(preview.supported,true,preview.reason);
 assert.equal(preview.steps[0].actorId,'original-1');assert.equal(preview.steps[0].wait,false);
 assert.deepEqual(preview.steps[0].moves,['walk_slow_up','walk_faster_right','face_down']);
 const marker=applyNativeVisualImport(project,'native-test',graph,roots[0],uid).marker;
 assert.deepEqual(sceneIssues(marker,project,map),[]);
 const result=sceneSource(marker,{project,map,gameProfile:{engine:'frlg'}});
 assert.match(result,/applymovement 2 @/);assert.doesNotMatch(result,/waitmovement 2/);
 assert.ok(compileScript(result,0x6000,'frlg').bytes.length>0);
});
test('native movement schema accepts only reversible motion byte streams',()=>{
 assert.deepEqual(nativeMovementIssues(['walk_fast_up','face_left','set_invisible']),[]);
 assert.equal(nativeMovementDisplay(['walk_fast_up','face_left']),'walk fast up · face left');
 for(const data of [[],Array(129).fill('walk_up'),['jump_2_up'],['fly_up'],['set_facing_up'],[null]])assert.ok(nativeMovementIssues(data).length);
 assert.throws(()=>decodeNativeMovement([16,17]),/terminator/);
 assert.throws(()=>decodeNativeMovement([16,254,17,254]),/terminator/);
 assert.throws(()=>decodeNativeMovement([255,254]),/verified/);
 assert.deepEqual(decodeNativeMovement([16,1,254]),['walk_down','face_up']);
});
test('unstructured native branches and unsafe movement are rejected without source or project mutation',async()=>{
 const failures=[
 [code(['@start:','checkflag 0x200','goto_if 5 @yes','msgbox @no 4','goto @join','@yes:','msgbox @yesText 4','@join:','end','@no:','= no.$','@yesText:','= yes.$']),/explicit checkflag/],
 [code(['@start:','checkflag 0x200','goto_if 1 @yes','msgbox @no 4','end','@yes:','msgbox @yesText 4','end','@no:','= no.$','@yesText:','= yes.$']),/bounded if\/else|verified branch/],
 [code(['@start:','applymovement 254 @mov','waitmovement 255','end','@mov:','walk_up','step_end']),/waitmovement targets a different NPC/],
 [code(['@start:','applymovement 254 @mov','waitmovement 254','end','@mov:','jump_2_up','step_end']),/not a verified walk/]
 ];
 for(const [script,reason]of failures){
  const {project,graph,roots}=await fixture(script),snapshot=JSON.stringify(project);
  const trial=previewNativeVisualImport(project,'native-test',graph,roots[0],{newId:uid});
  assert.equal(trial.supported,false,script);
  assert.match(trial.reason,reason);
  assert.throws(()=>applyNativeVisualImport(project,'native-test',graph,roots[0],uid));
  assert.equal(JSON.stringify(project),snapshot);
 }
});
test('raw engine flag ID is separate from saved project quest bits, with u16 validation',async()=>{
 const {project,map,graph,roots}=await fixture();
 const {marker}=applyNativeVisualImport(project,'native-test',graph,roots[0],uid);
 const original=marker.runtime.steps[0],savedId=original.nativeFlagId;
 assert.equal(savedId,512);
 assert.equal((project.questFlags||[]).some(f=>f.slot===512),false);
 for(const invalid of [-1,65536,NaN]){
  original.nativeFlagId=invalid;
  assert.ok(sceneIssues(marker,project,map).some(x=>/source-ROM flag ID/.test(x.message)));
  assert.throws(()=>sceneSource(marker,{project,map,gameProfile:{engine:'frlg'}}));
 }
 original.nativeFlagId=savedId;
 assert.deepEqual(sceneIssues(marker,project,map),[]);
});
