import {MASKS} from './smart-model.js';
// These two public study sheets are not complete XP autotiles. Keep their
// water colour but build full-cell water contours; never sample the land rows.
export function waterStudyAtlas(image,canvasFactory=()=>document.createElement('canvas')){
 const c=canvasFactory();c.width=128;c.height=96;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
 MASKS.forEach((mask,i)=>{const x=i%8*16,y=Math.floor(i/8)*16;ctx.drawImage(image,32,64,16,16,x,y,16,16);ctx.fillStyle='#28649c';
  if(!(mask&1))ctx.fillRect(x,y,16,1);if(!(mask&4))ctx.fillRect(x,y+15,16,1);if(!(mask&8))ctx.fillRect(x,y,1,16);if(!(mask&2))ctx.fillRect(x+15,y,1,16);
  for(const [a,b,d,xx,yy]of [[1,8,128,0,0],[1,2,16,15,0],[4,8,64,0,15],[4,2,32,15,15]])if((mask&a)&&(mask&b)&&!(mask&d))ctx.fillRect(x+xx,y+yy,1,1);
 });return c;
}
