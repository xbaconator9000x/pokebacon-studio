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
import {sceneOutline} from '../dist/scene-outline.js';
import {previewNativeVisualImport,applyNativeVisualImport} from '../dist/native-scene-import.js';
import {questReferenceIndex} from '../dist/quest-reference-index.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {RomOutput} from '../dist/rom-writer.js';
const BASE=0x08000000;
let seq=0;const uid=()=> 'trainer-branch-'+(++seq);
async function fixture(script){
 const source=syntheticROM(),dv=new DataView(source.buffer);
 source.set(compileScript(script,0x5000,'frlg').bytes,0x5000);
 source[0x3000]=2;dv.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<2;i++){source[0x3200+i*24]=i+1;dv.setInt16(0x3204+i*24,2+i,true);dv.setInt16(0x3206+i*24,2,true);dv.setUint32(0x3210+i*24,BASE+0x5000,true);}
 const reader=await new GbaMaps(source).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const roots=graph.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 const project=newProject('Trainer revisit fixture'),map=project.maps[0];
 map.rom={sourceId:'trainer-branch',key:'0.0',engine:'frlg'};
 map.markers=roots.map((r,i)=>({id:'npc-'+i,title:'Trainer '+i,text:'Native trainer text.',x:i+2,y:2,kind:'npc',rom:{type:'npc',index:i,localId:i+1}}));
 project.nativeStory={'trainer-branch':graph};
 return{source,reader,graph,roots,project,map};
}
const DIAMOND='@start:\nchecktrainerflag 23\ngoto_if 1 @defeated\ncleartrainerflag 24\ngoto @join\n@defeated:\nsettrainerflag 25\n@join:\nend\n';
function reopen(p){const save=planSave(p),data=new Map(save.parts.map(x=>[x.id,structuredClone(x.value)]));return assembleSavedProject(save.header,savedProjectKeys(save.header).map(k=>data.get(k)));}
test('source checktrainerflag branch imports, persists and reindexes native trainer state script',async()=>{
 const f=await fixture(DIAMOND),before=structuredClone(f.project);
 const preview=previewNativeVisualImport(f.project,'trainer-branch',f.graph,f.roots[0],{newId:uid});
 assert.equal(preview.supported,true,preview.reason);
 assert.deepEqual(f.project,before,'read-only import preview must not mutate project');
 assert.equal(preview.steps.length,1);const b=preview.steps[0];
 assert.equal(b.type,'nativeTrainerIf');assert.equal(b.trainerId,23);
 assert.deepEqual(b.then.map(x=>[x.type,x.trainerId,x.value]),[['nativeTrainerFlag',25,true]]);
 assert.deepEqual(b.else.map(x=>[x.type,x.trainerId,x.value]),[['nativeTrainerFlag',24,false]]);
 const {marker}=applyNativeVisualImport(f.project,'trainer-branch',f.graph,f.roots[0],uid);
 assert.equal(f.map.markers[1].runtime,undefined,'second NPC retains original source script');
 assert.deepEqual(sceneIssues(marker,f.project,f.map),[]);
 const outline=sceneOutline(marker.runtime);
 assert.ok(outline.some(x=>x.kind==='branch'&&x.label==='Conditions met'));
 assert.ok(outline.some(x=>x.kind==='branch'&&x.label==='Otherwise'));
 validateProject(f.project);
 const p=reopen(f.project),actual=p.maps[0].markers[0];
 assert.equal(actual.runtime.steps[0].trainerId,23);
 assert.equal(actual.runtime.steps[0].else[0].trainerId,24);
 const refs=questReferenceIndex(p);
 for(const id of [23,24,25])assert.equal(refs.nativeTrainerFlags.get(id).length,1);
 assert.equal(refs.nativeFlags.size,0,'native trainer flags are not engine general flags');
 assert.equal(refs.missing.length,0,'native trainer state is separate from project quest reservations');
 const code=sceneSource(actual,{project:p,map:p.maps[0],gameProfile:{engine:'frlg',trainerCount:200}});
 assert.match(code,/checktrainerflag 23/);assert.match(code,/settrainerflag 25/);assert.match(code,/cleartrainerflag 24/);
 assert.match(code,/goto_if 1 @trainer_defeated/);
 const out=new RomOutput(f.source);out.write(0x6000,compileScript(code,0x6000,'frlg').bytes);
 out.int(f.roots[0].reference,BASE+0x6000);
 const indexed=await indexNativeStory(await new GbaMaps(out.bytes).discover(),{mapKeys:['0.0']});
 const roots=indexed.roots.filter(x=>x.kind==='npcs'&&x.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(roots[0].address,0x6000);assert.equal(roots[1].address,0x5000);
 assert.ok(Object.values(indexed.nodes).some(n=>n.code===96&&n.args[0].value===23));
 assert.ok(Object.values(indexed.nodes).some(n=>n.code===97&&n.args[0].value===25));
 assert.ok(Object.values(indexed.nodes).some(n=>n.code===98&&n.args[0].value===24));
 assert.deepEqual(Array.from(out.bytes.slice(0x5000,0x5012)),Array.from(f.source.slice(0x5000,0x5012)));
});
test('unbounded trainer branches and invalid trainer IDs remain native-only and atomic',async()=>{
 const cases=[
 '@start:\nchecktrainerflag 23\nend\n',
 '@start:\nchecktrainerflag 23\ngoto_if 1 @yes\nend\n@yes:\nend\n',
 '@start:\nchecktrainerflag 0\ngoto_if 1 @yes\ncleartrainerflag 23\ngoto @join\n@yes:\nsettrainerflag 23\n@join:\nend\n'
 ];
 for(const source of cases){
  const f=await fixture(source),before=JSON.stringify(f.project);
  const preview=previewNativeVisualImport(f.project,'trainer-branch',f.graph,f.roots[0],{newId:uid});
  assert.equal(preview.supported,false,'unsafe trainer branch must refuse conversion');
  assert.throws(()=>applyNativeVisualImport(f.project,'trainer-branch',f.graph,f.roots[0],uid));
  assert.equal(JSON.stringify(f.project),before);
 }
 const f=await fixture(DIAMOND),{marker}=applyNativeVisualImport(f.project,'trainer-branch',f.graph,f.roots[0],uid);
 marker.runtime.steps[0].trainerId=65536;
 assert.ok(sceneIssues(marker,f.project,f.map).some(x=>/trainer ID/.test(x.message)));
 assert.throws(()=>sceneSource(marker,{project:f.project,map:f.map,gameProfile:{engine:'frlg',trainerCount:200}}));
 marker.runtime.steps[0].trainerId=23;
 assert.throws(()=>sceneSource(marker,{project:f.project,map:f.map,gameProfile:{engine:'frlg',trainerCount:23}}),/trainer ID available/);
});
test('mobile trainer conditional branches and preview test-state choices are wired',()=>{
 const ui=readFileSync(new URL('../dist/scene-ui.js',import.meta.url),'utf8');
 assert.match(ui,/nativeTrainerIf:'Check trainer defeated state'/);
 assert.match(ui,/sceneEditThen/);assert.match(ui,/Not defeated/);
 assert.match(ui,/data-test-trainer-flag/);
 assert.match(ui,/p\.trainerFlags=new Set/);
 assert.match(ui,/s\.type==='nativeTrainerIf'\)await steps/);
});
