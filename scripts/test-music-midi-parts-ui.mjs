import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeMIDI} from '../dist/music-compose.js';
import {quickTrackWorkshop} from '../dist/music-quick-ui.js';
const runtime=process.env.MAP_STUDIO_QA_RUNTIME;
if(!runtime)throw Error('Set MAP_STUDIO_QA_RUNTIME to node_modules containing jsdom.');
const {JSDOM}=await import(pathToFileURL(resolve(runtime,'jsdom/lib/api.js')));
const dom=new JSDOM('<dialog id="dialog"><div id="dialogBody"></div></dialog>');globalThis.document=dom.window.document;
const $=s=>document.querySelector(s),source={ppq:24,length:384,loopStart:96,tempos:[{tick:0,bpm:112}],tracks:['Lead','Piano harmony','Bass','Strings','Percussion'].map((name,i)=>({name,program:i===4?3:17,midiProgram:i===2?33:0,...(i===4?{channel:9}:{}),notes:Array.from({length:8},(_,j)=>({tick:j*48,duration:i===4?3:30,key:[72,64,40,67,36][i]+j%3,velocity:90}))}))};
const bytes=writeMIDI(source),before=bytes.slice(),errors=[];let played,saved,submit,starts=0;
const api={tracks:()=>[],esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),session:()=>null,stop(){},modal(t,html,fn){$('#dialogBody').innerHTML=html;submit=fn;},play:async a=>played=a,add:a=>saved=a,openLibrary(){},toast(){},error:e=>errors.push(e),neural:{cancel(){},async generate(s){starts++;return {...s,composition:{...s.composition,neural:{engine:'Hybrid melody development'}}};}},arrange(){},save(){}};
const quick=quickTrackWorkshop(api);quick.open('shattered');
Object.defineProperty($('#quickBaseMIDIFile'),'files',{value:[{name:'Five_parts.mid',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}]});
await $('#quickBaseMIDIFile').onchange({target:$('#quickBaseMIDIFile')});
assert.deepEqual(errors,[]);assert.equal($('#quickBasis').value,'track');assert.equal(document.querySelectorAll('[data-source-part]').length,5);assert.equal($('#quickPartsPanel').hidden,false);assert.match($('#quickPartChoices').textContent,/MIDI track/);
for(const indices of [[0,1],[0,2,3]]){
 $('#quickClearParts').click();assert.match($('#quickPartCount').textContent,/0 of 5/);
 for(const i of indices){const c=$('[data-source-part="'+i+'"]');c.checked=true;c.onchange();}
 assert.match($('#quickPartCount').textContent,new RegExp(indices.length+' of 5'));assert.equal($('#quickScope').value,'selected');await $('#quickPreview').onclick();assert.deepEqual(errors,[]);
 assert.deepEqual(played.arrangement.score.composition.baseTrack.sourceParts.slice().sort(),indices);assert.deepEqual(played.arrangement.quick.selectedParts,indices);assert.equal(played.arrangement.quick.engine,'Hybrid melody development');
 await submit();assert.deepEqual(saved.arrangement.quick.selectedParts,indices);
}
assert.ok(starts>=4);$('#quickAllParts').click();assert.equal($('#quickScope').value,'whole');assert.match($('#quickPartCount').textContent,/5 of 5/);assert.deepEqual(bytes,before);dom.window.close();
console.log('PASS direct multipart MIDI import, visible original file parts, two/three checked parts, Hybrid invocation, saved selection, select all and unchanged input.');
