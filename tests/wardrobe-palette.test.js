import test from 'node:test';
import assert from 'node:assert/strict';
import {wardrobePaletteAddress} from '../dist/wardrobe-palette.js';

test('Shattered wardrobe palettes remain attached to gender, outfit and pose',()=>{
 const origin=0x4000;
 assert.equal(wardrobePaletteAddress(origin,{gender:'male',slot:1,view:'walking'}),origin);
 assert.equal(wardrobePaletteAddress(origin,{gender:'male',slot:1,view:'running'}),origin+32);
 assert.equal(wardrobePaletteAddress(origin,{gender:'male',slot:1,view:'portrait'}),origin+64);
 assert.equal(wardrobePaletteAddress(origin,{gender:'female',slot:1,view:'walking'}),origin+144*96);
 assert.equal(wardrobePaletteAddress(origin,{gender:'female',slot:144,view:'portrait'}),origin+(144+143)*96+64);
 assert.equal(wardrobePaletteAddress(origin,{gender:'male',slot:1,view:'front'}),null);
});
