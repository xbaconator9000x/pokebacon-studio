import {LAYERS,inBounds,getTile,setTile,uid} from './model.js';
import {terrainMovement} from './movement-defaults.js';
export const NEIGHBORS=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]];
export function normalizeMask(mask){mask&=255;for(const [diagonal,a,b]of [[16,1,2],[32,2,4],[64,4,8],[128,8,1]])if(!(mask&a)||!(mask&b))mask&=~diagonal;return mask;}
export const MASKS=[...new Set(Array.from({length:256},(_,i)=>normalizeMask(i)))];
export function terrainMask(map,layer,x,y,id){let mask=0;for(const [dx,dy,bit]of NEIGHBORS)if(getTile(map,layer,x+dx,y+dy)?.terrain===id)mask|=bit;return normalizeMask(mask);}
export function terrainTile(style,mask,x=0,y=0){const index=MASKS.indexOf(normalizeMask(mask));const cols=style.patternCols||1,rows=style.patternRows||1,phase=((y%rows+rows)%rows)*cols+(x%cols+cols)%cols;return{a:style.variants?.[phase]||style.assetId,sx:index%8*16,sy:Math.floor(index/8)*16,size:16,terrain:style.id,movementMode:terrainMovement(style),...(style.movementBehavior!==undefined?{movementBehavior:style.movementBehavior}:{})};}
export function paintTerrain(map,layer,x,y,style,styles,erase=false){
 if(!inBounds(map,x,y)||!LAYERS.includes(layer))return;
 if(!erase&&!style)throw new Error('Choose a terrain first.');
 if(map.movement?.[y*map.width+x]&&!map.movement[y*map.width+x].overrideObjects)map.movement[y*map.width+x]=null;
 const previous=getTile(map,layer,x,y),erased=erase&&styles.find(s=>s.id===previous?.terrain)?.eraseTile;setTile(map,layer,x,y,erase?(erased?structuredClone(erased):null):{...terrainTile(style,0,x,y),...(map.autoCollision===false?{movementMode:'original'}:{})});
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const xx=x+dx,yy=y+dy,t=getTile(map,layer,xx,yy);if(!t?.terrain)continue;
  const definition=styles.find(s=>s.id===t.terrain);if(definition)setTile(map,layer,xx,yy,{...terrainTile(definition,terrainMask(map,layer,xx,yy,t.terrain),xx,yy),...(t.movementMode?{movementMode:t.movementMode}:{})});
 }
}
export function retileArea(map,layer,x0,y0,x1,y1,styles){for(let y=Math.max(0,y0);y<=Math.min(map.height-1,y1);y++)for(let x=Math.max(0,x0);x<=Math.min(map.width-1,x1);x++){const tile=getTile(map,layer,x,y);if(tile?.terrain){const style=styles.find(t=>t.id===tile.terrain);if(style)setTile(map,layer,x,y,{...terrainTile(style,terrainMask(map,layer,x,y,tile.terrain),x,y),...(tile.movementMode?{movementMode:tile.movementMode}:{})});}}}
export function retileTerrains(map,layer,styles){retileArea(map,layer,0,0,map.width-1,map.height-1,styles);}
// Quarter coordinates in a 96x128 RPG Maker XP autotile, using its first frame.
export function xpQuarters(mask){mask=normalizeMask(mask);return [0,1,2,3].map(q=>{
 const right=q%2,bottom=q>>1,h=!!(mask&(right?2:8)),v=!!(mask&(bottom?4:1)),d=!!(mask&(bottom?(right?32:64):(right?16:128)));
 if(!h&&!v)return[right?5:0,bottom?7:2];
 if(!h)return[right?5:0,bottom?5:4];
 if(!v)return[right?3:2,bottom?7:2];
 if(!d)return[right?5:4,bottom?1:0];
 return[right?3:2,bottom?5:4];
 });}
export function roleQuarters(mask){mask=normalizeMask(mask);return[0,1,2,3].map(q=>{const right=q%2,bottom=q>>1,h=!!(mask&(right?2:8)),v=!!(mask&(bottom?4:1)),d=!!(mask&(bottom?(right?32:64):(right?16:128))),corner=(bottom?'s':'n')+(right?'e':'w');return!h&&!v?corner:!h?(right?'e':'w'):!v?(bottom?'s':'n'):!d?'in'+corner:'center';});}
export function connectedBackground(image,x,y,tolerance=0){
 const {width,height,data}=image;if(x<0||y<0||x>=width||y>=height)return new Uint8Array(width*height);
 tolerance=Math.max(0,Math.min(100,tolerance));const at=(y*width+x)*4,target=[data[at],data[at+1],data[at+2]],transparent=data[at+3]===0,mask=new Uint8Array(width*height),seen=new Uint8Array(width*height),todo=[y*width+x];
 while(todo.length){const i=todo.pop();if(seen[i])continue;seen[i]=1;const p=i*4;if(transparent&&data[p+3]!==0)continue;if(!transparent&&data[p+3]&&Math.max(...target.map((c,k)=>Math.abs(c-data[p+k])))>tolerance)continue;mask[i]=1;const xx=i%width,yy=Math.floor(i/width);if(xx)todo.push(i-1);if(xx+1<width)todo.push(i+1);if(yy)todo.push(i-width);if(yy+1<height)todo.push(i+width);}
 return mask;
}
export function maskPixels(original,mask){const data=new Uint8ClampedArray(original);for(let i=0;i<mask.length;i++)if(mask[i])data[i*4+3]=0;return data;}
export function roomCells(map,rect,style,wallpaperOnly=false,roomId=uid()){
 const x0=Math.min(rect.x1,rect.x2),x1=Math.max(rect.x1,rect.x2),y0=Math.min(rect.y1,rect.y2),y1=Math.max(rect.y1,rect.y2);if(x1-x0<2||y1-y0<3)throw new Error('Draw a room at least 3 tiles wide and 4 tiles tall.');
 const depth=Math.min(style.wall.rows||3,y1-y0),cells=[];
 for(let y=Math.max(0,y0);y<=Math.min(map.height-1,y1);y++)for(let x=Math.max(0,x0);x<=Math.min(map.width-1,x1);x++){
  const wall=y<y0+depth;if(wallpaperOnly&&!wall)continue;
  const p=wall?style.wall:style.floor,cols=p.cols||1,rows=p.rows||1;
  let col=wall&&cols>=3?(x===x0?0:x===x1?cols-1:1+(x-x0-1)%Math.max(1,cols-2)):(x-x0)%cols;
  const row=wall?Math.min(y-y0,rows-1):(y-y0-depth+rows*1000)%rows;
  cells.push({x,y,tile:{a:p.a,sx:p.sx+col*p.size,sy:p.sy+row*p.size,size:p.size,room:roomId,roomPart:wall?'wall':'floor'}});
 }
 return cells;
}
export function buildRoom(map,rect,style,{wallpaperOnly=false,id=uid()}={}){const cells=roomCells(map,rect,style,wallpaperOnly,id);for(const cell of cells)setTile(map,'ground',cell.x,cell.y,cell.tile);map.rooms??=[];let record=map.rooms.find(r=>r.id===id);if(record){record.styleId=style.id;}else map.rooms.push({id,rect:{...rect},styleId:style.id});return id;}
export function validateSmart(project,assetIds){
 for(const name of ['terrainSets','prefabs','roomStyles'])if(project[name]!==undefined&&(!Array.isArray(project[name])||project[name].length>256))throw new Error('Too many smart map definitions.');
 const tile=t=>t&&assetIds.has(t.a)&&[t.sx,t.sy,t.size].every(Number.isFinite)&&t.sx>=0&&t.sy>=0&&t.size>=1&&t.size<=128;
 for(const t of project.terrainSets||[])if(!t||typeof t.id!=='string'||typeof t.name!=='string'||!assetIds.has(t.assetId)||(t.variants&&(!Array.isArray(t.variants)||t.variants.length>16||t.variants.some(id=>!assetIds.has(id))||![t.patternCols||1,t.patternRows||1].every(n=>Number.isInteger(n)&&n>=1&&n<=4)||t.variants.length!==(t.patternCols||1)*(t.patternRows||1))))throw new Error('A terrain references missing artwork.');
 for(const o of project.prefabs||[])if(!o||typeof o.id!=='string'||typeof o.name!=='string'||!assetIds.has(o.assetId)||(o.sourceAssetId&&!assetIds.has(o.sourceAssetId))||['sx','sy','sw','sh','sourceTileSize','nineSlice'].some(k=>o[k]!==undefined&&(!Number.isFinite(o[k])||o[k]<0||o[k]>16384))||![o.w,o.h].every(n=>Number.isFinite(n)&&n>0&&n<=128))throw new Error('An object template is invalid.');
 for(const r of project.roomStyles||[])if(!r||typeof r.id!=='string'||typeof r.name!=='string'||!tile(r.floor)||!tile(r.wall)||![r.floor.cols,r.floor.rows,r.wall.cols,r.wall.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=16))throw new Error('A room style is invalid.');
 for(const m of project.maps)if(m.rooms!==undefined&&(!Array.isArray(m.rooms)||m.rooms.length>500||m.rooms.some(r=>!r||typeof r.id!=='string'||!r.rect||!['x1','x2','y1','y2'].every(k=>Number.isInteger(r.rect[k])&&r.rect[k]>=0&&r.rect[k]<(k.startsWith('x')?m.width:m.height)))))throw new Error('A saved room has invalid bounds.');
}
