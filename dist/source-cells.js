// Original ROM words stay immutable; this grid tracks retained source cells.
export function sourceIndex(map,x,y){
  const r=map.rom;if(!r||x<0||y<0||x>=map.width||y>=map.height)return null;
  if(r.sourceCells)return r.sourceCells[y*map.width+x]??null;
  return x<r.originalWidth&&y<r.originalHeight?y*r.originalWidth+x:null;
}
export function sourceBlock(map,x,y){const i=sourceIndex(map,x,y);return i===null?undefined:map.rom?.originalBlocks?.[i];}
