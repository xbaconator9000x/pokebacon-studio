// Build the off-map repeat from a complete boundary object on generated maps.
// Words are already compiled, so palette, layering and metatile IDs match the map.
export function generatedBorder(map,words,layoutSize){
 const p=map.generator?.borderPattern;if(!p||layoutSize!==28)return null;
 if(![p.x,p.y,p.w,p.h].every(Number.isInteger)||p.w<1||p.h<1||p.w>255||p.h>255||p.x<0||p.y<0||p.x+p.w>map.width||p.y+p.h>map.height)throw Error('The generated off-map border no longer fits. Regenerate the settlement before exporting.');
 const bytes=new Uint8Array(p.w*p.h*2),v=new DataView(bytes.buffer);
 for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++)v.setUint16((y*p.w+x)*2,(words[(p.y+y)*map.width+p.x+x]&~0xc00)|0x400,true);
 return{bytes,width:p.w,height:p.h};
}
