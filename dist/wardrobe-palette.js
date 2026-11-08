import {discoverWardrobe as discoverTables} from './wardrobe-native.js';

// Shattered stores one 96-byte walking/running/portrait palette bank per
// outfit. Bind each decoded pose to its own bank rather than a shared base row.
export function wardrobePaletteAddress(origin,{gender,slot,view}){
 const index=(gender==='female'?144:0)+slot-1;
 const pose=['walking','running','portrait'].indexOf(view);
 return pose<0?null:origin+index*96+pose*32;
}

export function discoverWardrobe(reader){
 const result=discoverTables(reader);
 if(!result)return null;
 const origin=result.rows.find(row=>row.category==='outfit')?.paletteAddress;
 if(!Number.isInteger(origin))return null;
 for(const row of result.rows){
  if(row.category!=='outfit')continue;
  const address=wardrobePaletteAddress(origin,row);
  if(address===null||address<0||address+32>reader.bytes.length)return null;
  for(let i=0;i<16;i++)if((reader.bytes[address+i*2]|reader.bytes[address+i*2+1]<<8)>=0x8000)return null;
  row.paletteAddress=address;
 }
 return result;
}
