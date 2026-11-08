import test from 'node:test';
import assert from 'node:assert/strict';
import {GbaMaps} from '../dist/rom.js';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {compileScript} from '../dist/script-engine.js';
import {indexNativeStory,installNativeStoryEdits,nativeStoryEditCount} from '../dist/native-story.js';
import {createStoryFlow,validateStoryFlow} from '../dist/story-flow.js';
import {insertStoryCondition,nativeStateChoices,nameStoryState,validateStorySymbols} from '../dist/native-story-state.js';
import {RomOutput} from '../dist/rom-writer.js';
import {newProject,validateProject} from '../dist/model.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
async function fixture(engine='frlg'){
 // The relocated synthetic map fixture uses common Gen III script opcodes.
 // Selecting RSE tests its command schema, not a retail Emerald gameplay run.
 const bytes=syntheticROM(),v=new DataView(bytes.buffer);
 bytes[0x3000]=2;v.setUint32(0x3004,0x08003200,true);
 for(let i=0;i<2;i++){bytes[0x3200+i*24]=i+1;v.setUint32(0x3210+i*24,0x08005000,true);}
 bytes.set(compileScript('@start:\ncheckflag 0x200\ncompare_var_to_value 0x4001, 2\nmessage @text\nend\n@text:\n= Original event.$\n',0x5000,engine).bytes,0x5000);
 const reader=await new GbaMaps(bytes).discover();reader.engine=engine;
 const graph=await indexNativeStory(reader,{mapKeys:['0.0']}),root=graph.roots.find(r=>r.kind==='npcs');
 return{bytes,reader,graph,root};
}
// Small reference evaluator of the emitted native commands, not a GBA emulator.
function messages(graph,root,{flags=new Set(),variables={}}={}){
 let at=root.address,result=0;const out=[],matches=[n=>n===0,n=>n===1,n=>n===2,n=>n<=1,n=>n>=1,n=>n!==1];
 for(let i=0;i<150;i++){
  const n=graph.nodes[at];assert.ok(n&&!n.opaque,'native path must remain decoded');const args=n.args.map(a=>a.value);
  if(n.name==='checkflag')result=flags.has(args[0])?1:0;
  if(n.name==='compare_var_to_value'){const value=variables[args[0]]??0;result=value<args[1]?0:value===args[1]?1:2;}
  if(n.name==='message')out.push(graph.texts[args[0]-0x08000000].text);
  if(n.name==='end')return out;
  at=n.name==='goto'?args[0]-0x08000000:n.name==='goto_if'&&matches[args[0]](result)?args[1]-0x08000000:n.end;
 }
 throw Error('Branch failed to rejoin/terminate');
}
for(const engine of ['frlg','rse'])test(engine+' guided conditions save/export/reimport with both branches and shared entries preserved',async()=>{
 const{bytes,reader,graph,root}=await fixture(engine),flow=createStoryFlow(graph,root),project=newProject();
 nameStoryState(graph,'flag',0x200,'Has the gate key');nameStoryState(graph,'variable',0x4001,'Rescue progress');
 assert.equal(nativeStateChoices(graph,'flag')[0].label,'Has the gate key');
 insertStoryCondition(flow,flow.entry,engine,{kind:'flag',id:0x200,trueText:'The gate is open.',falseText:'Find the key first.'});
 validateStoryFlow(flow,graph,root);graph.edits.flows={[root.id]:flow};project.nativeStory={fixture:graph};validateProject(project,[]);
 const plan=planSave(project),parts=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)])),reopened=assembleSavedProject(plan.header,savedProjectKeys(plan.header).map(id=>parts.get(id)));
 assert.deepEqual(reopened.nativeStory.fixture.symbols,graph.symbols);
 const output=new RomOutput(bytes);await installNativeStoryEdits(reopened,reader,'fixture',output);
 const exported=await new GbaMaps(output.bytes).discover();exported.engine=engine;
 const fresh=await indexNativeStory(exported,{mapKeys:['0.0']}),changed=fresh.roots.find(r=>r.id===root.id),other=fresh.roots.find(r=>r.kind==='npcs'&&r.id!==root.id);
 assert.deepEqual(messages(fresh,changed,{flags:new Set([0x200])}),['The gate is open.','Original event.']);
 assert.deepEqual(messages(fresh,changed),['Find the key first.','Original event.']);
 assert.equal(other.address,root.address);assert.deepEqual(messages(fresh,other),['Original event.']);
 assert.deepEqual(output.bytes.slice(0x5000,0x5040),bytes.slice(0x5000,0x5040));
});
test('all six variable operators compile to matching native comparisons',async()=>{
 for(const [operator,match,miss]of [['eq',3,2],['ne',2,3],['lt',2,4],['lte',3,4],['gt',4,2],['gte',3,2]]){
  const{bytes,reader,graph,root}=await fixture(),flow=createStoryFlow(graph,root);
  insertStoryCondition(flow,flow.entry,'frlg',{kind:'variable',id:0x4001,operator,value:3,trueText:'Yes.',falseText:'No.'});
  graph.edits.flows={[root.id]:flow};const out=new RomOutput(bytes);await installNativeStoryEdits({nativeStory:{fixture:graph}},reader,'fixture',out);
  const fresh=await indexNativeStory(await new GbaMaps(out.bytes).discover(),{mapKeys:['0.0']}),event=fresh.roots.find(r=>r.id===root.id);
  assert.equal(messages(fresh,event,{variables:{0x4001:match}})[0],'Yes.');assert.equal(messages(fresh,event,{variables:{0x4001:miss}})[0],'No.');
 }
});
test('state names are validated, retained on reindex and never counted as ROM writes',async()=>{
 const{reader,graph}=await fixture();nameStoryState(graph,'flag',512,'Gate key');
 assert.equal(nativeStoryEditCount({nativeStory:{fixture:graph}},'fixture'),0);
 assert.deepEqual((await indexNativeStory(reader,{mapKeys:['0.0'],previous:graph})).symbols,graph.symbols);
 for(const symbols of [[],{flags:[]},{other:{}},{flags:{'-1':'bad'}},{variables:{'65536':'bad'}},{flags:{512:'x'.repeat(81)}}])assert.throws(()=>validateStorySymbols(symbols));
 nameStoryState(graph,'flag',512,'');assert.equal(nativeStateChoices(graph,'flag')[0].label,'Flag 0x200');
});
test('flag-not-set uses the false result from checkflag',async()=>{
 const{bytes,reader,graph,root}=await fixture(),flow=createStoryFlow(graph,root);
 insertStoryCondition(flow,flow.entry,'frlg',{kind:'flag',id:512,operator:'ne',trueText:'Not yet.',falseText:'Done.'});
 graph.edits.flows={[root.id]:flow};const output=new RomOutput(bytes);await installNativeStoryEdits({nativeStory:{fixture:graph}},reader,'fixture',output);
 const fresh=await indexNativeStory(await new GbaMaps(output.bytes).discover(),{mapKeys:['0.0']}),event=fresh.roots.find(r=>r.id===root.id);
 assert.equal(messages(fresh,event)[0],'Not yet.');assert.equal(messages(fresh,event,{flags:new Set([512])})[0],'Done.');
});
test('invalid conditions cannot leave partially inserted nodes',async()=>{
 const{graph,root}=await fixture(),flow=createStoryFlow(graph,root),before=structuredClone(flow);
 for(const change of [{id:65536},{kind:'__proto__'},{operator:'lt'},{whenTrue:'missing'},{trueText:'x'.repeat(8001)}])assert.throws(()=>insertStoryCondition(flow,flow.entry,'frlg',{kind:'flag',id:512,trueText:'yes',...change}));
 assert.deepEqual(flow,before);
 const prior=structuredClone(graph);assert.throws(()=>nameStoryState(graph,'__proto__',1,'bad'));assert.deepEqual(graph,prior);
});
