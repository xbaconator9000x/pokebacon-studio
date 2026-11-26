import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeCompressedText,isCompressedText,encodeCompressedText} from '../dist/compressed-text.js';
import {decodeScriptText} from '../dist/script-engine.js';
const BASE=0x08000000;
function pack(syms){while(syms.length%4)syms.push(63);const o=[];for(let i=0;i<syms.length;i+=4){const[a,b,c,d]=syms.slice(i,i+4);o.push(a<<2|b>>4,(b&15)<<4|c>>2,(c&3)<<6|d);}return o;}
function rom(){
 const b=new Uint8Array(0x4000),v=new DataView(b.buffer),tab=0x100,words=0x1000;
 const w=[[0xca,0xe3,0xdf,0x1b,0xe1,0xe3,0xe2],[0xe9,0xe8,0xd5]]; // Pokémon, "tha" filler
 let at=words;for(let i=0;i<245;i++){const s=i===1?w[0]:w[1];b.set(s,at);v.setUint32(tab+i*8,BASE+at,true);v.setUint32(tab+i*8+4,s.length,true);at+=8;}
 return b;
}
test('packed dialogue decodes letters, shift, punctuation and word-table escapes',()=>{
 const b=rom();
 // 27=shift,8=h,9=i,0=space, 55 + 0x201 = dictionary word 1, 42='!', 50=newline, 63=end
 const text=pack([27,8,9,0,55,2<<2|0,1,42,50,28,63]);
 b.set([0xfc,0x1d,...text],0x3000);
 assert.equal(isCompressedText(b,0x3000),true);
 const r=decodeScriptText(b,0x3000);
 assert.equal(r.text,'Hi Pokémon!\\n0');
 assert.equal(r.compressed,true);
 assert.equal(r.length,2+text.length);
});
test('plain dialogue is untouched and truncated packed text is rejected',()=>{
 const b=new Uint8Array(64);b.set([0xd5,0xff],8);
 assert.equal(isCompressedText(b,8),false);assert.equal(decodeScriptText(b,8).text,'a');
 const t=new Uint8Array(6);t.set([0xfc,0x1d,0,0],0);
 assert.throws(()=>decodeCompressedText(t,0),/past the end/);
});
test('packed text can follow plain text in the same string',()=>{
 const b=rom(),text=pack([27,8,9,63]);
 b.set([0xca,0xe3,0xfc,0x1d,...text],0x3000);
 const r=decodeScriptText(b,0x3000);
 assert.equal(r.text,'PoHi');
 assert.equal(r.compressed,true);assert.equal(r.length,4+text.length);
});
test('packed text re-encodes to bytes that decode to the same text',()=>{
 const b=rom();
 for(const text of ['Hello, {PLAYER}!\\nIt’s “fine”... 42?\\pBye-bye.','Café: A/B (C) \\xfc\\x19\\x27Hi','']){
  const bytes=encodeCompressedText(text),buf=new Uint8Array(0x4000);buf.set(bytes);
  const r=decodeScriptText(buf,0);
  assert.equal(r.text,text);
  assert.equal(r.length,bytes.length);
 }
 assert.throws(()=>encodeCompressedText('日本'),/cannot store/);void b;
});
