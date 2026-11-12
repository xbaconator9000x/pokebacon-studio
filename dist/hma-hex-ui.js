import {parseROMOffset,hexInput,formatHex,hexRows,findROMHex,hexDiffSummary,hexState,stageROMHex,installROMHexEdits} from './native-hex-workspace.js';
import {hmaMetadata,importHMAToml,tableDefinitions,saveTableDefinition,tableRecord,editTableField} from './hma-table-workspace.js';
import {RomOutput} from './rom-writer.js';
const TYPES=['u8','s8','u16','s16','u32','s32','ptr','ascii'];
export function hmaHexWorkshop(api){
 const $=s=>document.querySelector(s),esc=api.esc;
 const state={tab:'hex',offset:0,query:'',tableId:'',row:0,anchorQuery:'',anchorPage:0,editing:null};
 const session=()=>api.session(),data=()=>session().reader.bytes,id=()=>session().id,source=()=>api.project();
 const safe=f=>{try{const result=f();if(result&&typeof result.then==='function')result.catch(api.error);return result;}catch(error){api.error(error);return null;}};
 const nbytes=()=>hexState(source(),id())?.patches?.length||0;
 function open(tab=state.tab){
  state.tab=tab;
  if(!session()){api.modal('ROM hex & tables','<p>Open the original GBA ROM to inspect real bytes and create reversible native edits. Projects cannot use arbitrary byte addresses without a matching source.</p><button id="hmaHexChoose" type="button" class="primary">Open GBA ROM</button>');$('#hmaHexChoose').onclick=()=>api.pickROM('hex');return;}
  render();
 }
 function shell(content){
  const bytes=data();
  api.modal('ROM hex & typed tables','<p class="hint-line">'+esc(session().reader.filename)+' · '+bytes.length.toLocaleString()+' bytes · '+nbytes()+' staged byte changes. Source ROM stays untouched.</p><div class="studio-tabs">'+[['hex','Hex'],['tables','Typed tables'],['metadata','HMA metadata'],['changes','Review changes']].map(([tab,name])=>'<button type="button" data-hex-tab="'+tab+'" '+(state.tab===tab?'class="active"':'')+'>'+name+'</button>').join('')+'</div><div id="hmaHexBody">'+content+'</div>',null,'Done');
  document.querySelectorAll('[data-hex-tab]').forEach(b=>b.onclick=()=>open(b.dataset.hexTab));
 }
 function render(){
  if(state.tab==='hex')return hexScreen();
  if(state.tab==='tables')return tablesScreen();
  if(state.tab==='metadata')return metadataScreen();
  return changesScreen();
 }
 function hexScreen(){
  const bytes=data(),pos=Math.max(0,Math.min(bytes.length-1,state.offset));
  const rows=hexRows(source(),id(),bytes,pos,{rows:16}),current=hexState(source(),id());
  const block=rows.map(row=>'<div class="hma-hex-line"><span>0x'+row.address.toString(16).toUpperCase().padStart(6,'0')+'</span><div style="display:grid;grid-template-columns:repeat(16,minmax(23px,1fr));gap:1px;min-width:380px">'+row.columns.map(cell=>'<button type="button" class="hma-hex-byte" data-hex-at="'+cell.at+'" title="Original '+cell.original.toString(16).padStart(2,'0')+'" style="padding:3px 0;font:12px monospace;min-width:0;'+(cell.edited?'font-weight:700;text-decoration:underline':'')+'">'+cell.byte.toString(16).toUpperCase().padStart(2,'0')+'</button>').join('')+'</div><code>'+esc(row.columns.map(c=>c.ascii).join(''))+'</code></div>').join('');
  shell('<p class="hint-line">Address is a decimal or 0x-prefixed hexadecimal source offset. Tap a byte to fill the editor. All changes are staged in project history until export.</p><div class="studio-actions"><label>Go to address<input id="hmaGoto" inputmode="text" value="0x'+pos.toString(16).toUpperCase()+'"></label><button id="hmaGo" type="button">Go</button><button id="hmaPrev" type="button">◀ Previous</button><button id="hmaNext" type="button">Next ▶</button></div><div style="overflow:auto;max-width:100%;font:12px monospace">'+block+'</div><div class="studio-actions"><label>Edit at offset<input id="hmaEditAt" value="0x'+pos.toString(16).toUpperCase()+'"></label><label>Hex bytes (max 4096)<textarea id="hmaEditHex" rows="2" placeholder="00 FF 7A"></textarea></label><button id="hmaStage" type="button" class="primary">Stage byte edit</button></div><div class="studio-actions"><label>Search bytes<input id="hmaSearch" placeholder="12 AB FF"></label><button id="hmaFind" type="button">Find next</button></div><p class="hint-line">Raw edits to code, pointers, header data, and shared resources are high risk. Other PokéBacon editor writes take precedence: conflicting regions abort ROM export instead of silently overwriting them.</p>');
  $('#hmaGo').onclick=()=>safe(()=>{state.offset=parseROMOffset($('#hmaGoto').value,bytes.length);render();});
  $('#hmaPrev').onclick=()=>{state.offset=Math.max(0,(pos&~255)-256);render();};
  $('#hmaNext').onclick=()=>{state.offset=Math.min(bytes.length-1,(pos&~255)+256);render();};
  document.querySelectorAll('[data-hex-at]').forEach(b=>b.onclick=()=>{const at=+b.dataset.hexAt;$('#hmaEditAt').value='0x'+at.toString(16).toUpperCase();$('#hmaEditHex').value=b.textContent;});
  $('#hmaStage').onclick=()=>safe(()=>{
   const at=parseROMOffset($('#hmaEditAt').value,bytes.length),payload=hexInput($('#hmaEditHex').value);
   api.change(()=>stageROMHex(source(),id(),bytes,at,payload));state.offset=at;render();api.toast('Staged '+payload.length+' byte(s). Undo is available.');
  });
  $('#hmaFind').onclick=()=>safe(()=>{
   const hits=findROMHex(source(),id(),bytes,hexInput($('#hmaSearch').value),{from:Math.min(bytes.length-1,pos+1),limit:1});
   if(!hits.length){api.toast('No later match in ROM.');return;}
   state.offset=hits[0];render();api.toast('Found at 0x'+state.offset.toString(16).toUpperCase());
  });
 }
 function tablesScreen(){
  const tables=tableDefinitions(source(),id(),data());
  if(!tables.some(t=>t.id===state.tableId))state.tableId=tables[0]?.id||'';
  const table=tables.find(t=>t.id===state.tableId),rows=table?Array.from({length:Math.min(16,Math.max(0,table.count-state.row))},(_,i)=>tableRecord(source(),id(),data(),table,state.row+i)):[];
  shell('<p>Define reusable typed layouts for source ROM records. Named HMA anchors can prefill the address; unknown HMA format strings are never guessed or written.</p><div class="studio-actions"><label>Tables<select id="hmaTablePick">'+tables.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===state.tableId?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select></label><button id="hmaCreateTable" type="button">＋ New layout</button>'+(table?'<button id="hmaEditTable" type="button">Edit layout</button>':'')+'</div>'+(table?'<div class="studio-actions"><button id="hmaTablePrev" type="button">◀</button><span>Rows '+(state.row+1)+'–'+(state.row+rows.length)+' / '+table.count+'</span><button id="hmaTableNext" type="button">▶</button></div><div style="overflow:auto"><table><thead><tr><th>Row / ROM offset</th>'+table.fields.map(f=>'<th>'+esc(f.name)+' <small>'+esc(f.type)+'</small></th>').join('')+'</tr></thead><tbody>'+rows.map(record=>'<tr><td>'+record.index+' / 0x'+record.at.toString(16).toUpperCase()+'</td>'+table.fields.map((f,i)=>'<td><button type="button" data-table-row="'+record.index+'" data-table-field="'+i+'">'+esc(f.type==='ptr'?'0x'+record.values[f.name].toString(16).toUpperCase():record.values[f.name])+'</button></td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="hint-line">Tap a cell to stage a typed edit. Numeric values use little-endian ROM encoding; pointers are range checked.</p>':'<p>No typed layouts yet. Create one for a verified native table and reuse it for all its records.</p>'));
  if($('#hmaTablePick'))$('#hmaTablePick').onchange=()=>{state.tableId=$('#hmaTablePick').value;state.row=0;render();};
  $('#hmaCreateTable').onclick=()=>tableEditor(null);
  if(table){$('#hmaEditTable').onclick=()=>tableEditor(table);$('#hmaTablePrev').onclick=()=>{state.row=Math.max(0,state.row-16);render();};$('#hmaTableNext').onclick=()=>{state.row=Math.min(table.count-1,state.row+16);render();};}
  document.querySelectorAll('[data-table-row]').forEach(b=>b.onclick=()=>editCell(table,+b.dataset.tableRow,table.fields[+b.dataset.tableField]));
 }
 function tableEditor(previous,{anchor=null}={}){
  const sourceBytes=data(),model=previous?structuredClone(previous):{id:'table-'+Date.now().toString(36),name:anchor?.name||'New ROM table',address:anchor?.at??0,stride:4,count:1,fields:[{name:'value',type:'u32',offset:0}]};
  const fieldRow=(f,i)=>'<div class="studio-actions hma-field"><label>Name<input data-fname value="'+esc(f.name)+'"></label><label>Type<select data-ftype>'+TYPES.map(t=>'<option '+(f.type===t?'selected':'')+' value="'+t+'">'+t+'</option>').join('')+'</select></label><label>Offset<input data-foffset type="number" min="0" value="'+f.offset+'"></label><label>ASCII length<input data-flength type="number" min="1" max="256" value="'+(f.length||1)+'"></label><button type="button" data-fremove="'+i+'">×</button></div>';
  const body='<p>Only listed fields are editable. HMA text/image/battle formats must be handled by dedicated verified adapters, not guessed as integers.</p><label>Layout name<input id="hmaLayoutName" value="'+esc(model.name)+'"></label><div class="studio-actions"><label>Source start offset<input id="hmaLayoutAt" value="0x'+model.address.toString(16).toUpperCase()+'"></label><label>Row stride in bytes<input id="hmaLayoutStride" type="number" min="1" max="4096" value="'+model.stride+'"></label><label>Row count<input id="hmaLayoutCount" type="number" min="1" max="4096" value="'+model.count+'"></label></div><div id="hmaFields">'+model.fields.map(fieldRow).join('')+'</div><button id="hmaAddField" type="button">＋ Column</button>';
  api.modal(previous?'Edit typed table layout':'Create typed table layout',body,()=>{const rows=[...document.querySelectorAll('#hmaFields .hma-field')],columns=rows.map(row=>({name:row.querySelector('[data-fname]').value.trim(),type:row.querySelector('[data-ftype]').value,offset:Number(row.querySelector('[data-foffset]').value),...(row.querySelector('[data-ftype]').value==='ascii'?{length:Number(row.querySelector('[data-flength]').value)}:{})}));const table={id:model.id,name:$('#hmaLayoutName').value.trim(),address:parseROMOffset($('#hmaLayoutAt').value,sourceBytes.length),stride:Number($('#hmaLayoutStride').value),count:Number($('#hmaLayoutCount').value),fields:columns};api.change(()=>saveTableDefinition(source(),id(),sourceBytes,table));state.tableId=table.id;state.row=0;render();return false;},'Save layout');
  $('#hmaAddField').onclick=()=>{const block=$('#hmaFields');if(block.children.length>=32){api.toast('Maximum 32 columns.');return;}block.insertAdjacentHTML('beforeend',fieldRow({name:'field'+(block.children.length+1),type:'u8',offset:0},block.children.length));wireRemove();};
  function wireRemove(){document.querySelectorAll('[data-fremove]').forEach(b=>b.onclick=()=>b.closest('.hma-field').remove());}wireRemove();
 }
 function editCell(table,row,field){
  const current=tableRecord(source(),id(),data(),table,row).values[field.name],isPointer=field.type==='ptr';
  api.modal('Edit '+table.name+' · row '+row+' · '+field.name,'<p>Original source offset: 0x'+(table.address+row*table.stride+field.offset).toString(16).toUpperCase()+'</p><label>New '+esc(field.type)+' value<input id="hmaCellValue" value="'+esc(isPointer?'0x'+current.toString(16).toUpperCase():current)+'"></label><p class="hint-line">This operation will stage a reversible binary write, not change the source ROM on disk.</p>',()=>{api.change(()=>editTableField(source(),id(),data(),table,row,field.name,$('#hmaCellValue').value));state.row=Math.floor(row/16)*16;tablesScreen();return false;},'Apply typed edit');
 }
 function metadataScreen(){
  const meta=hmaMetadata(source(),id(),data()),query=state.anchorQuery.toLowerCase(),anchors=meta.anchors.filter(a=>a.name.toLowerCase().includes(query)||a.format.toLowerCase().includes(query));
  const shown=anchors.slice(state.anchorPage*40,state.anchorPage*40+40);
  shell('<p>Import an original HMA .toml anchor file. The full text is retained unchanged, including lists, groups, unknown formats and offset pointers. Only verified numeric layouts become editable.</p><label class="studio-actions">HMA TOML<input id="hmaTomlInput" type="file" accept=".toml,text/plain"></label><p>'+meta.anchors.length+' named anchors · '+meta.offsetPointers.length+' offset pointers · '+meta.warnings.length+' ignored/invalid entries</p><label>Find anchor<input id="hmaAnchorQuery" value="'+esc(state.anchorQuery)+'" placeholder="data.pokemon"></label><div class="studio-actions"><button id="hmaAnchorPrev" type="button">◀</button><span>'+anchors.length+' matches · page '+(state.anchorPage+1)+'</span><button id="hmaAnchorNext" type="button">▶</button></div><div style="max-height:42vh;overflow:auto">'+shown.map((a,i)=>'<article class="studio-record"><b>'+esc(a.name)+'</b><small>0x'+a.at.toString(16).toUpperCase()+' · '+esc(a.format.slice(0,160))+'</small><button type="button" data-hma-anchor="'+i+'">Hex</button><button type="button" data-hma-make="'+i+'">Table layout</button></article>').join('')+'</div>');
  $('#hmaTomlInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;safe(()=>{if(file.size>2*1024*1024)throw Error('HMA TOML file must be under 2 MiB.');});if(file.size>2*1024*1024)return;try{const raw=await file.text();api.change(()=>importHMAToml(source(),id(),data(),raw));state.anchorPage=0;render();api.toast('HMA metadata attached; unknown definitions preserved.');}catch(err){api.error(err);}};
  $('#hmaAnchorQuery').onchange=()=>{state.anchorQuery=$('#hmaAnchorQuery').value;state.anchorPage=0;render();};
  $('#hmaAnchorPrev').onclick=()=>{state.anchorPage=Math.max(0,state.anchorPage-1);render();};
  $('#hmaAnchorNext').onclick=()=>{state.anchorPage=Math.min(Math.max(0,Math.ceil(anchors.length/40)-1),state.anchorPage+1);render();};
  document.querySelectorAll('[data-hma-anchor]').forEach(b=>b.onclick=()=>{state.offset=shown[+b.dataset.hmaAnchor].at;open('hex');});
  document.querySelectorAll('[data-hma-make]').forEach(b=>b.onclick=()=>tableEditor(null,{anchor:shown[+b.dataset.hmaMake]}));
 }
 function changesScreen(){
  const diff=hexDiffSummary(source(),id(),data(),{limit:120});
  shell('<p>'+diff.changedBytes.toLocaleString()+' staged bytes in '+diff.spanCount+' contiguous ranges. Edits are applied to a copy only when the exact source and ownership checks pass.</p><div class="studio-actions"><button id="hmaExportSource" type="button" class="primary">Export source + hex/table edits (.gba)</button><button id="hmaExportAll" type="button">Compile all project ROM edits</button><button id="hmaClearChanges" type="button">Clear staged binary changes</button></div><p class="hint-line">Source + hex export does not compile map, event, creature or other PokéBacon authoring changes. Use Compile all for those; conflicting addresses will abort. Changing data owned by other editors with raw bytes can break game behavior.</p><div style="max-height:45vh;overflow:auto">'+diff.spans.map(span=>'<article class="studio-record"><b>0x'+span.at.toString(16).toUpperCase()+' · '+span.before.length+' bytes</b><small>'+esc(formatHex(span.before).slice(0,160))+' → '+esc(formatHex(span.after).slice(0,160))+'</small><button type="button" data-hma-diff="'+span.at+'">View</button></article>').join('')+'</div>');
  $('#hmaExportSource').onclick=()=>safe(async()=>{const sessionAt=session(),out=new RomOutput(data());const applied=installROMHexEdits(source(),id(),data(),out);if(!applied.bytes)throw Error('No staged binary edits to export.');if(session()!==sessionAt)throw Error('The opened source ROM changed during export.');await api.save(new Blob([out.bytes],{type:'application/octet-stream'}),session().reader.filename.replace(/\.gba$/i,'')+'_hex_edited.gba');api.toast('Exported a source-only edited ROM copy.');});
  $('#hmaExportAll').onclick=()=>api.exportROM();
  $('#hmaClearChanges').onclick=()=>safe(()=>{if(!nbytes())return;api.modal('Clear staged hex/table writes','<p>Remove all staged raw-byte edits for this ROM? Your project-owned table layouts and original HMA metadata will remain.</p>',()=>{api.change(()=>{source().hexStudio.sources[id()].patches=[];});open('changes');return false;},'Clear edits');});
  document.querySelectorAll('[data-hma-diff]').forEach(b=>b.onclick=()=>{state.offset=+b.dataset.hmaDiff;open('hex');});
 }
 return{open,state};
}
