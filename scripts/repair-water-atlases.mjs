import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {waterStudyAtlas} from '../dist/water-atlas.js';
const runtime=process.env.MAP_STUDIO_QA_RUNTIME;if(!runtime)throw Error('Set MAP_STUDIO_QA_RUNTIME');
const {createCanvas,loadImage}=await import(pathToFileURL(resolve(runtime,'@napi-rs/canvas/index.js')));
for(const name of ['water','mt-moon']){const id='ekat-s-public-tiles-autotiles-0-'+name+'-test',image=await loadImage('dist/assets/tilesets/'+id+'.png'),atlas=waterStudyAtlas(image,()=>createCanvas(1,1));fs.writeFileSync('dist/assets/smart/smart-'+id+'.png',atlas.toBuffer('image/png'));}
// Refresh picker previews as well as the 47-mask atlases.
const smart=JSON.parse(fs.readFileSync('dist/assets/smart-catalog.json'));
const {newMap}=await import('../dist/model.js'),{paintTerrain}=await import('../dist/smart-model.js');
for(const style of smart.terrains.filter(t=>/0-(water|mt-moon)-test$/.test(t.id))){const a=smart.assets.find(a=>a.id===style.assetId),atlas=await loadImage('dist/'+a.src),map=newMap('Preview',10,9),c=createCanvas(160,144),ctx=c.getContext('2d');for(let y=0;y<9;y++)for(let x=0;x<10;x++){const on=y<3?x>=2&&x<=7:y<5?x>=1&&x<=4:y<7?x>=4&&x<=8:x>=1&&x<=7;if(on)paintTerrain(map,'ground',x,y,style,[style]);}for(let i=0;i<map.layers.ground.length;i++){const t=map.layers.ground[i];if(t)ctx.drawImage(atlas,t.sx,t.sy,16,16,i%10*16,Math.floor(i/10)*16,16,16);}fs.writeFileSync('dist/'+style.preview,c.toBuffer('image/png'));}
