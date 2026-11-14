import test from 'node:test';
import assert from 'node:assert/strict';
import {compileScript} from '../dist/script-engine.js';
import {newProject} from '../dist/model.js';
import {newScene} from '../dist/authoring-model.js';
import {sceneSource} from '../dist/scene-compiler.js';
import {eventSource,validateEvent} from '../dist/event-model.js';
import {eventRecipes,eventRecipe} from '../dist/event-recipes.js';
import {eventPreset} from '../dist/event-presets.js';
import {previewItemTrade,validateItemTrade,nativeItemTradeSource} from '../dist/event-trade.js';

const trade={type:'trade',fromItemId:13,fromQuantity:2,toItemId:4,toQuantity:3,notify:true};
test('preview trade calculates a proposed inventory without changing the original Bag',()=>{
 const bag=new Map([[13,4],[99,1]]);
 const original=[...bag.entries()];
 const result=previewItemTrade(bag,trade,{slotLimit:3});
 assert.equal(result.ok,true);
 assert.equal(result.next.get(13),2);
 assert.equal(result.next.get(4),3);
 assert.deepEqual([...bag.entries()],original);
 assert.equal(result.reason,null);
});
test('failed trades do not lose player items or add a reward',()=>{
 const bag=new Map([[13,1],[99,1]]),before=[...bag.entries()];
 const missing=previewItemTrade(bag,trade,{slotLimit:3});
 assert.equal(missing.ok,false);assert.equal(missing.reason,'missing');assert.equal(missing.next,null);
 const full=new Map([[13,2],[99,1]]);
 const noSlot=previewItemTrade(full,trade,{slotLimit:2});
 assert.equal(noSlot.reason,'bag-full');assert.equal(noSlot.next,null);
 const fullStack=new Map([[13,3],[4,998]]);
 assert.equal(previewItemTrade(fullStack,trade).reason,'bag-full');
 assert.deepEqual([...bag.entries()],before);
 assert.equal(full.get(13),2);
});
test('invalid same-item, zero quantity and unsupported ROM item IDs fail closed',()=>{
 for(const step of [{...trade,toItemId:13},{...trade,fromQuantity:0},{...trade,toQuantity:1000},{...trade,toItemId:0}]){
  assert.throws(()=>validateItemTrade(step),/different native items/);
 }
 assert.throws(()=>validateItemTrade(trade,{itemCount:20,itemIds:[13]}),/not initialized/);
 assert.throws(()=>previewItemTrade(new Map([[13,3]]),trade,{slotLimit:-1}),/capacity/);
});
test('both native engines check source and Bag before removing payment, then refund unexpected award failure',()=>{
 for(const [engine,fanfare] of [['frlg',258],['rse',370]]){
  const event={runtime:{action:'sequence',trigger:'interact',steps:[trade]}};
  const script=eventSource(event,{gameProfile:{engine,itemCount:400,itemIds:[13,4]}});
  const index=(needle)=>script.indexOf(needle);
  assert.ok(index('checkitem 13 2')<index('checkitemspace 4 3'));
  assert.ok(index('checkitemspace 4 3')<index('removeitem 13 2'));
  assert.ok(index('removeitem 13 2')<index('additem 4 3'));
  assert.match(script,/additem 4 3[\s\S]*additem 13 2/,'failed native award explicitly refunds payment');
  assert.match(script,new RegExp('playfanfare '+fanfare));
  assert.match(script,/waitfanfare/);
  assert.equal((script.match(/Obtained /g)||[]).length,1);
  assert.ok(compileScript(script,0,engine).bytes.length>0);
 }
});
test('visual scene uses the identical checked transaction source and actual native script compiler',()=>{
 for(const engine of ['frlg','rse']){
  const project=newProject(),map=project.maps[0],n=newScene(project,1,1);
  n.runtime.steps=[{id:'native-item-exchange',...trade}];
  const script=sceneSource(n,{project,map,gameProfile:{engine,itemCount:400,itemIds:[13,4]}});
  assert.match(script,/checkitem 13 2/);
  assert.match(script,/checkitemspace 4 3/);
  assert.match(script,/additem 13 2/);
  assert.match(script,/goto @scene_end/);
  assert.ok(compileScript(script,0,engine).bytes.length>0);
 }
});
test('existing exchange and fetch recipes now use one native trade rather than a reward-first pair',()=>{
 const recipes=eventRecipes();
 assert.ok(recipes.barter);
 for(const name of ['quest','barter']){
  const event=eventRecipe(name);
  assert.equal(event.runtime.steps.filter(s=>s.type==='trade').length,1);
  assert.equal(event.runtime.steps.some(s=>s.type==='item'),false);
  validateEvent(event,{maps:[],questFlags:[]});
 }
 const project=newProject();
 for(const name of ['fetch','exchange']){
  const event=eventPreset(project,name,1,1);
  const [choice]=event.runtime.steps;
  assert.equal(choice.type,'choice');
  assert.equal(choice.yes.filter(s=>s.type==='trade').length,1);
  assert.equal(choice.yes.filter(s=>s.type==='item').length,0);
 }
});
test('short native trading scripts can omit fanfares when explicitly disabled',()=>{
 const script=nativeItemTradeSource({...trade,notify:false},'silent',{gameProfile:{engine:'frlg',itemCount:400},end:'@scene_end'});
 assert.doesNotMatch(script.commands.join('\n'),/playfanfare|bufferitemname/);
 assert.equal(script.data.filter(s=>s.includes('Obtained')).length,0);
});
