import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newProject,newMap,paint,getTile,rectangle,flood,line,resizeMap,removeMap,addLink,validateProject,clone,snapshot,restore,usedAssetIds} from '../dist/model.js';
import {makeZip,crc32} from '../dist/zip.js';
const brush={assetId:'terrain',sx:16,sy:32,cols:2,rows:2,tileSize:16};
const catalog=[{id:'terrain',name:'Terrain',src:'assets/terrain.png',width:128,height:128,tileSize:16}];
test('A multi-tile brush clips at map borders without wrapping into another row',()=>{
  const m=newMap('Test',4,4);paint(m,'ground',3,2,brush);assert.equal(m.layers.ground.filter(Boolean).length,2);assert.deepEqual(getTile(m,'ground',3,3),{a:'terrain',sx:16,sy:48,size:16,renderRole:'ground'});assert.equal(getTile(m,'ground',0,3),null);
});
test('Rectangle repeats the selected source area in both directions',()=>{
  const m=newMap('Test',8,8);rectangle(m,'details',{x:5,y:5},{x:1,y:1},brush);assert.equal(m.layers.details.filter(Boolean).length,25);assert.equal(getTile(m,'details',4,4).sx,32);assert.equal(getTile(m,'details',4,4).sy,48);assert.equal(getTile(m,'details',5,5).sx,16);
});
test('Flood fill respects tile identity and a closed border',()=>{
  const m=newMap('Test',8,8),single={...brush,cols:1,rows:1};for(let i=1;i<=6;i++){paint(m,'ground',i,1,single);paint(m,'ground',i,6,single);paint(m,'ground',1,i,single);paint(m,'ground',6,i,single);}flood(m,'ground',2,2,{...single,sx:64});assert.equal(m.layers.ground.filter(t=>t?.sx===64).length,16);assert.equal(getTile(m,'ground',0,0),null);assert.equal(getTile(m,'ground',1,3).sx,16);
});
test('Dragging a fast brush interpolates every tile along its path',()=>{
  const points=[];line(1,1,8,4,(x,y)=>points.push([x,y]));assert.deepEqual(points[0],[1,1]);assert.deepEqual(points.at(-1),[8,4]);assert.equal(points.length,8);assert.ok(points.every((p,i)=>i===0||Math.abs(p[0]-points[i-1][0])<=1&&Math.abs(p[1]-points[i-1][1])<=1));
});
test('Malformed line endpoints fail immediately instead of trapping the drawing thread',()=>{for(const values of [[0,0,NaN,2],[0,0,Infinity,2],[0,0,1.5,2],[0,0,1e9,2]])assert.throws(()=>line(...values,()=>{}),/drawing coordinates/);});
test('Map resize protects connections, preserves rows and removes explicitly unlinked outside pins',()=>{
  const p=newProject(),m=p.maps[0],other=newMap('Other',8,8);p.maps.push(other);paint(m,'ground',2,3,{...brush,cols:1,rows:1});m.markers.push({id:'a',x:7,y:7,title:'Outside',text:'',kind:'note'},{id:'b',x:2,y:2,title:'Inside',text:'',kind:'note'});m.objects.push({id:'outside-object',x:8,y:5,w:1,h:1},{id:'inside-object',x:1,y:1,w:1,h:1});addLink(p,{mapId:m.id,x:7,y:7},{mapId:other.id,x:1,y:1});addLink(p,{mapId:m.id,x:2,y:2},{mapId:other.id,x:2,y:2});const before=snapshot(p);assert.throws(()=>resizeMap(p,m.id,4,4),/Keep these exits/);assert.equal(snapshot(p),before);p.links.shift();resizeMap(p,m.id,4,4);assert.equal(getTile(m,'ground',2,3).sx,16);assert.equal(m.markers.length,1);assert.equal(m.markers[0].id,'b');assert.equal(m.objects.length,1);assert.equal(p.links.length,1);
});
test('Deleting a map removes both inbound and outbound links and selects another map',()=>{
  const p=newProject(),first=p.maps[0],second=newMap('Second');p.maps.push(second);addLink(p,{mapId:first.id,x:0,y:0},{mapId:second.id,x:1,y:1});removeMap(p,first.id);assert.equal(p.links.length,0);assert.equal(p.activeMapId,second.id);assert.throws(()=>removeMap(p,second.id),/at least one/);
});
test('Undo snapshots restore map edits without copying embedded bitmap data',()=>{
  const p=newProject();p.assets.push({id:'image',data:'data:image/png;base64,AAAA'});const before=snapshot(p);p.maps[0].name='Changed';paint(p.maps[0],'ground',0,0,brush);restore(p,before);assert.equal(p.maps[0].name,'Map 1');assert.equal(getTile(p.maps[0],'ground',0,0),null);assert.equal(p.assets.length,1);assert.ok(!before.includes('base64'));
});
test('Project import rejects executable image data and unembedded remote assets',()=>{
  const p=newProject();p.assets=[{id:'unsafe',name:'Unsafe',width:16,height:16,tileSize:16,data:'data:image/svg+xml;base64,AAAA'}];assert.throws(()=>validateProject(p,catalog),/Only embedded/);p.assets[0]={id:'unsafe',name:'Unsafe',width:16,height:16,tileSize:16,src:'https://unknown.example/image.png'};assert.throws(()=>validateProject(p,catalog),/embedded image/);
});
test('A portable project round trips maps, objects, notes, links and its asset IDs',()=>{
  const p=newProject('Example'),a=p.maps[0],b=newMap('Room');p.maps.push(b);p.assets=[{id:'terrain',name:'Terrain',width:128,height:128,tileSize:16,data:'data:image/png;base64,AAAA'}];paint(a,'details',3,3,brush);a.objects.push({id:'o',assetId:'terrain',sx:0,sy:0,sw:32,sh:32,x:2.5,y:2,w:2,h:2});a.markers.push({id:'n',title:'An NPC',text:'Move them here',kind:'npc',x:1,y:1});addLink(p,{mapId:a.id,x:4,y:4},{mapId:b.id,x:2,y:3});validateProject(p,catalog);const copy=validateProject(JSON.parse(JSON.stringify(p)),catalog);assert.deepEqual(copy,p);assert.deepEqual([...usedAssetIds(copy)],['terrain']);const bad=clone(p);bad.links[0].to.x=999;assert.throws(()=>validateProject(bad,catalog),/connection points outside/);
});
test('Share-pack ZIP has valid UTF-8 names, CRCs and standard extractable entries',async()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);const folder=mkdtempSync(join(tmpdir(),'mapstudio-zip-'));try{const blob=makeZip([['Pokémon/map.txt','Town notes 🗺'],['maps/image.bin',new Uint8Array([0,1,2,255])],['empty.txt','']]);const path=join(folder,'pack.zip');writeFileSync(path,new Uint8Array(await blob.arrayBuffer()));const out=execFileSync('python3',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('Pokémon/map.txt').decode() == 'Town notes 🗺'; assert z.read('maps/image.bin') == bytes([0,1,2,255]); print('ok')",path],{encoding:'utf8'});assert.equal(out.trim(),'ok');}finally{rmSync(folder,{recursive:true});}
});
