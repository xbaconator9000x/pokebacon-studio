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
import {nativeFlagNumber,nativeFlagSource,applyNativeFlagPreview} from '../dist/native-flag-bridge.js';
import {questReferenceIndex} from '../dist/quest-reference-index.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
import {RomOutput} from '../dist/rom-writer.js';
const BASE=0x08000000;
let serial=0;const uid=()=> 'native-flag-'+(++serial);
async function fixture(script){
 const bytes=syntheticROM(),dv=new DataView(bytes.buffer);
 bytes.set(compileScript(script,0x5000,'frlg').bytes,0x5000);
 bytes[0x3000]=2;dv.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<2;i++){bytes[0x3200+i*24]=i+1;dv.setInt16(0x3204+i*24,i+2,true);dv.setInt16(0x3206+i*24,2,true);dv.setUint32(0x3210+i*24,BASE+0x5000,true);}
 const reader=await new GbaMaps(bytes).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const roots=graph.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 const project=newProject('Original native flags'),map=project.maps[0];
 map.rom={sourceId:'flag-test',key:'0.0',engine:'frlg'};
 map.markers=roots.map((r,i)=>({id:'original-'+i,title:'Original '+i,x:2+i,y:2,kind:'npc',text:'Original imported NPC.',rom:{type:'npc',index:i,localId:i+1}}));
 project.nativeStory={'flag-test':graph};
 return{bytes,reader,graph,roots,project,map};
}
function reopen(project){const plan=planSave(project),parts=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));return assembleSavedProject(plan.header,savedProjectKeys(plan.header).map(k=>parts.get(k)));}
test('source flag writes import, save/reopen and native byte reindex without altering a shared NPC source',async()=>{
 const f=await fixture('@start:\nsetflag 0x200\nclearflag 0x201\nmsgbox @text 6\nend\n@text:\n= The gate is ready.$\n');
 const snapshot=structuredClone(f.project),preview=previewNativeVisualImport(f.project,'flag-test',f.graph,f.roots[0],{newId:uid});
 assert.equal(preview.supported,true,preview.reason);
 assert.deepEqual(preview.steps.map(s=>s.type),['nativeFlag','nativeFlag','say']);
 assert.deepEqual(preview.steps.slice(0,2).map(s=>[s.nativeFlagId,s.value]),[[512,true],[513,false]]);
 assert.deepEqual(f.project,snapshot);
 const {marker}=applyNativeVisualImport(f.project,'flag-test',f.graph,f.roots[0],uid);
 assert.equal(f.map.markers[1].runtime,undefined);
 assert.deepEqual(sceneIssues(marker,f.project,f.map),[]);
 validateProject(f.project);
 const restored=reopen(f.project),actual=restored.maps[0].markers[0];
 assert.deepEqual(actual.runtime.steps.slice(0,2).map(s=>[s.nativeFlagId,s.value]),[[512,true],[513,false]]);
 const refs=questReferenceIndex(restored);
 assert.equal(refs.nativeFlags.get(512).length,1);assert.equal(refs.nativeFlags.get(513).length,1);
 assert.match(refs.nativeFlags.get(513)[0].detail,/clear original ROM flag/);
 assert.equal(refs.missing.length,0);
 const script=sceneSource(actual,{project:restored,map:restored.maps[0],gameProfile:{engine:'frlg'}});
 assert.match(script,/setflag 512/);assert.match(script,/clearflag 513/);
 const output=new RomOutput(f.bytes);
 output.write(0x6000,compileScript(script,0x6000,'frlg').bytes);
 output.int(f.roots[0].reference,BASE+0x6000);
 const next=await indexNativeStory(await new GbaMaps(output.bytes).discover(),{mapKeys:['0.0']});
 const roots=next.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(roots[0].address,0x6000);assert.equal(roots[1].address,0x5000);
 assert.ok(Object.values(next.nodes).some(n=>n.code===41&&n.args[0].value===512));
 assert.ok(Object.values(next.nodes).some(n=>n.code===42&&n.args[0].value===513));
 assert.deepEqual(Array.from(output.bytes.slice(0x5000,0x5006)),Array.from(f.bytes.slice(0x5000,0x5006)));
});
test('nested original source checkflag diamond preserves set/clear effects',async()=>{
 const f=await fixture('@start:\ncheckflag 0x200\ngoto_if 1 @yes\nclearflag 0x202\ngoto @join\n@yes:\nsetflag 0x201\n@join:\nend\n');
 const preview=previewNativeVisualImport(f.project,'flag-test',f.graph,f.roots[0],{newId:uid});
 assert.equal(preview.supported,true,preview.reason);
 assert.equal(preview.steps[0].type,'nativeFlagIf');
 assert.deepEqual(preview.steps[0].then.map(s=>[s.type,s.nativeFlagId,s.value]),[['nativeFlag',513,true]]);
 assert.deepEqual(preview.steps[0].else.map(s=>[s.type,s.nativeFlagId,s.value]),[['nativeFlag',514,false]]);
 const {marker}=applyNativeVisualImport(f.project,'flag-test',f.graph,f.roots[0],uid);
 const compiled=sceneSource(marker,{project:f.project,map:f.map,gameProfile:{engine:'frlg'}});
 assert.match(compiled,/checkflag 512/);assert.match(compiled,/setflag 513/);assert.match(compiled,/clearflag 514/);
 assert.ok(compileScript(compiled,0x6000,'frlg').bytes.length>0);
 for(const id of [512,513,514])assert.equal(questReferenceIndex(f.project).nativeFlags.get(id).length,1);
});
test('native flag IDs fail closed and preview uses copy-on-write isolated from original state',()=>{
 for(const bad of [null,undefined,'','0x200','-1','65536',-1,65536,1.5,NaN]){
  assert.throws(()=>nativeFlagNumber(bad),/original ROM flag/);
  assert.throws(()=>nativeFlagSource({nativeFlagId:bad}),/original ROM flag/);
 }
 assert.equal(nativeFlagNumber('0'),0);assert.equal(nativeFlagNumber('65535'),65535);
 const original=new Set([512,600]),set=applyNativeFlagPreview({nativeFlagId:513,value:true},original);
 assert.deepEqual([...set].sort((a,b)=>a-b),[512,513,600]);assert.deepEqual([...original].sort((a,b)=>a-b),[512,600]);
 const clear=applyNativeFlagPreview({nativeFlagId:512,value:false},set);
 assert.equal(clear.has(512),false);assert.equal(set.has(512),true);
 assert.equal(nativeFlagSource({nativeFlagId:513,value:false}),'clearflag 513');
});
test('mobile native write action, editor form and test-game-state reader are wired',()=>{
 const ui=readFileSync(new URL('../dist/scene-ui.js',import.meta.url),'utf8');
 assert.match(ui,/nativeFlag:'Set \/ clear original ROM flag'/);
 assert.match(ui,/s\.type==='nativeFlag'\)body=input\('nativeFlagId'/);
 assert.match(ui,/applyNativeFlagPreview\(s,p\.nativeFlags\)/);
 assert.match(ui,/\['nativeFlag','nativeFlagIf'\]\.includes\(s\.type\)/);
});
