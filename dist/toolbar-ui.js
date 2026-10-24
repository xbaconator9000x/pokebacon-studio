const KEY='pokebacon-toolbar-v1';
export const TOOL_CHOICES=['move','brush','stamp','brushes','rules','event','link','inspect','erase','pick','rect','fill','tree','terrain','building','field','play'];
const defaults=phone=>phone?['move','brush','stamp','brushes']:['move','brush','stamp','brushes','erase','pick','rect'];
let preferences=null;try{const value=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(value))preferences=[...new Set(value.filter(x=>TOOL_CHOICES.includes(x)))];}catch{}
export const toolbarOrder=phone=>preferences?.length?[...preferences]:defaults(phone);
export function saveToolbar(order){preferences=[...new Set(order.filter(x=>TOOL_CHOICES.includes(x)))];if(!preferences.length)preferences=['move'];try{localStorage.setItem(KEY,JSON.stringify(preferences));}catch{}}
export function resetToolbar(){preferences=null;try{localStorage.removeItem(KEY);}catch{}}
export function toolbarEditor(api){
 const $=s=>document.querySelector(s);let order=toolbarOrder(api.phone());
 function draw(){api.modal('Customise toolbar',`<p>Hold a toolbar tool, then drag it beside another tool to reorder it. Pin extra tools below, or use the arrow controls here.</p><div id="toolbarPinned">${order.map((id,i)=>`<div class="toolbar-choice"><b>${api.esc(api.name(id))}</b><button data-toolbar-up="${i}" type="button" aria-label="Move ${api.esc(api.name(id))} earlier" ${i?'':'disabled'}>←</button><button data-toolbar-down="${i}" type="button" aria-label="Move ${api.esc(api.name(id))} later" ${i===order.length-1?'disabled':''}>→</button><button data-toolbar-remove="${id}" type="button">Unpin</button></div>`).join('')}</div><label>Add tool<select id="toolbarAddChoice">${TOOL_CHOICES.filter(id=>!order.includes(id)).map(id=>`<option value="${id}">${api.esc(api.name(id))}</option>`).join('')}</select></label><div class="studio-actions"><button id="toolbarPin" type="button">Pin tool</button><button id="toolbarReset" type="button">Restore defaults</button></div>`,()=>{saveToolbar(order);api.changed();},'Save toolbar');
  for(const [attr,delta]of [['up',-1],['down',1]])document.querySelectorAll('[data-toolbar-'+attr+']').forEach(b=>b.onclick=()=>{const i=+b.dataset['toolbar'+(attr==='up'?'Up':'Down')];[order[i],order[i+delta]]=[order[i+delta],order[i]];draw();});
  document.querySelectorAll('[data-toolbar-remove]').forEach(b=>b.onclick=()=>{order=order.filter(id=>id!==b.dataset.toolbarRemove);draw();});$('#toolbarPin').onclick=()=>{if($('#toolbarAddChoice').value)order.push($('#toolbarAddChoice').value);draw();};$('#toolbarReset').onclick=()=>{resetToolbar();order=toolbarOrder(api.phone());draw();};
 }draw();
}
export function installToolbarDrag(element,onChange){
 let pending=null,drag=null,suppressUntil=0;
 element.addEventListener('contextmenu',e=>{if(e.target.closest('[data-tool]'))e.preventDefault();});
 const end=()=>{if(pending)clearTimeout(pending.timer);pending=null;if(drag){drag.ghost.remove();drag.button.classList.remove('tool-dragging');saveToolbar([...element.querySelectorAll('[data-tool]')].map(b=>b.dataset.tool));drag=null;suppressUntil=Date.now()+350;onChange();}};
 element.addEventListener('pointerdown',e=>{const button=e.target.closest('[data-tool]');if(!button||e.button>0)return;pending={button,x:e.clientX,y:e.clientY,id:e.pointerId,scroll:element.scrollLeft,scrolling:false};pending.timer=setTimeout(()=>{if(!pending||pending.scrolling)return;const r=button.getBoundingClientRect(),ghost=button.cloneNode(true);ghost.removeAttribute('data-tool');ghost.className='toolbar-drag-ghost';Object.assign(ghost.style,{width:r.width+'px',left:r.left+'px',top:r.top+'px'});document.body.append(ghost);button.classList.add('tool-dragging');button.setPointerCapture?.(e.pointerId);drag={button,ghost,dx:e.clientX-r.left,dy:e.clientY-r.top};pending=null;navigator.vibrate?.(20);},450);});
 element.addEventListener('pointermove',e=>{if(pending&&(pending.scrolling||Math.hypot(e.clientX-pending.x,e.clientY-pending.y)>10)){clearTimeout(pending.timer);pending.scrolling=true;element.scrollLeft=pending.scroll+pending.x-e.clientX;suppressUntil=Date.now()+350;}if(!drag)return;e.preventDefault();drag.ghost.style.left=e.clientX-drag.dx+'px';drag.ghost.style.top=e.clientY-drag.dy+'px';const target=document.elementFromPoint?.(e.clientX,e.clientY)?.closest('[data-tool]');if(target&&target!==drag.button&&element.contains(target)){const r=target.getBoundingClientRect();element.insertBefore(drag.button,e.clientX<r.left+r.width/2?target:target.nextSibling);}}, {passive:false});
 element.addEventListener('pointerup',end);element.addEventListener('pointercancel',()=>{if(pending)clearTimeout(pending.timer);pending=null;if(drag){drag.ghost.remove();drag.button.classList.remove('tool-dragging');drag=null;onChange();}});
 element.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 return {cancel:end};
}
export const SUBTOOLS={
 brush:[['brush','Paint'],['rect','Area'],['fill','Fill'],['erase','Erase'],['pick','Pick']],
 brushes:[['terrain','Terrain'],['paths','Paths'],['texture','Textures'],['tree','Trees'],['wall','Walls'],['room','Rooms'],['ledge','Ledges']],
 stamp:[['objects','Objects'],['buildings','Buildings'],['interiors','Interiors'],['doors','Doors'],['gates','Gates']],
 rules:[['rules','Paint'],['rulesRect','Area'],['rulesFill','Fill'],['inspect','Inspect']],
 event:[['scene','Scenes'],['actors','NPCs'],['event','Basic event'],['field','HM objects'],['story','Story']]
};
