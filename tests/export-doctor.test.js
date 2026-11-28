import test from 'node:test';
import assert from 'node:assert/strict';
import {runRom,judge,frameStats,inputFor,DOCTOR_PLAN} from '../dist/export-doctor.js';
const plan={...DOCTOR_PLAN,frames:1200,sampleEvery:60};
function fake(draw,{openFail=false}={}){
 let f=0;return{load(){if(openFail)throw Error('bad rom');},unload(){},frame(k){f++;this.k=k;},video(){const px=new Uint8Array(16*16*4);draw(px,f,this.k);return{width:16,height:16,pixels:px};}};
}
const paint=(px,c)=>{for(let i=0;i<px.length;i+=4){px[i]=c;px[i+1]=c>>1;px[i+2]=c>>2;px[i+3]=255;}for(let i=0;i<px.length/4;i+=4)px[i]=c?c^77:0;};
test('presses A and Start on a fixed script after the intro',()=>{
 assert.equal(inputFor(10),0);assert.equal(inputFor(240),1);assert.equal(inputFor(244),0);assert.equal(inputFor(240+45*2),8);
});
test('a flat screen throughout fails',async()=>{
 const r=await runRom(fake(px=>paint(px,0)),new Uint8Array(4),{plan});const j=judge(r);
 assert.equal(j.verdict,'fail');assert.equal(r.shots.length,0);
});
test('a ROM that changes screens passes',async()=>{
 const r=await runRom(fake((px,f)=>{paint(px,1+(f/200|0)*40);px[0]=f%255;px[8]=f%251;px[12]=7;}),new Uint8Array(4),{plan});
 assert.equal(judge(r).verdict,'pass');assert.ok(r.shots.length>=2);
});
test('one unchanging screen warns, and a refused ROM fails with its reason',async()=>{
 const r=await runRom(fake(px=>{paint(px,90);px[4]=1;}),new Uint8Array(4),{plan});assert.equal(judge(r).verdict,'warn');
 const bad=await runRom(fake(()=>{},{openFail:true}),new Uint8Array(4),{plan});assert.equal(judge(bad).verdict,'fail');assert.match(judge(bad).notes[0],/bad rom/);
});
test('worse than a healthy baseline is called a regression',async()=>{
 const good=await runRom(fake((px,f)=>{paint(px,1+(f/200|0)*40);px[0]=f%255;px[8]=f%251;px[12]=7;}),new Uint8Array(4),{plan});
 const dead=await runRom(fake(px=>paint(px,0)),new Uint8Array(4),{plan});
 const j=judge(dead,good);assert.equal(j.title,'Worse than the original ROM');
 assert.equal(frameStats({width:2,height:1,pixels:new Uint8Array([1,2,3,255,1,2,3,255])}).blank,true);
});
