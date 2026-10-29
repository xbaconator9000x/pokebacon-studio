import test from 'node:test';import assert from 'node:assert/strict';
import {styleTrackBase} from '../dist/music-track-style.js';
import {compileMusic,checkScore} from '../dist/music-compose.js';
const source=()=>({ppq:24,length:384,loopStart:96,tempos:[{tick:0,bpm:120}],composition:{settings:{key:0,scale:'Major'}},tracks:[{name:'Melody',program:17,notes:[{tick:0,duration:36,key:72,velocity:90},{tick:48,duration:36,key:76,velocity:90},{tick:96,duration:36,key:79,velocity:90}]},{name:'Bass',program:21,notes:[{tick:0,duration:80,key:36,velocity:80},{tick:96,duration:80,key:43,velocity:80}]},{name:'Drums',channel:9,program:3,notes:[{tick:0,duration:3,key:36,velocity:80},{tick:96,duration:3,key:38,velocity:80}]}]});
const sig=t=>t.notes.map(n=>[n.tick,n.duration,n.key]);
test('whole song uses every source part; selected and single modes are distinct and immutable',()=>{
 const s=source(),before=structuredClone(s),o={preset:'sunny-route',targetScale:'original',percussionPrograms:[3]};
 const whole=styleTrackBase(s,o).score;assert.deepEqual(whole.composition.baseTrack.sourceParts,[0,1,2]);whole.tracks.forEach((t,i)=>assert.deepEqual(sig(t),sig(s.tracks[i])));
 const selected=styleTrackBase(s,{...o,scope:'selected',selectedParts:[0,2]}).score;assert.deepEqual(selected.composition.baseTrack.sourceParts,[0,2]);assert.equal(selected.tracks.length,2);
 const single=styleTrackBase(s,{...o,scope:'single'}).score;assert.equal(single.tracks.length,6);assert.equal(single.composition.baseTrack.scope,'single');assert.deepEqual(s,before);assert.ok(compileMusic(whole).bytes.length);
 assert.throws(()=>styleTrackBase(s,{...o,scope:'selected',selectedParts:[]}),/Select/);
});
test('key and minor scale conversion affects all pitched parts and leaves percussion unchanged',()=>{
 const s=source(),out=styleTrackBase(s,{preset:'sunny-route',targetKey:2,targetScale:'Natural minor',percussionPrograms:[3]}).score;
 assert.deepEqual(out.tracks[0].notes.map(n=>n.key),[74,77,81]);assert.equal(out.tracks[1].notes[0].key,38);assert.deepEqual(sig(out.tracks[2]),sig(s.tracks[2]));assert.equal(out.composition.settings.key,2);assert.equal(out.composition.settings.scale,'Natural minor');
 for(const scale of ['Natural minor','Harmonic minor','Melodic minor','Dorian','Phrygian'])for(let key=0;key<12;key++){const score=styleTrackBase(s,{preset:'wrath',targetKey:key,targetScale:scale,percussionPrograms:[3]}).score;checkScore(score);compileMusic(score);}
});
