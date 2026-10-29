// Adapted from Cartographer's seven-pass cave cellular automaton and
// disconnected-floor fill. Reserved GBA exits and approaches stay carved.
export function regionCavern(node,layout,random){
 const w=node.width||64,h=node.height||64,reserved=new Set(),key=(x,y)=>y*w+x;
 for(const i of layout.road)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=i%w+dx,y=Math.floor(i/w)+dy;if(x>=0&&y>=0&&x<w&&y<h)reserved.add(key(x,y));}
 for(const c of [layout.clearing,...layout.sideClearings].filter(Boolean))for(let y=c.y-c.ry;y<=c.y+c.ry;y++)for(let x=c.x-c.rx;x<=c.x+c.rx;x++)if(x>=2&&y>=2&&x<w-2&&y<h-2&&((x-c.x)/c.rx)**2+((y-c.y)/c.ry)**2<=1)reserved.add(key(x,y));
 const border=(x,y)=>x<2||y<2||x>=w-2||y>=h-2;let solid=Array.from({length:w*h},(_,i)=>!reserved.has(i)&&(border(i%w,Math.floor(i/w))||random()<.45));
 for(let pass=0;pass<7;pass++)solid=solid.map((on,i)=>{if(reserved.has(i))return false;const x=i%w,y=Math.floor(i/w);if(border(x,y))return true;let near=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(solid[key(x+dx,y+dy)])near++;return pass===6?near>=5:near>4||near===3&&random()<1/3;});
 const start=[...layout.road][0],seen=new Set([start]),todo=[start];while(todo.length){const i=todo.pop(),x=i%w,y=Math.floor(i/w);for(const[xx,yy]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const j=key(xx,yy);if(xx>=0&&yy>=0&&xx<w&&yy<h&&!solid[j]&&!seen.has(j)){seen.add(j);todo.push(j);}}}
 return solid.map((on,i)=>on||!seen.has(i));
}
