import {STOCK_FIRE_RED_SHA} from './verified-frlg.js';
import {decodeWave,writeWave} from './pcm-sample.js';
import {decodeCreatureText} from './expanded-form-native.js';
import {CRY_NAMES} from './cry-names.js';
const BASE=0x08000000,COUNT=388;
const discovered=new Map();
export function cryProfile(hash){if(discovered.has(hash))return discovered.get(hash);if(hash===STOCK_FIRE_RED_SHA)return{table:0x48c914,count:COUNT,reverse:0x48c914+COUNT*12};throw Error('The selected ROM supports no compatible native cry table.');}
export function readCries(reader,hash){const b=reader.bytes,v=new DataView(b.buffer,b.byteOffset,b.byteLength),ptr=at=>at+4<=b.length?v.getUint32(at,true)-BASE:-1;
 // These are the live normal/reverse cry-table literals in FRLG's cry player.
 const table=ptr(0x72114),reverse=ptr(0x72104),count=(reverse-table)/12;
 let profile;if(table>=0&&reverse>table&&Number.isInteger(count)&&count<=2048)profile={table,reverse,count};else profile=cryProfile(hash);
 if(profile.table+profile.count*12>b.length||profile.reverse+profile.count*12>b.length)throw Error('Incomplete native cry table.');const rows=[];
 for(let id=0;id<profile.count;id++){const at=profile.table+id*12,reverse=profile.reverse+id*12;
  if(b.subarray(at,at+12).every(n=>n===0)&&b.subarray(reverse,reverse+12).every(n=>n===0))continue;
  for(const [row,types]of [[at,[0x20,0]],[reverse,[0x30,0x10]]]){const tone=v.getUint32(row,true);if(!types.includes(tone&255)||(tone>>>8)!==60||v.getUint32(row+8,true)!==0x00ff00ff)throw Error('Native cry tone layout failed verification.');}
  const reverseAddress=v.getUint32(reverse+4,true)-BASE;const reverseSample=decodeWave(reader,reverseAddress);if(reverseSample.status||reverseSample.loopStart)throw Error('Looped reverse cries are unsupported.');const address=v.getUint32(at+4,true)-BASE,sample=decodeWave(reader,address);if(sample.status||sample.loopStart)throw Error('Looped cries are unsupported.');
  const names=ptr(0x144),name=profile.count===COUNT?CRY_NAMES[id]:names>=0&&names+(id+1)*11<=b.length?decodeCreatureText(b,names+id*11,11):'';
  rows.push({id,reverseAddress,name:name||'Cry '+id,address,at,reverse,rate:sample.rate,count:sample.pcm.length});
 }
 if(!rows.length)throw Error('No compatible native cry samples were found.');discovered.set(hash,profile);return{profile,rows};
}
export function validateCryEdits(edits){if(edits===undefined)return;if(!edits||Array.isArray(edits)||Object.keys(edits).length>16)throw Error('Invalid cry edits.');let total=0;for(const [hash,rows]of Object.entries(edits)){const count=hash===STOCK_FIRE_RED_SHA?COUNT:discovered.get(hash)?.count||2048;if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid cry source.');if(!rows||Array.isArray(rows)||Object.keys(rows).length>count)throw Error('Invalid cry edits.');for(const [id,s]of Object.entries(rows)){if(!/^(0|[1-9]\d*)$/.test(id)||+id>=count||!s||!Number.isInteger(s.rate)||s.rate<4000||s.rate>32000||!Array.isArray(s.pcm)||!s.pcm.length||s.pcm.length>65536||s.pcm.length/s.rate>3||s.pcm.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('Invalid cry sample.');total+=s.pcm.length;}}if(total>1e6)throw Error('The project cry budget is 1 MB of sample data.');}
export function installCries(project,reader,hash,output){const rows=project.cryEdits?.[hash];if(!rows||!Object.keys(rows).length)return[];validateCryEdits({[hash]:rows});const native=readCries(reader,hash),reports=[];for(const [id,sample]of Object.entries(rows)){const row=native.rows.find(row=>row.id===+id);if(!row)throw Error('This cry slot has no editable sample.');const at=output.allocate(writeWave(sample),'Cry: '+row.name);// PCM uses plain/reverse tones; keeping the DPCM bit would silence normal playback.
output.write(row.at,Uint8Array.of(0));output.write(row.reverse,Uint8Array.of(0x10));output.int(row.at+4,BASE+at);output.int(row.reverse+4,BASE+at);reports.push('Cry: '+row.name+' · normal and reverse modes');}return reports;}
