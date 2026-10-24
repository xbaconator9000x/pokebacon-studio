import test from'node:test';import assert from'node:assert/strict';
import{newProject,newMap,snapshot,restore,validateProject}from'../dist/model.js';
import{EDGES,saveSeamLink,seamAt,seamGeometry}from'../dist/map-seams.js';
import{removeMapLink,saveMapLink}from'../dist/link-model.js';
for(const direction of Object.keys(EDGES))test('Continuous '+direction+' seam preserves signed alignment, reverse travel and undo',()=>{
 const p=newProject(),a=p.maps[0],b=newMap('Neighbour',20,18);p.maps.push(b);const before=snapshot(p),l=saveSeamLink(p,{from:{mapId:a.id},to:{mapId:b.id},seam:{direction,offset:-3},twoWay:true});
 const vertical=['north','south'].includes(direction),x=vertical?4:direction==='west'?-1:a.width,y=vertical?(direction==='north'?-1:a.height):4,travel=seamAt(p,a.id,x,y);assert.ok(travel);assert.equal(travel.to[vertical?'x':'y'],7);
 const back=seamAt(p,b.id,vertical?travel.to.x:direction==='west'?b.width:-1,vertical?direction==='north'?b.height:-1:travel.to.y);assert.equal(back.to[vertical?'x':'y'],4);
 assert.throws(()=>saveSeamLink(p,{from:{mapId:a.id},to:{mapId:b.id},seam:{direction,offset:0}}),/already/);validateProject(p);restore(p,before);assert.equal(p.links.length,0);
});
test('Native seams can be retargeted and deleted without restoring original tables on next export',()=>{
 const p=newProject(),a=p.maps[0],b=newMap('Next',20,20);a.rom={sourceId:'s',key:'3.1'};b.rom={sourceId:'s',key:'3.2'};p.maps.push(b);const l={id:'native',from:{mapId:a.id,x:3,y:0},to:{mapId:b.id,x:3,y:19},kind:'north',twoWay:true,label:'North',rom:{sourceId:'s',events:['3.1:edge-2','3.2:edge-1']}};p.links.push(l);
 saveSeamLink(p,{...l,seam:{direction:'east',offset:2}});assert.deepEqual(a.rom.disabledConnections,[2]);assert.deepEqual(b.rom.disabledConnections,[1]);removeMapLink(p,l.id);assert.equal(p.links.length,0);assert.deepEqual(a.rom.disabledConnections,[2]);
 assert.throws(()=>seamGeometry(a,b,'north',200),/overlap/);
});
test('Portal facing survives project validation and invalid directions are refused',()=>{
 const p=newProject(),a=p.maps[0],b=newMap('Room',10,10);p.maps.push(b);saveMapLink(p,{from:{mapId:a.id,x:3,y:4},to:{mapId:b.id,x:5,y:8},kind:'warp',twoWay:true,label:'Entrance',runtime:{type:'portal',style:'step',arrivalFacing:'north',returnFacing:'east'}});validateProject(p);const copy=JSON.parse(JSON.stringify(p));validateProject(copy);assert.equal(copy.links[0].runtime.arrivalFacing,'north');copy.links[0].runtime.arrivalFacing='sideways';assert.throws(()=>validateProject(copy),/portal/);
});
