// Standard binary IPS PATCH/EOF format. No source checksum exists in IPS;
// use a matching, backed-up ROM and verify the generated result byte-for-byte.
const MAX_ROM=32*1024*1024,MAX_OFFSET=0xFFFFFF,EOF_AT=0x454F46,MAX_RECORD=0xFFFF;
const header=Uint8Array.from([80,65,84,67,72]),eof=Uint8Array.from([69,79,70]);
function verify(a,label){if(!(a instanceof Uint8Array)||a.length<512||a.length>MAX_ROM)throw Error(label+' must be a GBA ROM of 512 bytes–32 MiB.');}
function put24(out,n){out.push(n>>>16&255,n>>>8&255,n&255);}
function read24(b,at){return (b[at]<<16)|(b[at+1]<<8)|b[at+2];}
export function createIPS(source,target){
 verify(source,'Original');verify(target,'Edited');
 const out=[...header];let at=0,records=0,changed=0;
 while(at<target.length){
  if(at<source.length&&source[at]===target[at]){at++;continue;}
  let start=at;
  // 0x454F46 is the ASCII "EOF" trailer and cannot start an IPS record.
  // Include the unchanged preceding byte in the record to cover it safely.
  if(start===EOF_AT)start--;
  if(start>MAX_OFFSET)throw Error('Standard IPS cannot encode changes at or beyond the 16 MiB address limit. Use BPS for expanded ROMs.');
  let end=Math.min(target.length,start+MAX_RECORD);
  for(let n=at+1;n<end;n++)if(n<source.length&&source[n]===target[n]){end=n;break;}
  // When at was brought back for reserved EOF marker, still emit changed byte.
  if(end<=at)end=at+1;
  const size=end-start;
  if(!size||size>MAX_RECORD)throw Error('IPS record exceeds its 65,535-byte limit.');
  put24(out,start);out.push(size>>>8,size&255);
  for(let i=start;i<end;i++)out.push(target[i]);
  records++;changed+=end-at;at=end;
  if(out.length>MAX_ROM+1024)throw Error('IPS patch exceeds the safe 32 MiB output limit.');
 }
 out.push(...eof);
 // Optional three-byte target length is standardized but 16 MiB/32 MiB
 // exact lengths do not fit. For unchanged length no truncate is needed.
 if(target.length!==source.length){
  if(target.length>MAX_OFFSET){
   if(target.length<source.length)throw Error('IPS cannot express this target ROM truncation. Use BPS.');
   // 16/32 MiB growth with edits past 16 MiB fails above. Trailing zeros
   // require an explicit last byte and were emitted by the loop.
  }else put24(out,target.length);
 }
 const bytes=Uint8Array.from(out),tested=applyIPS(source,bytes);
 if(tested.bytes.length!==target.length||tested.bytes.some((v,i)=>v!==target[i]))throw Error('IPS patch did not reproduce the edited ROM. No patch was emitted.');
 return{bytes,records,changed};
}
export function applyIPS(source,patch){
 verify(source,'Original');
 if(!(patch instanceof Uint8Array)||patch.length<8||patch.length>MAX_ROM+1024||header.some((v,i)=>patch[i]!==v))throw Error('Choose a valid IPS PATCH file.');
 let pos=5,bytes=source.slice(),records=0;
 while(true){
  if(pos+3>patch.length)throw Error('Truncated IPS EOF marker.');
  if(eof.every((v,i)=>patch[pos+i]===v)){pos+=3;break;}
  if(pos+5>patch.length)throw Error('Truncated IPS record header.');
  const start=read24(patch,pos),size=patch[pos+3]<<8|patch[pos+4];pos+=5;
  let end,length=size;
  if(size===0){if(pos+3>patch.length)throw Error('Truncated IPS RLE record.');length=patch[pos]<<8|patch[pos+1];pos+=2;}
  end=start+length;
  if(length===0||end>MAX_ROM)throw Error('IPS edit extends beyond the supported 32 MiB ROM limit.');
  if(pos+(size||1)>patch.length)throw Error('Truncated IPS edit data.');
  if(end>bytes.length){const expanded=new Uint8Array(end);expanded.set(bytes);bytes=expanded;}
  if(size){bytes.set(patch.subarray(pos,pos+size),start);pos+=size;}
  else bytes.fill(patch[pos++],start,end);
  if(++records>1000000)throw Error('Excessive IPS record count.');
 }
 if(pos<patch.length){
  if(pos+3!==patch.length)throw Error('Unexpected trailing IPS bytes.');
  const length=read24(patch,pos);
  if(length<512||length>MAX_ROM)throw Error('IPS truncate length is outside supported ROM limits.');
  if(length!==bytes.length){const adjusted=new Uint8Array(length);adjusted.set(bytes.subarray(0,length));bytes=adjusted;}
 }
 return{bytes,records};
}
