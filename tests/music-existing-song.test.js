import test from 'node:test';
import assert from 'node:assert/strict';
import {composeSong} from '../dist/music-song.js';
import {compileMusic, checkScore} from '../dist/music-compose.js';
import {musicScore} from '../dist/music-motifs.js';
import {applyAftermathTreatment} from '../dist/music-aftermath-treatment.js';

test('Existing imported song can be rearranged, compiled, and reopened without changing the original', () => {
  // Synthesise a source track and compile it to the same standalone format as an extracted ROM track.
  // No copyrighted ROM or private user project is checked into CI.
  const imported = compileMusic(composeSong({mood:'Route', seed:71, introBars:0, verseBars:4, bridgeBars:4}));
  const originalBytes = imported.bytes;
  const source = musicScore(imported).score;
  const sourceCopy = structuredClone(source);
  const output = applyAftermathTreatment(source, {mode:'worn-strong', seed:71});
  assert.deepEqual(source, sourceCopy, 'rearranging must not mutate the imported score');
  assert.equal(imported.bytes, originalBytes, 'the source music asset remains untouched');
  assert.ok(output.tempos[0].bpm < source.tempos[0].bpm, 'slower tempo is applied');
  assert.deepEqual(output.tracks[0].notes.map(({tick,duration,key})=>({tick,duration,key})),
    source.tracks[0].notes.map(({tick,duration,key})=>({tick,duration,key})), 'lead retains its identity');
  assert.notDeepEqual(output.tracks.slice(1).map(t=>t.notes),source.tracks.slice(1).map(t=>t.notes),'accompaniment actually changes');
  checkScore(output);
  const exported=compileMusic(output);
  const reopened=musicScore(exported).score;
  assert.equal(reopened.tempos[0].bpm,output.tempos[0].bpm,'tempo survives export/reimport');
  assert.equal(reopened.tracks.length,output.tracks.length);
});

// This tests the core transform and round-trip, NOT the unimplemented acceptance
// requirement to click an existing ROM song and apply a full-song major-to-minor filter.
