import {composeSong} from '../dist/music-song.js';
import assert from 'node:assert/strict';
import {session} from './qa-harness.mjs';
import {musicComposer} from '../dist/music-compose-ui.js';
import {referenceComposer} from '../dist/music-reference-ui.js';
import {composeMusic,compileMusic} from '../dist/music-compose.js';
const sessionUI=await session({},true),{$,w}=sessionUI;globalThis.document=w.document;const played=[];
const api={esc:String,tracks:()=>[],modal(title,html){$('#dialogBody').innerHTML=html;},play:async asset=>played.push(asset),stop(){},add(){},openLibrary(){},toast(){},arrange(){}};
try{
 musicComposer(api).open();await $('#composeVariation').onclick();assert.equal($('#composeSeed').value,'2');assert.equal(played.length,1);assert.deepEqual(played[0].arrangement.score,composeSong({seed:2}));
 await $('#composeVariation').onclick();assert.equal(played.length,2);assert.notDeepEqual(played[0].arrangement.score.tracks,played[1].arrangement.score.tracks);
 const score=composeMusic({bars:4}),source={id:'source',name:'Source',asset:compileMusic(score)};
 referenceComposer(api,source,score,{track:0,start:0,end:96});$('#referenceEngine').value='phrase';$('#referenceMode').value='motif';$('#referenceSeed').value='4294967295';await $('#referenceNext').onclick();assert.equal($('#referenceSeed').value,'0');assert.equal(played.length,3);await $('#referenceNext').onclick();assert.equal(played.length,4);
 const locked=s=>s.composition.motif.placements.map(p=>s.tracks[0].notes.filter(n=>n.tick>=p.start&&n.tick<p.end));assert.deepEqual(locked(played[2].arrangement.score),locked(played[3].arrangement.score));assert.notDeepEqual(played[2].arrangement.score.tracks[0].notes,played[3].arrangement.score.tracks[0].notes);assert.notDeepEqual(played[2].arrangement.score.tracks[1].notes,played[3].arrangement.score.tracks[1].notes);
 console.log('PASS next variation previews the new seed immediately; wraparound and locked motifs retain correct behavior');
}finally{await sessionUI.close();}
