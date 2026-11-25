import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHexNavigation,currentHexLocation,visitHexLocation,moveHexHistory,canMoveHexHistory,findHexAnchor} from '../dist/hma-hex-navigation.js';

test('hex navigation records visits and discards forward locations after a new jump',()=>{
 let history=createHexNavigation(0x20);
 history=visitHexLocation(history,0x120);
 history=visitHexLocation(history,0x220);
 assert.equal(currentHexLocation(history),0x220);
 history=moveHexHistory(history,-1);
 assert.equal(currentHexLocation(history),0x120);
 assert.equal(canMoveHexHistory(history,-1),true);
 assert.equal(canMoveHexHistory(history,1),true);
 history=visitHexLocation(history,0x180);
 assert.deepEqual(history.entries,[0x20,0x120,0x180]);
 assert.equal(canMoveHexHistory(history,1),false);
});

test('hex navigation has bounded history and safe edge movement',()=>{
 let history=createHexNavigation(0);
 for(let at=1;at<140;at++)history=visitHexLocation(history,at);
 assert.equal(history.entries.length,128);
 assert.equal(currentHexLocation(history),139);
 history=moveHexHistory(history,1);
 assert.equal(currentHexLocation(history),139);
 history=moveHexHistory(history,-1);
 assert.equal(currentHexLocation(history),138);
 assert.throws(()=>visitHexLocation(history,-1),/valid source-ROM offset/);
});

test('named anchor lookup is exact, case-insensitive and fails closed',()=>{
 const anchors=[{name:'gSpecies',at:0x1c000},{name:'Moves',at:0x2c000}];
 assert.deepEqual(findHexAnchor(anchors,' Gspecies '),anchors[0]);
 assert.throws(()=>findHexAnchor(anchors,''),/Enter a named/);
 assert.throws(()=>findHexAnchor(anchors,'items'),/No named/);
 assert.throws(()=>findHexAnchor([{name:'Items',at:1},{name:'ITEMS',at:2}],'items'),/ambiguous/);
});

test('mobile hex workspace wires address history and imported anchor controls',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 assert.match(ui,/id="hmaBack"/);
 assert.match(ui,/id="hmaForward"/);
 assert.match(ui,/id="hmaAnchorGo"/);
 assert.match(ui,/findHexAnchor\(anchors/);
 assert.match(ui,/visitHexLocation\(state\.navigation/);
});

test('same-address visits preserve forward history and do not mutate the input',()=>{
 let history=createHexNavigation(0x20);
 history=visitHexLocation(visitHexLocation(history,0x40),0x60);
 const back=moveHexHistory(history,-1);
 const revisit=visitHexLocation(back,0x40);
 assert.deepEqual(revisit,{entries:[0x20,0x40,0x60],index:1});
 assert.equal(canMoveHexHistory(revisit,1),true);
 assert.equal(currentHexLocation(moveHexHistory(revisit,1)),0x60);
 assert.deepEqual(back,{entries:[0x20,0x40,0x60],index:1});
});

test('source offsets reject fractional, unsafe, negative and beyond-GBA values',()=>{
 for(const offset of [-1,1.5,NaN,Infinity,0x100000000,Number.MAX_SAFE_INTEGER]){
  assert.throws(()=>createHexNavigation(offset),/valid source-ROM offset/);
  assert.throws(()=>visitHexLocation(createHexNavigation(),offset),/valid source-ROM offset/);
 }
 assert.equal(currentHexLocation(createHexNavigation(0xffffffff)),0xffffffff);
});

test('named anchor lookup tolerates incomplete imported metadata without selecting it',()=>{
 assert.deepEqual(findHexAnchor([null,{}, {name:'Table',at:32}], 'table'),{name:'Table',at:32});
});


test('hex UI resets navigation and search cursors when a different source ROM opens',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 assert.match(ui,/function syncHexSource\(\)/);
 assert.match(ui,/state\.navigationSource===key/);
 assert.match(ui,/state\.navigation=createHexNavigation\(0\)/);
 assert.match(ui,/state\.maskResume=null/);
 assert.match(ui,/state\.maskHits=\[\]/);
 assert.match(ui,/function open\(tab=state\.tab\)\{\s*syncHexSource\(\)/);
 assert.match(ui,/function render\(\)\{\s*syncHexSource\(\)/);
});

test('hex UI rejects invalid targets before modifying navigation history',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 assert.match(ui,/offset>=data\(\)\.length\)throw Error\('Hex navigation target is outside the opened source ROM\.'/);
 assert.ok(ui.indexOf("offset>=data().length)throw Error")<ui.indexOf("state.navigation=visitHexLocation(state.navigation,offset);"));
});
