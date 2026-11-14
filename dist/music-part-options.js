// General MIDI program IDs and MP2K ROM voice indices are different spaces.
// This deterministic family map chooses native Studio instruments at import.
const studio=[19,19,18,22,21,20,9,13,8,14,15,15,22,18,10,15];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function studioProgramForMIDI(part){
 if(part.channel===9||/\bdrum|percussion|kit\b/i.test(part.name||''))return 3;
 const gm=part.midiProgram;
 return Number.isInteger(gm)&&gm>=0&&gm<128?studio[Math.floor(gm/8)]:part.program;
}
export function selectNativeInstrument(part,voices,{sourceBank=false}={}){
 const compatible=voices.filter(v=>!v.keys||part.notes.every(n=>v.keys.includes(n.key)));
 if(!compatible.length)throw Error((part.name||'Imported part')+' has notes outside the selected instrument bank.');
 const preferred=sourceBank&&Number.isInteger(part.sourceProgram)?part.sourceProgram:part.midiProgram!==undefined?studioProgramForMIDI(part):part.program;
 if(compatible.some(v=>v.program===preferred))return preferred;
 const drum=part.channel===9||/\bdrum|percussion|kit\b/i.test(part.name||'');
 const family=compatible.filter(v=>drum?/drum|noise/i.test(v.name):!/drum|noise/i.test(v.name));
 return(family.length?family:compatible)[0].program;
}
function priority(t,i){return i===0?10000:/lead|melody/i.test(t.name||'')?5000:/bass/i.test(t.name||'')?3000:t.channel===9?2000:(t.notes?.length||0);}
export function varyMusicParts(input,{delta=0,seed=1}={}){
 if(!Number.isInteger(delta)||delta< -16||delta>16)throw Error('Instrument density must be between sixteen fewer and sixteen more.');
 const score=structuredClone(input),original=score.tracks.length,target=clamp(original+delta,1,256),warnings=[];
 if(target<original){
  const order=score.tracks.map((track,i)=>({i,rank:priority(track,i)})).sort((a,b)=>b.rank-a.rank||a.i-b.i),keep=new Set(order.slice(0,target).map(x=>x.i));
  score.tracks=score.tracks.filter((t,i)=>keep.has(i));
  warnings.push((original-target)+' original backing parts omitted from this variation; the base track is unchanged.');
 }else if(target>original){
  const used=new Uint8Array(score.length);
  for(const t of score.tracks)for(const n of t.notes)for(let tick=n.tick;tick<n.tick+n.duration;tick++)if(tick<used.length)used[tick]++;
  const candidates=score.tracks.filter(t=>t.notes?.length&&t.channel!==9);
  for(let i=0;i<target-original&&candidates.length;i++){
   const source=candidates[i%candidates.length],notes=[],shift=[12,-12,7,-7,0][i%5],stride=i%3+2,phase=(seed+i*11)%stride;
   for(const [j,n] of source.notes.entries()){
    if(j%stride!==phase)continue;
    const tick=n.tick,duration=clamp(Math.ceil(n.duration*.45),1,n.duration),key=clamp(n.key+shift,0,127);
    if(notes.some(x=>x.key===key&&x.tick+x.duration>tick))continue;
    let available=true;for(let t=tick;t<tick+duration;t++)if(used[t]>=8){available=false;break;}
    if(!available)continue;
    notes.push({...n,program:undefined,tick,duration,key,velocity:clamp(Math.round(n.velocity*.5),1,127)});
    for(let t=tick;t<tick+duration;t++)used[t]++;
   }
   if(notes.length)score.tracks.push({name:'Supporting colour '+(i+1),program:[8,11,20,10,13,18,9,15][i%8],notes,automation:[{tick:0,volume:55,pan:i%2?82:46,bend:0,range:2}]});
   else warnings.push('No spare playback voice windows for another instrument: kept '+score.tracks.length+' parts.');
  }
 }
 score.composition={...score.composition,partDensity:{source:original,requested:target,actual:score.tracks.length,delta}};
 return{score,warnings};
}
