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
