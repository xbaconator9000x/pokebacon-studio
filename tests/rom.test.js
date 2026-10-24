import test from 'node:test';
import assert from 'node:assert/strict';
import {GbaMaps,decompressLZ,decompressGraphics,decodeText} from '../dist/rom.js';
import {importRomMaps,wireRomLinks} from '../dist/rom-import.js';
import {newProject,newMap,addLink,validateProject} from '../dist/model.js';

function syntheticROM(){
  const b=new Uint8Array(0x20000),v=new DataView(b.buffer),u16=(o,n)=>v.setUint16(o,n,true),u32=(o,n)=>v.setUint32(o,n,true),ptr=(o,n)=>u32(o,0x8000000+n);
  b.set(new TextEncoder().encode('CUSTOM HACK'),0xa0);b.set(new TextEncoder().encode('TEST'),0xac);
  u32(0x1000,4);u32(0x1004,4);ptr(0x1008,0x1150);ptr(0x100c,0x1100);ptr(0x1010,0x1200);ptr(0x1014,0x1218);b[0x1018]=2;b[0x1019]=2;
  ptr(0x1204,0x4000);ptr(0x1208,0x2000);ptr(0x120c,0xc000);ptr(0x1214,0xe800);
  b[0x1219]=1;ptr(0x121c,0x9000);ptr(0x1220,0x2200);ptr(0x1224,0xf400);ptr(0x122c,0xf410);
  b.fill(0x11,0x4020,0x4040);b.fill(0x21,0x4040,0x4060);b.fill(0x22,0x9000,0x9020);u16(0x2002,31);u16(0x2004,31<<5);
  for(let i=0;i<4;i++){u16(0xc000+i*2,1);u16(0xf400+i*2,640);}u16(0xc010,1024|2);
  u16(0x1100,640|(3<<10)|(2<<12));u16(0x1102,1);
  const encode=t=>[...t].map(c=>c===' '?0:0xbb+c.charCodeAt(0)-65).concat(255);
  b.set([...encode('PALLET TOWN'),...encode('VIRIDIAN CITY')],0x2400);
  for(let bank=0;bank<4;bank++){ptr(0x1800+bank*4,0x1900+bank*12);for(let id=0;id<3;id++){const address=0x1400+(bank*3+id)*28;ptr(0x1900+bank*12+id*4,address);ptr(address,0x1000);b[address+20]=88+id%2;b[address+23]=bank===0?2:8;}}
  ptr(0x1404,0x3000);b[0x3000]=1;b[0x3001]=1;ptr(0x3004,0x3050);ptr(0x3008,0x3070);b[0x3050]=1;b[0x3051]=4;u16(0x3054,1);u16(0x3056,2);u16(0x3070,2);u16(0x3072,2);b[0x3076]=1;
  ptr(0x1420,0x3020);b[0x3021]=1;ptr(0x3028,0x3080);u16(0x3080,3);u16(0x3082,3);
  ptr(0x140c,0x30a0);u32(0x30a0,1);ptr(0x30a4,0x30b0);u32(0x30b0,2);b[0x30b8]=1;
  ptr(0x1454+12,0x30c0);u32(0x30c0,1);ptr(0x30c4,0x30d0);u32(0x30d0,1);
  return b;
}
test('LZ77 decoding handles overlapping references and rejects invalid input',()=>{
  assert.equal(new TextDecoder().decode(decompressLZ(Uint8Array.from([16,9,0,0,16,65,66,67,0x30,2]),0)),'ABCABCABC');
  assert.throws(()=>decompressLZ(Uint8Array.from([16,3,0,0,128,0,0]),0),/back-reference/);
  assert.throws(()=>decompressLZ(Uint8Array.from([16,255,255,255]),0),/supported size/);
});
test('Map discovery works with a custom game code and relocated tables',async()=>{
  const r=await new GbaMaps(syntheticROM(),'custom.gba').discover();assert.equal(r.code,'TEST');assert.equal(r.engine,'frlg');assert.equal(r.mapTable,0x1800);assert.equal(r.maps.length,12);assert.equal(r.byKey('0.1').label,'VIRIDIAN CITY');assert.equal(r.byKey('0.0').layout.width,4);
});
test('ROM renderer uses both tilesets, transparency, palettes and tile flips',async()=>{
  const r=await new GbaMaps(syntheticROM()).discover(),a=r.atlas(r.byKey('0.0'));assert.equal(a.count,641);const im=r.render(r.byKey('0.0'));
  assert.deepEqual([...im.pixels.slice(0,4)],[0,255,0,255]);
  assert.deepEqual([...a.pixels.slice(16*4,16*4+4)],[0,255,0,255]);
  assert.deepEqual([...im.pixels.slice(32*4,32*4+4)],[255,0,0,255]);
});
test('Emerald-family detection uses its field order, 512 tile split and six primary palettes',async()=>{
  const b=syntheticROM(),v=new DataView(b.buffer),ptr=(o,n)=>v.setUint32(o,n?0x8000000+n:0,true);
  ptr(0x1210,0xe000);ptr(0x1214,0);ptr(0x1228,0xf410);ptr(0x122c,0);
  for(let i=0;i<12;i++)b[0x1400+i*28+20]=0;
  const text='LITTLEROOT TOWN',next='OLDALE TOWN',encode=t=>[...t].map(c=>c===' '?0:0xbb+c.charCodeAt(0)-65).concat(255);b.fill(0,0x2400,0x2500);b.set([...encode(text),...encode(next)],0x2400);
  v.setUint16(0x1100,512,true);for(let i=0;i<4;i++)v.setUint16(0xf400+i*2,512,true);
  v.setUint16(0xc010,(6<<12)|1,true);v.setUint16(0x2200+(6*16+1)*2,31<<10,true);
  const r=await new GbaMaps(b).discover();assert.equal(r.engine,'rse');assert.equal(r.primaryCount,512);assert.equal(r.primaryPalettes,6);assert.equal(r.byKey('0.0').label,text);
  const atlas=r.atlas(r.byKey('0.0'));assert.equal(atlas.count,513);assert.deepEqual([...atlas.pixels.slice(16*4,16*4+4)],[0,0,255,255]);
});
test('Map import preserves collision/elevation words and never modifies ROM bytes',async()=>{
  const bytes=syntheticROM(),original=bytes.slice(),r=await new GbaMaps(bytes).discover();
  const result=await importRomMaps(newProject(),r,['0.0','0.1','1.0'],{sourceId:'1234567890abcdef',encodeAtlas:async()=> 'data:image/png;base64,AAAA'});
  assert.equal(result.added,3);assert.equal(result.project.assets.length,3);assert.equal(result.project.maps[0].rom.originalBlocks[0],640|(3<<10)|(2<<12));assert.deepEqual(bytes,original);assert.equal(result.project.maps[0].markers.filter(m=>m.kind==='npc').length,1);validateProject(result.project);
  assert.equal(result.project.links.filter(l=>l.kind==='door').length,1);assert.equal(result.project.links.find(l=>l.kind==='door').twoWay,true);
});
test('Adding ROM maps reuses imported tiles and keeps edits and deleted links',async()=>{
  const r=await new GbaMaps(syntheticROM()).discover(),options={sourceId:'1234567890abcdef',encodeAtlas:async()=> 'data:image/png;base64,AAAA'};
  const first=await importRomMaps(newProject(),r,['0.0','0.1'],options);first.project.maps[0].notes='My edits';first.project.links=[];
  const next=await importRomMaps(first.project,r,['0.0','0.2'],{...options,asNew:false});assert.equal(next.added,1);assert.equal(next.project.maps.length,3);assert.equal(next.project.assets.length,3);assert.equal(next.project.maps[0].notes,'My edits');wireRomLinks(next.project);assert.equal(next.project.links.length,0);
});
for(const includeEvents of [false,true])for(const keys of [['0.0'],['0.0','0.1','1.0']])test(`Append ${keys.length} ROM maps with pins ${includeEvents} preserves generated interiors and sparse legacy metadata`,async()=>{
  const bytes=syntheticROM(),original=bytes.slice(),reader=await new GbaMaps(bytes).discover(),p=newProject(),outside=p.maps[0],inside=newMap('Built interior',12,12),legacy=newMap('Older ROM map',4,4);
  inside.rom={sourceId:'source',generated:true,templateKey:'0.0',originalBlocks:[]};
  legacy.rom={sourceId:'source',key:'0.2'};p.maps.push(inside,legacy);
  outside.notes='Keep my edits';outside.layers.ground[0]=null;
  const entrance=addLink(p,{mapId:outside.id,x:2,y:2},{mapId:inside.id,x:6,y:11},'door',true,'My entrance'),before=structuredClone(p);
  const result=await importRomMaps(p,reader,keys,{sourceId:'source',asNew:false,includeEvents,encodeAtlas:async()=> 'data:image/png;base64,AAAA'});
  assert.equal(result.added,keys.length);assert.deepEqual(p,before,'Import leaves the input project untouched');assert.deepEqual(bytes,original);
  for(let i=0;i<before.maps.length;i++)assert.deepEqual(result.project.maps[i],before.maps[i],'Existing maps retain all data');
  assert.deepEqual(result.project.links.find(l=>l.id===entrance.id),entrance);
  const imported=result.project.maps.slice(before.maps.length);assert.ok(imported.every(m=>includeEvents||m.markers.length===0));assert.equal(imported[0].rom.originalBlocks[0],640|(3<<10)|(2<<12));
  if(keys.length>1)assert.equal(result.project.links.find(l=>l.rom?.sourceId==='source'&&l.kind==='door').twoWay,true);
  const reopened=JSON.parse(JSON.stringify(result.project)),links=structuredClone(reopened.links);wireRomLinks(reopened);assert.deepEqual(reopened.links,links);validateProject(reopened);
});
test('Automatic native links tolerate legacy reverse links without event tracking and ignore generated template keys',async()=>{
  const reader=await new GbaMaps(syntheticROM()).discover(),p=(await importRomMaps(null,reader,['0.0','0.1'],{sourceId:'source',encodeAtlas:async()=> 'data:image/png;base64,AAAA'})).project;
  const door=p.links.find(l=>l.kind==='door');delete door.rom.events;p.maps[1].rom.connectedEvents=[];
  const generated=newMap('Template copy',4,4);generated.rom={sourceId:'source',key:'0.1',generated:true};p.maps.unshift(generated);
  wireRomLinks(p);assert.equal(p.links.filter(l=>l.kind==='door').length,1);assert.equal(door.twoWay,true);assert.ok(door.rom.events.includes('0.1:warp-0'));assert.ok(!p.links.some(l=>l.from.mapId===generated.id||l.to.mapId===generated.id));
});
test('An older destination without a warp table does not prevent importing its neighbour',async()=>{
  const reader=await new GbaMaps(syntheticROM()).discover(),p=newProject(),legacy=p.maps[0];legacy.rom={sourceId:'source',key:'0.1'};
  const result=await importRomMaps(p,reader,['0.0'],{sourceId:'source',asNew:false,encodeAtlas:async()=> 'data:image/png;base64,AAAA'});
  assert.equal(result.added,1);assert.deepEqual(result.project.maps[0],legacy);assert.equal(result.project.links.filter(l=>l.kind==='door').length,0);
});
test('No false success for unrelated or truncated files',async()=>{assert.throws(()=>new GbaMaps(new Uint8Array(128)),/unzipped/);await assert.rejects(()=>new GbaMaps(new Uint8Array(8192)).discover(),/No supported/);assert.equal(decodeText(Uint8Array.from([0xbb,0xd5,0xa1,255]),0),'Aa0');});

// Synthetic fixtures exercise every Smol mode without checking in game assets.
function smolFixture(mode){
  const loEncoded=mode>=4,symEncoded=[2,3,5,6].includes(mode),freqs=+loEncoded + +symEncoded;
  const b=new Uint8Array(8+freqs*12+(freqs?4:0)+(symEncoded?0:4)+(loEncoded?0:2)),v=new DataView(b.buffer);
  v.setUint32(0,mode|(1<<4)|(2<<18),true);v.setUint32(4,(2<<19)|(freqs?64:0),true);let at=8;
  if(loEncoded){v.setUint32(at,1|(62<<6)|(1<<12),true);at+=12;}
  if(symEncoded){v.setUint32(at,32|(32<<6),true);at+=12;}
  if(freqs){v.setUint32(at,loEncoded?63<<6:0,true);at+=4;}
  if(!symEncoded){v.setUint16(at,0x1111,true);v.setUint16(at+2,0x2222,true);at+=4;}
  if(!loEncoded)b.set([0,2],at);return b;
}
for(let mode=1;mode<=6;mode++)test('Smol graphics mode '+mode+' decodes bounded native pixels',()=>{
  assert.deepEqual([...decompressGraphics(smolFixture(mode),0)],[...([1,4].includes(mode)?[17,17,34,34]:[0,0,0,0])]);
});
test('Smol rejects invalid lengths, frequencies and truncated instruction vectors',()=>{
  const b=smolFixture(5);assert.throws(()=>decompressGraphics(b.subarray(0,10),0),/Smol/);
  const bad=b.slice();bad.fill(0,8,20);assert.throws(()=>decompressGraphics(bad,0),/Smol/);
  const wrong=smolFixture(1);wrong[wrong.length-1]=3;assert.throws(()=>decompressGraphics(wrong,0),/Smol/);
  assert.throws(()=>decompressGraphics(smolFixture(1),0,2),/Smol/);
});

test('Smol accepts a terminal symbol whose unused next state extends past the stream',()=>{
 const bytes=new Uint8Array(26),v=new DataView(bytes.buffer);v.setUint32(0,2|(4<<4)|(8<<18),true);v.setUint32(4,(2<<19)|64,true);v.setUint32(8,16|(48<<6),true);
 // Initial state 0, zero payload: the first sixteen zero nibbles take 32
 // bits. Remaining symbols are encoded by zero-bit states; the final
 // symbol does not require another state transition.
 let found=false;for(let state=0;state<64&&!found;state++)for(let stream=0;stream<1000&&!found;stream++){const table=[];for(const[symbol,freq]of [[0,16],[1,48]])for(let n=freq;n<freq*2;n++){const k=6-Math.floor(Math.log2(n));table.push({symbol,k,y:(n<<k)-64});}let at=state,bit=0;const nibbles=[];for(let i=0;i<32;i++){const t=table[at];nibbles.push(t.symbol);if(i===31){if(bit<=32&&bit+t.k>32){v.setUint32(4,(2<<19)|64|state,true);v.setUint32(20,stream,true);bytes.set([0,8],24);const expected=Uint8Array.from({length:16},(_,i)=>nibbles[i*2]|nibbles[i*2+1]<<4);assert.deepEqual(decompressGraphics(bytes,0),expected);found=true;}break;}if(bit+t.k>32)break;at=t.y+((stream>>>bit)&((1<<t.k)-1));bit+=t.k;}}assert.equal(found,true);
});
