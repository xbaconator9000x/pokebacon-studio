// Builds an APK-only sprite catalogue from the user-supplied Shattered ROM.
// Output is deliberately ignored by git: no ROM or derived artwork is pushed.
import fs from'node:fs';import path from'node:path';import{GbaMaps}from'../dist/rom.js';import{discoverNativeSprites,readNativeSprite}from'../dist/native-sprites.js';import{npcTemplates}from'../dist/npc.js';
const input=process.argv[2]||'private-fixtures/xx0.98_Pokemon_Shattered.gba',out=process.argv[3]||'dist/assets/private-sprite-library.json';
const bytes=new Uint8Array(fs.readFileSync(input)),reader=await new GbaMaps(bytes,path.basename(input)).discover(),sprites=await discoverNativeSprites(bytes,{engine:reader.engine});if(!sprites)throw Error('Could not verify sprites in '+input);
const pack=r=>({id:r.id,name:r.name,width:r.width,height:r.height,palette:r.palettes[0],pixels:Buffer.from(r.frames[r.defaultFrame||0]).toString('base64')});
const pokemon=(sprites.speciesIds||[]).map(id=>pack(readNativeSprite(bytes,sprites,{kind:'mon',id,side:'front'})));
const people=npcTemplates(reader).map(t=>({id:t.graphics,name:t.name,width:t.width,height:t.height,palette:t.colours,pixels:Buffer.from(t.indices).toString('base64')}));
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({version:1,source:'Shattered template library',pokemon,people}));console.log('Bundled '+pokemon.length+' Pokémon and '+people.length+' field characters in '+out);
