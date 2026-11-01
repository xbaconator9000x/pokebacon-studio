import {npcTemplates,npcImage} from './npc.js';
import {makeSpriteGroup,nearestPixels,studioData} from './sprite-workbench.js';
import {spriteContext} from './game-runtime.js';
import {readNativeSprite} from './native-sprites.js';
import {bundledSpriteLibrary,bundledPixels,bundledFrames} from './sprite-library.js';

// Field templates are source art.  Copying one makes the edit explicit: the
// original NPC/player graphic stays untouched and the new group can be placed
// independently (including in an event).
export function copyNPCToSpriteGroup(api,t){
 const group=makeSpriteGroup(t.name,{human:true,palette:t.colours,shiny:t.colours});
 group.kind='character';group.views.overworld={width:t.width,height:t.height,frames:(t.frames||[t.indices]).map(frame=>Array.from(frame))};
 api.change(()=>studioData(api.project()).groups.push(group));return group;
}
export function copyBundledSpriteGroup(api,row,{pokemon=false}={}){
 const front=pokemon?(row.front||row):row,shiny=pokemon?(row.shiny?.[0]||front.palette):front.palette;
 const group=makeSpriteGroup(row.name,{human:!pokemon,palette:front.palette,shiny});
 group.kind=pokemon?'pokemon-npc':'character';if(pokemon){delete group.creature;
  group.views.front={width:front.width,height:front.height,frames:bundledFrames(front)};
  const back=row.back;if(back)group.views.back={width:back.width,height:back.height,frames:bundledFrames(back)};
  const icon=row.icon;if(icon)group.views.icon={width:icon.width,height:icon.height,frames:bundledFrames(icon)};
  group.views.overworld={width:32,height:32,frames:bundledFrames(front).map(frame=>nearestPixels(frame,front.width,front.height,32,32))};
 }else group.views.overworld={width:row.width,height:row.height,frames:bundledFrames(row)};
 api.change(()=>studioData(api.project()).groups.push(group));return group;
}

export async function pokemonNPCGroup(api,id){
 const session=api.session();if(!session)throw Error('Open the source ROM first.');
 const context=await spriteContext(session.reader),profile=context.sprites;if(!profile)throw Error('Pokémon sprites could not be verified for this ROM.');
 const source=readNativeSprite(session.reader.bytes,profile,{kind:'mon',id,side:'front',shiny:false}),name=source.name||'Pokémon '+id;
 // A 32 × 32 static field actor is supported by the native NPC installer.
 // It is deliberately a copy, so artists can refine the field silhouette.
 const group=makeSpriteGroup(name+' · field actor',{palette:source.palettes[0],shiny:source.palettes[0]});
 group.kind='pokemon-npc';delete group.creature;
 group.views={overworld:{width:32,height:32,frames:[nearestPixels(source.frames[source.defaultFrame||0],source.width,source.height,32,32)]}};
 api.change(()=>studioData(api.project()).groups.push(group));return group;
}

export function spriteGroupImage(g){
 const v=g.views.overworld,c=document.createElement('canvas');c.width=v.width;c.height=v.height;
 const ctx=c.getContext('2d'),image=ctx.createImageData(v.width,v.height);
 v.frames[0].forEach((n,i)=>{const colour=parseInt(g.normal[n].slice(1),16);image.data.set([colour>>>16,colour>>>8&255,colour&255,n?255:0],i*4);});
 ctx.putImageData(image,0,0);return c.toDataURL('image/png');
}

export function cacheNPCAppearance(api,t){
 const p=api.project(),s=api.session(),id='native-npc-'+s.id+'-'+t.graphics;
 if(!p.assets.some(a=>a.id===id)){
  if(p.assets.length>=512)throw Error('The project image limit has been reached.');
  api.change(()=>p.assets.push({id,name:t.name+' · native NPC',width:t.width,height:t.height,tileSize:16,data:npcImage(t)}));
 }
 return {graphics:t.graphics,mapKey:t.mapKey,index:t.index,sourceId:s.id,assetId:id};
}

export function chooseNPCAppearance(api,{onPick,onBack,onOpenROM,allowCustom=true,allowPokemon=false}={}){
 const $=s=>document.querySelector(s),esc=api.esc,s=api.session(),templates=s?npcTemplates(s.reader):[],groups=allowCustom?(api.project().spriteStudio?.groups||[]).filter(g=>g.views.overworld):[];
 const rows=[...templates.map(t=>({id:'native:'+t.graphics,name:t.name,detail:'ROM appearance #'+t.graphics,t})),...groups.map(g=>({id:'custom:'+g.id,name:g.name,detail:'My artwork · independent native slot',g}))],images=new Map();
 api.modal('Choose NPC appearance',`<p>Reuse an existing appearance for a new NPC. Dialogue and scenes belong to each placed NPC.</p>${!s?'<p class="studio-status">The installed template library works without a ROM. Open the matching ROM later only to compile native changes.</p>':!templates.length?'<p class="studio-status needs-attention">NPC appearance discovery is not supported for this ROM. Custom overworld artwork is available for previews.</p>':''}<div class="smart-actions"><button id="npcPickerPlayer" type="button">Player base & outfits</button><button id="npcPickerBundled" type="button">All people</button><button id="npcPickerBundledPokemon" type="button">Bundled Pokémon</button>${allowPokemon?'<button id="npcPickerPokemon" type="button">＋ Pokémon as character</button>':''}${onOpenROM?'<button id="npcPickerROM" type="button">'+(s?'Change source ROM':'Open source GBA ROM')+'</button>':''}</div><label>Search appearances<input id="npcPickerSearch" type="search" placeholder="Player, Nurse, Rocket, scientist or number"></label><label>Source<select id="npcPickerSource"><option value="all">All appearances</option><option value="native">ROM sprites</option>${allowCustom?'<option value="custom">My sprite groups</option>':''}</select></label><div id="npcPickerRows" class="npc-appearance-grid"></div><p id="npcPickerCount" class="hint-line"></p><button id="npcPickerBack" type="button">Back</button>`,null,'Done');
 function draw(){const query=$('#npcPickerSearch').value.trim().toLowerCase(),source=$('#npcPickerSource').value,found=rows.filter(r=>(source==='all'||r.id.startsWith(source+':'))&&(r.name+' '+r.detail).toLowerCase().includes(query)),shown=found.slice(0,48);
  $('#npcPickerRows').innerHTML=shown.map(r=>{if(!images.has(r.id))images.set(r.id,r.t?npcImage(r.t):spriteGroupImage(r.g));return`<button type="button" data-npc-appearance="${esc(r.id)}"><img src="${images.get(r.id)}" width="32" height="64" alt=""><b>${esc(r.name)}</b><small>${esc(r.detail)}</small></button>`;}).join('')||'<p>No matching appearances. Try another search or source.</p>';
  $('#npcPickerCount').textContent=found.length>48?'Showing 48 of '+found.length+' · search to narrow the list.':found.length+' appearances';
  document.querySelectorAll('[data-npc-appearance]').forEach(b=>b.onclick=()=>{try{const row=rows.find(r=>r.id===b.dataset.npcAppearance);onPick(row.t?{native:cacheNPCAppearance(api,row.t),spriteGroupId:null}:{native:null,spriteGroupId:row.g.id});}catch(e){api.error(e);}});
 }
 $('#npcPickerSearch').oninput=draw;$('#npcPickerSource').onchange=draw;$('#npcPickerBack').onclick=onBack;if($('#npcPickerROM'))$('#npcPickerROM').onclick=onOpenROM;$('#npcPickerPlayer').onclick=()=>chooseBundled('',false,true);$('#npcPickerBundled').onclick=()=>chooseBundled();$('#npcPickerBundledPokemon').onclick=()=>chooseBundled('',true);if($('#npcPickerPokemon'))$('#npcPickerPokemon').onclick=()=>choosePokemon();draw();
 function bundledPreview(row,pokemon){const r=pokemon?(row.front||row):row,c=document.createElement('canvas'),scale=Math.max(1,Math.floor(80/Math.max(r.width,r.height))),pixels=bundledFrames(r)[0],im=c.getContext('2d');c.width=r.width*scale;c.height=r.height*scale;const data=im.createImageData(c.width,c.height);for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const n=pixels[y*r.width+x],colour=parseInt(r.palette[n].slice(1),16);for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++){const at=((y*scale+yy)*c.width+x*scale+xx)*4;data.data.set([colour>>>16,colour>>>8&255,colour&255,n?255:0],at);}}im.putImageData(data,0,0);return c.toDataURL('image/png');}
 async function chooseBundled(query='',pokemon=false,playersOnly=false){const lib=await bundledSpriteLibrary();if(!lib){api.error(Error('This APK does not include the offline sprite library. Install the current Studio build.'));return;}const source=pokemon?lib.pokemon:lib.people,q=query.trim().toLowerCase(),rows=source.filter(r=>(!playersOnly||r.player)&&(!q||r.name.toLowerCase().includes(q)||String(r.id)===q)).slice(0,60),title=pokemon?'Bundled Pokémon':playersOnly?'Player base & outfits':'All people';api.modal(title,`<p>These are local editable copies. They work without a ROM and become independent project artwork.</p><label>Find ${pokemon?'Pokémon':playersOnly?'player sprite':'character'}<input id="bundledNPCSearch" value="${esc(query)}" placeholder="${pokemon?'Staryu, Mewtwo or ID':playersOnly?'base, bike, surf, fishing':'Player, Nurse, Rocket or ID'}"></label><div id="bundledNPCRows" class="npc-appearance-grid">${rows.map(r=>`<button data-bundled-npc="${r.id}" type="button"><img src="${bundledPreview(r,pokemon)}" alt=""><b>${esc(r.name)}</b><small>Editable ${pokemon?'Pokémon · front, back & icon':'field template · '+bundledFrames(r).length+' frames'} · #${r.id}</small></button>`).join('')||'<p>No matching template.</p>'}</div><button id="bundledNPCBack" type="button">Back</button>`);$('#bundledNPCSearch').oninput=()=>chooseBundled($('#bundledNPCSearch').value,pokemon,playersOnly);document.querySelectorAll('[data-bundled-npc]').forEach(b=>b.onclick=()=>{const row=source.find(r=>r.id===+b.dataset.bundledNpc),g=copyBundledSpriteGroup(api,row,{pokemon});onPick({native:null,spriteGroupId:g.id,bundled:true,pokemon});});$('#bundledNPCBack').onclick=()=>chooseNPCAppearance(api,{onPick,onBack,onOpenROM,allowCustom,allowPokemon});}
 function choosePokemon(query=''){const session=api.session();if(!session)return;api.modal('Pokémon as a field character',`<p>Creates an editable 32 × 32 field-actor copy. It does not alter the battle sprite. Refine it in Sprite workshop before compiling.</p><label>Find Pokémon<input id="npcPokemonSearch" value="${esc(query)}" placeholder="Staryu, Mewtwo or ID" autofocus></label><div id="npcPokemonRows" class="npc-appearance-grid"></div><button id="npcPokemonBack" type="button">Back</button>`);spriteContext(session.reader).then(context=>{const p=context.sprites,q=$('#npcPokemonSearch').value.trim().toLowerCase(),matches=(p.speciesIds||[]).map(id=>({id,name:p.names[id]||'Pokémon '+id})).filter(r=>!q||r.name.toLowerCase().includes(q)||String(r.id)===q).slice(0,48);$('#npcPokemonRows').innerHTML=matches.map(r=>`<button type="button" data-pokemon-npc="${r.id}"><b>${esc(r.name)}</b><small>Make editable field actor · #${r.id}</small></button>`).join('')||'<p>No Pokémon found.</p>';$('#npcPokemonSearch').oninput=()=>choosePokemon($('#npcPokemonSearch').value);document.querySelectorAll('[data-pokemon-npc]').forEach(b=>b.onclick=async()=>{try{const group=await pokemonNPCGroup(api,+b.dataset.pokemonNpc);onPick({native:null,spriteGroupId:group.id,pokemon:true});}catch(e){api.error(e);}});}).catch(api.error);$('#npcPokemonBack').onclick=()=>chooseNPCAppearance(api,{onPick,onBack,onOpenROM,allowCustom,allowPokemon});}
}

export function npcPlacementIssue(project,map,x,y,ignoreId=null){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=map.width||y>=map.height)return'Choose a tile inside this map.';
 if(map.markers.some(n=>n.id!==ignoreId&&(n.npc||n.rom?.type==='npc')&&n.x===x&&n.y===y))return'Another NPC already occupies this tile.';
 if((map.fieldObjects||[]).some(n=>n.x===x&&n.y===y))return'Move the HM object before placing an NPC here.';
 if(project.links.some(l=>l.runtime?.type==='portal'&&[l.from,...(l.twoWay?[l.to]:[])].some(e=>e.mapId===map.id&&e.x===x&&e.y===y)))return'Place the NPC beside the doorway or portal.';
 return null;
}
