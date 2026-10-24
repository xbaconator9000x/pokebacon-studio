/* Local contour-stage adapter. Runs the bundled checkpoint in the browser. */
const BASE='./vendor/musigan/';
let arrays,tokens,ready;
const names=['dense1Kernel','dense1Bias','dense2Kernel','dense2Bias','bn1Gamma','bn1Beta','bn1Mean','bn1Variance','dense3Kernel','dense3Bias','bn2Gamma','bn2Beta','bn2Mean','bn2Variance','dense4Kernel','dense4Bias'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function rng(seed){let x=seed>>>0;return()=>{x=(x+0x6d2b79f5)>>>0;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function normal(random){let a=Math.max(random(),1e-7),b=Math.max(random(),1e-7);return Math.sqrt(-2*Math.log(a))*Math.cos(Math.PI*2*b);}
function dense(input,kernel,bias,inSize,outSize){const out=new Float32Array(outSize);for(let j=0;j<outSize;j++){let sum=bias[j];for(let i=0;i<inSize;i++)sum+=input[i]*kernel[i*outSize+j];out[j]=sum;}return out;}
function leaky(x){for(let i=0;i<x.length;i++)if(x[i]<0)x[i]*=.2;return x;}
function batchNorm(x,gamma,beta,mean,variance){for(let i=0;i<x.length;i++)x[i]=gamma[i]*(x[i]-mean[i])/Math.sqrt(variance[i]+.001)+beta[i];return x;}
function halfToFloat(bits){const sign=bits&0x8000?-1:1,exponent=(bits>>>10)&31,fraction=bits&1023;if(exponent===0)return sign*2**-14*(fraction/1024);if(exponent===31)return fraction?NaN:sign*Infinity;return sign*2**(exponent-15)*(1+fraction/1024);}
function forward(input){
 let x=leaky(dense(input,arrays.dense1Kernel,arrays.dense1Bias,65,256));
 x=batchNorm(dense(x,arrays.dense2Kernel,arrays.dense2Bias,256,512),arrays.bn1Gamma,arrays.bn1Beta,arrays.bn1Mean,arrays.bn1Variance);
 x=leaky(dense(x,arrays.dense3Kernel,arrays.dense3Bias,512,1024));
 x=batchNorm(x,arrays.bn2Gamma,arrays.bn2Beta,arrays.bn2Mean,arrays.bn2Variance);
 const y=dense(x,arrays.dense4Kernel,arrays.dense4Bias,1024,3403);for(let i=0;i<y.length;i++)y[i]=Math.tanh(y[i]);return y;
}
function durationValue(text){if(!text)return .25;const [a,b]=text.split('/').map(Number);return Number.isFinite(b)?a/b:Number(a)||.25;}
function tokenInfo(token){if(!token||token==='NULL')return null;const [base,durationText='0.25']=token.split('$'),duration=Math.min(96,Math.max(6,Math.round(durationValue(durationText)*24)));let keys=[];
 const note=base.match(/^([A-G])([#-]?)([1-7])$/);if(note){const semitone={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[note[1]]+(note[2]==='#'?1:note[2]==='-'?-1:0);keys=[(Number(note[3])+1)*12+semitone];}
 else if(/^\d+(?:\.\d+)*$/.test(base)){keys=base.split('.').map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<12).slice(0,1).map(n=>60+n);}
 return keys.length?{keys:keys.map(key=>clamp(key,24,108)),duration}:null;
}
function pick(values,temperature,random){
 const ranked=Array.from(values,(v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
 if(!ranked.length)return 0;
 // The legacy model emits tanh scores, not calibrated logits/probabilities.
 // Preserve its original argmax behaviour at low exploration, then choose only
 // from a small rank window as exploration rises. Never force NULL out.
 const window=Math.max(1,Math.min(8,Math.round(1+Math.max(0,temperature)*7)));
 if(window===1||random()>.18*temperature)return ranked[0].i;
 return ranked[Math.min(window-1,Math.floor(random()*window))].i;
}
async function load(){if(ready)return ready;ready=(async()=>{const [metaResponse,tokensResponse,weightsResponse]=await Promise.all([fetch(BASE+'meta.json'),fetch(BASE+'tokens.json'),fetch(BASE+'weights.bin')]);if(!metaResponse.ok||!tokensResponse.ok||!weightsResponse.ok)throw Error('The local contour checkpoint is missing.');const meta=await metaResponse.json();tokens=await tokensResponse.json();const buffer=await weightsResponse.arrayBuffer(),view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8)),bytesPerWeight=magic==='MSGANF2\0'?2:magic==='MSGANF1\0'?4:0;if(!bytesPerWeight)throw Error('The local contour checkpoint is invalid.');let offset=12;arrays={};for(const name of names){const count=view.getUint32(offset,true);offset+=4;const values=new Float32Array(count);if(bytesPerWeight===2){for(let i=0;i<count;i++)values[i]=halfToFloat(view.getUint16(offset+i*2,true));}else{for(let i=0;i<count;i++)values[i]=view.getFloat32(offset+i*4,true);}arrays[name]=values;offset+=count*bytesPerWeight;}if(tokens.length!==meta.output.classes)throw Error('The local contour vocabulary is invalid.');return meta;})();return ready;}
function findTokenId(event,map){
 if(!event)return 0;const namesByKey=[];for(let octave=1;octave<=7;octave++)for(const [letter,semitone] of Object.entries({C:0,'C#':1,D:2,'E-':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'B-':10,B:11})){if((octave+1)*12+semitone===event.pitch)namesByKey.push(letter+octave);}
 const wanted=Math.max(.25,event.duration/24);let best=0,delta=Infinity;for(const base of namesByKey){for(let i=0;i<tokens.length;i++){const token=tokens[i];if(!token.startsWith(base+'$'))continue;const d=Math.abs(durationValue(token.slice(base.length+1))-wanted);if(d<delta){best=i;delta=d;}}}
 return best;
}
function makeHistory(events,map){const history=new Array(32).fill(0);for(const event of events||[]){if(event.step<0||event.step>=32)continue;const id=findTokenId(event,map);if(id)history[event.step]=id;}return history;}
self.onmessage=async event=>{try{const meta=await load(),jobs=event.data.jobs;if(!Array.isArray(jobs)||!jobs.length||jobs.length>4)throw Error('Invalid contour request.');const map=new Map(tokens.map((t,i)=>[t,i])),results=[];for(let ji=0;ji<jobs.length;ji++){const job=jobs[ji],random=rng(job.seed>>>0),history=makeHistory(job.history,map),notes=[],steps=Math.min(128,job.steps||32);self.postMessage({type:'progress',message:`Contour stage ready · ${job.section==='bridge'?'bridge':'main theme'} phrase ${ji+1} of ${jobs.length}…`});for(let step=0;step<steps;step++){const input=new Float32Array(65);for(let i=0;i<32;i++)input[i]=history[i]/3403;for(let i=32;i<65;i++)input[i]=normal(random);const values=forward(input),id=pick(values,job.temperature??.35,random),info=tokenInfo(tokens[id]);if(info)for(const key of info.keys)notes.push({step,duration:info.duration,key,token:tokens[id]});history.shift();history.push(id);if(step%8===0){self.postMessage({type:'progress',message:`Contour stage · ${job.section==='bridge'?'bridge':'main theme'} · ${step+1}/${steps} steps…`});await new Promise(resolve=>setTimeout(resolve,0));}}results.push({notes,classes:meta.output.classes});}self.postMessage({type:'result',results});}catch(error){self.postMessage({type:'error',message:'Contour stage: '+(error?.message||String(error))});}};
