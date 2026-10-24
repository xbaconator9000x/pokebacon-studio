import test from 'node:test';import assert from 'node:assert/strict';
import {mapDialogueRoots,indexROMDialogue,installTextEdits} from '../dist/rom-text.js';
import {compileScript,decodeScriptText} from '../dist/script-engine.js';
import {RomOutput} from '../dist/rom-writer.js';
import {STOCK_FIRE_RED_SHA as hash} from '../dist/verified-frlg.js';
function fixture(){const bytes=new Uint8Array(32768).fill(255),v=new DataView(bytes.buffer),at=0x1000,c=compileScript('msgbox @text 4\nend\n@text:\n= Shared dialogue.$',at,'frlg');bytes.set(c.bytes,at);let text;for(let i=at;i<at+c.bytes.length;i++)if(bytes[i]===0xcd&&bytes[i+1]===0xdc){text=i;break;} // S,h
 assert.ok(text);v.setUint32(0x345,0x08000000+text,true);
 // Conditional on-frame and warp-in tables; both lead to shared dialogue.
 let table=0x400;for(const type of [2,4]){bytes[table]=type;v.setUint32(table+1,0x08000600,true);table+=5;}bytes[table]=0;v.setUint16(0x600,0x4001,true);v.setUint16(0x602,1,true);v.setUint32(0x604,0x08000000+at,true);v.setUint16(0x608,0,true);
 bytes[0x500]=3;v.setUint32(0x501,0x08000000+at,true);bytes[0x505]=0;
 const maps=[{key:'0.0',label:'First',scripts:0x400},{key:'0.1',label:'Second',scripts:0x500},{key:'0.2',label:'Third',scripts:-1}],reader={bytes,engine:'frlg',maps,events:()=>({npcs:[{script:at}],signs:[],triggers:[]})};return{reader,at,text};}
test('dialogue search includes conditional map-entry scripts and every shared-script map',async()=>{const {reader,at}=fixture();assert.deepEqual(mapDialogueRoots(reader,reader.maps[0]).roots,[at]);const index=await indexROMDialogue(reader);assert.equal(index.scripts,1);assert.equal(index.rows.length,1);assert.deepEqual(index.rows[0].mapKeys,['0.0','0.1','0.2']);assert.deepEqual(index.rows[0].maps,['First','Second','Third']);assert.equal(index.rows[0].extraReferenceCount,1);assert.deepEqual(index.rows[0].extraReferences,[0x345]);});
test('diagnostic pointer matches retain original text when decoded references relocate',async()=>{const {reader,text}=fixture(),index=await indexROMDialogue(reader),row=index.rows[0],out=new RomOutput(reader.bytes);installTextEdits({textEdits:{[hash]:{[row.address]:{original:row.text,text:'Replacement',references:row.references}}}},reader,hash,out);assert.equal(new DataView(out.bytes.buffer).getUint32(0x345,true),0x08000000+text);assert.equal(decodeScriptText(out.bytes,text).text,'Shared dialogue.');});
test('dialogue indexing yields and cancels without returning a stale index',async()=>{const {reader}=fixture();let active=true;await assert.rejects(indexROMDialogue(reader,()=>{active=false;},{shouldContinue:()=>active}),e=>e.name==='AbortError');});
test('map-script traversal reports malformed tables with bounded work',()=>{const {reader}=fixture(),v=new DataView(reader.bytes.buffer);reader.bytes[0x400]=2;v.setUint32(0x401,0x08007ffe,true);v.setUint16(0x7ffe,1,true);assert.ok(mapDialogueRoots(reader,reader.maps[0]).skipped>0);});
