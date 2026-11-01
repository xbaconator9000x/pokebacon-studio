// Builds an APK-only sprite catalogue from the user-supplied Shattered ROM.
// Output is deliberately ignored by git: no ROM or derived artwork is pushed.
import fs from'node:fs';import path from'node:path';import{GbaMaps}from'../dist/rom.js';import{discoverNativeSprites,readNativeSprite}from'../dist/native-sprites.js';import{npcTemplates}from'../dist/npc.js';
const input=process.argv[2]||'private-fixtures/xx0.98_Pokemon_Shattered.gba',out=process.argv[3]||'dist/assets/private-sprite-library.json';
const bytes=new Uint8Array(fs.readFileSync(input)),reader=await new GbaMaps(bytes,path.basename(input)).discover(),sprites=await discoverNativeSprites(bytes,{engine:reader.engine});if(!sprites)throw Error('Could not verify sprites in '+input);
const encode=p=>Buffer.from(p).toString('base64');
const pack=r=>({id:r.id,name:r.name,width:r.width,height:r.height,palette:r.palettes[0],palettes:r.palettes,frames:r.frames.map(encode),pixels:encode(r.frames[r.defaultFrame||0])});
const pokemon=(sprites.speciesIds||[]).map(id=>{
 const front=pack(readNativeSprite(bytes,sprites,{kind:'mon',id,side:'front'})),back=pack(readNativeSprite(bytes,sprites,{kind:'mon',id,side:'back'}));
 let icon=null,iconIssue=null;try{icon=pack(readNativeSprite(bytes,sprites,{kind:'icon',id,side:'front'}));}catch(error){iconIssue=String(error.message||error);}
 // Top-level front fields retain compatibility with older APK picker code.
 return{...front,front,back,icon,iconIssue,shiny:readNativeSprite(bytes,sprites,{kind:'mon',id,side:'front',shiny:true}).palettes};
});
const people=npcTemplates(reader).map(t=>({id:t.graphics,name:t.name,width:t.width,height:t.height,palette:t.colours,frames:t.frames.map(encode),pixels:encode(t.frames[0])}));
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({version:2,source:'Shattered template library',pokemon,people}));console.log('Bundled '+pokemon.length+' Pokémon (front, back and icons) and '+people.length+' animated field characters in '+out);
