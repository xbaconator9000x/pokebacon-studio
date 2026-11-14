import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readMIDI,writeMIDI,compileMusic,checkScore,availableVoices} from '../dist/music-compose.js';
import {validateMusicAsset} from '../dist/music-assets.js';
import {musicScore} from '../dist/music-motifs.js';
import {studioProgramForMIDI,selectNativeInstrument,varyMusicParts} from '../dist/music-part-options.js';
import {composeSong} from '../dist/music-song.js';
import {styleTrackBase} from '../dist/music-track-style.js';
import {quickTrackSettings} from '../dist/music-quick-presets.js';
function score(parts=24,overlap=false){
 const tracks=Array.from({length:parts},(_,i)=>({
  name:i%7===0?'Lead '+i:'Instrument '+i,midiProgram:i*5%128,
  program:studioProgramForMIDI({midiProgram:i*5%128}),
  notes:[{tick:overlap?0:i*24,duration:12,key:48+i%24,velocity:75+i%20}],
  automation:[{tick:0,volume:90+i%20,pan:40+i%60,bend:0,range:2}]
 }));
 return{ppq:24,length:overlap?96:parts*24+24,tempos:[{tick:0,bpm:132}],tracks};
}
test('24 distinct MIDI parts save to a native ten-lane soundtrack without dropping their editable source',()=>{
 const original=score(24),before=structuredClone(original),asset=compileMusic(original,{autoFit:true,loop:false,name:'Multi-part MIDI'});
 const checked=validateMusicAsset(asset),decoded=musicScore(asset);
 assert.ok(checked.song.trackCount<=10);
 assert.equal(decoded.score.tracks.length,24);
 assert.deepEqual(decoded.score,original);
 assert.deepEqual(original,before);
 assert.ok(asset.arrangement.sourceScore);
 assert.equal(asset.arrangement.score.tracks.flatMap(t=>t.notes).length,24);
 const native=musicScore({...asset,arrangement:undefined});
 assert.equal(native.score.tracks.flatMap(t=>t.notes).length,24);
 const used=new Set(native.score.tracks.flatMap(t=>t.notes.map(n=>n.program)));
 assert.ok(used.size>=3,'VOICE changes preserve multiple instruments in interleaved lanes');
 assert.ok(decoded.warnings.some(w=>/parts remain editable|original/i.test(w)));
});
test('dense 24-part MIDI retains all source notes while reporting native voice fitting',()=>{
 const original=score(24,true);
 assert.throws(()=>compileMusic(original),/eight|simultaneous|ROM player|track/i);
 const asset=compileMusic(original,{autoFit:true,loop:false});
 assert.ok(asset.trackCount<=10);
 assert.equal(musicScore(asset).score.tracks.length,24);
 assert.equal(musicScore(asset).score.tracks.flatMap(t=>t.notes).length,24);
 assert.ok(asset.arrangement.playbackNotice.includes('voice gates'));
 assert.ok(asset.arrangement.score.tracks.flatMap(t=>t.notes).length<=8);
});
test('MIDI write/import retains more than ten named file tracks, editable channels and auto GM voices',()=>{
 const original=score(24),bytes=writeMIDI(original),parsed=readMIDI(bytes);
 assert.equal(parsed.score.tracks.length,24);
 assert.equal(parsed.score.tracks.reduce((s,t)=>s+t.notes.length,0),24);
 assert.equal(studioProgramForMIDI({channel:9,midiProgram:11}),3);
 assert.equal(studioProgramForMIDI({midiProgram:35}),21);
 assert.equal(studioProgramForMIDI({midiProgram:48}),9);
 assert.equal(studioProgramForMIDI({midiProgram:73}),14);
 const voices=availableVoices(),track={name:'Woodwind',midiProgram:73,notes:[{tick:0,duration:8,key:70,velocity:100}]};
 assert.equal(selectNativeInstrument(track,voices),14);
 assert.equal(selectNativeInstrument({program:4,sourceProgram:20,notes:track.notes},voices,{sourceBank:true}),20);
});
test('more/less control preserves base count at neutral and adds or reduces source-derived layers deterministically',()=>{
 const original=composeSong(quickTrackSettings('sunny-route',{seed:91}));
 assert.equal(original.tracks.length,6);
 const standard=varyMusicParts(original,{delta:0,seed:19});
 assert.equal(standard.score.tracks.length,6);
 assert.deepEqual(original.tracks,standard.score.tracks);
 const less=varyMusicParts(original,{delta:-2,seed:19});
 assert.equal(less.score.tracks.length,4);
 const more=varyMusicParts(original,{delta:2,seed:19});
 assert.ok(more.score.tracks.length>6);
 assert.deepEqual(more,varyMusicParts(original,{delta:2,seed:19}));
 assert.deepEqual(original,composeSong(quickTrackSettings('sunny-route',{seed:91})),'input is not mutated');
 assert.doesNotThrow(()=>compileMusic(more.score,{autoFit:true}));
});
test('both Android music screens offer relative instrument sliders and automatic GM mapping',()=>{
 const quick=readFileSync(new URL('../dist/music-quick-ui.js',import.meta.url),'utf8');
 const compose=readFileSync(new URL('../dist/music-compose-ui.js',import.meta.url),'utf8');
 assert.match(quick,/id="quickLayers"/);
 assert.match(quick,/varyMusicParts\(score/);
 assert.match(quick,/autoFit:true/);
 assert.match(compose,/id="composeLayers"/);
 assert.match(compose,/selectNativeInstrument\(t,voices/);
 assert.match(compose,/varyMusicParts\(score/);
 assert.match(compose,/autoFit:true/);
});

test('source-based Quick Track keeps all original MIDI notes until native export, even at 24 concurrent parts',()=>{
 const source=score(24,true),original=structuredClone(source);
 const arranged=styleTrackBase(source,{preset:'sunny-route',scope:'whole',melodyPart:0,targetScale:'original'}).score;
 assert.equal(arranged.tracks.length,24);
 assert.equal(arranged.tracks.reduce((n,t)=>n+t.notes.length,0),24);
 const compiled=compileMusic(arranged,{autoFit:true});
 assert.ok(compiled.trackCount<=10);
 assert.equal(compiled.arrangement.sourceScore.tracks.length,24);
 assert.equal(compiled.arrangement.sourceScore.tracks.reduce((n,t)=>n+t.notes.length,0),24);
 assert.deepEqual(source,original);
});
test('MIDI export puts reused-channel instrument changes at each part’s first note',()=>{
 const original=score(24);
 const recovered=readMIDI(writeMIDI(original)).score;
 assert.deepEqual(recovered.tracks.map(t=>t.midiProgram),original.tracks.map(t=>t.midiProgram));
});
