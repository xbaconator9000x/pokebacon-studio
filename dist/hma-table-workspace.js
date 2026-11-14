import {hexState,stagedROMByte,stageROMHex} from './native-hex-workspace.js';
const types={u8:1,s8:1,u16:2,s16:2,u32:4,s32:4,ptr:4};
const LIMIT=2*1024*1024,MAX_ANCHORS=10000;
const nameOk=s=>typeof s==='string'&&s.length>=1&&s.length<=120&&/^[a-zA-Z0-9_ .:-]+$/.test(s);
const number=n=>typeof n==='string'&&/^0x[0-9a-f]+$/i.test(n)?parseInt(n.slice(2),16):Number(n);
export function parseHMAToml(text,{romLength=32*1024*1024}={}){
 if(typeof text!=='string'||text.length>LIMIT)throw Error('HMA metadata must be a UTF-8 TOML file under 2 MiB.');
 const anchors=[],lists=[],offsetPointers=[],general={},groups=[],warnings=[],lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
 let section=null,record=null,last=null;
 function push(){
  if(!section||!record)return;
  if(section==='NamedAnchors'){
   const at=number(record.Address);
   if(nameOk(record.Name)&&Number.isInteger(at)&&at>=0&&at<romLength&&typeof record.Format==='string')anchors.push({name:record.Name,at,format:record.Format,line:last});
   else warnings.push('Unsupported or out-of-range NamedAnchors entry near line '+last);
  }else if(section==='OffsetPointer'){
   const at=number(record.Address),offset=number(record.Offset);
   if(Number.isInteger(at)&&at>=0&&at+4<=romLength&&Number.isInteger(offset))offsetPointers.push({at,offset});
   else warnings.push('Unsupported OffsetPointer near line '+last);
  }else if(section==='List')lists.push({name:record.Name||'',values:record});
  else if(section==='TableGroup')groups.push({name:record.Name||'',values:record});
 }
 const quoted=value=>{
  const trimmed=value.trim();
  if((trimmed.startsWith("'''")&&trimmed.endsWith("'''")&&trimmed.length>=6)||(trimmed.startsWith('"""')&&trimmed.endsWith('"""')&&trimmed.length>=6))return trimmed.slice(3,-3);
  if(trimmed.startsWith("'")&&trimmed.endsWith("'")&&trimmed.length>=2)return trimmed.slice(1,-1);
  if(trimmed.startsWith('"')&&trimmed.endsWith('"')&&trimmed.length>=2)return trimmed.slice(1,-1);
  return trimmed;
 };
 let multi=null,buffer='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i],header=line.match(/^\s*\[\[([A-Za-z0-9_]+)\]\]\s*(?:#.*)?$/),single=line.match(/^\s*\[([A-Za-z0-9_]+)\]\s*(?:#.*)?$/);
  if(header||single){push();section=(header||single)[1];record={};last=i+1;multi=null;continue;}
  if(!section)continue;
  if(multi){buffer+='\n'+line;if(/^\s*\]\s*(?:#.*)?$/.test(line)){record[multi]=buffer;multi=null;buffer='';}continue;}
  const assign=line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
  if(!assign)continue;
  const key=assign[1],value=assign[2];
  // Multi-line arrays are left as raw metadata. Import must preserve the exact
  // complete TOML document, not pretend to interpret unknown HMA structures.
  if(value==='['||value.startsWith('[')&&!value.includes(']')){multi=key;buffer=value;continue;}
  record[key]=quoted(value);
  if(section==='General')general[key]=record[key];
 }
 if(multi&&record){record[multi]=buffer;warnings.push('Unterminated HMA TOML array near line '+last);}
 push();
 if(anchors.length>MAX_ANCHORS)throw Error('This HMA metadata file contains too many named anchors.');
 return{anchors,lists,offsetPointers,groups,general,warnings,raw:text};
}
export function importHMAToml(project,sourceId,source,text){
 const metadata=parseHMAToml(text,{romLength:source.length});
 project.hexStudio??={version:1,sources:{}};
 project.hexStudio.sources??={};
 project.hexStudio.sources[sourceId]??={patches:[],tables:[],hmaToml:''};
 project.hexStudio.sources[sourceId].hmaToml=metadata.raw;
 return{anchors:metadata.anchors.length,pointers:metadata.offsetPointers.length,warnings:metadata.warnings.length};
}
export function hmaMetadata(project,sourceId,source){
 const raw=hexState(project,sourceId)?.hmaToml;
 return raw?parseHMAToml(raw,{romLength:source.length}):{anchors:[],lists:[],groups:[],offsetPointers:[],warnings:[],raw:''};
}
function width(field){
 if(field.type==='ascii')return field.length;
 return types[field.type]||0;
}
export function validateTable(table,sourceLength){
 if(!table||typeof table!=='object'||!nameOk(table.name))throw Error('Use a short table name.');
 const {address,stride,count,fields}=table;
 if(!Number.isInteger(address)||address<0||address>=sourceLength||!Number.isInteger(stride)||stride<1||stride>4096||!Number.isInteger(count)||count<1||count>4096||address+stride*count>sourceLength)throw Error('Table address, row size or count is outside this ROM.');
 if(!Array.isArray(fields)||!fields.length||fields.length>32)throw Error('Describe 1–32 typed fields per table.');
 const occupied=new Set(),names=new Set();
 for(const field of fields){
  const n=width(field);
  if(!nameOk(field.name)||names.has(field.name)||!Number.isInteger(field.offset)||field.offset<0||!Number.isInteger(n)||n<1||field.offset+n>stride||(field.type==='ascii'&&n>256))throw Error('Invalid or overlapping table field: '+String(field.name));
  if(field.enumList!==undefined&&(!nameOk(field.enumList)||!['u8','u16','u32'].includes(field.type)))throw Error('HMA labels require an unsigned numeric field.');
  names.add(field.name);
  for(let i=0;i<n;i++){if(occupied.has(field.offset+i))throw Error('Overlapping native table fields.');occupied.add(field.offset+i);}
 }
 return table;
}
export function saveTableDefinition(project,sourceId,source,table){
 validateTable(table,source.length);
 const s=project.hexStudio?.sources?.[sourceId],current=s?.tables||[];
 if(current.length>=64&&!current.some(row=>row.id===table.id))throw Error('Each source allows up to 64 named table layouts.');
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(table.id))throw Error('Table layout needs a stable safe ID.');
 const overlap=current.some(row=>row.name.toLowerCase()===table.name.toLowerCase()&&row.id!==table.id);
 if(overlap)throw Error('Another table has the same name.');
 project.hexStudio??={version:1,sources:{}};project.hexStudio.sources??={};project.hexStudio.sources[sourceId]??={patches:[],tables:[],hmaToml:''};
 const dest=project.hexStudio.sources[sourceId];dest.tables=dest.tables.filter(x=>x.id!==table.id).concat([structuredClone(table)]);
 return table;
}
// Named HMA metadata lists provide labels, never inferred native encodings.
export function hmaListLabels(project,sourceId,source,listName){
 if(!nameOk(listName))throw Error('Choose a named HMA list.');
 const found=hmaMetadata(project,sourceId,source).lists.filter(row=>row.name===listName);
 if(found.length!==1)throw Error('HMA named list is missing or ambiguous.');
 const labels=[],used=new Set();
 const add=(value,label)=>{
  if(!Number.isInteger(value)||value<0||value>65535||typeof label!=='string'||label.length<1||label.length>100||!(/^[\x20-\x7E]+$/.test(label))||used.has(value)||labels.length>=1024)
   throw Error('Invalid, overlapping or excessive numeric HMA labels.');
  used.add(value);labels.push({value,label});
 };
 for(const [key,value] of Object.entries(found[0].values||{})){
  if(!/^(0|[1-9]\d{0,4})$/.test(key))continue;
  const start=Number(key),raw=String(value).trim();
  if(raw.startsWith('[')){
   if(!raw.endsWith(']'))throw Error('Incomplete HMA list array.');
   const inner=raw.slice(1,-1),token=/'''([^'\r\n]{1,100})'''|"""([^"\r\n]{1,100})"""/g;
   const words=[...inner.matchAll(token)].map(m=>m[1]??m[2]);
   if(!words.length||inner.replace(token,'').replace(/[\s,]/g,'')!=='')throw Error('HMA arrays must contain quoted labels only.');
   words.forEach((word,i)=>add(start+i,word));
  }else add(start,raw);
 }
 if(!labels.length)throw Error('No compatible numeric HMA labels found.');
 return labels.sort((a,b)=>a.value-b.value);
}
export function bindTableEnumList(project,sourceId,source,table,fieldName,listName){
 validateTable(table,source.length);
 const field=table.fields.find(row=>row.name===fieldName);
 if(!field||!['u8','u16','u32'].includes(field.type))throw Error('Choose an unsigned u8, u16 or u32 field.');
 const copy=structuredClone(table),target=copy.fields.find(row=>row.name===fieldName);
 if(listName){
  const labels=hmaListLabels(project,sourceId,source,listName),max=2**(types[field.type]*8)-1;
  if(!labels.some(row=>row.value<=max))throw Error('All HMA label codes exceed the native field width.');
  target.enumList=listName;
 }else delete target.enumList;
 saveTableDefinition(project,sourceId,source,copy);
 return {field:fieldName,list:listName||null};
}

export function tableDefinitions(project,sourceId,source){
 return (hexState(project,sourceId)?.tables||[]).map(row=>validateTable(row,source.length));
}
function readInteger(bytes,at,type){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(type==='u8')return dv.getUint8(at);if(type==='s8')return dv.getInt8(at);
 if(type==='u16')return dv.getUint16(at,true);if(type==='s16')return dv.getInt16(at,true);
 if(type==='u32'||type==='ptr')return dv.getUint32(at,true);
 return dv.getInt32(at,true);
}
function bytesFor(type,value,length=0,sourceLength=32*1024*1024){
 if(type==='ascii'){
  const text=String(value);
  if(!/^[\x20-\x7E]*$/.test(text)||text.length>length)throw Error('ASCII field requires up to '+length+' printable ASCII characters.');
  const b=new Uint8Array(length);for(let i=0;i<text.length;i++)b[i]=text.charCodeAt(i);
  return b;
 }
 const n=typeof value==='string'?number(value):value,bits=types[type]*8,signed=type.startsWith('s'),min=signed?-(2**(bits-1)):0,max=signed?2**(bits-1)-1:2**bits-1;
 if(!Number.isInteger(n)||n<min||n>max)throw Error('Choose a '+type+' value between '+min+' and '+max+'.');
 if(type==='ptr'&&n!==0&&(n<0x08000200||n-0x08000000>=sourceLength))throw Error('Pointer must be zero or a valid 0x08xxxxxx source ROM address.');
 const b=new Uint8Array(types[type]),v=new DataView(b.buffer);
 if(type==='u8')v.setUint8(0,n);else if(type==='s8')v.setInt8(0,n);
 else if(type==='u16')v.setUint16(0,n,true);else if(type==='s16')v.setInt16(0,n,true);
 else if(type==='u32'||type==='ptr')v.setUint32(0,n,true);else v.setInt32(0,n,true);
 return b;
}
// Reuse the same native numeric/ASCII codecs for reviewed appended table rows.
export function encodeTableFieldValue(field,value,sourceLength){
 if(!field||!Number.isInteger(width(field))||width(field)<1)throw Error('Choose a recognized native table field.');
 return bytesFor(field.type,value,field.length,sourceLength);
}
export function decodeTableFieldValue(field,bytes){
 if(!field||!(bytes instanceof Uint8Array)||bytes.length!==width(field))throw Error('The native table field byte width is invalid.');
 return field.type==='ascii'?String.fromCharCode(...bytes).replace(/\0.*$/,''):readInteger(bytes,0,field.type);
}

export function tableRecord(project,sourceId,source,table,index){
 validateTable(table,source.length);
 if(!Number.isInteger(index)||index<0||index>=table.count)throw Error('Table record is outside the described range.');
 const base=table.address+index*table.stride,result={index,at:base,values:{}};
 for(const field of table.fields){
  const start=base+field.offset,n=width(field),b=Uint8Array.from({length:n},(_,i)=>stagedROMByte(project,sourceId,source,start+i));
  result.values[field.name]=field.type==='ascii'?String.fromCharCode(...b).replace(/\0.*$/,''):readInteger(b,0,field.type);
 }
 return result;
}
export function editTableField(project,sourceId,source,table,index,fieldName,value){
 validateTable(table,source.length);
 const field=table.fields.find(f=>f.name===fieldName);
 if(!field)throw Error('Choose a recognized table column.');
 if(!Number.isInteger(index)||index<0||index>=table.count)throw Error('Table row is out of range.');
 const bytes=bytesFor(field.type,value,field.length,source.length);
 const at=table.address+index*table.stride+field.offset;
 return stageROMHex(project,sourceId,source,at,bytes);
}

// Only recognize HMA's strictly fixed, inline numeric table subset:
// [field. field: field::]COUNT (. = 1, : = 2, :: = 4 bytes).
// Dynamic counts, pointers, enums, strings, bitfields and compressed data
// are NOT inferred; preserving unsupported metadata is preferable to
// silently misinterpreting engine-native memory.
// Decode only fixed-width inline HMA columns. Named source-length links
// resolve strictly against another anchor's *literal* count. This does not
// infer ROM expansion, follow dynamic lengths or decode pointed-to payloads.
export function fixedNumericHMATable(anchor,sourceLength,{anchors=[]}={}){
 if(!anchor||typeof anchor.format!=='string'||typeof anchor.name!=='string'||!Number.isInteger(anchor.at))return null;
 const match=anchor.format.trim().match(/^\[([^\]\[\r\n]+)\]([^\s\[\]\r\n]+)$/);
 if(!match)return null;
 const suffix=match[2],fields=[],cells=match[1].trim().split(/\s+/);
 let count,linkedLength;
 if(/^[1-9]\d{0,3}$/.test(suffix))count=Number(suffix);
 else {
  const link=suffix.match(/^([A-Za-z_][A-Za-z0-9_.-]*)([+-]\d{1,3})?$/);
  if(!link||!Array.isArray(anchors))return null;
  const candidates=anchors.filter(a=>a.name===link[1]);
  if(candidates.length!==1||candidates[0]===anchor)return null;
  const fixed=String(candidates[0].format||'').trim().match(/^\[[^\[\]\r\n]+\]([1-9]\d{0,3})$/);
  if(!fixed)return null;
  const baseCount=Number(fixed[1]),delta=Number(link[2]||0);
  count=baseCount+delta;
  linkedLength={anchor:link[1],delta,verifiedBaseCount:baseCount};
 }
 if(!cells.length||cells.length>32||!Number.isInteger(count)||count<1||count>4096)return null;
 let stride=0;
 for(const token of cells){
  const pointer=token.match(/^([A-Za-z_][A-Za-z0-9_-]*)<>$/);
  const numeric=token.match(/^([A-Za-z_][A-Za-z0-9_-]*)(::|:|\.)(?:\|([hz]))?$/);
  if(!pointer&&!numeric)return null;
  const name=(pointer||numeric)[1];
  if(fields.some(f=>f.name===name))return null;
  const type=pointer?'ptr':(numeric[2]==='.'?'u8':numeric[2]===':'?'u16':'u32');
  const field={name,type:pointer?'ptr':numeric[3]==='z'?'s'+type.slice(1):type,offset:stride};
  if(numeric?.[3]==='h')field.display='hex';
  fields.push(field);
  stride+=types[field.type];
 }
 if(stride<1||stride>4096||anchor.at<0||anchor.at+stride*count>sourceLength)return null;
 const id='hma-'+anchor.name.replace(/[^A-Za-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,67);
 const table={id,name:anchor.name,address:anchor.at,stride,count,fields};
 if(linkedLength)table.linkedLength=linkedLength;
 try{validateTable(table,sourceLength);}catch{return null;}
 return table;
}

// All row tools operate only within a verified source-bound table layout.
// A row copy intentionally copies opaque padding as well as described fields;
// never guess a new engine table size or silently append native records.
function tableRowStart(table, index) {
 if(!Number.isInteger(index)||index<0||index>=table.count)throw Error('Table row is out of range.');
 return table.address+index*table.stride;
}
function stagedTableRow(project, sourceId, source, table, index) {
 const at=tableRowStart(table,index);
 return Uint8Array.from({length:table.stride},(_,i)=>stagedROMByte(project,sourceId,source,at+i));
}
function stageTableTransaction(project,sourceId,source,writes) {
 // Stage against an isolated patch list. Failure on any later row, the
 // 65,536-byte budget or a stale original source leaves the project untouched.
 const existing=hexState(project,sourceId),draft={hexStudio:{version:1,sources:{
  [sourceId]:{...(existing||{}),patches:(existing?.patches||[]).map(p=>({...p}))}
 }}};
 let changed=0;
 for(const [at,bytes] of writes)changed+=stageROMHex(draft,sourceId,source,at,bytes).changed;
 if(!changed)return {changed:0,total:existing?.patches?.length||0,rows:writes.length};
 project.hexStudio??={version:1,sources:{}};
 project.hexStudio.sources??={};
 project.hexStudio.sources[sourceId]??={patches:[],tables:[],hmaToml:''};
 project.hexStudio.sources[sourceId].patches=draft.hexStudio.sources[sourceId].patches;
 return {changed,total:project.hexStudio.sources[sourceId].patches.length,rows:writes.length};
}
export function copyTableRecord(project,sourceId,source,table,from,to){
 validateTable(table,source.length);
 if(from===to)throw Error('Choose two different table rows.');
 const bytes=stagedTableRow(project,sourceId,source,table,from);
 return stageTableTransaction(project,sourceId,source,[[tableRowStart(table,to),bytes]]);
}
export function swapTableRecords(project,sourceId,source,table,left,right){
 validateTable(table,source.length);
 if(left===right)throw Error('Choose two different table rows.');
 const beforeLeft=stagedTableRow(project,sourceId,source,table,left);
 const beforeRight=stagedTableRow(project,sourceId,source,table,right);
 return stageTableTransaction(project,sourceId,source,[
  [tableRowStart(table,left),beforeRight],[tableRowStart(table,right),beforeLeft]
 ]);
}
export function fillTableColumn(project,sourceId,source,table,fieldName,start,end,value){
 validateTable(table,source.length);
 const field=table.fields.find(f=>f.name===fieldName);
 if(!field)throw Error('Choose a recognized table column.');
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>=table.count||end-start>=256)
  throw Error('Choose an inclusive range of 1–256 existing table rows.');
 const bytes=bytesFor(field.type,value,field.length,source.length);
 const writes=[];
 for(let row=start;row<=end;row++)writes.push([tableRowStart(table,row)+field.offset,bytes]);
 return stageTableTransaction(project,sourceId,source,writes);
}
// Exact typed find-and-replace over existing records. Scan the complete
// requested range before staging; never silently truncate a >256-row match
// set or partially apply writes when the source/patch budget rejects them.
/**
 * Edit a bit range of an existing native unsigned field without altering
 * adjacent flags. Field width and matching ROM source are verified first.
 * This intentionally does NOT decode unsupported HMA bitfield Format syntax.
 */
export function setTableBitRange(project,sourceId,source,table,fieldName,firstRow,lastRow,firstBit,bitCount,value){
 validateTable(table,source.length);
 const field=table.fields.find(f=>f.name===fieldName);
 if(!field||!['u8','u16','u32'].includes(field.type))throw Error('Bit editing requires a recognized unsigned 8/16/32-bit field.');
 if(!Number.isInteger(firstRow)||!Number.isInteger(lastRow)||firstRow<0||lastRow<firstRow||lastRow>=table.count||lastRow-firstRow>=256)
  throw Error('Edit a range of 1–256 existing native rows.');
 const bitWidth=types[field.type]*8;
 if(!Number.isInteger(firstBit)||!Number.isInteger(bitCount)||firstBit<0||bitCount<1||firstBit+bitCount>bitWidth)
  throw Error('Bit start and width must remain inside this field.');
 if(typeof value==='string'&&!value.trim())throw Error('Enter the replacement bit value.');
 const raw=typeof value==='string'?number(value):value,max=(2**bitCount)-1;
 if(!Number.isInteger(raw)||raw<0||raw>max)throw Error('Bit value must fit '+bitCount+' bit(s): 0–'+max+'.');
 const mask=((1n<<BigInt(bitCount))-1n)<<BigInt(firstBit),replacement=BigInt(raw)<<BigInt(firstBit),writes=[];
 for(let row=firstRow;row<=lastRow;row++){
  const at=tableRowStart(table,row)+field.offset;
  const existing=Uint8Array.from({length:types[field.type]},(_,i)=>stagedROMByte(project,sourceId,source,at+i));
  const current=BigInt(readInteger(existing,0,field.type));
  const updated=Number((current&~mask)|replacement);
  writes.push([at,bytesFor(field.type,updated,0,source.length)]);
 }
 const report=stageTableTransaction(project,sourceId,source,writes);
 return {...report,rows:lastRow-firstRow+1,bits:bitCount};
}

export function replaceTableColumnMatches(project,sourceId,source,table,fieldName,oldValue,newValue,{start=0,end=table.count-1}={}){
 validateTable(table,source.length);
 const field=table.fields.find(f=>f.name===fieldName);
 if(!field)throw Error('Choose a recognized table column.');
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>=table.count)
  throw Error('Replacement range must be inside the source table.');
 const before=bytesFor(field.type,oldValue,field.length,source.length);
 const after=bytesFor(field.type,newValue,field.length,source.length);
 const pending=new Map((hexState(project,sourceId)?.patches||[]).map(p=>[p.at,p.after]));
 const writes=[];
 for(let row=start;row<=end;row++){
  const at=tableRowStart(table,row)+field.offset;
  let equal=true;
  for(let i=0;i<before.length;i++)if((pending.get(at+i)??source[at+i])!==before[i]){equal=false;break;}
  if(!equal)continue;
  if(writes.length>=256)throw Error('More than 256 records match; narrow the range before replacing.');
  writes.push([at,after]);
 }
 const result=stageTableTransaction(project,sourceId,source,writes);
 return {...result,matches:writes.length};
}

export function findTableRows(project,sourceId,source,table,fieldName,query,{from=0,limit=32}={}){
 validateTable(table,source.length);
 const field=table.fields.find(f=>f.name===fieldName);
 if(!field)throw Error('Choose a recognized table column.');
 if(!Number.isInteger(from)||from<0||from>=table.count||!Number.isInteger(limit)||limit<1||limit>64)
  throw Error('Table search range is outside the existing rows.');
 const input=String(query??'').trim();
 if(!input||input.length>120)throw Error('Enter a table value to search (maximum 120 characters).');
 const ascii=field.type==='ascii',target=ascii?input.toLowerCase():number(input);
 if(!ascii||typeof target!=='string'){
  if(!ascii&&!Number.isInteger(target))throw Error('Search for a valid decimal or 0x-prefixed numeric value.');
 }
 const staged=new Map((hexState(project,sourceId)?.patches||[]).map(p=>[p.at,p.after]));
 const result=[];
 for(let row=from;row<table.count;row++){
  const at=table.address+row*table.stride+field.offset;
  const bytes=Uint8Array.from({length:width(field)},(_,i)=>staged.get(at+i)??source[at+i]);
  const value=ascii?String.fromCharCode(...bytes).replace(/\0.*$/,''):readInteger(bytes,0,field.type);
  if(ascii?value.toLowerCase().includes(target):value===target){
   result.push({index:row,at:table.address+row*table.stride,value});
   if(result.length===limit)break;
  }
 }
 return result;
}


function parseFixedTableCSV(text){
 if(typeof text!=='string'||text.length>2*1024*1024)throw Error('Table CSV must be UTF-8 text under 2 MiB.');
 const rows=[],row=[];let cell='',quoted=false,closed=false;
 text=text.replace(/^\uFEFF/,'');
 function finish(){row.push(cell);if(row.length>1||row[0]!=='')rows.push(row.slice());row.length=0;cell='';closed=false;if(rows.length>257)throw Error('A table CSV may contain at most 256 records.');}
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
   else cell+=c;
  }else if(c===','){row.push(cell);cell='';closed=false;}
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;finish();}
  else if(c==='"'&&!cell&&!closed)quoted=true;
  else if(c==='"'||closed)throw Error('Malformed CSV quoting at character '+(i+1)+'.');
  else cell+=c;
 }
 if(quoted)throw Error('CSV has an unterminated quoted value.');
 if(cell||row.length||closed)finish();
 return rows;
}
const encodeCSVCell=value=>{
 const str=String(value??'');
 return /[",\r\n]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;
};
export function exportTableCSV(project,sourceId,source,table,{start=0,end=table.count-1}={}){
 validateTable(table,source.length);
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>=table.count)
  throw Error('CSV export range must be within existing source table rows.');
 const edit=new Map((hexState(project,sourceId)?.patches||[]).map(p=>[p.at,p.after]));
 const lines=[['row',...table.fields.map(f=>f.name)].map(encodeCSVCell).join(',')];
 for(let row=start;row<=end;row++){
  const values=[row];
  for(const field of table.fields){
   const at=tableRowStart(table,row)+field.offset;
   const bytes=Uint8Array.from({length:width(field)},(_,i)=>edit.get(at+i)??source[at+i]);
   const raw=field.type==='ascii'?String.fromCharCode(...bytes).replace(/\0.*$/,''):readInteger(bytes,0,field.type);
   values.push(field.type==='ptr'?'0x'+raw.toString(16).toUpperCase().padStart(8,'0'):raw);
  }
  lines.push(values.map(encodeCSVCell).join(','));
 }
 return lines.join('\r\n')+'\r\n';
}
/** Preview validated CSV data in an isolated, never-committed project.
 * Reuse the production parser and staging pipeline to prevent preview/apply drift. */
export function previewTableCSV(project,sourceId,source,table,text){
 validateTable(table,source.length);
 const existing=hexState(project,sourceId),shadow={hexStudio:{version:1,sources:{
  [sourceId]:{...(existing||{}),patches:(existing?.patches||[]).map(p=>({...p}))}
 }}};
 const result=importTableCSV(shadow,sourceId,source,table,text);
 // The actual changed-byte count is the difference in resulting staged state.
 const oldPatches=new Map((existing?.patches||[]).map(p=>[p.at,p.after]));
 const newPatches=shadow.hexStudio.sources[sourceId].patches||[];
 const combined=new Set([...oldPatches.keys(),...newPatches.map(p=>p.at)]);
 const newest=new Map(newPatches.map(p=>[p.at,p.after]));
 let changedBytes=0;for(const at of combined)if((newest.get(at)??source[at])!==(oldPatches.get(at)??source[at]))changedBytes++;
 // CSV imports at most 256 row IDs. Summarise only the first eight changed
 // records to keep the Android preview compact even for very wide tables.
 const affected=new Set();
 for(const at of combined)if((newest.get(at)??source[at])!==(oldPatches.get(at)??source[at])){
  const row=Math.floor((at-table.address)/table.stride);
  if(row>=0&&row<table.count)affected.add(row);
 }
 const rows=[...affected].sort((a,b)=>a-b);
 const samples=rows.slice(0,8).map(row=>({row,before:tableRecord(project,sourceId,source,table,row).values,after:tableRecord(shadow,sourceId,source,table,row).values}));
 return {...result,changedBytes,changedRows:rows.length,samples,moreRows:Math.max(0,rows.length-samples.length)};
}
/** Add a signed delta to an existing numeric field in up to 256 native rows.
 * Every target is encoded and validated before a single atomic commit. */
export function adjustTableColumn(project,sourceId,source,table,fieldName,start,end,delta){
 validateTable(table,source.length);
 const field=table.fields.find(f=>f.name===fieldName);
 if(!field||!['u8','s8','u16','s16','u32','s32'].includes(field.type))
  throw Error('Choose an integer field; arithmetic on raw pointers is unsafe.');
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>=table.count||end-start>=256)
  throw Error('Adjust between 1 and 256 original table rows.');
 const amount=typeof delta==='string'?number(delta):delta;
 if(!Number.isSafeInteger(amount)||typeof delta==='string'&&!delta.trim())
  throw Error('Enter a valid integer delta.');
 const writes=[];
 for(let row=start;row<=end;row++){
  const at=tableRowStart(table,row)+field.offset;
  const current=Uint8Array.from({length:width(field)},(_,i)=>stagedROMByte(project,sourceId,source,at+i));
  const next=readInteger(current,0,field.type)+amount;
  if(!Number.isSafeInteger(next))throw Error('Adjusted table value is outside safe numeric bounds.');
  writes.push([at,bytesFor(field.type,next,field.length,source.length)]);
 }
 return {...stageTableTransaction(project,sourceId,source,writes),rows:end-start+1,delta:amount};
}

export function importTableCSV(project,sourceId,source,table,text){
 validateTable(table,source.length);
 const rows=parseFixedTableCSV(text);
 if(rows.length<2)throw Error('CSV must include a header and at least one existing table record.');
 const header=rows[0];
 if(header[0]!=='row'||header.length<2||header.length>table.fields.length+1)
  throw Error('CSV header must begin with row and list one or more existing columns.');
 const known=new Map(table.fields.map(f=>[f.name,f]));
 const selected=header.slice(1).map(name=>{
  if(!known.has(name))throw Error('Unknown CSV table column: '+name);
  return known.get(name);
 });
 if(new Set(header).size!==header.length)throw Error('CSV contains duplicated column names.');
 const writes=[],used=new Set();
 for(const cells of rows.slice(1)){
  if(cells.length!==header.length)throw Error('CSV record width differs from its header.');
  if(!/^\d+$/.test(cells[0]))throw Error('CSV row must use an existing zero-based row number.');
  const row=Number(cells[0]);
  if(!Number.isSafeInteger(row)||row>=table.count||used.has(row))throw Error('CSV row is duplicated or outside this original table.');
  used.add(row);
  selected.forEach((field,i)=>{
   const value=cells[i+1],bytes=bytesFor(field.type,value,field.length,source.length);
   writes.push([tableRowStart(table,row)+field.offset,bytes]);
  });
  if(writes.length>2048)throw Error('Import at most 2,048 individual typed CSV cells per batch.');
 }
 const result=stageTableTransaction(project,sourceId,source,writes);
 return {...result,records:used.size,cells:writes.length};
}
