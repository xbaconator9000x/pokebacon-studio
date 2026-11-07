import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPackedBorders} from '../dist/native-artwork-pack.js';
import {GbaMaps} from '../dist/rom.js';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
test('native artwork rejects stale packs that omit live off-map border tiles',async()=>{
 const reader=await new GbaMaps(syntheticROM()).discover(),map=reader.byKey('0.0'),before=reader.bytes.slice();
 new DataView(reader.bytes.buffer).setUint16(map.layout.border,640,true);
 assert.throws(()=>verifyPackedBorders(reader,map,{reservedIds:[0]}),e=>e.rebuildNativeArtwork&&e.nativePackStale);
 assert.doesNotThrow(()=>verifyPackedBorders(reader,map,{reservedIds:[0,640]}));
 assert.deepEqual(reader.bytes.subarray(0,map.layout.border),before.subarray(0,map.layout.border));
});
test('expanded-layout border dimensions use the verified offset and refuse malformed spans',async()=>{
 const reader=await new GbaMaps(syntheticROM()).discover(),map=reader.byKey('0.0');
 reader.layoutBorderOffset=26;reader.bytes[map.layout.address+26]=1;reader.bytes[map.layout.address+27]=1;
 new DataView(reader.bytes.buffer).setUint16(map.layout.border,640,true);
 assert.doesNotThrow(()=>verifyPackedBorders(reader,map,{reservedIds:[0,640]}));
 reader.bytes[map.layout.address+26]=0;
 assert.throws(()=>verifyPackedBorders(reader,map,{reservedIds:[0,640]}),/border could not be verified/);
});
