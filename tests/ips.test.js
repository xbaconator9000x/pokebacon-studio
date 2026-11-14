import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {GbaMaps} from '../dist/rom.js';
import {createIPS,applyIPS} from '../dist/ips.js';
import {newProject} from '../dist/model.js';
import {RomOutput} from '../dist/rom-writer.js';
import {stageROMHex,installROMHexEdits} from '../dist/native-hex-workspace.js';
const id='a'.repeat(64);
const raw=a=>Uint8Array.from(a);
test('real source-built GBA remains discoverable after IPS create/apply with unrelated bytes preserved',async()=>{
 const source=syntheticROM(),project=newProject();
 stageROMHex(project,id,source,0xa0,raw([90]));
 stageROMHex(project,id,source,0x6b0,raw([12,34,56,78]));
 const output=new RomOutput(source);
 installROMHexEdits(project,id,source,output);
 const patch=createIPS(source,output.bytes);
 assert.equal(new TextDecoder().decode(patch.bytes.subarray(0,5)),'PATCH');
 assert.ok(patch.records>=2);
 assert.deepEqual(applyIPS(source,patch.bytes).bytes,output.bytes);
 const reopened=await new GbaMaps(applyIPS(source,patch.bytes).bytes).discover();
 assert.equal(reopened.maps.length,12);
 assert.equal(reopened.title[0],'Z');
 assert.equal(source[0xa0],67,'source title is unchanged');
 assert.equal(source[0x6b0],0);
});
test('IPS encodes >65,535 contiguous changed bytes by splitting records and verifies exact target',()=>{
 const before=new Uint8Array(140000).fill(255),after=before.slice();
 after.fill(42,1200,81000);
 const patch=createIPS(before,after);
 assert.equal(patch.records,2);
 assert.deepEqual(applyIPS(before,patch.bytes).bytes,after);
});
test('reserved ASCII EOF address is escaped by starting one byte earlier',()=>{
 const before=new Uint8Array(0x460000).fill(255),after=before.slice();
 after[0x454F46]=13;
 const patch=createIPS(before,after);
 assert.ok(patch.bytes.length<128);
 assert.equal((patch.bytes[5]<<16)|(patch.bytes[6]<<8)|patch.bytes[7],0x454F45);
 assert.deepEqual(applyIPS(before,patch.bytes).bytes,after);
});
test('IPS RLE decoding and optional 24-bit target truncation operate without source mutation',()=>{
 const source=new Uint8Array(4096).fill(0xFF),rle=raw([80,65,84,67,72,0,2,0,0,0,0,5,0xA7,69,79,70]);
 const decoded=applyIPS(source,rle);
 assert.equal(decoded.bytes[0x200],0xA7);assert.equal(decoded.bytes[0x204],0xA7);assert.equal(decoded.bytes[0x205],0xff);
 assert.equal(source[0x200],0xff);
 const smaller=source.slice(0,2048),patch=createIPS(source,smaller);
 assert.equal(patch.records,0);
 assert.deepEqual(applyIPS(source,patch.bytes).bytes,smaller);
});
test('IPS malformed records, missing EOF, truncation and >16MiB changed offsets are refused',()=>{
 const source=new Uint8Array(4096).fill(0xFF);
 for(const patch of [raw([]),raw([80,65,84,67,72,0,0,0,0,1]),raw([80,65,84,67,72,0,2,0,0,0,0,1]),raw([80,65,84,67,72,69,79,70,255]),raw([66,65,68,67,72,69,79,70])])
  assert.throws(()=>applyIPS(source,patch),/IPS/);
 const large=new Uint8Array(0x1000020),modified=large.slice();
 modified[0x1000000]=1;
 assert.throws(()=>createIPS(large,modified),/16 MiB|BPS/);
});
