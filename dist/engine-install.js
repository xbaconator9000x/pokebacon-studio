import {applyBPS} from './bps.js';
export async function engineDigest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function validateEngineManifest(m){
 const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 if(!m||m.format!=='pokebacon-engine-pack'||m.version!==1||!Array.isArray(m.builds))throw Error('Invalid engine pack.');
 const ids=new Set();for(const b of m.builds){if(!/^[a-z0-9-]+$/.test(b.id)||ids.has(b.id)||typeof b.name!=='string'||!sha(b.sourceSHA256)||!sha(b.targetSHA256)||!sha(b.patchSHA256)||!/^assets\/engines\/[a-z0-9.-]+\.bps$/.test(b.patch)||![b.sourceSize,b.targetSize].every(n=>Number.isInteger(n)&&n>=0x200&&n<=32*1024*1024)||!Array.isArray(b.features)||!Array.isArray(b.sources)||!b.sources.length||b.sources.some(s=>!/^https:\/\/github.com\/[\w.-]+\/[\w.-]+$/.test(s.url)||!/^[a-f0-9]{40}$/.test(s.commit)))throw Error('Invalid engine build record.');ids.add(b.id);}
 return m;
}
export async function installEngine(source,patch,build){
 if(!(source instanceof Uint8Array)||!(patch instanceof Uint8Array))throw Error('Choose a GBA ROM and an engine patch.');
 if(source.length!==build.sourceSize||await engineDigest(source)!==build.sourceSHA256)throw Error('This engine needs the exact clean '+build.baseName+'. Modified ROMs and other revisions cannot be upgraded with this pack.');
 if(await engineDigest(patch)!==build.patchSHA256)throw Error('The engine patch is damaged.');
 const output=applyBPS(source,patch).bytes;
 if(output.length!==build.targetSize||await engineDigest(output)!==build.targetSHA256)throw Error('The installed engine did not match its verified build.');
 if(output[0xB2]!==0x96||output[0xBC]!==source[0xBC])throw Error('The installed engine has an invalid game header.');
 let check=0;for(let i=0xA0;i<0xBD;i++)check+=output[i];if(((-check-0x19)&255)!==output[0xBD])throw Error('The installed engine has an invalid header checksum.');
 return output;
}
