export const CORE_ID='mgba-wasm-0.1.1-c034660f';
export const GBA_KEYS={a:1,b:2,select:4,start:8,right:16,left:32,up:64,down:128,r:256,l:512};
export async function digestBytes(bytes){if(!globalThis.crypto?.subtle)throw Error('Secure file hashing is unavailable. Reopen the app to playtest.');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
let factory;
export async function loadPlaytestCore(){
 if(!factory)factory=(async()=>{if(!globalThis.createMgbaModule)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('./vendor/mgba/mgba.js',document.baseURI).href;s.onload=resolve;s.onerror=()=>reject(Error('The bundled GBA engine could not load. Reopen the app and try again.'));document.head.append(s);});const root=new URL('./vendor/mgba/',document.baseURI),module=await globalThis.createMgbaModule({locateFile:p=>new URL(p,root).href});return new PlaytestCore(module);})().catch(e=>{factory=null;throw e;});
 return factory;
}
// The adapter owns memory and copies every saved heap view before memory can grow.
export class PlaytestCore{
 constructor(module){this.mod=module;module._mgbawasm_init();module._mgbawasm_set_log_level(0);this.audioPtr=0;this.loaded=false;}
 withBytes(bytes,fn){const p=this.mod._malloc(bytes.length);if(!p)throw Error('The playtester ran out of memory.');try{this.mod.HEAPU8.set(bytes,p);return fn(p);}finally{this.mod._free(p);}}
 load(bytes){this.unload();if(this.withBytes(bytes,p=>this.mod._mgbawasm_load(p,bytes.length,0,0,0,0,1))!==1)throw Error('The GBA engine could not open this ROM.');this.loaded=true;this.mod._mgbawasm_set_idle_optimization(1);this.audioPtr=this.mod._malloc(16384);if(!this.audioPtr){this.unload();throw Error('The playtester ran out of audio memory.');}this.fps=this.mod._mgbawasm_framerate_micro()/1e6;}
 keys(mask=0){if(this.loaded)this.mod._mgbawasm_set_keys(mask&1023);}
 frame(mask=0,audio){if(!this.loaded)return;this.keys(mask);this.mod._mgbawasm_run_frame();this.drainAudio(audio);}
 drainAudio(consume){if(!this.audioPtr)return;let n;while((n=this.mod._mgbawasm_read_audio(this.audioPtr,4096))>0){if(consume){const pcm=new Float32Array(n*2),src=this.mod.HEAP16;for(let i=0;i<pcm.length;i++)pcm[i]=src[(this.audioPtr>>1)+i]/32768;consume(pcm,this.mod._mgbawasm_sample_rate());}}}
 video(){const m=this.mod,w=m._mgbawasm_video_width(),h=m._mgbawasm_video_height(),p=m._mgbawasm_video_ptr();return{width:w,height:h,pixels:m.HEAPU8.slice(p,p+w*h*4)};}
 snapshot(){if(!this.loaded)throw Error('Start a game first.');const m=this.mod,n=m._mgbawasm_state_size(),p=m._malloc(n);if(!p)throw Error('Snapshot memory is unavailable.');try{if(m._mgbawasm_state_save(p)!==1)throw Error('The game snapshot could not be saved.');return m.HEAPU8.slice(p,p+n);}finally{m._free(p);}}
 restore(bytes){if(!this.loaded||bytes.length!==this.mod._mgbawasm_state_size())throw Error('This snapshot belongs to a different GBA engine.');if(this.withBytes(bytes,p=>this.mod._mgbawasm_state_load(p))!==1)throw Error('The game snapshot could not be restored.');this.keys();this.drainAudio();}
 saveRAM(){if(!this.loaded)return null;const m=this.mod,n=m._mgbawasm_sram_save(),p=m._mgbawasm_sram_ptr();return n?m.HEAPU8.slice(p,p+n):null;}
 loadRAM(bytes,{reset=true}={}){if(![512,8192,32768,65536,131072].includes(bytes.length))throw Error('Choose a raw GBA .sav file (512 B, 8, 32, 64 or 128 KB).');if(this.withBytes(bytes,p=>this.mod._mgbawasm_sram_load(p,bytes.length))!==1)throw Error('This save does not fit the loaded game.');if(reset)this.reset();}
 reset(){this.keys();this.mod._mgbawasm_reset();this.drainAudio();}
 unload(){if(this.loaded){this.keys();this.mod._mgbawasm_unload();}if(this.audioPtr)this.mod._free(this.audioPtr);this.audioPtr=0;this.loaded=false;}
}
