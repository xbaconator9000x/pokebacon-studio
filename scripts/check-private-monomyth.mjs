// Private-ROM check for Pokémon Monomyth v1.0. Never run in CI and the ROM is
// never committed. Usage: node scripts/check-private-monomyth.mjs path/to/monomyth_v1_0.gba [mapKey]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GbaMaps} from '../dist/rom.js';
import {newProject} from '../dist/model.js';
import {importRomMaps} from '../dist/rom-import.js';
import {buildRom} from '../dist/rom-writer.js';
const [,, path, key='0.0']=process.argv;
if(!path){console.error('Give the path to your own Monomyth .gba.');process.exit(2);}
const rom=new Uint8Array(fs.readFileSync(path)),reader=await new GbaMaps(rom).discover();
assert.equal(reader.metatileLayers,3,'three-layer metatiles detected');assert.equal(reader.metatileBytes,24);
let loaded=0,throws=0;for(const m of reader.maps){try{reader.atlas(m);loaded++;}catch{throws++;}}
console.log(`maps ${reader.maps.length}: ${loaded} load, ${throws} fail`);assert.equal(throws,0,'every map atlas loads');
const map=reader.maps.find(m=>m.key===key),atlas=reader.atlas(map);
function render(blocks){const W=map.layout.width,H=map.layout.height,mk=()=>new Uint8ClampedArray(W*16*H*16*4),L=[mk(),mk(),mk()];
 for(let i=0;i<blocks.length;i++){const id=blocks[i]&1023,sx=(id%16)*16,sy=Math.floor(id/16)*16,dx=(i%W)*16,dy=Math.floor(i/W)*16;for(let l=0;l<3;l++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){const s=((sy+y)*256+sx+x)*4,d=((dy+y)*W*16+dx+x)*4;for(let c=0;c<4;c++)L[l][d+c]=atlas.layers[l][s+c];}}
 const img=d=>({width:W*16,height:H*16,data:d});return{lower:img(L[0]),middle:img(L[1]),upper:img(L[2])};}
const exportMap=async edit=>{const p=await importRomMaps(newProject('Monomyth check'),reader,[key],{sourceId:'monomyth',asNew:true,includeEvents:true,encodeAtlas:async a=>a});
 const blocks=Uint16Array.from(reader.blocks(map));edit?.(blocks);return buildRom(p.project,reader,{sourceId:'monomyth',renderMap:async()=>render(blocks)});};
const same=await exportMap();let diff=0;for(let i=0;i<rom.length;i++)if(rom[i]!==same.bytes[i])diff++;
assert.equal(diff,0,'unchanged export is byte-identical');console.log(`${key}: unchanged export is byte-identical`);
const W=map.layout.width,edited=await exportMap(b=>{for(const x of [10,11,12])b[10*W+x]=b[0];});
const alloc=edited.allocations,inside=i=>alloc.some(a=>i>=a.address&&i<a.address+a.length);let outside=0;
for(let i=0;i<rom.length;i++)if(rom[i]!==edited.bytes[i]&&!inside(i))outside++;
const again=await new GbaMaps(edited.bytes).discover(),after=again.blocks(again.maps.find(m=>m.key===key));
assert.equal(after[10*W+10]&1023,reader.blocks(map)[0]&1023,'edit is readable after re-import');
console.log(`${key}: edit exported, ${alloc.length} new blocks, ${outside} bytes changed outside them (layout pointers only)`);assert.ok(outside<=64);
console.log('PASS Monomyth read and export checks (not a gameplay test).');

// Packed (FC 1D) dialogue must decode to readable English.
{
 const {decodeScriptText}=await import('../dist/script-engine.js');
 const t=decodeScriptText(rom,0x2e278b);
 if(!/Post Office/.test(t.text)||/\{WORD/.test(t.text))throw Error('Packed dialogue did not decode: '+t.text);
 console.log('packed dialogue decodes:',JSON.stringify(t.text.slice(0,60)));
}

// Story edits: plain dialogue edits export and read back; packed dialogue is refused.
{
 const {indexNativeStory,installNativeStoryEdits,refreshNativeStory}=await import('../dist/native-story.js');
 const {RomOutput}=await import('../dist/rom-writer.js');
 const g=await indexNativeStory(reader,{mapKeys:reader.maps.slice(0,120).map(m=>m.key)});
 const plain=Object.values(g.texts).find(t=>!t.compressed&&t.text.length>8&&!/\\x/.test(t.text)),packed=Object.values(g.texts).find(t=>t.compressed);
 const project=newProject('Monomyth story check');project.nativeStory={mm:g};
 g.edits.texts[plain.at]={original:plain.original,text:plain.text+' Edited.'};
 const out=new RomOutput(rom);await installNativeStoryEdits(project,reader,'mm',out);
 const back=await refreshNativeStory(g,await new GbaMaps(out.bytes).discover());
 assert.ok(Object.values(back.texts).some(t=>t.text===plain.text+' Edited.'),'plain dialogue edit reads back');
 delete g.edits.texts[plain.at];
 const edited=packed.text+' Edited.';g.edits.texts[packed.at]={original:packed.original,text:edited};
 const out2=new RomOutput(rom);await installNativeStoryEdits(project,reader,'mm',out2);
 const back2=await refreshNativeStory(g,await new GbaMaps(out2.bytes).discover());
 assert.ok(Object.values(back2.texts).some(t=>t.text===edited&&t.compressed),'packed dialogue edit reads back');
 // every packed text must re-encode and decode to itself (or be rejected cleanly)
 const {encodeCompressedText}=await import('../dist/compressed-text.js'),{decodeScriptText}=await import('../dist/script-engine.js');
 let same=0,rejected=0;for(const t of Object.values(g.texts).filter(t=>t.compressed)){try{const b=encodeCompressedText(t.text),buf=new Uint8Array(b.length+8);buf.set(b);if(decodeScriptText(buf,0).text!==t.text)throw Error('Packed text did not round-trip at 0x'+t.at.toString(16));same++;}catch(e){if(/round-trip/.test(e.message))throw e;rejected++;}}
 console.log('packed round trip:',same,'ok,',rejected,'rejected cleanly');
 console.log('story edits: plain and packed dialogue edits export and read back');
}

// Species and moves are found by structure and edit in place.
{
 const {discoverGameData,readGameData,applyGameDataEdits}=await import('../dist/game-data.js');
 const {RomOutput}=await import('../dist/rom-writer.js');
 const profile=await discoverGameData(reader,{sourceSha256:'monomyth'});
 assert.ok(profile?.rse&&profile.speciesCount===405&&profile.moveCount===680&&profile.itemCount===447&&profile.trainerCount===640&&profile.trainerClassCount===116,'species and moves discovered');
 const data=readGameData(reader.bytes,profile),out=new RomOutput(reader.bytes);
 applyGameDataEdits(reader.bytes,profile,{species:{1:{stats:[data.species[1].stats[0]+1,...data.species[1].stats.slice(1)]}},moves:{1:{power:41}}},out);
 assert.equal(profile.abilityCount,212,'ability table');assert.equal(data.abilities[data.species[1].abilities[0]],'Static','ability names');
 { const o2=new RomOutput(reader.bytes);applyGameDataEdits(reader.bytes,profile,{species:{1:{abilities:[10,11]}}},o2);const r2=readGameData(o2.apply?o2.apply(reader.bytes):o2.bytes,profile);assert.deepEqual(r2.species[1].abilities,[10,11]);}
 assert.equal(profile.learnsetStride,4,'learnset table');assert.ok(data.species[25].learnset.length>5,'learnset read');
 { const o3=new RomOutput(reader.bytes),ls=[...data.species[25].learnset,{move:33,level:99}];applyGameDataEdits(reader.bytes,profile,{species:{25:{learnset:ls}}},o3);const r3=readGameData(o3.bytes,profile);assert.deepEqual(r3.species[25].learnset,ls);assert.deepEqual(r3.species[24].learnset,data.species[24].learnset);}
 assert.equal(profile.evolutionSlots,8);assert.ok(data.species[1].evolutions.length===1&&data.species[1].evolutions[0].method===4,'evolutions read');
 { const o4=new RomOutput(reader.bytes),ev=[{...data.species[1].evolutions[0],param:30}];applyGameDataEdits(reader.bytes,profile,{species:{1:{evolutions:ev}}},o4);const r4=readGameData(o4.bytes,profile);assert.deepEqual(r4.species[1].evolutions,ev);assert.throws(()=>applyGameDataEdits(reader.bytes,profile,{species:{1:{evolutions:[{method:23,param:5,species:3}]}}},new RomOutput(reader.bytes)),/Only friendship/);}
 const back=readGameData(out.bytes,profile);
 assert.equal(back.species[1].stats[0],data.species[1].stats[0]+1);assert.equal(back.moves[1].power,41);
 let changed=0;for(let i=0;i<reader.bytes.length;i++)if(reader.bytes[i]!==out.bytes[i])changed++;
 assert.ok(changed<=3,'only the edited bytes change');
 {const tdat=data.trainers[36],edit=structuredClone(tdat);edit.party[0].level=77;const o3=new RomOutput(reader.bytes);applyGameDataEdits(reader.bytes,profile,{trainers:{36:{party:edit.party,customMoves:edit.customMoves,heldItems:edit.heldItems}}},o3);const t3=readGameData(o3.bytes,profile).trainers[36];assert.equal(t3.party[0].level,77);assert.deepEqual(t3.party[0].moves,tdat.party[0].moves);assert.equal(t3.party.length,tdat.party.length);
  let bad=0;for(const tr of data.trainers)for(const m of tr.party)if(!(m.level>=1&&m.level<=100&&m.species>=1&&m.species<405))bad++;assert.equal(bad,0,'every party member is plausible');}
 console.log('species/moves: 405 species, 680 moves; edits read back; bytes changed:',changed);
}
