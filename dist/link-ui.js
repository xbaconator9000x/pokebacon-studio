import {linkEndAt,isNativeWarp,checkLinkEnd,saveMapLink,removeMapLink} from './link-model.js';
import{EDGES,FACINGS,isSeamLink,seamSettings,seamGeometry,saveSeamLink}from'./map-seams.js';
export const facingSelect=(id,value='auto')=>`<select id="${id}">${FACINGS.map(d=>`<option value="${d}" ${value===d?'selected':''}>${{auto:'Automatic',north:'North / up',south:'South / down',west:'West / left',east:'East / right'}[d]}</option>`).join('')}</select>`;

export function mapLinkWorkshop(api){
  const $=s=>document.querySelector(s),esc=api.esc,state={pending:null,query:''};
  const project=api.project,map=api.map;
  const name=id=>project().maps.find(m=>m.id===id)?.name||'Missing map';
  const endpoint=p=>`${esc(name(p.mapId))} · ${p.x}, ${p.y}`;
  const notify=()=>{flow();api.refresh();};
  function begin({arrival,label='Portal'}={}){state.pending={stage:'from',draft:{label,kind:'warp',twoWay:true,runtime:{type:'portal',style:'step'},...(arrival?{to:{...arrival}}:{})},origin:map().id};api.mode('link');api.collapse();notify();}
  function startAt(x,y){
    const old=linkEndAt(project(),map().id,x,y);if(old&&!state.pending){edit(old.link,old.end);return;}
    if(state.pending?.stage==='from'&&state.pending.draft.to){const p=state.pending,from={mapId:map().id,x,y};try{checkLinkEnd(project(),p.draft,'from',from);p.draft.from=from;p.end='from';p.target=map().id;p.stage='confirm';api.mode('linkTarget');notify();}catch(e){api.error(e);}return;}
    state.pending={stage:'options',draft:{from:{mapId:map().id,x,y},label:'Portal',kind:'warp',twoWay:true,runtime:{type:'portal',style:'step'}},origin:map().id};destination();notify();
  }
  function destination(){
    const pending=state.pending;if(!pending?.draft.from)return;const d=pending.draft;
    const defaultMap=d.to?.mapId||project().maps.find(m=>m.id!==d.from.mapId)?.id||d.from.mapId;
    api.modal('Choose the arrival map',`<p class="callout">Entrance: <b>${endpoint(d.from)}</b><br>You will tap the exact arrival tile next.</p><label>Connection name<input id="linkLabel" maxlength="80" value="${esc(d.label)}"></label><label>Arrival map<select id="linkTo">${project().maps.map(m=>`<option value="${esc(m.id)}" ${m.id===defaultMap?'selected':''}>${esc(m.name)} · ${m.width} × ${m.height}</option>`).join('')}</select></label><label class="check"><input id="linkTwoWay" type="checkbox" ${d.twoWay?'checked':''}> Include the return trip</label><label class="check"><input id="linkPlayable" type="checkbox" ${d.runtime?'checked':''}> Playable portal in exported ROM / Play check</label><label>Face on arrival${facingSelect('linkArrivalFacing',d.runtime?.arrivalFacing)}</label><label>Face on return${facingSelect('linkReturnFacing',d.runtime?.returnFacing)}</label><p class="hint-line">The entrance and arrival are both chosen on the map. No guessed or default coordinates.</p>`,()=>{
      d.label=$('#linkLabel').value.trim()||'Portal';d.twoWay=$('#linkTwoWay').checked;
      if($('#linkPlayable').checked)d.runtime={...d.runtime,type:'portal',style:d.runtime?.style||'step',arrivalFacing:$('#linkArrivalFacing').value,returnFacing:$('#linkReturnFacing').value};else delete d.runtime;
      pending.target=$('#linkTo').value;pending.end='to';pending.stage='target';delete d.to;
      api.loadMap(pending.target);api.mode('linkTarget');api.collapse();api.close();notify();
      return false;
    },'Pick arrival on map');
  }
  function tap(x,y){
    try{
      const pending=state.pending;
      if(!pending||pending.stage==='from'||pending.stage==='options'){startAt(x,y);return;}
      if(map().id!==pending.target)throw Error('Choose the tile on '+name(pending.target)+'.');
      const p={mapId:map().id,x,y};checkLinkEnd(project(),pending.draft,pending.end,p);
      const other=pending.draft[pending.end==='from'?'to':'from'];if(other&&other.mapId===p.mapId&&other.x===x&&other.y===y)throw Error('Choose a different entrance and arrival tile.');
      pending.draft[pending.end]=p;pending.stage='confirm';notify();
    }catch(e){api.error(e);}
  }
  function commit(){try{const pending=state.pending;if(!pending||pending.stage!=='confirm')return;let link;api.change(()=>link=saveMapLink(project(),pending.draft));state.pending=null;api.mode('move');api.select(link,'to');notify();api.toast('Linked '+name(link.from.mapId)+(link.twoWay?' ↔ ':' → ')+name(link.to.mapId)+'. Use Move to drag either link pin.');}catch(e){api.error(e);}}
  function cancel(){const p=state.pending;state.pending=null;api.close();if(p?.origin&&project().maps.some(m=>m.id===p.origin))api.loadMap(p.origin);api.mode('move');notify();}
  function relocate(link,end){
    if(link.buildingId&&end==='from'){api.toast('Move the building to move its entrance.');return;}
    const d=structuredClone(link);if(isNativeWarp(d)&&!d.runtime)d.runtime={type:'portal',style:'step'};
    state.pending={stage:'target',end,draft:d,target:d[end].mapId,origin:map().id};
    api.loadMap(d[end].mapId);api.mode('linkTarget');api.collapse();api.close();flow();api.refresh();
  }
  function visit(link,end){api.close();api.loadMap(link[end].mapId);api.focus(link[end]);api.mode('move');api.select(link,end);api.collapse();api.refresh();}
  function edit(link,end='from'){
    if(!link)return;
    if(isSeamLink(link)){seamDialog(link);return;}
    api.select(link,end);
    const imported=isNativeWarp(link),playable=!!link.runtime||imported;
    api.modal('Edit '+(link.label||'connection'),`<label>Name<input id="editLinkLabel" maxlength="80" value="${esc(link.label)}"></label><div class="link-end-card"><b>Entrance</b><span>${endpoint(link.from)}</span><div class="smart-actions"><button id="visitLinkFrom" type="button">Show entrance</button><button id="moveLinkFrom" type="button" ${link.buildingId?'disabled':''}>Move entrance</button></div></div><div class="link-end-card"><b>Arrival</b><span>${endpoint(link.to)}</span><div class="smart-actions"><button id="visitLinkTo" type="button">Show arrival</button><button id="moveLinkTo" type="button">Move arrival</button></div></div><label class="check"><input id="editLinkTwoWay" type="checkbox" ${link.twoWay?'checked':''}> Return trip enabled</label><label class="check"><input id="editLinkPlayable" type="checkbox" ${playable?'checked':''}> Playable portal</label><label>Face on arrival${facingSelect('editArrivalFacing',link.runtime?.arrivalFacing)}</label><label>Face on return${facingSelect('editReturnFacing',link.runtime?.returnFacing)}</label>${link.rom&&!imported&&!link.runtime?'<p class="callout">This is a native edge connection. Its world layout is shown here; converting it to a portal creates step-on travel instead of changing the original route seam.</p>':''}<p class="hint-line">Move either pin with the Move tool, or use Move entrance / Move arrival to tap a precise replacement. The complete doorway stays attached.</p><button id="deleteLink" type="button" class="danger">Delete connection</button>`,()=>{
      const draft={...structuredClone(link),label:$('#editLinkLabel').value.trim()||'Connection',twoWay:$('#editLinkTwoWay').checked};
      if($('#editLinkPlayable').checked)draft.runtime={...link.runtime,type:'portal',style:link.runtime?.style||'step',arrivalFacing:$('#editArrivalFacing').value,returnFacing:$('#editReturnFacing').value};else delete draft.runtime;
      api.change(()=>saveMapLink(project(),draft));api.refresh();
    },'Save connection');
    $('#visitLinkFrom').onclick=()=>visit(link,'from');$('#visitLinkTo').onclick=()=>visit(link,'to');$('#moveLinkFrom').onclick=()=>relocate(link,'from');$('#moveLinkTo').onclick=()=>relocate(link,'to');
    $('#deleteLink').onclick=()=>{if(imported){api.toast('This is an original ROM warp. Disable or replace its native event before removing the planning link.');return;}api.change(()=>removeMapLink(project(),link.id));api.close();api.select(null);api.refresh();};
  }
  function flow(){
    const el=$('#linkFlow');if(!el)return;const p=state.pending;el.hidden=!p;if(!p){el.innerHTML='';return;}
    const isFrom=p.stage==='from',options=p.stage==='options',confirmed=p.stage==='confirm';
    el.innerHTML=`<div><b>${isFrom?'1 · Tap the entrance':options?'2 · Choose the arrival map':p.end==='from'?'Move entrance':'3 · Tap the arrival tile'}</b><span>${isFrom?'Choose where this connection starts.':options?name(p.draft.from.mapId):name(p.target)+(confirmed?' · '+p.draft[p.end].x+', '+p.draft[p.end].y:' · no tile selected')}</span></div><div class="flow-actions">${options?'<button id="linkFlowChoose" type="button">Choose map</button>':!isFrom?'<button id="linkFlowChoose" type="button">Change map</button>':''}${!isFrom&&!options?`<button id="confirmLink" type="button" class="primary" ${confirmed?'':'disabled'}>${p.draft.id?'Move here':'Link here'}</button>`:''}<button id="cancelLinkFlow" type="button" aria-label="Cancel linking">×</button></div>`;
    $('#cancelLinkFlow').onclick=cancel;if($('#confirmLink'))$('#confirmLink').onclick=commit;
    if($('#linkFlowChoose'))$('#linkFlowChoose').onclick=()=>{
      if(p.end!=='from')destination();else api.modal('Move entrance to map',`<label>Map<select id="moveLinkMap">${project().maps.map(m=>`<option value="${esc(m.id)}" ${p.target===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>`,()=>{p.target=$('#moveLinkMap').value;delete p.draft.from;p.stage='target';api.loadMap(p.target);api.mode('linkTarget');api.close();notify();return false;},'Pick tile');
    };
  }
  function render(target){
    target.innerHTML=`<div class="toolbox-actions"><button id="beginMapLink" class="primary" type="button">＋ Link two tiles</button><button id="beginSeamLink" type="button">＋ Continuous map edge</button><button id="connectionView" type="button">${api.view()==='world'?'Edit current map':'World layout'}</button></div><p class="hint-line">Compass arrows mark continuous map edges. ⇄ marks a two-way portal; OUT and IN mark a one-way portal. These symbols do not set player facing. Pick both ends visually. Move drags portal pins; tapping a pin opens its entrance and arrival controls.</p><input id="connectionSearch" type="search" placeholder="Find a map or connection" aria-label="Find a connection" value="${esc(state.query)}"><div id="connectionList"></div>`;
    $('#beginMapLink').onclick=begin;$('#beginSeamLink').onclick=()=>seamDialog();$('#connectionView').onclick=()=>{api.setView(api.view()==='world'?'map':'world');api.collapse();};
    const list=()=>{
      const q=state.query.toLowerCase(),links=project().links.filter(l=>(l.label+' '+name(l.from.mapId)+' '+name(l.to.mapId)).toLowerCase().includes(q));
      $('#connectionList').innerHTML=links.map(l=>`<button class="connection-item" type="button" data-edit-map-link="${esc(l.id)}"><b>${esc(l.label||l.kind)} <small>${isSeamLink(l)?'Continuous edge':l.runtime||isNativeWarp(l)?'Portal':'Map link'}</small></b><span>${endpoint(l.from)} ${l.twoWay?'↔':'→'} ${endpoint(l.to)}</span></button>`).join('')||'<p class="empty">No connections yet. Link two tiles to get started.</p>';
      target.querySelectorAll('[data-edit-map-link]').forEach(b=>b.onclick=()=>edit(project().links.find(l=>l.id===b.dataset.editMapLink)));
    };$('#connectionSearch').oninput=e=>{state.query=e.target.value;list();};list();
  }
  function seamDialog(link=null){
    const from=link?.from.mapId||map().id,setting=link?seamSettings(link):{direction:'north',offset:0},to=link?.to.mapId||project().maps.find(m=>m.id!==from)?.id;
    if(!to){api.toast('Add a second map before joining continuous edges.');return;}
    const options=id=>project().maps.map(m=>`<option value="${esc(m.id)}" ${m.id===id?'selected':''}>${esc(m.name)} · ${m.width} × ${m.height}</option>`).join('');
    api.modal('Continuous map edge',`<p>Walk directly across a map boundary with no door or fade. Separate map records can form one continuous area.</p><label>Name<input id="seamName" maxlength="80" value="${esc(link?.label||'Continuous edge')}"></label><label>From map<select id="seamFrom">${options(from)}</select></label><label>Neighbour map<select id="seamTo">${options(to)}</select></label><div class="field-row"><label>Neighbour is<select id="seamDirection">${Object.keys(EDGES).map(d=>`<option value="${d}" ${d===setting.direction?'selected':''}>${d[0].toUpperCase()+d.slice(1)}</option>`).join('')}</select></label><label>Offset in tiles<input id="seamOffset" type="number" min="-1024" max="1024" value="${setting.offset}"></label></div><p class="hint-line">For north/south joins, positive offsets move the neighbour right. For east/west joins, positive offsets move it down.</p><label class="check"><input id="seamReturn" type="checkbox" ${link?.twoWay!==false?'checked':''}> Join the reverse edge too</label><div id="seamPreview"></div><p class="hint-line">ROM export requires both maps to use matching native tilesets. World diagram positions do not change this alignment.</p>${link?'<button id="removeSeam" type="button" class="danger">Remove continuous edge</button>':''}`,()=>{const draft={id:link?.id,label:$('#seamName').value.trim()||'Continuous edge',from:{mapId:$('#seamFrom').value},to:{mapId:$('#seamTo').value},seam:{direction:$('#seamDirection').value,offset:+$('#seamOffset').value},twoWay:$('#seamReturn').checked};api.change(()=>saveSeamLink(project(),draft));api.refresh();},'Save continuous edge');
    const preview=()=>{const a=project().maps.find(m=>m.id===$('#seamFrom').value),b=project().maps.find(m=>m.id===$('#seamTo').value),d=$('#seamDirection').value,off=+$('#seamOffset').value;try{if(a===b)throw Error('Choose two different maps.');const g=seamGeometry(a,b,d,off),bx=d==='east'?a.width:d==='west'?-b.width:off,by=d==='south'?a.height:d==='north'?-b.height:off,x0=Math.min(0,bx),y0=Math.min(0,by),w=Math.max(a.width,bx+b.width)-x0,h=Math.max(a.height,by+b.height)-y0;$('#seamPreview').innerHTML=`<svg viewBox="${x0-4} ${y0-4} ${w+8} ${h+8}" role="img" aria-label="${esc(d)} map alignment" style="width:100%;height:160px"><rect x="0" y="0" width="${a.width}" height="${a.height}" fill="#b8d67c" stroke="#355846" stroke-width=".6"/><rect x="${bx}" y="${by}" width="${b.width}" height="${b.height}" fill="#80bbc5" stroke="#355846" stroke-width=".6"/></svg><p>${g.overlap} tiles of shared edge · ${esc(a.name)} → ${esc(b.name)}</p>`;}catch(e){$('#seamPreview').textContent=e.message;}};
    for(const id of ['seamFrom','seamTo','seamDirection','seamOffset'])$('#'+id).oninput=preview;preview();if(link)$('#removeSeam').onclick=()=>{api.change(()=>removeMapLink(project(),link.id));api.close();api.select(null);api.refresh();};
  }
  return{state,begin,tap,edit,relocate,flow,render,cancel,commit,visit,seamDialog};
}
