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
  const assign=line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
  if(!assign)continue;
  const key=assign[1],value=assign[2];
  // Multi-line arrays are left as raw metadata. Import must preserve the exact
  // complete TOML document, not pretend to interpret unknown HMA structures.
  if(value==='['||value.startsWith('[')&&!value.includes(']')){multi=key;buffer=value;continue;}
  if(multi){if(value.includes(']')){record[multi]=buffer+'\n'+line;multi=null;buffer='';}else buffer+='\n'+line;continue;}
  record[key]=quoted(value);
  if(section==='General')general[key]=record[key];
 }
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
export function fixedNumericHMATable(anchor,sourceLength){
 if(!anchor||typeof anchor.format!=='string'||typeof anchor.name!=='string'||!Number.isInteger(anchor.at))return null;
 const match=anchor.format.trim().match(/^\[([^\]\[\r\n]+)\]([1-9]\d{0,3})$/);
 if(!match)return null;
 const cells=match[1].trim().split(/\s+/),count=Number(match[2]),fields=[];
 if(!cells.length||cells.length>32||count>4096)return null;
 let stride=0;
 for(const token of cells){
  const parsed=token.match(/^([A-Za-z_][A-Za-z0-9_-]*)(::|:|\.)$/);
  if(!parsed||fields.some(f=>f.name===parsed[1]))return null;
  const type=parsed[2]==='.'?'u8':parsed[2]===':'?'u16':'u32';
  fields.push({name:parsed[1],type,offset:stride});
  stride+=types[type];
 }
 if(stride<1||stride>4096||anchor.at<0||anchor.at+stride*count>sourceLength)return null;
 const id='hma-'+anchor.name.replace(/[^A-Za-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,67);
 const table={id,name:anchor.name,address:anchor.at,stride,count,fields};
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
