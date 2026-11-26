import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {newProject} from '../dist/model.js';
import {importRomMaps} from '../dist/rom-import.js';
import {buildRom,summarizeAllocations} from '../dist/rom-writer.js';
const render=async m=>Object.fromEntries(['lower','upper','middle'].map(l=>[l,{width:m.width*16,height:m.height*16,data:new Uint8ClampedArray(m.width*16*m.height*16*4)}]));
async function exportOnce(rom,id){const reader=await new GbaMaps(rom).discover(),p=await importRomMaps(newProject('Repeat'),reader,[reader.maps[0].key],{sourceId:id,asNew:true,includeEvents:true,encodeAtlas:async a=>a});return buildRom(p.project,reader,{sourceId:id,renderMap:render});}
test('export places new data after the source, aligned and without overlap',async()=>{
 const rom=syntheticROM(),out=await exportOnce(rom,'a');
 assert.ok(out.allocations.length>0);
 const sorted=[...out.allocations].sort((x,y)=>x.address-y.address);
 for(const [i,a] of sorted.entries()){assert.equal(a.address%4,0,a.reason+' is word aligned');assert.ok(a.address>=rom.length,a.reason+' does not overwrite original data');assert.ok(a.address+a.length<=out.bytes.length);if(i)assert.ok(a.address>=sorted[i-1].address+sorted[i-1].length,a.reason+' does not overlap');}
});
test('exporting the same project twice gives identical bytes and the same plan',async()=>{
 const rom=syntheticROM(),a=await exportOnce(rom,'a'),b=await exportOnce(rom,'a');
 assert.equal(Buffer.compare(Buffer.from(a.bytes),Buffer.from(b.bytes)),0);assert.deepEqual(a.allocations,b.allocations);
});
test('re-importing an exported ROM and exporting again adds no duplicate resources',async()=>{
 const first=await exportOnce(syntheticROM(),'a'),second=await exportOnce(first.bytes,'b');
 assert.equal(second.allocations.length,0,'unchanged maps allocate nothing');assert.equal(second.bytes.length,first.bytes.length);
 assert.equal(Buffer.compare(Buffer.from(second.bytes),Buffer.from(first.bytes)),0,'second generation is byte-identical');
});
test('allocation summary totals match and group by reason',()=>{
 const s=summarizeAllocations([{address:8,length:100,reason:'Map blocks'},{address:200,length:28,reason:'Map layout'},{address:300,length:300,reason:'Map blocks'}]);
 assert.equal(s.blocks,3);assert.equal(s.bytes,428);assert.deepEqual(s.rows[0],{reason:'Map blocks',blocks:2,bytes:400});assert.deepEqual(summarizeAllocations().rows,[]);
});
