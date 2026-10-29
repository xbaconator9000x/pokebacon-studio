// Verified Shattered 0.71 native graphics/palette resolvers, from linked.o.
// Table 0 supplies ordinary object IDs; palette tags select a separate bank.
const checks=[
 [0x12782bc,'70b50406050a240eff2d17d10f2c0cd81f4b2840c0181f4b00f020fb030a1b0604061b0e240eff2b26d11b4ba400e4182068002801d1184b186c70bd2b00062c01d00d2c20d1002d16d11448114b00f005fb00280fd0030a1b0604061b0e240eef2ce0d9002bded1103420060c4b000e00f0f4fad2e72b000a4a9b009b58002bd3d0a400e058d4e7ef2cebd8f4e7c04628500000211e07082c403c08245000005d1e0708bc2c4209'],
 [0x12bd55c,'034b000a8200d358002b00d10b20704758df4109']
];
export function discoverExpandedFieldGraphics(r){
 if(r.engine!=='frlg'||!checks.every(([at,hex])=>r.valid(at,hex.length/2)&&Array.from({length:hex.length/2},(_,i)=>r.u8(at+i)===parseInt(hex.slice(i*2,i*2+2),16)).every(Boolean)))return null;
 const table=r.ptr(0x1422cbc),paletteSwitcher=0x141df58,sprites={};
 if(table!==0x3c402c)return null;
 for(const id of [95,96,97]){
  const info=r.ptr(table+id*4);
  if(!r.valid(info,36)||r.u16(info)!==65535||r.u16(info+6)!==128||r.u16(info+8)!==16||r.u16(info+10)!==16)return null;
  const paletteTag=r.u16(info+2),images=r.ptr(info+28),pixels=r.ptr(images);
  if(!r.valid(images,8)||r.u16(images+4)!==128||!r.valid(pixels,128))return null;
  let paletteTable=r.ptr(paletteSwitcher+(paletteTag>>>8)*4);
  if(paletteTable<0)paletteTable=r.ptr(paletteSwitcher+11*4);
  if(paletteTable<0)return null;
  const matches=[];
  for(let i=0;i<256;i++){
   const at=paletteTable+i*8;if(!r.valid(at,8))return null;
   const palette=r.ptr(at);if(palette<0)break;
   if(r.u16(at+4)===paletteTag&&r.u16(at+6)===0&&r.valid(palette,32)&&Array.from({length:16},(_,j)=>r.u16(palette+j*2)<0x8000).every(Boolean))matches.push(palette);
  }
  if(matches.length!==1)return null;
  sprites[id]={id,info,width:16,height:16,size:128,paletteTag,palette:matches[0],images,pixels};
 }
 return{table,paletteSwitcher,sprites,signature:'verified-expanded-object-and-banked-palette-resolvers'};
}
