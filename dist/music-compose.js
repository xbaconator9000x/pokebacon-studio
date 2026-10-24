import {installCartridgeVoices,CARTRIDGE_VOICES} from './music-cartridge-voices.js';
import {validateAutomation,automationFor} from './music-controls.js';
export {readMIDI,writeMIDI} from './music-midi.js';
import {BASE,WAIT} from './music-parser.js';
import {extractMusic,unpackMusic,validateMusicAsset,bytes64,from64} from './music-assets.js';

// Symbolic music uses the native player's 24 ticks per quarter note.
export const MUSIC_KEYS=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
export {MUSIC_SCALES,MUSIC_MOODS,MUSIC_GENRES} from './music-styles.js';
import {MUSIC_SCALES,MUSIC_MOODS} from './music-styles.js';
import {phraseScore} from './music-phrase-engine.js';
const MAX_TICKS=96*512,MAX_NOTES=20000;
const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error('Invalid '+label+'.');return v;};
export function checkScore(score,{arranging=false}={}){
 if(!score||score.ppq!==24||!Array.isArray(score.tracks)||!score.tracks.length||score.tracks.length>(arranging?16:10))throw Error('Use one to ten export parts (up to sixteen while arranging) at 24 ticks per beat.');
 if(score.loopStart!==undefined)integer(score.loopStart,0,score.length-1,'loop start');
 integer(score.length,1,arranging?96*2048:MAX_TICKS,arranging?'arrangement length (up to 2048 bars)':'song length (up to 512 bars)');let count=0;const edges=[];
 if(!Array.isArray(score.tempos)||!score.tempos.length||score.tempos.length>256||score.tempos[0].tick!==0)throw Error('A tempo at the beginning is required.');
 let prior=-1;for(const t of score.tempos){integer(t.tick,0,score.length,'tempo position');integer(t.bpm,10,510,'tempo');if(t.tick<=prior)throw Error('Tempo positions must be ordered and distinct.');prior=t.tick;}
 for(const tr of score.tracks){integer(tr.program,0,127,'instrument');validateAutomation(tr,score.length);if(!Array.isArray(tr.notes))throw Error('Missing part notes.');const endings=new Map();for(const n of [...tr.notes].sort((a,b)=>a.tick-b.tick)){integer(n.tick,0,score.length-1,'note position');integer(n.duration,1,score.length-n.tick,'note length');integer(n.key,0,127,'note pitch');integer(n.velocity,1,127,'note velocity');if((endings.get(n.key)||0)>n.tick)throw Error('Overlapping copies of the same pitch in one part need separate channels.');endings.set(n.key,n.tick+n.duration);edges.push([n.tick,1],[n.tick+n.duration,-1]);if(++count>MAX_NOTES)throw Error('Keep songs below 20,000 notes.');}}
 if(!count)throw Error('This song has no notes.');let voices=0,peak=0;for(const [,v]of edges.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){voices+=v;peak=Math.max(peak,voices);}if(peak>(arranging?128:8))throw Error('This arrangement needs '+peak+' simultaneous notes. Reduce it to eight to leave room for game sound effects.');return{notes:count,peak,parts:score.tracks.length,ticks:score.length};
}


// Avalanche every draw: adjacent variation numbers must not produce related starts.
// All choices use this local stream, so a saved seed remains reproducible.
export function musicRandom(seed){
 let state=seed>>>0;
 return()=>{state=(state+0x9e3779b9)>>>0;let n=state;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return((n^(n>>>15))>>>0)/4294967296;};
}
export function composeMusic(options={}){const bars=options.bars??8;integer(bars,4,32,'bar count');const score=phraseScore(options,[{kind:'verse',name:'Groove / verse',start:0,length:bars*96}]);checkScore(score);return score;}

// Small original PCM waveforms. No ROM or third-party samples are bundled.
function chipBank(){const bytes=new Uint8Array(65536),v=new DataView(bytes.buffer);let at=1536;for(let program=0;program<4;program++){const row=program*12,size=program===3?512:64;bytes[row]=0;bytes[row+1]=60;v.setUint32(row+4,BASE+at,true);bytes.set([255,0,program===3?0:220,program===3?160:200],row+8);v.setUint16(at+2,program===3?0:0x4000,true);v.setUint32(at+4,Math.round((program===3?12000:261.625565*size)*1024),true);v.setUint32(at+12,size,true);let noise=0x12345678;for(let i=0;i<size;i++){const x=i/size;noise=(Math.imul(noise,1664525)+1013904223)>>>0;const sample=program===0?Math.sin(x*Math.PI*2)*.65+Math.sin(x*Math.PI*6)*.25:program===1?1-4*Math.abs(x-.5):program===2?Math.sin(x*Math.PI*2):(noise/4294967296*2-1)*(1-x)**3;bytes[at+16+i]=Math.round(sample*112)&255;}at=(at+16+size+3)&~3;}for(let i=4;i<8;i++){const row=i*12;bytes[row]=i-3;bytes[row+1]=60;bytes.set([0,0,15,0],row+8);if(i===6){v.setUint32(row+4,BASE+at,true);for(let j=0;j<16;j++)bytes[at+j]=((j<8?j*2:30-j*2)<<4)|(j<8?j*2+1:31-j*2);at+=16;}else v.setUint32(row+4,i===7?0:2,true);}for(let program=8;program<16;program++){const row=program*12,size=128;bytes[row]=0;bytes[row+1]=60;v.setUint32(row+4,BASE+at,true);bytes.set([220,[190,210,180,220,120,170,230,200][program-8],program===11?70:210,180],row+8);v.setUint16(at+2,0x4000,true);v.setUint32(at+4,Math.round(261.625565*size*1024),true);v.setUint32(at+12,size,true);for(let i=0;i<size;i++){const x=i/size,t=x*Math.PI*2,waves=[Math.sin(t)+.15*Math.sin(2*t),.65*Math.sin(t)+.25*Math.sin(3*t)+.1*Math.sin(5*t),.65*Math.sin(t)+.35*Math.sin(7*t),2*Math.abs(2*x-1)-1,.65*Math.sin(t)+.22*Math.sin(2*t)+.13*Math.sin(4*t),.6*Math.sin(t)+.4*Math.sin(2*t),Math.tanh(2*Math.sin(t)),.7*Math.sin(t)+.2*Math.sin(5*t)+.1*Math.sin(9*t)];bytes[at+16+i]=Math.round(waves[program-8]*106)&255;}at=(at+16+size+3)&~3;}const drumBank=at;at+=128*12;const drums=[];for(let kind=0;kind<4;kind++){const size=kind===2?128:512,where=at;drums.push(where);v.setUint32(where+4,12000*1024,true);v.setUint32(where+12,size,true);let noise=0x315729+kind;for(let i=0;i<size;i++){const t=i/12000,x=i/size;noise=(Math.imul(noise,1664525)+1013904223)>>>0;const n=noise/4294967296*2-1,w=kind===0?Math.sin(2*Math.PI*(80*t+55*(1-Math.exp(-t*70))/70))*Math.exp(-x*6):kind===1?(n*.8+Math.sin(t*2*Math.PI*160)*.2)*Math.exp(-x*7):kind===2?(n-(i?((bytes[where+15+i]<<24>>24)/110):0)*.4)*Math.exp(-x*8):n*Math.exp(-x*3);bytes[where+16+i]=Math.round(Math.max(-1,Math.min(1,w))*110)&255;}at=(at+16+size+3)&~3;}for(let key=0;key<128;key++){const row=drumBank+key*12,kind=key===36?0:key===38||key===40?1:key===46?3:2;bytes[row]=8;bytes[row+1]=60;v.setUint32(row+4,BASE+drums[kind],true);bytes.set([255,255,255,200],row+8);}bytes[36]=0x80;v.setUint32(40,BASE+drumBank,true);at=installCartridgeVoices(bytes,at);return{bytes:bytes.slice(0,at),bank:0};}
export function availableVoices(asset){
 if(!asset)return[{program:0,name:'Chip lead'},{program:1,name:'Triangle bass'},{program:2,name:'Soft sine'},{program:3,name:'Chip drum kit'},{program:4,name:'PSG square 1'},{program:5,name:'PSG square 2'},{program:6,name:'PSG wave'},{program:7,name:'PSG noise'},...['Chip flute','Chip brass','Chip bell','Chip pluck','Chip strings','Chip reed','Chip driven lead','Chip glass'].map((name,i)=>({program:i+8,name})),...CARTRIDGE_VOICES];
 const {song,deps}=validateMusicAsset(asset),{bytes}=unpackMusic(asset),v=new DataView(bytes.buffer),rows=new Set(deps.rows.map(r=>r.start));
 const playable=(at,key,depth=0)=>{if(!rows.has(at))return false;const type=bytes[at];if(type&0xc0){if(depth)return false;const bank=v.getUint32(at+4,true)-BASE,map=type&0x40?v.getUint32(at+8,true)-BASE:null,index=map===null?key:bytes[map+key];return playable(bank+index*12,key,1);}return true;};
 return deps.rows.filter(r=>r.start>=song.bank&&r.start<song.bank+1536&&(r.start-song.bank)%12===0).map(r=>({...r,index:(r.start-song.bank)/12})).map(r=>({program:r.index,name:(r.type&0x80?'Drum kit':r.type&0x40?'Key split':(r.type&7)===0?'PCM voice':['','PSG square 1','PSG square 2','PSG wave','PSG noise'][r.type&7])+' '+r.index,keys:Array.from({length:128},(_,key)=>key).filter(key=>playable(r.start,key))})).sort((a,b)=>a.program-b.program);
}
function checkHardware(score,bytes,bank){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),events=[];
 for(const t of score.tracks)for(const n of t.notes){let at=bank+t.program*12,type=bytes[at];if(type&0xc0){const child=v.getUint32(at+4,true)-BASE,index=type&0x40?bytes[v.getUint32(at+8,true)-BASE+n.key]:n.key;at=child+index*12;type=bytes[at];}const hardware=type&7;if(hardware){events.push({tick:n.tick,delta:1,hardware},{tick:n.tick+n.duration,delta:-1,hardware});}}
 const active=new Map();for(const e of events.sort((a,b)=>a.tick-b.tick||a.delta-b.delta)){const count=(active.get(e.hardware)||0)+e.delta;active.set(e.hardware,count);if(count>1)throw Error('PSG channel '+e.hardware+' has overlapping notes. Each hardware channel plays one note at a time.');}
}
export function compileMusic(score,{bankAsset=null,loop=true,name='New track'}={}){
 checkScore(score);const voices=availableVoices(bankAsset),allowed=new Set(voices.map(v=>v.program));if(score.tracks.some(t=>!allowed.has(t.program)))throw Error('Choose an available instrument for each part.');
 let base,bank;if(bankAsset){const unpacked=unpackMusic(bankAsset);base=unpacked.bytes;bank=new DataView(base.buffer).getUint32(bankAsset.header+4,true)-BASE;}else({bytes:base,bank}=chipBank());
 for(const t of score.tracks){const voice=voices.find(v=>v.program===t.program);if(voice?.keys&&t.notes.some(n=>!voice.keys.includes(n.key)))throw Error((t.name||'Part')+': this copied split or drum instrument does not include every requested key. Use notes from the source track, or choose another instrument.');}checkHardware(score,base,bank);
 const chunks=[],relocations=[];let length=(base.length+3)&~3;const append=b=>{const at=length;chunks.push({at,b:Uint8Array.from(b)});length=(length+b.length+3)&~3;return at;};
 const starts=score.tracks.map((track,index)=>{const data=[0xbc,0,0xbd,track.program],events=[];for(const p of automationFor(track))events.push({tick:p.tick,order:1,bytes:[0xc1,p.range,0xc0,p.bend+64,0xbe,p.volume,0xbf,p.pan]});const emitWait=ticks=>{while(ticks){let i=WAIT.length-1;while(WAIT[i]>ticks)i--;data.push(0x80+i);ticks-=WAIT[i];}};
  const loopStart=score.loopStart??0;let loopOffset=0;
  for(const n of track.notes){events.push({tick:n.tick,order:2,bytes:[0xcf,n.key,n.velocity]},{tick:n.tick+n.duration,order:0,bytes:[0xce,n.key]});if(loop&&n.tick<loopStart&&n.tick+n.duration>loopStart){events.push({tick:loopStart,order:0,bytes:[0xce,n.key]},{tick:loopStart,order:2,bytes:[0xcf,n.key,n.velocity]});}}
  if(index===0)for(const t of score.tempos)events.push({tick:t.tick,order:1,bytes:[0xbb,Math.round(t.bpm/2)]});
  if(loop&&loopStart){const p=automationFor(track).filter(p=>p.tick<=loopStart).at(-1),bpm=score.tempos.filter(t=>t.tick<=loopStart).at(-1).bpm;events.push({tick:loopStart,order:.5,marker:true,bytes:[0xbc,0,0xbd,track.program,0xc1,p.range,0xc0,p.bend+64,0xbe,p.volume,0xbf,p.pan,...(index===0?[0xbb,Math.round(bpm/2)]:[])]});}
  events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let tick=0;for(const e of events){emitWait(e.tick-tick);tick=e.tick;if(e.marker)loopOffset=data.length;data.push(...e.bytes);}emitWait(score.length-tick);const pointerAt=data.length+1;data.push(...(loop?[0xb2,0,0,0,0]:[0xb1]));const at=append(data);if(loop)relocations.push({at:at+pointerAt,to:at+loopOffset});return at;});
 const header=append(new Uint8Array(8+starts.length*4)),table=append(new Uint8Array(8)),bytes=new Uint8Array(length),v=new DataView(bytes.buffer);bytes.set(base);for(const c of chunks)bytes.set(c.b,c.at);bytes[header]=starts.length;v.setUint32(header+4,BASE+bank,true);starts.forEach((at,i)=>v.setUint32(header+8+i*4,BASE+at,true));v.setUint32(table,BASE+header,true);for(const r of relocations)v.setUint32(r.at,BASE+r.to,true);
 const asset=extractMusic(bytes,table,0,{name,sourceName:bankAsset?'Composed · '+bankAsset.sourceName:'Composed · original chip instruments'});asset.arrangement={version:1,score:structuredClone(score),loop};return asset;
}

/** Tempo/volume edits touch decoded command operands, never arbitrary bytes. */
export function remixMusic(asset,{tempo=100,volume=100,name=asset.name+' variation'}={}){
 integer(tempo,25,200,'tempo percentage');integer(volume,0,150,'volume percentage');const {song}=validateMusicAsset(asset),bytes=from64(asset.bytes),changed=new Set();for(const s of song.spans){if(s.cmd!==0xbb&&s.cmd!==0xbe)continue;const at=s.start+(s.explicit?1:0);if(changed.has(at))continue;changed.add(at);const old=bytes[at];bytes[at]=s.cmd===0xbb?Math.min(255,Math.max(5,Math.round(old*tempo/100))):Math.min(127,Math.round(old*volume/100));}if(tempo!==100&&!song.spans.some(s=>s.cmd===0xbb))throw Error('This track inherits its tempo. Import a track with an explicit tempo to make a portable tempo variation.');const result={...asset,name,bytes:bytes64(bytes),sourceHash:'',sourceName:asset.sourceName+' · variation'};delete result.sourceSongId;delete result.arrangement;validateMusicAsset(result);return result;
}
