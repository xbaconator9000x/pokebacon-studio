import test from 'node:test';
import assert from 'node:assert/strict';
import {readRegionMap,regionLZ,installRegionMap,regionPixels,validateRegionEdits} from '../dist/region-map.js';
import {decompressLZ,decodeText} from '../dist/rom.js';
import {encodedText} from '../dist/item-maker.js';
import {STOCK_FIRE_RED_SHA as hash} from '../dist/verified-frlg.js';
import {RomOutput} from '../dist/rom-writer.js';
import {newProject,snapshot,restore,validateProject} from '../dist/model.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
export function regionFixture(){const bytes=new Uint8Array(0x500000).fill(255),v=new DataView(bytes.buffer);bytes.fill(0,0x3ef2dc,0x3ef2dc+160);bytes.set(regionLZ(new Uint8Array(32).fill(0x11)),0x3ef61c);for(const [i,at]of [0x3f089c,0x3f0afc,0x3f0c0c,0x3f0cf0].entries()){const data=[16,176,4,0];let left=1200,first=true;while(left){const tokens=[],items=[];for(let j=0;j<8&&left;j++){if(first||left<3){tokens.push(false);items.push([0]);left--;first=false;}else{const count=Math.min(18,left);tokens.push(true);items.push([(count-3)<<4,0]);left-=count;}}data.push(tokens.reduce((n,b,j)=>n|(b?1<<(7-j):0),0),...items.flat());}bytes.set(data,at);v.setUint32(0x200+i*4,0x08000000+at,true);}const text=encodedText('Town');bytes.set(text,0x300);for(let i=0;i<109;i++){v.setUint32(0x3f1cac+i*4,0x08000300,true);for(const at of [0x3f1e60,0x3f2178]){v.setUint16(at+i*4,1,true);v.setUint16(at+i*4+2,1,true);}}return{bytes};}
test('Town Map relocation preserves source bytes and native flip/palette words',()=>{const reader=regionFixture(),original=reader.bytes.slice(),n=readRegionMap(reader,hash),cells=[...n.pages[0]];cells[0]=0x1c00;const output=new RomOutput(reader.bytes);assert.equal(installRegionMap({regionMaps:{[hash]:{pages:{0:cells},locations:{0:{name:'New Town',x:4,y:11,width:1,height:1}}}}},reader,hash,output).length,2);assert.deepEqual(reader.bytes,original);const v=new DataView(output.bytes.buffer),to=v.getUint32(0x200,true)-0x08000000;assert.equal(new DataView(decompressLZ(output.bytes,to).buffer).getUint16(0,true),0x1c00);assert.equal(v.getUint16(0x3f1e60,true),4);assert.equal(v.getUint16(0x3f1e60+4,true),1);assert.equal(decodeText(output.bytes,v.getUint32(0x3f1cac,true)-0x08000000),'New Town');assert.deepEqual(output.bytes.slice(0x3f0afc,0x3f0b0c),original.slice(0x3f0afc,0x3f0b0c));});
test('Town Map validation refuses unsupported sources and invalid pages before writes',()=>{const r=regionFixture();assert.throws(()=>readRegionMap(r,'b'.repeat(64)),/adapter/);assert.throws(()=>validateRegionEdits({[hash]:{pages:{0:[0]},locations:{}}}),/tile page/);const cells=Array(600).fill(9),out=new RomOutput(r.bytes),old=out.bytes.slice();assert.throws(()=>installRegionMap({regionMaps:{[hash]:{pages:{0:cells},locations:{}}}},r,hash,out),/outside/);assert.deepEqual(out.bytes,old);});
test('World-map edits survive undo, redo, backup and restore',()=>{const p=newProject(),before=captureEdit(p);p.regionMaps={[hash]:{pages:{0:Array(600).fill(0)},locations:{0:{name:'Town',x:1,y:2,width:1,height:1}}}};validateProject(p);const edit=finishEdit(p,before);applyEdit(p,edit);assert.equal(p.regionMaps,undefined);applyEdit(p,edit,true);const saved=snapshot(p);p.regionMaps={};restore(p,saved);assert.equal(p.regionMaps[hash].locations[0].y,2);});
test('Town Map renderer applies tile flips and selected palette',()=>{const tiles=new Uint8Array(32);tiles[0]=1;const palettes=Array.from({length:80},()=>[0,0,0]);palettes[17]=[255,0,0];const cells=Array(600).fill(0x1c00),pixels=regionPixels({tiles,palettes},cells);assert.deepEqual([...pixels.slice((7*240+7)*4,(7*240+7)*4+4)],[255,0,0,255]);assert.deepEqual([...pixels.slice(0,4)],[0,0,0,255]);});

test('edited FireRed Town Maps follow verified live loader pointers across repeated exports',()=>{
 const reader=regionFixture(),b=reader.bytes,v=new DataView(b.buffer);
 const anchors=[[0xc0330,'002336f0a5fa4be0'],[0xc035c,'263123f10bfc35e0'],[0xc0370,'0968034a16e00000'],[0xc0388,'0968034a0ae00000'],[0xc03a4,'891823f1e7fb11e0'],[0xc3d38,'08500003e4990302']];
 for(const[at,hex]of anchors)b.set(Buffer.from(hex,'hex'),at-8);
 for(const[at,to]of [[0xc02ec,0x3ef2dc],[0xc2d10,0x3ef2dc],[0xc0330,0x3ef61c],[0xc035c,0x3f089c],[0xc0370,0x3f0afc],[0xc0388,0x3f0c0c],[0xc03a4,0x3f0cf0],[0xc0c94,0x3f1cac],[0xc4db8,0x3f1cac],[0xc3d3c,0x3f1e60],[0xc3d38,0x3f2178]])v.setUint32(at,0x08000000+to,true);
 const editedHash='c'.repeat(64),n=readRegionMap(reader,editedHash),cells=[...n.pages[0]];cells[3]=0x400;
 const out=new RomOutput(b);installRegionMap({regionMaps:{[editedHash]:{pages:{0:cells},locations:{}}}},reader,editedHash,out);
 assert.equal(readRegionMap({bytes:out.bytes},'d'.repeat(64)).pages[0][3],0x400);
 b[0xc0330-1]^=1;assert.throws(()=>readRegionMap(reader,editedHash),/adapter/);
});
