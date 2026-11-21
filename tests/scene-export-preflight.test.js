import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../dist/model.js';
import {newScene,prepareScene,sceneIssues} from '../dist/authoring-model.js';
import {enableScenePages,addScenePage,scenePageSummary,chooseScenePage,pageStructureIssues,replaceScenePagesFromJson} from '../dist/scene-pages.js';
import {assertNativeSceneExportReady} from '../dist/native-scene-preflight.js';
import {validateEvent,needsQuest} from '../dist/event-model.js';
const uid=(()=>{let counter=0;return()=> 'event-page-id-'+(++counter);})();
function fixture(){
 const project=newProject('Shared gate'),map=project.maps[0];
 map.name='Victory Road gate';map.rom={sourceId:'shattered-fixture',key:'0.0'};
 const event=newScene(project,2,2);
 event.title='Aipom key cutscene';map.markers.push(event);prepareScene(project,event);
 enableScenePages(event.runtime,uid);
 return{project,map,event};
}
const broken=(steps,conditions=[])=>[{id:'page-a',name:'Imported page',conditions,enabled:true,steps}];
test('nested malformed page actions and prerequisites remain repairable, with map-specific pre-export error',()=>{
 const {project,map,event}=fixture();
 const cases=[
  [broken([null]),/action 1 is not a valid action/],
  [broken([{id:'x',type:'choice',yes:'bad nested list'}]),/yes must be an action list/],
  [broken([{id:'x',type:'answers',choices:[null]}]),/answer 1 is invalid/],
  [broken([{id:'x',type:'answers',choices:[{label:'OK',steps:{}}]}]),/answer 1 must be an action list/],
  [broken([{id:'x',type:'say',text:'Hi'}],[null]),/prerequisite 1 is invalid/],
  [broken([{id:'x',type:'if',then:[{id:'x',type:'say',text:'duplicate ID'}]}]),/duplicate stable action ID/]
 ];
 for(const [pages,pattern] of cases){
  event.runtime.pages=pages;
  assert.match(pageStructureIssues(event.runtime).join('; '),pattern);
  let issues;assert.doesNotThrow(()=>issues=sceneIssues(event,project,map));
  assert.ok(issues.some(i=>i.path==='Pages'));
  assert.throws(()=>validateEvent(event,project,map),/Repair the invalid event pages/);
  assert.throws(()=>assertNativeSceneExportReady(project,[map]),/Victory Road gate \/ Aipom key cutscene \/ Pages/);
  assert.doesNotThrow(()=>chooseScenePage(event.runtime,()=>true));
 }
});
test('invalid page import repair and duplicate insertion fail atomically, preserving existing drafts',()=>{
 const {event}=fixture();
 const base=structuredClone(event.runtime);
 const cases=[broken([{id:'a',type:'choice',yes:'incorrect'}]),broken([{id:'a',type:'say',text:'x'}],[null])];
 for(const pages of cases){
  assert.throws(()=>replaceScenePagesFromJson(event.runtime,JSON.stringify(pages)));
  assert.deepEqual(event.runtime,base);
 }
 const source={id:'valid',name:'Captured',enabled:true,conditions:[],steps:[{id:'a',type:'say',text:'Recovered'}]};
 replaceScenePagesFromJson(event.runtime,JSON.stringify([source]));
 const before=structuredClone(event.runtime);
 assert.throws(()=>addScenePage(event.runtime,()=> 'a',{...source,steps:[{id:'a',type:'if',then:'broken'}]}),/invalid event|invalid actions|invalid/i);
 assert.deepEqual(event.runtime,before);
});
test('action IDs must be distinct across event pages, without requiring IDs on old imported actions',()=>{
 const {event}=fixture();
 event.runtime.pages=[
  {id:'one',name:'Base',enabled:true,conditions:[],steps:[{type:'say',text:'Legacy without ID'},{id:'shared',type:'say',text:'First'}]},
  {id:'two',name:'Second',enabled:true,conditions:[],steps:[{id:'shared',type:'say',text:'Second'}]}
 ];
 assert.match(pageStructureIssues(event.runtime).join(' '),/duplicate stable action ID/);
 event.runtime.pages[1].steps[0].id='unique';
 assert.deepEqual(pageStructureIssues(event.runtime),[]);
});
test('deeply nested imported scene structures reject boundedly and leave the project available to repair',()=>{
 const {project,map,event}=fixture();let action={id:'base',type:'say',text:'Hello'};
 for(let n=0;n<12;n++)action={id:'wrapper-'+n,type:'if',conditions:[],then:[action]};
 event.runtime.pages=broken([action]);
 assert.match(pageStructureIssues(event.runtime).join(' '),/nested too deeply/);
 assert.doesNotThrow(()=>sceneIssues(event,project,map));
 assert.throws(()=>assertNativeSceneExportReady(project,[map]),/nested too deeply/);
});
test('native preflight checks only included enabled scenes, with accurate visual page counts',()=>{
 const {project,map,event}=fixture();
 assert.equal(scenePageSummary(event.runtime),'1 action · 1 page');
 const page=addScenePage(event.runtime,uid);page.steps=[{id:uid(),type:'say',text:'Aipom has the key'}];
 assert.equal(scenePageSummary(event.runtime),'2 actions · 2 pages');
 assert.deepEqual(assertNativeSceneExportReady(project,[map]),{scenes:1,maps:1});
 const other=structuredClone(map);other.name='Excluded draft';other.markers[0].runtime.pages=[null];
 assert.deepEqual(assertNativeSceneExportReady(project,[map]),{scenes:1,maps:1});
 assert.throws(()=>assertNativeSceneExportReady(project,[other]),/Excluded draft/);
 other.markers[0].runtime.enabled=false;
 assert.deepEqual(assertNativeSceneExportReady(project,[other]),{scenes:0,maps:1});
 assert.equal(scenePageSummary({steps:[{},{}]}),'2 actions');
 assert.equal(scenePageSummary({pages:[null,{steps:[{}]}]}),'1 action · 2 pages');
});
test('page candidates with corrupted conditions cannot win preview priority',()=>{
 const {event}=fixture();
 const second=addScenePage(event.runtime,uid);
 second.conditions=[null];
 assert.equal(chooseScenePage(event.runtime,()=>true),event.runtime.pages[0]);
 assert.ok(pageStructureIssues(event.runtime).length);
 second.conditions=[{kind:'flag',flagId:'acquired'}];
 assert.equal(chooseScenePage(event.runtime,()=>true),second);
});

test('new event pages cannot reuse page or nested action IDs, even during first-time conversion',()=>{
 const {event}=fixture();
 const before=structuredClone(event.runtime);
 assert.throws(()=>addScenePage(event.runtime,()=>event.runtime.pages[0].id),/duplicate stable ID/);
 assert.deepEqual(event.runtime,before);
 const plain={action:'scene',steps:[{id:'base-action',type:'say',text:'Before pages'}]};
 const prior=structuredClone(plain);
 assert.throws(()=>addScenePage(plain,()=> 'same-id'),/duplicate stable ID/);
 assert.deepEqual(plain,prior);
 const good=addScenePage(plain,uid);
 assert.equal(plain.pages.length,2);
 assert.ok(plain.pages[0].steps[0].text.includes('Before pages'));
 assert.ok(good.steps.length);
 assert.equal(plain.steps.length,0);
 assert.deepEqual(pageStructureIssues(plain),[]);
});

test('production ROM export stops at malformed visual scene preflight before any source write',async()=>{
 const {GbaMaps}=await import('../dist/rom.js');
 const {syntheticROM}=await import('../scripts/synthetic-map-rom.mjs');
 const {buildRom}=await import('../dist/rom-writer.js');
 const {project,event}=fixture();
 event.runtime.pages=[{id:'invalid',name:'Bad import',conditions:[],steps:[{id:'action',type:'choice',yes:'broken'}]}];
 const bytes=syntheticROM(),reader=await new GbaMaps(bytes).discover(),snapshot=bytes.slice();
 await assert.rejects(buildRom(project,reader,{sourceId:'shattered-fixture',renderMap:async()=>({})}),/Victory Road gate \/ Aipom key cutscene \/ Pages/);
 assert.deepEqual(reader.bytes,snapshot);
});
