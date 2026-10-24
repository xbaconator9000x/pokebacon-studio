import test from 'node:test';import assert from 'node:assert/strict';import{generatedBorder}from'../dist/map-border.js';
test('generated border retains full object dimensions, metatiles and elevation',()=>{
 const m={width:4,height:3,generator:{borderPattern:{x:0,y:0,w:2,h:3}}},words=Uint16Array.from([0x3001,0x3002,0,0,0x3003,0x3004,0,0,0x3005,0x3006,0,0]);
 const b=generatedBorder(m,words,28),v=new DataView(b.bytes.buffer);assert.equal(b.width,2);assert.equal(b.height,3);assert.deepEqual(Array.from({length:6},(_,i)=>v.getUint16(i*2,true)),[0x3401,0x3402,0x3403,0x3404,0x3405,0x3406]);
 assert.throws(()=>generatedBorder(m,words,24),/border adapter/);m.width=1;assert.throws(()=>generatedBorder(m,words,28),/no longer fits/);
});

test('removed border artwork is rejected before writing a stale pattern',()=>{
 const m={width:4,height:3,generator:{borderPattern:{assemblyId:'gone',x:0,y:0,w:2,h:3}},nativeAssemblies:[]};assert.throws(()=>generatedBorder(m,new Uint16Array(12),28),/moved or removed/);
});
