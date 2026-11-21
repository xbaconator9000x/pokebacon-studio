import {stageTrainerEncounter,readTrainerEncounter} from './native-trainer-encounter.js';
export function openNativeTrainerEncounter(api,root,onSaved=()=>{}){
 const s=api.session?.(),sourceId=s?.id,$=id=>document.querySelector(id),esc=api.esc;
 try{
  if(!s||root?.kind!=='npcs')throw Error('Choose an original ROM NPC trainer.');
  const native=s.reader.byKey(root.mapKey),npc=native&&s.reader.events(native).npcs.find(n=>n.index===root.index);
  if(!npc)throw Error('Original NPC record unavailable.');
  const info=readTrainerEncounter(s.reader.bytes.slice(npc.address,npc.address+24));
  if(![1,2].includes(info.trainerType))throw Error('Not a standard original trainer. Custom/berry data remains read-only.');
  const map=api.project().maps.find(m=>m.rom?.sourceId===sourceId&&m.rom.key===root.mapKey&&!m.rom.isCopy),marker=map?.markers.find(n=>n.rom?.type==='npc'&&n.rom.index===root.index);
  if(!marker)throw Error('Import the original map and NPC pins first.');
  const values=marker.rom.trainerEncounter?.sourceId===sourceId?marker.rom.trainerEncounter.after:info;
  const num=(id,label,v,min,max)=>'<label>'+label+'<input id="'+id+'" type="number" min="'+min+'" max="'+max+'" step="1" value="'+esc(String(v))+'"></label>';
  api.modal('Trainer sight & patrol',`<p><b>${esc(marker.title)}</b> · ${esc(map.name)}. Editing verified original Gen III NPC template bytes, not a preview-only radius.</p><label>Trainer behaviour<select id="nativeTrainerType"><option value="1" ${values.trainerType===1?'selected':''}>Normal sight</option><option value="2" ${values.trainerType===2?'selected':''}>Alternate directional sight (engine-specific)</option></select></label><div class="field-row">${num('nativeTrainerSight','Sight distance (1–15 tiles)',values.sightRange,1,15)}${num('nativeTrainerX','Movement range X (0–15)',values.rangeX,0,15)}${num('nativeTrainerY','Movement range Y (0–15)',values.rangeY,0,15)}</div><p class="hint-line">Movement range only applies to applicable movement types. Sight, battle AI and rematches are not simulated. Export verifies the exact original NPC record.</p>`,()=>{
   const after={trainerType:+$('#nativeTrainerType').value,sightRange:+$('#nativeTrainerSight').value,rangeX:+$('#nativeTrainerX').value,rangeY:+$('#nativeTrainerY').value};
   const result=stageTrainerEncounter(api.project(),s.reader,sourceId,root,after);
   api.change(()=>{result.marker.rom.trainerEncounter=result.edit;});onSaved();api.toast('Trainer encounter edit saved to project.');return true;
  },'Save encounter');
 }catch(e){api.modal('Trainer encounter unavailable','<p>'+esc(e.message)+'</p><p>The original ROM has not been modified.</p>');}
}
