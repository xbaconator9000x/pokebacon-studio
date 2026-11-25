import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha256,legacyPokebaconSha256} from '../dist/sha256.js';
import {romFingerprint,createROMRoundTrip,restoreROMProjectSidecar,resolveROMExportSource} from '../dist/rom-project.js';

const enc=new TextEncoder();
const native=bytes=>createHash('sha256').update(bytes).digest('hex');

test('WebView SHA-256 passes published empty and abc vectors',async()=>{
 assert.equal(await sha256(enc.encode('')),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
 assert.equal(await sha256(enc.encode('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const data=new Uint8Array(256);for(let i=0;i<256;i++)data[i]=i;
 assert.equal(await sha256(data),native(data));
 assert.equal(await sha256(new DataView(data.buffer,32,80)),native(data.subarray(32,112)));
 assert.equal(await sha256(data.buffer),native(data));
 assert.rejects(sha256('abc'),/typed byte/);
});
test('standard 64-byte padding, multiblock, Unicode and 512 KiB variants match node:crypto',async()=>{
 for(const size of [1,55,56,63,64,65,100,1024,65536,524288]){
  const bytes=Uint8Array.from({length:size},(_,i)=>(i*37+i*i)%256);
  assert.equal(await sha256(bytes),native(bytes),'length '+size);
 }
 assert.equal(await sha256(enc.encode('PokéBacon 🥓')),native(enc.encode('PokéBacon 🥓')));
});
test('legacy nonstandard fallback remains separately accessible for migration reviews',async()=>{
 const bytes=enc.encode('abc');
 const previous=await legacyPokebaconSha256(bytes);
 assert.match(previous,/^[0-9a-f]{64}$/);
 assert.notEqual(previous,native(bytes));
 assert.equal(await legacyPokebaconSha256(bytes),previous);
 assert.equal(await sha256(bytes),native(bytes));
});
test('WebCrypto and WebView fallback issue exactly identical authenticated ROM sidecars without re-keying maps',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 const source=new Uint8Array(2048);source.fill(0xff);source.set([0x50,0x4f,0x4b,0x45],0xa0);
 const compiled=source.slice();compiled[700]=0x25;
 const id='legacy-binding-identifier',project={maps:[{rom:{sourceId:id}}]};
 try{
  Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true,writable:true});
  assert.equal(await romFingerprint(source),native(source));
  const record=await createROMRoundTrip(compiled,source,{sourceId:id});
  assert.equal(record.sourceId,id,'do not replace existing project source identity');
  assert.equal(record.sourceFingerprint,native(source));
  assert.equal(record.compiledFingerprint,native(compiled));
  const saved={...project,romRoundTrip:record};
  const restored=await restoreROMProjectSidecar(saved,compiled);
  assert.deepEqual(restored.source,source);
  assert.equal(restored.sourceId,id);
  assert.equal((await resolveROMExportSource(saved,compiled)).sourceId,id);
  const corrupted=compiled.slice();corrupted[700]^=0x12;
  await assert.rejects(restoreROMProjectSidecar(saved,corrupted),/does not match/);
  Object.defineProperty(globalThis,'crypto',{value:{subtle:{digest:async(_algorithm,bytes)=>Uint8Array.from(Buffer.from(native(new Uint8Array(bytes)),'hex')).buffer}},configurable:true,writable:true});
  assert.equal(await romFingerprint(source),record.sourceFingerprint);
 }finally{
  if(old)Object.defineProperty(globalThis,'crypto',old);
  else delete globalThis.crypto;
 }
});
