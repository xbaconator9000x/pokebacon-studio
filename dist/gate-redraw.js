/**
 * Read-only discovery of the verified FRLG DrawWholeMapView special.
 * Evidence: pret/pokefirered src/scrcmd.c, src/field_camera.c, data/specials.inc;
 * validated against the supplied verified source profile ROM. No game-code offsets.
 * Expanded TRE and Heart and Soul adapters require the exact source SHA-256,
 * verified dispatch tables and complete inlined drawing bodies. Both native
 * special calls have been checked against mGBA tilemap buffers. It never
 * writes source ROM bytes.
 */
export function discoverGateRedraw(reader, {sourceSha256=null}={}) {
  const expanded=discoverExpandedGateRedraw(reader,sourceSha256);
  if(expanded)return expanded;
  if (reader?.engine !== 'frlg') return null;
  const bytes = reader.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 0x1000) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), size=bytes.length, BASE=0x08000000;
  const valid=(at,n=1)=>Number.isInteger(at)&&at>=0&&at+n<=size;
  const u16=at=>valid(at,2)?view.getUint16(at,true):0;
  const u32=at=>valid(at,4)?view.getUint32(at,true):0;
  const thumb=p=>p>BASE+0x200&&p<BASE+size&&(p&1)===1;
  const offset=p=>(p&~1)-BASE;
  const same=(at,needle)=>valid(at,needle.length)&&needle.every((n,i)=>bytes[at+i]===n);
  const nop=p=>thumb(p)&&same(offset(p),[0x00,0x20,0x70,0x47]);
  const ram=p=>p%4===0&&((p>=0x02000000&&p<0x02040000)||(p>=0x03000000&&p<0x03008000));
  // First 18 bytes of the verified wrapper: signed saved x/y, current map layout.
  const wrapper=[0x00,0xb5,0x06,0x48,0x01,0x68,0x00,0x22,0x88,0x5e,0x02,0x22,0x89,0x5e,0x04,0x4a,0x12,0x68];
  // The called draw routine saves x, y, layout and enters its 32x32 tile loops.
  const drawBody=[0xf0,0xb5,0x57,0x46,0x4e,0x46,0x45,0x46,0xe0,0xb4,0x81,0xb0];
  const verifiedWrapper=fn=>{
    if(!same(fn,wrapper)||!same(fn+22,[0x01,0xbc,0x00,0x47]))return false;
    const a=u16(fn+18),b=u16(fn+20);
    if((a&0xf800)!==0xf000||(b&0xf800)!==0xf800)return false;
    let displacement=((a&0x7ff)<<12)|((b&0x7ff)<<1);
    if(displacement&0x400000)displacement-=0x800000;
    const body=fn+22+displacement;
    if(body!==fn+36||!same(body,drawBody))return false;
    const savePtr=u32(fn+28),mapPtr=u32(fn+32);
    return ram(savePtr)&&ram(mapPtr)&&savePtr!==mapPtr;
  };
  const matches=new Map();
  for(let table=0x200;table+0xd5*4<=size;table+=4){
    const p0=u32(table),p1=u32(table+4);
    if(!nop(p0)||!nop(p1))continue;
    let good=true,lo=BASE+size,hi=0;
    for(let i=0;i<0xd5;i++){
      const p=u32(table+i*4);if(!thumb(p)){good=false;break;}lo=Math.min(lo,p);hi=Math.max(hi,p);
    }
    if(!good||hi-lo>0x100000)continue;
    const handler=offset(u32(table+0x25*4));
    if(!valid(handler,0x80)||u16(handler)!==0xb500)continue;
    // Decode Thumb PC-relative LDR literals in the handler. The verified handler
    // has both table/end literals. Candidate tables must be independently valid.
    for(let at=handler;at<handler+0x70;at+=2){
      const ins=u16(at);if((ins&0xf800)!==0x4800)continue;
      const literal=((BASE+at+4)&~3)+(ins&255)*4-BASE,sp=u32(literal)-BASE;
      if(!valid(sp,143*4)||sp%4)continue;
      let pointers=true;for(let i=0;i<143;i++)if(!thumb(u32(sp+i*4))){pointers=false;break;}
      if(!pointers)continue;
      const drawAddress=offset(u32(sp+142*4));
      if(!verifiedWrapper(drawAddress))continue;
      matches.set(table+':'+sp,{index:142,commandTable:table,specialTable:sp,specialHandler:handler,drawAddress,profile:'verified-frlg-draw-whole-map-view'});
    }
  }
  return matches.size===1?[...matches.values()][0]:null;
}

// These exact builds shift the special index. The native routines are GCC
// inlined forms of pokeemerald-expansion src/field_camera.c DrawWholeMapView.
// Match the entire function, complete special handler and both table slots.
// SHA comes from the app's already verified source, never the GBA game code.
const EXPANDED_GATE_REDRAW = [
  {
    "name": "tre-3.04-v1.7",
    "sha256": "f8e990f4951df3bf1409d07bbd2d04b622dada5445610731d192103f9a712c58",
    "index": 138,
    "specialTable": 2149776,
    "commandTable": 2148728,
    "specialHandler": 1692952,
    "drawAddress": 1031928,
    "handlerHex": "30b506f099fe0c4b1b680c4d8400002b07d0e0222b5912051340a0221205934206d12b5903f0d7fe002030bc02bc084707f012f9f5e7c046c81f000390cd2008",
    "drawHex": "f0b54546de464e465746e0b5204b1b6800215a5e02269e5f1e4b1b689346984600241d4deb7ae3181b061b0e1f2b02d9203b1b061b0e620892465b0199460027b244ab7afb181b061b0e1f2b02d9203b1b061b0e4b447a081904404653465a44090cfff741ffbb1c1b061f0e202fe8d102342406240e202cd4d101232b73f0bcbb46b246a946a046f0bc01bc0047c046f0400003a0110002d00b0003"
  },
  {
    "name": "heart-and-soul-2.0.6",
    "sha256": "cdfb9e1f83f72c05cb47af40fdf5635567b1973bcb759e070ad0971f67a49191",
    "index": 145,
    "specialTable": 2703400,
    "commandTable": 2702320,
    "specialHandler": 2109592,
    "drawAddress": 1268848,
    "handlerHex": "30b504f069ff0c4b1b680c4d8400002b07d0e0222b5912051340a0221205934206d12b5904f068fe002030bc02bc084705f086faf5e7c046d81f000328402908",
    "drawHex": "f0b54546de464e465746e0b5204b1b6804215a5e06269e5f1e4b1b689346984600241d4deb78e3181b061b0e1f2b02d9203b1b061b0e620892465b0199460027b244ab78fb181b061b0e1f2b02d9203b1b061b0e4b447a081904404653465a44090cfff791febb1c1b061f0e202fe8d102342406240e202cd4d101232b71f0bcbb46b246a946a046f0bc01bc0047c046d84100030c1d0002dc0b0003"
  }
];
function discoverExpandedGateRedraw(reader,sourceSha256){
 if(reader?.engine!=='rse'||typeof sourceSha256!=='string')return null;
 const p=EXPANDED_GATE_REDRAW.find(p=>p.sha256===sourceSha256),bytes=reader.bytes;if(!p||!(bytes instanceof Uint8Array))return null;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u32=at=>at>=0&&at+4<=bytes.length?view.getUint32(at,true):0;
 const same=(at,hex)=>at>=0&&at+hex.length/2<=bytes.length&&Array.from({length:hex.length/2},(_,i)=>parseInt(hex.slice(i*2,i*2+2),16)).every((v,i)=>bytes[at+i]===v);
 if(u32(p.specialTable+p.index*4)!==0x08000000+p.drawAddress+1||u32(p.commandTable+0x25*4)!==0x0a000000+p.specialHandler+1||!same(p.specialHandler,p.handlerHex)||!same(p.drawAddress,p.drawHex))return null;
 return{index:p.index,commandTable:p.commandTable,specialTable:p.specialTable,specialHandler:p.specialHandler,drawAddress:p.drawAddress,profile:'verified-expanded-draw-whole-map-view-'+p.name,sourceSha256};
}
