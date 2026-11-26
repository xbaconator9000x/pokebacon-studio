import test from 'node:test';
import assert from 'node:assert/strict';
import {metatileFormatAfterAttrs} from '../dist/rom.js';
// Addresses are the real Monomyth v1.0 first-town tilesets: the attribute table
// follows the metatile table and the next tileset's metatiles start right after.
const bounds=new Set([0x5d75a4,0x5da5a4,0x5da9a4,0x5db7e4,0x5db914]);
test('attribute table after metatiles with 24-byte metatiles is read as three layers',()=>{
 assert.equal(metatileFormatAfterAttrs({metatiles:0x5d75a4,attrs:0x5da5a4},bounds),'triple');
});
test('the same ordering with 16-byte metatiles is read as two layers',()=>{
 const b=new Set([0x1000,0x3000,0x3400]);assert.equal(metatileFormatAfterAttrs({metatiles:0x1000,attrs:0x3000},b),'normal');
});
test('ambiguous or invalid layouts are not guessed',()=>{
 assert.equal(metatileFormatAfterAttrs({metatiles:0x1000,attrs:0x2800},new Set([0x1000,0x2800,0x2c00])),null,'gap fits neither size');
 assert.equal(metatileFormatAfterAttrs({metatiles:0x1000,attrs:0x4000},new Set([0x1000,0x4000])),null,'no following boundary');
 assert.equal(metatileFormatAfterAttrs({metatiles:0x5d75a4,attrs:0x5da5a4},bounds,()=>false),null,'metatile data outside the ROM');
 assert.equal(metatileFormatAfterAttrs({metatiles:0x1000,attrs:0x4000},new Set([0x1000,0x4000,0x4200])),null,'attribute count not 512 or 640');
});
