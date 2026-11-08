import test from 'node:test';
import assert from 'node:assert/strict';
import {storyEventCatalogue} from '../dist/story-readable.js';
const graph=()=>({roots:[{id:'gate',mapName:'Viridian Gate',mapKey:'3.1',kind:'npcs',title:'NPC 7 · 2,3',address:600,previewAddress:1200},{id:'forest',mapName:'Forest',mapKey:'4.0',kind:'triggers',title:'Tile trigger · 4,8',address:800,previewAddress:1300}],nodes:{600:{args:[{kind:'text',value:0x080004b0}],edges:[{to:700}]},700:{args:[{kind:'text',value:0x080004c0}],edges:[{to:600}]},800:{opaque:true,args:[],edges:[]}},texts:{1200:{text:'Ren: Stay inside.'},1216:{text:'Find the Aipom key.'},1300:{text:'Beware the forest.'}},edits:{commands:{},texts:{}}});
test('find existing events by map, speaker, secondary dialogue, type and address',()=>{
 const g=graph(),before=structuredClone(g);
 for(const query of ['Ren','Viridian key','Aipom','0x258','NPC 7'])assert.equal(storyEventCatalogue(g,{query}).rows[0].root.id,'gate');
 assert.equal(storyEventCatalogue(g,{kind:'triggers'}).rows[0].root.id,'forest');
 assert.equal(storyEventCatalogue(g,{query:'Ren',mapKey:'4.0'}).total,0);
 assert.equal(storyEventCatalogue(g,{query:'absent'}).total,0);
 assert.deepEqual(g,before);
});
test('pending dialogue appears in search; results cap does not hide match count',()=>{
 const g=graph();g.edits.texts[1216]={text:'Bring a medicine kit.'};
 assert.equal(storyEventCatalogue(g,{query:'medicine'}).total,1);
 assert.equal(storyEventCatalogue(g,{query:'Aipom'}).total,0);
 const capped=storyEventCatalogue(g,{limit:1});assert.equal(capped.total,2);assert.equal(capped.rows.length,1);
 assert.deepEqual(storyEventCatalogue(undefined),{total:0,rows:[]});
});
