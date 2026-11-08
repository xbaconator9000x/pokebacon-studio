import assert from'node:assert/strict';import{verifiedOwnedFreeSpans}from'../dist/owned-free-space.js';
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=(b,zeroAt)=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=table[(c^(i>=zeroAt&&i<zeroAt+4?0:b[i]))&255]^(c>>>8);return(c^0xffffffff)>>>0;};
function fixture(){const b=new Uint8Array(16384).fill(255),v=new DataView(b.buffer);b.set(new TextEncoder().encode('PBFREE93'),512);v.setUint32(520,1,true);v.setUint32(524,4096,true);v.setUint32(528,12288,true);v.setUint32(532,0,true);v.setUint32(532,crc(b,532),true);return b;}
let b=fixture();assert.deepEqual(verifiedOwnedFreeSpans(b),[{start:4096,end:12288}]);b[8192]=0;assert.deepEqual(verifiedOwnedFreeSpans(b),[]);b=fixture();b[100]=0;assert.deepEqual(verifiedOwnedFreeSpans(b),[]);b=fixture();new DataView(b.buffer).setUint32(524,0,true);assert.deepEqual(verifiedOwnedFreeSpans(b),[]);console.log('Owned free-space proof, occupied span, stale ROM and invalid bounds: PASS');

// A full-size ROM may receive header/script edits before its first allocation.
// The allocator must retain the verified source proof while excluding new writes.
import {RomOutput} from '../dist/rom-writer.js';
function fullFixture(){const b=new Uint8Array(32*1024*1024),v=new DataView(b.buffer);b.fill(255,0x950000,0xc78500);b.set(new TextEncoder().encode('PBFREE93'),512);v.setUint32(520,1,true);v.setUint32(524,0x950000,true);v.setUint32(528,0xc78500,true);v.setUint32(532,0,true);v.setUint32(0x800,0x08a00000,true);v.setUint32(532,crc(b,532),true);return b;}
const source=fullFixture();let output=new RomOutput(source);output.write(0x1000,Uint8Array.of(1));assert.equal(output.allocate(new Uint8Array(3*1024*1024).fill(90)),0x950000);
output=new RomOutput(source);output.write(0x950000,new Uint8Array(8192).fill(12));assert.equal(output.allocate(new Uint8Array(3*1024*1024).fill(90)),0x952000);assert.ok(output.bytes.subarray(0x950000,0x952000).every(n=>n===12));
const stale=source.slice();stale[100]=1;assert.throws(()=>new RomOutput(stale).allocate(new Uint8Array(3*1024*1024).fill(90)),/(?:No verified erased ROM space|Insufficient verified ROM space)/);
console.log('Write-before-allocation, reserved writes, large contiguous allocation and stale-source rejection: PASS');
