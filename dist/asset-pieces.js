import{paletteCell}from'./asset-organizer.js';
export function assembledPieces(api){
 return async function open(p){
  const a=api.asset(p.assetId);if(!a)throw Error('The object artwork is missing.');await api.ensureImage(a.id);
  const w=Math.ceil(p.w*16),h=Math.ceil(p.h*16);if(w<1||h<1||w*h>1048576)throw Error('Choose an object no larger than 1 megapixel.');
  const prepared=document.createElement('canvas');prepared.width=Math.ceil(w/16)*16;prepared.height=Math.ceil(h/16)*16;prepared.getContext('2d').imageSmoothingEnabled=false;api.drawObject(prepared.getContext('2d'),{...p,x:0,y:0});
  api.modal(p.name+' · assembled tiles',`<p>The pieces stay in the shape of the complete object. Shared tiles may appear again in other objects. Tap a tile to paint it, or place the whole object.</p><div class="pieces-scroll"><canvas id="assembledPieces" aria-label="Choose a tile from ${api.esc(p.name)}"></canvas></div><div class="toolbox-actions"><button id="piecesWhole" type="button">Place whole object</button><button id="piecesSave" type="button">Save / organise this object</button></div><p class="hint-line">Tiles copy the visible artwork. Use Rules or Footprint for movement.</p>`);
  const c=document.querySelector('#assembledPieces');c.width=prepared.width;c.height=prepared.height;c.style.width=Math.max(160,Math.min(640,c.width*3))+'px';c.getContext('2d').drawImage(prepared,0,0);const ctx=c.getContext('2d');ctx.strokeStyle='#233b2b55';ctx.lineWidth=1;for(let x=16;x<c.width;x+=16){ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,c.height);ctx.stroke();}for(let y=16;y<c.height;y+=16){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(c.width,y+.5);ctx.stroke();}
  let start=null,moved=false;c.onpointerdown=e=>{start={x:e.clientX,y:e.clientY};moved=false;};c.onpointermove=e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)moved=true;};
  c.onclick=async e=>{if(moved)return;const cell=paletteCell(e,c,16);if(!cell)return;const pixels=prepared.getContext('2d').getImageData(cell.x*16,cell.y*16,16,16);if(!pixels.data.some((n,i)=>i%4===3&&n)){api.toast('That tile is transparent. Choose part of the object.');return;}try{const id=await api.remember(prepared,p.name+' · assembled pieces',p);api.selectTile({assetId:id,sx:cell.x*16,sy:cell.y*16,cols:1,rows:1,tileSize:16},p.name);api.close();api.collapse();}catch(error){api.error(error);}};
  document.querySelector('#piecesWhole').onclick=()=>{api.close();api.prefab(p);};document.querySelector('#piecesSave').onclick=()=>api.edit(p);
 };
}
