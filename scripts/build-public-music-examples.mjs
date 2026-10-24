import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {quickTrackSettings} from '../dist/music-quick-presets.js';
import {composeSong} from '../dist/music-song.js';
import {compileMusic,writeMIDI} from '../dist/music-compose.js';
import {renderMusic} from '../dist/music-preview.js';
import {neuralComposer} from '../dist/music-neural.js';
import {neuralQAWorker} from './neural-qa-runtime.mjs';
const neural=neuralComposer({workerFactory:()=>neuralQAWorker(),musiganWorkerFactory:()=>neuralQAWorker('music-musigan-worker.js')});
const provenance=[];
const out='dist/examples';fs.mkdirSync(out,{recursive:true});
for(const [id,seed] of [['sunny-route',123],['forest',241],['cave',83],['trainer-battle',401],['night-town',77]]){
 const options=quickTrackSettings(id,{seed});const score=await neural.generate(composeSong(options),{...options,engine:'hybrid',temperature:.85,onProgress:m=>console.log(id,m)});if(score.composition.neural?.engine!=='Hybrid melody development')throw Error('Hybrid stages did not complete');provenance.push({preset:id,seed,engine:'hybrid',temperature:.85,modelStages:score.composition.neural,previewSeconds:65,palette:'Studio cartridge'});const asset=compileMusic(score);const r=renderMusic(asset,{seconds:65,sampleRate:22050});
 if(!r.pcm.every(Number.isFinite))throw Error('Invalid audio');
 const b=Buffer.alloc(44+r.pcm.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(22050,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(r.pcm.length*2,40);r.pcm.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));
 const wav=`${out}/${id}.wav`;fs.writeFileSync(wav,b);execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-af','loudnorm=I=-18:TP=-1.5:LRA=9','-b:a','128k',`${out}/${id}.mp3`]);fs.unlinkSync(wav);fs.writeFileSync(`${out}/${id}.mid`,writeMIDI(score));console.log(id);
}
fs.writeFileSync(`${out}/generation.json`,JSON.stringify(provenance,null,2)+'\n');
