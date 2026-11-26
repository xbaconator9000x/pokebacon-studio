import test from 'node:test';
import assert from 'node:assert/strict';
import {storyEventName,storyEventLabel,storyEventCatalogue} from '../dist/story-readable.js';
const g={symbols:{variables:{0x40fe:'Oak parcel'}},edits:{},texts:{},nodes:{},roots:[]};
test('native event names read as plain language',()=>{
 assert.equal(storyEventName(g,{kind:'npcs',title:'NPC 1 · 4,5'}),'Character 1 at tile 4, 5');
 assert.equal(storyEventName(g,{kind:'signs',title:'Sign · 9,16'}),'Sign / interaction at tile 9, 16');
 assert.equal(storyEventName(g,{kind:'triggers',title:'Tile trigger · 2,3'}),'Walk-over trigger at tile 2, 3');
 assert.equal(storyEventName(g,{kind:'map condition',mapScriptType:2,title:'Map condition 40fe = 3'}),'Runs on this map while Oak parcel is 3');
 assert.equal(storyEventName(g,{kind:'map condition',mapScriptType:4,title:'Map condition 4010 = 1'}),'Runs when you arrive by door/warp while story value 0x4010 is 1');
 assert.equal(storyEventName(g,{kind:'other',title:'Odd one'}),'Odd one');
});
test('labels stay short and never include the raw table text',()=>{
 const long='Brock: '+'Welcome to the Gym, challenger, prepare yourself for a very long speech '.repeat(4),graph={...g,texts:{1200:{text:long}},nodes:{},roots:[]};
 const label=storyEventLabel(graph,{kind:'npcs',title:'NPC 7 · 2,3',previewAddress:1200});
 assert.ok(label.startsWith('Brock · Character 7 at tile 2, 3 — '),label);assert.ok(label.length<=90,label.length);assert.ok(!label.includes('NPC 7 ·'));
});
test('raw titles remain searchable',()=>{
 const graph={...g,roots:[{id:'a',mapName:'Viridian',mapKey:'3.1',kind:'npcs',title:'NPC 7 · 2,3',address:1,previewAddress:2}]};
 assert.equal(storyEventCatalogue(graph,{query:'NPC 7'}).total,1);assert.equal(storyEventCatalogue(graph,{query:'character 7'}).total,1);
});
