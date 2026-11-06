import test from 'node:test';
import assert from 'node:assert/strict';
import {readNativeSprite,installNativeSpriteEdits,compressSpriteLZ,encodeSprite4bpp} from '../dist/native-sprites.js';
import {RomOutput} from '../dist/rom-writer.js';
import {newProject,validateProject} from '../dist/model.js';
const fixture=()=>{
 const bytes=new Uint8Array(0x10000),v=new DataView(bytes.buffer);bytes.set(compressSpriteLZ(encodeSprite4bpp(Array(1024).fill(1),32,32)),0x1000);
 v.setUint32(0x400,0x08001000,true);v.setUint32(0x40c,0x08001000,true);
 const rows=[0,1].map(id=>({id,name:'Outfit '+id,view:'walking',width:32,height:32,pixelRow:0x400+id*12,paletteAddress:0x800,paletteInline:true,pixelCompressed:true}));
 return{bytes,profile:{format:'native-sprites-3',wardrobe:{rows}}};
};
test('wardrobe edits validate through save/reopen and isolate shared pixel resources',()=>{
 const {bytes,profile}=fixture(),old=readNativeSprite(bytes,profile,{kind:'wardrobe',id:0}),pixels=[...old.frames[0]];pixels[5]=2;
 const edit={kind:'wardrobe',id:0,side:'front',frame:0,pixels},p=newProject();p.romEdits={['a'.repeat(64)]:{sprites:[edit]}};
 validateProject(JSON.parse(JSON.stringify(p)),[]);
 const output=new RomOutput(bytes);installNativeSpriteEdits(output,bytes,profile,[edit]);
 assert.equal(readNativeSprite(output.bytes,profile,edit).frames[0][5],2);
 assert.equal(readNativeSprite(output.bytes,profile,{kind:'wardrobe',id:1}).frames[0][5],1);
 assert.equal(readNativeSprite(bytes,profile,edit).frames[0][5],1);
});
test('wardrobe shared palettes require explicit approval and retain inline palette storage',()=>{
 const {bytes,profile}=fixture(),r=readNativeSprite(bytes,profile,{kind:'wardrobe',id:0});assert.deepEqual(r.sharedPaletteUsers,[0,1]);
 const palette=[...r.palettes[0]];palette[1]='#ff0000';const edit={kind:'wardrobe',id:0,palette};
 assert.throws(()=>installNativeSpriteEdits(new RomOutput(bytes),bytes,profile,[edit]),/shared/);
 const output=new RomOutput(bytes);installNativeSpriteEdits(output,bytes,profile,[{...edit,allowSharedPalette:true}]);
 assert.equal(readNativeSprite(output.bytes,profile,{kind:'wardrobe',id:1}).palettes[0][1],'#ff0000');
 assert.equal(new DataView(output.bytes.buffer).getUint32(0x400,true),0x08001000);
});
