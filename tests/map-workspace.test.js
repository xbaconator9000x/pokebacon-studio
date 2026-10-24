import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,newMap,addLink,snapshot,validateProject} from '../dist/model.js';
import {cropMap,cropPlan} from '../dist/crop-model.js';
import {sourceWord} from '../dist/world-model.js';
import {ledgeAt,waterAt} from '../dist/field-model.js';
import {saveMapLink,boundLinkEnd} from '../dist/link-model.js';
import {toolPanel} from '../dist/map-toolbox.js';
import {SharedLibrary} from '../dist/shared-library.js';
import {mapFromInterior,templateFromMap,stampInterior} from '../dist/interior-model.js';

test('tool contexts follow Stamp, Paint and brush families without opening unrelated editors',()=>{
  assert.equal(toolPanel('stamp'),'objects');assert.equal(toolPanel('brush','objects'),'tiles');for(const tool of ['terrain','texture','tree','wall','ledge','room'])assert.equal(toolPanel(tool),'brushes');assert.equal(toolPanel('linkTarget'),'connections');assert.equal(toolPanel('move','objects'),'objects');
});
test('a top-left crop translates all spatial references and retains original ROM words',()=>{
  const p=newProject(),m=newMap('Source',8,8),other=newMap('Other',8,8);p.maps=[m,other];p.activeMapId=m.id;
  for(const k of ['ground','details','overhead'])for(let i=0;i<64;i++)m.layers[k][i]={a:'a',sx:i*16,sy:0,size:16};
  m.rom={originalWidth:8,originalHeight:8,originalBlocks:Array.from({length:64},(_,i)=>0x3000+i),events:{npcs:[],warps:[],triggers:[],signs:[]}};
  m.movement=Array.from({length:64},(_,i)=>({mode:'walk',elevation:i%16}));m.wallCells=Array(64).fill(null);m.wallCells[27]={styleId:'fence'};
  m.reference={assetId:'a',x:3,y:2,w:4,h:4,opacity:1};m.markers=[{id:'note',x:3,y:3,title:'Kept',text:'',kind:'note'}];m.objects=[{id:'obj',assetId:'a',x:3,y:2,w:1,h:1,sx:0,sy:0,sw:16,sh:16}];
  const l=addLink(p,{mapId:m.id,x:3,y:3},{mapId:other.id,x:1,y:1});l.rom={originalFrom:{...l.from},originalTo:{...l.to}};const original=structuredClone(l.rom);
  other.markers=[{id:'arrival',x:1,y:1,title:'Warp',text:'',kind:'event',runtime:{action:'sequence',trigger:'interact',steps:[{type:'warp',to:{mapId:m.id,x:4,y:4}}]}}];
  cropMap(p,m.id,{x:2,y:1,width:4,height:5});
  assert.deepEqual(m.layers.ground[0],{a:'a',sx:10*16,sy:0,size:16});assert.equal(sourceWord(m,1,1),0x3000+19);assert.equal(m.movement[0].elevation,10);assert.deepEqual(m.reference,{assetId:'a',x:1,y:1,w:4,h:4,opacity:1});assert.equal(m.objects[0].x,1);assert.equal(m.markers[0].y,2);assert.deepEqual(l.from,{mapId:m.id,x:1,y:2});assert.deepEqual(l.rom,original);assert.deepEqual(other.markers[0].runtime.steps[0].to,{mapId:m.id,x:2,y:3});assert.equal(m.rom.originalWidth,8);assert.equal(m.rom.originalBlocks.length,64);assert.deepEqual(m.world,{x:0,y:0});
});
test('crop then regrow leaves new strips blank without resurrecting native water or ledges',()=>{
  const p=newProject(),m=newMap('Native',4,4);p.maps=[m];m.rom={originalWidth:4,originalHeight:4,originalBlocks:Array(16).fill(0x3001),attributes:[0,0x10,0x3b]};m.rom.originalBlocks[1]=0x3002;
  assert.equal(waterAt(m,0,0),true);assert.equal(ledgeAt(m,1,0),'south');cropMap(p,m.id,{x:1,y:1,width:3,height:3});cropMap(p,m.id,{x:-1,y:-1,width:4,height:4});assert.equal(sourceWord(m,0,0),0x3000);assert.equal(waterAt(m,0,0),false);assert.equal(ledgeAt(m,1,0),null);assert.equal(waterAt(m,1,1),true);
});
test('invalid crop is atomic and protects inbound links and scripted arrivals',()=>{
  const p=newProject(),m=p.maps[0],other=newMap('Other',8,8);p.maps.push(other);addLink(p,{mapId:other.id,x:1,y:1},{mapId:m.id,x:20,y:20});const before=snapshot(p);assert.equal(cropPlan(p,m.id,{x:0,y:0,width:8,height:8}).blockers.length,1);assert.throws(()=>cropMap(p,m.id,{x:0,y:0,width:8,height:8}),/Keep these exits/);assert.equal(snapshot(p),before);
});
test('crop protects nested scene paths and shifts drawn regions and answer-branch arrivals',()=>{
  const p=newProject(),m=p.maps[0],other=newMap('Other',8,8);p.maps.push(other);const n={id:'scene',x:4,y:4,title:'Scene',kind:'event',runtime:{action:'scene',trigger:'area',area:{x:3,y:3,width:5,height:5},steps:[{type:'answers',choices:[{label:'Go',steps:[{type:'path',actorId:'player',points:[{x:4,y:4},{x:6,y:6}]}]}]}],repeatSteps:[]}};m.markers.push(n);other.markers.push({id:'other',x:2,y:2,title:'Arrival',runtime:{action:'scene',steps:[],repeatSteps:[{type:'if',then:[{type:'warp',to:{mapId:m.id,x:5,y:5}}]}]}});
  assert.ok(cropPlan(p,m.id,{x:3,y:3,width:3,height:3}).blockers.some(s=>s.includes('path')));cropMap(p,m.id,{x:2,y:2,width:8,height:8});assert.deepEqual(n.runtime.area,{x:1,y:1,width:5,height:5});assert.deepEqual(n.runtime.steps[0].choices[0].steps[0].points,[{x:2,y:2},{x:4,y:4}]);assert.deepEqual(other.markers[0].runtime.repeatSteps[0].then[0].to,{mapId:m.id,x:3,y:3});
});
test('moving a portal preserves its identity, fits doorway art and rejects occupied arrivals',()=>{
  const p=newProject(),a=p.maps[0],b=newMap('Inside',8,6);p.maps.push(b);const l=saveMapLink(p,{from:{mapId:a.id,x:3,y:4},to:{mapId:b.id,x:2,y:3},twoWay:true,kind:'warp',label:'Door',runtime:{type:'portal',style:'step'}}),id=l.id;
  b.objects.push({id:'door',assetId:'a',sx:0,sy:0,sw:32,sh:32,x:1,y:2,w:2,h:2,portalId:id,portalEnd:'to',portalAnchor:{x:1,y:1},collisionChoice:'keep'});
  const p2=boundLinkEnd(p,l,'to',{mapId:b.id,x:100,y:-10});assert.deepEqual(p2,{mapId:b.id,x:7,y:1});saveMapLink(p,{...l,to:p2});assert.equal(l.id,id);assert.equal(p.links.length,1);assert.equal(b.objects[0].x,6);assert.equal(b.objects[0].y,0);assert.equal(b.movement[3*8+2].behavior,0);
  assert.throws(()=>saveMapLink(p,{...l,to:{mapId:b.id,x:8,y:0}}),/inside/);
  saveMapLink(p,{from:{mapId:a.id,x:5,y:5},to:{mapId:b.id,x:4,y:4},twoWay:true,label:'Other',runtime:{type:'portal',style:'step'}});assert.throws(()=>saveMapLink(p,{...l,to:{mapId:b.id,x:4,y:4}}),/already uses/);
});
test('saved editable interiors survive device library export, conflicts and a fresh project',async()=>{
  const p=newProject(),map=p.maps[0],asset={id:'a',name:'Furniture',width:16,height:16,tileSize:16,data:'data:image/png;base64,AA=='};map.layers.ground[0]={a:'a',sx:0,sy:0,size:16};map.objects.push({id:'obj',assetId:'a',sx:0,sy:0,sw:16,sh:16,x:2,y:2,w:1,h:1});
  const t=templateFromMap(map,{name:'My house',entry:{x:1,y:1}}),library=new SharedLibrary();await library.save('interiorTemplates',t,id=>id==='a'?asset:null);const next=new SharedLibrary();next.load(library.export());const project=newProject();next.attach(project,'interiorTemplates',t);const made=mapFromInterior(t);project.maps.push(made);assert.notEqual(made.objects[0].id,'obj');assert.deepEqual(made.layers,t.layers);assert.equal(validateProject(project,[]),project);assert.equal(next.list('interiorTemplates',project).length,1);
  const conflicting=new SharedLibrary();await conflicting.save('prefabs',{id:'p',name:'Existing',assetId:'a',w:1,h:1},()=>({...asset,data:'data:image/png;base64,AQ=='}));await conflicting.import(next.export(),()=>asset);const imported=conflicting.value.interiorTemplates[0];assert.notEqual(imported.layers.ground[0].a,'a');assert.equal(imported.objects[0].assetId,imported.layers.ground[0].a);
  const target=newMap('Large room',64,64);stampInterior(target,t,3,4);assert.equal(target.layers.ground[4*64+3].a,'a');assert.equal(target.objects[0].x,5);assert.throws(()=>stampInterior(target,t,63,63),/fit/);
});
