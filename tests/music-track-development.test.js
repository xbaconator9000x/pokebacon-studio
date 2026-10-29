import test from 'node:test';
import assert from 'node:assert/strict';
import {neuralComposer} from '../dist/music-neural.js';
import {styleExistingTrack,suggestMelodyPart} from '../dist/music-track-style.js';
import {developTrackArrangement} from '../dist/music-track-development.js';
import {applyAftermathTreatment} from '../dist/music-aftermath-treatment.js';
import {compileMusic,checkScore} from '../dist/music-compose.js';
const base=()=>({ppq:24,length:3096,loopStart:24,tempos:[{tick:0,bpm:120}],tracks:[{name:'Main tune',program:17,notes:Array.from({length:100},(_,i)=>({tick:12+i*30,duration:18,key:72+[0,2,4,7][i%4],velocity:96}))}]});
const sig=t=>t.notes.map(n=>[n.key,n.tick,n.duration]);
test('melody selection penalises late secondary lines rather than preferring the highest part',()=>{
 const s=base();s.tracks[0].name='ROM part 2';s.tracks.push({name:'ROM part 6',program:92,notes:Array.from({length:50},(_,i)=>({tick:1540+i*30,duration:24,key:84+i%8,velocity:100}))});
 assert.equal(suggestMelodyPart(s),0);
});
test('real Hybrid orchestration develops backing through both workers and preserves the whole source tune',async()=>{
 const starts=[];
 const worker=kind=>({postMessage({jobs}){starts.push(kind);queueMicrotask(()=>this.onmessage({data:{type:'result',results:jobs.map(j=>kind==='contour'?{notes:[{step:0,key:65,duration:6},{step:7,key:72,duration:6}]}:{notes:[{pitch:66,quantizedStartStep:0,quantizedEndStep:j.steps/2},{pitch:70,quantizedStartStep:j.steps/2,quantizedEndStep:j.steps}]})}}));},terminate(){}});
 const composer=neuralComposer({workerFactory:()=>worker('melody'),musiganWorkerFactory:()=>worker('contour')});
 const source=base(),before=structuredClone(source),styled=styleExistingTrack(source,{preset:'shattered'}).score;
 const out=await developTrackArrangement(styled,composer,{engine:'hybrid',seed:44});
 assert.deepEqual(starts,['contour','melody']);assert.match(out.composition.neural.engine,/Hybrid/);assert.equal(out.composition.neural.reference,true);
 assert.deepEqual(sig(out.tracks[0]),sig(source.tracks[0]));assert.notDeepEqual(out.tracks[out.composition.neural.developedPart].notes,styled.tracks[out.composition.neural.developedPart]?.notes);
 const treated=applyAftermathTreatment(out,{mode:'worn-strong',seed:44});assert.deepEqual(sig(treated.tracks[0]),sig(source.tracks[0]));assert.equal(treated.loopStart,source.loopStart);assert.ok(compileMusic(treated).bytes.length);assert.deepEqual(source,before);
});
test('composer receives source tonality, handles late entries, and model failure never silently becomes a phrase arrangement',async()=>{
 const s=base();s.tracks[0].notes=s.tracks[0].notes.filter(n=>n.tick>1500);const styled=styleExistingTrack(s,{preset:'wrath'}).score;
 let calls=0;const out=await developTrackArrangement(styled,{async generate(input,options){calls++;assert.equal(options.key,styled.composition.settings.key);assert.ok(input.tracks[0].notes[0].tick===0);assert.ok(options.referenceScore);return {...input,composition:{...input.composition,neural:{engine:'Test development'}}};}},{engine:'magenta',key:9});
 assert.equal(calls,1);assert.deepEqual(sig(out.tracks[0]),sig(styled.tracks[0]));checkScore(out);
 await assert.rejects(developTrackArrangement(styled,{async generate(){throw Error('Checkpoint unavailable');}},{engine:'hybrid'}),/Checkpoint unavailable/);
 assert.deepEqual(await developTrackArrangement(styled,null,{engine:'phrase'}),styled);
});
