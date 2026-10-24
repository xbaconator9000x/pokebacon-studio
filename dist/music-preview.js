import {decodeWave} from './pcm-sample.js';
import {Rom,WAIT} from './music-parser.js';
import {unpackMusic,validateMusicAsset} from './music-assets.js';

// Bounded MP2K preview. Native modulation, reverb and CGB envelopes remain approximate.
// FIX means one PCM sample per mixer output sample; on CGB it rounds hardware
// frequency registers, rather than replacing the note by ToneData.key.
export function renderMusic(asset,{seconds=15,sampleRate=22050,gain=.6,mixerRate=13379}={}){
 seconds=Math.max(1,Math.min(180,+seconds||15));sampleRate=Math.max(11025,Math.min(44100,+sampleRate||22050));mixerRate=Math.max(4000,Math.min(48000,+mixerRate||13379));
 validateMusicAsset(asset);const unpacked=unpackMusic(asset),r=new Rom(unpacked.bytes),header=r.ptr(unpacked.table),bank=r.ptr(header+4),notes=[],tempos=[{tick:0,bpm:120}],warnings=new Set(),controls=[];
 for(let tr=0;tr<r.u8(header);tr++){
  let pc=r.ptr(header+8+tr*4),tick=0,last=0,program=-1,key=60,velocity=100,volume=100,pan=0,shift=0,bend=0,range=2,tuning=0,ops=0;
  const seen=new Set(),held=[],stack=[],repeats=new Map(),points=[];controls.push(points);
  const point=()=>{const p={tick,volume,pan,bend,range,tuning};if(points.at(-1)?.tick===tick)points[points.length-1]=p;else points.push(p);};point();
  const close=(endKey=null)=>{for(let i=held.length-1;i>=0;i--)if(endKey===null||held[i].key===endKey){held[i].duration=Math.max(0,tick-held[i].tick);held.splice(i,1);}};
  while(tick<seconds*240&&ops++<100000){const start=pc,identity=[pc,tick,last,program,key,...stack].join(':');if(seen.has(identity)){warnings.add('A zero-time sequence cycle was stopped.');break;}seen.add(identity);let cmd=r.u8(pc);if(cmd>=128){pc++;if(cmd>=0xbd)last=cmd;}else cmd=last;
   if(cmd>=0xcf){let extra=0;if(r.u8(pc)<128){key=r.u8(pc++);if(r.u8(pc)<128){velocity=r.u8(pc++);if(r.u8(pc)<128)extra=r.u8(pc++);}}const note={track:tr,tick,duration:cmd===0xcf?seconds*240:WAIT[cmd-0xcf]+extra,program,key,pitch:key+shift,velocity};notes.push(note);if(cmd===0xcf)held.push(note);continue;}
   if(cmd>=0x80&&cmd<=0xb0){tick+=WAIT[cmd-0x80];continue;}
   if(cmd===0xb1){close();break;}
   if(cmd===0xb2){pc=r.ptr(pc);continue;}
   if(cmd===0xb3){const target=r.ptr(pc);if(stack.length>=3)throw Error('Music pattern stack exceeds its limit.');stack.push(pc+4);pc=target;continue;}
   if(cmd===0xb4){if(stack.length)pc=stack.pop();continue;}
   if(cmd===0xb5){const count=r.u8(pc++),target=r.ptr(pc);pc+=4;const repeat=(repeats.get(start)||0)+1;if(!count||repeat<count){repeats.set(start,repeat);pc=target;}else repeats.delete(start);continue;}
   if(cmd===0xb9){const op=r.u8(pc);pc+=3;if(op>=6)pc+=4;warnings.add('Audio memory operations are approximated in this preview.');continue;}
   if(cmd===0xba){pc++;continue;}
   if(cmd===0xbb){tempos.push({tick,bpm:Math.max(10,r.u8(pc++)*2)});continue;}
   if(cmd===0xbc){shift=(r.u8(pc++)<<24)>>24;continue;}
   if(cmd===0xbd){program=r.u8(pc++);continue;}
   if(cmd===0xbe){volume=r.u8(pc++);point();continue;}
   if(cmd===0xbf){pan=(r.u8(pc++)-64)/64;point();continue;}
   if(cmd===0xc0){bend=r.u8(pc++)-64;point();continue;}
   if(cmd===0xc1){range=r.u8(pc++);point();continue;}
   if(cmd===0xc8){tuning=(r.u8(pc++)-64)/64;point();continue;}
   if([0xc2,0xc3,0xc4,0xc5].includes(cmd)){pc++;warnings.add('Modulation and reverb are approximated.');continue;}
   if(cmd===0xce){close(r.u8(pc)<128?r.u8(pc++):key);continue;}
   if(cmd===0xcd){const sub=r.u8(pc++);if(sub===0||sub===3){close();break;}pc+=sub===1||sub===13?4:sub===12?2:1;warnings.add('Extended echo/envelope effects are approximated.');continue;}
   throw Error('This music command cannot be previewed.');
  }
  if(ops>=100000)warnings.add('Preview command limit reached.');
 }
 tempos.sort((a,b)=>a.tick-b.tick);const merged=[];for(const t of tempos){if(merged.at(-1)?.tick===t.tick)merged[merged.length-1]=t;else merged.push(t);}
 const time=tick=>{let elapsed=0;for(let i=0;i<merged.length;i++){const t=merged[i],end=Math.min(tick,merged[i+1]?.tick??tick);if(end>t.tick)elapsed+=(end-t.tick)*60/(24*t.bpm);if(end===tick)break;}return elapsed;};
 const automation=controls.map(points=>points.map(p=>({...p,at:time(p.tick)}))),frames=Math.ceil(seconds*sampleRate),pcm=new Float32Array(frames*2),decoded=new Map();let audible=0;
 const toneFor=(program,key)=>{if(program<0)return{type:1,key:60,data:0,a:255,d:0,s:255,r:180};let at=bank+program*12,type=r.u8(at),drum=false;if(type&0xc0){const sub=r.ptr(at+4),index=type&64?r.u8(r.ptr(at+8)+key):key;at=sub+index*12;drum=!!(type&128);type=r.u8(at);}return{type,key:r.u8(at+1),data:r.u32(at+4),a:r.u8(at+8),d:r.u8(at+9),s:r.u8(at+10),r:r.u8(at+11),drum};};
 const hardwareNotes=new Map();for(const n of notes.sort((a,b)=>a.tick-b.tick)){n.tone=toneFor(n.program,n.key);const h=n.tone.type&7;if(h){const old=hardwareNotes.get(h);if(old)old.until=time(n.tick);hardwareNotes.set(h,n);}}
 for(const note of notes){
  const start=time(note.tick);if(start>=seconds||!note.duration)continue;
  const t=note.tone,hardware=t.type&7,duration=Math.max(0,time(note.tick+note.duration)-start),release=hardware?Math.min(.35,(255-t.r)/600+.01):Math.min(1,t.r>=255?1:Math.max(.02,Math.log(1/255)/Math.log(Math.max(1,t.r)/256)/60));
  const offset=Math.floor(start*sampleRate),count=Math.max(0,Math.min(frames-offset,Math.ceil((duration+release)*sampleRate),Math.floor(((note.until??seconds)-start)*sampleRate))),pitch=t.drum?t.key:note.pitch;
  let sample=null,loop=0,looping=false,baseRate=0,wave=null,position=0,phase=0,noise=0x7fff,noiseValue=0,noisePhase=0;
  if(hardware===0){const at=t.data-0x08000000;let data=decoded.get(at);if(!data){data=decodeWave(r,at,{maxSamples:1048576});decoded.set(at,data);}sample=t.type&16?data.pcm.slice().reverse():data.pcm;loop=data.loopStart;looping=!(t.type&16)&&!!(data.status&0xc000);baseRate=t.type&8?mixerRate:data.rate*2**((pitch-60)/12);}
  else if(hardware===3){const at=t.data-0x08000000;r.require(at,16);wave=Array.from({length:32},(_,i)=>(r.u8(at+(i>>1))>>>(i%2?0:4)&15)/7.5-1);}
  const points=automation[note.track];let ci=0;while(ci+1<points.length&&points[ci+1].at<=start)ci++;
  let env=0,stage=0,envFrame=-1;audible++;
  for(let i=0;i<count;i++){
   const elapsed=i/sampleRate,at=start+elapsed;while(ci+1<points.length&&points[ci+1].at<=at)ci++;const c=points[ci],shift=c.bend/64*c.range+c.tuning,frequency=Math.min(sampleRate/2,440*2**((pitch+shift-69)/12));
   let envelope;
   if(hardware){envelope=Math.min(1,elapsed/Math.min(.12,(255-t.a)/3000+.001));if(elapsed>duration)envelope*=Math.max(0,1-(elapsed-duration)/Math.max(.001,release));}
   else{const frame=Math.floor(elapsed*60);while(envFrame<frame){envFrame++;if(envFrame/60>=duration){env=env*t.r/256;stage=3;}else if(stage===0){env=Math.min(255,env+t.a);if(env>=255)stage=1;}else if(stage===1){env=env*t.d/256;if(env<=t.s){env=t.s;stage=2;}}}envelope=env/255;}
   let value=0;
   if(sample){if(position>=sample.length){if(looping&&loop<sample.length)position=loop+(position-loop)%(sample.length-loop);else break;}const a=Math.floor(position),b=a+1<sample.length?a+1:looping&&loop<sample.length?loop:a,f=position-a;value=((sample[a]<<24>>24)*(1-f)+(sample[b]<<24>>24)*f)/128;position+=baseRate*(t.type&8?1:2**(shift/12))/sampleRate;}
   else if(hardware===4){noisePhase+=frequency*8/sampleRate;while(noisePhase>=1){noisePhase--;noise=(noise>>1)|((noise^(noise>>1))&1)<<14;noiseValue=(noise&1)?1:-1;}value=noiseValue*.5;}
   else{value=wave?wave[Math.floor(phase*32)%32]:phase<[.125,.25,.5,.75][t.data&3]?1:-1;phase=(phase+frequency/sampleRate)%1;}
   const amplitude=Math.max(0,Math.min(1,gain))*note.velocity/127*c.volume/127*.22,v=value*envelope*amplitude,pan=Math.max(-1,Math.min(1,c.pan));pcm[(offset+i)*2]+=v*Math.sqrt((1-pan)/2);pcm[(offset+i)*2+1]+=v*Math.sqrt((1+pan)/2);
  }
 }
 let peak=0;for(const v of pcm)peak=Math.max(peak,Math.abs(v));if(peak>.95)for(let i=0;i<pcm.length;i++)pcm[i]*=.95/peak;
 return{pcm,sampleRate,seconds,notes:notes.length,audible,warnings:[...warnings]};
}
