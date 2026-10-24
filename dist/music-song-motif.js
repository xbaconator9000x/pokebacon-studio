import{MUSIC_SCALES,MUSIC_MOODS}from'./music-styles.js';import{topLine}from'./music-learning.js';
export const MOTIF_USAGE={sparse:'Sparingly · every 8 bars',frequent:'Frequently · every 2 bars',beginning:'Beginning of loop only',ending:'End of loop only'};
export const MOTIF_SCOPES={loop:'Verse + bridge',verse:'Verse only',bridge:'Bridge only',intro:'Intro only',all:'Whole song'};
export function applySongMotif(score,reference,{track=0,start=0,end=96,mode='inspired',influence=50,usage='sparse',scope='loop',lockPitch=true,lockRhythm=true,key=0,scale,mood='Battle'}={}){
 if(!MOTIF_USAGE[usage]||!MOTIF_SCOPES[scope]||!['motif','inspired'].includes(mode))throw Error('Choose motif placement, section and treatment.');
 if(!Number.isInteger(influence)||influence<0||influence>100||!reference.tracks?.[track]||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>reference.length||end<=start)throw Error('Choose a valid source part and A–B range.');
 const fragment=topLine(reference.tracks[track]).filter(n=>n.tick<end&&n.tick+n.duration>start).map(n=>({...n,tick:Math.max(start,n.tick)-start,duration:Math.min(end,n.tick+n.duration)-Math.max(start,n.tick)}));if(!fragment.length)throw Error('The A–B motif selection has no notes.');
 const out=structuredClone(score),length=end-start,sections=out.songSections.filter(s=>scope==='all'||scope==='loop'&&s.kind!=='intro'||s.kind===scope),spans=sections.filter(s=>s.length>=length),placements=[];
 if(!spans.length)throw Error('The motif is longer than the selected section, or that section is disabled. Shorten A–B or lengthen the section.');
 if(mode==='inspired'&&!influence){out.composition.motif={range:{track,start,end},mode,influence,usage,scope,lockPitch,lockRhythm,placements:[]};return out;}
 if(usage==='beginning')placements.push(spans[0].start);
 else if(usage==='ending')placements.push(spans.at(-1).start+spans.at(-1).length-length);
 else for(const s of spans){const stride=Math.max(length,usage==='sparse'?768:192);for(let at=s.start;at+length<=s.start+s.length;at+=stride)placements.push(at);}
 const steps=MUSIC_SCALES[scale||MUSIC_MOODS[mood]?.scale||'Natural minor'],pitches=Array.from({length:61},(_,i)=>36+i).filter(n=>steps.includes((n-key+120)%12)),nearest=n=>pitches.reduce((a,b)=>Math.abs(b-n)<Math.abs(a-n)?b:a,pitches[0]);
 const first=fragment[0].key;
 for(const [index,at]of placements.entries()){
  const lead=out.tracks[0],context=lead.notes.find(n=>n.tick>=at)?.key??67,anchor=nearest(context),amount=influence/100;
  const motif=fragment.map((n,i)=>{
   let pitch=n.key,tick=n.tick,duration=n.duration;
   if(mode==='inspired'){const relative=n.key-first,contour=anchor+relative,question=anchor+Math.sign(relative)*Math.min(5,Math.abs(relative));pitch=nearest(question+(contour-question)*amount);const snap=influence>=75?3:influence>=35?6:12;tick=Math.round(n.tick/snap)*snap;duration=Math.max(3,Math.round(n.duration*(.65+.35*amount)));if(influence<75&&i===fragment.length-1)pitch=nearest(anchor);}
   else{if(!lockPitch)pitch=nearest(anchor+n.key-first);if(!lockRhythm){const snap=12;tick=Math.round(n.tick/snap)*snap;duration=Math.max(3,Math.round(n.duration*.8));}}
   return{tick:at+Math.min(length-1,tick),duration:Math.max(1,Math.min(duration,length-tick)),key:pitch,velocity:n.velocity};
  }).filter(n=>n.tick>=at&&n.tick<at+length).sort((a,b)=>a.tick-b.tick);
  // Retain a single lead line when quantisation brings two onsets together.
  const clean=[];for(const n of motif){if(clean.at(-1)?.tick===n.tick)clean[clean.length-1]=n;else clean.push(n);}clean.forEach((n,i)=>{n.duration=Math.min(n.duration,(clean[i+1]?.tick??at+length)-n.tick);});
  lead.notes=lead.notes.flatMap(n=>{const a=n.tick,b=n.tick+n.duration;if(b<=at||a>=at+length)return[n];const parts=[];if(a<at)parts.push({...n,duration:at-a});if(b>at+length)parts.push({...n,tick:at+length,duration:b-at-length});return parts;});lead.notes.push(...clean);
 }
 out.tracks[0].notes.sort((a,b)=>a.tick-b.tick||a.key-b.key);out.composition.motif={range:{track,start,end},mode,influence,usage,scope,lockPitch,lockRhythm,placements:placements.map(at=>({start:at,end:at+length,section:sections.find(s=>at>=s.start&&at<s.start+s.length).kind}))};return out;
}
