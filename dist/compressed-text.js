// Monomyth stores most dialogue as "FC 1D" + a packed 6-bit stream. Decoded
// from the game's own routines (4 symbols per 3 bytes; symbol 55 starts a
// 12-bit escape; 62/63 end the text). Read-only: re-encoding is not supported.
const BASE=0x08000000,tables=new WeakMap();
const SYMBOLS={38:'.',39:',',40:'\\x36',41:'?',42:'!',43:'-',44:':',45:'/',46:'(',47:')',48:'…',50:'\\n',51:'\\l',52:'\\p',56:'{PLAYER}',57:'{NAME2}',58:'{NAME3}',59:'{STR1}',60:'{STR2}',61:'{STR3}'};
const ch=b=>b>=0xbb&&b<=0xd4?String.fromCharCode(65+b-0xbb):b>=0xd5&&b<=0xee?String.fromCharCode(97+b-0xd5):b>=0xa1&&b<=0xaa?String(b-0xa1):({0:' ',0xab:'!',0xac:'?',0xad:'.',0xae:'-',0xb0:'…',0xb1:'“',0xb2:'”',0xb3:'‘',0xb4:'’',0xb8:',',0xba:'/',0xf0:':',0x5c:'(',0x5d:')',0x1b:'é',0xfe:'\\n',0xfa:'\\l',0xfb:'\\p'}[b]??'\\x'+b.toString(16).padStart(2,'0'));
export function isCompressedText(bytes,address){return bytes[address]===0xfc&&bytes[address+1]===0x1d;}
// The word table is 245 {pointer,length} pairs; entry 1 spells "Pokémon".
function wordTable(bytes){
 if(tables.has(bytes))return tables.get(bytes);
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let found=null;
 for(let at=0;at+245*8<=Math.min(bytes.length,0x1000000)&&!found;at+=4){
  const p=v.getUint32(at+8,true),n=v.getUint32(at+12,true);
  if(n!==7||p<BASE||p>=BASE+bytes.length-8)continue;const s=p-BASE;
  if(bytes[s]!==0xca||bytes[s+1]!==0xe3||bytes[s+2]!==0xdf||bytes[s+3]!==0x1b)continue;
  let ok=true;for(let i=0;i<245&&ok;i++){const q=v.getUint32(at+i*8,true),l=v.getUint32(at+i*8+4,true);if(q<BASE||q+l>BASE+bytes.length||l>40)ok=false;}
  if(ok)found=at;
 }
 const words=found===null?null:Array.from({length:245},(_,i)=>{const q=v.getUint32(found+i*8,true)-BASE,l=v.getUint32(found+i*8+4,true);return bytes.slice(q,q+l);});
 tables.set(bytes,words);return words;
}
export function decodeCompressedText(bytes,address){
 return decodeSegment(bytes,address);
}
export function decodeSegment(bytes,address){
 const words=wordTable(bytes);let o=address+2,text='',shift=false,state=0,esc=0,done=false,ended=0;
 while(!done){
  if(o+3>bytes.length)throw Error('Packed text runs past the end of the ROM.');
  const a=bytes[o],b=bytes[o+1],c=bytes[o+2];o+=3;
  for(const v of [a>>2,((a<<4)&0x30)|(b>>4),((b<<2)&0x3c)|(c>>6),c&0x3f]){
   if(state===1){esc=v<<6;state=2;continue;}
   if(state===2){const idx=esc|v,hi=idx>>8,lo=idx&255;state=0;
    if(hi===0)text+='\\xfc\\x19\\x'+lo.toString(16).padStart(2,'0');
    else if(hi===1)text+='\\xfc\\x1c\\x'+lo.toString(16).padStart(2,'0');
    else if(hi===2&&words&&lo<=0xf4){const w=Array.from(words[lo]);if(shift&&w[0]>=0xd5&&w[0]<=0xee)w[0]-=0x1a;for(const x of w)text+=ch(x);}
    else if(hi===2)text+='{WORD'+lo+'}';
    shift=false;continue;}
   if(v===62||v===63){done=true;ended=v;break;}
   if(v===0){text+=' ';shift=false;}
   else if(v<=26){text+=String.fromCharCode((shift?64:96)+v);shift=false;}
   else if(v===27)shift=true;
   else if(v<=37){text+=v-28;shift=false;}
   else if(v===49){text+=shift?'\\x06':'é';shift=false;}
   else if(v===53){text+=shift?'“':'‘';shift=false;}
   else if(v===54){text+=shift?'”':'’';shift=false;}
   else if(v===55)state=1;
   else{text+=SYMBOLS[v]??'';shift=false;}
  }
 }
 return{text,length:o-address,compressed:true,ended};
}

// Encoder: the inverse of decodeSegment. Words are spelled out letter by letter
// (the dictionary is only a space saver), so every decoded text re-encodes to
// bytes that decode back to the same text.
const PUNCT=new Map([['.',38],[',',39],['?',41],['!',42],['-',43],[':',44],['/',45],['(',46],[')',47],['…',48],['é',49]]);
const TOKENS=new Map([['{PLAYER}',56],['{NAME2}',57],['{NAME3}',58],['{STR1}',59],['{STR2}',60],['{STR3}',61]]);
const CTRL=new Map([['\\n',50],['\\l',51],['\\p',52]]);
export function encodeCompressedText(text){
 if(typeof text!=='string')throw Error('Dialogue must be text.');
 text=text.replace(/\r?\n/g,'\\n');
 const syms=[];let i=0;
 const esc=idx=>syms.push(55,idx>>6,idx&63);
 while(i<text.length){
  const rest=text.slice(i);let m;
  if((m=rest.match(/^\\xfc\\x19\\x([0-9a-f]{2})/i))){esc(parseInt(m[1],16));i+=m[0].length;continue;}
  if((m=rest.match(/^\\xfc\\x1c\\x([0-9a-f]{2})/i))){esc(0x100|parseInt(m[1],16));i+=m[0].length;continue;}
  if(rest.startsWith('\\x36')){syms.push(40);i+=4;continue;}
  if(rest.startsWith('\\x06')){syms.push(27,49);i+=4;continue;}
  let hit=false;
  for(const[k,v]of CTRL)if(rest.startsWith(k)){syms.push(v);i+=k.length;hit=true;break;}
  if(hit)continue;
  for(const[k,v]of TOKENS)if(rest.startsWith(k)){syms.push(v);i+=k.length;hit=true;break;}
  if(hit)continue;
  const c=text[i];i++;
  if(c===' ')syms.push(0);
  else if(c>='a'&&c<='z')syms.push(c.charCodeAt(0)-96);
  else if(c>='A'&&c<='Z')syms.push(27,c.charCodeAt(0)-64);
  else if(c>='0'&&c<='9')syms.push(28+Number(c));
  else if(PUNCT.has(c))syms.push(PUNCT.get(c));
  else if(c==='‘')syms.push(53);else if(c==='“')syms.push(27,53);
  else if(c==='’')syms.push(54);else if(c==='”')syms.push(27,54);
  else throw Error('This game\u2019s packed text cannot store \u201C'+c+'\u201D.');
 }
 syms.push(63);while(syms.length%4)syms.push(63);
 const out=[0xfc,0x1d];
 for(let k=0;k<syms.length;k+=4){const[a,b,c,d]=syms.slice(k,k+4);out.push(a<<2|b>>4,(b&15)<<4|c>>2,(c&3)<<6|d);}
 return Uint8Array.from(out);
}
