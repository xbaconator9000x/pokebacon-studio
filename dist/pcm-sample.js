// MP2K WaveData and DPCM blocks: pret/pokefirered src/m4a_1.s,
// SoundMainRAM_Unk2; delta values from src/m4a_tables.c.
const DELTA=[0,1,4,9,16,25,36,49,-64,-49,-36,-25,-16,-9,-4,-1];
export function decodeWave(reader,at,{maxSamples=262144}={}){
 const {bytes}=reader;if(!Number.isInteger(at)||at<0||at+16>bytes.length)throw Error('Invalid sample header.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),format=v.getUint16(at,true),rate=v.getUint32(at+4,true)/1024,count=v.getUint32(at+12,true),length=format===1?Math.ceil(count/64)*33:count;
 if(![0,1].includes(format)||!count||count>maxSamples||rate<1000||rate>192000||at+16+length>bytes.length)throw Error('Unsupported or incomplete PCM sample.');
 const pcm=new Uint8Array(count);if(format===0)pcm.set(bytes.subarray(at+16,at+16+count));else for(let block=0;block*64<count;block++){
  const start=at+16+block*33;let value=bytes[start];pcm[block*64]=value;
  for(let i=1;i<64&&block*64+i<count;i++){const b=bytes[start+1+Math.floor(i/2)],n=i%2?b&15:b>>>4;value=(value+DELTA[n])&255;pcm[block*64+i]=value;}
 }
 return{rate,pcm,format,loopStart:v.getUint32(at+8,true),status:v.getUint16(at+2,true)};
}
export function writeWave(sample){const pcm=sample.pcm,out=new Uint8Array(16+pcm.length+4),v=new DataView(out.buffer);v.setUint32(4,Math.round(sample.rate*1024),true);v.setUint32(12,pcm.length,true);out.set(pcm,16);return out;}
export function writeWAV(sample){const out=new Uint8Array(44+sample.pcm.length*2),v=new DataView(out.buffer),text=(at,s)=>{for(let i=0;i<s.length;i++)out[at+i]=s.charCodeAt(i);};text(0,'RIFF');v.setUint32(4,out.length-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,Math.round(sample.rate),true);v.setUint32(28,Math.round(sample.rate)*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,out.length-44,true);sample.pcm.forEach((n,i)=>v.setInt16(44+i*2,(n<<24>>24)*256,true));return out;}
export function readWAV(bytes,{rate=10512,maxSeconds=3}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length<44||bytes.length>8e6)throw Error('Use a PCM WAV file below 8 MB.');const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=at=>String.fromCharCode(...bytes.subarray(at,at+4));
 if(text(0)!=='RIFF'||text(8)!=='WAVE'||v.getUint32(4,true)+8!==bytes.length)throw Error('Invalid WAV container.');let format,data;
 for(let at=12;at+8<=bytes.length;){const size=v.getUint32(at+4,true),end=at+8+size;if(end>bytes.length)throw Error('Incomplete WAV chunk.');if(text(at)==='fmt '){if(format||size<16)throw Error('Invalid WAV format.');format={codec:v.getUint16(at+8,true),channels:v.getUint16(at+10,true),rate:v.getUint32(at+12,true),align:v.getUint16(at+20,true),bits:v.getUint16(at+22,true)};}if(text(at)==='data'){if(data)throw Error('Multiple WAV data chunks are unsupported.');data={at:at+8,size};}at=end+(size%2);}
 if(!format||!data||format.codec!==1||![1,2].includes(format.channels)||![8,16].includes(format.bits)||format.rate<4000||format.rate>192000||format.align!==format.channels*format.bits/8||data.size%format.align)throw Error('Use mono or stereo 8/16-bit PCM WAV.');
 const frames=data.size/format.align;if(!frames||frames/format.rate>maxSeconds)throw Error('Keep a cry at three seconds or less. Trim the WAV before importing.');const floats=new Float64Array(frames);
 for(let i=0;i<frames;i++)for(let c=0;c<format.channels;c++){const at=data.at+i*format.align+c*format.bits/8;floats[i]+=(format.bits===8?(bytes[at]-128)/128:v.getInt16(at,true)/32768)/format.channels;}
 // Area averaging reduces high-frequency aliasing when reducing the sample rate.
 const pcm=new Uint8Array(Math.max(1,Math.round(frames*rate/format.rate))),step=format.rate/rate;
 for(let i=0;i<pcm.length;i++){const start=i*step,end=Math.min(frames,(i+1)*step);let total=0,weight=0;for(let j=Math.floor(start);j<Math.ceil(end);j++){const w=Math.min(j+1,end)-Math.max(j,start);if(w>0&&j<frames){total+=floats[j]*w;weight+=w;}}pcm[i]=Math.max(-128,Math.min(127,Math.round(total/Math.max(weight,1e-9)*128)))&255;}
 return{rate,pcm};
}
export function transformSample(sample,{start=0,end=sample.pcm.length/sample.rate,gain=100,semitones=0,reverse=false,normalize=false}={}){
 if(![start,end,gain,semitones].every(Number.isFinite)||start<0||end<=start||end>sample.pcm.length/sample.rate+1e-6||gain<0||gain>200||semitones< -12||semitones>12)throw Error('Invalid cry trim, gain or pitch.');const pcm=Uint8Array.from(sample.pcm.slice(Math.floor(start*sample.rate),Math.min(sample.pcm.length,Math.ceil(end*sample.rate))));if(!pcm.length)throw Error('Select some audio first.');let peak=0;for(const n of pcm)peak=Math.max(peak,Math.abs(n<<24>>24));const multiplier=gain/100*(normalize&&peak?120/peak:1);for(let i=0;i<pcm.length;i++)pcm[i]=Math.max(-128,Math.min(127,Math.round((pcm[i]<<24>>24)*multiplier)))&255;if(reverse)pcm.reverse();return{rate:Math.round(sample.rate*2**(semitones/12)),pcm};
}
