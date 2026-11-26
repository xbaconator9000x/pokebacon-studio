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
