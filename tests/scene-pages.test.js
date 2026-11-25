import test from 'node:test';
import assert from 'node:assert/strict';
import {addScenePage,chooseScenePage,enableScenePages,pageStructureIssues,replaceScenePagesFromJson} from '../dist/scene-pages.js';
let count=0;const id=()=>`page-${++count}`;
test('pages retain old actions and use the highest matching enabled page',()=>{const runtime={action:'scene',steps:[{type:'say',text:'Base'}]};const pages=enableScenePages(runtime,id);const later=addScenePage(runtime,id);later.conditions=[{kind:'flag',flagId:'done'}];later.steps=[{type:'say',text:'Later'}];assert.equal(runtime.steps.length,0);assert.equal(chooseScenePage(runtime,c=>c.flagId==='done'),later);assert.equal(chooseScenePage(runtime,()=>false),pages[0]);later.enabled=false;assert.equal(chooseScenePage(runtime,()=>true),pages[0]);});
test('pages reject duplicate identities and empty actions',()=>{const issues=pageStructureIssues({pages:[{id:'same',name:'First',conditions:[],steps:[{type:'say'}]},{id:'same',name:'Second',conditions:[],steps:[]}]}).join(' ');assert.match(issues,/duplicate stable ID/);assert.match(issues,/needs 1–256 actions/);});

test('duplicating a page creates distinct IDs throughout nested branches without modifying the source',()=>{
 let serial=100;const next=()=>String(++serial);
 const runtime={action:'scene',pages:[{id:'original',name:'Aipom rescue',enabled:true,conditions:[],steps:[
  {id:'ask',type:'choice',text:'Help?',yes:[{id:'yes',type:'if',conditions:[],then:[{id:'then',type:'say',text:'Thanks'}],else:[{id:'else',type:'abort'}]}],no:[{id:'no',type:'say',text:'Later'}]},
  {id:'menu',type:'answers',text:'Choose',choices:[{label:'One',steps:[{id:'one',type:'say',text:'One'}]},{label:'Two',steps:[{id:'two',type:'say',text:'Two'}]}],cancel:[{id:'cancel',type:'abort'}]}
 ]}]};
 const original=structuredClone(runtime);
 const copy=addScenePage(runtime,next,runtime.pages[0]);
 assert.deepEqual(runtime.pages[0],original.pages[0]);
 const ids=steps=>steps.flatMap(step=>[step.id,...['yes','no','then','else','cancel'].flatMap(k=>Array.isArray(step[k])?ids(step[k]):[]),...(step.choices||[]).flatMap(c=>ids(c.steps))]);
 const first=ids(runtime.pages[0].steps),second=ids(copy.steps);
 assert.equal(first.length,second.length);
 assert.equal(new Set([...first,...second]).size,first.length+second.length);
 assert.equal(copy.name,'Aipom rescue copy');
 assert.deepEqual(pageStructureIssues(runtime),[]);
 assert.deepEqual(copy.conditions,runtime.pages[0].conditions);
 copy.steps[0].yes[0].then[0].text='Different';
 assert.equal(runtime.pages[0].steps[0].yes[0].then[0].text,'Thanks');
});
test('page addition validates the draft before changing a single-page scene',()=>{
 const runtime={action:'scene',steps:[{id:'base',type:'say',text:'Unchanged'}]};
 assert.throws(()=>addScenePage(runtime,()=>'',{id:'invalid',name:'Bad',conditions:[],steps:[{type:'say'}]}),/new event page|invalid|stable ID/i);
 assert.deepEqual(runtime,{action:'scene',steps:[{id:'base',type:'say',text:'Unchanged'}]});
 const id=()=>String(Math.random());
 const full={action:'scene',pages:Array.from({length:16},(_,i)=>({id:'p'+i,name:'Page '+i,enabled:true,conditions:[],steps:[{id:'s'+i,type:'say',text:'Text'}]}))};
 const prior=structuredClone(full);
 assert.throws(()=>addScenePage(full,id),/at most 16/);
 assert.deepEqual(full,prior);
});
test('corrupt page arrays stay diagnosable instead of crashing priority selection',()=>{
 for(const pages of [[],{},[null],[{id:'one',name:'one',enabled:true,conditions:'oops',steps:[]}],Array(17).fill(null)]){
  const runtime={action:'scene',pages,steps:[]};
  assert.ok(pageStructureIssues(runtime).length);
  assert.doesNotThrow(()=>chooseScenePage(runtime,()=>true));
 }
});
test('native page prerequisites survive a project save and compile to FRLG script bytes',async()=>{
 const {newProject,validateProject}=await import('../dist/model.js');
 const {newScene,prepareScene,sceneIssues}=await import('../dist/authoring-model.js');
 const {addQuestFlag}=await import('../dist/quest-model.js');
 const {eventSource}=await import('../dist/event-model.js');
 const {installQuest,QUEST_SOURCE_SHA}=await import('../dist/quest-runtime.js');
 const {compileScript}=await import('../dist/script-engine.js');
 const {planSave,savedProjectKeys,assembleSavedProject}=await import('../dist/project-store.js');
 const project=newProject(),map=project.maps[0],flag=addQuestFlag(project,'Gate key collected'),n=newScene(project,3,3);
 enableScenePages(n.runtime,()=> 'base');
 const page=addScenePage(n.runtime,()=> 'key-page');
 page.conditions=[{kind:'flag',flagId:flag.id,value:true}];
 n.runtime.pages[0].steps=[{id:'old',type:'say',text:'Find the key.'}];
 page.steps=[{id:'new',type:'say',text:'Gate unlocked.'}];
 prepareScene(project,n);map.markers.push(n);
 assert.deepEqual(sceneIssues(n,project,map),[]);
 validateProject(project);
 const plan=planSave(project),parts=new Map(plan.parts.map(part=>[part.id,structuredClone(part.value)]));
 const reopened=assembleSavedProject(plan.header,savedProjectKeys(plan.header).map(id=>parts.get(id)));
 const restored=reopened.maps[0].markers[0];
 assert.equal(restored.runtime.pages[1].conditions[0].flagId,flag.id);
 const quest=installQuest({allocate(){return 0x1000000;}},QUEST_SOURCE_SHA,reopened.questToken);
 const source=eventSource(restored,{project:reopened,map:reopened.maps[0],questRuntime:quest,questFlags:reopened.questFlags,gameProfile:{engine:'frlg',itemCount:400,speciesCount:500,trainerCount:500}});
 assert.match(source,/Gate unlocked/);
 assert.match(source,/Find the key/);
 assert.ok(source.indexOf('Gate unlocked')>=0);
 assert.match(source,/goto_if 1/);
 assert.ok(compileScript(source,0x1001000,'frlg').bytes.length>0);
});

test('scene diagnostics report malformed page imports and invalid nested actions instead of throwing',async()=>{
 const {newProject}=await import('../dist/model.js');
 const {newScene,sceneIssues}=await import('../dist/authoring-model.js');
 const project=newProject(),map=project.maps[0],n=newScene(project,2,2);
 n.runtime.pages=[{id:'bad',name:'Broken',enabled:true,conditions:'not-an-array',steps:[]}];
 let issues;assert.doesNotThrow(()=>issues=sceneIssues(n,project,map));
 assert.ok(issues.some(issue=>issue.path==='Pages'&&/prerequisite|action/.test(issue.message)));
 delete n.runtime.pages;
 n.runtime.steps=[{id:'nested',type:'choice',yes:'not-an-array'}];
 assert.doesNotThrow(()=>issues=sceneIssues(n,project,map));
 assert.ok(issues.some(issue=>issue.path==='Actions'&&/list/.test(issue.message)));
});

test('manual JSON page repair is validation-first, leaves malformed imported data untouched until accepted',()=>{
 const runtime={action:'scene',pages:[{id:'a',name:'A',conditions:'corrupt',steps:[{id:'x',type:'say',text:'Hello'}]}]};
 const before=structuredClone(runtime);
 for(const input of ['{not-json}',JSON.stringify([]),JSON.stringify([{id:'a',name:'Broken',conditions:null,steps:[]}]),'a'.repeat(2_000_001)]){
  assert.throws(()=>replaceScenePagesFromJson(runtime,input));
  assert.deepEqual(runtime,before);
 }
 const repaired=[{id:'a',name:'Recovered',enabled:true,conditions:[],steps:[{id:'x',type:'say',text:'Hello'}]}];
 assert.deepEqual(replaceScenePagesFromJson(runtime,JSON.stringify(repaired)),repaired);
 repaired[0].steps[0].text='Changed externally';
 assert.equal(runtime.pages[0].steps[0].text,'Hello');
 assert.deepEqual(pageStructureIssues(runtime),[]);
});

test('invalid pages never crash quest adapter detection or native event validation',async()=>{
 const {newProject}=await import('../dist/model.js');
 const {newScene}=await import('../dist/authoring-model.js');
 const {needsQuest,validateEvent}=await import('../dist/event-model.js');
 const project=newProject(),n=newScene(project,1,1);
 for(const pages of [[null],[{id:'one',name:'broken',conditions:'invalid',steps:[]}],[]]){
  n.runtime.pages=pages;
  assert.equal(needsQuest(n),false);
  assert.throws(()=>validateEvent(n,project),/Repair the invalid event pages/);
 }
 delete n.runtime.pages;
 n.runtime.steps=[{id:'nested',type:'choice',yes:'invalid'}];
 assert.equal(needsQuest(n),false);
 assert.throws(()=>validateEvent(n,project),/action queue must be a list/i);
});
