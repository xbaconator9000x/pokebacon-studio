/** Native regional/alternate forms for the two exact supplied pokeemerald-expansion builds.
 * This claims preallocated, entirely zero SpeciesInfo records. It does not expand the
 * ROM's engine, save format, species bounds, or national Pokédex capacity.
 * Primary layouts: PokemonHnS-Development/pokehns-expansion Release-v2.0.6,
 * rh-hideout/pokeemerald-expansion; individually verified against these ROM bytes.
 */
const BASE=0x08000000;
const KNOWN={
 'f8e990f4951df3bf1409d07bbd2d04b622dada5445610731d192103f9a712c58':{key:'tre304',name:'Team Rocket Edition 3.04',base:0x96cc18,stride:168,count:1698,dexCount:1062,learnset:0x90,teachable:0x94,eggMoves:0x98,evolutions:0x9c,forms:0xa0,formChanges:0xa4,flags:0x88,abilityCount:320,abilitiesBase:0xe5c998,abilitiesHeader:0x20c,moveBase:0x930db4,moveStride:60,moveCount:935},
 'cdfb9e1f83f72c05cb47af40fdf5635567b1973bcb759e070ad0971f67a49191':{key:'hns206',name:'Heart and Soul 2.0.6',base:0x7e6544,stride:268,count:1573,dexCount:1080,learnset:0x98,teachable:0x9c,eggMoves:0xa0,evolutions:0xa4,forms:0xa8,formChanges:0xac,flags:0x90,abilityCount:311,abilitiesBase:0xd35734,abilitiesHeader:0x214,moveBase:0x7b5c68,moveStride:68,moveCount:901},
};
const trusted=new WeakMap();
const C=new Map([[0,' '],[0x2e,'+'],[0x5b,'%'],[0xab,'!'],[0xac,'?'],[0xad,'.'],[0xae,'-'],[0xaf,'·'],[0xb0,'…'],[0xb1,'“'],[0xb2,'”'],[0xb3,'‘'],[0xb4,"'"],[0xb5,'♂'],[0xb6,'♀'],[0xb8,','],[0xba,'/'],[0xf0,':'],[0xfe,'\n']]);
for(let i=0;i<26;i++){C.set(0xbb+i,String.fromCharCode(65+i));C.set(0xd5+i,String.fromCharCode(97+i));}for(let i=0;i<10;i++)C.set(0xa1+i,String(i));
const ENCODE=new Map([...C].map(([k,v])=>[v,k]));ENCODE.set('’',0xb4);ENCODE.set('é',0x1b);
export const EXPANDED_TYPE_NAMES=['None','Normal','Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel','Mystery','Fire','Water','Grass','Electric','Psychic','Ice','Dragon','Dark','Fairy'];
export const FORM_EVOLUTION_METHODS=[{id:1,key:'level',name:'Reach a level'},{id:2,key:'trade',name:'Trade'},{id:3,key:'item',name:'Use an item'}];
const u16=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(p,true),u32=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(p,true);
const ptr=(b,p)=>{const n=u32(b,p)-BASE;return n>=0&&n<b.length?n:-1;};
const put16=(b,p,v)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint16(p,v,true);
const put32=(b,p,v)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint32(p,v,true);
const integer=(n,min,max,label)=>{if(!Number.isInteger(n)||n<min||n>max)throw Error(`${label} must be ${min}–${max}.`);return n;};
const allZero=b=>b.every(v=>v===0);
export function decodeCreatureText(b,start=0,max=1024){let out='';for(let i=start;i<Math.min(b.length,start+max)&&b[i]!==255;i++)out+=C.get(b[i])??(b[i]===0x1b?'é':'?');return out;}
export function encodeCreatureText(text,{max=1024,field='Text'}={}){const a=[];for(const c of String(text).replace(/\r\n?/g,'\n')){const n=ENCODE.get(c);if(n===undefined)throw Error(`${field}: unsupported character ${JSON.stringify(c)}.`);a.push(n);}if(a.length>max)throw Error(`${field} must be at most ${max} characters.`);return Uint8Array.from([...a,255]);}
function fixedText(text,length,field){const a=encodeCreatureText(text,{max:length-1,field});const b=new Uint8Array(length);b.set(a);return b;}
function formsAt(bytes,p,id){const start=ptr(bytes,p.base+id*p.stride+p.forms);if(start<0)return [id];const result=[];for(let i=0;i<256;i++){if(start+i*2+2>bytes.length)throw Error('Form table leaves the ROM.');const n=u16(bytes,start+i*2);if(n===65535){if(!result.length)throw Error('Empty native form list.');return result;}integer(n,1,p.count-1,'Native form ID');if(result.includes(n))throw Error('Duplicate native form ID.');result.push(n);}throw Error('Native form table is not terminated.');}
function evosAt(bytes,p,id){const start=ptr(bytes,p.base+id*p.stride+p.evolutions);if(start<0)return [];const result=[];for(let i=0;i<256;i++){const at=start+i*12;if(at+12>bytes.length)throw Error('Evolution table leaves the ROM.');const method=u16(bytes,at);if(method===65535)return result;integer(method,0,8,'Native evolution method');result.push({method,param:u16(bytes,at+2),target:u16(bytes,at+4),paramsPointer:u32(bytes,at+8),raw:bytes.slice(at,at+12)});}throw Error('Native evolution table is not terminated.');}
function changedFormsAt(bytes,p,id){const start=ptr(bytes,p.base+id*p.stride+p.formChanges);if(start<0)return [];const result=[];for(let i=0;i<256;i++){const at=start+i*12;if(at+12>bytes.length)throw Error('Form-change table leaves ROM.');const method=u16(bytes,at);if(!method)return result;result.push({method,target:u16(bytes,at+2)});}throw Error('Native form-change table is not terminated.');}
function learnsetAt(bytes,p,id){const start=ptr(bytes,p.base+id*p.stride+p.learnset);if(start<0)return [];const result=[];for(let i=0;i<512;i++){const at=start+i*4;if(at+4>bytes.length)throw Error('Level-up learnset leaves ROM.');const move=u16(bytes,at);if(move===65535)return result;integer(move,0,p.moveCount-1,'Native learned move');result.push({move,level:u16(bytes,at+2)});}throw Error('Level-up learnset is not terminated.');}
async function sha256(bytes){if(!globalThis.crypto?.subtle)throw Error('Secure hashing is required for native creature installation.');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
/** Profile is trusted in-memory only; never accept a profile from project JSON. */
export async function discoverFormCapacity(bytes,{sourceSha256}={}){
 if(!ArrayBuffer.isView(bytes)||bytes.BYTES_PER_ELEMENT!==1)throw Error('Expected source ROM bytes.');const hash=await sha256(bytes);if(sourceSha256&&sourceSha256!==hash)throw Error('The source ROM hash does not match.');const k=KNOWN[hash]||Object.values(KNOWN).find(k=>ptr(bytes,0x1bc)===k.base&&u32(bytes,0x170)===k.dexCount&&ptr(bytes,k.abilitiesHeader)===k.abilitiesBase&&ptr(bytes,0x1cc)===k.moveBase);if(!k)return null;
 if(ptr(bytes,0x1bc)!==k.base||u32(bytes,0x170)!==k.dexCount)throw Error('Creature header does not match the verified ROM.');
 if(ptr(bytes,k.abilitiesHeader)!==k.abilitiesBase||ptr(bytes,0x1cc)!==k.moveBase)throw Error('Move or ability table does not match the verified ROM.');
 const p={...k,sourceSha256:hash,blankSlots:[],excludedBlankSlots:[],species:[],abilities:[],moves:[],sharedDex:true,canAddNationalDexNumber:false};const blank=new Set(),referenced=new Map();
 for(let id=1;id<k.count;id++){const at=k.base+id*k.stride,row=bytes.subarray(at,at+k.stride);if(allZero(row)){blank.add(id);continue;}if(!row[0])continue;const name=decodeCreatureText(bytes,at+44,13),dexNumber=u16(bytes,at+0x3c);if(!row.subarray(44,57).includes(255)||!name.trim()||dexNumber>k.dexCount)throw Error(`Species ${id} has an unverified layout.`);p.species.push({id,name,dexNumber});}
 const mark=(id,reason)=>{if(blank.has(id)){const list=referenced.get(id)??[];list.push(reason);referenced.set(id,list);}};
 for(const {id} of p.species){for(const n of formsAt(bytes,p,id))mark(n,`native form list of ${id}`);for(const e of evosAt(bytes,p,id))mark(e.target,`native evolution of ${id}`);for(const f of changedFormsAt(bytes,p,id))mark(f.target,`native form-change of ${id}`);}
 for(const id of blank){if(referenced.has(id))p.excludedBlankSlots.push({id,reasons:referenced.get(id)});else p.blankSlots.push(id);}
 // These are names and descriptions of existing mechanics. This does not add ability code.
 for(let id=0;id<k.abilityCount;id++){const at=k.abilitiesBase+id*28,description=ptr(bytes,at+20);if(!bytes.subarray(at,at+17).includes(255)||description<0)throw Error(`Ability ${id} has an unverified layout.`);p.abilities.push({id,name:decodeCreatureText(bytes,at,17),description:decodeCreatureText(bytes,description,1024)});}
 for(let id=0;id<k.moveCount;id++){const at=ptr(bytes,k.moveBase+id*k.moveStride);if(at<0||!bytes.subarray(at,at+31).includes(255))throw Error(`Move ${id} has an unverified layout.`);p.moves.push({id,name:decodeCreatureText(bytes,at,31)});}
 trusted.set(p,{bytes,hash});return p;
}
function checkSource(bytes,p){const t=trusted.get(p);if(!t||t.bytes!==bytes)throw Error('Discover the creature profile from this original ROM first.');}
export function readFormDonor(bytes,p,id){checkSource(bytes,p);integer(id,1,p.count-1,'Parent species');const at=p.base+id*p.stride;if(!bytes[at])throw Error('Choose an existing enabled parent species.');const d=ptr(bytes,at+0x4c);return {id,name:decodeCreatureText(bytes,at+44,13),category:decodeCreatureText(bytes,at+31,13),stats:[...bytes.slice(at,at+6)],types:[...bytes.slice(at+6,at+8)],abilities:[u16(bytes,at+24),u16(bytes,at+26),u16(bytes,at+28)],catchRate:bytes[at+8],baseExp:u16(bytes,at+10),friendship:bytes[at+20],height:u16(bytes,at+0x3e),weight:u16(bytes,at+0x40),dexNumber:u16(bytes,at+0x3c),dexText:d<0?'':decodeCreatureText(bytes,d,2048),learnset:learnsetAt(bytes,p,id),forms:formsAt(bytes,p,id),evolutions:evosAt(bytes,p,id).map(e=>({method:e.method,param:e.param,target:e.target,conditional:!!e.paramsPointer})),nativeSlot:id};}
function outputWriter(output){if(!output||typeof output.write!=='function'||typeof output.allocate!=='function')throw Error('A ROM output allocator is required.');return {write:(at,b)=>output.write(at,b),alloc:(b)=>output.allocate(b,'Native form data'),current:()=>output.bytes};}
function makeLearnset(p,form){if(form.learnset===undefined)return null;if(!Array.isArray(form.learnset)||form.learnset.length>256)throw Error('A form supports at most 256 authored level-up moves.');const rows=form.learnset.map(e=>({move:integer(e.move,1,p.moveCount-1,'Learned move'),level:integer(e.level,0,255,'Learned move level')}));for(let i=1;i<rows.length;i++)if(rows[i].level<rows[i-1].level)throw Error('Put level-up moves in increasing level order.');const b=new Uint8Array((rows.length+1)*4);rows.forEach((e,i)=>{put16(b,i*4,e.move);put16(b,i*4+2,e.level);});put16(b,rows.length*4,65535);return b;}
function makeEvolutions(bytes,p,form,targets){if(form.evolutions===undefined)return evosAt(bytes,p,form.parent).map(e=>e.raw);if(!Array.isArray(form.evolutions)||form.evolutions.length>32)throw Error('A form supports at most 32 authored evolution branches.');return form.evolutions.map(e=>{const method=typeof e.method==='string'?FORM_EVOLUTION_METHODS.find(m=>m.key===e.method)?.id:e.method;if(![1,2,3].includes(method))throw Error('Authored native evolution supports level, trade or item.');const target=integer(e.target??e.species,1,p.count-1,'Evolution target');if(!targets.has(target)&&!bytes[p.base+target*p.stride])throw Error('Evolution target is not an enabled or authored species.');const param=integer(e.param??e.level??e.item??0,method===1?1:0,method===1?100:65535,'Evolution parameter');const b=new Uint8Array(12);put16(b,0,method);put16(b,2,param);put16(b,4,target);return b;});}
function terminatedEvolutions(rows){const b=new Uint8Array((rows.length+1)*12);rows.forEach((r,i)=>b.set(r,i*12));put16(b,rows.length*12,65535);return b;}
/** forms: {slot,parent,name,category?,dexText?,stats[6]?,types[2]?,abilities[3]?,
 * height?,weight?,catchRate?,friendship?,baseExp?,learnset?:[{move,level}],
 * evolutions?:[{method:'level'|'trade'|'item',param,target}]}.
 * Call this BEFORE native sprite edits; their installer must resolve the cloned record
 * from output.bytes, while UI can use parent artwork as the initial template.
 */
export function installCustomForms(output,bytes,p,forms){
 checkSource(bytes,p);if(!Array.isArray(forms)||forms.length>p.blankSlots.length)throw Error('Too many native forms.');const w=outputWriter(output),targets=new Set(),entries=[];
 for(const form of forms){const slot=integer(form.slot,1,p.count-1,'New form slot');if(targets.has(slot))throw Error('Two authored forms use the same native slot.');if(!p.blankSlots.includes(slot)||!allZero(bytes.subarray(p.base+slot*p.stride,p.base+(slot+1)*p.stride)))throw Error(`Species ${slot} is not an available blank record. Existing Pokémon are never replaced by this tool.`);targets.add(slot);const donor=readFormDonor(bytes,p,form.parent);if(!donor.dexNumber)throw Error('Choose a parent with a native Pokédex number.');if(!String(form.name??'').trim())throw Error('Give the new form a name.');const row=bytes.slice(p.base+form.parent*p.stride,p.base+(form.parent+1)*p.stride);row.set(fixedText(form.name,13,'Form name'),44);if(form.category!==undefined)row.set(fixedText(form.category,13,'Dex category'),31);for(const [field,offset,len,max] of [['stats',0,6,255],['types',6,2,19],['abilities',24,3,p.abilityCount-1]])if(form[field]!==undefined){if(!Array.isArray(form[field])||form[field].length!==len)throw Error(`${field} needs ${len} values.`);form[field].forEach((v,i)=>{integer(v,field==='stats'?1:0,max,field);if(field==='abilities')put16(row,offset+i*2,v);else row[offset+i]=v;});}
  for(const [field,offset,max]of[['height',0x3e,65535],['weight',0x40,65535],['catchRate',8,255],['friendship',20,255],['baseExp',10,65535]])if(form[field]!==undefined){const value=integer(form[field],0,max,field);if(max>255)put16(row,offset,value);else row[offset]=value;}
  // Custom regional forms remain themselves after a battle and do not inherit Mega/Primal transitions.
  put32(row,p.formChanges,0);put32(row,p.flags,u32(row,p.flags)&~0x7c0);
  entries.push({form,donor,row,evolutions:null,learnsetBytes:makeLearnset(p,form),dexBytes:form.dexText===undefined?null:encodeCreatureText(form.dexText,{max:2048,field:'Dex description'})});
 }
 // Validate targets after all slot declarations are known, including forward references.
 for(const e of entries)e.evolutions=makeEvolutions(bytes,p,e.form,targets);
 const groups=new Map();for(const e of entries){const group=e.donor.forms,root=group[0],key=root+':'+e.donor.dexNumber;let g=groups.get(key);if(!g){g={members:[...group],entries:[]};groups.set(key,g);}if(!g.members.includes(e.form.slot))g.members.push(e.form.slot);g.entries.push(e);}
 // Validation is complete before the first ROM output write.
 for(const e of entries){if(e.dexBytes)put32(e.row,0x4c,BASE+w.alloc(e.dexBytes));if(e.learnsetBytes)put32(e.row,p.learnset,BASE+w.alloc(e.learnsetBytes));put32(e.row,p.evolutions,BASE+w.alloc(terminatedEvolutions(e.evolutions)));w.write(p.base+e.form.slot*p.stride,e.row);}
 for(const g of groups.values()){const list=new Uint8Array((g.members.length+1)*2);g.members.forEach((n,i)=>put16(list,i*2,n));put16(list,g.members.length*2,65535);const address=w.alloc(list);for(const id of g.members){if(!targets.has(id)&&!bytes[p.base+id*p.stride])continue;const b=new Uint8Array(4);put32(b,0,BASE+address);w.write(p.base+id*p.stride+p.forms,b);}}
 return entries.map(({form,donor})=>`Installed ${form.name} as a new native form, species ID ${form.slot}, sharing Pokédex #${donor.dexNumber} with ${donor.name}.`);
}

/** Inline native gift command for these exact engines. Stock opcode0x79 is a nop
 * in both builds. Modern givemon calls ScrCmd_createmon with inline arguments.
 * Result is0 for party,1 for PC,2 for no room. This command is repeatable;
 * a surrounding authored script owns dialogue and any one-time flag.
 */
export function nativeFormGiftSource(bytes,p,{species,level=5}={}){
 checkSource(bytes,p);integer(species,1,p.count-1,'Gift species');integer(level,1,100,'Gift level');
 if(!bytes[p.base+species*p.stride]&&!p.blankSlots.includes(species))throw Error('Choose an enabled or queued form species.');
 const address=p.key==='hns206'?0x0a20b30d:0x0a1a39dd;
 return `callnative 0x${address.toString(16)}\n.byte 0 6\n.hword ${species} ${level}\n.word 0`;
}

