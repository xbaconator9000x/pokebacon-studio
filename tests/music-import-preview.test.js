import test from 'node:test';import assert from 'node:assert/strict';
import {readMIDI,writeMIDI,compileMusic} from '../dist/music-compose.js';
import {automationFor} from '../dist/music-controls.js';
import {musicScore,composeFromReferences} from '../dist/music-motifs.js';
import {arrangeSections} from '../dist/music-arrange.js';
import {renderMusic} from '../dist/music-preview.js';
import {from64,bytes64,validateMusicAsset,extractMusic} from '../dist/music-assets.js';
import {describeSong,improvedLibraryName} from '../dist/music-names.js';
const score=(program=4)=>({ppq:24,length:96,tempos:[{tick:0,bpm:120}],tracks:[{name:'Lead',program,notes:[{tick:0,duration:48,key:60,velocity:100},{tick:48,duration:48,key:72,velocity:100}]}]});
const chunk=(tag,bytes)=>[...new TextEncoder().encode(tag),bytes.length>>>24&255,bytes.length>>>16&255,bytes.length>>>8&255,bytes.length&255,...bytes];
const midi=tracks=>Uint8Array.from([...chunk('MThd',[0,1,0,tracks.length,0,24]),...tracks.flatMap(t=>chunk('MTrk',t))]);
const crossings=(pcm,from,to,rate)=>{let n=0;for(let i=Math.floor(from*rate)+1;i<Math.floor(to*rate);i++)if(pcm[(i-1)*2]<=0&&pcm[i*2]>0)n++;return n;};
function fixed(asset){const {song}=validateMusicAsset(asset),b=from64(asset.bytes);b[song.bank+asset.arrangement.score.tracks[0].program*12]|=8;return{...asset,bytes:bytes64(b)};}

test('MIDI retains named file parts sharing a channel and closes notes at their own end',()=>{
 const name=s=>[0,255,3,s.length,...new TextEncoder().encode(s)];
 const result=readMIDI(midi([[...name('Melody'),0,0x90,60,100,24,0x80,60,0,0,255,47,0],[...name('Bass'),0,0x90,48,90,48,255,47,0]]));
 assert.deepEqual(result.score.tracks.map(t=>[t.name,t.notes[0].key,t.notes[0].duration]),[['Melody',60,24],['Bass',48,48]]);
 assert.ok(result.warnings.some(s=>s.includes('Unreleased')));
});
test('MIDI bends, range, volume and pan survive MIDI/native round trips and section reordering',()=>{
 const original=score(0);original.tracks[0].automation=[{tick:0,bend:0,range:12,volume:100,pan:20},{tick:24,bend:32,range:12,volume:50,pan:100},{tick:72,bend:-32,range:2,volume:90,pan:64}];
 const imported=readMIDI(writeMIDI(original)).score;assert.deepEqual(automationFor(imported.tracks[0]),automationFor(original.tracks[0]));assert.equal(imported.tracks[0].name,'Lead');
 const native=compileMusic(imported),decoded=musicScore({...native,arrangement:undefined}).score;assert.deepEqual(automationFor(decoded.tracks[0]),automationFor(original.tracks[0]));
 const arranged=arrangeSections(imported,[{from:24,to:72,repeat:2}]);assert.deepEqual(automationFor(arranged.tracks[0]),[{tick:0,bend:32,range:12,volume:50,pan:100}]);
 const altered=structuredClone(native);altered.arrangement.score.tracks[0].automation[1].bend=10;assert.ok(musicScore(altered).warnings.some(s=>s.includes('differs')));
});
test('MIDI keeps overlapping equal pitches in separate parts and supports RIFF wrappers',()=>{
 const original=midi([[0,0x90,60,100,12,0x90,60,90,12,0x80,60,0,12,0x80,60,0,0,255,47,0]]),a=readMIDI(original);assert.equal(a.score.tracks.length,2);assert.equal(a.score.tracks.flatMap(t=>t.notes).length,2);
 const data=Uint8Array.from(chunk('data',original)),riff=new Uint8Array(12+data.length);riff.set(new TextEncoder().encode('RIFF'));new DataView(riff.buffer).setUint32(4,riff.length-8,true);riff.set(new TextEncoder().encode('RMID'),8);riff.set(data,12);new DataView(riff.buffer).setUint32(16,original.length,true);
 assert.deepEqual(readMIDI(riff).score,a.score);assert.throws(()=>readMIDI(riff.slice(0,-1)),/Invalid|Truncated/);
});
test('fixed PSG follows note pitch and held notes respond to bend/volume changes',()=>{
 const asset=fixed(compileMusic(score())),rendered=renderMusic(asset,{seconds:2,sampleRate:22050}),a=crossings(rendered.pcm,.2,.8,22050),b=crossings(rendered.pcm,1.2,1.8,22050);assert.ok(b/a>1.9&&b/a<2.1,`${a}, ${b}`);
 const held=score();held.tracks[0].notes=[{tick:0,duration:96,key:60,velocity:100}];held.tracks[0].automation=[{tick:0,range:12},{tick:48,bend:63},{tick:72,volume:0}];const sound=renderMusic(compileMusic(held),{seconds:2,sampleRate:22050});assert.ok(crossings(sound.pcm,1.1,1.4,22050)>crossings(sound.pcm,.1,.4,22050)*1.8);assert.ok(sound.pcm.slice(Math.ceil(1.6*22050)*2).every(n=>Math.abs(n)<1e-6));
});
test('fixed-rate PCM follows mixer rate independently of note pitch or sample tuning',()=>{
 const asset=fixed(compileMusic(score(0))),s=renderMusic(asset,{seconds:2,sampleRate:22050,mixerRate:12000}),a=crossings(s.pcm,.2,.8,22050),b=crossings(s.pcm,1.2,1.8,22050);assert.ok(a>80&&a<150,`fixed PCM crossings ${a}`);assert.ok(Math.abs(a-b)<3,`${a}, ${b}`);
});
test('ROM names use verified source titles, preserve custom names and avoid guessing hack song IDs',()=>{
 const hash='3d0c79f1627022e18765766f6cb5ea067f6b5bf7dca115552189ad65a5c3a8ac',table=4862668,b=new Uint8Array(table+347*8),v=new DataView(b.buffer);for(const id of [1,280,300,340])v.setUint32(table+id*8,0x08000400,true);b[0x400]=6;
 assert.equal(describeSong(b,table,280,{hash}).name,'Lavender Town');assert.equal(describeSong(b,table,300,{hash}).name,'Pallet Town');assert.equal(describeSong(b,table,340,{hash}).name,'Battle — Mewtwo');
 assert.equal(describeSong(b,table,340,{hash:'different',usage:new Map([[340,['Ruined city']]])}).name,'Ruined city');assert.match(describeSong(b,table,340).name,/Theme #340/);
 assert.equal(improvedLibraryName({name:'Track 340',asset:{sourceSongId:340,sourceTable:table,sourceHash:hash}}),'Battle — Mewtwo');assert.equal(improvedLibraryName({name:'My theme',asset:{sourceSongId:340,sourceTable:table,sourceHash:hash}}),null);
});
test('reference composition isolates the chosen source part',()=>{
 const a=score(0);a.tracks.push({...a.tracks[0],notes:a.tracks[0].notes.map(n=>({...n,key:n.key-24}))});const before=structuredClone(a),settings={bars:4,influence:100,seed:19,mode:'inspired',track:1,start:0,end:96},first=composeFromReferences([a],settings);a.tracks[0].notes.forEach(n=>n.key=100);assert.deepEqual(composeFromReferences([a],settings),first);assert.notDeepEqual(composeFromReferences([before],{...settings,track:0}),first);
});

test('overlapping native split banks retain shared instrument rows through extraction',()=>{
 const b=new Uint8Array(0x4000),v=new DataView(b.buffer),ptr=(at,to)=>v.setUint32(at,0x08000000+to,true),root=0x400,a=0x1000,c=a+24;
 for(const [i,bank,map]of [[0,a,0x1800],[1,c,0x1880]]){const at=root+i*12;b[at]=64;ptr(at+4,bank);ptr(at+8,map);b[map+60]=i?3:5;b[map+62]=4;}
 for(const index of [4,5]){const at=a+index*12;b[at+1]=60;ptr(at+4,0x2000);b.set([255,0,220,180],at+8);}
 v.setUint32(0x2004,12000*1024,true);v.setUint32(0x200c,64,true);for(let i=0;i<64;i++)b[0x2010+i]=Math.round(100*Math.sin(i/64*Math.PI*2))&255;
 b[0x3000]=1;ptr(0x3004,root);ptr(0x3008,0x3100);ptr(0x3200,0x3000);
 b.set([0xbb,60,0xbd,0,0xcd,8,64,0xcd,9,1,0xd0,60,100,0x81,0xd0,62,100,0x81,0xbd,1,0xd0,60,100,0x81,0xb1],0x3100);
 const asset=extractMusic(b,0x3200,0),decoded=musicScore(asset);assert.deepEqual(decoded.score.tracks[0].notes.map(n=>n.key),[60,62,60]);assert.ok(decoded.warnings.some(s=>s.includes('imitation-echo')));assert.equal(validateMusicAsset(asset).deps.samples.length,1);assert.ok(renderMusic(asset,{seconds:1}).pcm.some(v=>Math.abs(v)>.001));
});
test('long MIDI arrangements export in full up to the bounded 512-bar limit',()=>{
 const long=score(0);long.length=166*96;const asset=compileMusic(long);assert.equal(musicScore({...asset,arrangement:undefined}).score.length,long.length);assert.equal(readMIDI(writeMIDI(long)).score.length,long.length);long.length=513*96;assert.throws(()=>compileMusic(long),/512 bars/);
});
