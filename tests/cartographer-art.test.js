import test from 'node:test';import assert from 'node:assert/strict';
import {makeCartographerAtlas}from'../dist/cartographer-art.js';
import {AUTOTILE_INDEX}from'../dist/vendor/rgss-autotile/table.js';
test('XP autotiles keep their four exact source quadrants at GBA half scale',async t=>{
 const oldDoc=globalThis.document,oldBitmap=globalThis.createImageBitmap,calls=[];t.after(()=>{globalThis.document=oldDoc;globalThis.createImageBitmap=oldBitmap;});
 globalThis.createImageBitmap=async blob=>{const b=new Uint8Array(await blob.arrayBuffer());return b[0]===1?{width:256,height:64,close(){}}:{width:96,height:128,close(){}};};
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},drawImage(...args){calls.push(args);}}),toDataURL:()=> 'data:image/png;base64,AA=='})};
 const priorities=Array(386).fill(0);priorities[385]=1;const ts={id:25,tileset_name:'Outside',autotile_names:['Water'],priorities},entries=new Map([['Graphics/Tilesets/Outside.png',Uint8Array.of(1)],['Graphics/Autotiles/Water.png',Uint8Array.of(2)]]);
 const result=await makeCartographerAtlas(ts,[[48,385,0]],entries);assert.ok(result.planes.get('48,385,0').upper);const quads=calls.filter(c=>c[0].width===96);assert.equal(quads.length,4);for(let q=0;q<4;q++){const n=AUTOTILE_INDEX[q];assert.deepEqual(quads[q].slice(1,5),[n%6*16,Math.floor(n/6)*16,16,16]);assert.deepEqual(quads[q].slice(-2),[8,8]);}assert.equal(AUTOTILE_INDEX.length,192);assert.ok(AUTOTILE_INDEX.every(n=>n>=0&&n<48));
});
