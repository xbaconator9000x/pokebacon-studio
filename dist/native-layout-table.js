// FRLG SetCurrentMapLayout -> native layout getter. Match instructions, not
// a hard-coded table address: expanded ROMs can retain old header aliases.
const getterHex='00b503480068418e002903d1002006e0085000030348013989000918086802bc08470000';
const setterPrefix='00b5044909684886',setterSuffix='0249086001bc0047';
function matches(r,at,hex){return r.valid(at,hex.length/2)&&Array.from({length:hex.length/2},(_,i)=>r.u8(at+i)===parseInt(hex.slice(i*2,i*2+2),16)).every(Boolean);}
function callTarget(r,at){const hi=r.u16(at),lo=r.u16(at+2);if((hi&0xf800)!==0xf000||(lo&0xf800)!==0xf800)return -1;let d=(hi&2047)<<12|(lo&2047)<<1;if(d&0x400000)d-=0x800000;return at+4+d;}
export function discoverExecutableLayoutTable(reader,ids){
 if(reader.engine!=='frlg'||!ids.size)return null;
 const r=reader,candidates=new Map(),last=Math.max(...ids.keys());
 for(let at=512;at+28<=r.size;at+=4){
  if(r.u32(at)!==0x4904b500||!matches(r,at,setterPrefix)||!matches(r,at+12,setterSuffix)||r.u32(at+20)!==0x03005008||r.u32(at+24)!==0x02036dfc)continue;
  const getter=callTarget(r,at+8);if(getter<512||!matches(r,getter,getterHex))continue;
  const table=r.ptr(getter+36);if(table<512||!r.valid(table,last*4))continue;
  // Every referenced ID must still point to a structurally valid native
  // layout. Its canonical variant need not equal the header's live variant.
  if(![...ids.keys()].every(id=>r.layoutAt(r.ptr(table+(id-1)*4))))continue;
  if(![...ids].some(([id,layouts])=>layouts.has(r.ptr(table+(id-1)*4))))continue;
  const prior=candidates.get(table);if(prior)prior.setters.push(at);else candidates.set(table,{address:table,getter,setters:[at],pointerLiteral:getter+36});
 }
 if(candidates.size>1)throw Error('Several native layout loaders use different global tables. No ROM was exported.');
 return candidates.size?[...candidates.values()][0]:null;
}
export function isolateMapHeader(output,reader,map,banks=new Map()){
 if(!reader.maps.some(other=>other.key!==map.key&&other.address===map.address))return map;
 const originalBank=reader.ptr(reader.mapTable+map.bank*4);if(originalBank<512||reader.ptr(originalBank+map.index*4)!==map.address)throw Error('The shared map header has no verified bank entry.');
 let bank=originalBank;
 if(Array.from({length:reader.bankCount},(_,i)=>reader.ptr(reader.mapTable+i*4)).filter(p=>p===originalBank).length>1){
  if(!banks.has(map.bank)){const count=Math.max(...reader.maps.filter(m=>m.bank===map.bank).map(m=>m.index))+1,data=new Uint8Array((count+1)*4);data.set(reader.bytes.subarray(originalBank,originalBank+count*4));const at=output.allocate(data,'Isolated map bank');output.int(reader.mapTable+map.bank*4,0x08000000+at);banks.set(map.bank,at);}
  bank=banks.get(map.bank);
 }
 const at=output.allocate(reader.bytes.slice(map.address,map.address+28),'Isolated map header');output.int(bank+map.index*4,0x08000000+at);
 return{...map,sourceAddress:map.address,address:at};
}
