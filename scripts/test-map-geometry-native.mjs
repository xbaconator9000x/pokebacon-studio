import {session,assert,fs,createCanvas,importRomMaps,GbaMaps} from './qa-harness.mjs';
import {cropMap} from '../dist/crop-model.js';
import {saveMapLink} from '../dist/link-model.js';
import {nativeWarpBinding} from '../dist/rom-geometry.js';

const file=process.env.MAP_STUDIO_SOURCE_ROM;if(!file)throw Error('Set MAP_STUDIO_SOURCE_ROM.');
const original=fs.readFileSync(file),a=await session({},true),reader=await a.qa.readROM(original,'geometry-source'),sourceId='geometry-source';
const encodeAtlas=async atlas=>{const c=createCanvas(atlas.width,atlas.height),ctx=c.getContext('2d'),data=ctx.createImageData(atlas.width,atlas.height);data.data.set(atlas.pixels);ctx.putImageData(data,0,0);return c.toDataURL('image/png');};
const make=async(keys,includeEvents=false)=>(await importRomMaps(null,reader,keys,{sourceId,includeEvents,encodeAtlas})).project;
const town=reader.byKey('3.0'),sourceWarp=reader.events(town).warps[0],target=reader.byKey(sourceWarp.target),third=reader.byKey('12.2');
const p=await make([town.key,target.key,third.key]);await a.qa.switchProject(p);
console.log('Native geometry: no-op compilation');const unchanged=await a.qa.compileROM();const firstDiff=unchanged.bytes.findIndex((v,i)=>v!==original[i]);assert.equal(Buffer.compare(Buffer.from(unchanged.bytes),original),0,'No-op output differs; first byte '+firstDiff+'; reports '+JSON.stringify(unchanged.reports));console.log('Native geometry: no-op passed');
const link=p.links.find(l=>l.from.mapId===p.maps[0].id||l.to.mapId===p.maps[0].id);assert.ok(link?.rom);const fromBinding=nativeWarpBinding(reader,p,link,'from'),toBinding=nativeWarpBinding(reader,p,link,'to');assert.ok(fromBinding&&toBinding);
const fromMap=p.maps.find(m=>m.id===link.from.mapId),toMap=p.maps.find(m=>m.id===link.to.mapId),newFrom={mapId:fromMap.id,x:Math.min(fromMap.width-2,link.from.x+1),y:Math.min(fromMap.height-2,Math.max(1,link.from.y-1))},newTo={mapId:toMap.id,x:Math.min(toMap.width-2,link.to.x+1),y:Math.min(toMap.height-2,Math.max(1,link.to.y-1))};
a.qa.change(()=>saveMapLink(p,{...link,from:newFrom,to:newTo,runtime:{type:'portal',style:'step'}}));
console.log('Native geometry: repeated endpoint moves');let built=await a.qa.compileROM(),reopened=await new GbaMaps(built.bytes).discover();
let f=reopened.events(reopened.byKey(fromBinding.key)).warps.find(w=>w.index===fromBinding.index),t=reopened.events(reopened.byKey(toBinding.key)).warps.find(w=>w.index===toBinding.index);
assert.equal(f.x,newFrom.x);assert.equal(f.y,newFrom.y);assert.equal(t.x,newTo.x);assert.equal(t.y,newTo.y);assert.equal(f.warp,toBinding.index);assert.equal(t.warp,fromBinding.index);assert.equal(reopened.u8(reopened.byKey(fromBinding.key).events+1),reader.u8(reader.byKey(fromBinding.key).events+1));
// Repeated moves reuse the exact original slot, rather than accumulating warps.
const second={...link.to,x:Math.max(1,link.to.x-1)};a.qa.change(()=>saveMapLink(p,{...link,to:second}));built=await a.qa.compileROM();reopened=await new GbaMaps(built.bytes).discover();assert.equal(reopened.u8(reopened.byKey(toBinding.key).events+1),reader.u8(reader.byKey(toBinding.key).events+1));assert.equal(reopened.events(reopened.byKey(toBinding.key)).warps.find(w=>w.index===toBinding.index).x,second.x);
// Retarget a native arrival to a different imported map, including inbound references
// from source maps that were never imported into this project.
console.log('Native geometry: cross-map native arrival');const thirdMap=p.maps.find(m=>m.rom.key===third.key),retarget={mapId:thirdMap.id,x:Math.floor(thirdMap.width/2),y:Math.max(1,thirdMap.height-3)};
a.qa.change(()=>saveMapLink(p,{...link,to:retarget}));built=await a.qa.compileROM();reopened=await new GbaMaps(built.bytes).discover();f=reopened.events(reopened.byKey(fromBinding.key)).warps.find(w=>w.index===fromBinding.index);assert.equal(f.target,third.key);t=reopened.events(reopened.byKey(third.key)).warps.find(w=>w.index===f.warp);assert.equal(t.x,retarget.x);assert.equal(t.y,retarget.y);
for(const map of reopened.maps)for(const w of reopened.events(map).warps)assert.ok(!(w.target===toBinding.key&&w.warp===toBinding.index),'no inbound warp targets a retired native slot');
assert.equal(reopened.u16(reopened.ptr(reopened.byKey(toBinding.key).events+8)+toBinding.index*8),65535,'retired slot is inactive without reindexing other warps');
// Crop/grow an imported map without event pins: every original native record shifts.
console.log('Native geometry: shifted map with no event pins');const cropped=await make([target.key]);await a.qa.switchProject(cropped);const map=cropped.maps[0],oldWidth=map.width,oldHeight=map.height;
a.qa.change(()=>cropMap(cropped,map.id,{x:-2,y:-1,width:oldWidth+2,height:oldHeight+1}));built=await a.qa.compileROM();reopened=await new GbaMaps(built.bytes).discover();let native=reopened.byKey(target.key);assert.equal(native.layout.width,oldWidth+2);assert.equal(native.layout.height,oldHeight+1);
for(const [type,events]of Object.entries(reader.events(target)))for(const e of events){const changed=reopened.events(native)[type].find(n=>n.index===e.index);assert.ok(changed,type+' '+e.index);assert.equal(changed.x,e.x+2);assert.equal(changed.y,e.y+1);}
const oldWords=reader.blocks(target),newWords=reopened.blocks(native);for(let y=0;y<oldHeight;y++)for(let x=0;x<oldWidth;x++)assert.equal(newWords[(y+1)*(oldWidth+2)+x+2],oldWords[y*oldWidth+x]);
// Cropped seamless maps update both outgoing and unimported inbound connection offsets.
console.log('Native geometry: outgoing and inbound seams');const city=await make(['3.1']);await a.qa.switchProject(city);const cityMap=city.maps[0],oldNative=reader.byKey('3.1');a.qa.change(()=>cropMap(city,cityMap.id,{x:-2,y:0,width:cityMap.width+2,height:cityMap.height}));built=await a.qa.compileROM();reopened=await new GbaMaps(built.bytes).discover();let checked=0;
for(const source of reader.maps)for(const [i,c]of reader.connections(source).entries())if(c.direction<=4&&(source.key==='3.1'||c.target==='3.1')){const changed=reopened.connections(reopened.byKey(source.key))[i],delta=c.direction<=2?(source.key==='3.1'?2:0)+(c.target==='3.1'?-2:0):0;assert.equal(changed.offset,c.offset+delta);checked++;}
assert.ok(checked>0);
// A fixed landmark and its exact source interior compile as a reachable new native map.
console.log('Native geometry: exact landmark interior');const landmark=await make(['3.1']);await a.qa.switchProject(landmark);a.qa.state.builder.state.offerInterior=true;
a.qa.state.builder.placeAt(16,12,'native-v32-building-cinnabar-lab');await a.wait(()=>a.$('#builtLayout'));assert.equal(a.$('#builtLayout').value,'interior-v32-cinnabarisland-pokemonlab-entrance');a.submit();await a.wait(()=>!a.$('#dialog').open);
assert.equal(landmark.maps.length,2);const exact=landmark.maps[1],door=landmark.links.at(-1);assert.equal(exact.rom.templateKey,'12.1');built=await a.qa.compileROM({staticArtwork:true});reopened=await new GbaMaps(built.bytes).discover();const appended=built.reports.find(r=>r.isNew);assert.ok(appended);const actual=reopened.byKey(appended.key);assert.equal(actual.layout.width,28);assert.equal(actual.layout.height,11);assert.equal(reopened.events(reopened.byKey('3.1')).warps.find(w=>w.x===door.from.x&&w.y===door.from.y).target,appended.key);assert.equal(reopened.events(actual).warps.find(w=>w.x===door.to.x&&w.y===door.to.y).target,'3.1');
assert.equal(Buffer.compare(Buffer.from(reader.bytes),original),0);await a.close();
console.log('PASS native geometry: byte-exact no-op export, original warp indices reused on repeated moves, cross-map retarget redirects all inbound references, inactive slots retain indices, crop shifts native records without imported pins, lossless retained words and outgoing/inbound seam offsets; immutable source.');
