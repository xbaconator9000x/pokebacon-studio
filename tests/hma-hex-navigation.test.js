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
