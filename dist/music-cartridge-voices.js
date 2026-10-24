// Original synthesized attack/sustain samples; no game recordings are bundled.
export const CARTRIDGE_VOICES=['Bright brass','Soft flute','Wooden mallet','Soft piano','Warm strings','Picked bass','Plucked guitar','Glass bell'].map((name,i)=>({program:i+16,name}));
export function installCartridgeVoices(bytes,start){const v=new DataView(bytes.buffer),BASE=0x08000000,rate=261.625565*64;let at=start;for(let index=0;index<8;index++){const program=16+index,row=program*12,loop=[0,1,4,5].includes(index),size=[2048,2048,4096,8192,4096,2048,4096,8192][index],loopStart=index===4?2048:512;bytes[row]=0;bytes[row+1]=60;v.setUint32(row+4,BASE+at,true);bytes.set(index===1?[120,250,220,180]:index===4?[80,250,215,185]:loop?[255,245,220,190]:[255,255,255,180],row+8);v.setUint16(at+2,loop?0x4000:0,true);v.setUint32(at+4,Math.round(rate*1024),true);v.setUint32(at+8,loop?loopStart:0,true);v.setUint32(at+12,size,true);let noise=0x91736+index;for(let i=0;i<size;i++){const t=i/rate,phase=2*Math.PI*i/64,sin=n=>Math.sin(phase*n);noise=(Math.imul(noise,1664525)+1013904223)>>>0;const grain=noise/4294967296*2-1;let sample;
 if(index===0)sample=(sin(1)+.33*sin(2)+.2*sin(3)+.1*sin(4)+.06*sin(5))*.58*Math.min(1,i/96);
 else if(index===1)sample=(.85*sin(1)+.08*sin(2)+.03*sin(3)+.008*grain)*Math.min(1,i/384);
 else if(index===2)sample=(sin(1)*Math.exp(-t*9)+.38*sin(4.01)*Math.exp(-t*25)+.12*sin(9.2)*Math.exp(-t*40))*.75*Math.min(1,i/12);
 else if(index===3)sample=(sin(1)*Math.exp(-t*4)+.42*sin(2)*Math.exp(-t*8)+.24*sin(3)*Math.exp(-t*13)+.12*sin(4.01)*Math.exp(-t*18)+.06*sin(6.02)*Math.exp(-t*25))*.65*Math.min(1,i/16);
 else if(index===4)sample=(sin(1)+.28*sin(2)+.19*sin(3)+.12*sin(4)+.07*sin(5)+.05*sin(6))*.58*Math.min(1,i/1280);
 else if(index===5)sample=(.7*sin(1)+.19*sin(2)+.08*sin(3)+grain*.05*Math.exp(-t*200))*(.65+.35*Math.exp(-t*90))*Math.min(1,i/12);
 else if(index===6)sample=(sin(1)*Math.exp(-t*7)+.33*sin(2)*Math.exp(-t*16)+.16*sin(3)*Math.exp(-t*24)+.1*sin(5)*Math.exp(-t*40))*.7*Math.min(1,i/8);
 else sample=(sin(1)*Math.exp(-t*5)+.42*sin(2.76)*Math.exp(-t*8)+.22*sin(5.4)*Math.exp(-t*12))*.68*Math.min(1,i/8);
 if(!loop)sample*=Math.min(1,(size-1-i)/192);bytes[at+16+i]=Math.round(Math.max(-1,Math.min(1,sample))*110)&255;}at=(at+16+size+3)&~3;}return at;}
