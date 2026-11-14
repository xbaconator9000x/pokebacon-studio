import test from 'node:test';
import assert from 'node:assert/strict';
import {
 addScenePage,enableScenePages,createScenePageClipboard,
 pasteScenePageClipboard,cloneSceneForNewEvent,pageStructureIssues
} from '../dist/scene-pages.js';
import {newProject,validateProject} from '../dist/model.js';
import {newScene,prepareScene,sceneIssues} from '../dist/authoring-model.js';
import {addQuestFlag} from '../dist/quest-model.js';
import {eventSource} from '../dist/event-model.js';
import {compileScript} from '../dist/script-engine.js';
import {installQuest,QUEST_SOURCE_SHA} from '../dist/quest-runtime.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';

function ids(steps){
 return steps.flatMap(step=>[
  step.id,...['yes','no','then','else','cancel'].flatMap(key=>Array.isArray(step[key])?ids(step[key]):[]),
  ...(step.choices||[]).flatMap(choice=>[choice.id,...ids(choice.steps||[])])
 ]).filter(Boolean);
}
function nextIds(){let i=0;return()=> 'copy-identity-'+(++i);}

test('copy an authored page to another scene, retain branch content and give every nested answer a new identity',()=>{
 const project=newProject(),flag=addQuestFlag(project,'Received the parcel');
 const source=newScene(project,2,2);
 enableScenePages(source.runtime,()=> 'original-page');
 source.runtime.pages[0].conditions=[{kind:'flag',flagId:flag.id,value:true}];
 source.runtime.pages[0].steps=[{
  id:'ask',type:'answers',text:'Your reward?',choices:[
   {id:'choice-one',label:'Potion',steps:[{id:'item-one',type:'item',itemId:13,quantity:1,operation:'give'}]},
   {id:'choice-two',label:'Money',steps:[{id:'money-two',type:'money',amount:200,operation:'give'}]}
  ],cancel:[{id:'cancel-action',type:'say',text:'Maybe later.'}]
 }];
 const before=structuredClone(source),clipboard=createScenePageClipboard(project.id,source.runtime.pages[0]);
 const target=newScene(project,4,4),id=nextIds();
 const pasted=pasteScenePageClipboard(target.runtime,clipboard,project.id,id);
 assert.equal(target.runtime.pages.length,2);
 assert.equal(target.runtime.pages[0].steps[0].text,'Hello there!');
 assert.deepEqual(pasted.conditions,source.runtime.pages[0].conditions);
 assert.equal(pasted.steps[0].choices[0].steps[0].itemId,13);
 assert.equal(pasted.steps[0].choices[1].steps[0].amount,200);
 const original=ids(source.runtime.pages[0].steps),fresh=ids(pasted.steps);
 assert.equal(new Set([...original,...fresh]).size,original.length+fresh.length);
 assert.deepEqual(pageStructureIssues(target.runtime),[]);
 pasted.steps[0].choices[0].steps[0].itemId=40;
 assert.equal(source.runtime.pages[0].steps[0].choices[0].steps[0].itemId,13);
 assert.deepEqual(source,before);
});
test('clipboard refuses another project, malformed source or a full scene without partially editing its target',()=>{
 const project=newProject(),source=newScene(project,2,2);
 const page={id:'page-a',name:'Original',enabled:true,conditions:[],steps:[{id:'say-a',type:'say',text:'Original'}]};
 const clipboard=createScenePageClipboard(project.id,page),target=newScene(project,3,3),before=structuredClone(target);
 assert.throws(()=>pasteScenePageClipboard(target.runtime,clipboard,'different-project',nextIds()),/same open project/);
 assert.deepEqual(target,before);
 clipboard.page.steps=[{id:'same',type:'say'},{id:'same',type:'say'}];
 assert.throws(()=>pasteScenePageClipboard(target.runtime,clipboard,project.id,nextIds()),/invalid/);
 assert.deepEqual(target,before);
 assert.throws(()=>createScenePageClipboard(project.id,{...page,conditions:'broken'}),/Repair/);
 const filled={action:'scene',pages:Array.from({length:16},(_,i)=>({id:'page-'+i,name:'Page '+i,conditions:[],steps:[{id:'action-'+i,type:'say',text:'Hi'}]}))};
 const snapshot=structuredClone(filled);
 assert.throws(()=>pasteScenePageClipboard(filled,createScenePageClipboard(project.id,page),project.id,nextIds()),/at most 16/);
 assert.deepEqual(filled,snapshot);
});
test('duplicate a native-imported multi-page scene without copying old source bindings or save identities',()=>{
 const project=newProject(),source=newScene(project,2,2);
 source.rom={type:'npc',sourceId:'original-source',localId:7,index:3};
 source.npc={localId:7};
 source.runtime.importedNative={version:1,sourceId:'original-source',rootId:'npc-3'};
 source.runtime.completionFlag='old-completion';
 source.runtime.areaActiveFlag='old-area';
 source.runtime.trigger='radius';source.runtime.radius=2;
 enableScenePages(source.runtime,()=> 'source-page');
 source.runtime.pages[0].steps=[{id:'base-action',type:'choice',text:'Help?',yes:[{id:'yes-action',type:'say',text:'Yes'}],no:[{id:'no-action',type:'say',text:'No'}]}];
 source.runtime.repeatSteps=[{id:'repeat-action',type:'say',text:'Again'}];
 const before=structuredClone(source),copy=cloneSceneForNewEvent(source,nextIds());
 assert.notEqual(copy.id,source.id);
 assert.equal(copy.rom,undefined);assert.equal(copy.npc,undefined);
 assert.equal(copy.runtime.importedNative,undefined);
 assert.equal(copy.runtime.completionFlag,undefined);assert.equal(copy.runtime.areaActiveFlag,undefined);
 const oldIds=[...ids(source.runtime.pages[0].steps),...ids(source.runtime.repeatSteps)];
 const freshIds=[...ids(copy.runtime.pages[0].steps),...ids(copy.runtime.repeatSteps)];
 assert.equal(new Set([...oldIds,...freshIds]).size,oldIds.length+freshIds.length);
 assert.deepEqual(pageStructureIssues(copy.runtime),[]);
 assert.deepEqual(source,before);
});
test('cross-scene page paste persists and compiles source-grounded native scripts',()=>{
 const project=newProject(),map=project.maps[0],flag=addQuestFlag(project,'Gate open');
 const source=newScene(project,2,2),target=newScene(project,4,4);
 enableScenePages(source.runtime,()=> 'source-base');
 source.runtime.pages[0].conditions=[{kind:'flag',flagId:flag.id,value:true}];
 source.runtime.pages[0].steps=[{id:'source-dialogue',type:'say',text:'Gate unlocked.'}];
 const paste=pasteScenePageClipboard(target.runtime,createScenePageClipboard(project.id,source.runtime.pages[0]),project.id,nextIds());
 assert.equal(paste.steps[0].text,'Gate unlocked.');
 for(const scene of [source,target]){prepareScene(project,scene);map.markers.push(scene);}
 assert.deepEqual(sceneIssues(target,project,map),[]);
 validateProject(project);
 const plan=planSave(project),parts=new Map(plan.parts.map(part=>[part.id,structuredClone(part.value)]));
 const restored=assembleSavedProject(plan.header,savedProjectKeys(plan.header).map(k=>parts.get(k)));
 const actual=restored.maps[0].markers.find(n=>n.id===target.id);
 assert.equal(actual.runtime.pages[1].steps[0].text,'Gate unlocked.');
 const quest=installQuest({allocate(){return 0x1000000;}},QUEST_SOURCE_SHA,restored.questToken);
 const script=eventSource(actual,{project:restored,map:restored.maps[0],questRuntime:quest,questFlags:restored.questFlags,gameProfile:{engine:'frlg',itemCount:400,speciesCount:500,trainerCount:500}});
 assert.match(script,/Gate unlocked/);
 assert.match(script,/goto_if 1/);
 assert.ok(compileScript(script,0x1001000,'frlg').bytes.length>0);
});
test('the mobile event-page editor exposes real copy/paste controls and safe duplication wiring',async()=>{
 const {readFileSync}=await import('node:fs');
 const ui=readFileSync(new URL('../dist/scene-ui.js',import.meta.url),'utf8');
 assert.match(ui,/id="scenePageCopy"/);
 assert.match(ui,/id="scenePagePaste"/);
 assert.match(ui,/createScenePageClipboard\(api\.project\(\)\.id,page\)/);
 assert.match(ui,/pasteScenePageClipboard\(r,state\.pageClipboard,api\.project\(\)\.id,uid\)/);
 assert.match(ui,/cloneSceneForNewEvent\(n,uid\)/);
});
