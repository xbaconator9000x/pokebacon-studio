import {npcTemplates,npcImage} from './npc.js';

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

export function chooseNPCAppearance(api,{onPick,onBack,onOpenROM,allowCustom=true}={}){
 const $=s=>document.querySelector(s),esc=api.esc,s=api.session(),templates=s?npcTemplates(s.reader):[],groups=allowCustom?(api.project().spriteStudio?.groups||[]).filter(g=>g.views.overworld):[];
 const rows=[...templates.map(t=>({id:'native:'+t.graphics,name:t.name,detail:'ROM appearance #'+t.graphics,t})),...groups.map(g=>({id:'custom:'+g.id,name:g.name,detail:'My artwork · independent native slot',g}))],images=new Map();
 api.modal('Choose NPC appearance',`<p>Reuse an existing appearance for a new NPC. Dialogue and scenes belong to each placed NPC.</p>${!s?'<p class="studio-status needs-attention">Reopen your source GBA ROM to browse its NPC sprites. Your saved project does not include the ROM.</p>':!templates.length?'<p class="studio-status needs-attention">NPC appearance discovery is not supported for this ROM. Custom overworld artwork is available for previews.</p>':''}${onOpenROM?'<button id="npcPickerROM" type="button">'+(s?'Change source ROM':'Open source GBA ROM')+'</button>':''}<label>Search appearances<input id="npcPickerSearch" type="search" placeholder="Nurse, Rocket, scientist, name or number"></label><label>Source<select id="npcPickerSource"><option value="all">All appearances</option><option value="native">ROM sprites</option>${allowCustom?'<option value="custom">My sprite groups</option>':''}</select></label><div id="npcPickerRows" class="npc-appearance-grid"></div><p id="npcPickerCount" class="hint-line"></p><button id="npcPickerBack" type="button">Back</button>`,null,'Done');
 function draw(){const query=$('#npcPickerSearch').value.trim().toLowerCase(),source=$('#npcPickerSource').value,found=rows.filter(r=>(source==='all'||r.id.startsWith(source+':'))&&(r.name+' '+r.detail).toLowerCase().includes(query)),shown=found.slice(0,48);
  $('#npcPickerRows').innerHTML=shown.map(r=>{if(!images.has(r.id))images.set(r.id,r.t?npcImage(r.t):spriteGroupImage(r.g));return`<button type="button" data-npc-appearance="${esc(r.id)}"><img src="${images.get(r.id)}" width="32" height="64" alt=""><b>${esc(r.name)}</b><small>${esc(r.detail)}</small></button>`;}).join('')||'<p>No matching appearances. Try another search or source.</p>';
  $('#npcPickerCount').textContent=found.length>48?'Showing 48 of '+found.length+' · search to narrow the list.':found.length+' appearances';
  document.querySelectorAll('[data-npc-appearance]').forEach(b=>b.onclick=()=>{try{const row=rows.find(r=>r.id===b.dataset.npcAppearance);onPick(row.t?{native:cacheNPCAppearance(api,row.t),spriteGroupId:null}:{native:null,spriteGroupId:row.g.id});}catch(e){api.error(e);}});
 }
 $('#npcPickerSearch').oninput=draw;$('#npcPickerSource').onchange=draw;$('#npcPickerBack').onclick=onBack;if($('#npcPickerROM'))$('#npcPickerROM').onclick=onOpenROM;draw();
}

export function npcPlacementIssue(project,map,x,y,ignoreId=null){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=map.width||y>=map.height)return'Choose a tile inside this map.';
 if(map.markers.some(n=>n.id!==ignoreId&&(n.npc||n.rom?.type==='npc')&&n.x===x&&n.y===y))return'Another NPC already occupies this tile.';
 if((map.fieldObjects||[]).some(n=>n.x===x&&n.y===y))return'Move the HM object before placing an NPC here.';
 if(project.links.some(l=>l.runtime?.type==='portal'&&[l.from,...(l.twoWay?[l.to]:[])].some(e=>e.mapId===map.id&&e.x===x&&e.y===y)))return'Place the NPC beside the doorway or portal.';
 return null;
}
