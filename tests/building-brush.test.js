import test from 'node:test';
import assert from 'node:assert/strict';
import {newMap} from '../dist/model.js';
import {paintBuildingRow} from '../dist/builder-model.js';
const p={id:'office',name:'Office',assetId:'office',w:5,h:6};
test('building rows keep whole footprints, repeat consistently and reserve a front gap',()=>{
 const m=newMap('Town',24,24);
 assert(paintBuildingRow(m,p,1,1));assert.equal(paintBuildingRow(m,p,4,1),false);
 assert(paintBuildingRow(m,p,7,1));
 assert.deepEqual(m.objects.map(o=>[o.x,o.y,o.w,o.h]),[[0,0,5,6],[6,0,5,6]]);
 assert(m.objects.every(o=>o.collisionChoice==='solid'));
 assert.equal(paintBuildingRow(m,p,23,23),false);
});
test('building brush cannot cover events or complete native objects',()=>{
 const m=newMap('Town',24,24);m.markers.push({x:2,y:2});assert.equal(paintBuildingRow(m,p,1,1),false);
 m.markers=[];m.nativeAssemblies=[{x:0,y:0,w:2,h:2}];assert.equal(paintBuildingRow(m,p,1,1),false);
});

import{plantTree}from'../dist/builder-model.js';import{assertObjectPlacement}from'../dist/native-assemblies.js';
test('tree and building brushes cannot hide half of one another',()=>{
 const m=newMap('Town',24,24),tree={id:'tree',name:'Tree',assetId:'tree',w:2,h:3};
 assert(plantTree(m,tree,3,4));assert.throws(()=>assertObjectPlacement(m,{x:3,y:2,w:5,h:6}),/complete tree/);
 const n=newMap('Town',24,24);paintBuildingRow(n,p,0,0);assert.equal(plantTree(n,tree,3,4),false);
});

test('moving a tree ignores itself and still rejects buildings',()=>{
 const m=newMap('Town',24,24),tree={id:'tree',name:'Tree',assetId:'tree',w:2,h:3};plantTree(m,tree,3,4);const o=m.objects[0];assert.doesNotThrow(()=>assertObjectPlacement(m,o));m.objects.push({id:'house',x:10,y:10,w:4,h:4});assert.throws(()=>assertObjectPlacement(m,{...o,x:10,y:10}),/complete tree/);
});
