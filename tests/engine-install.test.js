import test from 'node:test';import assert from 'node:assert/strict';
import {makeBPS} from '../dist/bps.js';import {engineDigest,installEngine,validateEngineManifest} from '../dist/engine-install.js';
function rom(){const b=new Uint8Array(0x400);b[0xB2]=0x96;let n=0;for(let i=0xA0;i<0xBD;i++)n+=b[i];b[0xBD]=(-n-0x19)&255;return b;}
test('engine installation checks exact inputs and output and never mutates the base',async()=>{const source=rom(),target=source.slice();target[0x200]=17;const patch=makeBPS(source,target),b={sourceSize:source.length,targetSize:target.length,sourceSHA256:await engineDigest(source),targetSHA256:await engineDigest(target),patchSHA256:await engineDigest(patch),baseName:'FireRed USA 1.0'};
 assert.deepEqual(await installEngine(source,patch,b),target);assert.equal(source[0x200],0);
 const wrong=source.slice();wrong[0x200]=9;await assert.rejects(installEngine(wrong,patch,b),/exact clean/);
 const damaged=patch.slice();damaged[8]^=1;await assert.rejects(installEngine(source,damaged,b),/damaged/);
 await assert.rejects(installEngine(source,patch,{...b,targetSHA256:'0'.repeat(64)}),/verified build/);
});
test('engine manifest rejects unpinned donors and external patch paths',()=>{const sha='a'.repeat(64),b={id:'expanded-fr',name:'Expanded FireRed',sourceSize:1024,targetSize:2048,sourceSHA256:sha,targetSHA256:sha,patchSHA256:sha,patch:'assets/engines/expanded.bps',features:[],sources:[{url:'https://github.com/Shiny-Miner/CFRU-expansion',commit:'b'.repeat(40)}]},m={format:'pokebacon-engine-pack',version:1,builds:[b]};assert.equal(validateEngineManifest(m),m);assert.throws(()=>validateEngineManifest({...m,builds:[{...b,patch:'https://example.com/a.bps'}]}),/Invalid/);assert.throws(()=>validateEngineManifest({...m,builds:[{...b,sources:[{...b.sources[0],commit:'latest'}]}]}),/Invalid/);});
