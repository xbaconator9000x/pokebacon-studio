import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject} from '../dist/model.js';
import {hexBookmarks,saveHexBookmark,deleteHexBookmark,validateHexStudio} from '../dist/native-hex-workspace.js';
const A='a'.repeat(64),B='b'.repeat(64);
test('hex bookmarks persist per original source and survive project JSON save/reopen',()=>{
 const rom=syntheticROM(),original=rom.slice(),project=newProject();
 saveHexBookmark(project,A,rom,'Species',0x1234);
 saveHexBookmark(project,B,rom,'Species',0x5678);
 saveHexBookmark(project,A,rom,'Species',0x2345);
 const reopened=JSON.parse(JSON.stringify(project));
 assert.equal(validateHexStudio(reopened.hexStudio),true);
 assert.deepEqual(hexBookmarks(reopened,A),[{name:'Species',at:0x2345}]);
 assert.deepEqual(hexBookmarks(reopened,B),[{name:'Species',at:0x5678}]);
 deleteHexBookmark(reopened,A,'Species');
 assert.deepEqual(hexBookmarks(reopened,A),[]);
 assert.deepEqual(hexBookmarks(reopened,B),[{name:'Species',at:0x5678}]);
 assert.deepEqual(rom,original);
});
test('invalid, duplicate and out-of-bounds bookmark records fail closed',()=>{
 const rom=syntheticROM(),project=newProject();saveHexBookmark(project,A,rom,'Valid',512);
 const before=JSON.stringify(project);
 for(const [name,at] of [['',512],['a'.repeat(65),512],['bad\nname',512],['ok',rom.length],['ok',-1]]){
  assert.throws(()=>saveHexBookmark(project,A,rom,name,at));assert.equal(JSON.stringify(project),before);
 }
 for(const bookmarks of [[{name:'X',at:-1}],[{name:'X',at:1},{name:'x',at:2}],[{name:'X',at:0x2000000}]]){
  const damaged=JSON.parse(before);damaged.hexStudio.sources[A].bookmarks=bookmarks;
  assert.throws(()=>validateHexStudio(damaged.hexStudio));
 }
 assert.throws(()=>deleteHexBookmark(project,A,'Missing'));
 assert.equal(JSON.stringify(project),before);
});
