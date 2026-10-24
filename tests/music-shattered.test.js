import test from 'node:test';
import assert from 'node:assert/strict';
import {composeSong} from '../dist/music-song.js';
import {checkScore,compileMusic} from '../dist/music-compose.js';
import {applyShatteredTreatment} from '../dist/music-shattered-treatment.js';

test('Shattered route treatment preserves the source lead while changing the arrangement',()=>{
 const source=composeSong({mood:'Route',seed:71,introBars:2,verseBars:8,bridgeBars:8});
 const before=structuredClone(source),out=applyShatteredTreatment(source,{mode:'shattered-route',seed:71});
 assert.deepEqual(out.tracks[0].notes,source.tracks[0].notes.map(n=>({...n,velocity:Math.round(n.velocity*(1-.12*.64))})), 'lead pitches and timing stay locked');
 assert.notDeepEqual(out.tracks.slice(1).map(t=>t.notes),source.tracks.slice(1).map(t=>t.notes));
 assert.ok(out.tempos[0].bpm<source.tempos[0].bpm);
 assert.deepEqual(source,before);
 checkScore(out);compileMusic(out);
});

test('Shattered treatment is reproducible and none is an immutable no-op',()=>{
 const source=composeSong({seed:12,introBars:1,verseBars:4,bridgeBars:4});
 assert.deepEqual(applyShatteredTreatment(source,{mode:'none',seed:9}),source);
 const a=applyShatteredTreatment(source,{mode:'shattered-strong',seed:99}),b=applyShatteredTreatment(source,{mode:'shattered-strong',seed:99});
 assert.deepEqual(a,b);assert.equal(a.composition.treatment.amount,.82);assert.equal(a.composition.treatment.preserved,'lead melody pitches and timing');checkScore(a);
});
