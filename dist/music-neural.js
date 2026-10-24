import {neuralPlan,applyNeuralPhrases} from './music-neural-score.js';
import {musiganPlan,applyMusiganPhrases} from './music-musigan-score.js';

// The local melody stages have deliberately different jobs. One supplies a
// bounded contour and the other develops chord-aware motion. Keep both workers
// behind one cancellable runner so a phone can stop either stage cleanly.
export function neuralComposer({
 workerFactory=()=>new Worker(new URL('./music-neural-worker.js',import.meta.url)),
 musiganWorkerFactory=()=>new Worker(new URL('./music-musigan-worker.js',import.meta.url))
}={}){
 let active=null;
 const cache=new Map();
 const remember=(key,value)=>{cache.set(key,structuredClone(value));while(cache.size>6)cache.delete(cache.keys().next().value);};
 function cancel(){if(!active)return;active.worker.terminate();clearTimeout(active.timer);active.reject(Object.assign(Error('Generation stopped.'),{name:'AbortError'}));active=null;}
 const modelError=(kind,stage='')=>kind==='musigan'
  ?`The contour ${stage?'stage ':''}stopped unexpectedly. Try the melody or phrase composer.`
  :`The melody ${stage?'development ':''}stage stopped unexpectedly. Try again, or choose Phrase composer.`;
 async function runJobs(kind,plan,options={}){
  const fingerprint=kind+JSON.stringify(plan);
  if(cache.has(fingerprint))return structuredClone(cache.get(fingerprint));
  const stage=options.hybridStage?` (${options.hybridStage})`:'';
  options.onProgress?.(kind==='musigan'
   ?`Loading contour stage${stage}…`
   :`Loading melody stage${stage}…`);
  const results=await new Promise((resolve,reject)=>{
   let worker;
   try{worker=kind==='musigan'?musiganWorkerFactory():workerFactory();}
   catch{reject(Error(kind==='musigan'
    ?'The contour stage could not start. Choose the melody or phrase composer.'
    :'The melody stage could not start. Choose Phrase composer or reopen the app.'));return;}
   const job={worker,reject,timer:null};active=job;
   const finish=(error,value)=>{if(active!==job)return;clearTimeout(job.timer);worker.terminate();active=null;error?reject(error):resolve(value);};
   const heartbeat=()=>{clearTimeout(job.timer);job.timer=setTimeout(()=>finish(Error(kind==='musigan'
    ?`The contour ${options.hybridStage?'stage ':''}took too long. Try the melody or phrase composer.`
    :`The melody ${options.hybridStage?'development ':''}stage took too long. Try again, or choose Phrase composer.`)),180000);};
   worker.onmessage=e=>{if(active!==job)return;heartbeat();if(e.data.type==='progress')options.onProgress?.(e.data.message);else if(e.data.type==='result')finish(null,e.data.results);else if(e.data.type==='error')finish(Error(e.data.message));};
   worker.onerror=()=>finish(Error(modelError(kind,options.hybridStage)));
   heartbeat();
   worker.postMessage({jobs:plan.jobs});
  });
  remember(fingerprint,results);
  return structuredClone(results);
 }
 async function generate(score,options={}){
  cancel();
  const requested=options.engine;
  const engine=requested==='musigan'||requested==='hybrid'?requested:'magenta';
  if(engine==='hybrid'){
   // Stage 1: use the contour stage only to suggest a bounded contour. The guided
   // arranger preserves the base score's rhythm, harmony, cadence and GBA
   // timing, so the next model receives a musical scaffold rather than noise.
   const musigan=musiganPlan(score,options);
   const musiganResults=await runJobs('musigan',musigan,{...options,hybridStage:'contour'});
   const scaffold=applyMusiganPhrases(score,musigan,musiganResults);
   options.onProgress?.('Developing the contour with the melody stage…');

   // Stage 2: the melody stage sees the guided contour as its local primer and turns it
   // into connected, chord-conditioned phrases. Offset the seed so the second
   // model is deterministic but not a byte-for-byte replay of a pure melody-stage run
   // run made with the same user seed.
   const magentaOptions={...options,engine:'magenta',hybridStage:'development',seed:(((options.seed??score.composition?.seed??1)^0x6d2b79f5)>>>0)};
   // A selected A–B reference has already guided the contour stage.
   // Let the melody stage read the resulting scaffold so the hybrid really develops
   // that contour instead of silently reverting to the untouched source clip.
   delete magentaOptions.referenceScore;
   const magenta=neuralPlan(scaffold,magentaOptions);
   const magentaResults=await runJobs('magenta',magenta,magentaOptions);
   const out=applyNeuralPhrases(scaffold,magenta,magentaResults);
   out.composition.neural={
    engine:'Hybrid melody development',
    model:'Contour scaffold + chord-aware melody',
    version:'Local contour + melody stages',
    phrases:magenta.jobs.length,
    temperature:magenta.jobs[0]?.temperature,
    seed:score.composition?.seed??1,
    reference:musigan.reference,
    training:'The contour stage supplies bounded inspiration; the melody stage develops chord-aware phrases; the GBA-safe arranger owns rhythm, harmony and cadence'
   };
   return out;
  }
  const plan=engine==='musigan'?musiganPlan(score,options):neuralPlan(score,options);
  const results=await runJobs(engine,plan,options);
  return engine==='musigan'?applyMusiganPhrases(score,plan,results):applyNeuralPhrases(score,plan,results);
 }
 return{generate,cancel};
}

export function neuralFields(prefix){return `<label>Composition engine<select id="${prefix}Engine"><option value="hybrid">Hybrid composer · recommended</option><option value="magenta">Melody composer</option><option value="phrase">Phrase composer · instant</option></select></label><label>Melody exploration <output id="${prefix}TemperatureValue">0.85</output><input id="${prefix}Temperature" type="range" min="0.2" max="1.5" step="0.05" value="0.85"></label><p class="hint-line"><span id="${prefix}EngineHint">Hybrid develops a connected lead over the arrangement while keeping the selected motif and GBA timing.</span> Higher exploration takes more chances.</p>`;}
