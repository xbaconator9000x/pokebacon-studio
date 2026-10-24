// Exercise the shipped Thumb helper in the shipped emulator on each supplied ROM.
import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {PlaytestCore} from '../dist/playtest-core.js';import {installQuest} from '../dist/quest-runtime.js';
const file=process.env.MAP_STUDIO_SOURCE_ROM;if(!file)throw Error('Set MAP_STUDIO_SOURCE_ROM');const source=fs.readFileSync(file),hash=createHash('sha256').update(source).digest('hex');console.log('Quest ABI: starting',hash);
const vendor=new URL('../dist/vendor/mgba/',import.meta.url).pathname,c={console,process,TextDecoder,TextEncoder,URL,Buffer,require:createRequire(import.meta.url),__dirname:vendor,__filename:vendor+'mgba.js',setTimeout,clearTimeout,performance};c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync(vendor+'mgba.js','utf8'),c);const mod=await c.createMgbaModule({wasmBinary:fs.readFileSync(vendor+'mgba.wasm')}),core=new PlaytestCore(mod);
const rom=new Uint8Array(0x2000000);rom.fill(255);rom.set(source);const at=0x1000000,token=0x57310824,runtime=installQuest({allocate(b){rom.set(b,at);return at;}},hash,token);core.load(rom);for(let i=0;i<400;i++)core.frame();
const offset=a=>a>=0x03000000?0x19000+a-0x03000000:0x21000+a-0x02000000,patch=writes=>{const s=core.snapshot(),v=new DataView(s.buffer,s.byteOffset,s.byteLength);for(const[a,n,value]of writes){n===1?v.setUint8(offset(a),value):n===2?v.setUint16(offset(a),value,true):v.setUint32(offset(a),value,true);}core.restore(s);},read=(a,n)=>core.snapshot().slice(offset(a),offset(a)+n),u16=a=>new DataView(read(a,2).buffer).getUint16(0,true);
const sb=0x02020000,start=sb+runtime.saveOffset;
// A disposable QA save block; native code uses the real source's call ABI and RAM symbols.
patch([[runtime.savePointer,4,sb],[0x030030f4,4,runtime.entry],...[...Array(144)].map((_,i)=>[start+i,1,0]),[start-1,1,0xa5],[start+144,1,0x5a]]);
const call=(slot,operation)=>{patch([[0x020370b8,2,slot],[0x020370ba,2,operation],[0x020370d0,2,0xeeee]]);core.frame();return u16(0x020370d0);};
assert.equal(call(1023,0),0);assert.equal(call(1023,1),1);assert.equal(call(1023,0),1);assert.equal(call(1023,2),0);assert.equal(call(0,1),1);assert.equal(call(1024,1),2);assert.equal(read(start-1,1)[0],0xa5);assert.equal(read(start+144,1)[0],0x5a);
patch([[start+4,4,token+1]]);assert.equal(call(0,0),2);assert.equal(call(0,1),2);assert.equal(read(start-1,1)[0],0xa5);assert.equal(read(start+144,1)[0],0x5a);
core.unload();console.log(JSON.stringify({pass:true,source:hash,nativeThumb:true,slots:[0,1023],readWriteClear:true,invalidSlotRefused:true,foreignOwnerRefused:true,guardBytesIntact:true,saveContinueRetested:false}));
