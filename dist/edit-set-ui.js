import{applyGameDataEdits}from'./game-data.js';
import{editsFor}from'./game-edits.js';
import{buildEditSet,parseEditSet,reviewEditSet,editsToApply,mergeEdits}from'./edit-set.js';
// Export and import of game-data edit sets from the Game workshop overview.
export function editSetTools(api,state,rerender){
 const $=s=>document.querySelector(s),esc=api.esc;
 const dry=(key,id,patch)=>{try{applyGameDataEdits(state.context.reader.bytes,state.context.profile,{[key]:{[id]:patch}},{write(){},int(){},allocate(){return 0x1000000;}});return '';}catch(e){return e.message;}};
 async function exportSet(){
  const c=state.context,e=editsFor(api.project(),c.hash)||{},set=buildEditSet(e,c.data,{name:api.project().name,sha256:c.hash,engine:c.reader.engine||''});
  if(!set.entries.length){api.toast('There are no game data edits to export yet.');return;}
  await api.saveBlob(new Blob([JSON.stringify(set)],{type:'application/json'}),'pokebacon-edit-set.json');
 }
 function pick(){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{review(parseEditSet(await f.text()));}catch(e){api.error?.(e)||api.toast(e.message);}};
  input.click();
 }
 function review(set){
  const c=state.context,r=reviewEditSet(set,c.data,{profile:c.profile,validate:dry}),s=r.summary,odd=r.rows.filter(x=>x.status!=='clean'&&x.status!=='already').slice(0,40);
  api.modal('Review edit set',`<p><b>${s.clean}</b> ready to apply · <b>${s.already}</b> already match · <b>${s.conflict}</b> conflict · <b>${s.unsupported+s.missing}</b> cannot be applied.</p><p>A ready edit replaces values that still match the ROM it was made against. A conflict means this ROM holds different values from both the original and the edit.</p>${odd.length?`<ul>${odd.map(x=>`<li>${esc(x.key)} ${esc(x.id)} ${esc(x.label)}: ${esc(x.status)}${x.note?' · '+esc(x.note):''}${x.fields.length?' ('+esc(x.fields.filter(f=>f[1]==='conflict').map(f=>f[0]).join(', '))+')':''}</li>`).join('')}</ul>`:''}${r.skipped.sprites||r.skipped.forms?`<p>${r.skipped.sprites} sprite and ${r.skipped.forms} form edits are not carried in edit sets.</p>`:''}${s.conflict?'<label class="check"><input id="editSetConflicts" type="checkbox"> Also apply conflicting edits (replaces this ROM’s values)</label>':''}<div class="smart-actions"><button id="editSetApply" type="button" class="primary" ${s.clean||s.conflict?'':'disabled'}>Apply to this project</button><button id="editSetCancel" type="button">Cancel</button></div>`);
  $('#editSetCancel').onclick=()=>api.close();
  $('#editSetApply').onclick=()=>{const inc=!!$('#editSetConflicts')?.checked,add=editsToApply(r,{includeConflicts:inc});let n=0;api.change(()=>{n=mergeEdits(editsFor(api.project(),c.hash,true),add);});api.refresh();api.close();api.toast(n+' edits added. Compile the ROM to play them.');rerender();};
 }
 return{exportSet,pick};
}
