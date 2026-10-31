import test from 'node:test';
import assert from 'node:assert/strict';
import {composeMusic,compileMusic,checkScore,writeMIDI,readMIDI,remixMusic,availableVoices,MUSIC_MOODS,MUSIC_SCALES} from '../dist/music-compose.js';
import {validateMusicAsset,unpackMusic,from64} from '../dist/music-assets.js';
import {renderMusic} from '../dist/music-preview.js';

test('every mood compiles a portable native song; generation is reproducible and bounded',()=>{
 for(const mood of Object.keys(MUSIC_MOODS)){const score=composeMusic({mood,seed:12,bars:4,complexity:100,adventure:100}),asset=compileMusic(score),checked=validateMusicAsset(asset);assert.deepEqual(score,composeMusic({mood,seed:12,bars:4,complexity:100,adventure:100}));assert.equal(checked.song.trackCount,4);assert.ok(checked.deps.samples.length>=Math.min(4,score.tracks.filter(t=>t.notes.length).length)); // Percussion-free moods need no unused drum sample.
assert.equal(asset.sourceHash,'');assert.ok(asset.sourceBytes<10000);assert.ok(checkScore(score).peak<=4);}
 assert.notDeepEqual(composeMusic({seed:1}),composeMusic({seed:2}));
});
test('MIDI round-trip preserves notes, velocities, sustain lengths and a changing tempo',()=>{
 const original=composeMusic({bars:4});original.tempos.push({tick:192,bpm:88});const decoded=readMIDI(writeMIDI(original));assert.deepEqual(decoded.score.tempos,original.tempos);assert.equal(decoded.score.length,original.length);decoded.score.tracks.forEach((tr,i)=>assert.deepEqual(tr.notes.sort((a,b)=>a.tick-b.tick||a.key-b.key),original.tracks[i].notes.sort((a,b)=>a.tick-b.tick||a.key-b.key)));assert.ok(decoded.warnings.some(s=>s.includes('quantized')));
});
test('MIDI supports running status, sustain and bends; rejects corrupt files and SMPTE',()=>{
 const midi=events=>Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,0,24,77,84,114,107,0,0,0,events.length,...events]);
 const good=midi([0,0x90,60,100,12,0xb0,64,127,12,0x90,60,0,12,0xb0,64,0,0,255,47,0]);assert.equal(readMIDI(good).score.tracks[0].notes[0].duration,36);
 const running=midi([0,0x90,60,100,12,62,90,12,60,0,12,62,0,0,255,47,0]);assert.equal(readMIDI(running).score.tracks[0].notes.length,2);
 assert.throws(()=>readMIDI(good.slice(0,-1)),/Truncated/);const smpte=good.slice();smpte[12]=0x80;assert.throws(()=>readMIDI(smpte),/SMPTE/);const bent=readMIDI(midi([0,0x90,60,100,12,0xe0,0,96,12,0x80,60,0,0,255,47,0]));assert.equal(bent.score.tracks[0].automation.at(-1).bend,32);const held=readMIDI(midi([0,0x90,60,100,24,255,47,0]));assert.equal(held.score.tracks[0].notes[0].duration,24);assert.ok(held.warnings.some(s=>s.includes('Unreleased')));
});
test('voice budget and same-pitch overlaps fail before native compilation',()=>{
 const score={ppq:24,length:96,tempos:[{tick:0,bpm:120}],tracks:[{program:0,notes:Array.from({length:9},(_,i)=>({tick:0,duration:24,key:60+i,velocity:90}))}]};assert.throws(()=>compileMusic(score),/eight/);score.tracks[0].notes=[{tick:0,duration:24,key:60,velocity:90},{tick:12,duration:24,key:60,velocity:90}];assert.throws(()=>checkScore(score),/Overlapping/);
});
test('copied instrument banks retain only used samples and produce audible finite PCM',()=>{
 const source=compileMusic(composeMusic({bars:4})),before=structuredClone(source),score=composeMusic({bars:4,mood:'Chill'});score.tracks.forEach(t=>t.program=0);const copied=compileMusic(score,{bankAsset:source,loop:false}),checked=validateMusicAsset(copied);assert.equal(checked.deps.samples.length,1);assert.equal(checked.song.commands[0xb2],undefined);assert.equal(availableVoices(copied).length,1);assert.deepEqual(source,before);const sound=renderMusic(copied,{seconds:1,sampleRate:11025});assert.ok(sound.pcm.every(Number.isFinite));assert.ok(sound.pcm.some(v=>Math.abs(v)>.001));
});
test('tempo variations retain motifs and relocate as new music instead of reusing a source song',()=>{
 const source={...compileMusic(composeMusic({bars:4})),sourceHash:'same-source',sourceSongId:300},before=structuredClone(source),variant=remixMusic(source,{tempo:75,volume:50}),a=from64(source.bytes),b=from64(variant.bytes),{song}=validateMusicAsset(source),edits=new Set(song.spans.filter(s=>s.cmd===0xbb||s.cmd===0xbe).map(s=>s.start+(s.explicit?1:0)));assert.equal(variant.sourceHash,'');assert.equal(variant.sourceSongId,undefined);assert.deepEqual(source,before);for(let i=0;i<a.length;i++)if(!edits.has(i))assert.equal(a[i],b[i]);const unpacked=unpackMusic(variant);assert.ok(unpacked.bytes.length);assert.ok([...edits].some(i=>a[i]!==b[i]));
});

test('adjacent seeds change musical structure in every part, even with experimentation off',()=>{
 const rhythm=track=>JSON.stringify(track.notes.map(n=>n.tick));
 const structure=track=>JSON.stringify(track.notes.map(n=>[n.tick,n.duration,n.key]));
 for(const complexity of [0,45,100]){
  const scores=Array.from({length:16},(_,seed)=>composeMusic({seed,complexity,adventure:0}));
  // Ignore velocities: volume jitter alone does not count as a new song.
  assert.equal(new Set(scores.map(s=>structure(s.tracks[0]))).size,16);
  assert.ok(new Set(scores.map(s=>rhythm(s.tracks[0]))).size>=10);
  for(const part of [1,2,3])assert.ok(new Set(scores.map(s=>rhythm(s.tracks[part]))).size>=3);
  for(const part of [1,2])assert.ok(new Set(scores.map(s=>structure(s.tracks[part]))).size>=10);
 }
});
test('mood scales and key/seed boundaries stay in tune and within native voice limits',()=>{
 for(const mood of Object.keys(MUSIC_MOODS))for(const key of [0,11])for(const seed of [0,1,2,0xfffffffe,0xffffffff])for(const complexity of [0,100]){
  const options={mood,key,seed,complexity,adventure:0,bars:8},score=composeMusic(options);
  assert.deepEqual(score,composeMusic(options));assert.ok(checkScore(score).peak<=4);
  const steps=MUSIC_SCALES[MUSIC_MOODS[mood].scale];
  for(const track of score.tracks.slice(0,3))for(const note of track.notes)assert.ok(steps.includes((note.key-key+120)%12));
  // Hardware instruments must remain monophonic after denser rhythmic choices.
  score.tracks.forEach((t,i)=>t.program=i+4);compileMusic(score);
 }
});
