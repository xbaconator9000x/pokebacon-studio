/**
 * Curated interior additions for v3.2.
 * Crops existing bundled Ekat artwork only. No new/approximated pixel artwork.
 * Run: node scripts/build-interior-v32.mjs
 * Optional MAP_STUDIO_INTERIOR_QA_DIR writes a checkerboard contact sheet outside dist.
 * Isolated output: dist/assets/interiors-v32/catalog.json. Does not mutate smart-catalog.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let canvas;
try{canvas=require('@napi-rs/canvas');}catch{throw Error('Install @napi-rs/canvas to build the interior catalog.');}
const {createCanvas,loadImage}=canvas;
const out='dist/assets/interiors-v32';fs.mkdirSync(out,{recursive:true});
const sheets={
 idilio:'ekat-s-public-tiles-idilio-interiors-formatted',
 jonquil:'ekat-s-public-tiles-revisions-of-old-sets-revised-jonquil-interiors',
 office:'ekat-s-public-tiles-little-office',
 ship:'ekat-s-public-tiles-ship-interior',
 arcade:'ekat-s-public-tiles-game-corner-heist',
 beach:'ekat-s-tiny-interiors-beach-house',
 station:'ekat-s-tiny-interiors-train-station',
};
const recipes=[];
function add(id,name,sheet,rect,category,tags=[],collision='solid',extra={}){recipes.push({id:'v32-'+id,name,sheet,rect,category:'Interior · '+category,tags,collision,...extra});}
add('white-display-wood','White display table — wooden base','idilio',[0,288,48,48],'Tables',['shop','display','white','table']);
add('white-display-metal','White display table — metal legs','idilio',[48,288,48,48],'Tables',['shop','display','white','table']);
add('book-display-wood','Low book display — wooden base','idilio',[0,336,48,32],'Shop fixtures',['shop','books','display']);
add('book-display-metal','Low book display — metal legs','idilio',[48,336,48,32],'Shop fixtures',['shop','books','display']);
add('white-tall-cabinet','White double-door storage cabinet','idilio',[80,416,48,64],'Storage',['cabinet','storage','white']);
add('glass-wall-cabinet','Wide glass-fronted wall cabinet','idilio',[80,480,48,32],'Storage',['cabinet','glass','wall'],'base');
add('jonquil-red-bed','Jonquil — red-trimmed single bed','jonquil',[48,368,32,32],'Beds',['home','bed','red']);
add('jonquil-green-bed','Jonquil — green-trimmed single bed','jonquil',[80,368,32,32],'Beds',['home','bed','green']);
add('jonquil-chair-right','Jonquil — red dining chair, facing right','jonquil',[48,400,32,32],'Seating',['home','dining','chair','red'],'solid',{clearRects:[[16,16,16,16]]});
add('jonquil-chair-left','Jonquil — red dining chair, facing left','jonquil',[80,400,32,32],'Seating',['home','dining','chair','red'],'solid',{clearRects:[[0,16,16,16]]});
add('jonquil-red-seat','Jonquil — red padded square stool','jonquil',[16,416,16,16],'Seating',['home','seat','stool','red']);
add('jonquil-green-seat','Jonquil — green padded square stool','jonquil',[32,416,16,16],'Seating',['home','seat','stool','green']);
add('jonquil-white-island','Jonquil — wide cream-topped table','jonquil',[80,304,48,48],'Tables',['home','kitchen','dining','table']);
add('jonquil-narrow-island','Jonquil — narrow cream side table','jonquil',[64,304,16,48],'Tables',['home','kitchen','table']);
add('jonquil-sink','Jonquil — grey kitchen sink cabinet','jonquil',[16,304,16,32],'Kitchen',['home','kitchen','sink','tap']);
add('office-workstation','Office — computer desk with tower and plant','office',[48,96,32,48],'Office',['office','lab','computer','desk'],'base');
add('office-glass-workstation','Office — tall glass desk and computer','office',[80,96,32,48],'Office',['office','lab','computer','desk'],'base',{clearRects:[[16,0,16,16]]});
add('office-small-plant','Office — narrow plant in square pot','office',[0,16,16,32],'Plants',['office','plant'],'base');
add('ship-red-bunk-left','Ship cabin — red bunk bed, head left','ship',[0,192,48,48],'Beds',['ship','cabin','bed','bunk','red']);
add('ship-red-bunk-right','Ship cabin — red bunk bed, head right','ship',[48,192,48,48],'Beds',['ship','cabin','bed','bunk','red']);
add('ship-white-bunk-left','Ship cabin — white bunk bed, head left','ship',[0,240,48,48],'Beds',['ship','cabin','bed','bunk','white']);
add('ship-white-bunk-right','Ship cabin — white bunk bed, head right','ship',[48,240,48,48],'Beds',['ship','cabin','bed','bunk','white']);
add('arcade-drink-rack','Game room — drinks and glassware rack','arcade',[64,1200,32,48],'Shop fixtures',['game corner','arcade','shop','drinks']);
add('arcade-glass-rack','Game room — low drinks and glassware rack','arcade',[96,1216,32,32],'Shop fixtures',['game corner','arcade','shop','drinks']);
add('arcade-vending-wide','Game room — snack vending machine','arcade',[96,1248,16,48],'Shop fixtures',['game corner','arcade','shop','vending']);
add('arcade-vending-narrow','Game room — tall stocked glass cabinet','arcade',[112,1248,16,48],'Shop fixtures',['game corner','arcade','shop','vending']);
add('arcade-jukebox','Game room — wooden jukebox','arcade',[64,1392,16,32],'Entertainment',['game corner','arcade','jukebox']);
add('arcade-prize-counter','Game room — long glass prize counter','arcade',[0,1392,48,32],'Counters',['game corner','arcade','shop','prizes','counter']);
add('arcade-pool-table','Game room — green pool table','arcade',[0,1024,48,48],'Entertainment',['game corner','arcade','pool','table']);
add('arcade-card-table','Game room — green card table','arcade',[64,1040,48,32],'Entertainment',['game corner','arcade','cards','table']);
add('beach-chair','Beach house — wooden dining chair','beach',[96,768,32,32],'Seating',['home','beach','chair'], 'solid',{sourceTileSize:32});
add('beach-bookcase','Beach house — wide yellow-trim bookcase','beach',[96,800,96,64],'Storage',['home','beach','books','bookcase'], 'solid',{sourceTileSize:32});
add('beach-narrow-bookcase','Beach house — narrow yellow-trim bookcase','beach',[192,800,32,64],'Storage',['home','beach','books','bookcase'], 'solid',{sourceTileSize:32});
add('beach-sink-counter','Beach house — fitted sink counter','beach',[0,768,96,160],'Kitchen',['home','beach','kitchen','sink','counter'],'solid',{sourceTileSize:32});
add('beach-red-ball','Beach house — red and white beach ball','beach',[96,896,32,32],'Decorations',['home','beach','ball'],'solid',{sourceTileSize:32});
add('beach-green-ball','Beach house — green and white beach ball','beach',[128,896,32,32],'Decorations',['home','beach','ball'],'solid',{sourceTileSize:32});
add('beach-blue-ball','Beach house — blue and white beach ball','beach',[160,896,32,32],'Decorations',['home','beach','ball'],'solid',{sourceTileSize:32});
add('beach-red-bowl','Beach house — red pet bowl','beach',[192,896,32,32],'Decorations',['home','beach','pet','bowl'],'solid',{sourceTileSize:32});
add('beach-green-bowl','Beach house — green pet bowl','beach',[224,896,32,32],'Decorations',['home','beach','pet','bowl'],'solid',{sourceTileSize:32});
add('beach-blue-bowl','Beach house — blue pet bowl','beach',[224,928,32,32],'Decorations',['home','beach','pet','bowl'],'solid',{sourceTileSize:32});
add('station-bench-horizontal','Station — long lime waiting bench','station',[160,384,96,32],'Seating',['interior','waiting','bench','lime'],'solid',{sourceTileSize:32});
add('station-bench-vertical','Station — vertical lime waiting bench','station',[160,288,32,96],'Seating',['interior','waiting','bench','lime'],'solid',{sourceTileSize:32});
const cache=new Map(),built=[],catalog={version:'3.2',source:'Ekat bundled public and Tiny Interiors sheets',assets:[],prefabs:[],furnishingSets:[]};
for(const r of recipes){
 const sourceFile='dist/assets/tilesets/'+sheets[r.sheet]+'.png';if(!cache.has(sourceFile))cache.set(sourceFile,await loadImage(sourceFile));const im=cache.get(sourceFile),[x,y,w,h]=r.rect;
 if(![x,y,w,h].every(Number.isInteger)||x<0||y<0||x+w>im.width||y+h>im.height)throw Error(r.id+' crop exceeds source bounds');
 if(r.sourceTileSize===32){const sample=createCanvas(w,h),sc=sample.getContext('2d');sc.drawImage(im,x,y,w,h,0,0,w,h);const d=sc.getImageData(0,0,w,h).data;for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)for(let k=0;k<4;k++)if(d[(yy*w+xx)*4+k]!==d[((yy>>1)*2*w+(xx>>1)*2)*4+k])throw Error(r.id+' source is not exact doubled pixel art');}
 const s=16/(r.sourceTileSize||16),c=createCanvas(w*s,h*s),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(im,x,y,w,h,0,0,c.width,c.height);
 for(const rect of r.clearRects||[])ctx.clearRect(...rect);
 // The sheets already use transparency; discard only edge-connected exact black separators.
 const data=ctx.getImageData(0,0,c.width,c.height),d=data.data,seen=new Uint8Array(c.width*c.height),todo=[];
 for(let xx=0;xx<c.width;xx++)todo.push(xx,(c.height-1)*c.width+xx);
 for(let yy=0;yy<c.height;yy++)todo.push(yy*c.width,yy*c.width+c.width-1);
 while(todo.length){const i=todo.pop();if(seen[i])continue;seen[i]=1;const p=i*4;if(d[p+3]&&!(d[p]===0&&d[p+1]===0&&d[p+2]===0))continue;d[p+3]=0;const xx=i%c.width,yy=Math.floor(i/c.width);if(xx)todo.push(i-1);if(xx<c.width-1)todo.push(i+1);if(yy)todo.push(i-c.width);if(yy<c.height-1)todo.push(i+c.width);}
 ctx.putImageData(data,0,0);
 if(c.width%16||c.height%16)throw Error(r.id+' is not a native 16 px footprint');
 // Red/white source placeholder tiles are never valid placeable objects.
 let red=0;for(let p=0;p<d.length;p+=4)if(d[p+3]&&d[p]===255&&d[p+1]===0&&d[p+2]===0)red++;
 if(red>8)throw Error(r.id+' contains a source placeholder ('+red+' red pixels)');
 const assetId='interior-'+r.id,file=out+'/'+r.id+'.png';fs.writeFileSync(file,c.toBuffer('image/png'));
 const credits={idilio:['Ekat','Heartlessdragoon','Idilio'],jonquil:['Ekat','Heartlessdragoon','Vurtax'],office:['Ekat'],ship:['Ekat','Vurtax','Heartlessdragoon'],arcade:['Ekat','Heartlessdragoon','Vurtax','Aveontrainer','HeroAlistar','Redblueyellow','SteamyJ','Anonaplacca','Pokémon Rejuvenation','Puggsoy'],beach:['Ekat','Heartlessdragoon'],station:['Ekat','Heartlessdragoon']};
 const provenance={author:'Ekat',credits:credits[r.sheet],sourceFile:sourceFile.slice(5),sourceRect:r.rect,sourceTileSize:r.sourceTileSize||16,outputTileSize:16,backgroundRemoval:'Existing alpha preserved; only edge-connected exact-black sheet separators removed',...(r.clearRects?{excludedAdjacentSourceRects:r.clearRects}:{}),licenseFile:['beach','station'].includes(r.sheet)?'assets/credits/tiny-interiors.txt':'assets/credits/ekat-public-tiles.txt'};
 catalog.assets.push({id:assetId,name:r.name,src:file.slice(5),width:c.width,height:c.height,tileSize:16,category:'Curated interior objects',sourceId:sheets[r.sheet]});
 catalog.prefabs.push({id:r.id,name:r.name,category:r.category,tags:r.tags,assetId,sx:0,sy:0,sw:c.width,sh:c.height,w:c.width/16,h:c.height/16,collisionChoice:r.collision,source:'Ekat · '+r.sheet,provenance});built.push({r,c,data});
}
const groups=[
 ['jonquil-house','Jonquil — home & kitchen','home','Jonquil cream kitchen, beds and matching seats',recipes.filter(r=>r.sheet==='jonquil').map(r=>r.id)],
 ['white-display-shop','White display shop','mart','White-topped tables, book displays, glass cabinets and service counter',recipes.filter(r=>r.sheet==='idilio').map(r=>r.id)],
 ['game-room','Game room & prize shop','arcade','Counters, drinks displays, vending machines and games',recipes.filter(r=>r.sheet==='arcade').map(r=>r.id)],
 ['beach-house','Beach house — furnishings','home','Wooden chair, yellow bookcases, kitchen sink and beach decorations',recipes.filter(r=>r.sheet==='beach').map(r=>r.id)],
];
for(const[id,name,kind,description,prefabIds]of groups)catalog.furnishingSets.push({id:'set-v32-'+id,name,region:'Creator · Ekat',kind,description,prefabIds});
// Trimmed visible-pixel hashes catch duplicates despite different transparent padding.
function visibleHash(c){const im=c.getContext('2d').getImageData(0,0,c.width,c.height),d=im.data;let x0=c.width,y0=c.height,x1=-1,y1=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}if(x1<0)throw Error('Empty furniture crop');const h=crypto.createHash('sha256').update([x1-x0+1,y1-y0+1].join(','));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const p=(y*c.width+x)*4;h.update(d[p+3]?d.subarray(p,p+4):new Uint8Array(4));}return h.digest('hex');}
const seen=new Map();for(const{r,c}of built){const h=visibleHash(c);if(seen.has(h))throw Error('Duplicate additions: '+r.id+' / '+seen.get(h));seen.set(h,r.id);}
const existing=JSON.parse(fs.readFileSync('dist/assets/smart-catalog.json')),existingAssets=new Map(existing.assets.map(a=>[a.id,a]));
for(const p of (existing.prefabs||[]).filter(p=>!p.id.startsWith('v32-'))){const a=existingAssets.get(p.assetId);if(!a||!fs.existsSync('dist/'+a.src))continue;let im;try{im=await loadImage('dist/'+a.src);}catch{continue;}const c=createCanvas(p.sw||a.width,p.sh||a.height);c.getContext('2d').drawImage(im,p.sx||0,p.sy||0,c.width,c.height,0,0,c.width,c.height);const dup=seen.get(visibleHash(c));if(dup)throw Error('Addition duplicates existing object: '+dup+' / '+p.id);}
const expectedFiles=new Set(catalog.assets.map(a=>path.basename(a.src)));for(const f of fs.readdirSync(out))if(f.endsWith('.png')&&!expectedFiles.has(f))fs.unlinkSync(path.join(out,f));
fs.writeFileSync(out+'/catalog.json',JSON.stringify(catalog,null,2)+'\n');
const qaDir=process.env.MAP_STUDIO_INTERIOR_QA_DIR;if(qaDir){fs.mkdirSync(qaDir,{recursive:true});const cols=5,cw=220,ch=220,qa=createCanvas(cols*cw,Math.ceil(built.length/cols)*ch),q=qa.getContext('2d');q.imageSmoothingEnabled=false;built.forEach(({r,c},i)=>{const x=i%cols*cw,y=Math.floor(i/cols)*ch;q.fillStyle='#eef2e9';q.fillRect(x,y,cw,ch);for(let yy=0;yy<160;yy+=8)for(let xx=0;xx<cw;xx+=8){q.fillStyle=((xx+yy)/8)%2?'#d3d7ce':'#f5f8f1';q.fillRect(x+xx,y+yy,8,8);}const scale=Math.min(4,Math.floor(160/c.height),Math.floor((cw-12)/c.width));q.drawImage(c,x+(cw-c.width*scale)/2,y+8,c.width*scale,c.height*scale);q.fillStyle='#182f26';q.font='13px sans-serif';q.fillText(r.id,x+7,y+176);const words=r.name.split(' ');let line='',yy=194;for(const word of words){if(q.measureText(line+word).width>cw-14){q.fillText(line,x+7,y+yy);yy+=16;line='';}line+=word+' ';}q.fillText(line,x+7,y+yy);});fs.writeFileSync(path.join(qaDir,'interiors-v32-contact.png'),qa.toBuffer('image/png'));}
console.log(JSON.stringify({objects:catalog.prefabs.length,sets:catalog.furnishingSets.length,catalog:out+'/catalog.json',qa:qaDir||null}));
