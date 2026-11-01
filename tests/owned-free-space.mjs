undefined
// A full-size ROM may receive header/script edits before its first allocation.
// The allocator must retain the verified source proof while excluding new writes.
import {RomOutput} from '../dist/rom-writer.js';
function fullFixture(){const b=new Uint8Array(32*1024*1024),v=new DataView(b.buffer);b.fill(255,0x950000,0xc78500);b.set(new TextEncoder().encode('PBFREE93'),512);v.setUint32(520,1,true);v.setUint32(524,0x950000,true);v.setUint32(528,0xc78500,true);v.setUint32(532,0,true);v.setUint32(0x800,0x08a00000,true);v.setUint32(532,crc(b,532),true);return b;}
const source=fullFixture();let output=new RomOutput(source);output.write(0x1000,Uint8Array.of(1));assert.equal(output.allocate(new Uint8Array(3*1024*1024).fill(90)),0x950000);
output=new RomOutput(source);output.write(0x950000,new Uint8Array(8192).fill(12));assert.equal(output.allocate(new Uint8Array(3*1024*1024).fill(90)),0x952000);assert.ok(output.bytes.subarray(0x950000,0x952000).every(n=>n===12));
const stale=source.slice();stale[100]=1;assert.throws(()=>new RomOutput(stale).allocate(new Uint8Array(3*1024*1024).fill(90)),/No verified erased ROM space/);
console.log('Write-before-allocation, reserved writes, large contiguous allocation and stale-source rejection: PASS');
