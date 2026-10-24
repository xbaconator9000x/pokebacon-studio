import assert from 'node:assert/strict';
import {session,newProject} from './qa-harness.mjs';
import {musicWorkshop} from '../dist/music-ui.js';
import {composeMusic,compileMusic} from '../dist/music-compose.js';
import {authoring} from '../dist/authoring-model.js';
const s=await session({},true),{w,$}=s;globalThis.document=w.document;const project=newProject('Preview stop QA'),sources=[];let worker;
authoring(project).music.push({id:'song',name:'Song',asset:compileMusic(composeMusic({bars:4}))});
class FakeWorker{constructor(){worker=this;this.pending=[];}postMessage(job){this.pending.push(job);}resolve(index,error){const job=this.pending[index];this.onmessage({data:{id:job.id,...(error?{error}:{result:{pcm:new Float32Array(8),sampleRate:22050,warnings:[]}})}});}terminate(){}}
globalThis.Worker=FakeWorker;globalThis.AudioContext=class{resume(){return Promise.resolve();}createBuffer(ch,n){return{getChannelData:()=>new Float32Array(n)};}createBufferSource(){const source={started:false,stopped:false,connect(){},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}};sources.push(source);return source;}};
const tool=musicWorkshop({project:()=>project,session:()=>null,esc:String,modal(title,html){$('#dialogBody').innerHTML=html;},change:fn=>fn(),toast(){},error(e){throw e;}});
const pending=async()=>{const promise=tool.previewId('song');await Promise.resolve();await Promise.resolve();await Promise.resolve();return{promise};};
try{
 tool.open();let a=await pending();assert.equal($('#musicPreviewStop').hidden,false);assert.equal($('#musicPreviewStop').parentElement.id,'musicPreviewTransport');$('#musicPreviewStop').click();assert.equal($('#musicPreviewStop').hidden,true);worker.resolve(0);await a.promise;assert.equal(sources.length,0,'Stopping during rendering must prevent late playback');
 a=await pending();worker.resolve(1);await a.promise;assert.equal(sources.at(-1).started,true);$('#musicPreviewStop').click();assert.equal(sources.at(-1).stopped,true);assert.equal($('#musicPreviewStop').hidden,true);
 a=await pending();worker.resolve(2);await a.promise;sources.at(-1).onended();assert.equal($('#musicPreviewStop').hidden,true,'Natural completion clears the transport');
 a=await pending();const b=await pending();worker.resolve(3);await a.promise;assert.equal($('#musicPreviewStop').hidden,false,'An obsolete result must not hide the current stop control');worker.resolve(4);await b.promise;$('#dialog').dispatchEvent(new w.Event('close'));assert.equal(sources.at(-1).stopped,true);assert.equal($('#musicPreviewStop').hidden,true);
 a=await pending();worker.resolve(5,'Preview failed');await assert.rejects(a.promise,/Preview failed/);assert.equal($('#musicPreviewStop').hidden,true);assert.equal(document.querySelectorAll('#musicPreviewStop').length,1);tool.stop();
 console.log('PASS persistent stop during rendering/playback, late-result cancellation, natural completion, newer requests, dialog close and errors');
}finally{tool.stop();await s.close();}
