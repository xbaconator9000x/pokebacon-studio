const enc = new TextEncoder();
const table = Array.from({length: 256}, (_, n) => {for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0;});
export function crc32(bytes) {let n = 0xffffffff; for (const b of bytes) n = table[(n ^ b) & 255] ^ (n >>> 8); return (n ^ 0xffffffff) >>> 0;}
export function makeZip(entries) {
  const parts = [], records = []; let offset = 0;
  const now = new Date(), date = ((Math.max(1980,now.getFullYear()) - 1980) << 9) | ((now.getMonth()+1) << 5) | now.getDate(), time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  for (const [name, value] of entries) {
    const filename = enc.encode(name), data = typeof value === 'string' ? enc.encode(value) : value;
    const head = new Uint8Array(30 + filename.length), v = new DataView(head.buffer), crc = crc32(data);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(10,time,true);v.setUint16(12,date,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,filename.length,true);head.set(filename,30);
    parts.push(head,data);
    const rec = new Uint8Array(46 + filename.length), c = new DataView(rec.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(12,time,true);c.setUint16(14,date,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);rec.set(filename,46);
    records.push(rec); offset += head.length + data.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer), centralSize = records.reduce((n,r) => n+r.length,0);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...parts,...records,end],{type:'application/zip'});
}

// Compress incrementally and yield during checksums; large ROM archives must not
// block the WebView or pass three uncompressed copies through the Android bridge.
export async function makeZipAsync(entries,{progress=()=>{},yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const parts=[],records=[];let offset=0;const now=new Date(),date=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(),time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
 for(let index=0;index<entries.length;index++){
  const[name,value]=entries[index],filename=enc.encode(name);progress(`Packing ${name} (${index+1}/${entries.length})…`);await yieldTask();
  const data=value instanceof Blob?value:new Blob([value]);let crc=0xffffffff;const input=data.stream().getReader();for(;;){const{value:chunk,done}=await input.read();if(done)break;for(let i=0;i<chunk.length;i++)crc=table[(crc^chunk[i])&255]^(crc>>>8);await yieldTask();}crc=(crc^0xffffffff)>>>0;
  let compressor;try{compressor=new CompressionStream('deflate-raw');}catch{throw Error('Compressed ROM archives need an updated Android System WebView. Save the .gba and matching .json separately on this device.');}
  const packed=await new Response(data.stream().pipeThrough(compressor)).blob(),head=new Uint8Array(30+filename.length),v=new DataView(head.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,8,true);v.setUint16(10,time,true);v.setUint16(12,date,true);v.setUint32(14,crc,true);v.setUint32(18,packed.size,true);v.setUint32(22,data.size,true);v.setUint16(26,filename.length,true);head.set(filename,30);parts.push(head,packed);
  const rec=new Uint8Array(46+filename.length),c=new DataView(rec.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(10,8,true);c.setUint16(12,time,true);c.setUint16(14,date,true);c.setUint32(16,crc,true);c.setUint32(20,packed.size,true);c.setUint32(24,data.size,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);rec.set(filename,46);records.push(rec);offset+=head.length+packed.size;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer),centralSize=records.reduce((n,r)=>n+r.length,0);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);return new Blob([...parts,...records,end],{type:'application/zip'});
}
