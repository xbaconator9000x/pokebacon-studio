import {automationFor} from './music-controls.js';
// MP2K tracks can share an instrument when their controls match and no pitch
// overlaps itself. Keep every note, including same-pitch overlaps on separate tracks.
export function packMusicParts(source){
 const score=structuredClone(source),groups=[];
 const identity=t=>JSON.stringify([t.program,t.channel===9,automationFor(t)]);
 const fits=(a,b)=>{const endings=new Map();for(const n of [...a,...b].sort((x,y)=>x.tick-y.tick)){if((endings.get(n.key)||0)>n.tick)return false;endings.set(n.key,n.tick+n.duration);}return true;};
 for(const track of score.tracks){const key=identity(track),group=groups.find(g=>g.key===key&&fits(g.track.notes,track.notes));if(group){group.track.notes.push(...track.notes);group.track.sourcePartNames.push(track.name||'Unnamed part');}else groups.push({key,track:{...track,sourcePartNames:[track.name||'Unnamed part']}});}
 score.tracks=groups.map(({track})=>({...track,name:track.sourcePartNames.length>1?track.sourcePartNames[0]+' + '+(track.sourcePartNames.length-1)+' parts':track.name,notes:track.notes.sort((a,b)=>a.tick-b.tick||a.key-b.key)}));return score;
}

/** Assign independently authored instruments to physical MP2K lanes.
 * Source parts remain stored as editable score metadata. A lane may switch
 * programs only between nonoverlapping notes, never during another note.
 */
export function interleaveMusicParts(input){
 const score=structuredClone(input),events=[],lanes=[];
 for(const [part,t] of score.tracks.entries()){
  const controls=automationFor(t);
  for(const n of t.notes){
   const start=n.tick,end=start+n.duration;
   events.push({part,name:t.name||'Part',note:{...n,program:n.program??t.program,
    voiceControl:controls.filter(p=>p.tick<=start).at(-1)||controls[0],
    inlineAutomation:controls.filter(p=>p.tick>start&&p.tick<end)}});
  }
 }
 events.sort((a,b)=>a.note.tick-b.note.tick||a.part-b.part);
 for(const event of events){
  const n=event.note,candidates=lanes.filter(l=>l.end<=n.tick);
  const lane=candidates.sort((a,b)=>Number(b.program===n.program)-Number(a.program===n.program))[0];
  if(lane){lane.notes.push(n);lane.end=n.tick+n.duration;lane.program=n.program;lane.parts.add(event.name);}
  else lanes.push({end:n.tick+n.duration,program:n.program,notes:[n],parts:new Set([event.name])});
 }
 if(lanes.length>10)throw Error('This music needs '+lanes.length+' simultaneous instrument lanes; the native ROM music player has ten.');
 score.tracks=lanes.map((l,i)=>({name:'Playback lane '+(i+1),program:l.notes[0].program,
  notes:l.notes,automation:[{tick:0,volume:100,pan:64,bend:0,range:2}],
  sourcePartNames:[...l.parts]}));
 return score;
}
/** Explicit opt-in for MIDI import: retain sourceScore and fit native voices. */
export function fitMusicVoices(input,max=8){
 const score=structuredClone(input),active=[],events=score.tracks.flatMap((t,i)=>
 t.notes.map(n=>({n,priority:i===0?100:/lead|melody/i.test(t.name||'')?90:
 /bass/i.test(t.name||'')?60:t.channel===9?30:10+n.velocity/127})));
 events.sort((a,b)=>a.n.tick-b.n.tick||b.priority-a.priority);
 let trimmed=0;
 for(const e of events){
  for(let i=active.length-1;i>=0;i--)if(active[i].n.tick+active[i].n.duration<=e.n.tick)active.splice(i,1);
  if(active.length>=max){
   const loser=[...active,e].sort((a,b)=>a.priority-b.priority)[0];
   if(loser===e){e.n.duration=0;trimmed++;continue;}
   loser.n.duration=Math.max(0,e.n.tick-loser.n.tick);
   active.splice(active.indexOf(loser),1);trimmed++;
  }
  active.push(e);
 }
 for(const t of score.tracks)t.notes=t.notes.filter(n=>n.duration>0);
 score.tracks=score.tracks.filter(t=>t.notes.length);
 return{score,trimmed};
}
