import {QUICK_TRACKS} from './music-quick-presets.js';
import {MUSIC_SCALES} from './music-styles.js';
import {checkScore} from './music-compose.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pc=n=>(n%12+12)%12;
const random=(seed,bar,part)=>{let n=(seed>>>0)^Math.imul(bar+1,0x9e3779b9)^Math.imul(part+1,0x85ebca6b);n=Math.imul(n^(n>>>16),0x7feb352d);return((n^(n>>>15))>>>0)/4294967296;};
const mean=ns=>ns.reduce((s,n)=>s+n.key,0)/(ns.length||1);
const pitched=(t,drums)=>t.channel!==9&&!/drum|percussion/i.test(t.name||'')&&(t.notes||[]).some(n=>!drums.has(n.program??t.program));
export function suggestMelodyPart(score,{percussionPrograms=[]}={}){
 const drums=new Set(percussionPrograms);let best=-1,rank=-Infinity;
 score.tracks.forEach((t,i)=>{if(!pitched(t,drums))return;const ns=t.notes.filter(n=>!drums.has(n.program??t.program)),register=mean(ns),first=Math.min(...ns.map(n=>n.tick)),bars=new Set(ns.map(n=>Math.floor(n.tick/96))).size,coverage=bars/Math.max(1,Math.ceil(score.length/96)),sustain=Math.min(1,ns.reduce((s,n)=>s+n.duration,0)/score.length),value=(/lead|melody/i.test(t.name||'')?200:0)+Math.min(78,register)-Math.max(0,48-register)*2+Math.min(12,new Set(ns.map(n=>n.key)).size)+coverage*32+sustain*22-first/score.length*90+(i===0?2:0);if(value>rank){best=i;rank=value;}});
 if(best<0)throw Error('This track has no melodic part to base a song on. Choose a music track rather than a drum-only cue.');return best;
}
export function sourceTonality(score,part=0){
 const saved=score.composition?.settings;if(Number.isInteger(saved?.key)&&saved.key>=0&&saved.key<12&&MUSIC_SCALES[saved.scale])return{key:saved.key,scale:saved.scale};
 const hist=Array(12).fill(0);for(const n of score.tracks[part].notes)hist[pc(n.key)]+=Math.min(n.duration,96)*(n.velocity||80)/100;
 const profiles={'Major':[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],'Natural minor':[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]};let best={fit:-Infinity,key:0,scale:'Major'};
 for(const[scale,weights]of Object.entries(profiles)){const avg=weights.reduce((s,n)=>s+n,0)/12,den=Math.sqrt(weights.reduce((s,n)=>s+(n-avg)**2,0));for(let key=0;key<12;key++){let fit=0;for(let i=0;i<12;i++)fit+=hist[i]*(weights[pc(i-key)]-avg)/den;if(fit>best.fit)best={fit,key,scale};}}
 return{key:best.key,scale:best.scale};
}
function recolour(key,tonic,from,to){const rel=key-tonic,oct=Math.floor(rel/12),p=pc(rel);let degree=0;for(let i=1;i<from.length;i++)if(Math.abs(from[i]-p)<Math.abs(from[degree]-p))degree=i;return clamp(tonic+oct*12+to[degree%to.length]+p-from[degree],0,127);}

export function retuneTrackScore(input,{targetKey='original',targetScale='original',sourceTonality:tonality,backingTonality,percussionPrograms=[]}={}){
 const score=structuredClone(input),old=tonality||sourceTonality(score),key=targetKey==='original'?old.key:Number(targetKey),scale=targetScale==='original'?old.scale:targetScale;
 if(!Number.isInteger(key)||key<0||key>11||!MUSIC_SCALES[scale])throw Error('Choose a valid key and scale.');
 let delta=key-old.key;if(delta>6)delta-=12;if(delta< -6)delta+=12;
 const drums=new Set(percussionPrograms);
 for(const [i,t] of score.tracks.entries())if(t.channel!==9){const from=i&&backingTonality?backingTonality:old;t.notes=t.notes.map(n=>drums.has(n.program??t.program)?n:{...n,key:clamp((scale===from.scale?n.key:recolour(n.key,from.key,MUSIC_SCALES[from.scale],MUSIC_SCALES[scale]))+delta,0,127)});}
 score.composition={...score.composition,settings:{...score.composition?.settings,key,scale},tonality:{source:old,target:{key,scale}}};return score;
}

// Thin only when simultaneous source voices exceed the cartridge budget.
// Every source part remains represented; the main tune has highest priority.
export function fitSourceVoices(input){
 const score=structuredClone(input),active=[],events=score.tracks.flatMap((t,i)=>t.notes.map(n=>({n,i,priority:i===0?100:t.channel===9?20:/bass/i.test(t.name)?50:30+n.velocity/127}))).sort((a,b)=>a.n.tick-b.n.tick||b.priority-a.priority);let trimmed=0;
 for(const e of events){for(let i=active.length-1;i>=0;i--)if(active[i].n.tick+active[i].n.duration<=e.n.tick)active.splice(i,1);if(active.length===8){const low=[...active,e].sort((a,b)=>a.priority-b.priority)[0];if(low===e){e.n.duration=0;trimmed++;continue;}low.n.duration=e.n.tick-low.n.tick;active.splice(active.indexOf(low),1);trimmed++;}active.push(e);}
 for(const t of score.tracks)t.notes=t.notes.filter(n=>n.duration>0);return{score,trimmed};
}

/** Whole/selected source arrangement, retaining each chosen part's content. */
export function styleTrackBase(source,options={}){
 const {scope='whole',selectedParts=[],percussionPrograms=[],targetKey='original',targetScale='vibe'}=options;
 if(!['whole','selected','single'].includes(scope))throw Error('Choose a source scope.');
 if(scope==='single'){
  const made=styleExistingTrack(source,{...options,identity:'exact'}),tonal=sourceTonality(source,options.melodyPart??suggestMelodyPart(source,{percussionPrograms}));
  made.score=retuneTrackScore(made.score,{targetKey,targetScale:targetScale==='vibe'?QUICK_TRACKS[options.preset||'shattered'].scale:targetScale,sourceTonality:tonal,backingTonality:{key:tonal.key,scale:made.score.composition.settings.scale}});made.score.composition.baseTrack.scope=scope;return made;
 }
 checkScore(source,{arranging:true});const indices=scope==='whole'?source.tracks.map((_,i)=>i):[...new Set(selectedParts)];
 if(!indices.length||indices.some(i=>!Number.isInteger(i)||!source.tracks[i]))throw Error('Select at least one existing source part.');
 if(indices.length>10)throw Error('This source has more than ten export parts. Select up to ten parts for the cartridge arrangement.');
 const subset={...source,tracks:indices.map(i=>source.tracks[i])},chosen=indices.includes(options.melodyPart)?options.melodyPart:indices[suggestMelodyPart(subset,{percussionPrograms})],tonal=sourceTonality(source,chosen),styled=styleExistingTrack(source,{...options,melodyPart:chosen,identity:'exact'}),drums=new Set(percussionPrograms),order=[chosen,...indices.filter(i=>i!==chosen)];
 const recipe=QUICK_TRACKS[options.preset||'shattered'];let score=structuredClone(styled.score);score.tracks=order.map((index,at)=>{
  const t=source.tracks[index],ns=t.notes.filter(n=>!drums.has(n.program??t.program)),isDrum=t.channel===9||(!ns.length&&t.notes.length>0),register=mean(ns),programs=new Map();for(const n of t.notes)programs.set(n.program??t.program,(programs.get(n.program??t.program)||0)+1);const program=[...programs].sort((a,b)=>b[1]-a[1])[0]?.[0]??t.program;
  return {name:at===0?'Lead melody':isDrum?'Source percussion '+(index+1):register<52?'Source bass '+(index+1):'Source harmony '+(index+1),program:isDrum?3:at===0?recipe.voices[0]:register<52?recipe.voices[2]:recipe.voices[(at%3)+1],sourceProgram:program,sourcePart:index,...(isDrum?{channel:9}:{}),notes:t.notes.map(({program:ignored,...n})=>({...n,velocity:Math.max(1,Math.round(n.velocity*(options.preset==='loss'?.7:options.preset==='shattered'?.82:1)))})),automation:[{tick:0,volume:at===0?100:isDrum?60:78,pan:at===0?64:Math.round(t.automation?.[0]?.pan??64),bend:0,range:2}]};
 });
 score.composition.baseTrack={...score.composition.baseTrack,scope,sourceParts:order,melodyPart:chosen,preserved:'selected source parts, note rhythms, song length, intro and loop; pitches follow the chosen key and scale'};
 score=retuneTrackScore(score,{targetKey,targetScale:targetScale==='vibe'?QUICK_TRACKS[options.preset||'shattered'].scale:targetScale,sourceTonality:tonal,percussionPrograms});
 // Follow the selected vibe without replacing the source with a recipe song.
 if(['loss','shattered'].includes(options.preset))for(let i=1;i<score.tracks.length;i++){const t=score.tracks[i];if(t.channel===9)t.notes=t.notes.filter((n,j)=>options.preset==='loss'?false:j%8===0);else if(!/bass/.test(t.name))t.notes=t.notes.filter((n,j)=>j%(options.preset==='loss'?3:2)===0);}
 const fitted=fitSourceVoices(score);score=fitted.score;if(fitted.trimmed)styled.warnings.push(`${fitted.trimmed} backing gates reduced to fit eight simultaneous cartridge voices.`);
 checkScore(score);return{score,warnings:styled.warnings};
}
function melodyNotes(track,drums,length){
 const byTick=new Map();for(const n of track.notes){if(drums.has(n.program??track.program))continue;const old=byTick.get(n.tick);if(!old||n.key>old.key)byTick.set(n.tick,{...n});}
 const notes=[...byTick.values()].sort((a,b)=>a.tick-b.tick);return notes.map((n,i)=>({tick:n.tick,key:n.key,velocity:n.velocity,duration:Math.min(n.duration,(notes[i+1]?.tick??length)-n.tick)})).filter(n=>n.duration>0);
}
/** Re-arrange a whole source song. Never substitute a generated lead or motif. */
export function styleExistingTrack(source,{preset='shattered',seed=1,energy,melodyPart,identity='exact',percussionPrograms=[]}={}){
 checkScore(source,{arranging:true});const p=QUICK_TRACKS[preset];if(!p)throw Error('Choose a Quick Track vibe.');if(!['exact','contour'].includes(identity))throw Error('Choose a melody identity mode.');if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Use a variation seed between 0 and 4294967295.');energy??=p.energy;if(!Number.isInteger(energy)||energy<0||energy>100)throw Error('Use energy from 0 to 100.');
 const part=melodyPart??suggestMelodyPart(source,{percussionPrograms});if(!Number.isInteger(part)||!source.tracks[part])throw Error('Choose an existing melody part.');
 const drums=new Set(percussionPrograms),track=source.tracks[part],notes=melodyNotes(track,drums,source.length);if(!notes.length)throw Error('The selected part contains no melody notes. Choose another part.');
 const tonal=sourceTonality(source,part),steps=MUSIC_SCALES[p.scale],from=MUSIC_SCALES[tonal.scale],bars=Math.ceil(source.length/96),sourceBpm=source.tempos[0].bpm,atmosphere=['shattered','loss','wrath','aftermath'].includes(preset),loss=preset==='loss',shattered=preset==='shattered'||preset==='aftermath',wrath=preset==='wrath',feel=p.feel;
 let bpm=loss?sourceBpm*.58:shattered?sourceBpm*.72:wrath?Math.max(150,sourceBpm*1.22):sourceBpm*.3+p.tempo*.7;bpm=clamp(Math.round((bpm+(energy-p.energy)*.3)/2)*2,10,510);const ratio=bpm/sourceBpm;
 const programs=new Map();for(const n of track.notes)if(!drums.has(n.program??track.program))programs.set(n.program??track.program,(programs.get(n.program??track.program)||0)+1);const leadProgram=[...programs].sort((a,b)=>b[1]-a[1])[0][0],warnings=[];
 if(programs.size>1)warnings.push('The source melody changes instruments; this copy uses its most frequent melody instrument.');if(notes.length<track.notes.length)warnings.push('The selected part contains chords or drums; its highest melodic note at each onset is used.');
 const leadGain=loss?.69:shattered?.8:wrath?1.08:1;
 const tracks=['Lead melody','Memory / answering echo','Bass','Arpeggio','Chord colour','Percussion'].map((name,i)=>({name,program:p.voices[i],midiProgram:({16:56,17:73,18:12,19:0,20:48,21:33,22:24,23:10})[p.voices[i]]??0,...(i===5?{channel:9}:{}),notes:[],automation:[{tick:0,volume:[100,55,72,48,38,55][i],pan:[64,84,60,42,76,64][i],bend:0,range:2}]}));
 tracks[0].sourceProgram=leadProgram;tracks[0].notes=notes.map(n=>({...n,key:identity==='exact'?n.key:recolour(n.key,tonal.key,from,steps),velocity:clamp(Math.round(n.velocity*leadGain),1,127)}));
 const sourceLead=tracks[0].notes,byBar=Array.from({length:bars},()=>[]);for(const n of sourceLead)byBar[Math.floor(n.tick/96)].push(n);
 const bassCandidate=source.tracks.map((t,i)=>({t,i})).filter(({t,i})=>i!==part&&pitched(t,drums)).sort((a,b)=>mean(a.t.notes)-mean(b.t.notes))[0]?.t,bassBars=Array.from({length:bars},()=>[]);for(const n of bassCandidate?.notes||[])if(!drums.has(n.program??bassCandidate.program))bassBars[Math.floor(n.tick/96)]?.push(n);
 const degreeAt=bar=>{const ns=bassBars[bar],low=ns.length?ns.reduce((a,b)=>a.key<b.key?a:b):null;if(!low)return p.progression[bar%p.progression.length]%steps.length;const rel=pc(low.key-tonal.key);let d=0;for(let i=1;i<from.length;i++)if(Math.abs(from[i]-rel)<Math.abs(from[d]-rel))d=i;return d;};
 const pitch=(degree,oct=4)=>clamp(tonal.key+oct*12+steps[(degree%steps.length+steps.length)%steps.length]+12*Math.floor(degree/steps.length),0,127);
 const add=(i,tick,duration,key,velocity)=>{if(tick>=0&&tick<source.length)tracks[i].notes.push({tick,duration:Math.max(1,Math.min(duration,source.length-tick)),key,velocity:clamp(Math.round(velocity),1,127)});};
 for(let bar=0;bar<bars;bar++){
  const at=bar*96,d=degreeAt(bar),breath=shattered&&bar%4===3,soft=loss||shattered,activity=energy/100;
  const bassBeats=loss?(bar%2?[]:[0]):shattered?[0]:wrath||feel==='battle'?[0,12,24,36,48,60,72,84]:['creep','flow'].includes(feel)?[0,48]:[0,24,48,72];
  bassBeats.forEach((beat,i)=>add(2,at+beat,soft?(loss?Math.min(180,source.length-at):72):wrath?8:Math.min(20,(bassBeats[i+1]??96)-beat-2),pitch(d+(soft||wrath?0:i%2?4:0),3),soft?44:wrath?100:75));
  const arps=loss?(bar%2?[]:[48]):shattered?(breath?[]:[36]):wrath?[0,12,24,36,48,60,72,84]:feel==='creep'?[24,72]:feel==='flow'?[0,12,24,36,48,60,72,84]:feel==='lilt'?[0,24,36,60,72]:[12,36,60,84];
  arps.forEach((beat,i)=>{if(!atmosphere&&activity<.3&&i%2)return;add(3,at+beat,loss?30:shattered?18:wrath?7:9,pitch(d+[0,2,4,2][(i+Math.floor(random(seed,bar,3)*4))%4],4),soft?25:wrath?76:48);});
  if(!breath&&(!loss||bar%2===0))add(4,at,loss?160:shattered?84:feel==='battle'||wrath?18:80,pitch(d+2,4),loss?23:shattered?28:wrath?64:37);
  const hits=loss?[]:shattered?(bar%4===0?[0]:[]):feel==='creep'?[0]:wrath||feel==='battle'?[0,12,24,36,48,60,72,84]:[0,24,48,72];hits.forEach(beat=>add(5,at+beat,3,beat%48===0?36:beat%24===0?38:42,shattered?17:wrath?(beat%24===0?100:60):60));
  if(bar>0&&bar%(loss?8:shattered?4:2)==(loss?4:shattered?2:1)){
   const remembered=byBar[Math.max(0,bar-1)][0];if(remembered){const tick=at+(soft?48:72),key=remembered.key;add(1,tick,soft?24:12,key,loss?17:shattered?22:wrath?60:42);}
  }
 }
 // Bound every part's gates to its next onset. This also protects PSG reuse
 // and avoids same-pitch overlaps when an atmosphere sustains across bars.
 for(const t of tracks){t.notes.sort((a,b)=>a.tick-b.tick||a.key-b.key);if(t!==tracks[0])t.notes.forEach((n,i)=>n.duration=Math.min(n.duration,(t.notes[i+1]?.tick??source.length)-n.tick));}
 const loopStart=source.loopStart??0,score={ppq:24,length:source.length,loopStart,tempos:source.tempos.map(t=>({...t,bpm:clamp(Math.round(t.bpm*ratio/2)*2,10,510)})),tracks,songSections:source.songSections?.length?structuredClone(source.songSections):[...(loopStart?[{kind:'intro',name:'Source intro',start:0,length:loopStart}]:[]),{kind:'verse',name:'Source theme',start:loopStart,length:source.length-loopStart}],composition:{version:3,quickPreset:preset,seed,settings:{key:tonal.key,scale:p.scale,tempo:bpm,energy},description:p.description,baseTrack:{melodyPart:part,identity,preserved:identity==='exact'?'whole melody pitches, onsets, durations, song length and loop position':'whole melody contour, onsets, durations, song length and loop position',sourceTonality:tonal,sourceLeadProgram:leadProgram}}};
 checkScore(score);return{score,warnings};
}
