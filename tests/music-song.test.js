import test from 'node:test';import assert from 'node:assert/strict';
import {composeSong,scoreSeconds} from '../dist/music-song.js';
import {checkScore,compileMusic,writeMIDI,readMIDI,MUSIC_SCALES,MUSIC_MOODS} from '../dist/music-compose.js';
import {musicScore,composeFromReference} from '../dist/music-motifs.js';

const relative=(score,part,from,to)=>score.tracks[part].notes.filter(n=>n.tick>=from&&n.tick<to).map(n=>({...n,tick:n.tick-from}));
test('full song has an optional once-only intro and a repeating groove / developing bridge',()=>{
 const opts={introBars:4,verseBars:16,bridgeBars:16,seed:13},s=composeSong(opts);assert.equal(s.length,36*96);assert.equal(s.loopStart,4*96);assert.deepEqual(s.songSections.map(v=>[v.kind,v.start,v.length]),[['intro',0,384],['verse',384,1536],['bridge',1920,1536]]);assert.deepEqual(s,composeSong(opts));
 assert.deepEqual(relative(s,0,384,1152),relative(s,0,1152,1920));
 const bars=Array.from({length:16},(_,bar)=>JSON.stringify(relative(s,0,1920+bar*96,2016+bar*96)));assert.ok(new Set(bars).size>=12);assert.notDeepEqual(relative(s,0,384,1152),relative(s,0,1920,2688));assert.equal(composeSong({introBars:0,verseBars:3,bridgeBars:5}).length,8*96);assert.throws(()=>composeSong({bridgeBars:0}),/bridge/);assert.ok(checkScore(s).peak<=4);
});
test('native branch and MIDI marker preserve the intro boundary on every part',()=>{
 const score=composeSong({introBars:3,verseBars:9,bridgeBars:7}),asset=compileMusic(score),plain=structuredClone(asset);delete plain.arrangement;const decoded=musicScore(plain).score;assert.equal(decoded.length,score.length);assert.equal(decoded.loopStart,score.loopStart);for(const t of decoded.tracks)assert.equal(t.loopStart,score.loopStart);assert.equal(readMIDI(writeMIDI(score)).score.loopStart,score.loopStart);assert.deepEqual(musicScore(asset).score,score);assert.equal(musicScore(compileMusic(score,{loop:false})).score.loopStart,undefined);assert.ok(scoreSeconds(score)>20);
});
test('all bridge moods and keys stay in their scale with gentle intervals and reproducible variation',()=>{
 for(const mood of Object.keys(MUSIC_MOODS))for(const key of [0,11]){const s=composeSong({mood,key,seed:0xffffffff,introBars:0,verseBars:1,bridgeBars:12}),notes=relative(s,0,96,s.length),steps=MUSIC_SCALES[MUSIC_MOODS[mood].scale];assert.ok(notes.every(n=>steps.includes((n.key-key+120)%12)));assert.ok(checkScore(s).peak<=4);compileMusic(s);}
 assert.notDeepEqual(composeSong({seed:0}).tracks,composeSong({seed:1}).tracks);
});
test('reference range governs inspiration and locks the groove while the bridge develops',()=>{
 const source=composeSong({introBars:0,verseBars:8,bridgeBars:8}),other=structuredClone(source);for(const n of other.tracks[0].notes)if(n.tick>=96)n.key=40;
 const opts={start:0,end:96,track:0,bars:4,influence:90,seed:2};assert.deepEqual(composeFromReference(source,opts),composeFromReference(other,opts));const song=composeSong({...opts,introBars:0,verseBars:8,bridgeBars:8,mode:'motif'},o=>composeFromReference(source,o));const first=relative(song,0,0,96);assert.deepEqual(first,relative(song,0,96,192));assert.notDeepEqual(first,relative(song,0,768,864));
});
