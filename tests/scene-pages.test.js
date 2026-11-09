import test from 'node:test';
import assert from 'node:assert/strict';
import {addScenePage,chooseScenePage,enableScenePages,pageStructureIssues} from '../dist/scene-pages.js';
let count=0;const id=()=>`page-${++count}`;
test('pages retain old actions and use the highest matching enabled page',()=>{const runtime={action:'scene',steps:[{type:'say',text:'Base'}]};const pages=enableScenePages(runtime,id);const later=addScenePage(runtime,id);later.conditions=[{kind:'flag',flagId:'done'}];later.steps=[{type:'say',text:'Later'}];assert.equal(runtime.steps.length,0);assert.equal(chooseScenePage(runtime,c=>c.flagId==='done'),later);assert.equal(chooseScenePage(runtime,()=>false),pages[0]);later.enabled=false;assert.equal(chooseScenePage(runtime,()=>true),pages[0]);});
test('pages reject duplicate identities and empty actions',()=>{const issues=pageStructureIssues({pages:[{id:'same',name:'First',conditions:[],steps:[{type:'say'}]},{id:'same',name:'Second',conditions:[],steps:[]}]}).join(' ');assert.match(issues,/duplicate stable ID/);assert.match(issues,/needs 1–256 actions/);});
