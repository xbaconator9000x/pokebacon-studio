// Run test-seams-native.mjs first; its sign is fixture-only and never shipped.
import assert from 'node:assert/strict';
import {nativeRuntime} from './native-runtime.mjs';
const file=process.env.MAP_STUDIO_FACING_FIXTURE;
if(!file)throw Error('Set MAP_STUDIO_FACING_FIXTURE to the native seam QA ROM.');
const r=await nativeRuntime(file);
try{
 r.frames(500);r.tap(8,240);r.tap(1,600);for(let i=0;i<35;i++)r.tap(1,100);r.frames(600);
 let sb=r.u32(0x03005008);assert.deepEqual([...r.read(sb+4,2)],[28,0],'Expected compatible fixture start');
 r.frames(2,64);r.tap(1,360);r.frames(180);sb=r.u32(0x03005008);
 assert.deepEqual([...r.read(sb,6)],[4,0,6,0,5,2],'Scripted fixture warp reaches the facing-controlled arrival');
 const id=r.read(0x0203707d,1)[0],object=r.read(0x02036e38+id*36,36);
 assert.equal(object[24]&15,2,'Facing remains north after warp-exit animation');
 r.frames(16,16);r.frames(30);assert.ok(r.u16(sb)>4,'Movement returns to the player');
 console.log('PASS GBA native arrival facing after warp exit and restored player movement.');
}finally{r.core.unload();}
