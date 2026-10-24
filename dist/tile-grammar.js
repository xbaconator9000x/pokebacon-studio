import{sourceBlock}from'./source-cells.js';
// Learn observed native tile joins from the loaded ROM, without copying its art.
// Unseen joins are review hints, never proof of an invalid map or automatic fixes.
const cache=new WeakMap(),pause=()=>new Promise(r=>setTimeout(r,0));
export async function learnTileGrammar(reader,native){
 const pair=reader.pairKey(native);let pairs=cache.get(reader);if(!pairs){pairs=new Map();cache.set(reader,pairs);}if(pairs.has(pair))return pairs.get(pair);
 const task=(async()=>{const horizontal=new Set(),vertical=new Set(),seen=new Set();let maps=0,cells=0;for(const m of reader.maps){if(reader.pairKey(m)!==pair||seen.has(m.layout.blocks))continue;seen.add(m.layout.blocks);const b=reader.blocks(m),w=m.layout.width,h=m.layout.height;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,id=b[i]&1023;if(x+1<w)horizontal.add(id+','+(b[i+1]&1023));if(y+1<h)vertical.add(id+','+(b[i+w]&1023));}maps++;cells+=b.length;if(maps%8===0)await pause();}return{pair,horizontal,vertical,maps,cells};})();pairs.set(pair,task);try{return await task;}catch(e){pairs.delete(pair);throw e;}
}
export function inspectNativeJoins(map,grammar,{limit=100}={}){
 if(!map.rom||!grammar)return[];const ids=new Set([map.rom.atlasId,...map.rom.layerAtlasIds||[]]),native=t=>t&&ids.has(t.a)&&t.size===16?Math.floor(t.sy/16)*16+Math.floor(t.sx/16):null,inside=(x,y)=>(map.nativeAssemblies||[]).some(a=>x>=a.x&&y>=a.y&&x<a.x+a.w&&y<a.y+a.h),unchanged=(i,id)=>{if(map.rom.generated)return false;const word=sourceBlock(map,i%map.width,Math.floor(i/map.width));return word!==undefined&&(word&1023)===id;},out=[];
 for(let y=0;y<map.height&&out.length<limit;y++)for(let x=0;x<map.width&&out.length<limit;x++){
  if(inside(x,y))continue;const i=y*map.width+x,id=native(map.layers.ground[i]);if(id===null)continue;const upper=native(map.layers.details[i]);if(upper!==null&&upper!==id){out.push({severity:'warning',x,y,message:'Native artwork planes use different metatiles here. Review the layering.'});continue;}
  for(const[dx,dy,set]of[[1,0,grammar.horizontal],[0,1,grammar.vertical]]){const xx=x+dx,yy=y+dy;if(xx>=map.width||yy>=map.height||inside(xx,yy))continue;const j=yy*map.width+xx,other=native(map.layers.ground[j]);if(other===null||unchanged(i,id)&&unchanged(j,other)||set.has(id+','+other))continue;out.push({severity:'warning',x,y,message:'Unusual tile join: '+id.toString(16).toUpperCase()+' → '+other.toString(16).toUpperCase()+'. This join was not found in '+grammar.maps+' source maps using this tileset. Check for cut-off trees, roofs or terrain edges.'});break;}
 }return out;
}
