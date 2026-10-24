import test from 'node:test';
import assert from 'node:assert/strict';
import {musicScore,findMotifs,composeFromReference,composeFromReferences} from '../dist/music-motifs.js';
import {composeMusic,compileMusic,checkScore} from '../dist/music-compose.js';
const phrase=(at,shift=0)=>[60,64,67,62].map((key,i)=>({tick:at+i*12,duration:10,key:key+shift,velocity:90}));
const source=()=>({ppq:24,length:192,tempos:[{tick:0,bpm:120}],tracks:[{name:'Theme',program:0,notes:[...phrase(0),...phrase(96,2)]}]});
test('motifs distinguish exact pitch matches, transpositions and rhythm-only matches',()=>{
 const score=source(),before=structuredClone(score),transposed=findMotifs(score);assert.equal(transposed.length,1);assert.deepEqual(transposed[0].occurrences.map(o=>o.start),[0,96]);assert.equal(findMotifs(score,{match:'exact'}).length,0);assert.ok(findMotifs(score,{match:'rhythm'}).length);assert.deepEqual(score,before);score.tracks[0].notes=phrase(0).concat(phrase(96));assert.equal(findMotifs(score,{match:'exact'}).length,1);
});
test('native sequence decoding retains one whole loop, pitches, velocities and note releases',()=>{
 const original=composeMusic({bars:4}),asset=compileMusic(original);delete asset.arrangement;const decoded=musicScore(asset);assert.equal(decoded.score.length,384);for(let tr=0;tr<4;tr++){const fields=n=>({tick:n.tick,duration:n.duration,key:n.key,velocity:n.velocity});assert.deepEqual(decoded.score.tracks[tr].notes.map(fields),original.tracks[tr].notes.map(fields));}assert.ok(findMotifs(decoded.score).length);
});
test('pitch and rhythm locks copy exactly the selected melody line and leave source unchanged',()=>{
 const ref=source(),before=structuredClone(ref),result=composeFromReference(ref,{mode:'motif',track:0,start:0,end:48,bars:4,mood:'Solemn',key:1,scale:'Natural minor',lockPitch:true,lockRhythm:true});assert.deepEqual(result.tracks[0].notes.slice(0,4),phrase(0));assert.deepEqual(result.tracks[0].notes.slice(4,8),phrase(48));assert.deepEqual(ref,before);assert.ok(checkScore(result).peak<=8);assert.throws(()=>composeFromReference(ref,{mode:'motif',start:48,end:90}),/contains no notes/);
});
test('inspired mode produces reproducible fresh phrases, responds to influence and seed',()=>{
 const ref=source(),options={bars:4,mode:'inspired',seed:11,influence:90},a=composeFromReference(ref,options),b=composeFromReference(ref,options);assert.deepEqual(a,b);assert.notDeepEqual(a.tracks[0].notes,ref.tracks[0].notes);assert.notDeepEqual(a,composeFromReference(ref,{...options,seed:12}));assert.notDeepEqual(a,composeFromReference(ref,{...options,influence:0}));assert.ok(compileMusic(a).sourceBytes<10000);
});
test('motif search rejects invalid matching options and caps output',()=>{
 assert.throws(()=>findMotifs(source(),{match:'bogus'}),/Unknown/);assert.throws(()=>findMotifs(source(),{minNotes:0}),/four/);assert.ok(findMotifs(composeMusic({bars:32}),{maxResults:3}).length<=3);
});
test('multiple references blend fresh phrase statistics while motif locks use the primary source',()=>{const a=source(),b=composeMusic({mood:'Spooky',key:3,bars:4}),options={bars:4,seed:33,influence:95};assert.notDeepEqual(composeFromReferences([a,b],options),composeFromReferences([a],options));const locked=composeFromReferences([a,b],{...options,mode:'motif',start:0,end:48});assert.deepEqual(locked.tracks[0].notes.slice(0,4),phrase(0));assert.throws(()=>composeFromReferences([],options),/one to four/);});
test('stale arrangement metadata never overrides the decoded ROM notes',()=>{const a=compileMusic(composeMusic({bars:4})),first=a.arrangement.score.tracks[0].notes[0].key;a.arrangement.score.tracks[0].notes[0].key=first+1;const decoded=musicScore(a);assert.equal(decoded.score.tracks[0].notes[0].key,first);assert.ok(decoded.warnings.some(s=>s.includes('differs')));});

test('a locked motif stays exact while adjacent seeds replace the accompaniment',()=>{
 const reference=composeMusic({bars:4,seed:99}),options={mode:'motif',start:0,end:96,bars:4,lockPitch:true,lockRhythm:true};
 const a=composeFromReference(reference,{...options,seed:0}),b=composeFromReference(reference,{...options,seed:1});
 assert.deepEqual(a.tracks[0].notes,b.tracks[0].notes);
 for(const part of [1,2,3])assert.notDeepEqual(a.tracks[part].notes.map(n=>[n.tick,n.duration,n.key]),b.tracks[part].notes.map(n=>[n.tick,n.duration,n.key]));
 const inspired=seed=>composeFromReference(reference,{mode:'inspired',bars:4,influence:100,seed});
 assert.notDeepEqual(inspired(0).tracks[0].notes,inspired(1).tracks[0].notes);
 assert.deepEqual(inspired(0),inspired(0));
});
