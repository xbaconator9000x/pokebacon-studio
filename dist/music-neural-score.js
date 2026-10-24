import {MUSIC_SCALES} from './music-styles.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
function line(notes,start,end){const byTick=new Map();for(const n of notes){const a=Math.max(start,n.tick),b=Math.min(end,n.tick+n.duration);if(a>=b)continue;const old=byTick.get(a);if(!old||old.key<n.key)byTick.set(a,{...n,tick:a-start,duration:b-a});}const ns=[...byTick.values()].sort((a,b)=>a.tick-b.tick);ns.forEach((n,i)=>n.duration=Math.min(n.duration,(ns[i+1]?.tick??end-start)-n.tick));return ns;}
export function neuralPrimer(score,{track=0,start=0,end=Math.min(192,score.length)}={}){
 if(!score.tracks?.[track]||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>score.length||end<=start)throw Error('Choose a valid melody part and A–B range.');
 // Keep at most the last two bars: bounded context and inference time on phones.
 const from=Math.max(start,end-192),bars=Math.max(1,Math.ceil((end-from)/96)),notes=line(score.tracks[track].notes,from,end);
 if(!notes.length)throw Error('The selected motif has no notes.');
 const quantized=[];for(const n of notes){let pitch=n.key;while(pitch<48)pitch+=12;while(pitch>83)pitch-=12;const a=clamp(Math.round(n.tick/6),0,bars*16-1),b=clamp(Math.round((n.tick+n.duration)/6),a+1,bars*16);if(quantized.at(-1)?.quantizedStartStep===a)quantized.pop();if(quantized.length)quantized.at(-1).quantizedEndStep=Math.min(quantized.at(-1).quantizedEndStep,a);quantized.push({pitch,quantizedStartStep:a,quantizedEndStep:b,velocity:clamp(n.velocity||90,1,127)});}
 return{notes:quantized,quantizationInfo:{stepsPerQuarter:4},totalQuantizedSteps:bars*16};
}
export function neuralPlan(score,options={}){
 const settings=score.composition?.settings||{},key=options.key??settings.key??0,scale=options.scale??settings.scale??'Natural minor',steps=MUSIC_SCALES[scale];if(!steps)throw Error('Choose a supported scale.');
 const temperature=options.temperature??.85;if(!Number.isFinite(temperature)||temperature<.2||temperature>1.5)throw Error('Choose exploration between 0.2 and 1.5.');
 const pitch=d=>key+steps[(d%steps.length+steps.length)%steps.length]+Math.floor(d/steps.length)*12;
 const root=(section,bar)=>{const plan=score.composition?.phrasePlan?.find(p=>p.section===section.kind&&p.bar===bar);if(Number.isInteger(plan?.root))return plan.root;const h=score.composition?.harmony||[0,3,4,0],cycle=section.kind==='bridge'?[h[2],h[1],h[0],h[3]]:h;return cycle[(bar+cycle.length)%cycle.length]??0;};
 const chord=(section,bar)=>{const d=root(section,Math.max(0,bar)),r=pitch(d),third=(pitch(d+2)-r+120)%12,fifth=(pitch(d+4)-r+120)%12;return names[(r%12+12)%12]+(third===3&&fifth===6?'dim':third===3?'m':third===4&&fifth===8?'aug':third===5?'sus4':third===2?'sus2':'');};
 const ref=options.referenceScore,range={track:options.track??0,start:options.start??0,end:options.end??Math.min(192,ref?.length||0)},jobs=[];
 for(const section of score.songSections.filter(s=>s.kind!=='intro')){const bars=Math.min(8,Math.ceil(section.length/96));for(let bar=0;bar<bars;bar+=4){const count=Math.min(4,bars-bar),primer=ref?neuralPrimer(ref,range):neuralPrimer(score,{track:0,start:section.start+bar*96,end:Math.min(section.start+(bar+1)*96,section.start+section.length)}),primerBars=primer.totalQuantizedSteps/16;const chords=Array.from({length:primerBars},()=>chord(section,bar));for(let i=0;i<count;i++)chords.push(chord(section,bar+i));jobs.push({section:section.kind,bar,bars:count,primer,steps:count*16,chords,temperature,seed:((options.seed??score.composition?.seed??1)+jobs.length*0x9e3779b9)>>>0});}}
 return{version:1,key,scale,reference:!!ref,jobs};
}
export function applyNeuralPhrases(input,plan,results){
 if(results.length!==plan.jobs.length)throw Error('The melody model returned an incomplete song.');
 const score=structuredClone(input),steps=MUSIC_SCALES[plan.scale],nearest=key=>{const pitches=Array.from({length:49},(_,i)=>48+i).filter(n=>steps.includes((n-plan.key+120)%12));return pitches.reduce((a,b)=>Math.abs(b-key)<Math.abs(a-key)?b:a,pitches[0]);},phrases=new Map();
 results.forEach((result,i)=>{const job=plan.jobs[i],ns=[];for(const n of result.notes||[]){if(!Number.isInteger(n.pitch)||!Number.isInteger(n.quantizedStartStep)||!Number.isInteger(n.quantizedEndStep)||n.pitch<0||n.pitch>127||n.quantizedStartStep<0||n.quantizedEndStep<=n.quantizedStartStep||n.quantizedStartStep>=job.steps)throw Error('The melody model returned invalid notes.');ns.push({tick:job.bar*96+n.quantizedStartStep*6,duration:Math.min(n.quantizedEndStep,job.steps)*6-n.quantizedStartStep*6,key:nearest(n.pitch),velocity:88+(n.quantizedStartStep%4===0?12:0)});}if(!ns.length)throw Error('The melody model returned silence. Try another seed or lower exploration.');if(!phrases.has(job.section))phrases.set(job.section,[]);phrases.get(job.section).push(...ns);});
 const lead=[];for(const section of score.songSections){const source=phrases.get(section.kind==='intro'?'verse':section.kind),cycle=Math.min(8,Math.ceil(score.songSections.find(s=>s.kind===(section.kind==='intro'?'verse':section.kind)).length/96))*96;for(let offset=0;offset<section.length;offset+=cycle)for(const n of source){const tick=offset+n.tick;if(tick>=section.length)continue;if(section.kind==='intro'&&Math.floor(tick/96)%2===0&&n.tick%24)continue;lead.push({...n,tick:section.start+tick,duration:Math.min(n.duration,section.length-tick),velocity:section.kind==='intro'?65:n.velocity});}}
 lead.sort((a,b)=>a.tick-b.tick||a.key-b.key);score.tracks[0].notes=lead.filter((n,i)=>!i||n.tick!==lead[i-1].tick);score.tracks[0].notes.forEach((n,i,a)=>n.duration=Math.min(n.duration,(a[i+1]?.tick??score.length)-n.tick));
 // Keep answering parts in the new lead's breathing spaces.
 if(score.tracks.length===6)score.tracks[1].notes=score.tracks[1].notes.filter(n=>!score.tracks[0].notes.some(m=>n.tick<m.tick+m.duration&&m.tick<n.tick+n.duration));
 score.composition.neural={engine:'Melody development',model:'bundled chord-aware melody stage',version:'local',phrases:plan.jobs.length,temperature:plan.jobs[0]?.temperature,seed:input.composition?.seed??1,reference:plan.reference,training:'General melody stage; not trained on a specific game'};
 return score;
}
