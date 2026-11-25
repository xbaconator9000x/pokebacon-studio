import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newProject} from '../dist/model.js';
import {newScene} from '../dist/authoring-model.js';
import {eventRecipe} from '../dist/event-recipes.js';
import {auditEventWorkflows} from '../dist/event-audit.js';
function fixture(){
 const project=newProject(),map=project.maps[0];
 const event=eventRecipe('dialogue');Object.assign(event,{id:'talk-1',x:1,y:1});
 map.markers.push(event);
 return {project,map,event};
}
test('project-wide read-only event audit reports healthy events without rewriting source records',()=>{
 const {project,event}=fixture();
 const before=JSON.stringify(project);
 const report=auditEventWorkflows(project);
 assert.equal(report.scanned,1);
 assert.equal(report.records[0].eventId,event.id);
 assert.equal(report.errors,0);
 assert.equal(report.warnings,0);
 assert.equal(JSON.stringify(project),before);
});
test('event audit detects overlapping triggers, unfinished persistent completion and reward-first trades',()=>{
 const {project,map,event}=fixture();
 const next=eventRecipe('gift');Object.assign(next,{id:'gift-2',x:1,y:1});
 next.runtime.steps=[{type:'item',operation:'give',itemId:4,quantity:1},{type:'item',operation:'take',itemId:13,quantity:1}];
 map.markers.push(next);
 const result=auditEventWorkflows(project);
 assert.equal(result.scanned,2);
 const a=result.records.find(x=>x.eventId===event.id),b=result.records.find(x=>x.eventId===next.id);
 assert.ok(a.issues.some(x=>/share this trigger/.test(x.message)));
 assert.ok(b.issues.some(x=>/Trade action/.test(x.message)));
 assert.ok(b.issues.some(x=>/not been saved/.test(x.message)));
});
test('one-time saved completion reuses project flags only with explicit warnings across different events',()=>{
 const {project,map,event}=fixture();
 project.questFlags=[{id:'same',name:'Shared',slot:0}];
 project.questToken=55;
 event.runtime.onceFlag='same';
 const second=eventRecipe('dialogue');Object.assign(second,{id:'talk-2',x:5,y:6});
 second.runtime.onceFlag='same';map.markers.push(second);
 const result=auditEventWorkflows(project);
 assert.ok(result.records.every(r=>r.issues.some(x=>/persistent completion flag is shared/.test(x.message))));
});
test('broken imported scene page stays inspectable and generates a specific error',()=>{
 const {project,map}=fixture(),scene=newScene(project,2,2);
 scene.id='invalid-scene';
 scene.runtime.pages=[{id:'bad',name:'Broken page',conditions:[],steps:[{id:'bad-action',type:'choice',yes:'not an action array'}]}];
 map.markers.push(scene);
 const result=auditEventWorkflows(project);
 assert.equal(result.scanned,2);
 assert.ok(result.records.find(x=>x.eventId===scene.id).issues.some(x=>x.severity==='error'));
 assert.equal(map.markers.at(-1).runtime.pages[0].steps[0].yes,'not an action array');
});
test('event audit bounds the number of event records it will scan',()=>{
 const {project,map}=fixture();
 map.markers.push({...eventRecipe('dialogue'),id:'talk-2',x:3,y:3});
 assert.throws(()=>auditEventWorkflows(project,{limit:1}),/audit cap/);
 assert.throws(()=>auditEventWorkflows(project,{limit:10001}),/bounded/);
});
test('Android event hub exposes cross-map diagnostic filtering and directs scenes to their authoring editor',()=>{
 const ui=readFileSync(new URL('../dist/event-ui.js',import.meta.url),'utf8');
 for(const key of ['eventAudit','auditEventWorkflows(','eventAuditFilter','eventAuditList','data-audit-row','api.scenes().edit('])assert.ok(ui.includes(key),key);
});
