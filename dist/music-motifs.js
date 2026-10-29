import {automationFor} from './music-controls.js';
import {Rom,WAIT} from './music-parser.js';
import {unpackMusic,validateMusicAsset} from './music-assets.js';
import {composeMusic,musicRandom,checkScore,MUSIC_SCALES} from './music-compose.js';

// Decode one structural pass, including patterns and counted repeats. Never
// infer a conditional branch or turn an unsupported effect into guessed notes.
export function musicScore(asset){
 validateMusicAsset(asset);
 const packed=unpackMusic(asset),r=new Rom(packed.bytes),h=r.ptr(packed.table),tempos=new Map([[0,120]]),tracks=[],warnings=new Set();let length=1,total=0;
 for(let tr=0;tr<r.u8(h);tr++){
  let pc=r.ptr(h+8+tr*4),tick=0,last=0,key=60,velocity=100,program=0,shift=0,volume=100,pan=64,bend=0,range=2,ops=0;const stack=[],repeats=new Map(),visits=new Map(),held=[],notes=[],programs=new Set(),automation=[];let stopped=false,loopStart=null;
  const close=(endKey=null)=>{for(let i=held.length-1;i>=0;i--)if(endKey===null||held[i].rawKey===endKey){held[i].duration=Math.max(1,tick-held[i].tick);held.splice(i,1);}};
  while(!stopped){if(++ops>100000||tick>49152)throw Error('This sequence exceeds the 512-bar / 100,000-command analysis limit.');const start=pc;visits.set(pc,visits.get(pc)??tick);let cmd=r.u8(pc);if(cmd>=128){pc++;if(cmd>=0xbd)last=cmd;}else cmd=last;
   if(cmd>=0xcf){let extra=0;if(r.u8(pc)<128){key=r.u8(pc++);if(r.u8(pc)<128){velocity=r.u8(pc++);if(r.u8(pc)<128)extra=r.u8(pc++);}}const pitch=key+shift;if(pitch<0||pitch>127)throw Error('A transposed note lies outside the MIDI pitch range.');const n={tick,duration:cmd===0xcf?1:Math.max(1,WAIT[cmd-0xcf]+extra),key:pitch,velocity:Math.max(1,velocity),program,rawKey:key};notes.push(n);programs.add(program);if(cmd===0xcf)held.push(n);if(++total>20000)throw Error('This song exceeds the 20,000-note analysis limit.');continue;}
   if(cmd>=0x80&&cmd<=0xb0){tick+=WAIT[cmd-0x80];continue;}
   if(cmd===0xb1){stopped=true;continue;}
   if(cmd===0xb2){const target=r.ptr(pc);if(visits.has(target)){loopStart=visits.get(target);stopped=true;}else pc=target;continue;}
   if(cmd===0xb3){const target=r.ptr(pc);if(stack.length>=3)throw Error('Music pattern nesting exceeds three levels.');stack.push(pc+4);pc=target;continue;}
   if(cmd===0xb4){if(stack.length)pc=stack.pop();continue;}
   if(cmd===0xb5){const count=r.u8(pc++),target=r.ptr(pc);pc+=4;if(!count){if(visits.has(target)){loopStart=visits.get(target);stopped=true;}else pc=target;}else{const n=(repeats.get(start)||0)+1;if(n<count){repeats.set(start,n);pc=target;}else repeats.delete(start);}continue;}
   if(cmd===0xb9)throw Error('This song uses audio-memory commands. Its note arrangement needs manual analysis.');
   if(cmd===0xbb){tempos.set(tick,Math.max(10,r.u8(pc++)*2));continue;}
   if(cmd===0xbc){shift=r.u8(pc++)<<24>>24;continue;}
   if(cmd===0xbd){program=r.u8(pc++);continue;}
   if([0xbe,0xbf,0xc0,0xc1].includes(cmd)){const value=r.u8(pc++);if(cmd===0xbe)volume=value;else if(cmd===0xbf)pan=value;else if(cmd===0xc0)bend=value-64;else range=value;const point={tick,volume,pan,bend,range};if(automation.at(-1)?.tick===tick)automation[automation.length-1]=point;else automation.push(point);continue;}
   if(cmd===0xce){close(r.u8(pc)<128?r.u8(pc++):key);continue;}
   if(cmd===0xcd){const sub=r.u8(pc++);if(sub===0||sub===3){stopped=true;continue;}if(sub===8||sub===9){pc++;warnings.add('Native imitation-echo settings are omitted from the editable score.');continue;}throw Error('Extended audio commands need manual arranging. Original playback remains available.');}
   if([0xba,0xbf,0xc0,0xc1,0xc2,0xc3,0xc4,0xc5,0xc8].includes(cmd)){const value=r.u8(pc++);if(cmd===0xc0&&value!==64||cmd===0xc8&&value!==64||[0xc2,0xc3,0xc4,0xc5].includes(cmd)&&value)warnings.add('Bends, tuning and modulation are omitted from the editable note score.');continue;}
   throw Error('Unsupported command in note analysis: '+cmd.toString(16));
  }
  if(held.length){close();warnings.add('Notes held at the structural end are clipped to that boundary.');}
  if(programs.size>1)warnings.add('This part changes instruments. The arranger uses one selected instrument per part.');
  const clean=notes.map(({rawKey,...n})=>n);length=Math.max(length,tick,...clean.map(n=>n.tick+n.duration));tracks.push({name:'ROM part '+(tr+1),program:clean[0]?.program??program,notes:clean,automation:automationFor({automation:automation.filter(p=>p.tick<Math.max(1,tick,...clean.map(n=>n.tick+n.duration)))}),loopStart});
 }
 if(length>49152)throw Error('The editable score exceeds 512 bars.');if(!total)throw Error('There are no notes to analyse.');const score={ppq:24,length,tempos:[...tempos].filter(([t])=>t<length).sort((a,b)=>a[0]-b[0]).map(([tick,bpm])=>({tick,bpm})),tracks};
 score.tempos=score.tempos.filter((t,i,a)=>!i||t.bpm!==a[i-1].bpm);
 const loopStarts=tracks.map(t=>t.loopStart);if(loopStarts.every(t=>t!==null&&t===loopStarts[0])&&loopStarts[0]<length)score.loopStart=loopStarts[0];
 if(asset.arrangement?.version===1){try{const stored=asset.arrangement.score;checkScore(stored);const fingerprint=s=>JSON.stringify([s.length,s.loopStart??0,s.tempos,s.tracks.map(t=>[t.program,automationFor(t),[...t.notes].sort((a,b)=>a.tick-b.tick||a.key-b.key).map(n=>[n.tick,n.duration,n.key,n.velocity])])]);if(fingerprint(stored)===fingerprint(score))return{score:structuredClone(stored),warnings:[...warnings]};warnings.add('Saved arrangement metadata differs from the audio; showing decoded notes.');}catch{warnings.add('Saved arrangement metadata could not be used; showing decoded notes.');}}
 return{score,warnings:[...warnings]};
}

export function melodyLine(track){const onsets=new Map();for(const [index,n]of track.notes.entries()){const old=onsets.get(n.tick);if(!old||n.key>old.key)onsets.set(n.tick,{...n,index});}return [...onsets.values()].sort((a,b)=>a.tick-b.tick);}
export function findMotifs(score,{match='transpose',minNotes=4,maxResults=24}={}){
 if(!['exact','transpose','rhythm','contour'].includes(match))throw Error('Unknown motif matching mode.');if(!Number.isInteger(minNotes)||minNotes<4||minNotes>12)throw Error('Choose a motif length from four to twelve notes.');const found=[];
 score.tracks.forEach((tr,track)=>{const line=melodyLine(tr).slice(0,2048),groups=new Map();for(const count of [...new Set([minNotes,8,12].filter(n=>n>=minNotes))])for(let i=0;i+count<=line.length;i++){
  const ns=line.slice(i,i+count),first=ns[0],signature=ns.map((n,j)=>[match==='rhythm'?0:match==='exact'?n.key:match==='contour'?Math.sign(n.key-(ns[j-1]?.key??n.key)):n.key-first.key,n.tick-first.tick,n.duration].join(',')).join(';'),id=count+':'+signature;
  if(match!=='rhythm'&&new Set(ns.map(n=>n.key)).size<2)continue;
  const occurrence={track,start:first.tick,end:ns.at(-1).tick+ns.at(-1).duration,indices:ns.map(n=>n.index),transpose:first.key};if(!groups.has(id))groups.set(id,{track,count,signature,occurrences:[]});const g=groups.get(id);if(!g.occurrences.length||g.occurrences.at(-1).end<=first.tick)g.occurrences.push(occurrence);
 }for(const g of groups.values())if(g.occurrences.length>1)found.push({...g,rank:(g.count-1)*(g.occurrences.length-1)});});
 const results=[];for(const g of found.sort((a,b)=>b.rank-a.rank||b.count-a.count||a.track-b.track||a.occurrences[0].start-b.occurrences[0].start)){if(results.some(x=>x.track===g.track&&g.occurrences.every(o=>x.occurrences.some(p=>o.start>=p.start&&o.end<=p.end))))continue;results.push({...g,id:'motif-'+results.length,match});if(results.length>=maxResults)break;}return results;
}

export function referenceStyle(score,track=0){const line=melodyLine(score.tracks[track]||score.tracks[0]);if(!line.length)throw Error('Choose a part containing notes.');const spacings=line.slice(1).map((n,i)=>n.tick-line[i].tick).filter(n=>n>0).sort((a,b)=>a-b),hist=Array(12).fill(0);for(const n of line)hist[n.key%12]+=n.duration;let best={fit:-1,key:0,scale:'Major'};for(const [scale,steps]of Object.entries(MUSIC_SCALES))for(let key=0;key<12;key++){const fit=hist.reduce((s,v,p)=>s+(steps.includes((p-key+12)%12)?v:-v),0)/steps.length;if(fit>best.fit)best={fit,key,scale};}return{key:best.key,scale:best.scale,tempo:score.tempos[0].bpm,spacing:spacings[Math.floor(spacings.length/2)]||24,register:Math.round(line.reduce((s,n)=>s+n.key,0)/line.length)};}

export function composeFromReference(reference,{mode='inspired',track=0,start=0,end=Math.min(96,reference.length),influence=50,lockPitch=true,lockRhythm=true,...options}={}){
 if(!['inspired','motif'].includes(mode)||!Number.isInteger(influence)||influence<0||influence>100)throw Error('Invalid reference composition settings.');if(!Number.isInteger(track)||!reference.tracks[track])throw Error('Choose a reference part.');if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>reference.length||end<=start)throw Error('Choose a valid motif range.');
 const scoped={...reference,tracks:reference.tracks.map((t,i)=>i===track?{...t,notes:t.notes.filter(n=>n.tick<end&&n.tick+n.duration>start).map(n=>({...n,tick:Math.max(start,n.tick),duration:Math.min(end,n.tick+n.duration)-Math.max(start,n.tick)}))}:t)};if(!scoped.tracks[track].notes.length)throw Error('The chosen motif range contains no notes.');const style=referenceStyle(scoped,track),effective={...options};if(mode==='inspired'){effective.tempo??=Math.round((120+(style.tempo-120)*influence/100)/2)*2;effective.key??=style.key;effective.scale??=style.scale;effective.complexity??=style.spacing<=6?85:style.spacing<=12?50:15;}const out=composeMusic(effective),steps=MUSIC_SCALES[effective.scale||'Natural minor'],tonic=effective.key??0,line=melodyLine(scoped.tracks[track]),fragment=line.filter(n=>n.tick>=start&&n.tick<end).map(n=>({...n,tick:n.tick-start,duration:Math.min(n.duration,end-n.tick)}));if(!fragment.length)throw Error('The chosen motif range contains no notes.');
 const nearest=key=>Array.from({length:25},(_,i)=>key+i-12).filter(n=>n>=0&&n<=127&&steps.includes((n-tonic+120)%12)).sort((a,b)=>Math.abs(a-key)-Math.abs(b-key))[0];
 if(mode==='motif'){
  if(lockRhythm){const notes=[];for(let at=0;at<out.length;at+=end-start)for(const [i,n]of fragment.entries())if(at+n.tick<out.length)notes.push({tick:at+n.tick,duration:Math.min(n.duration,out.length-at-n.tick),key:lockPitch?n.key:nearest(Math.max(0,Math.min(127,n.key+((tonic-style.key+18)%12-6)))),velocity:n.velocity});out.tracks[0].notes=notes;}
  else out.tracks[0].notes.forEach((n,i)=>{const key=fragment[i%fragment.length].key;n.key=lockPitch?key:nearest(Math.max(0,Math.min(127,key+((tonic-style.key+18)%12-6))));});
 }else{
  const offset=Math.round((style.register-66)*influence/100/12)*12;out.tracks[0].notes.forEach(n=>n.key=Math.max(0,Math.min(127,n.key+offset)));
  // Rhythm and interval statistics guide fresh phrases; source notes are not
  // copied in this mode. A repeated fingerprint is not a melody lock.
  if(influence>0){const random=musicRandom((effective.seed??1)^0x72656631),intervals=line.slice(1).map((n,i)=>n.key-line[i].key).filter(n=>Math.abs(n)<=12);let previous=out.tracks[0].notes[0]?.key||60;out.tracks[0].notes.forEach((n,i)=>{if(i&&i%3===0&&intervals.length&&random()*100<influence)n.key=nearest(Math.max(36,Math.min(96,previous+intervals[Math.floor(random()*intervals.length)])));previous=n.key;});}
 }
 checkScore(out);return out;
}

export function composeFromReferences(references,options={}){
 if(!Array.isArray(references)||!references.length||references.length>4)throw Error('Choose one to four reference scores.');
 if(references.length===1||options.mode==='motif')return composeFromReference(references[0],options);
 const combined={ppq:24,length:0,tempos:[{tick:0,bpm:Math.round(references.reduce((s,r)=>s+r.tempos[0].bpm,0)/references.length/2)*2}],tracks:[{name:'Reference blend',program:0,notes:[]}]};
 for(const [i,ref]of references.entries()){const part=ref.tracks[options.referenceParts?.[i]??(i===0?(options.track||0):0)];if(!part)throw Error('A reference part is missing.');const from=i===0?(options.start??0):0,end=Math.min(ref.length,i===0?(options.end??ref.length):Math.floor(12288/references.length)),offset=combined.length;if(from<0||end<=from||end>ref.length)throw Error('Choose a valid motif range.');for(const n of melodyLine(part)){const a=Math.max(from,n.tick),b=Math.min(end,n.tick+n.duration);if(a<b)combined.tracks[0].notes.push({...n,tick:offset+a-from,duration:b-a});}combined.length+=end-from;}
 return composeFromReference(combined,{...options,track:0,start:0,end:combined.length});
}
