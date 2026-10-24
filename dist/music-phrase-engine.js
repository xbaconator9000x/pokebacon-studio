import{MUSIC_VOCABULARY}from'./music-vocabulary.js';
import{MUSIC_SCALES,musicStyle}from'./music-styles.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=seed=>{let state=seed>>>0;return()=>{state=(state+0x9e3779b9)>>>0;let n=state;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return((n^(n>>>15))>>>0)/4294967296;};};
const RHYTHMS={
 walking:[[0,12,24,48,72,96,120,132,144,168],[0,24,36,48,84,96,120,144,168]],
 driving:[[0,12,24,36,48,72,84,96,108,120,144,156,168],[0,6,24,36,48,60,72,96,120,132,144,168]],
 syncopated:[[0,18,30,48,66,84,96,114,138,156,168],[0,12,42,60,72,96,108,126,144,174]],
 spacious:[[0,36,72,108,144],[12,48,96,132,168]],
 flowing:[[0,24,36,60,72,96,120,132,156,168],[0,18,36,48,72,96,120,144,156,168]],
 lilt:[[0,16,24,40,48,72,96,112,120,144,160,168],[0,24,40,64,72,96,120,136,160,168]],
 anthem:[[0,18,24,48,84,96,120,144],[0,12,24,60,72,96,132,144,168]],
 ballad:[[0,24,60,96,132,144],[0,36,72,96,120,156]],
 story:[[0,24,48,84,108,144],[12,36,48,72,96,132,168]],
 swing:[[0,16,24,48,64,72,96,112,120,144,168],[0,24,40,48,72,88,96,120,136,144,168]],
 march:[[0,12,24,48,60,72,96,120,144,168],[0,24,36,48,72,96,108,120,156,168]]
};
const SHAPES={arch:[0,1,2,3,4,3,2,1,0],rising:[0,0,2,1,3,4,3,5,4],falling:[4,3,2,3,1,2,1,0,0],turn:[0,2,1,0,-1,1,3,2,0]};
export function phraseScore(options={},sections){
 const mood=options.mood||'Battle',genre=options.genre||'Game soundtrack',style=musicStyle(mood,genre),steps=MUSIC_SCALES[options.scale||style.scale],key=options.key??0,seed=options.seed??1,complexity=options.complexity??45,adventure=options.adventure??15,tempo=options.tempo??style.tempo;
 if(!steps)throw Error('Choose a scale.');for(const [v,a,b,label]of [[key,0,11,'key'],[seed,0,0xffffffff,'seed'],[complexity,0,100,'complexity'],[adventure,0,100,'experimentation'],[tempo,10,510,'tempo']])if(!Number.isInteger(v)||v<a||v>b)throw Error('Invalid '+label+'.');
 const vocabulary=options.learned||MUSIC_VOCABULARY[mood]||MUSIC_VOCABULARY.default,learningAmount=options.learned?(options.learningInfluence??55):18;const rand=random(seed),pick=a=>a[Math.floor(rand()*a.length)],degreePitch=(d,oct=5)=>key+oct*12+steps[(d%steps.length+steps.length)%steps.length]+12*Math.floor(d/steps.length),nearest=(pitch)=>{let best=60,distance=Infinity;for(let d=-14;d<30;d++){const k=degreePitch(d);if(k>=36&&k<=96&&Math.abs(k-pitch)<distance){distance=Math.abs(k-pitch);best=d;}}return best;},home=nearest(style.register+(vocabulary.register-style.register)*learningAmount/100*.4);
 const sceneVoices={Route:[8,11],Gym:[14,2],Cave:[15,12],Ocean:[8,15],Forest:[8,11],Villain:[13,14],Hero:[9,12],'Melancholy introduction':[8,12],'Exciting introduction':[9,14],'In-game introduction':[8,11],Spooky:[15,12],Chill:[8,2],Solemn:[13,12]},genreVoices={Rock:[14,11],Metal:[14,9],Orchestral:[9,12],Jazz:[13,11],Funk:[14,13],Latin:[8,11],Electronic:[14,15],Ambient:[15,12],Folk:[8,11],Ballad:[8,12],March:[9,13]},voices=genreVoices[genre]||sceneVoices[mood]||[0,2];
 const tracks=['Melody','Bass','Harmony','Percussion'].map((name,i)=>({name,program:i===0?voices[0]:i===2?voices[1]:i,...(i===3?{channel:9}:{}),notes:[],automation:[{tick:0,volume:i===0?110:i===1?88:i===2?58:65,pan:[64,52,82,64][i],bend:0,range:2}]}));
 const put=(part,tick,duration,pitch,velocity)=>{if(duration>0&&pitch>=0&&pitch<=127)tracks[part].notes.push({tick:Math.round(tick),duration:Math.round(duration),key:Math.round(pitch),velocity:clamp(Math.round(velocity),1,127)});};
 const progression=style.progression.map((d,i)=>i===0?0:i===3?pick([d,0,4]):pick([d,d,(d+1)%steps.length,(d+steps.length-1)%steps.length])),themeRhythms=RHYTHMS[style.rhythm],r0=pick(themeRhythms),r1=pick(themeRhythms),shape=SHAPES[style.contour],origin=pick([0,2,4]),phrasePlan=[];
 const rootAt=(bar,kind)=>{const cycle=kind==='bridge'?[progression[2],progression[1],progression[0],progression[3]]:progression;return cycle[bar%cycle.length]%steps.length;};
 const noteTargets=(onsets,startBar,kind,variation)=>{
  let prev=home+origin,prevDelta=0;const phrase=[];
  for(let i=0;i<onsets.length;i++){
   const tick=onsets[i],bar=startBar+Math.floor(tick/96),root=rootAt(bar,kind),chord=(genre==='Jazz'?[root,root+2,root+4,root+6]:[root,root+2,root+4]).map(d=>((d%steps.length)+steps.length)%steps.length),strong=tick%24===0,cadence=i===onsets.length-1,target=home+origin+shape[Math.round(i/(onsets.length-1)*(shape.length-1))]+adventure/100*Math.sin(i*.8+variation)*2+(kind==='bridge'?[1,2,-1,0][variation%4]:0);
   const candidates=[];for(let d=home-5;d<=home+steps.length+5;d++){
    const pitch=degreePitch(d),delta=pitch-degreePitch(prev),leap=Math.abs(delta),inChord=chord.includes((d%steps.length+steps.length)%steps.length);if(pitch<48||pitch>88)continue;
    let cost=Math.abs(d-target)*.8+Math.max(0,leap-2)*.65+(strong&&!inChord?3.8:0)+(leap>7?8:0)+(Math.abs(prevDelta)>4&&Math.sign(delta)===Math.sign(prevDelta)?4:0);
    if(cadence)cost+=Math.abs(d-(home+(variation%4===3?0:root)))*1.3+(inChord?0:4);
    if(i>1&&phrase.at(-1).key===pitch&&phrase.at(-2).key===pitch)cost+=5;
    if(vocabulary&&learningAmount!==0){const w=learningAmount/100,count=vocabulary.intervals[delta]||0,total=Object.values(vocabulary.intervals).reduce((a,b)=>a+b,0);cost-=w*Math.log(1+count/(total||1)*20);const next=vocabulary.transitions[prevDelta+','+delta]||0;cost-=w*Math.log(1+next)*.3;}
    cost+=(random((seed^Math.imul(variation+1,104729)^Math.imul(i+1,15485863)^Math.imul(d+40,32452843))>>>0)()-.5)*1.8;
    candidates.push({d,pitch,cost});
   }
   candidates.sort((a,b)=>a.cost-b.cost);const chosen=candidates[0],space=(onsets[i+1]??192)-tick,duration=Math.max(3,Math.floor(space*(cadence?.98:style.gate)));phrase.push({tick,duration,key:chosen.pitch,velocity:strong?103:88});prevDelta=chosen.pitch-degreePitch(prev);prev=chosen.d;
  }return phrase;
 };
 for(const section of sections){
  const bars=section.length/96;
  for(let group=0;group<Math.ceil(bars/2);group++){
   const isBridge=section.kind==='bridge',variation=isBridge?group+8:group%4,local=random((seed^Math.imul(variation+1,0x45d9f3b))>>>0),base=variation%2?r1:r0;
   let rhythm=[...base];const turn=[12,36,60,108,132,156][(seed+variation)%6];if(!rhythm.includes(turn))rhythm.push(turn);rhythm=[...new Set(rhythm)].sort((a,b)=>a-b);if(seed%3===1)rhythm=rhythm.filter((t,i)=>i!==2);if(seed%3===2)rhythm=rhythm.map(t=>t%48===0?t:Math.max(0,t-6));rhythm=[...new Set(rhythm)].sort((a,b)=>a-b);if(complexity<25)rhythm=rhythm.filter((v,i)=>i%2===0||v%96===0);if(complexity>70)rhythm=[...new Set([...rhythm,42,138])].sort((a,b)=>a-b);
   if(isBridge){const shift=[0,6,-6,12][group%4];rhythm=rhythm.map((t,i)=>i===0?t:clamp(t+(i%2?shift:0),1,180)).filter((t,i,a)=>!i||t>a[i-1]);if(group>3)rhythm=rhythm.filter((_,i)=>i%5!==group%5);}
   if(vocabulary?.rhythms?.length&&local()<learningAmount/100){const learned=vocabulary.rhythms[Math.floor(local()*vocabulary.rhythms.length)].onsets;if(learned.length>=3)rhythm=[...learned];}
   const phrase=noteTargets(rhythm,group*2,section.kind,variation);phrasePlan.push({section:section.kind,bar:group*2,form:!isBridge?['A','A′','B','cadence'][group%4]:'development '+(group+1)});
   for(const n of phrase){const tick=section.start+group*192+n.tick;if(tick>=section.start+section.length)continue;const intro=section.kind==='intro',keep=!intro||group*2>=bars-2||n.tick%48===0;if(keep)put(0,tick,Math.min(n.duration,section.start+section.length-tick),n.key,intro?n.velocity*(.5+.45*(group+1)/Math.ceil(bars/2)):n.velocity);}
  }
  for(let bar=0;bar<bars;bar++){
   const at=section.start+bar*96,root=rootAt(bar,section.kind),intro=section.kind==='intro',build=intro?(.4+.6*(bar+1)/bars):1,local=random((seed^Math.imul((section.kind==='bridge'?bar+17:bar%8)+1,0x27d4eb2d))>>>0),bassNotes={sustain:[[0,0]],walking:[[0,0],[24,2],[48,4],[72,bar%2?1:2]],octaves:[[0,0],[24,steps.length],[48,4],[72,steps.length]],alternating:[[0,0],[48,4]],pedal:[[0,0],[48,0]],chug:[[0,0],[12,0],[24,0],[36,4],[48,0],[60,0],[72,4],[84,0]],funk:[[0,0],[18,steps.length],[42,4],[60,0],[78,2]],latin:[[0,0],[36,4],[66,0]],pulse:[[0,0],[24,0],[48,0],[72,4]]}[style.bass].map(([beat,d],i)=>[beat,d]);
   if(bassNotes.length>2){const shift=[0,6,-6,12][seed%4];bassNotes.forEach((n,i)=>{if(i%2)n[0]=clamp(n[0]+shift,0,90);if(i===2&&local()>.5)n[1]=steps.length;});bassNotes.sort((a,b)=>a[0]-b[0]);}
   bassNotes.forEach(([beat,d],i)=>put(1,at+beat,Math.max(3,Math.floor(((bassNotes[i+1]?.[0]??96)-beat)*.86)),degreePitch((style.bass==='pedal'?0:root)+d,3),85*build));
   let rhythms={broken:[0,12,24,48,60,72],wave:[0,16,32,48,64,80],echo:[24,72],pulse:[0,24,48,72],ostinato:[0,12,24,36,48,60,72,84],comp:[18,42,66,84]}[style.harmony].map((t,i)=>i%2?clamp(t+[0,6,-6,12][(seed+bar)%4],0,90):t).sort((a,b)=>a-b);const arps=genre==='Jazz'?[6,2,4,1]:genre==='Metal'?[0,4,steps.length,4]:style.harmony==='wave'?[0,2,4,steps.length,4,2]:style.harmony==='echo'?[2,4]:[0,4,2,4];
   rhythms.forEach((beat,i)=>{if(intro&&bar<bars/2&&i%2)return;put(2,at+beat,Math.max(3,Math.floor(((rhythms[i+1]??96)-beat)*(style.harmony==='echo'?.65:.78))),degreePitch(root+arps[(i+Math.floor(local()*2))%arps.length],4),49*build+(section.kind==='bridge'?4:0));});
   const patterns={rock:[0,12,24,36,48,60,72,84],metal:[0,6,12,24,36,48,54,60,72,84],jazz:[0,16,24,40,48,64,72,88],funk:[0,18,24,42,48,66,72,84],latin:[0,18,36,48,66,84],electronic:[0,12,24,36,48,60,72,84],orchestral:[0,48,72],folk:[0,24,48,72],march:[0,12,24,48,60,72],ballad:[0,24,48,72],none:[]};let hits=patterns[style.beat]||patterns.rock;if(style.drums<.5)hits=[0,48];if(style.drums===0||intro&&bar<bars-1)hits=[];
   if(bar%4===3&&complexity>60&&style.drums>.5)hits=[...new Set([...hits,78,84,90])].sort((a,b)=>a-b);
   if(hits.length>2){const omitted=[12,36,60,84][seed%4];hits=hits.filter(t=>t!==omitted);if(seed%3===1)hits=[...new Set([...hits,18])].sort((a,b)=>a-b);if(seed%3===2)hits=[...new Set([...hits,66])].sort((a,b)=>a-b);}
   hits.forEach(beat=>put(3,at+beat,3,beat%48===0?36:beat%24===0?38:bar%4===3&&beat===90?46:42,(beat%48===0?80:beat%24===0?66:31)*Math.max(.3,style.drums)*build));
  }
 }
 const length=Math.max(...sections.map(s=>s.start+s.length));tracks.forEach(t=>{t.notes.sort((a,b)=>a.tick-b.tick||a.key-b.key);t.notes=t.notes.filter((n,i,a)=>!i||n.tick!==a[i-1].tick);t.notes.forEach((n,i)=>n.duration=Math.max(1,Math.min(n.duration,(t.notes[i+1]?.tick??length)-n.tick)));});
 return{ppq:24,length,loopStart:sections.find(s=>s.kind==='verse')?.start??0,tempos:[{tick:0,bpm:Math.round(tempo/2)*2}],tracks,songSections:sections,composition:{version:2,mood,genre,seed,settings:{key,scale:options.scale||style.scale,tempo,complexity,adventure,learningInfluence:learningAmount},harmony:progression,phrasePlan,description:style.description,learning:vocabulary?{source:vocabulary.source||'Selected reference',songs:vocabulary.songs||1,notes:vocabulary.notes,bars:vocabulary.bars,intervals:Object.keys(vocabulary.intervals).length}:null}};
}
