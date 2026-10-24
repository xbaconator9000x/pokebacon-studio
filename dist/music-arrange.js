import {automationFor} from './music-controls.js';
import {checkScore,MUSIC_SCALES} from './music-compose.js';
import {validateMusicAsset,unpackMusic,extractMusic} from './music-assets.js';
import {decodeWave} from './pcm-sample.js';
const int=(n,a,b,label)=>{if(!Number.isInteger(n)||n<a||n>b)throw Error('Invalid '+label+'.');return n;};

// Sections are copied from the source score; the source and its notes stay intact.
export function arrangeSections(source,sections){
 checkScore(source,{arranging:true});if(!Array.isArray(sections)||!sections.length||sections.length>32)throw Error('Use one to 32 sections.');
 const score={ppq:24,length:0,tempos:[],tracks:source.tracks.map(t=>({...structuredClone(t),notes:[],automation:[]}))};
 for(const s of sections){const from=int(s.from,0,source.length-1,'section start'),to=int(s.to,from+1,source.length,'section end'),repeat=int(s.repeat??1,1,16,'repeat count'),transpose=int(s.transpose??0,-24,24,'section transpose'),gain=int(s.gain??100,1,150,'section volume');
  for(let r=0;r<repeat;r++){const start=score.length;score.length+=to-from;if(score.length>512*96)throw Error('Keep the arranged song within 512 bars.');
   const initial=source.tempos.filter(t=>t.tick<=from).at(-1);score.tempos.push({tick:start,bpm:initial.bpm});for(const t of source.tempos)if(t.tick>from&&t.tick<to)score.tempos.push({tick:start+t.tick-from,bpm:t.bpm});
   source.tracks.forEach((t,i)=>{const points=automationFor(t),initial=points.filter(p=>p.tick<=from).at(-1);score.tracks[i].automation.push({...initial,tick:start});for(const point of points)if(point.tick>from&&point.tick<to)score.tracks[i].automation.push({...point,tick:start+point.tick-from});for(const n of t.notes){const a=Math.max(from,n.tick),b=Math.min(to,n.tick+n.duration);if(a>=b)continue;const key=n.key+(t.channel===9?0:transpose);int(key,0,127,'transposed pitch');score.tracks[i].notes.push({...n,tick:start+a-from,duration:b-a,key,velocity:Math.max(1,Math.min(127,Math.round(n.velocity*gain/100)))});}});
  }
 }
 score.tempos=score.tempos.filter((t,i,a)=>!i||t.bpm!==a[i-1].bpm);checkScore(score,{arranging:true});return score;
}

// Shift a selected part's phrase to each diatonic chord root, retaining its contour.
export function applyChordRoots(source,{key=0,scale='Major',degrees=[0,3,4,0],parts=[1,2],barsPerChord=1}={}){
 checkScore(source,{arranging:true});int(key,0,11,'key');int(barsPerChord,1,16,'chord length');const steps=MUSIC_SCALES[scale];if(!steps||!Array.isArray(degrees)||!degrees.length||degrees.length>32||degrees.some(n=>!Number.isInteger(n)||n<0||n>=steps.length)||!Array.isArray(parts)||parts.some(i=>!Number.isInteger(i)||!source.tracks[i]))throw Error('Choose scale degrees and existing parts.');
 const score=structuredClone(source);for(const i of new Set(parts)){const tr=score.tracks[i];if(tr.channel===9)continue;const roots=new Map();for(const n of [...tr.notes].sort((a,b)=>a.tick-b.tick)){const section=Math.floor(n.tick/(96*barsPerChord));if(!roots.has(section))roots.set(section,n.key%12);}for(const n of tr.notes){const section=Math.floor(n.tick/(96*barsPerChord)),base=roots.get(section),degree=degrees[section%degrees.length],target=(key+steps[degree])%12,shift=((target-base+18)%12)-6;n.key+=shift;int(n.key,0,127,'chord pitch');}}checkScore(score,{arranging:true});return score;
}

// Filters preserve sample lengths, tuning, loop positions and shared pointers.
export function filterMusicSamples(asset,{lowpass=100,highpass=0,drive=0,bitDepth=8,name=asset.name+' filtered'}={}){
 int(lowpass,1,100,'low-pass amount');int(highpass,0,100,'high-pass amount');int(drive,0,100,'drive');int(bitDepth,2,8,'bit depth');
 const {deps}=validateMusicAsset(asset),{bytes:original,table}=unpackMusic(asset);if(!deps.samples.length)throw Error('This track has no PCM samples to filter.');const chunks=[],targets=new Map();let length=(original.length+3)&~3,total=0;
 for(const s of deps.samples){const sample=decodeWave({bytes:original},s.start,{maxSamples:1048576});if((total+=sample.pcm.length)>8*1024*1024)throw Error('Keep filtered PCM samples below 8 MB.');const pcm=new Uint8Array(sample.pcm.length),step=2**(8-bitDepth),alpha=lowpass/100,hp=highpass/100*.98,signed=n=>n<<24>>24;let low=0,prior=0,high=0;
  // Warm cyclic filters from the loop tail to reduce the seam in looped voices.
  const run=(n)=>{low+=alpha*(signed(n)-low);high=hp*(high+low-prior);prior=low;let x=(highpass?high:low)/128;if(drive)x=Math.tanh(x*(1+drive/12))/Math.tanh(1+drive/12);return Math.max(-128,Math.min(127,Math.round(x*128/step)*step))&255;};
  if(sample.status&0x4000)for(let i=Math.max(sample.loopStart,sample.pcm.length-4096);i<sample.pcm.length;i++)run(sample.pcm[i]);
  for(let i=0;i<pcm.length;i++)pcm[i]=run(sample.pcm[i]);const raw=new Uint8Array(16+pcm.length+4);raw.set(original.subarray(s.start,s.start+16));raw[0]=raw[1]=0;raw.set(pcm,16);targets.set(s.start,length);chunks.push({at:length,raw});length=(length+raw.length+3)&~3;
 }
 const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);bytes.set(original);for(const {at,raw}of chunks)bytes.set(raw,at);for(const p of deps.pointers)if(p.kind==='sample'){view.setUint32(p.offset,0x08000000+targets.get(p.target),true);bytes[p.offset-4]&=~0x20;}
 const result=extractMusic(bytes,table,0,{name,sourceName:asset.sourceName+' · sample filters'});if(asset.arrangement)result.arrangement=structuredClone(asset.arrangement);return result;
}
