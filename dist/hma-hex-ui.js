import {parseROMOffset,hexInput,formatHex,hexRows,findROMHex,hexDiffSummary,hexState,stageROMHex,installROMHexEdits} from './native-hex-workspace.js';
import {hmaMetadata,importHMAToml,tableDefinitions,saveTableDefinition,tableRecord,editTableField,fixedNumericHMATable,copyTableRecord,swapTableRecords,fillTableColumn,findTableRows,replaceTableColumnMatches,setTableBitRange,exportTableCSV,importTableCSV} from './hma-table-workspace.js';
import {pointerAt,findROMReferences,planSafeTableRepoint,installSafeTableRepoints} from './hma-pointer-navigation.js';
import {createIPS} from './ips.js';
import {RomOutput} from './rom-writer.js';
const TYPES=['u8','s8','u16','s16','u32','s32','ptr','ascii'];
export function hmaHexWorkshop(api){
 const $=s=>document.querySelector(s),esc=api.esc;
 const state={tab:'hex',offset:0,query:'',tableId:'',row:0,anchorQuery:'',anchorPage:0,tableSearchField:'',tableSearchValue:'',editing:null,pointerSite:0x200,pointerTarget:0x200};
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
  api.modal('ROM hex & typed tables','<p class="hint-line">'+esc(session().reader.filename)+' · '+bytes.length.toLocaleString()+' bytes · '+nbytes()+' staged byte changes. Source ROM stays untouched.</p><div class="studio-tabs">'+[['hex','Hex'],['pointers','Pointers'],['tables','Typed tables'],['metadata','HMA metadata'],['changes','Review changes']].map(([tab,name])=>'<button type="button" data-hex-tab="'+tab+'" '+(state.tab===tab?'class="active"':'')+'>'+name+'</button>').join('')+'</div><div id="hmaHexBody">'+content+'</div>',null,'Done');
  document.querySelectorAll('[data-hex-tab]').forEach(b=>b.onclick=()=>open(b.dataset.hexTab));
 }
 function render(){
  if(state.tab==='hex')return hexScreen();
  if(state.tab==='pointers')return pointersScreen();
  if(state.tab==='tables')return tablesScreen();
  if(state.tab==='metadata')return metadataScreen();
  return changesScreen();
 }
 function hexScreen(){
  const bytes=data(),pos=Math.max(0,Math.min(bytes.length-1,state.offset));
  const rows=hexRows(source(),id(),bytes,pos,{rows:16}),current=hexState(source(),id());
  const block=rows.map(row=>'<div class="hma-hex-line"><span>0x'+row.address.toString(16).toUpperCase().padStart(6,'0')+'</span><div style="display:grid;grid-template-columns:repeat(16,minmax(23px,1fr));gap:1px;min-width:380px">'+row.columns.map(cell=>'<button type="button" class="hma-hex-byte" data-hex-at="'+cell.at+'" title="Original '+cell.original.toString(16).padStart(2,'0')+'" style="padding:3px 0;font:12px monospace;min-width:0;'+(cell.edited?'font-weight:700;text-decoration:underline':'')+'">'+cell.byte.toString(16).toUpperCase().padStart(2,'0')+'</button>').join('')+'</div><code>'+esc(row.columns.map(c=>c.ascii).join(''))+'</code></div>').join('');
  shell('<p class="hint-line">Address is a decimal or 0x-prefixed hexadecimal source offset. Tap a byte to fill the editor. All changes are staged in project history until export.</p><div class="studio-actions"><label>Go to address<input id="hmaGoto" inputmode="text" value="0x'+pos.toString(16).toUpperCase()+'"></label><button id="hmaGo" type="button">Go</button><button id="hmaPrev" type="button">◀ Previous</button><button id="hmaNext" type="button">Next ▶</button></div><div style="overflow:auto;max-width:100%;font:12px monospace">'+block+'</div><div class="studio-actions"><label>Edit at offset<input id="hmaEditAt" value="0x'+pos.toString(16).toUpperCase()+'"></label><label>Hex bytes (max 4096)<textarea id="hmaEditHex" rows="2" placeholder="00 FF 7A"></textarea></label><button id="hmaStage" type="button" class="primary">Stage byte edit</button></div><div class="studio-actions"><label>Search bytes<input id="hmaSearch" placeholder="12 AB FF"></label><button id="hmaFind" type="button">Find next</button><button id="hmaFollow" type="button">Follow pointer</button><button id="hmaUses" type="button">Find pointer uses</button></div><p class="hint-line">Raw edits to code, pointers, header data, and shared resources are high risk. Other PokéBacon editor writes take precedence: conflicting regions abort ROM export instead of silently overwriting them.</p>');
  $('#hmaGo').onclick=()=>safe(()=>{state.offset=parseROMOffset($('#hmaGoto').value,bytes.length);render();});
  $('#hmaPrev').onclick=()=>{state.offset=Math.max(0,(pos&~255)-256);render();};
  $('#hmaNext').onclick=()=>{state.offset=Math.min(bytes.length-1,(pos&~255)+256);render();};
  document.querySelectorAll('[data-hex-at]').forEach(b=>b.onclick=()=>{const at=+b.dataset.hexAt;$('#hmaEditAt').value='0x'+at.toString(16).toUpperCase();$('#hmaEditHex').value=b.textContent;});
  $('#hmaStage').onclick=()=>safe(()=>{
   const at=parseROMOffset($('#hmaEditAt').value,bytes.length),payload=hexInput($('#hmaEditHex').value);
   api.change(()=>stageROMHex(source(),id(),bytes,at,payload));state.offset=at;render();api.toast('Staged '+payload.length+' byte(s). Undo is available.');
  });
  $('#hmaFollow').onclick=()=>safe(()=>{state.pointerSite=parseROMOffset($('#hmaEditAt').value,bytes.length);const p=pointerAt(source(),id(),bytes,state.pointerSite);if(!p.valid)throw Error('This location is not an in-ROM pointer.');state.offset=p.at;open('hex');api.toast('Followed '+p.kind+' pointer to 0x'+p.at.toString(16).toUpperCase());});
  $('#hmaUses').onclick=()=>{state.pointerTarget=pos;open('pointers');};
  $('#hmaFind').onclick=()=>safe(()=>{
   const hits=findROMHex(source(),id(),bytes,hexInput($('#hmaSearch').value),{from:Math.min(bytes.length-1,pos+1),limit:1});
   if(!hits.length){api.toast('No later match in ROM.');return;}
   state.offset=hits[0];render();api.toast('Found at 0x'+state.offset.toString(16).toUpperCase());
  });
 }
 function pointersScreen(){
  const bytes=data(),format=n=>'0x'+Number(n).toString(16).toUpperCase();
  let inspected=null,refs=[],error='';
  try{
   inspected=pointerAt(source(),id(),bytes,state.pointerSite);
   refs=findROMReferences(source(),id(),bytes,state.pointerTarget,{limit:64,scanUnaligned:true});
  }catch(e){error=e.message;}
  shell('<p>Native 0x08/0x09 32-bit references, including packed/unaligned values, are <b>candidates</b>, not proven ownership. HMA OffsetPointer entries are recognized for inspection but will never be silently rewritten.</p><div class="studio-actions"><label>Pointer source offset<input id="hmaPointerSite" value="'+format(state.pointerSite)+'"></label><button id="hmaInspectPtr" type="button">Inspect</button><label>Target offset<input id="hmaPointerTarget" value="'+format(state.pointerTarget)+'"></label><button id="hmaSearchRefs" type="button">Find uses</button></div><div id="hmaPointerReport">'+(error?'<p class="needs-attention">'+esc(error)+'</p>':'<p>Source '+format(inspected.site)+' → '+(inspected.valid?format(inspected.at):'not a valid ROM pointer')+' · '+esc(inspected.kind)+'</p><button id="hmaJumpPtr" type="button" '+(!inspected.valid?'disabled':'')+'>Follow pointer</button><p>'+refs.length+' references displayed for '+format(state.pointerTarget)+' (at most 64; more may exist). The byte scan includes unaligned direct pointer patterns.</p><div style="max-height:42vh;overflow:auto">'+refs.map(r=>'<div class="field-row"><small>'+format(r.at)+' · '+esc(r.kind)+(r.owner?.name?' · '+esc(r.owner.name):'')+'</small><button type="button" data-hma-ptrsite="'+r.at+'">Inspect</button><button type="button" data-hma-gotosite="'+r.at+'">Hex</button></div>').join('')+'</div>')+'</div>');
  $('#hmaInspectPtr').onclick=()=>safe(()=>{state.pointerSite=parseROMOffset($('#hmaPointerSite').value,bytes.length);const pointer=pointerAt(source(),id(),bytes,state.pointerSite);if(pointer.valid)state.pointerTarget=pointer.at;render();});
  $('#hmaSearchRefs').onclick=()=>safe(()=>{state.pointerTarget=parseROMOffset($('#hmaPointerTarget').value,bytes.length);render();});
  if($('#hmaJumpPtr'))$('#hmaJumpPtr').onclick=()=>{state.offset=inspected.at;open('hex');};
  document.querySelectorAll('[data-hma-ptrsite]').forEach(b=>b.onclick=()=>{state.pointerSite=+b.dataset.hmaPtrsite;render();});
  document.querySelectorAll('[data-hma-gotosite]').forEach(b=>b.onclick=()=>{state.offset=+b.dataset.hmaGotosite;open('hex');});
 }
 function reviewTableRepoint(table){
  const refs=findROMReferences(source(),id(),data(),table.address,{limit:65,scanUnaligned:true}),format=n=>'0x'+n.toString(16).toUpperCase(),queued=hexState(source(),id())?.repoints?.find(p=>p.tableId===table.id);
  api.modal('Review native table repoint','<p>Copy '+esc(table.name)+' ('+(table.count*table.stride)+' bytes) into a new ROM allocation, then update <b>all reviewed direct pointer sites</b>. This does not increase row count or prove compatibility with arbitrary packed bytecode.</p><p>'+refs.length+' candidate pointer sites'+(refs.length===65?' (more may exist; relink is blocked)':'')+': '+esc(refs.map(r=>format(r.at)+' · '+r.kind).join(', ')||'none')+'</p>'+(queued?'<p>Already queued; every export will revalidate the original source and pointer sites.</p>':'<label>Reviewed source pointer addresses (comma/space separated)<textarea id="hmaRepointSites" rows="3">'+esc(refs.length<65?refs.map(r=>format(r.at)).join(', '):'')+'</textarea></label>')+'<p class="hint-line">Unverified engine references, dynamic pointer calculations, hardcoded addresses or unexpected shared resources may need manual engine work. Keep your original ROM backup.</p>',queued?null:()=>{const sites=$('#hmaRepointSites').value.split(/[\s,;]+/).filter(Boolean).map(x=>parseROMOffset(x,data().length));api.change(()=>planSafeTableRepoint(source(),id(),data(),table,sites));open('tables');return false;},queued?'Done':'Queue repoint');
 }
 function tablesScreen(){
  const tables=tableDefinitions(source(),id(),data());
  if(!tables.some(t=>t.id===state.tableId))state.tableId=tables[0]?.id||'';
  const table=tables.find(t=>t.id===state.tableId);
  const searching=!!(table&&state.tableSearchValue);
  const field=table?.fields.some(f=>f.name===state.tableSearchField)?state.tableSearchField:table?.fields[0]?.name;
  const matches=searching?findTableRows(source(),id(),data(),table,field,state.tableSearchValue,{limit:32}):[];
  const rows=table?(searching?matches.map(x=>tableRecord(source(),id(),data(),table,x.index)):Array.from({length:Math.min(16,Math.max(0,table.count-state.row))},(_,i)=>tableRecord(source(),id(),data(),table,state.row+i))):[];
  shell('<p>Define reusable typed layouts for source ROM records. Named HMA anchors can prefill the address; unknown HMA format strings are never guessed or written.</p><div class="studio-actions"><label>Tables<select id="hmaTablePick">'+tables.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===state.tableId?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select></label><button id="hmaCreateTable" type="button">＋ New layout</button>'+(table?'<button id="hmaEditTable" type="button">Edit layout</button><button id="hmaRepointTable" type="button">Review table repoint</button><button id="hmaExportTableCSV" type="button">Export CSV</button><button id="hmaImportTableCSV" type="button">Import CSV</button>':'')+'</div>'+(table?'<div class="studio-actions"><button id="hmaTablePrev" type="button" '+(searching?'disabled':'')+'>◀</button><span>'+(searching?'First '+rows.length+' matching rows':('Rows '+(state.row+1)+'–'+(state.row+rows.length)+' / '+table.count))+'</span><button id="hmaTableNext" type="button" '+(searching?'disabled':'')+'>▶</button><button id="hmaBulkFill" type="button">Fill a column…</button><button id="hmaBulkReplace" type="button">Replace matches…</button><label>Jump to row<input id="hmaJumpRow" type="number" inputmode="numeric" min="0" max="'+(table.count-1)+'" value="'+state.row+'"></label><button id="hmaGoRow" type="button">Go</button></div><div class="studio-actions"><label>Find in column<select id="hmaTableFindField">'+table.fields.map(f=>'<option value="'+esc(f.name)+'" '+(field===f.name?'selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label><label>Value<input id="hmaTableFindValue" value="'+esc(state.tableSearchValue)+'" placeholder="Number or text"></label><button id="hmaTableSearch" type="button">Find rows</button><button id="hmaTableClearSearch" type="button">All rows</button></div><div style="overflow:auto"><table><thead><tr><th>Row / ROM offset</th>'+table.fields.map(f=>'<th>'+esc(f.name)+' <small>'+esc(f.type)+'</small></th>').join('')+'</tr></thead><tbody>'+rows.map(record=>'<tr><td>'+record.index+' / 0x'+record.at.toString(16).toUpperCase()+' <button type="button" data-table-rowtool="'+record.index+'">Copy/swap</button></td>'+table.fields.map((f,i)=>'<td><button type="button" data-table-row="'+record.index+'" data-table-field="'+i+'">'+esc(f.type==='ptr'||f.display==='hex'?'0x'+record.values[f.name].toString(16).toUpperCase():record.values[f.name])+'</button>'+(f.type==='ptr'?'<button type="button" data-table-ptr="'+record.index+'" data-table-ptr-field="'+i+'">Follow</button>':'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="hint-line">Tap a cell to stage a typed edit. Numeric values use little-endian ROM encoding; pointers are range checked.</p>':'<p>No typed layouts yet. Create one for a verified native table and reuse it for all its records.</p>'));
  if($('#hmaTablePick'))$('#hmaTablePick').onchange=()=>{state.tableId=$('#hmaTablePick').value;state.row=0;state.tableSearchValue='';state.tableSearchField='';render();};
  $('#hmaCreateTable').onclick=()=>tableEditor(null);
  if(table){
   $('#hmaEditTable').onclick=()=>tableEditor(table);
   $('#hmaRepointTable').onclick=()=>reviewTableRepoint(table);
   $('#hmaExportTableCSV').onclick=()=>safe(async()=>{
    const original=session(),csv=exportTableCSV(source(),id(),data(),table);
    if(session()!==original)throw Error('The original ROM changed during CSV export.');
    await api.save(new Blob([csv],{type:'text/csv;charset=utf-8'}),table.id+'.csv');
    api.toast('Exported existing source-bound table rows as CSV.');
   });
   $('#hmaImportTableCSV').onclick=()=>tableCSVImport(table);
   $('#hmaTablePrev').onclick=()=>{state.row=Math.max(0,state.row-16);render();};
   $('#hmaTableNext').onclick=()=>{state.row=Math.min(table.count-1,state.row+16);render();};
   $('#hmaBulkFill').onclick=()=>bulkFillTable(table);
   $('#hmaBulkReplace').onclick=()=>bulkReplaceTable(table);
   $('#hmaGoRow').onclick=()=>safe(()=>{const value=$('#hmaJumpRow').value.trim(),row=Number(value);if(!/^\d+$/.test(value)||!Number.isInteger(row)||row<0||row>=table.count)throw Error('Choose an existing zero-based row.');state.row=Math.floor(row/16)*16;state.tableSearchValue='';render();});
   $('#hmaTableSearch').onclick=()=>safe(()=>{state.tableSearchField=$('#hmaTableFindField').value;state.tableSearchValue=$('#hmaTableFindValue').value.trim();if(!state.tableSearchValue)throw Error('Enter a value to search.');render();});
   $('#hmaTableClearSearch').onclick=()=>{state.tableSearchValue='';render();};
  }
  document.querySelectorAll('[data-table-row]').forEach(b=>b.onclick=()=>editCell(table,+b.dataset.tableRow,table.fields[+b.dataset.tableField]));
  document.querySelectorAll('[data-table-rowtool]').forEach(b=>b.onclick=()=>tableRowTool(table,+b.dataset.tableRowtool));
  document.querySelectorAll('[data-table-ptr]').forEach(b=>b.onclick=()=>{const field=table.fields[+b.dataset.tablePtrField],row=+b.dataset.tablePtr;state.pointerSite=table.address+row*table.stride+field.offset;open('pointers');});
 }
 function tableCSVImport(table){
  api.modal('Import existing table rows from CSV','<p>Choose an exported CSV with the first header <code>row</code> and one or more exact column names. This stages values only for existing row IDs. All rows are validated together; no table expansion, unknown-column writes or partial commits are permitted.</p><label>Typed table CSV<input type="file" id="hmaTableCSVFile" accept=".csv,text/csv"></label><button type="button" id="hmaTableCSVStage" class="primary">Validate and stage CSV</button><p class="hint-line">Maximum 256 rows, 2,048 typed cells and 2 MiB per import. Export a copy of the ROM and keep an original backup before testing engine-dependent record changes.</p>',null,'Done');
  $('#hmaTableCSVStage').onclick=async()=>safe(async()=>{
   const file=$('#hmaTableCSVFile').files?.[0],opened=session();
   if(!file)throw Error('Choose a CSV file to import.');
   if(file.size>2*1024*1024)throw Error('CSV file exceeds the 2 MiB limit.');
   const text=await file.text();
   if(session()!==opened)throw Error('The original ROM changed while reading CSV.');
   const report=api.change(()=>importTableCSV(source(),id(),data(),table,text));
   state.row=0;state.tableSearchValue='';open('tables');
   api.toast('Validated and staged '+(report?.records??'selected')+' existing CSV rows.');
  });
 }
 function tableRowTool(table,row){
  api.modal('Copy or swap a native table row','<p>Source row '+row+' of '+esc(table.name)+'. Copy replaces the entire destination row, including uninterpreted padding bytes; swap exchanges both complete existing rows. No new engine table entries are created.</p><label>Operation<select id="hmaRowOperation"><option value="copy">Copy source row into destination</option><option value="swap">Swap the two rows</option></select></label><label>Destination row (0–'+(table.count-1)+')<input id="hmaRowDestination" type="number" inputmode="numeric" min="0" max="'+(table.count-1)+'" value="'+Math.min(table.count-1,row+1)+'"></label>',()=>{
   const target=Number($('#hmaRowDestination').value),operation=$('#hmaRowOperation').value;
   api.change(()=>operation==='swap'?swapTableRecords(source(),id(),data(),table,row,target):copyTableRecord(source(),id(),data(),table,row,target));
   state.row=Math.floor(target/16)*16;state.tableSearchValue='';render();return false;
  },'Stage row operation');
 }
 function bulkFillTable(table){
  const start=Math.min(state.row,table.count-1),end=Math.min(table.count-1,start+15);
  api.modal('Fill an existing table column','<p>Stages the same typed value in up to 256 existing rows. This never enlarges the ROM table, and native writer collisions still block export.</p><label>Column<select id="hmaFillField">'+table.fields.map(f=>'<option value="'+esc(f.name)+'">'+esc(f.name)+' ('+f.type+')</option>').join('')+'</select></label><div class="studio-actions"><label>First row<input id="hmaFillStart" type="number" inputmode="numeric" min="0" max="'+(table.count-1)+'" value="'+start+'"></label><label>Last row (inclusive)<input id="hmaFillEnd" type="number" inputmode="numeric" min="0" max="'+(table.count-1)+'" value="'+end+'"></label></div><label>New typed value<input id="hmaFillValue" placeholder="Decimal, 0x pointer or ASCII"></label><p class="hint-line">Review the selected range before applying. All values are validated before committing; undo restores the previous staged changes.</p>',()=>{
   const field=$('#hmaFillField').value,first=Number($('#hmaFillStart').value),last=Number($('#hmaFillEnd').value),value=$('#hmaFillValue').value;
   api.change(()=>fillTableColumn(source(),id(),data(),table,field,first,last,value));
   state.row=Math.floor(first/16)*16;state.tableSearchValue='';render();return false;
  },'Stage column fill');
 }
 function bulkReplaceTable(table){
  api.modal('Replace matching typed table values','<p>Find exact values in a selected native table column and replace all matches together. Existing records only; no hidden partial updates. If more than 256 records match, narrow the range first.</p><label>Column<select id="hmaReplaceField">'+table.fields.map(f=>'<option value="'+esc(f.name)+'">'+esc(f.name)+' ('+f.type+')</option>').join('')+'</select></label><div class="studio-actions"><label>First row<input id="hmaReplaceStart" type="number" inputmode="numeric" min="0" max="'+(table.count-1)+'" value="0"></label><label>Last row<input id="hmaReplaceEnd" type="number" inputmode="numeric" min="0" max="'+(table.count-1)+'" value="'+(table.count-1)+'"></label></div><label>Exact old value<input id="hmaReplaceOld" placeholder="Decimal, 0x pointer, or ASCII"></label><label>Replacement value<input id="hmaReplaceNew" placeholder="Validated typed value"></label><p class="hint-line">Matches are compared against staged values. Failed validation, excess matches or writer conflicts leave the project unchanged. Undo restores the previous edits.</p>',()=>{
   const field=$('#hmaReplaceField').value,first=Number($('#hmaReplaceStart').value),last=Number($('#hmaReplaceEnd').value);
   const result=api.change(()=>replaceTableColumnMatches(source(),id(),data(),table,field,$('#hmaReplaceOld').value,$('#hmaReplaceNew').value,{start:first,end:last}));
   state.row=Math.floor(first/16)*16;state.tableSearchValue='';render();api.toast('Replaced '+(result?.matches??0)+' matching rows.');return false;
  },'Stage exact replacements');
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
  const current=tableRecord(source(),id(),data(),table,row).values[field.name],isPointer=field.type==='ptr',canEditBits=['u8','u16','u32'].includes(field.type);
  api.modal('Edit '+table.name+' · row '+row+' · '+field.name,'<p>Original source offset: 0x'+(table.address+row*table.stride+field.offset).toString(16).toUpperCase()+'</p><label>New '+esc(field.type)+' value<input id="hmaCellValue" value="'+esc(isPointer?'0x'+current.toString(16).toUpperCase():current)+'"></label><p class="hint-line">This operation will stage a reversible binary write, not change the source ROM on disk.</p>'+(canEditBits?'<button id="hmaCellEditBits" type="button">Edit selected flag bits…</button>':''),()=>{api.change(()=>editTableField(source(),id(),data(),table,row,field.name,$('#hmaCellValue').value));state.row=Math.floor(row/16)*16;tablesScreen();return false;},'Apply typed edit');
  if(canEditBits)$('#hmaCellEditBits').onclick=()=>tableBitsEditor(table,row,field);
 }
 function tableBitsEditor(table,row,field){
  const max=table.count-1,bitMax=({'u8':8,'u16':16,'u32':32})[field.type],current=tableRecord(source(),id(),data(),table,row).values[field.name];
  api.modal('Edit native bit flags · '+esc(table.name),'<p>Editing unsigned '+field.type+' field <b>'+esc(field.name)+'</b> in row '+row+'. Existing neighbouring bits and other columns are preserved. The selected bit range is zero-based, counting from the least significant bit.</p><p>Current value: <code>0x'+current.toString(16).toUpperCase()+'</code></p><div class="studio-actions"><label>First bit<input id="hmaBitsStart" type="number" inputmode="numeric" min="0" max="'+(bitMax-1)+'" value="0"></label><label>Number of bits<input id="hmaBitsWidth" type="number" inputmode="numeric" min="1" max="'+bitMax+'" value="1"></label><label>New bit value<input id="hmaBitsValue" inputmode="numeric" value="1"></label></div><label>Apply from row '+row+' through row (max '+max+')<input id="hmaBitsLastRow" type="number" inputmode="numeric" min="'+row+'" max="'+max+'" value="'+row+'"></label><p class="hint-line">Batch edit is limited to 256 rows. All writes are validated and committed atomically, and the source ROM remains immutable.</p>',()=>{
   const start=$('#hmaBitsStart').value.trim(),width=$('#hmaBitsWidth').value.trim(),last=$('#hmaBitsLastRow').value.trim();
   if(!/^\d+$/.test(start)||!/^\d+$/.test(width)||!/^\d+$/.test(last))throw Error('Bit offsets and row IDs must be whole numbers.');
   const report=api.change(()=>setTableBitRange(source(),id(),data(),table,field.name,row,Number(last),Number(start),Number(width),$('#hmaBitsValue').value));
   state.row=Math.floor(row/16)*16;state.tableSearchValue='';render();
   api.toast('Updated '+(report?.rows??1)+' row(s), preserving unrelated bits.');return false;
  },'Stage bit flags');
 }
 function metadataScreen(){
  const meta=hmaMetadata(source(),id(),data()),query=state.anchorQuery.toLowerCase(),anchors=meta.anchors.filter(a=>a.name.toLowerCase().includes(query)||a.format.toLowerCase().includes(query));
  const shown=anchors.slice(state.anchorPage*40,state.anchorPage*40+40);
  shell('<p>Import an original HMA .toml anchor file. The full text is retained unchanged, including lists, groups, unknown formats and offset pointers. Only verified fixed-width numeric, direct pointer and matched-length layouts become editable.</p><label class="studio-actions">HMA TOML<input id="hmaTomlInput" type="file" accept=".toml,text/plain"></label><p>'+meta.anchors.length+' named anchors · '+meta.offsetPointers.length+' offset pointers · '+meta.warnings.length+' ignored/invalid entries</p><label>Find anchor<input id="hmaAnchorQuery" value="'+esc(state.anchorQuery)+'" placeholder="data.pokemon"></label><div class="studio-actions"><button id="hmaAnchorPrev" type="button">◀</button><span>'+anchors.length+' matches · page '+(state.anchorPage+1)+'</span><button id="hmaAnchorNext" type="button">▶</button></div><div style="max-height:42vh;overflow:auto">'+shown.map((a,i)=>'<article class="studio-record"><b>'+esc(a.name)+'</b><small>0x'+a.at.toString(16).toUpperCase()+' · '+esc(a.format.slice(0,160))+'</small><button type="button" data-hma-anchor="'+i+'">Hex</button><button type="button" data-hma-make="'+i+'">Table layout</button>'+(fixedNumericHMATable(a,data().length,{anchors:meta.anchors})?'<button type="button" data-hma-auto="'+i+'">Import typed table</button>':'')+'<button type="button" data-hma-refs="'+i+'">References</button></article>').join('')+'</div>');
  $('#hmaTomlInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;safe(()=>{if(file.size>2*1024*1024)throw Error('HMA TOML file must be under 2 MiB.');});if(file.size>2*1024*1024)return;try{const raw=await file.text();api.change(()=>importHMAToml(source(),id(),data(),raw));state.anchorPage=0;render();api.toast('HMA metadata attached; unknown definitions preserved.');}catch(err){api.error(err);}};
  $('#hmaAnchorQuery').onchange=()=>{state.anchorQuery=$('#hmaAnchorQuery').value;state.anchorPage=0;render();};
  $('#hmaAnchorPrev').onclick=()=>{state.anchorPage=Math.max(0,state.anchorPage-1);render();};
  $('#hmaAnchorNext').onclick=()=>{state.anchorPage=Math.min(Math.max(0,Math.ceil(anchors.length/40)-1),state.anchorPage+1);render();};
  document.querySelectorAll('[data-hma-anchor]').forEach(b=>b.onclick=()=>{state.offset=shown[+b.dataset.hmaAnchor].at;open('hex');});
  document.querySelectorAll('[data-hma-make]').forEach(b=>b.onclick=()=>tableEditor(null,{anchor:shown[+b.dataset.hmaMake]}));
  document.querySelectorAll('[data-hma-auto]').forEach(b=>b.onclick=()=>safe(()=>{const table=fixedNumericHMATable(shown[+b.dataset.hmaAuto],data().length,{anchors:meta.anchors});if(!table)throw Error('This HMA format cannot safely become a fixed-width typed table.');api.change(()=>saveTableDefinition(source(),id(),data(),table));state.tableId=table.id;state.row=0;open('tables');}));
  document.querySelectorAll('[data-hma-refs]').forEach(b=>b.onclick=()=>{state.pointerTarget=shown[+b.dataset.hmaRefs].at;open('pointers');});
 }
 function changesScreen(){
  const diff=hexDiffSummary(source(),id(),data(),{limit:120});
  shell('<p>'+diff.changedBytes.toLocaleString()+' staged bytes in '+diff.spanCount+' contiguous ranges and '+(hexState(source(),id())?.repoints?.length||0)+' guarded table repoints. Edits are applied to a copy only when the exact source and ownership checks pass.</p><div class="studio-actions"><button id="hmaExportSource" type="button" class="primary">Export source + hex/table edits (.gba)</button><button id="hmaExportAll" type="button">Compile all project ROM edits</button><button id="hmaCreateIPS" type="button">Create source-only IPS patch</button><button id="hmaClearChanges" type="button">Clear staged binary changes</button></div><p class="hint-line">Source + hex export does not compile map, event, creature or other PokéBacon authoring changes. Use Compile all for those; conflicting addresses will abort. Changing data owned by other editors with raw bytes can break game behavior.</p><div style="max-height:45vh;overflow:auto">'+diff.spans.map(span=>'<article class="studio-record"><b>0x'+span.at.toString(16).toUpperCase()+' · '+span.before.length+' bytes</b><small>'+esc(formatHex(span.before).slice(0,160))+' → '+esc(formatHex(span.after).slice(0,160))+'</small><button type="button" data-hma-diff="'+span.at+'">View</button></article>').join('')+'</div>');
  $('#hmaExportSource').onclick=()=>safe(async()=>{const sessionAt=session(),out=new RomOutput(data());const applied=installROMHexEdits(source(),id(),data(),out);const repointed=installSafeTableRepoints(source(),id(),data(),out);if(!applied.bytes&&!repointed.length)throw Error('No staged binary edits or table repoints to export.');if(session()!==sessionAt)throw Error('The opened source ROM changed during export.');await api.save(new Blob([out.bytes],{type:'application/octet-stream'}),session().reader.filename.replace(/\.gba$/i,'')+'_hex_edited.gba');api.toast('Exported a source-only edited ROM copy.');});
  $('#hmaExportAll').onclick=()=>api.exportROM();
  $('#hmaCreateIPS').onclick=()=>safe(async()=>{const current=session(),out=new RomOutput(data());const result=installROMHexEdits(source(),id(),data(),out);const repointed=installSafeTableRepoints(source(),id(),data(),out);if(!result.bytes&&!repointed.length)throw Error('No source hex edits or repoints to include.');const patch=createIPS(data(),out.bytes);if(session()!==current)throw Error('The attached ROM changed.');await api.save(new Blob([patch.bytes],{type:'application/octet-stream'}),current.reader.filename.replace(/\.gba$/i,'')+'_hex.ips');api.toast('IPS round-trip verified against the current source.');});
  $('#hmaClearChanges').onclick=()=>safe(()=>{if(!nbytes())return;api.modal('Clear staged hex/table writes','<p>Remove all staged raw-byte edits for this ROM? Your project-owned table layouts and original HMA metadata will remain.</p>',()=>{api.change(()=>{source().hexStudio.sources[id()].patches=[];});open('changes');return false;},'Clear edits');});
  document.querySelectorAll('[data-hma-diff]').forEach(b=>b.onclick=()=>{state.offset=+b.dataset.hmaDiff;open('hex');});
 }
 return{open,state};
}
