import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,validateProject} from '../dist/model.js';
import {newScene,prepareScene,addVariable,authoring} from '../dist/authoring-model.js';
import {addQuestFlag} from '../dist/quest-model.js';
import {enableScenePages,addScenePage} from '../dist/scene-pages.js';
import {questReferenceIndex} from '../dist/quest-reference-index.js';
import {planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';
let serial=0;const uid=()=> 'q-ref-'+(++serial);
function projectFixture(){
 const project=newProject('Multi-region quest tracker'),map=project.maps[0],other=structuredClone(map);
 other.id='test-route-2';other.name='Viridian supply outpost';other.markers=[];
 project.maps.push(other);
 const accepted=addQuestFlag(project,'Courier accepted','accepted'),
  complete=addQuestFlag(project,'Courier delivered','complete'),
  hidden=addQuestFlag(project,'Room entered','entered'),
  stray=addQuestFlag(project,'Unused planned milestone','unused');
 const counter=addVariable(project,'Times questioned',{bits:4,id:'asked'});
 const event=newScene(project,2,2);
 event.title='Courier request';event.runtime.repeat='once';event.runtime.conditions=[{kind:'flag',flagId:accepted.id,value:true}];
 enableScenePages(event.runtime,uid);
 event.runtime.pages[0].steps=[{id:uid(),type:'flag',flagId:accepted.id,value:true},{id:uid(),type:'add',variableId:counter.id,value:1}];
 const second=addScenePage(event.runtime,uid);
 second.conditions=[{kind:'flag',flagId:complete.id,value:false}];
 second.steps=[{id:uid(),type:'choice',text:'Deliver it?',yes:[
  {id:uid(),type:'if',conditions:[{kind:'variable',variableId:counter.id,value:2}],then:[{id:uid(),type:'flag',flagId:complete.id,value:true}],else:[]}
 ],no:[]}];
 event.runtime.repeatSteps=[{id:uid(),type:'flag',flagId:complete.id,value:false}];
 prepareScene(project,event);map.markers.push(event);
 other.fieldObjects=[{id:'gate',name:'Opened gate',kind:'cut',completionFlag:complete.id,permanent:true}];
 authoring(project).presentation.visitFlags={[other.id]:hidden.id};
 const linked=newScene(project,2,3);linked.title='Linked test';linked.runtime.conditions=[{kind:'event',eventId:event.id,value:true},{kind:'visited',mapId:other.id}];prepareScene(project,linked);other.markers.push(linked);
 return{project,map,other,event,accepted,complete,hidden,stray,counter,linked};
}
test('quest dependency explorer traces paged, nested, linked, field, visited, and repeat usage without mutating the project',()=>{
 const {project,map,other,event,accepted,complete,hidden,stray,counter,linked}=projectFixture(),snapshot=JSON.stringify(project);
 const result=questReferenceIndex(project);
 const use=(kind,id)=>(kind==='flag'?result.flags:result.variables).get(id)||[];
 assert.ok(use('flag',accepted.id).some(row=>/requirement/.test(row.detail)));
 assert.ok(use('flag',accepted.id).some(row=>/action/.test(row.detail)));
 assert.ok(use('flag',complete.id).some(row=>/Page 2/.test(row.detail)));
 assert.ok(use('flag',complete.id).some(row=>/Repeat/.test(row.detail)));
 assert.ok(use('flag',complete.id).some(row=>row.category==='field'&&row.mapId===other.id));
 assert.ok(use('flag',hidden.id).some(row=>row.category==='presentation'));
 assert.ok(use('flag',hidden.id).some(row=>row.eventId===linked.id&&/visited/.test(row.detail)));
 assert.ok(use('variable',counter.id).some(row=>/Page 1/.test(row.detail)));
 assert.ok(use('variable',counter.id).some(row=>/Page 2/.test(row.detail)));
 assert.ok(use('flag',counter.bitIds[0]).some(row=>/Reserved counter storage bit/.test(row.detail)));
 assert.equal(use('flag',stray.id).length,0);
 assert.ok(result.usedFlags>=3);
 assert.equal(result.usedVariables,1);
 assert.equal(result.missing.length,0);
 assert.equal(JSON.stringify(project),snapshot);
});
test('quest dependency explorer respects disabled scenes, corrupted imports and missing links',()=>{
 const {project,event,accepted,counter}=projectFixture();
 event.runtime.enabled=false;
 const refs=questReferenceIndex(project);
 assert.equal(refs.flags.get(accepted.id).length,0);
 assert.equal(refs.variables.get(counter.id).some(row=>row.category==='storage'),false);
 // Counter storage still reserves bits, but the counter itself is unused.
 assert.equal(refs.variables.get(counter.id).length,0);
 event.runtime.enabled=true;event.runtime.pages=[null,{enabled:true,steps:[{type:'choice',yes:'corrupt'}],conditions:[null,{kind:'flag',flagId:'unknown'}]}];
 const result=questReferenceIndex(project);
 assert.ok(result.missing.some(row=>row.id==='unknown'));
 assert.ok(result.references.every(row=>row.mapName));
 assert.throws(()=>questReferenceIndex(project,{limit:2}),/safety limit/);
});
test('quest references preserve page/branch identities through project save/reopen',()=>{
 const {project}=projectFixture();
 const before=questReferenceIndex(project);
 const plan=planSave(project),parts=new Map(plan.parts.map(p=>[p.id,structuredClone(p.value)]));
 const restored=assembleSavedProject(plan.header,savedProjectKeys(plan.header).map(id=>parts.get(id)));
 const after=questReferenceIndex(restored);
 assert.deepEqual(after.references,before.references);
 assert.deepEqual([...after.flags.keys()],[...before.flags.keys()]);
 assert.deepEqual([...after.variables.keys()],[...before.variables.keys()]);
});

test('original engine flags in conditional visual scenes are indexed separately from project quest bits',()=>{
 const {project,event,accepted}=projectFixture();
 event.runtime.steps=[{id:uid(),type:'nativeFlagIf',nativeFlagId:0x200,then:[{id:uid(),type:'flag',flagId:accepted.id,value:true}],else:[{id:uid(),type:'nativeFlagIf',nativeFlagId:0x201,then:[],else:[]}]}];
 delete event.runtime.pages;
 const snapshot=JSON.stringify(project),result=questReferenceIndex(project);
 assert.equal(result.nativeFlags.get(0x200)?.length,1);
 assert.equal(result.nativeFlags.get(0x201)?.length,1);
 assert.equal(result.nativeFlags.get(0x200)[0].eventId,event.id);
 assert.match(result.nativeFlags.get(0x200)[0].detail,/original ROM only/);
 assert.ok(!result.flags.has(0x200));
 assert.ok(result.flags.get(accepted.id).some(x=>/action/.test(x.detail)));
 assert.equal(JSON.stringify(project),snapshot);
 const save=planSave(project),parts=new Map(save.parts.map(p=>[p.id,structuredClone(p.value)]));
 const reopened=assembleSavedProject(save.header,savedProjectKeys(save.header).map(k=>parts.get(k)));
 assert.deepEqual([...questReferenceIndex(reopened).nativeFlags.entries()],[...result.nativeFlags.entries()]);
});
