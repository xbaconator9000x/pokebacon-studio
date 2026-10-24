import test from 'node:test';import assert from 'node:assert/strict';import {composeSong} from '../dist/music-song.js';import {quickTrackSettings} from '../dist/music-quick-presets.js';import {neuralPlan,neuralPrimer,applyNeuralPhrases} from '../dist/music-neural-score.js';import {neuralComposer} from '../dist/music-neural.js';import {QUICK_TRACKS} from '../dist/music-quick-presets.js';import {checkScore,compileMusic} from '../dist/music-compose.js';
test('every scene sends a bounded chord-conditioned phrase plan and compiles the returned score',()=>{for(const preset of Object.keys(QUICK_TRACKS)){const source=composeSong(quickTrackSettings(preset,{seed:7})),before=structuredClone(source),plan=neuralPlan(source),results=plan.jobs.map(j=>({notes:[{pitch:65,quantizedStartStep:0,quantizedEndStep:j.steps}]}));assert.ok(plan.jobs.length<=4);for(const j of plan.jobs){assert.ok(j.steps<=64);assert.equal(j.chords.length,(j.primer.totalQuantizedSteps+j.steps)/16);assert.ok(j.chords.every(c=>typeof c==='string'&&!c.includes('undefined')));}const out=applyNeuralPhrases(source,plan,results);assert.equal(out.length,source.length);assert.equal(out.loopStart,source.loopStart);assert.deepEqual(source,before);checkScore(out);compileMusic(out);}});
test('primer trims A–B, limits two-bar context, quantizes and resolves simultaneous notes',()=>{const s={length:768,tracks:[{notes:[{tick:0,duration:96,key:60,velocity:80},{tick:576,duration:48,key:30,velocity:90},{tick:576,duration:96,key:96,velocity:90},{tick:672,duration:96,key:67,velocity:90}]}]};const p=neuralPrimer(s,{track:0,start:96,end:768});assert.equal(p.totalQuantizedSteps,32);assert.equal(p.notes.length,2);assert.ok(p.notes.every(n=>n.pitch>=48&&n.pitch<=83));assert.throws(()=>neuralPrimer(s,{track:0,start:96,end:192}),/no notes/);assert.throws(()=>neuralPrimer(s,{start:3,end:2}),/valid/);});
test('rejects malformed model output without silently using an unrelated melody',()=>{const s=composeSong(),p=neuralPlan(s);assert.throws(()=>applyNeuralPhrases(s,p,[]),/incomplete/);assert.throws(()=>applyNeuralPhrases(s,p,p.jobs.map(()=>({notes:[]}))),/silence/);assert.throws(()=>applyNeuralPhrases(s,p,p.jobs.map(()=>({notes:[{pitch:60,quantizedStartStep:5,quantizedEndStep:1}]}))),/invalid/);});
test('cancel terminates inference, ignores stale results and permits retry',async()=>{let worker;const engine=neuralComposer({workerFactory:()=>worker={postMessage(){},terminate(){this.dead=true;}}}),s=composeSong(),pending=engine.generate(s);engine.cancel();assert.equal(worker.dead,true);await assert.rejects(pending,{name:'AbortError'});worker.onmessage({data:{type:'result',results:[]}});const retry=engine.generate(s);worker.onmessage({data:{type:'error',message:'Missing local checkpoint'}});await assert.rejects(retry,/Missing local/);});
test('same take reuses model output for preview, save and edit',async()=>{let starts=0;const engine=neuralComposer({workerFactory:()=>{starts++;return{postMessage({jobs}){queueMicrotask(()=>this.onmessage({data:{type:'result',results:jobs.map(j=>({notes:[{pitch:60,quantizedStartStep:0,quantizedEndStep:j.steps}]}))}}));},terminate(){}};}}),s=composeSong();const a=await engine.generate(s),b=await engine.generate(s);assert.equal(starts,1);assert.deepEqual(a,b);a.tracks[0].notes[0].key=12;assert.notEqual(b.tracks[0].notes[0].key,12);});
test('hybrid MusiGAN contour becomes a Magenta-developed, editable score',async()=>{
 let musiganStarts=0,magentaStarts=0;
 const worker=kind=>{
  const isMusigan=kind==='musigan';
  if(isMusigan)musiganStarts++;else magentaStarts++;
  return{
   postMessage({jobs}){
    queueMicrotask(()=>this.onmessage({data:{
     type:'result',
     results:jobs.map(j=>isMusigan
      ?{notes:[{step:0,duration:6,key:60},{step:7,duration:6,key:68},{step:15,duration:6,key:64}]}
      :{notes:[{pitch:60,quantizedStartStep:0,quantizedEndStep:4},{pitch:64,quantizedStartStep:4,quantizedEndStep:8},{pitch:67,quantizedStartStep:8,quantizedEndStep:j.steps}]})
    }}));
   },
   terminate(){}
  };
 };
 const progress=[];
 const engine=neuralComposer({workerFactory:()=>worker('magenta'),musiganWorkerFactory:()=>worker('musigan')});
 const source=composeSong(quickTrackSettings('coastal-route',{seed:19}));
 const out=await engine.generate(source,{engine:'hybrid',seed:19,temperature:.8,onProgress:message=>progress.push(message)});
 assert.equal(musiganStarts,1);assert.equal(magentaStarts,1);
 assert.equal(out.composition.neural.engine,'Hybrid melody development');
 assert.match(out.composition.neural.training,/bounded inspiration/);
 assert.ok(progress.some(message=>message.includes('contour')));
 assert.ok(progress.some(message=>message.toLowerCase().includes('melody')));
 checkScore(out);compileMusic(out);
});
