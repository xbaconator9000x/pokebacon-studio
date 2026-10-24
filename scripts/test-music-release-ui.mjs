// Optional local MIDI/ROM fixtures; no user song or ROM is committed.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,newProject} from './qa-harness.mjs';
import {musicWorkshop} from '../dist/music-ui.js';
import {authoring} from '../dist/authoring-model.js';
import {composeMusic,compileMusic,readMIDI} from '../dist/music-compose.js';
import {extractMusic,musicTables} from '../dist/music-assets.js';
const s=await session({},true),{w,$}=s,project=newProject('Music release QA');globalThis.document=w.document;let submit,errors=[],plays=[];
const rows=authoring(project).music,first={id:'first',name:'First source',tags:[],asset:compileMusic(composeMusic({bars:4,key:0}))},second={id:'second',name:'Second source',tags:[],asset:compileMusic(composeMusic({bars:4,key:5}))};rows.push(first,second);
const tool=musicWorkshop({project:()=>project,session:()=>null,esc:s=>String(s).replaceAll('"','&quot;'),modal(title,html,fn){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=html;submit=fn;},change:fn=>fn(),save:async()=>{},toast(){},error:e=>errors.push(e)});
try{
 tool.open();$('#musicCompose').click();$('#composeReference').value='second';$('#composeUseReference').click();assert.equal($('#referenceSource').value,'second');assert.equal($('#referenceExtra').value,'');$('#referencePart').value='1';await $('#referencePart').onchange();await submit();await submit();let saved=rows.at(-1);assert.deepEqual(saved.asset.arrangement.score.reference.songs,[{id:'second',name:'Second source',part:1}]);
 // A source absent from the selected inputs must not influence the result.
 const before=structuredClone(saved.asset.arrangement.score);first.asset=compileMusic(composeMusic({bars:4,key:11,seed:999}));tool.analysis.generateFrom(second);$('#referencePart').value='1';await $('#referencePart').onchange();await submit();await submit();assert.deepEqual(rows.at(-1).asset.arrangement.score,before);
 tool.analysis.generateFrom(second);$('#referenceExtra').value='first';await $('#referenceExtra').onchange();$('#referenceExtraPart').value='2';await $('#referenceExtraPart').onchange();await submit();await submit();assert.deepEqual(rows.at(-1).asset.arrangement.score.reference.songs.map(r=>[r.id,r.part]),[['second',0],['first',2]]);
 if(process.argv[2]){
  const bytes=fs.readFileSync(process.argv[2]),decoded=readMIDI(bytes),original=structuredClone(decoded.score);
  await tool.composer.importFile({name:'Lavender.mid',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
  assert.equal(document.querySelectorAll('[data-compose-enabled]').length,9);assert.ok($('#composeParts').textContent.includes('Melody motif'));document.querySelector('[data-compose-solo="3"]').click();await submit();saved=rows.at(-1);assert.equal(saved.asset.trackCount,1);assert.equal(saved.asset.arrangement.score.length,15996);assert.match(saved.asset.arrangement.score.tracks[0].name,/04 Melody/);assert.deepEqual(saved.asset.arrangement.score.tracks[0].notes,original.tracks[3].notes);
 }
 if(process.argv[3]){
  const bytes=fs.readFileSync(process.argv[3]),tables=musicTables(bytes),oldWorker=globalThis.Worker,oldAudio=globalThis.AudioContext;let worker,started=0;
  class FakeWorker{constructor(){worker=this;this.pending=[];this.rendered=[];}postMessage(job){if(job.type==='scan')queueMicrotask(()=>this.onmessage({data:{id:job.id,result:tables}}));else if(job.type==='extract')this.pending.push(job);else{this.rendered.push(job.asset.sourceSongId);queueMicrotask(()=>this.onmessage({data:{id:job.id,result:{pcm:new Float32Array(8),sampleRate:22050,warnings:[]}}}));}}terminate(){}resolve(id){const job=this.pending.find(j=>j.options.songId===id);assert.ok(job);this.onmessage({data:{id:job.id,result:extractMusic(bytes,job.options.table,id,job.options)}});}}
  globalThis.Worker=FakeWorker;globalThis.AudioContext=class{resume(){return Promise.resolve();}createBuffer(ch,n){return{getChannelData:()=>new Float32Array(n)};}createBufferSource(){return{connect(){},start(){started++;},stop(){}};}};
  try{await tool.browse(bytes,'FireRed.gba',{maps:[],u16:a=>bytes.readUInt16LE(a)});const earlier=document.querySelector('[data-source-preview="1"]').onclick();$('#sourceMusicSearch').value='340';$('#sourceMusicSearch').oninput({target:$('#sourceMusicSearch')});assert.match($('#sourceMusicRows').textContent,/Battle — Mewtwo/);const later=document.querySelector('[data-source-preview="340"]').onclick();worker.resolve(340);await later;worker.resolve(1);await earlier;assert.deepEqual(worker.rendered,[340],'Late extraction of an earlier click cannot start old audio');assert.equal(started,1);tool.stop();}finally{globalThis.Worker=oldWorker;globalThis.AudioContext=oldAudio;}
 }
 assert.deepEqual(errors,[]);console.log('PASS selected song/part isolation, explicit second reference, named MIDI solo/full-length export, stock song naming and out-of-order preview cancellation');
}finally{await s.close();}
