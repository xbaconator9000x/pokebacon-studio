import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {compileScript} from '../dist/script-engine.js';
import {indexNativeStory,installNativeStoryEdits} from '../dist/native-story.js';
import {createStoryFlow} from '../dist/story-flow.js';
import {newProject,validateProject} from '../dist/model.js';
import {sceneIssues} from '../dist/authoring-model.js';
import {sceneSource} from '../dist/scene-compiler.js';
import {previewNativeVisualImport,applyNativeVisualImport} from '../dist/native-scene-import.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {RomOutput} from '../dist/rom-writer.js';

const BASE=0x08000000;
let seq=0;const id=()=> 'imported-native-'+(++seq);
async function fixture({script='@start:\nlockall\nmsgbox @text 6\nplayse 5\nwaitse\npause 20\nplaybgm 12 0\nfadescreen 1\nreleaseall\nend\n@text:\n= Guard: The key is missing.$\n',type='npc',copies=2}={}){
 const bytes=syntheticROM(),v=new DataView(bytes.buffer);
 const compiled=compileScript(script,0x5000,'frlg');bytes.set(compiled.bytes,0x5000);
 bytes[0x3000]=copies;v.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<copies;i++){bytes[0x3200+i*24]=i+1;v.setInt16(0x3204+i*24,i+2,true);v.setInt16(0x3206+i*24,2,true);v.setUint32(0x3210+i*24,BASE+0x5000,true);}
 const reader=await new GbaMaps(bytes).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const roots=graph.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 const project=newProject('Converted Shattered gate'),map=project.maps[0];map.rom={sourceId:'fixture',key:'0.0',engine:'frlg'};map.name='Victory Road';
 map.markers=roots.map((r,i)=>({id:'guard-'+i,title:'Gate guard '+(i+1),kind:'npc',x:i+2,y:2,rom:{type:'npc',index:i,localId:i+1,script:0x5000},text:'Imported native script.'}));
 project.nativeStory={fixture:graph};return{project,map,reader,graph,roots,bytes};
}
async function reopen(project){
 const p=planSave(project),data=new Map(p.parts.map(p=>[p.id,structuredClone(p.value)]));
 return assembleSavedProject(structuredClone(p.header),savedProjectKeys(p.header).map(k=>data.get(k)));
}
test('native ROM event imports to editable visual dialogue, wait, SFX, BGM and fade, with original NPC binding',async()=>{
 const {project,map,reader,graph,roots,bytes}=await fixture(),root=roots[0],snapshot=structuredClone(project);
 const prev=previewNativeVisualImport(project,'fixture',graph,root,{newId:id});
 assert.equal(prev.supported,true,prev.reason);
 assert.deepEqual(prev.steps.map(s=>s.type),['say','sound','wait','music','fade']);
 assert.equal(prev.steps[0].text,'Guard: The key is missing.');
 assert.equal(prev.steps[0].messageType,6);
 assert.equal(prev.steps[1].soundId,5);
 assert.equal(prev.steps[1].wait,true);
 assert.equal(prev.steps[2].frames,20);
 assert.equal(prev.steps[3].songId,12);
 assert.equal(prev.steps[4].mode,1);
 assert.deepEqual(project,snapshot,'preview must leave project and source edits intact');
 const imported=applyNativeVisualImport(project,'fixture',graph,root,id);
 assert.equal(imported.marker.id,'guard-0');
 assert.equal(imported.marker.rom.index,0);
 assert.equal(imported.marker.runtime.importedNative.rootId,root.id);
 assert.equal(map.markers[1].runtime,undefined,'another NPC sharing the native script remains native');
 assert.deepEqual(sceneIssues(imported.marker,project,map),[]);
 validateProject(project);
 const restored=await reopen(project),scene=restored.maps[0].markers[0];
 assert.equal(scene.runtime.steps[0].messageType,6);
 assert.equal(scene.runtime.importedNative.address,root.address);
 const nativeSource=sceneSource(scene,{project:restored,map:restored.maps[0],gameProfile:{engine:'frlg',speciesCount:500,itemCount:500,trainerCount:500}});
 const compiled=compileScript(nativeSource,0x6000,'frlg'),output=new RomOutput(bytes);
 output.write(0x6000,compiled.bytes);
 output.int(roots[0].reference,BASE+0x6000);
 const exported=await new GbaMaps(output.bytes).discover(),fresh=await indexNativeStory(exported,{mapKeys:['0.0']});
 const post=fresh.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(post[0].address,0x6000);
 assert.equal(post[1].address,0x5000);
 assert.ok(Object.values(fresh.texts).some(t=>t.text==='Guard: The key is missing.'));
 assert.ok([...Object.values(fresh.nodes)].some(n=>n.code===9&&n.args[0].value===6));
 assert.ok([...Object.values(fresh.nodes)].some(n=>n.code===47&&n.args[0].value===5));
 assert.ok([...Object.values(fresh.nodes)].some(n=>n.code===40&&n.args[0].value===20));
 assert.ok([...Object.values(fresh.nodes)].some(n=>n.code===51&&n.args[0].value===12));
 assert.ok([...Object.values(fresh.nodes)].some(n=>n.code===151&&n.args[0].value===1));
 assert.equal(output.bytes[0x5000],bytes[0x5000],'source script remains available for second original root');
});
test('native conversion refuses branches, trainer battles, unknown commands, custom flags and already-authored scenes, without mutation',async()=>{
 const scripts=[
  '@start:\nsetvar 0x8000 1\nend\n',
  '@start:\ncall @extra\nend\n@extra:\nend\n',
  '@start:\ncheckflag 0x200\nend\n',
  '@start:\ntrainerbattle 0 1 1 @text @text\nend\n@text:\n= Hello.$\n'
 ];
 for(const script of scripts){
  const {project,graph,roots}=await fixture({script}),before=JSON.stringify(project);
  const prev=previewNativeVisualImport(project,'fixture',graph,roots[0],{newId:id});
  assert.equal(prev.supported,false);
  assert.match(prev.reason,/native|unverified|unsupported|original|branch|convert/i);
  assert.throws(()=>applyNativeVisualImport(project,'fixture',graph,roots[0],id));
  assert.equal(JSON.stringify(project),before);
 }
 const {project,graph,roots}=await fixture();
 graph.edits.flows={[roots[0].id]:createStoryFlow(graph,roots[0])};
 assert.match(previewNativeVisualImport(project,'fixture',graph,roots[0]).reason,/structural flow/);
 delete graph.edits.flows[roots[0].id];
 project.maps[0].markers[0].runtime={action:'scene',steps:[]};
 assert.match(previewNativeVisualImport(project,'fixture',graph,roots[0]).reason,/already has authored actions/);
});
test('normal and keep-open message styles are both explicitly preserved; unsupported modes fail',async()=>{
 for(const mode of [4,6]){
  const script='@start:\nmsgbox @text '+mode+'\nend\n@text:\n= Hello from the source.$\n';
  const {project,graph,roots}=await fixture({script,copies:1});
  const preview=previewNativeVisualImport(project,'fixture',graph,roots[0],{newId:id});
  assert.equal(preview.supported,true,preview.reason);
  assert.equal(preview.steps[0].messageType,mode);
  const converted=applyNativeVisualImport(project,'fixture',graph,roots[0],id);
  const compiled=compileScript(sceneSource(converted.marker,{project,map:converted.map,gameProfile:{engine:'frlg'}}),0x6000,'frlg');
  assert.ok(compiled.bytes.includes(9));
  assert.equal(compiled.bytes[compiled.bytes.indexOf(9)+1],mode);
 }
 const {project,graph,roots}=await fixture({script:'@start:\nmsgbox @text 5\nend\n@text:\n= Are you sure?$\n',copies:1});
 assert.match(previewNativeVisualImport(project,'fixture',graph,roots[0]).reason,/message box mode/);
});
test('converter handles original native signs and tile triggers without rewriting identities',async()=>{
 for(const kind of ['signs','triggers']){
  const {project,graph,roots,bytes}=await fixture({copies:0,script:'@start:\nmsgbox @text 4\nend\n@text:\n= A native '+kind+'.$\n'});
  const dv=new DataView(bytes.buffer);
  if(kind==='signs'){bytes[0x3003]=1;dv.setUint32(0x3010,BASE+0x3300,true);dv.setInt16(0x3300,2,true);dv.setInt16(0x3302,2,true);bytes[0x3305]=0;dv.setUint32(0x3308,BASE+0x5000,true);}
  else{bytes[0x3002]=1;dv.setUint32(0x300c,BASE+0x3340,true);dv.setInt16(0x3340,2,true);dv.setInt16(0x3342,2,true);dv.setUint32(0x334c,BASE+0x5000,true);}
  const reader=await new GbaMaps(bytes).discover(),g=await indexNativeStory(reader,{mapKeys:['0.0']}),root=g.roots.find(r=>r.kind===kind);
  assert.ok(root);
  project.maps[0].markers=[{id:'original-pin',title:'Original '+kind,x:2,y:2,kind:kind==='signs'?'sign':'event',rom:{type:kind==='signs'?'sign':'trigger',index:0,signType:0}}];
  const converted=applyNativeVisualImport(project,'fixture',g,root,id);
  assert.equal(converted.marker.id,'original-pin');
  assert.equal(converted.marker.runtime.trigger,kind==='signs'?'interact':'step');
  assert.equal(converted.marker.runtime.steps[0].text,'A native '+kind+'.');
 }
});

test('visualized original NPC remains recoverable through playable ROM plus editable project sidecar',async()=>{
 const {project,reader,graph,roots,bytes}=await fixture({copies:2});
 const converted=applyNativeVisualImport(project,'fixture',graph,roots[0],id),steps=converted.marker.runtime.steps;
 const output=new RomOutput(bytes);
 const src=sceneSource(converted.marker,{project,map:converted.map,gameProfile:{engine:'frlg'}});
 output.write(0x6000,compileScript(src,0x6000,'frlg').bytes);
 output.int(roots[0].reference,BASE+0x6000);
 const {createROMProjectSidecar,restoreROMProjectSidecar,resolveROMExportSource}=await import('../dist/rom-project.js');
 const sidecar=await createROMProjectSidecar(output.bytes,bytes,project,{sourceId:'fixture'});
 const snapshot=JSON.stringify(sidecar);
 const recovered=await restoreROMProjectSidecar(JSON.parse(snapshot),output.bytes);
 assert.deepEqual(recovered.source,bytes);
 assert.equal(recovered.project.maps[0].markers[0].runtime.steps.length,steps.length);
 assert.equal(recovered.project.maps[0].markers[0].runtime.importedNative.rootId,roots[0].id);
 assert.equal(recovered.project.maps[0].markers[1].runtime,undefined);
 assert.deepEqual((await resolveROMExportSource(sidecar,output.bytes)).source,bytes);
 assert.equal(JSON.stringify(sidecar),snapshot,'reading the playable export must not rewrite the saved project sidecar');
});
test('exhausted project quest save space leaves original imported pin, source graph and state unchanged',async()=>{
 const {project,graph,roots}=await fixture({copies:1});
 project.questFlags=Array.from({length:1024},(_,slot)=>({id:'reserved-'+slot,name:'Reserved '+slot,slot}));
 project.questToken=123456;
 const before=JSON.stringify(project);
 assert.throws(()=>applyNativeVisualImport(project,'fixture',graph,roots[0],id),/all 1,024 quest slots/);
 assert.equal(JSON.stringify(project),before);
 assert.equal(project.maps[0].markers[0].runtime,undefined);
});
