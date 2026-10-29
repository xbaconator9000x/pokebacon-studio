import {GbaMaps} from './rom.js';
const fail=(name,detail)=>{throw Error(name+': native export verification failed ('+detail+'). No ROM was exported.');};
export function validateNativeMovement(rule,name='Map'){
 for(const [field,max] of [['collision',3],['elevation',15]])if(!Number.isInteger(rule[field])||rule[field]<0||rule[field]>max)fail(name,'invalid '+field+' value');
 return rule;
}
export function verifyNativePaletteBudget(planes,name='Map',paletteCount=13){
 const colors=new Set(),layers=[planes.upper,planes.middle,planes.lower].filter(Boolean);if(!layers.length)return 0;
 for(let i=0;i<layers[0].data.length;i+=4){const p=layers.find(p=>p.data[i+3]>=128);if(!p)continue;const a=p.data;colors.add(Math.round(a[i]*31/255)|Math.round(a[i+1]*31/255)<<5|Math.round(a[i+2]*31/255)<<10);}
 const maximum=paletteCount*15;if(colors.size>maximum)fail(name,colors.size+' visible GBA colors exceed '+paletteCount+' map palettes ('+maximum+' opaque colors). Artwork needs palette consolidation; layers and collision were not changed');return colors.size;
}
// Check the actual 4bpp transparency of the top plane, not the composited image.
export function verifyForegroundOwnership(compiler,id,upper,layerType,name='Map'){
 if(compiler.layerCount===2&&layerType===1)return;
 const layer=compiler.layerCount-1;
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const q=(y>>3)*2+(x>>3),at=id*compiler.stride+(layer*4+q)*2,word=compiler.metatileWord?compiler.metatileWord(id,layer,q):compiler.meta[at]|compiler.meta[at+1]<<8;
  const sx=word&1024?7-(x&7):x&7,sy=word&2048?7-(y&7):y&7,byte=compiler.gfx[(word&1023)*32+sy*4+(sx>>1)],opaque=!!(sx&1?byte>>4:byte&15);
  if(opaque!==!!upper[(y*16+x)*4+3])fail(name,'foreground ownership at pixel '+x+','+y);
 }
}
// Reopen completed bytes after ALL writers have run. Check native map words,
// attributes, 8x8 tile references, indexed graphics and palettes independently.
export async function verifyCompiledMaps(bytes,plans,{progress=()=>{}}={}){
 if(!plans.length)return{maps:0,cells:0,metatiles:0};
 const reader=await new GbaMaps(bytes).discover(),checked=new Map();let cells=0,metatiles=0;
 for(const plan of plans){const {key,name,width,height,words,compiler:c}=plan,native=reader.byKey(key);progress('Verifying '+name+'…');
  if(!native||native.layout.width!==width||native.layout.height!==height)fail(name,'map binding or dimensions');
  const profile=reader.profile(native);if(profile.metatileLayers!==c.layerCount||profile.metatileBytes!==c.stride||profile.primaryCount!==c.split||profile.graphicsCount!==c.gfxSplit||profile.attributeSize!==c.attrSize)fail(name,'tileset format: decoded '+JSON.stringify(profile)+'; expected '+JSON.stringify({metatileLayers:c.layerCount,metatileBytes:c.stride,primaryCount:c.split,graphicsCount:c.gfxSplit}));
  const actual=reader.blocks(native);if(actual.length!==words.length)fail(name,'map length');
  for(let i=0;i<words.length;i++)if(actual[i]!==words[i])fail(name,'map cell '+i%width+','+Math.floor(i/width)+' collision/elevation/metatile');
  cells+=words.length;
  const pair=reader.pairKey(native);let cache=checked.get(pair);if(!cache){cache={compiler:c,ids:new Set(),tiles:new Set(),palettes:new Set()};checked.set(pair,cache);}else if(cache.compiler!==c)fail(name,'shared tileset binding');
  const primary=reader.tileset(native.layout.primary,c.attrSize),secondary=reader.tileset(native.layout.secondary,c.attrSize),graphics=[reader.graphics(primary),reader.graphics(secondary)];
  for(const word of [...actual,...plan.extraIds||[]]){const id=word&1023;if(cache.ids.has(id))continue;cache.ids.add(id);metatiles++;const secondaryId=id>=c.split,tileset=secondaryId?secondary:primary,index=secondaryId?id-c.split:id,attribute=c.attrSize===4?reader.u32(tileset.attrs+index*4):reader.u16(tileset.attrs+index*2);
   const expectedAttribute=c.installed?reader.encodeAttribute(c.attrs[id]):(c.attrSize===4?c.reader.u32((secondaryId?c.atlas.secondary:c.atlas.primary).attrs+index*4):c.reader.u16((secondaryId?c.atlas.secondary:c.atlas.primary).attrs+index*2));
   if(attribute!==expectedAttribute)fail(name,'metatile '+id+' behavior/render attributes');
   for(let offset=0;offset<(c.mixedLayers&&(c.attrs[id]>>>29&3)===3?24:c.stride);offset+=2){const mini=reader.u16(tileset.metatiles+index*c.stride+offset),expected=c.installed?(c.meta[id*c.stride+offset]|c.meta[id*c.stride+offset+1]<<8):c.reader.u16((secondaryId?c.atlas.secondary:c.atlas.primary).metatiles+index*c.stride+offset);if(mini!==expected)fail(name,'metatile '+id+' artwork plane');
    const tile=mini&1023,pal=mini>>12;if(!cache.tiles.has(tile)){cache.tiles.add(tile);const bank=tile>=c.gfxSplit?1:0,begin=(bank?tile-c.gfxSplit:tile)*32;for(let k=0;k<32;k++)if(graphics[bank][begin+k]!==(c.installed?c.gfx[tile*32+k]:c.reader.graphics(bank?c.atlas.secondary:c.atlas.primary)[begin+k]))fail(name,'indexed graphics tile '+tile);}
    if(!cache.palettes.has(pal)){cache.palettes.add(pal);const source=pal<profile.primaryPalettes?primary:secondary;for(let k=0;k<32;k++)if(reader.bytes[source.palettes+pal*32+k]!==c.palettes[pal*32+k])fail(name,'palette '+pal);}
   }
  }
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return{maps:plans.length,cells,metatiles};
}
