import test from 'node:test';
import assert from 'node:assert/strict';
import {getField,setField} from '../dist/rse-game-data.js';
test('bit fields read and write without touching neighbours',()=>{
 const b=new Uint8Array(16).fill(0xa5),f={at:4,sh:23,bits:9};
 const before=[...b];setField(b,0,f,40);assert.equal(getField(b,0,f),40);
 setField(b,0,f,511);assert.equal(getField(b,0,f),511);
 assert.throws(()=>setField(b,0,f,512));
 assert.equal(b[4],before[4]);assert.equal(b[5],before[5]);assert.equal(b[6],before[6]&0x7f|b[6]&0x80);
 for(const i of [0,1,2,3,8,9])assert.equal(b[i],before[i]);
});
