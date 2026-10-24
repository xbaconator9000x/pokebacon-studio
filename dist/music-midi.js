import {checkScore} from './music-compose.js';
import {automationFor} from './music-controls.js';
const MAX_TICKS=96*2048;
const family=['Piano','Chromatic percussion','Organ','Guitar','Bass','Strings','Ensemble','Brass','Reed','Pipe','Synth lead','Synth pad','Synth effects','Ethnic','Percussive','Sound effects'];

export function readMIDI(input){
 let b=input instanceof Uint8Array?input:new Uint8Array(input);
 if(b.length>2*1024*1024)throw Error('Use a MIDI file under 2 MB.');
 // Windows RIFF MIDI wraps the same standard MIDI stream in an RMID data chunk.
 if(String.fromCharCode(...b.slice(0,4))==='RIFF'){
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(b.length<12||String.fromCharCode(...b.slice(8,12))!=='RMID'||v.getUint32(4,true)+8>b.length)throw Error('Invalid RIFF MIDI container.');
  let data=null;for(let at=12;at+8<=b.length;){const n=v.getUint32(at+4,true);if(at+8+n>b.length)throw Error('Truncated RIFF MIDI chunk.');if(String.fromCharCode(...b.slice(at,at+4))==='data'){data=b.subarray(at+8,at+8+n);break;}at+=8+n+(n&1);}if(!data)throw Error('RIFF MIDI has no song data.');b=data;
 }
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);let p=0;
 const need=n=>{if(p+n>b.length)throw Error('Truncated MIDI file.');},u8=()=>{need(1);return b[p++];},u16=()=>{need(2);const n=v.getUint16(p);p+=2;return n;},u32=()=>{need(4);const n=v.getUint32(p);p+=4;return n;},tag=()=>String.fromCharCode(u8(),u8(),u8(),u8());
 if(tag()!=='MThd')throw Error('Choose a standard .mid file.');const size=u32(),headerEnd=p+size;if(size<6||headerEnd>b.length)throw Error('Invalid MIDI header.');const format=u16(),trackCount=u16(),division=u16();if(format>1||!trackCount||trackCount>256)throw Error('Use MIDI format 0 or 1, with up to 256 file tracks.');if(!division||(division&0x8000))throw Error('SMPTE timing is unsupported. Export MIDI using ticks per quarter note.');p=headerEnd;
 const events=[],warnings=new Set(),names=new Map(),markers=[];let serial=0,endTick=0;
 for(let tr=0;tr<trackCount;tr++){
  if(tag()!=='MTrk')throw Error('Missing MIDI track.');const trackLength=u32(),trackEnd=p+trackLength;if(trackEnd>b.length)throw Error('Truncated MIDI track.');let tick=0,last=0,ended=false;
  const vlq=()=>{let n=0;for(let i=0;i<4;i++){const q=u8();if(p>trackEnd)throw Error('MIDI event exceeds its track.');n=n*128+(q&127);if(!(q&128))return n;}throw Error('Invalid MIDI variable length.');};
  const push=e=>{if(events.length>=100000)throw Error('MIDI event budget exceeded.');events.push({tick,tr,serial:serial++,...e});};
  while(p<trackEnd){tick+=vlq();if(tick/division*24>MAX_TICKS)throw Error('Keep MIDI files within 2048 four-beat bars; choose an export section in the arranger.');let status=u8();if(status<128){if(!last)throw Error('MIDI running status has no command.');p--;status=last;}else if(status<240)last=status;
   if(status===255){last=0;const type=u8(),n=vlq();need(n);if(p+n>trackEnd)throw Error('MIDI meta event exceeds its track.');if(type===0x51){if(n!==3)throw Error('Invalid MIDI tempo.');const micros=b[p]*65536+b[p+1]*256+b[p+2];if(!micros)throw Error('Invalid MIDI tempo.');push({type:'tempo',bpm:60000000/micros});}if(type===6){const text=new TextDecoder().decode(b.subarray(p,p+n));if(/^loop(Start|End)$/i.test(text))markers.push({tick:Math.round(tick*24/division),text:text.toLowerCase()});}if(type===3||type===4){const text=new TextDecoder().decode(b.subarray(p,p+n)).replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,120);if(text&&(type===3||!names.has(tr)))names.set(tr,text);}if(type===0x2f){if(n)throw Error('Invalid MIDI end marker.');endTick=Math.max(endTick,Math.round(tick*24/division));push({type:'end'});ended=true;p=trackEnd;break;}p+=n;continue;}
   if(status===0xf0||status===0xf7){last=0;const n=vlq();need(n);if(p+n>trackEnd)throw Error('MIDI SysEx exceeds its track.');p+=n;warnings.add('SysEx and external synthesizer settings are omitted.');continue;}
   if(status>=0xf0)throw Error('Unsupported MIDI system event.');const kind=status>>4,channel=status&15,a=u8(),c=[0xc,0xd].includes(kind)?0:u8();if(p>trackEnd||a>127||c>127)throw Error('Invalid MIDI channel data.');
   if(kind===9||kind===8)push({channel,type:kind===9&&c?'on':'off',key:a,velocity:c});
   else if(kind===0xb)push({channel,type:'controller',a,value:c});
   else if(kind===0xc)push({channel,type:'program',value:a});
   else if(kind===0xe)push({channel,type:'bend',value:Math.max(-64,Math.min(63,Math.round((a+c*128-8192)/128)))});
   else if(kind===0xa||kind===0xd)warnings.add('MIDI aftertouch is omitted.');
  }if(!ended){warnings.add('A missing end-of-track marker was recovered from the track chunk boundary.');endTick=Math.max(endTick,Math.round(tick*24/division));push({type:'end'});}p=trackEnd;
 }
 events.sort((a,b)=>a.tick-b.tick||a.serial-b.serial);
 const parts=new Map(),states=Array.from({length:16},()=>({bend:0,range:2,volume:100,expression:127,pan:64,program:0,rpnMSB:127,rpnLSB:127,pedal:false})),tempos=new Map([[0,120]]);let length=Math.max(1,endTick);
 const finish=(part,n,tick)=>{const duration=Math.max(1,tick-n.tick);part.notes.push({...n,duration});length=Math.max(length,n.tick+duration);};
 const control=(part,tick,state)=>{const point={tick,bend:state.bend,range:state.range,volume:Math.round(state.volume*state.expression/127),pan:state.pan};if(part.automation.at(-1)?.tick===tick)part.automation[part.automation.length-1]=point;else part.automation.push(point);};
 for(const e of events){const tick=Math.round(e.tick*24/division);
  if(e.type==='tempo'){if(e.bpm<10||e.bpm>510)throw Error('Use MIDI tempos between 10 and 510 BPM.');tempos.set(tick,Math.max(10,Math.round(e.bpm/2)*2));continue;}
  if(e.type==='end'){
   for(const part of parts.values())if(part.sourceTrack===e.tr){for(const n of [...part.active.values()].flat())finish(part,n,tick);for(const n of part.held)finish(part,n,tick);if(part.held.length||[...part.active.values()].some(a=>a.length))warnings.add('Unreleased MIDI notes and pedal holds are closed at their file track’s end.');part.active.clear();part.held=[];}
   continue;
  }
  const state=states[e.channel],related=()=>[...parts.values()].filter(t=>t.channel===e.channel);
  if(e.type==='program'){state.program=e.value;continue;}
  if(e.type==='bend'){state.bend=e.value;related().forEach(t=>control(t,tick,state));warnings.add('Pitch bends retain their range at the GBA player’s seven-bit resolution.');continue;}
  if(e.type==='controller'){
   if(e.a===101)state.rpnMSB=e.value;else if(e.a===100)state.rpnLSB=e.value;
   else if(e.a===6&&state.rpnMSB===0&&state.rpnLSB===0)state.range=e.value;
   else if(e.a===7)state.volume=e.value;else if(e.a===11)state.expression=e.value;else if(e.a===10)state.pan=e.value;
   else if(e.a===64){state.pedal=e.value>=64;if(!state.pedal)for(const part of related()){part.held.forEach(n=>finish(part,n,tick));part.held=[];}}
   else if(e.a===120||e.a===123){for(const part of related()){for(const n of [...part.active.values()].flat())finish(part,n,tick);part.held.forEach(n=>finish(part,n,tick));part.active.clear();part.held=[];}}
   else if(e.a===121){Object.assign(state,{bend:0,range:2,volume:100,expression:127,pan:64,pedal:false,rpnMSB:127,rpnLSB:127});for(const part of related()){part.held.forEach(n=>finish(part,n,tick));part.held=[];}}
   else warnings.add('Unsupported MIDI controllers are omitted; volume, expression, pan, sustain and pitch range are retained.');
   if([6,7,10,11,121].includes(e.a))related().forEach(t=>control(t,tick,state));continue;
  }
  const id=e.tr+':'+e.channel;let part=parts.get(id);
  if(!part&&e.type==='on'){part={name:names.get(e.tr)||(e.channel===9?'Percussion':family[Math.floor(state.program/8)]+' · channel '+(e.channel+1)),sourceTrack:e.tr,channel:e.channel,midiProgram:state.program,program:e.channel===9?3:0,notes:[],automation:[],active:new Map(),held:[]};parts.set(id,part);control(part,0,state);}
  if(!part)continue;
  if(e.type==='on'){const list=part.active.get(e.key)||[];list.push({tick,key:e.key,velocity:e.velocity});part.active.set(e.key,list);if(part.midiProgram!==state.program)warnings.add('A MIDI part changes programs; choose one instrument for that part in the arranger.');}
  else{const list=part.active.get(e.key);if(list?.length){const n=list.shift();if(state.pedal)part.held.push(n);else finish(part,n,tick);}}
 }
 const tracks=[];
 for(const part of [...parts.values()].sort((a,b)=>a.sourceTrack-b.sourceTrack||a.channel-b.channel)){
  if(!part.notes.length)continue;const {active,held,...t}=part,lanes=[];
  for(const note of t.notes.sort((a,b)=>a.tick-b.tick||a.key-b.key)){let lane=lanes.find(l=>(l.endings.get(note.key)||0)<=note.tick);if(!lane){lane={notes:[],endings:new Map()};lanes.push(lane);}lane.notes.push(note);lane.endings.set(note.key,note.tick+note.duration);}
  for(const [i,lane]of lanes.entries())tracks.push({...t,name:t.name+(i?' · voice '+(i+1):''),notes:lane.notes,automation:automationFor({...t,automation:t.automation.filter(p=>p.tick<length)})});
  if(lanes.length>1)warnings.add('Overlapping copies of one pitch are kept in separate voice parts.');
 }

 if(!tracks.length)throw Error('This MIDI contains no notes.');if(tracks.length>256)throw Error('This MIDI has more than 256 sounding parts. Split it into smaller files.');
 const score={ppq:24,length,tempos:[...tempos].filter(([tick])=>tick<length).sort((a,b)=>a[0]-b[0]).map(([tick,bpm])=>({tick,bpm})),tracks};
 const loopMarker=markers.find(m=>m.text==='loopstart');if(loopMarker&&loopMarker.tick<length)score.loopStart=loopMarker.tick;
 const stats=checkScore(score,{arranging:true});if(length>512*96)warnings.add('This file exceeds 512 bars. The arranger starts with bars 1–512; choose the section to export.');if(stats.peak>8||stats.parts>10)warnings.add('Solo or mute parts to meet the ten-part / eight-note ROM playback budget.');warnings.add('Timing is quantized to 24 ticks per beat; tempos are rounded to even BPM. MIDI instruments are selected in the arranger.');return{score,warnings:[...warnings]};
}

export function writeMIDI(score){
 checkScore(score);const u32=n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255],vlq=n=>{const b=[n&127];while(n=Math.floor(n/128))b.unshift((n&127)|128);return b;},chunk=(tag,b)=>[...new TextEncoder().encode(tag),...u32(b.length),...b];
 const tracks=score.tracks.map((tr,index)=>{const channel=tr.channel===9?9:(index>=9?index+1:index),events=[];
  if(index===0&&score.loopStart!==undefined)for(const [tick,text]of [[score.loopStart,'loopStart'],[score.length,'loopEnd']]){const b=[...new TextEncoder().encode(text)];events.push({tick,order:-1,b:[255,6,b.length,...b]});}
  if(index===0)for(const t of score.tempos){const n=Math.round(60000000/t.bpm);events.push({tick:t.tick,order:1,b:[255,0x51,3,n>>>16&255,n>>>8&255,n&255]});}
  const name=[...new TextEncoder().encode((tr.name||'Part '+(index+1)).slice(0,120))];events.push({tick:0,order:-3,b:[255,3,...vlq(name.length),...name]},{tick:0,order:-2,b:[0xc0+channel,tr.midiProgram??tr.program]});
  for(const p of automationFor(tr)){const bend=Math.max(0,Math.min(16383,p.bend*128+8192));for(const b of [[0xb0+channel,101,0],[0xb0+channel,100,0],[0xb0+channel,6,p.range],[0xb0+channel,7,p.volume],[0xb0+channel,10,p.pan],[0xe0+channel,bend&127,bend>>7]])events.push({tick:p.tick,order:1,b});}
  for(const n of tr.notes)events.push({tick:n.tick,order:2,b:[0x90+channel,n.key,n.velocity]},{tick:n.tick+n.duration,order:0,b:[0x80+channel,n.key,0]});
  events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let tick=0;const b=[];for(const e of events){b.push(...vlq(e.tick-tick),...e.b);tick=e.tick;}b.push(...vlq(score.length-tick),255,47,0);return chunk('MTrk',b);
 });return Uint8Array.from([...chunk('MThd',[0,1,0,tracks.length,0,24]),...tracks.flat()]);
}
