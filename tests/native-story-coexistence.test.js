import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {compileScript} from '../dist/script-engine.js';
import {indexNativeStory,installNativeStoryEdits,reviewNativeStoryOwnership} from '../dist/native-story.js';
import {createStoryFlow,validateStoryFlow} from '../dist/story-flow.js';
import {insertStoryCondition} from '../dist/native-story-state.js';
import {RomOutput} from '../dist/rom-writer.js';
import {newProject,validateProject} from '../dist/model.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';

const BASE=0x08000000;
async function scenario(){
 const bytes=syntheticROM(),dv=new DataView(bytes.buffer);
 bytes[0x3000]=2;dv.setUint32(0x3004,BASE+0x3200,true);
 // Two independent, original NPC entries call the same source script.
 for(let i=0;i<2;i++){bytes[0x3200+i*24]=i+1;dv.setUint32(0x3210+i*24,BASE+0x5000,true);}
 bytes.set(compileScript('@start:\nmessage @text\nend\n@text:\n= Original dialogue.$\n',0x5000,'frlg').bytes,0x5000);
 const reader=await new GbaMaps(bytes).discover();
 const graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const roots=graph.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(roots.length,2);assert.equal(roots[0].address,roots[1].address);
 const project=newProject();
 project.maps=[{id:'shared-map',name:'Shattered test gate',rom:{sourceId:'fixture',key:'0.0'},markers:[
   {title:'Authored gate guard',rom:{type:'npc',index:0},runtime:{action:'scene',enabled:true,steps:[{type:'say',text:'This branch is newly authored.'}]}}
 ]}];
 project.nativeStory={fixture:graph};
 const output=new RomOutput(bytes);
 // Equivalent of the ROM-exporter's authored event script installation:
 // replace the first entry pointer with a separately compiled scene.
 output.write(0x6000,compileScript('@start:\nmessage @text\nend\n@text:\n= Authored gate guard.$\n',0x6000,'frlg').bytes);
 output.int(roots[0].reference,BASE+0x6000);
 return{bytes,reader,graph,roots,project,output};
}
function firstDialogue(graph,root){
 const node=graph.nodes[root.address];assert.ok(node&&!node.opaque);
 const arg=node.args.find(a=>a.kind==='text');
 assert.ok(arg);
 const row=graph.texts[arg.value-BASE];assert.ok(row);
 return row.text;
}
async function roundTrip(project){
 const save=planSave(project),data=new Map(save.parts.map(part=>[part.id,structuredClone(part.value)]));
 return assembleSavedProject(save.header,savedProjectKeys(save.header).map(id=>data.get(id)));
}

test('native shared dialogue coexists with a separate authored NPC replacement after save/export/reimport',async()=>{
 const {bytes,reader,graph,roots,project,output}=await scenario();
 const text=Object.values(graph.texts)[0];assert.ok(text);
 graph.edits.texts[text.at]={original:text.original,text:'Shared source dialogue updated.'};
 assert.equal(reviewNativeStoryOwnership(project,'fixture',graph).replaced.length,1);
 const reopened=await roundTrip(project);
 const reports=await installNativeStoryEdits(reopened,reader,'fixture',output);
 assert.ok(reports.some(x=>/coexistence/.test(x)));
 const exported=await new GbaMaps(output.bytes).discover(),fresh=await indexNativeStory(exported,{mapKeys:['0.0']});
 const originals=fresh.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(originals[0].address,0x6000);
 assert.equal(originals[1].address,0x5000);
 assert.equal(firstDialogue(fresh,originals[0]),'Authored gate guard.');
 assert.equal(firstDialogue(fresh,originals[1]),'Shared source dialogue updated.');
 assert.deepEqual(output.bytes.slice(0x5000,0x5006),bytes.slice(0x5000,0x5006));
});

test('native structural flow targeting the same authored event is still rejected without modifying output',async()=>{
 const {reader,graph,roots,project,output}=await scenario();
 const flow=createStoryFlow(graph,roots[0]);validateStoryFlow(flow,graph,roots[0]);graph.edits.flows={[roots[0].id]:flow};
 const before=output.bytes.slice();
 assert.throws(()=>reviewNativeStoryOwnership(project,'fixture',graph),/also has an authored replacement scene/);
 await assert.rejects(installNativeStoryEdits(project,reader,'fixture',output),/also has an authored replacement scene/);
 assert.deepEqual(output.bytes,before);
});

test('a visual replacement, a separately authored native flow and shared dialogue coexist',async()=>{
 const {reader,graph,roots,project,output}=await scenario();
 const text=Object.values(graph.texts)[0];
 graph.edits.texts[text.at]={original:text.original,text:'Original script after reauthoring.'};
 const flow=createStoryFlow(graph,roots[1]);
 insertStoryCondition(flow,flow.entry,'frlg',{kind:'flag',id:0x200,trueText:'The gate is open.',falseText:'The gate is locked.'});
 graph.edits.flows={[roots[1].id]:flow};
 assert.equal(reviewNativeStoryOwnership(project,'fixture',graph).replaced.length,1);
 const reopened=await roundTrip(project);
 await installNativeStoryEdits(reopened,reader,'fixture',output);
 const fresh=await indexNativeStory(await new GbaMaps(output.bytes).discover(),{mapKeys:['0.0']});
 const other=fresh.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(other[0].address,0x6000);
 assert.notEqual(other[1].address,0x5000);
 assert.notEqual(other[1].address,0x6000);
 assert.equal(firstDialogue(fresh,other[0]),'Authored gate guard.');
 assert.equal(firstDialogue(fresh,{...other[1],address:0x5000}),'Original script after reauthoring.');
 assert.ok(Object.values(fresh.nodes).some(n=>n.name==='checkflag'&&n.args[0].value===0x200));
});

test('disabled authored event and unrelated map do not reserve a native script entry',async()=>{
 const {graph,project,roots}=await scenario();
 project.maps[0].markers[0].runtime.enabled=false;
 assert.equal(reviewNativeStoryOwnership(project,'fixture',graph).replaced.length,0);
 project.maps[0].markers[0].runtime.enabled=true;
 project.maps[0].rom.sourceId='other-rom';
 assert.equal(reviewNativeStoryOwnership(project,'fixture',graph).replaced.length,0);
 graph.edits.flows={[roots[0].id]:createStoryFlow(graph,roots[0])};
 assert.doesNotThrow(()=>reviewNativeStoryOwnership(project,'fixture',graph));
});
