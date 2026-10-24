// Native Fortree metatiles 0x274/275/27c/27d, decoded from pret/pokeemerald.
// Only exterior grass is removed. Curved brush joins reuse these bank pixels.
import fs from 'node:fs';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
import{MASKS,roleQuarters}from'../dist/smart-model.js';
const runtime=process.env.MAP_STUDIO_QA_RUNTIME;
const{createCanvas,loadImage}=await import(pathToFileURL(resolve(runtime,'@napi-rs/canvas/index.js')));
const native=await loadImage('scripts/data/emerald-puddle-source.png'),puddle=createCanvas(32,32),pc=puddle.getContext('2d');pc.drawImage(native,0,0);
const data=pc.getImageData(0,0,32,32),grass=new Set(['164,213,197','115,197,164']);
for(let i=0;i<data.data.length;i+=4)if(grass.has([...data.data.slice(i,i+3)].join(',')))data.data[i+3]=0;
pc.putImageData(data,0,0);
const out='dist/assets/objects/';fs.writeFileSync(out+'emerald-route120-puddle.png',puddle.toBuffer('image/png'));
const crop=(x,y)=>{const c=createCanvas(16,16);c.getContext('2d').drawImage(puddle,x,y,16,16,0,0,16,16);return c;};
const roles={nw:crop(0,0),ne:crop(16,0),sw:crop(0,16),se:crop(16,16),n:crop(8,0),e:crop(16,8),s:crop(8,16),w:crop(0,8),center:crop(8,8)};
// Concave quarters reuse the opposite native shore with water/background sides
// reversed. All shore colours remain native; pixels are never filtered.
for(const[name,other]of [['innw','se'],['inne','sw'],['insw','ne'],['inse','nw']]){
 const c=createCanvas(16,16),ctx=c.getContext('2d');ctx.drawImage(roles[other],0,0);const im=ctx.getImageData(0,0,16,16);
 for(let i=0;i<im.data.length;i+=4){if(!im.data[i+3])im.data.set([115,189,246,255],i);else if(im.data[i]===115&&im.data[i+1]===189&&im.data[i+2]===246)im.data[i+3]=0;}
 ctx.putImageData(im,0,0);roles[name]=c;
}
const atlas=createCanvas(128,96),ctx=atlas.getContext('2d');
MASKS.forEach((mask,i)=>roleQuarters(mask).forEach((name,q)=>ctx.drawImage(roles[name],q%2*8,(q>>1)*8,8,8,i%8*16+q%2*8,Math.floor(i/8)*16+(q>>1)*8,8,8)));
fs.writeFileSync(out+'emerald-puddle-terrain.png',atlas.toBuffer('image/png'));
const preview=createCanvas(96,64),vc=preview.getContext('2d');vc.imageSmoothingEnabled=false;vc.drawImage(puddle,0,0);vc.drawImage(puddle,40,16);
fs.writeFileSync(out+'emerald-puddle-preview.png',preview.toBuffer('image/png'));
console.log('Extracted original Emerald puddle stamp and 47 connected brush masks.');
