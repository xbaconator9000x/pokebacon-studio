import {checkScore} from './music-compose.js';
import {fitSourceVoices} from './music-track-style.js';
import {MUSIC_SCALES} from './music-styles.js';

/** Use the selected composer to develop backing around a locked source tune.
 * The model's lead output becomes accompaniment, never a replacement source.
 */
export async function developTrackArrangement(source, composer, options={}) {
 if(options.engine==='phrase')return structuredClone(source);
 const input=structuredClone(source),lead=input.tracks[0],first=lead.notes[0];
 if(!first)throw Error('Choose a melody part containing notes.');
 // The models use bounded local context. Supply a sounding source-derived
 // primer even for pickups, sparse music or a part that enters much later.
 input.songSections=[{kind:'verse',name:'Source-led development',start:0,length:input.length}];
 const {key,scale}=input.composition.settings,steps=MUSIC_SCALES[scale],backing=input.tracks.filter((t,i)=>i>0&&t.channel!==9),bass=backing.filter(t=>/bass/i.test(t.name)),harmony=bass.length?bass:backing;
 if(harmony.length)input.composition.phrasePlan=Array.from({length:Math.min(8,Math.ceil(input.length/96))},(_,bar)=>{
  const notes=harmony.flatMap(t=>t.notes.filter(n=>n.tick<(bar+1)*96&&n.tick+n.duration>bar*96)),low=notes.length?notes.reduce((a,b)=>a.key<b.key?a:b):null,pc=low?((low.key-key)%12+12)%12:0;
  let root=0;for(let i=1;i<steps.length;i++)if(Math.abs(steps[i]-pc)<Math.abs(steps[root]-pc))root=i;
  return {section:'verse',bar,root};
 });
 lead.notes=lead.notes.map(n=>({...n,tick:n.tick-first.tick}));
 for(const at of [0,384])if(at<input.length&&!lead.notes.some(n=>n.tick>=at&&n.tick<Math.min(at+96,input.length)))lead.notes.push({...first,tick:at,duration:Math.min(first.duration,input.length-at)});
 lead.notes.sort((a,b)=>a.tick-b.tick);
 const generated=await composer.generate(input,{...options,...source.composition.settings,referenceScore:input,track:0,start:0,end:Math.min(192,input.length)});
 checkScore(generated,{arranging:true});
 const out=structuredClone(source),notes=generated.tracks[0].notes;
 if(!notes.length)throw Error('The composer returned no development. Try another take.');
 // Give the generated phrases a clearly audible part, including their actual
 // onsets, lengths and rests. Previously only two sparse parts borrowed pitches.
 let lane=out.tracks.findIndex((t,i)=>i>0&&t.channel!==9&&!/bass/i.test(t.name));
 if(lane<0){lane=out.tracks.length;out.tracks.push({name:'Hybrid development',program:20,notes:[],automation:[{tick:0,volume:82,pan:76,bend:0,range:2}]});}
 const preset=out.composition.quickPreset,spacing=preset==='loss'?48:preset==='shattered'?24:12;
 let last=-Infinity;const developed=[];
 for(const raw of notes){if(raw.tick-last<spacing)continue;let key=raw.key;while(key>79)key-=12;while(key<48)key+=12;developed.push({...raw,key,velocity:preset==='loss'?60:preset==='shattered'?76:94});last=raw.tick;}
 developed.forEach((n,i)=>n.duration=Math.max(1,Math.min(n.duration,(developed[i+1]?.tick??out.length)-n.tick,spacing*2)));
 const prior=out.tracks[lane].notes;
 out.tracks[lane]={...out.tracks[lane],name:'Composer development · '+out.tracks[lane].name,notes:developed,automation:[{tick:0,volume:88,pan:76,bend:0,range:2}]};
 const changedNotes=developed.filter((n,i)=>!prior[i]||['key','tick','duration'].some(k=>n[k]!==prior[i][k])).length;
 out.composition.neural={...generated.composition.neural,role:'Source-led recomposed part',developedPart:lane,changedNotes,reference:true,preserved:'whole source lead pitches, onsets and durations'};
 const fitted=fitSourceVoices(out).score;checkScore(fitted);return fitted;
}
