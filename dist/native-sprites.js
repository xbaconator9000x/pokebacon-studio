import {ENGINE_SAVE_PROFILES,identifyEngineProfile} from './engine-profiles.js';
/* Native GBA sprite adapters. Original art only; no stock offsets are substituted.
 * Tables and expansion layouts are verified in full before editing. */
import {decompressSmol,smolInfo} from './smol-sprites.js';
const BASE=0x08000000;
const bounds=(b,a,n)=>Number.isInteger(a)&&a>=0&&a+n<=b.length;
const u16=(b,a)=>bounds(b,a,2)?b[a]|b[a+1]<<8:-1;
const u32=(b,a)=>bounds(b,a,4)?(b[a]|b[a+1]<<8|b[a+2]<<16|b[a+3]<<24)>>>0:0;
const ptr=(b,a)=>{const p=u32(b,a)-BASE;return bounds(b,p,1)?p:-1;};
export function decompressSpriteLZ(bytes,address,maxSize=65532){return decompressSmol(bytes,address,maxSize);}
export function literalSpriteLZ(raw){if(!raw.length||raw.length>0xffffff)throw Error('Invalid sprite data length.');const out=new Uint8Array(4+raw.length+Math.ceil(raw.length/8));out.set([16,raw.length&255,raw.length>>>8&255,raw.length>>>16&255]);for(let i=0,p=4;i<raw.length;i+=8){out[p++]=0;out.set(raw.subarray(i,i+8),p);p+=Math.min(8,raw.length-i);}return out;}
function nameAt(bytes,at,length=11){let s='';if(!bounds(bytes,at,length))return null;for(let i=0;i<length;i++){const c=bytes[at+i];if(c===255)return s;if(c===0)s+=' ';else if(c>=0xbb&&c<=0xd4)s+=String.fromCharCode(c-0xbb+65);else if(c>=0xd5&&c<=0xee)s+=String.fromCharCode(c-0xd5+97);else if(c>=0xa1&&c<=0xaa)s+=String(c-0xa1);else s+=({0xb5:'♂',0xb6:'♀',0xac:'?',0xae:'-',0xad:'.',0xb4:"'",0x1b:'é'})[c]||'·';}return null;}
const KNOWN={
 // Shattered retains the FireRed header pointers but relocates the species
 // tables and expands them to 547 rows. Its palette tags are intentionally
 // reused, so tableProfile verifies bytes rather than assuming stock tags.
 '74bb1c9f89e1d775387f58d47abfb22ecf415d0ac4ba54b8e922fed0d997aedf':{title:'Pokémon Shattered xx0.98',layout:'tables',count:547,namesAddress:0x160d96c,front:0x1a28410,back:0x1a38794,normal:0x1a72c40,shiny:0x1a7f35c,icons:0x1…56247 tokens truncated…ters: '+file);$('#spriteCatalogue').click();assert.ok($('#spriteCatalogSearch'),'catalogue search: '+file);assert.ok(w.document.querySelectorAll('[data-catalog-preview]').length,'catalogue previews: '+file);$('#spriteCatalogBack').click();assert.equal(spr.state.choice.kind,'mon');const c=spr.state.context,before=readNativeSprite(source,c.sprites,{kind:'mon',id:1,side:'front'});assert.deepEqual(Array.from(spr.state.pixels),Array.from(before.frames[0]));
 // Paint through the actual touch-capable canvas then compile, never mutating source.
 spr.state.color=(before.frames[0][1300]+1)%16;spr.draw();const z=spr.state.zoom,canvas=$('#spriteCanvas');pointer('pointerdown',20.5*z,20.5*z,canvas);pointer('pointerup',20.5*z,20.5*z,canvas);assert.equal(spr.state.pixels[1300],spr.state.color);spr.save();
 const result=await qa.compileROM({allowUnboundMaps:true}),read=readNativeSprite(result.bytes,c.sprites,{kind:'mon',id:1,side:'front'});assert.equal(read.frames[0][1300],spr.state.color);assert.equal(Buffer.compare(source,Buffer.from(c.reader.bytes)),0);
 const copy=await spr.cloneGroup();assert.equal(spr.state.choice.kind,'custom');assert.ok($('#spriteBrowseROM'));$('#spriteBrowseROM').click();assert.equal(spr.state.choice.kind,'mon');spr.newGroupDialog();assert.ok($('#newSpriteBrowseROM'));$('#newSpriteBrowseROM').click();assert.equal(spr.state.choice.kind,'mon');
 // Actual edited ROM reopens with a new digest, retaining verified graphics tables.
 const profile=await discoverNativeSprites(result.bytes,{engine:c.reader.engine});assert.ok(profile,'edited image discovery: '+file);assert.equal(readNativeSprite(result.bytes,profile,{kind:'mon',id:1,side:'front'}).frames[0][1300],spr.state.color);await s.close();console.log('PASS template, paint, ROM export, custom copy and edited-ROM rediscovery:',file);
}
const s=await session({},true);await s.qa.state.spriteTools.open();assert.ok(s.$('#newSpriteOpenROM'),'template upload reachable without loaded ROM');await s.close();
