import {musicTables,extractMusic} from './music-assets.js';
import {renderMusic} from './music-preview.js';
self.onmessage=async event=>{const {id,type,bytes,asset,options}=event.data;try{const result=type==='scan'?musicTables(new Uint8Array(bytes)):type==='extract'?extractMusic(new Uint8Array(bytes),options.table,options.songId,options):type==='render'?renderMusic(asset,options):null;self.postMessage({id,result},result?.pcm?[result.pcm.buffer]:[]);}catch(error){self.postMessage({id,error:error.message});}};
