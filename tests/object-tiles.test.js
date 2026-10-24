import test from'node:test';import assert from'node:assert/strict';
import{newProject,newMap,paint,rectangle,flood,validateProject,usedAssetIds,getTile}from'../dist/model.js';
import{captureEdit,finishEdit,applyEdit}from'../dist/edit-history.js';import{cropMap}from'../dist/crop-model.js';
import{templateFromMap,mapFromInterior,validateInterior,stampInterior}from'../dist/interior-model.js';
import{movementBrush}from'../dist/movement-ui.js';import{movementAt,setMovement}from'../dist/world-model.js';
import{linkPinLabel}from'../dist/map-seams.js';
const brush={assetId:'a',sx:0,sy:0,cols:1,rows:1,tileSize:16},catalog=[{id:'a'}];
test('Object tile strokes, fill, area, erase, undo and crop preserve other layers and placed cutouts',()=>{
 const p=newProject(),m=p.maps[0];paint(m,'ground',2,2,brush);const before=captureEdit(p,m.id);rectangle(m,'objects',{x:2,y:2},{x:4,y:4},brush);paint(m,'objects',3,3,brush,true);assert.equal(m.layers.objects.filter(Boolean).length,8);assert.ok(getTile(m,'ground',2,2));const delta=finishEdit(p,before);applyEdit(p,delta);assert.equal(m.layers.objects.filter(Boolean).length,0);applyEdit(p,delta,true);assert.equal(m.layers.objects.filter(Boolean).length,8);cropMap(p,m.id,{x:1,y:1,width:10,height:10});assert.ok(getTile(m,'objects',1,1));assert.ok(usedAssetIds(p).has('a'));
 const n=newMap('Fill',3,3);flood(n,'objects',0,0,brush);assert.equal(n.layers.objects.filter(Boolean).length,9);
});
test('Older projects and interior templates gain an empty object tile grid and round-trip painted artwork',()=>{
 const p=newProject();delete p.maps[0].layers.objects;validateProject(p,catalog);const m=p.maps[0];paint(m,'objects',2,2,brush);let t=templateFromMap(m,{entry:{x:0,y:0}});validateInterior(t,new Set(['a']));assert.ok(mapFromInterior(t).layers.objects[2*m.width+2]);delete t.layers.objects;validateInterior(t,new Set(['a']));assert.equal(t.layers.objects.length,m.width*m.height);stampInterior(m,t,0,0);assert.equal(m.layers.objects.filter(Boolean).length,0);
});
test('Encounter grass preset stays passable and retains native behaviour even over object footprints',()=>{
 const m=newMap();m.objects.push({x:1,y:1,w:1,h:1,collisionChoice:'solid'});setMovement(m,1,1,movementBrush({rule:'grass',elevation:null,collision:null,behavior:null}));const r=movementAt(m,1,1);assert.equal(r.collision,0);assert.equal(r.behavior,2);assert.equal(r.elevation,3);
});
test('Pins distinguish actual compass edges from two-way portals and one-way endpoints',()=>{
 const l={seam:{direction:'west',offset:0},twoWay:true};assert.equal(linkPinLabel(l,'from'),'←');assert.equal(linkPinLabel(l,'to'),'→');assert.equal(linkPinLabel({twoWay:true},'from'),'⇄');assert.equal(linkPinLabel({twoWay:false},'to'),'IN');
});

test('Grass texture fill keeps its encounter behaviour on the Objects grid',()=>{const m=newMap('Grass',3,3);flood(m,'objects',0,0,{...brush,movementMode:'walk',movementBehavior:2});assert.equal(movementAt(m,1,1).behavior,2);});
