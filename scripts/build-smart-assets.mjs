import fs from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const runtime=process.env.MAP_STUDIO_QA_RUNTIME;if(!runtime)throw new Error('Set MAP_STUDIO_QA_RUNTIME to the directory containing @napi-rs/canvas.');
const{createCanvas,loadImage}=await import(pathToFileURL(resolve(runtime,'@napi-rs/canvas/index.js')));
import{xpAtlas}from'../dist/smart-canvas.js';
const catalog=JSON.parse(fs.readFileSync('dist/assets/catalog.json')),output='dist/assets/smart';fs.mkdirSync(output,{recursive:true});const added=[],terrains=[];
for(const source of catalog.filter(a=>a.category==='Autotiles (raw)'&&a.height===128&&a.width===96)){
 const im=await loadImage('dist/'+source.src),canvas=xpAtlas(im,()=>createCanvas(1,1)),id='smart-'+source.id,file=output+'/'+id+'.png';fs.writeFileSync(file,canvas.toBuffer('image/png'));
 const category=/water|sea|coral/i.test(source.name)?'Water':/snow|ice/i.test(source.name)?'Snow & ice':/grass|harvest|jonquil/i.test(source.name)?'Grass & paths':/moon|volcano|desert/i.test(source.name)?'Rock & sand':'Paths & ruins';
 added.push({id,name:source.name+' · connected terrain',src:file.slice(5),width:128,height:96,tileSize:16,category:'Smart terrain',sourceId:source.id});terrains.push({id,assetId:id,name:source.name,category});
}
const house=catalog.find(a=>a.name==='Garden House Sheet'),interior=catalog.find(a=>a.name==='Basic Interior Collection');
const prefabs=[{id:'garden-house',name:'Garden house',category:'Buildings',assetId:house.id,sx:0,sy:16,sw:160,sh:128,w:10,h:8},{id:'house-sign',name:'Wooden sign',category:'Signs',assetId:house.id,sx:96,sy:160,sw:32,sh:32,w:2,h:2},{id:'small-pot',name:'Small potted plant',category:'Furniture',assetId:interior.id,sx:64,sy:496,sw:16,sh:32,w:1,h:2},{id:'bookcase',name:'Bookcase',category:'Furniture',assetId:interior.id,sx:96,sy:560,sw:16,sh:32,w:1,h:2},{id:'television',name:'Television',category:'Furniture',assetId:interior.id,sx:112,sy:560,sw:16,sh:32,w:1,h:2},{id:'computer',name:'Computer',category:'Furniture',assetId:interior.id,sx:96,sy:624,sw:16,sh:32,w:1,h:2},{id:'pink-rug',name:'Pink rug',category:'Rugs',nineSlice:16,assetId:interior.id,sx:0,sy:528,sw:48,sh:48,w:3,h:3},{id:'yellow-rug',name:'Patterned rug',category:'Rugs',nineSlice:16,assetId:interior.id,sx:48,sy:528,sw:48,sh:48,w:3,h:3}];
const t=(sx,sy,cols=1,rows=1)=>({a:interior.id,sx,sy,size:16,cols,rows});
const rooms=[{id:'oak-stone',name:'Oak walls / stone floor',floor:t(16,592),wall:t(0,624,3,3)},{id:'oak-checker',name:'Oak walls / checked floor',floor:t(64,592),wall:t(0,624,3,3)},{id:'cream-pink',name:'Cream panelling / pink carpet',floor:t(16,544),wall:t(48,624,3,3)},{id:'cream-pattern',name:'Cream panelling / patterned carpet',floor:t(64,544),wall:t(48,624,3,3)}];
fs.writeFileSync('dist/assets/smart-catalog.json',JSON.stringify({assets:added,terrains,prefabs,rooms}));console.log('Built '+terrains.length+' connected terrain atlases, '+prefabs.length+' object templates and '+rooms.length+' room styles.');

await import('./expand-smart-assets.mjs');
