import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {compileScript} from '../dist/script-engine.js';
import {indexNativeStory,installNativeStoryEdits,nativeStoryWhereUsed,planSharedEdit} from '../dist/native-story.js';
import {createStoryFlow,validateStoryFlow} from '../dist/story-flow.js';
import {insertStoryCondition} from '../dist/native-story-state.js';
import {RomOutput} from '../dist/rom-writer.js';
import {newProject} from '../dist/model.js';

const BASE=0x08000000,SHARED=0x5000,OWN=0x5100;

// Map 0.0 has three NPC entries: two call the same source script, the third
// has a script of its own.
async function scenario({replaceFirst=false}={}){
 const bytes=syntheticROM(),dv=new DataView(bytes.buffer);
 bytes[0x3000]=3;dv.setUint32(0x3004,BASE+0x3200,true);
 for(let i=0;i<3;i++){bytes[0x3200+i*24]=i+1;dv.setUint32(0x3210+i*24,BASE+(i<2?SHARED:OWN),true);}
 bytes.set(compileScript('@start:\nmessage @text\nend\n@text:\n= Shared dialogue.$\n',SHARED,'frlg').bytes,SHARED);
 bytes.set(compileScript('@start:\nmessage @text\nend\n@text:\n= Private dialogue.$\n',OWN,'frlg').bytes,OWN);
 const reader=await new GbaMaps(bytes).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
 const roots=graph.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.equal(roots.length,3);
 assert.equal(roots[0].address,roots[1].address);assert.notEqual(roots[0].address,roots[2].address);
 const project=newProject();
 project.maps=[{id:'m',name:'Test gate',rom:{sourceId:'fixture',key:'0.0'},markers:replaceFirst?[{title:'Authored guard',rom:{type:'npc',index:0},runtime:{action:'scene',enabled:true,steps:[{type:'say',text:'Authored.'}]}}]:[]}];
 project.nativeStory={fixture:graph};
 return{bytes,reader,graph,roots,project};
}
const dialogue=(graph,root)=>{const n=graph.nodes[root.address],a=n.args.find(x=>x.kind==='text');return graph.texts[a.value-BASE].text;};

test('where-used lists every entry that reaches a shared script, with counts',async()=>{
 const {graph,project,roots}=await scenario();
 const use=nativeStoryWhereUsed(project,'fixture',graph,SHARED);
 assert.equal(use.total,2);assert.equal(use.native,2);assert.equal(use.replaced,0);assert.equal(use.mapCount,1);assert.equal(use.truncated,0);
 assert.deepEqual(use.entries.map(e=>e.rootId),[roots[0].id,roots[1].id]);
 assert.ok(use.entries.every(e=>e.status==='native'&&e.kind==='npcs'&&e.mapKey==='0.0'&&e.title.length>0));
 const own=nativeStoryWhereUsed(project,'fixture',graph,OWN);
 assert.equal(own.total,1);assert.equal(own.entries[0].rootId,roots[2].id);
 const none=nativeStoryWhereUsed(project,'fixture',graph,0x7000);
 assert.equal(none.total,0);assert.deepEqual(none.entries,[]);assert.equal(none.mapCount,0);
});

test('a shared script needs confirmation from either event, and names the others',async()=>{
 const {graph,project,roots}=await scenario();
 const a=planSharedEdit(project,'fixture',graph,SHARED,roots[0].id);
 assert.equal(a.requiresConfirmation,true);assert.equal(a.sharedCount,1);assert.equal(a.sharedMapCount,1);
 assert.deepEqual(a.sharedWith.map(e=>e.rootId),[roots[1].id]);
 assert.equal(a.currentStatus,'native');assert.equal(a.canEditOnlyThis,true);
 assert.match(a.summary,/also affects 1 other event in 1 map/);assert.match(a.summary,/Edit only this event/);
 const b=planSharedEdit(project,'fixture',graph,SHARED,roots[1].id);
 assert.deepEqual(b.sharedWith.map(e=>e.rootId),[roots[0].id]);
});

test('an event with its own script needs no confirmation',async()=>{
 const {graph,project,roots}=await scenario();
 const plan=planSharedEdit(project,'fixture',graph,OWN,roots[2].id);
 assert.equal(plan.requiresConfirmation,false);assert.equal(plan.sharedCount,0);
 assert.equal(plan.total,1);assert.match(plan.summary,/No other event uses this/);
});

test('with no current event, every live native entry counts as another event',async()=>{
 const {graph,project}=await scenario();
 const plan=planSharedEdit(project,'fixture',graph,SHARED,null);
 assert.equal(plan.sharedCount,2);assert.equal(plan.requiresConfirmation,true);
 assert.equal(plan.currentStatus,'unrelated');assert.equal(plan.canEditOnlyThis,false);
 const unknown=planSharedEdit(project,'fixture',graph,SHARED,'0.0:npcs:not-a-real-root');
 assert.equal(unknown.currentStatus,'unrelated');assert.equal(unknown.canEditOnlyThis,false);assert.equal(unknown.sharedCount,2);
});

test('an authored replacement is listed but does not count as an affected live event',async()=>{
 const {graph,project,roots}=await scenario({replaceFirst:true});
 const use=nativeStoryWhereUsed(project,'fixture',graph,SHARED);
 assert.equal(use.native,1);assert.equal(use.replaced,1);
 const replaced=use.entries.find(e=>e.rootId===roots[0].id);
 assert.equal(replaced.status,'replaced');assert.equal(replaced.replacedBy,'Authored guard');
 assert.equal(use.entries.find(e=>e.rootId===roots[1].id).status,'native');
 // The live entry can edit freely: the only other entry is replaced.
 const live=planSharedEdit(project,'fixture',graph,SHARED,roots[1].id);
 assert.equal(live.requiresConfirmation,false);assert.equal(live.sharedCount,0);assert.equal(live.canEditOnlyThis,true);
 // The replaced entry cannot take a private native copy, and editing shared
 // source from it still changes the live entry, so it must confirm.
 const gone=planSharedEdit(project,'fixture',graph,SHARED,roots[0].id);
 assert.equal(gone.currentStatus,'replaced');assert.equal(gone.canEditOnlyThis,false);
 assert.equal(gone.requiresConfirmation,true);assert.deepEqual(gone.sharedWith.map(e=>e.rootId),[roots[1].id]);
 // Disabling the authored scene makes the original entry live again.
 project.maps[0].markers[0].runtime.enabled=false;
 assert.equal(nativeStoryWhereUsed(project,'fixture',graph,SHARED).native,2);
});

test('large lists are trimmed for display but the counts stay complete and stable',()=>{
 const roots=[],nodes={};
 nodes[0x9000]={at:0x9000,name:'end',opaque:false,args:[],edges:[]};
 for(let i=0;i<150;i++){
  const map=String(i%3);
  roots.push({id:map+'.0:npcs:'+(i*24+16),mapKey:map+'.0',mapName:'Map '+map,kind:'npcs',reference:i,address:0x9000+0,title:'NPC '+i});
 }
 const graph={roots,nodes,edits:{commands:{}}},project=newProject();
 const use=nativeStoryWhereUsed(project,'x',graph,0x9000,{limit:10});
 assert.equal(use.total,150);assert.equal(use.native,150);assert.equal(use.entries.length,10);assert.equal(use.truncated,140);assert.equal(use.mapCount,3);
 assert.ok(use.entries.every((e,i,all)=>!i||all[i-1].mapName.localeCompare(e.mapName)<=0),'sorted by map');
 const again=nativeStoryWhereUsed(project,'x',graph,0x9000,{limit:10});
 assert.deepEqual(again,use);
 const plan=planSharedEdit(project,'x',graph,0x9000,roots[0].id,{limit:5});
 assert.equal(plan.sharedCount,149);assert.equal(plan.entries.length,5);assert.equal(plan.truncated,145);assert.equal(plan.sharedMapCount,3);
 assert.match(plan.summary,/149 other events in 3 maps/);
});

test('editing only one event with a private flow copy leaves the other event and the shared bytes untouched',async()=>{
 const {bytes,reader,graph,roots,project}=await scenario();
 const flow=createStoryFlow(graph,roots[0]);validateStoryFlow(flow,graph,roots[0]);
 insertStoryCondition(flow,flow.entry,'frlg',{kind:'flag',id:0x200,trueText:'Only this guard checks the gate.',falseText:'The gate is shut.'});
 graph.edits.flows={[roots[0].id]:flow};
 const output=new RomOutput(bytes);
 await installNativeStoryEdits(project,reader,'fixture',output);
 const fresh=await indexNativeStory(await new GbaMaps(output.bytes).discover(),{mapKeys:['0.0']});
 const now=fresh.roots.filter(r=>r.kind==='npcs'&&r.mapKey==='0.0').sort((a,b)=>a.index-b.index);
 assert.notEqual(now[0].address,SHARED,'the edited event now runs its own copy');
 assert.equal(now[1].address,SHARED,'the other event keeps the shared script');
 assert.equal(now[2].address,OWN);
 assert.equal(dialogue(fresh,now[1]),'Shared dialogue.');
 assert.ok(Object.values(fresh.texts).some(t=>t.text==='Only this guard checks the gate.'));
 assert.deepEqual(output.bytes.slice(SHARED,SHARED+0x40),bytes.slice(SHARED,SHARED+0x40),'shared source bytes are unchanged');
 // After the split the script is no longer shared, so no confirmation is needed.
 const after=planSharedEdit(project,'fixture',fresh,SHARED,now[1].id);
 assert.equal(after.total,1);assert.equal(after.requiresConfirmation,false);
});

test('an event that already has its own flow copy is marked, and still counted because flows can keep shared links',async()=>{
 const {graph,project,roots}=await scenario();
 assert.ok(nativeStoryWhereUsed(project,'fixture',graph,SHARED).entries.every(e=>e.ownCopy===false));
 graph.edits.flows={[roots[0].id]:createStoryFlow(graph,roots[0])};
 const use=nativeStoryWhereUsed(project,'fixture',graph,SHARED);
 assert.equal(use.total,2);
 assert.equal(use.entries.find(e=>e.rootId===roots[0].id).ownCopy,true);
 assert.equal(use.entries.find(e=>e.rootId===roots[1].id).ownCopy,false);
 assert.equal(planSharedEdit(project,'fixture',graph,SHARED,roots[1].id).sharedCount,1);
});
