// Build the off-map repeat from a complete boundary object on generated maps.
// Words are already compiled, so palette, layering and metatile IDs match the map.
export function generatedBorder(map,words,layoutSize){
 const p=map.borderPattern??map.generator?.borderPattern;if(!p)return null;if(layoutSize!==28)throw Error('This ROM layout cannot store a complete boundary pattern. A border adapter is required before exporting this settlement.');
 if(p.assemblyId&&!map.nativeAssemblies?.some(a=>a.id===p.assemblyId&&a.x===p.x&&a.y===p.y&&a.w===p.w&&a.h===p.h))throw Error('The boundary object was moved or removed. Regenerate the settlement border before exporting.');
 if(![p.x,p.y,p.w,p.h].every(Number.isInteger)||p.w<1||p.h<1||p.w>255||p.h>255||p.x<0||p.y<0||p.x+p.w>map.width||p.y+p.h>map.height)throw Error('The off-map border sample no longer fits. Choose a complete pattern inside this map.');
 const bytes=new Uint8Array(p.w*p.h*2),v=new DataView(bytes.buffer);
 for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++)v.setUint16((y*p.w+x)*2,(words[(p.y+y)*map.width+p.x+x]&~0xc00)|0x400,true);
 return{bytes,width:p.w,height:p.h};
}
