import{session,fs,assert,newProject,newMap,validateProject,movementAt,setMovement}from'./qa-harness.mjs';
import{addPortal}from'../dist/world-model.js';
const file=process.env.MAP_STUDIO_SOURCE_ROM;
if(!file)throw Error('Set MAP_STUDIO_SOURCE_ROM to the supplied ROM fixture.');
const bytes=fs.readFileSync(file),original=Buffer.from(bytes),s=await session({},true),{qa,$,wait,submit}=s;
const reader=await qa.readROM(bytes,'append-source');
for(const includeEvents of [false,true])for(const keys of [['1.0'],['1.0','3.1','3.19']]){
  for(const key of keys)assert.ok(reader.byKey(key),'Fixture map '+key);
  const p=newProject('Append regression'),outside=p.maps[0],inside=newMap('My built interior',12,12);
  inside.rom={sourceId:'append-source',generated:true,templateKey:'5.2',originalBlocks:[],originalWidth:0,originalHeight:0};
  inside.markers.push({id:'my-script',x:4,y:4,kind:'event',title:'Keep this scene',text:'My authored event',runtime:{action:'dialogue',text:'Still here'}});
  p.maps.push(inside);outside.notes='My existing edits';setMovement(outside,2,2,{mode:'block'});
  addPortal(p,{mapId:outside.id,x:3,y:3},{mapId:inside.id,x:6,y:11},{twoWay:true,label:'My entrance'});
  await qa.switchProject(p);const previous=JSON.parse(JSON.stringify(qa.state.project)),start=previous.maps.length;
  qa.romBrowser();$('#romClear').click();
  for(const key of keys){const check=$(`[data-rom-key="${key}"]`).parentElement.querySelector('input');check.click();}
  $('#romNewProject').checked=false;$('#romEvents').checked=includeEvents;submit();
  await wait(()=>!$('#dialog').open||!!$('#dialogError')?.textContent);
  assert.equal($('#dialog').open,false,$('#dialogError')?.textContent||'Import did not close');
  assert.equal(qa.state.project.maps.length,start+keys.length);
  assert.deepEqual(JSON.parse(JSON.stringify(qa.state.project.maps.slice(0,start))),previous.maps);
  assert.deepEqual(JSON.parse(JSON.stringify(qa.state.project.links.slice(0,previous.links.length))),previous.links);
  for(const map of qa.state.project.maps.slice(start)){
    assert.deepEqual([...map.rom.originalBlocks],[...reader.blocks(reader.byKey(map.rom.key))]);
    assert.equal(map.markers.length,includeEvents?Object.values(reader.events(reader.byKey(map.rom.key))).reduce((n,a)=>n+a.length,0):0);
  }
  assert.equal(movementAt(qa.state.project.maps[0],2,2).collision,1);
  validateProject(qa.state.project,JSON.parse(fs.readFileSync('dist/assets/catalog.json')));
  const saved=JSON.parse(JSON.stringify(qa.state.project));await qa.persist();await qa.switchProject(newProject('Other'));await qa.switchProject(saved);
  assert.equal(qa.state.project.maps.length,start+keys.length);assert.equal(qa.state.project.maps[1].markers[0].runtime.text,'Still here');
  console.log(`PASS mobile import dialog: ${keys.length} maps appended, event pins ${includeEvents}, existing interior/portal/script/collision retained and project reopened.`);
}
assert.deepEqual(bytes,original);await s.close();
