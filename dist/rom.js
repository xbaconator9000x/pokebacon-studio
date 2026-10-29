import{storedTilesetCount}from'./tileset-storage.js';
import{detectLayerEncoding,decodeLayerAttribute,encodeLayerAttribute,nativeLayerValue}from'./native-layer-encoding.js';
/* Gen III map reader. Read-only: no ROM bytes are ever written.
 * Format research: pret/pokefirered, pret/pokeemerald, and jugales/pokewebkit.
 * PokeWebKit's author permits reuse of its logic and data; thanks to jugales.
 */
const BASE=0x08000000;
export const hex=n=>'0x'+Number(n).toString(16).toUpperCase();
const pause=()=>new Promise(r=>setTimeout(r,0));
const MAP_TYPES=['Unused','Town','City','Route','Dungeon','Underwater','Ocean','Unknown','Interior','Secret base','Unknown'];
const SPECIAL={0:' ',1:'À',2:'Á',3:'Â',4:'Ç',5:'È',6:'É',7:'Ê',8:'Ë',9:'Ì',11:'Î',12:'Ï',13:'Ò',14:'Ó',15:'Ô',16:'Œ',17:'Ù',18:'Ú',19:'Û',20:'Ñ',21:'ß',22:'à',23:'á',25:'ç',26:'è',27:'é',28:'ê',29:'ë',30:'ì',32:'î',33:'ï',34:'ò',35:'ó',36:'ô',37:'œ',38:'ù',39:'ú',40:'û',41:'ñ',45:'&',46:'+',81:'¿',82:'¡',90:'Í',91:'%',92:'(',93:')',104:'â',111:'í',0xab:'!',0xac:'?',0xad:'.',0xae:'-',0xaf:'·',0xb0:'…',0xb1:'“',0xb2:'”',0xb3:'‘',0xb4:'’',0xb5:'♂',0xb6:'♀',0xb7:'$',0xb8:',',0xb9:'×',0xba:'/',0xef:'▶',0xf0:':',0xf1:'Ä',0xf2:'Ö',0xf3:'Ü',0xf4:'ä',0xf5:'ö',0xf6:'ü'};
export function decodeText(bytes,start,limit=100){
  let out='';for(let i=start;i<Math.min(bytes.length,start+limit);i++){const c=bytes[i];if(c===0xff)return out.trim();if(c>=0xbb&&c<=0xd4)out+=String.fromCharCode(65+c-0xbb);else if(c>=0xd5&&c<=0xee)out+=String.fromCharCode(97+c-0xd5);else if(c>=0xa1&&c<=0xaa)out+=String(c-0xa1);else if(SPECIAL[c]!==undefined)out+=SPECIAL[c];else return null;}return null;
}
function encodeAscii(text){return Uint8Array.from([...text].map(c=>c===' '?0:c>='A'&&c<='Z'?0xbb+c.charCodeAt(0)-65:c>='a'&&c<='z'?0xd5+c.charCodeAt(0)-97:c>='0'&&c<='9'?0xa1+c.charCodeAt(0)-48:0).concat(255));}
function findBytes(bytes,needle,start=0){outer:for(let i=start;i<=bytes.length-needle.length;i++){if(bytes[i]!==needle[0])continue;for(let k=1;k<needle.length;k++)if(bytes[i+k]!==needle[k])continue outer;return i;}return-1;}

export function decompressLZ(bytes,address,maxSize=0x40000){
  if(address<0||address+4>bytes.length||bytes[address]!==0x10)throw new Error('Invalid GBA LZ77 graphics header.');
  const length=bytes[address+1]|bytes[address+2]<<8|bytes[address+3]<<16;
  if(length<1||length>maxSize)throw new Error('Compressed graphics exceed the supported size.');
  const out=new Uint8Array(length);let src=address+4,dest=0;
  while(dest<length){if(src>=bytes.length)throw new Error('Truncated LZ77 graphics.');const flags=bytes[src++];for(let bit=7;bit>=0&&dest<length;bit--){if(flags&(1<<bit)){if(src+2>bytes.length)throw new Error('Truncated LZ77 reference.');const a=bytes[src++],b=bytes[src++],count=(a>>>4)+3,distance=((a&15)<<8|b)+1;if(distance>dest)throw new Error('Invalid LZ77 back-reference.');for(let j=0;j<count&&dest<length;j++,dest++)out[dest]=out[dest-distance];}else{if(src>=bytes.length)throw new Error('Truncated LZ77 literal.');out[dest++]=bytes[src++];}}}
  return out;
}


/* Smol/tANS format used by pokeemerald-expansion. Independent, bounded JS
 * implementation of the format documented in rh-hideout/pokeemerald-expansion
 * include/decompress.h and src/decompress.c (hedara90 and contributors).
 * All vector, bitstream and back-reference bounds are checked before use.
 */
export function decompressGraphics(bytes,address,maxSize=0x40000){
  if(bytes[address]===0x10)return decompressLZ(bytes,address,maxSize);
  const fail=()=>{throw new Error('Invalid or truncated Smol graphics.');};
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u32=o=>{if(o<0||o+4>bytes.length)fail();return view.getUint32(o,true);};
  const h=u32(address),h2=u32(address+4),mode=h&15,length=((h>>>4)&16383)*4,symSize=h>>>18,loSize=h2>>>19,words=(h2>>>6)&8191;
  if(mode<1||mode>6||!length||length>maxSize||!symSize||!loSize)fail();
  const loEncoded=mode>=4,symEncoded=[2,3,5,6].includes(mode),delta=mode===3||mode===6;
  let pos=address+8,loFreq=-1,symFreq=-1;
  if(loEncoded){loFreq=pos;pos+=12;}if(symEncoded){symFreq=pos;pos+=12;}
  const bitsStart=pos,bitsEnd=pos+words*4;let bit=0,state=h2&63;
  if(bitsEnd>bytes.length||((loEncoded||symEncoded)&&!words))fail();
  const readBits=n=>{if(bit+n>words*32)fail();let value=0;for(let i=0;i<n;i++,bit++)value|=((bytes[bitsStart+(bit>>>3)]>>>(bit&7))&1)<<i;return value;};
  const table=where=>{
    const packed=[u32(where),u32(where+4),u32(where+8)],freq=new Array(16).fill(0),out=[];
    for(let i=0;i<3;i++){for(let j=0;j<5;j++)freq[i*5+j]=(packed[i]>>>(j*6))&63;freq[15]|=(packed[i]>>>30)<<(i*2);}
    if(freq.reduce((a,b)=>a+b,0)!==64)fail();
    for(let symbol=0;symbol<16;symbol++)for(let n=freq[symbol];n<freq[symbol]*2;n++){const k=6-Math.floor(Math.log2(n));out.push({symbol,k,y:(n<<k)-64});}
    return out;
  };
  const decode=(where,count,nibbles,isDelta,final=false)=>{
    const t=table(where),out=new Uint16Array(count);let previous=0;
    for(let i=0;i<count;i++)for(let nib=0;nib<nibbles;nib++){
      const v=t[state];if(!v)fail();let symbol=v.symbol;
      if(isDelta){previous=(previous+symbol)&15;symbol=previous;}
      out[i]|=symbol<<(nib*4);
      // The terminal symbol needs no following ANS state. That transition may
      // extend beyond the stored stream; no payload bits are missing.
      if(!(final&&i===count-1&&nib===nibbles-1))state=v.y+readBits(v.k);
    }
    return out;
  };
  let lo=loEncoded?Uint8Array.from(decode(loFreq,loSize,2,false,!symEncoded)):null;
  let syms=symEncoded?decode(symFreq,symSize,4,delta,true):null;
  pos=bitsEnd;
  if(!symEncoded){if(pos+symSize*2>bytes.length)fail();syms=new Uint16Array(symSize);for(let i=0;i<symSize;i++)syms[i]=view.getUint16(pos+i*2,true);pos+=symSize*2;}
  if(!loEncoded){if(pos+loSize>bytes.length)fail();lo=bytes.subarray(pos,pos+loSize);}
  const out=new Uint16Array(length/2);let dest=0,li=0,si=0;
  const number=()=>{if(li>=lo.length)fail();const first=lo[li++];if(first&128){if(li>=lo.length)fail();return(first&127)|(lo[li++]<<7);}return first;};
  while(li<loSize){const count=number(),offset=number();
    if(count){if(si>=symSize||dest+count+1>out.length||offset<1||offset>dest+1)fail();out[dest++]=syms[si++];for(let j=0;j<count;j++,dest++)out[dest]=out[dest-offset];}
    else{if(!offset||si+offset>symSize||dest+offset>out.length)fail();out.set(syms.subarray(si,si+offset),dest);dest+=offset;si+=offset;}
  }
  if(dest!==out.length||si!==symSize)fail();
  const result=new Uint8Array(length);for(let i=0;i<out.length;i++){result[i*2]=out[i]&255;result[i*2+1]=out[i]>>>8;}return result;
}

export class GbaMaps {
  constructor(buffer,filename='game.gba'){
    this.bytes=buffer instanceof Uint8Array?new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength):new Uint8Array(buffer);this.view=new DataView(this.bytes.buffer,this.bytes.byteOffset,this.bytes.byteLength);this.size=this.bytes.length;
    if(this.size<0x200||this.size>32*1024*1024)throw new Error('Choose an unzipped GBA ROM up to 32 MB.');
    this.filename=filename;this.title=String.fromCharCode(...this.bytes.slice(0xa0,0xac)).replace(/\0/g,'').trim();this.code=String.fromCharCode(...this.bytes.slice(0xac,0xb0));
    this.layouts=new Map();this.headers=new Map();this.maps=[];this.gfxCache=new Map();this.atlasCache=new Map();this.names=[];this.warnings=[];this.nameOffset=0;this.engine=null;this.metatileLayers=2;this.metatileBytes=16;
  }
  valid(o,n=1){return Number.isInteger(o)&&o>=0&&o+n<=this.size;}
  u8(o){return this.valid(o)?this.bytes[o]:0;}
  u16(o){return this.valid(o,2)?this.view.getUint16(o,true):0;}
  i16(o){return this.valid(o,2)?this.view.getInt16(o,true):0;}
  u32(o){return this.valid(o,4)?this.view.getUint32(o,true):0;}
  i32(o){return this.valid(o,4)?this.view.getInt32(o,true):0;}
  ptr(o){const p=this.u32(o)-BASE;return p>=0&&p<this.size?p:-1;}
  optionalPtr(o){return this.u32(o)===0||this.ptr(o)>=0;}
  looksTileset(o,secondary){return this.valid(o,24)&&this.u8(o+1)===secondary&&this.ptr(o+4)>=0&&this.ptr(o+8)>=0&&this.ptr(o+12)>=0;}
  layoutAt(o){
    if(this.layouts.has(o))return this.layouts.get(o);
    if(!this.valid(o,24))return null;const width=this.u32(o),height=this.u32(o+4);
    if(width<1||height<1||width>512||height>512||width*height>65536)return null;
    const border=this.ptr(o+8),blocks=this.ptr(o+12),primary=this.ptr(o+16),secondary=this.ptr(o+20);
    if(border<0||!this.valid(blocks,width*height*2)||!this.looksTileset(primary,0)||!this.looksTileset(secondary,1))return null;
    const l={address:o,width,height,border,blocks,primary,secondary};this.layouts.set(o,l);return l;
  }
  headerAt(o){
    if(this.headers.has(o))return this.headers.get(o);
    const l=this.layouts.get(this.ptr(o));if(!l||!this.valid(o,28)||!this.optionalPtr(o+4)||!this.optionalPtr(o+8)||!this.optionalPtr(o+12)||this.u8(o+23)>10)return null;
    const h={address:o,layout:l,events:this.ptr(o+4),scripts:this.ptr(o+8),connections:this.ptr(o+12),section:this.u8(o+20),type:this.u8(o+23),weather:this.u8(o+22),music:this.u16(o+16)};
    this.headers.set(o,h);return h;
  }
  async discover(progress=()=>{}){
    progress('Finding map layouts…');
    for(let block=0;block<this.size;block+=0x100000){for(let o=block;o<Math.min(this.size-28,block+0x100000);o+=4){const w=this.u32(o);if(w>=1&&w<=512){const h=this.u32(o+4);if(h>=1&&h<=512)this.layoutAt(o);}}await pause();}
    if(!this.layouts.size)throw new Error('No supported Gen III map layouts were found. This ROM may use a different or expanded map format.');
    progress('Finding map headers…');
    for(let block=0;block<this.size;block+=0x100000){for(let o=block;o<Math.min(this.size-28,block+0x100000);o+=4)if(this.layouts.has(this.ptr(o)))this.headerAt(o);await pause();}
    progress('Finding map groups…');const runs=[];let run=[],start=0;
    for(let block=0;block<this.size;block+=0x100000){for(let o=block;o<Math.min(this.size-4,block+0x100000);o+=4){const bank=this.ptr(o);if(bank>=0&&(this.headers.has(this.ptr(bank))||[0xffffffff,0xf7f7f7f7].includes(this.u32(bank)))){if(!run.length)start=o;run.push(bank);}else{if(run.length>=3)runs.push({start,banks:run});run=[];}}await pause();}
    if(run.length>=3)runs.push({start,banks:run});
    const candidates=[];
    for(const candidate of runs){
      const banks=candidate.banks.slice(0,256),unique=[...new Set(banks)];if(unique.length<3||unique.length/banks.length<.8)continue;
      const boundaries=[...unique,candidate.start].sort((a,b)=>a-b),maps=[];let good=0;
      for(let b=0;b<banks.length;b++){const begin=banks[b],end=boundaries.find(v=>v>begin)??this.size;let count=0;for(let id=0;id<256&&begin+id*4<end;id++){const entry=this.u32(begin+id*4),h=this.headers.get(this.ptr(begin+id*4));if(!h){if([0,0xffffffff,0xf7f7f7f7].includes(entry))continue;break;}maps.push({...h,bank:b,index:id,key:`${b}.${id}`});count++;}if(count)good++;}
      if(maps.length>=10&&good/banks.length>.85)candidates.push({...candidate,banks,maps,score:maps.length+banks.length*5});
    }
    candidates.sort((a,b)=>b.score-a.score);const chosen=candidates[0];
    if(!chosen)throw new Error('Map layouts were found, but their map table could not be identified safely. This hack may need a custom reader.');
    this.mapTable=chosen.start;this.bankCount=chosen.banks.length;this.maps=chosen.maps;
    let fire=0,emerald=0;for(const map of this.maps.slice(0,150)){const t=map.layout.primary,a=this.ptr(t+16),b=this.ptr(t+20);if(b>=0&&(b&1)===0&&(a<0||(a&1)))fire++;if(a>=0&&(a&1)===0&&(b<0||(b&1)))emerald++;}
    // Prefer complete, independently sized attribute/metatile arrays over
    // callback alignment. Expanded FRLG engines may use even callback entries.
    let frlgData=0,rseData=0;
    for(const address of new Set(this.maps.map(m=>m.layout.primary))){
      const meta=this.ptr(address+12),span=(attrs,size)=>{
        if(attrs<0||attrs%size)return false;
        const candidates=attrs<meta?[(meta-attrs)/size]:[(attrs-meta)/16,(attrs-meta)/24];
        return candidates.some(count=>[512,640].includes(count)&&this.valid(attrs,count*size));
      };
      if(span(this.ptr(address+20),4))frlgData++;
      if(span(this.ptr(address+16),2))rseData++;
    }
    this.engineEvidence={frlgData,rseData,frlgCallbacks:fire,rseCallbacks:emerald};
    this.engine=frlgData!==rseData?(frlgData>rseData?'frlg':'rse'):(fire>emerald?'frlg':'rse');this.primaryCount=this.engine==='frlg'?640:512;this.primaryPalettes=this.engine==='frlg'?7:6;
    const counts=new Map();for(const address of new Set(this.maps.map(m=>m.layout.primary))){const t=this.tileset(address);if([512,640].includes(t.count))counts.set(t.count,(counts.get(t.count)||0)+1);}
    if(counts.size){this.primaryCount=[...counts].sort((a,b)=>b[1]-a[1])[0][0];this.primaryPalettes=this.primaryCount===640?7:6;}
    this.layoutRecordSize=this.engine==='frlg'||this.maps.some(m=>{const t=this.tileset(m.layout.primary);return t.compressed&&this.u8(t.graphics)!==16;})?28:24;
    this.mixedAttributeLayouts=new Set();if(this.engine==='rse')for(const m of this.maps){const t=this.tileset(m.layout.primary),span=t.metatiles-t.attrs;if(this.u8(m.layout.address+24)===1&&[512*4,640*4].includes(span))this.mixedAttributeLayouts.add(m.layout.address);}if(this.mixedAttributeLayouts.size)this.layoutRecordSize=28;this.layoutBorderOffset=this.mixedAttributeLayouts.size?25:24;this.findMetatileFormat();this.findNames();if(this.engine==='rse')this.findRegionNames();for(const map of this.maps){map.label=this.names[map.section-this.nameOffset]||`Map ${map.key}`;map.name=`${map.label} · ${map.key}`;map.typeName=MAP_TYPES[map.type]||'Map';}
    if(!this.names.length)this.warnings.push('Map labels could not be decoded; maps are identified by their group and map numbers.');
    return this;
  }
  findMetatileFormat(){
    // Infer the engine-wide 12-subtile format from multiple complete primary
    // tables. A tileset count or game code alone is not evidence of 3 layers.
    // In Emerald-family headers attributes can precede metatiles: the verified
    // 512/640-entry attribute span gives a count independent of pixel stride.
    if(this.engine==='frlg'){const encoding=this.layerEncoding();if(encoding.extended){this.mixedMetatileLayers=this.maps.some(m=>{const p=this.profile(m),a=this.tileset(m.layout.primary),b=this.tileset(m.layout.secondary);return [...this.blocks(m)].some(w=>{const id=w&1023,t=id<p.primaryCount?a:b,n=id<p.primaryCount?id:id-p.primaryCount;return nativeLayerValue(this.u32(t.attrs+n*4),encoding)===3;});});if(this.mixedMetatileLayers)this.metatileLayers=3;}return;}
    const layouts=[...this.layouts.values()],tilesets=[...new Set(layouts.flatMap(m=>[m.primary,m.secondary]))].map(a=>this.tileset(a));
    const bounds=new Set(tilesets.flatMap(t=>[t.address,t.metatiles,t.attrs,t.graphics,t.palettes]).filter(a=>a>=0));
    const primaries=[...new Set(layouts.map(m=>m.primary))].map(a=>this.tileset(a));
    let normal=0,triple=0;
    for(const t of primaries){
      if(![512,640].includes(t.count)||t.attrs>=t.metatiles||!this.valid(t.metatiles,t.count*24))continue;
      const next=[...bounds].filter(a=>a>t.metatiles).sort((a,b)=>a-b)[0],n16=next===t.metatiles+t.count*16,n24=next===t.metatiles+t.count*24;
      if(n16&&!n24)normal++;else if(n24&&!n16)triple++;
    }
    this.metatileFormatEvidence={normal,triple};
    if(triple>=2&&!normal){this.metatileLayers=3;this.metatileBytes=24;}
  }
  findNames(){
    const anchors=this.engine==='frlg'?[['PALLET TOWN','VIRIDIAN CITY',88],['Pallet Town','Viridian City',88]]:[['LITTLEROOT TOWN','OLDALE TOWN',0],['Littleroot Town','Oldale Town',0]];
    for(const[first,next,offset]of anchors){const needle=encodeAscii(first);let at=findBytes(this.bytes,needle);while(at>=0){const following=decodeText(this.bytes,at+needle.length);if(following===next){this.nameOffset=offset;let pos=at;for(let i=0;i<256;i++){const text=decodeText(this.bytes,pos,80);if(!text)break;this.names.push(text);while(pos<this.size&&this.bytes[pos]!==255)pos++;pos++;}return;}at=findBytes(this.bytes,needle,at+1);}}
  }
  findRegionNames(){
    // RegionMapLocation: four byte-sized dimensions and a text pointer.
    // Preserve unused entries so section IDs do not shift at holes in the table.
    const candidates=[];
    for(let phase=0;phase<8;phase+=4){let run=[],start=0,zeros=0;
      const finish=()=>{while(run.length&&!run[run.length-1])run.pop();if(run.filter(Boolean).length>=30&&new Set(run.filter(Boolean)).size>=20)candidates.push({start,names:run});run=[];zeros=0;};
      for(let at=phase;at<this.size-8;at+=8){const p=this.ptr(at+4),dims=[this.u8(at),this.u8(at+1),this.u8(at+2),this.u8(at+3)],empty=dims.every(v=>v===0)&&(this.u32(at+4)===0||p>=0);
        const text=p>=0&&dims.every(v=>v<=64)&&dims[2]>0&&dims[3]>0?decodeText(this.bytes,p,64):null;
        if(text&&text.length>=2&&text.length<=48){if(!run.length)start=at;run.push(text);zeros=0;}
        else if(empty&&zeros<8){if(!run.length)start=at;run.push(null);zeros++;}else finish();
      }finish();
    }
    const refs=new Map(candidates.map(c=>[c.start,0]));for(let at=0;at<this.size-4;at+=4){const p=this.ptr(at);if(refs.has(p))refs.set(p,refs.get(p)+1);}
    candidates.forEach(c=>c.score=c.names.filter(Boolean).length+(refs.get(c.start)||0)*100);
    candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];
    if(best&&refs.get(best.start)){this.names=best.names.slice(0,256);this.nameOffset=0;this.nameTable=best.start;}
  }

  byKey(key){return this.maps.find(m=>m.key===key);}
  blocks(map){const a=new Uint16Array(map.layout.width*map.layout.height);for(let i=0;i<a.length;i++)a[i]=this.u16(map.layout.blocks+i*2);return a;}
  tileset(o,attributeSize=this.engine==='frlg'?4:2){const attrs=this.ptr(o+(this.engine==='frlg'?20:16)),metatiles=this.ptr(o+12),possible=attrs>metatiles?(attrs-metatiles)/this.metatileBytes:(metatiles-attrs)/attributeSize;return{address:o,compressed:!!(this.u8(o)&1),graphics:this.ptr(o+4),palettes:this.ptr(o+8),metatiles,attrs,count:storedTilesetCount(this,o,attributeSize,this.metatileBytes)??(Number.isInteger(possible)&&possible>0&&possible<=1024?possible:null)};}
  graphics(t){if(this.gfxCache.has(t.address))return this.gfxCache.get(t.address);const expected=(this.u8(t.address+1)?1024-this.primaryCount:this.primaryCount)*32;let bytes=t.compressed?decompressGraphics(this.bytes,t.graphics):this.bytes.slice(t.graphics,Math.min(this.size,t.graphics+expected));this.gfxCache.set(t.address,bytes);return bytes;}
  profile(map){const attributeSize=this.engine==='frlg'||this.mixedAttributeLayouts?.has(map.layout.address)?4:2,t=this.tileset(map.layout.primary,attributeSize),length=this.graphics(t).length/32,graphicsCount=this.engine==='frlg'||t.count===640||length>512?640:512,primaryCount=[512,640].includes(t.count)?t.count:graphicsCount;return{primaryCount,graphicsCount,primaryPalettes:graphicsCount===640?7:6,attributeSize,attributeEngine:attributeSize===4?'frlg':'rse',metatileLayers:this.metatileLayers,metatileBytes:this.metatileBytes,mixedMetatileLayers:!!this.mixedMetatileLayers};}
  layerEncoding(){if(!this._layerEncoding)this._layerEncoding=detectLayerEncoding(this);return this._layerEncoding;}
  encodeAttribute(attribute){return this.engine==='frlg'?encodeLayerAttribute(attribute,this.layerEncoding()):attribute;}
  pairKey(map){return`${map.layout.primary.toString(16)}-${map.layout.secondary.toString(16)}`+(this.mixedAttributeLayouts?.has(map.layout.address)?'-attr32':'');}
  atlas(map){
    const key=this.pairKey(map);if(this.atlasCache.has(key))return this.atlasCache.get(key);
    const {primaryCount,graphicsCount,primaryPalettes,attributeSize}=this.profile(map);
    const primary=this.tileset(map.layout.primary,attributeSize),secondary=this.tileset(map.layout.secondary,attributeSize),pg=this.graphics(primary),sg=this.graphics(secondary);
    let maxUsed=0;for(const word of this.blocks(map))maxUsed=Math.max(maxUsed,word&1023);
    const count=Math.max(primaryCount,Math.min(1024,primaryCount+(secondary.count??Math.max(1,maxUsed-primaryCount+1))));
    const width=256,height=Math.ceil(count/16)*16,pixels=new Uint8ClampedArray(width*height*4),layers=Array.from({length:this.metatileLayers},()=>new Uint8ClampedArray(width*height*4)),attrs=new Array(count).fill(0),errors=[],missingBlocks=new Set(),unsupportedBlocks=[];
    const colors=Array.from({length:16},(_,pal)=>{const source=pal<primaryPalettes?primary:secondary;return Array.from({length:16},(_,i)=>{const c=this.u16(source.palettes+(pal*16+i)*2);return[(c&31)*255/31|0,((c>>>5)&31)*255/31|0,((c>>>10)&31)*255/31|0];});});
    for(let block=0;block<count;block++){
      const t=block<primaryCount?primary:secondary,id=block<primaryCount?block:block-primaryCount;
      if(t.count!==null&&id>=t.count)continue;
      try{attrs[block]=this.engine==='frlg'?decodeLayerAttribute(this.u32(t.attrs+id*4),this.layerEncoding()):attributeSize===4?this.u32(t.attrs+id*4):this.u16(t.attrs+id*2);}catch(error){unsupportedBlocks.push(block);missingBlocks.add(block);continue;}
      const nativeType=this.mixedMetatileLayers?nativeLayerValue(this.u32(t.attrs+id*4),this.layerEncoding()):null;
      for(let layer=0;layer<this.metatileLayers;layer++)for(let sub=0;sub<4;sub++){
        let sourceLayer=layer;if(this.mixedMetatileLayers&&nativeType!==3){const type=attrs[block]>>>29&3;sourceLayer=type===0?(layer===0?-1:layer-1):type===1?(layer===2?-1:layer):(layer===1?-1:layer===2?1:0);if(sourceLayer<0)continue;}
        const data=this.u16(t.metatiles+id*this.metatileBytes+(sourceLayer*4+sub)*2),tile=data&1023,pal=data>>>12,flipX=!!(data&1024),flipY=!!(data&2048),gfx=tile<graphicsCount?pg:sg,tileIndex=tile<graphicsCount?tile:tile-graphicsCount;
        if(tileIndex*32+32>gfx.length){missingBlocks.add(block);if(errors.length<12)errors.push({block,tile});continue;}
        for(let y=0;y<8;y++)for(let x=0;x<8;x++){
          const sx=flipX?7-x:x,sy=flipY?7-y:y,byte=gfx[tileIndex*32+sy*4+(sx>>>1)],index=sx&1?byte>>>4:byte&15;
          if(index===0)continue;
          const px=(block%16)*16+(sub%2)*8+x,py=Math.floor(block/16)*16+Math.floor(sub/2)*8+y,d=(py*width+px)*4,color=colors[pal][index];pixels[d]=color[0];pixels[d+1]=color[1];pixels[d+2]=color[2];pixels[d+3]=255;layers[layer][d]=color[0];layers[layer][d+1]=color[1];layers[layer][d+2]=color[2];layers[layer][d+3]=255;
        }
      }
    }
    const result={key,width,height,count,primaryCount,graphicsCount,primaryPalettes,metatileLayers:this.metatileLayers,metatileBytes:this.metatileBytes,mixedMetatileLayers:!!this.mixedMetatileLayers,pixels,layers,attrs,errors,unsupportedBlocks,missingBlocks:[...missingBlocks],primary,secondary};this.atlasCache.set(key,result);while(this.atlasCache.size>8)this.atlasCache.delete(this.atlasCache.keys().next().value);return result;
  }
  mapWarnings(map){const atlas=this.atlas(map),used=new Set([...this.blocks(map)].map(word=>word&1023)),missing=atlas.missingBlocks.filter(id=>used.has(id));const outside=[...used].filter(id=>id>=atlas.count);return[...(missing.length?[`Some graphics could not be read from this map's static tileset and may appear blank (metatiles ${missing.join(', ')}).`]:[]),...(outside.length?[`This source map references metatiles outside its tileset (IDs ${outside.join(', ')}). It may be an unused legacy map.`]:[])];}
  render(map){const atlas=this.atlas(map),words=this.blocks(map),width=map.layout.width*16,height=map.layout.height*16,pixels=new Uint8ClampedArray(width*height*4);for(let i=0;i<words.length;i++){const id=words[i]&1023;if(id>=atlas.count)continue;const sx=(id%16)*16,sy=Math.floor(id/16)*16,dx=(i%map.layout.width)*16,dy=Math.floor(i/map.layout.width)*16;for(let y=0;y<16;y++)pixels.set(atlas.pixels.subarray(((sy+y)*atlas.width+sx)*4,((sy+y)*atlas.width+sx+16)*4),((dy+y)*width+dx)*4);}return{width,height,pixels};}
  events(map){
    const out={npcs:[],warps:[],signs:[],triggers:[]},p=map.events;if(p<0||!this.valid(p,20))return out;
    const lists=[['npcs',this.u8(p),this.ptr(p+4),24],['warps',this.u8(p+1),this.ptr(p+8),8],['triggers',this.u8(p+2),this.ptr(p+12),16],['signs',this.u8(p+3),this.ptr(p+16),12]];
    for(const[kind,count,start,size]of lists){if(count>255||!this.valid(start,count*size))continue;for(let i=0;i<count;i++){const o=start+i*size,x=this.i16(o+(kind==='npcs'?4:0)),y=this.i16(o+(kind==='npcs'?6:2));if(x<0||y<0||x>=map.layout.width||y>=map.layout.height)continue;const e={index:i,address:o,x,y,elevation:this.u8(o+(kind==='npcs'?8:4))};if(kind==='npcs')Object.assign(e,{localId:this.u8(o),sprite:this.u8(o+1),movement:this.u8(o+9),script:this.ptr(o+16),flag:this.u16(o+20)});if(kind==='warps')Object.assign(e,{warp:this.u8(o+5),map:this.u8(o+6),bank:this.u8(o+7),target:`${this.u8(o+7)}.${this.u8(o+6)}`});if(kind==='signs')Object.assign(e,{type:this.u8(o+5),script:this.ptr(o+8)});if(kind==='signs'&&e.type>=5&&e.type<=7)Object.assign(e,{itemId:this.u16(o+8),hiddenItemId:this.u8(o+10),hiddenItemQuantity:this.u8(o+11)});if(kind==='triggers')Object.assign(e,{variable:this.u16(o+6),value:this.u16(o+8),script:this.ptr(o+12)});out[kind].push(e);}}
    return out;
  }
  connections(map){const p=map.connections;if(p<0||!this.valid(p,8))return[];const n=this.u32(p),a=this.ptr(p+4);if(n>30||!this.valid(a,n*12))return[];const out=[];for(let i=0;i<n;i++){const o=a+i*12,direction=this.u32(o);if(direction<1||direction>6)continue;out.push({direction,kind:['','south','north','west','east','dive','emerge'][direction],offset:this.i32(o+4),bank:this.u8(o+8),map:this.u8(o+9),target:`${this.u8(o+8)}.${this.u8(o+9)}`});}return out;}
  adjacent(map){return[...new Set([...this.connections(map).map(c=>c.target),...this.events(map).warps.filter(w=>w.elevation!==255).map(w=>w.target)])].map(k=>this.byKey(k)).filter(Boolean);}
  summary(){return{filename:this.filename,title:this.title,code:this.code,engine:this.engine,mapTable:this.mapTable,banks:this.bankCount,mapCount:this.maps.length};}
}
