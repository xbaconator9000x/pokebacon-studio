// Optional end-to-end test against a locally supplied FireRed-compatible ROM.
// Uses the shipped checkpoint workers; no model responses are stubbed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {neuralQAWorker} from './neural-qa-runtime.mjs';
import {neuralComposer} from '../dist/music-neural.js';
import {extractMusic} from '../dist/music-assets.js';
import {musicScore} from '../dist/music-motifs.js';
import {availableVoices,compileMusic} from '../dist/music-compose.js';
import {styleTrackBase,suggestMelodyPart} from '../dist/music-track-style.js';
import {developTrackArrangement} from '../dist/music-track-development.js';
import {applyAftermathTreatment} from '../dist/music-aftermath-treatment.js';
import {fitQuickBank} from '../dist/music-quick-bank.js';
import {renderMusic} from '../dist/music-preview.js';
const path=process.env.MAP_STUDIO_SOURCE_ROM,table=Number(process.env.MAP_STUDIO_MUSIC_TABLE);
if(!path||!table)throw Error('Supply MAP_STUDIO_SOURCE_ROM and MAP_STUDIO_MUSIC_TABLE.');
const asset=extractMusic(new Uint8Array(fs.readFileSync(path)),table,314,{name:'Pewter'}),before=structuredClone(asset),source=musicScore(asset).score,percussionPrograms=availableVoices(asset).filter(v=>/Drum kit|PSG noise/.test(v.name)).map(v=>v.program),part=suggestMelodyPart(source,{percussionPrograms});
assert.equal(part,1,'Pewter main tune is part 2; late part 6 must not win');
const composer=neuralComposer({workerFactory:()=>neuralQAWorker(),musiganWorkerFactory:()=>neuralQAWorker('music-musigan-worker.js')}),styled=styleTrackBase(source,{preset:'shattered',scope:'whole',melodyPart:part,seed:44,percussionPrograms,targetKey:2,targetScale:'Harmonic minor'}).score;
const developed=await developTrackArrangement(styled,composer,{engine:'hybrid',seed:44,temperature:.85,onProgress:m=>console.log(m)});
assert.match(developed.composition.neural.engine,/Hybrid/);assert.ok(developed.composition.neural.changedNotes>0);assert.equal(styled.composition.baseTrack.sourceParts.length,source.tracks.length);assert.equal(developed.composition.settings.key,2);assert.equal(developed.composition.settings.scale,'Harmonic minor');
const sig=t=>t.notes.map(n=>[n.key,n.tick,n.duration]);assert.deepEqual(sig(developed.tracks[0]),sig(styled.tracks[0]));assert.notDeepEqual(developed.tracks[developed.composition.neural.developedPart].notes,styled.tracks[developed.composition.neural.developedPart]?.notes);
const treated=applyAftermathTreatment(developed,{mode:'worn-strong',seed:44});assert.deepEqual(sig(treated.tracks[0]),sig(styled.tracks[0]));
const fitted=fitQuickBank(treated,asset).score;const voice=availableVoices(asset).find(v=>v.program===styled.tracks[0].sourceProgram);if(voice&&fitted.tracks[0].notes.every(n=>!voice.keys||voice.keys.includes(n.key)))fitted.tracks[0].program=voice.program;
const compiled=compileMusic(fitted,{bankAsset:asset,name:'Pewter · Shattered · Hybrid · Worn'}),render=renderMusic(compiled,{seconds:12,sampleRate:22050});const plain=fitQuickBank(applyAftermathTreatment(styled,{mode:'worn-strong',seed:44}),asset).score;const phrasePCM=renderMusic(compileMusic(plain,{bankAsset:asset}),{seconds:12,sampleRate:22050}).pcm;let difference=0;for(let i=0;i<render.pcm.length;i++)difference+=(render.pcm[i]-phrasePCM[i])**2;const rmsDifference=Math.sqrt(difference/render.pcm.length);assert.ok(rmsDifference>.001,'Hybrid must audibly change the rendered audio relative to phrase-only');assert.ok(render.pcm.every(Number.isFinite));assert.ok(render.pcm.some(n=>Math.abs(n)>.001));assert.deepEqual(asset,before);
const report={song:'Pewter',scope:'whole',sourceParts:styled.composition.baseTrack.sourceParts,changedNotes:developed.composition.neural.changedNotes,rmsDifference,targetKey:'D',targetScale:'Harmonic minor',melodyPart:part+1,melodyFirstTick:source.tracks[part].notes[0].tick,engine:developed.composition.neural.engine,treatment:treated.composition.treatment.mode,sourceUnchanged:true,sourceTunePreserved:true,backingDeveloped:true,nativeBankCompiled:true,finiteAudiblePCM:true};
if(process.env.MAP_STUDIO_REPORT)fs.writeFileSync(process.env.MAP_STUDIO_REPORT,JSON.stringify(report,null,2));console.log('PASS actual bundled Hybrid + imported Pewter + atmosphere + native palette',report);

if(process.env.MAP_STUDIO_AUDIO_DIR){
 fs.mkdirSync(process.env.MAP_STUDIO_AUDIO_DIR,{recursive:true});
 function saveWav(r,name){const b=Buffer.alloc(44+r.pcm.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(r.sampleRate,24);b.writeUInt32LE(r.sampleRate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);r.pcm.forEach((v,i)=>b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(v*26000))),44+i*2));fs.writeFileSync(process.env.MAP_STUDIO_AUDIO_DIR+'/'+name,b);}
 saveWav(render,'Pewter_Shattered_Hybrid_Worn.wav');saveWav(renderMusic(asset,{seconds:12,sampleRate:22050}),'Pewter_Original.wav');
}
