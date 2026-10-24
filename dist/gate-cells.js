/** Gate coordinates stay bottom-left anchored for compatibility with v1-v2 projects.
 * Grid entries 1 = solid, 0 = walkable, null = retain underlying movement.
 * All masks are TOP-TO-BOTTOM artwork-local coordinates (not bottom anchored rows).
 */
export function gateBounds(g){return {x:g.x,y:g.y-g.h+1,w:g.w,h:g.h};}
export function gateLocal(g,x,y){const b=gateBounds(g),lx=x-b.x,ly=y-b.y;return lx>=0&&ly>=0&&lx<g.w&&ly<g.h?{x:lx,y:ly}:null;}
export function gateMasks(g){
 const custom=Array.isArray(g.closedMask)&&Array.isArray(g.openMask);
 if(custom)return {closed:g.closedMask,open:g.openMask};
 const closed=Array.from({length:g.h},()=>Array(g.w).fill(null)),open=structuredClone(closed),start=g.passageStart??0,width=g.passageWidth??g.w;
 for(let x=0;x<g.w;x++){closed[g.h-1][x]=1;open[g.h-1][x]=x>=start&&x<start+width?0:1;}
 return {closed,open};
}
export function gateRule(g,x,y,opened=false){
 const local=gateLocal(g,x,y);if(!local)return null;
 const masks=gateMasks(g),collision=masks[opened?'open':'closed'][local.y][local.x];
 const behind=g.behindMask?!!g.behindMask[local.y][local.x]:local.y<g.h-1;
 return {collision,behind,behavior:collision===null?null:0,local};
}
export function gateInteractsAt(g,x,y){
 const local=gateLocal(g,x,y);return !!local&&(g.interactionMask?!!g.interactionMask[local.y][local.x]:local.y===g.h-1);
}
export function gateInteractionCells(g){
 const cells=[],b=gateBounds(g);for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++)if(gateInteractsAt(g,b.x+x,b.y+y))cells.push({x:b.x+x,y:b.y+y});return cells;
}
export function gatePassageCells(g){
 const out=[],b=gateBounds(g),mask=gateMasks(g).open;for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++)if(mask[y][x]===0)out.push({x:b.x+x,y:b.y+y});return out;
}
export function validateGateMasks(g){
 if(![g.w,g.h].every(n=>Number.isInteger(n)&&n>=1&&n<=8))throw Error('Gate artwork must be between 1 × 1 and 8 × 8 tiles.');
 for(const key of ['closedMask','openMask','interactionMask','behindMask']){
  const grid=g[key];if(grid===undefined)continue;
  const allowed=key==='interactionMask'||key==='behindMask'?[0,1,false,true]:[0,1,null];
  if(!Array.isArray(grid)||grid.length!==g.h||grid.some(row=>!Array.isArray(row)||row.length!==g.w||row.some(v=>!allowed.includes(v))))throw Error('The '+key+' grid must match the gate artwork dimensions.');
 }
 if((g.closedMask===undefined)!==(g.openMask===undefined))throw Error('Set both closed and open movement grids.');
 if(g.interactionMask&&!g.interactionMask.flat().some(Boolean))throw Error('Choose at least one interaction tile.');
 if(g.closedMask&&!g.openMask.some((row,y)=>row.some((v,x)=>v===0&&g.closedMask[y][x]===1)))throw Error('The open state must unblock at least one closed tile.');
 const start=g.passageStart??0,width=g.passageWidth??g.w;
 if(!g.closedMask&&(!Number.isInteger(start)||!Number.isInteger(width)||start<0||width<1||start+width>g.w))throw Error('The legacy gate passage is outside the artwork.');
 return g;
}
