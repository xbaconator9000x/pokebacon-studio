import {MUSIC_SCALES} from './music-styles.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ticksPerStep=6;

function eventsFor(score,{track=0,start=0,end=Math.min(192,score.length)}={}){
 const notes=score?.tracks?.[track]?.notes||[],from=Math.max(start,end-32*ticksPerStep),events=[];
 for(const n of notes){
  const tick=Math.round((n.tick-from)/ticksPerStep)*ticksPerStep;
  if(tick<0||tick>=32*ticksPerStep)continue;
  events.push({step:Math.round(tick/ticksPerStep),pitch:clamp(Math.round(n.key),0,127),duration:Math.max(ticksPerStep,Math.round(n.duration/ticksPerStep)*ticksPerStep)});
 }
 events.sort((a,b)=>a.step-b.step||b.pitch-a.pitch);
 const unique=[];for(const event of events)if(!unique.some(n=>n.step===event.step))unique.push(event);
 return unique;
}

export function musiganPlan(score,options={}){
 const settings=score.composition?.settings||{},scale=options.scale??settings.scale??'Natural minor';
 if(!MUSIC_SCALES[scale])throw Error('Choose a supported scale.');
 const temperature=clamp(Number(options.temperature??.9),.35,1.5),ref=options.referenceScore;
 const range={track:options.track??0,start:options.start??0,end:options.end??Math.min(192,ref?.length||0)};
 const sections=(score.songSections||[]).filter(s=>s.kind!=='intro');
 const jobs=[];
 for(const section of sections){
  const source=ref?eventsFor(ref,range):eventsFor(score,{track:0,start:section.start,end:section.start+Math.min(section.length,192)});
  // The legacy generator was trained with 32-token context but generated
  // four contexts (128 tokens) for an eight-bar phrase. Generate that full
  // phrase here, then repeat it only when the requested section is longer.
  jobs.push({section:section.kind,bar:0,bars:Math.max(1,Math.ceil(section.length/96)),steps:Math.min(128,Math.max(32,Math.ceil(Math.min(section.length,768)/ticksPerStep))),history:source,temperature,seed:((options.seed??score.composition?.seed??1)+jobs.length*0x9e3779b9)>>>0});
 }
 if(!jobs.length)throw Error('The song has no main or bridge section to compose.');
 return{version:1,engine:'musigan',scale,temperature,reference:!!ref,jobs};
}

export function applyMusiganPhrases(input,plan,results){
 if(!Array.isArray(results)||results.length!==plan.jobs.length)throw Error('The contour model returned an incomplete song.');
 const score=structuredClone(input),sections=score.songSections||[],phrases=new Map(),lead=[];
 for(let i=0;i<results.length;i++){
  const job=plan.jobs[i],notes=results[i]?.notes||[];
  if(!notes.length)throw Error('The contour model returned silence. Try another seed.');
  phrases.set(job.section,notes);
 }
 const scale=MUSIC_SCALES[plan.scale],key=score.composition?.settings?.key??0;
 const nearestScale=pitch=>{let best=clamp(Math.round(pitch),24,108),distance=Infinity;for(let p=Math.max(24,Math.round(pitch)-12);p<=Math.min(108,Math.round(pitch)+12);p++)if(scale.includes((p-key+120)%12)&&Math.abs(p-pitch)<distance){best=p;distance=Math.abs(p-pitch);}return best;};
 const guidedLead=(base,source,section)=>{
  if(!base.length)return null;
  const raw=[...source].filter(n=>Number.isInteger(n.step)&&Number.isInteger(n.key));if(!raw.length)return base;
  const ordered=raw.slice().sort((a,b)=>a.step-b.step),median=[...ordered].sort((a,b)=>a.key-b.key)[Math.floor(ordered.length/2)].key;
  const span=Math.max(1,(ordered.at(-1)?.step??0)+1),amount=clamp(.24+(plan.temperature-.35)*.42,.2,.58),out=[];let previous=null;
  for(let i=0;i<base.length;i++){
   const note=base[i],local=Math.max(0,note.tick-section.start),step=Math.round(local/ticksPerStep)%span;
   let guide=ordered.reduce((best,n)=>Math.abs(n.step-step)<Math.abs(best.step-step)?n:best,ordered[0]);
   // Keep the trained contour as a restrained pitch suggestion. The original
   // arranger still owns onsets, durations, chord tones and phrase endings.
   const contour=clamp(Math.round((guide.key-median)/5),-4,4),use=(i%3===0||i===base.length-1);
   let target=use?note.key+Math.round(contour*amount):note.key;
   target=nearestScale(target);
   if(previous!==null)target=nearestScale(clamp(target,previous-7,previous+7));
   const next={...note,key:target};out.push(next);previous=target;
  }
  return out;
 };
 for(const section of sections){
  const source=phrases.get(section.kind)||phrases.get('verse')||[];
  const base=score.tracks[0].notes.filter(n=>n.tick>=section.start&&n.tick<section.start+section.length),guided=guidedLead(base,source,section);
  if(guided){lead.push(...guided);continue;}
  const phraseTicks=Math.max(96,(Math.max(0,...source.map(n=>n.step))+1)*ticksPerStep),cycle=Math.min(section.length,phraseTicks);
  for(let offset=0;offset<section.length;offset+=cycle)for(const n of source){const local=offset+n.step*ticksPerStep;if(local>=section.length)continue;const duration=Math.min(Math.max(ticksPerStep,n.duration||ticksPerStep),section.length-local);lead.push({tick:section.start+local,duration,key:nearestScale(n.key),velocity:section.kind==='intro'?68:92});}
 }
 lead.sort((a,b)=>a.tick-b.tick||a.key-b.key);
 const cleaned=[];for(const n of lead){const previous=cleaned.at(-1);if(previous&&previous.tick===n.tick)continue;if(previous&&previous.tick+previous.duration>n.tick)previous.duration=n.tick-previous.tick;if(n.duration>0)cleaned.push(n);}
 if(!cleaned.length)throw Error('The contour model produced no usable notes.');
 score.tracks[0].notes=cleaned;
 if(score.tracks.length===6)score.tracks[1].notes=score.tracks[1].notes.filter(n=>!cleaned.some(m=>n.tick<m.tick+m.duration&&m.tick<n.tick+n.duration));
 score.composition.neural={engine:'Contour-guided arranger',model:'bundled contour checkpoint',version:'local',phrases:plan.jobs.length,temperature:plan.temperature,seed:input.composition?.seed??1,reference:plan.reference,training:'The contour checkpoint supplies restrained inspiration; the GBA-safe arranger owns harmony, rhythm and cadence'};
 return score;
}
