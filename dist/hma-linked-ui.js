// Mobile/desktop review workflow for complete HMA linked-length table groups.
// Unknown engine dependencies remain explicitly user-reviewed, not inferred.
import {tableDefinitions} from './hma-table-workspace.js';
import {findROMReferences} from './hma-pointer-navigation.js';
import {planLinkedTableExpansionGroup} from './hma-linked-expansion.js';
import {parseROMOffset} from './native-hex-workspace.js';

export function openLinkedGroupReview(api,{project,sourceId,bytes,selected,onCommit}){
 const esc=api.esc,$=s=>document.querySelector(s);
 const defs=tableDefinitions(project,sourceId,bytes),anchorName=selected.linkedLength?.anchor||selected.name;
 const base=defs.find(t=>t.name===anchorName&&!t.linkedLength);
 const members=defs.filter(t=>t===base||t.linkedLength?.anchor===anchorName);
 if(!base||members.length<2||members.length>8)
  throw Error('Create all 2–8 verified fixed-anchor and linked native HMA table layouts first.');
 const pending=project.hexStudio?.sources?.[sourceId]?.repoints||[];
 if(pending.some(p=>members.some(t=>t.id===p.tableId)))
  throw Error('Remove existing growth plans for this HMA dependency group before re-reviewing it.');
 const upper=Math.min(4096,base.count+64,...members.map(t=>base.count+Math.floor(65536/t.stride)));
 if(upper<=base.count)throw Error('This HMA source dependency group has no native expansion capacity.');
 const candidates=members.map(t=>({table:t,refs:findROMReferences(project,sourceId,bytes,t.address,{limit:65,scanUnaligned:true})}));
 const format=n=>'0x'+n.toString(16).toUpperCase();
 const inputSites=candidates.map(({table,refs})=>
  '<label>'+esc(table.name)+' · '+table.count+' original records'+
   (table.linkedLength?' · derived count delta '+table.linkedLength.delta:'')+
   '<textarea data-linked-pointer-sites="'+esc(table.id)+'" rows="2" placeholder="One or more verified pointer offsets">'+
    esc(refs.length<65?refs.map(r=>format(r.at)).join(', '):'')+'</textarea></label>'+
    (refs.length===65?'<p class="error-text">More than 64 possible pointers: review and narrow the table before queuing.</p>':'')).join('');
 api.modal('Review linked HMA table expansion',
  '<p>All '+members.length+' HMA tables must grow together. Only the base table has a native literal count; dependent row counts are derived from original HMA metadata. Exact original pointer sites and code dependencies must be confirmed for this specific ROM.</p>'+
  '<p><b>Anchor:</b> '+esc(base.name)+' · original count '+base.count+'</p>'+
  '<label>New base row count<input id="hmaLinkedTarget" type="number" min="'+(base.count+1)+'" max="'+upper+'" inputmode="numeric" value="'+Math.min(upper,base.count+2)+'"></label>'+
  '<label>Reviewed native base count source offset<input id="hmaLinkedCountSite" type="text" inputmode="text" placeholder="0x000558"></label>'+
  '<label>Original count width<select id="hmaLinkedWidth"><option value="1">8-bit</option><option value="2" selected>16-bit</option><option value="4">32-bit</option></select></label>'+
  '<label>Initialize appended rows<select id="hmaLinkedSeed"><option value="copy-last">Copy final source row</option><option value="zero">Zero-filled</option></select></label>'+
  '<details><summary>Additional reviewed base count dependencies</summary><label>Extra literal count sites (0xOFFSET 1/2/4 per line)<textarea id="hmaLinkedExtra" rows="3"></textarea></label><label>Engine Thumb sites (0xOFFSET cmp/movs per line)<textarea id="hmaLinkedThumb" rows="3"></textarea></label></details>'+
  inputSites+
  '<label class="check"><input id="hmaLinkedReviewed" type="checkbox"> I verified every pointer and the original base count dependency for this ROM. I understand that computed engine dependencies are not inferred.</label>',
  ()=>{
   if(!$('#hmaLinkedReviewed').checked)throw Error('Confirm native source pointer/count ownership before queuing the entire group.');
   if(!api.session()||api.session().id!==sourceId||api.session().reader.bytes!==bytes||api.project()!==project)
    throw Error('The original source ROM/project changed during review.');
   const count=Number($('#hmaLinkedTarget').value);
   if(!Number.isInteger(count)||count<=base.count||count>upper)throw Error('Choose an in-range new base row count.');
   const site=parseROMOffset($('#hmaLinkedCountSite').value.trim(),bytes.length),width=Number($('#hmaLinkedWidth').value);
   const lines=id=>$('#'+id).value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   const extra=lines('hmaLinkedExtra').map(line=>{
    const m=line.match(/^(0x[0-9a-f]+|\d+)\s+([124])$/i);
    if(!m)throw Error('Extra native counts require one 0xOFFSET 1/2/4 value per line.');
    return{at:parseROMOffset(m[1],bytes.length),width:Number(m[2])};
   });
   const thumb=lines('hmaLinkedThumb').map(line=>{
    const m=line.match(/^(0x[0-9a-f]+|\d+)\s+(cmp|movs)$/i);
    if(!m)throw Error('Thumb dependencies require one 0xOFFSET cmp/movs value per line.');
    return{at:parseROMOffset(m[1],bytes.length),kind:'thumb-'+m[2].toLowerCase()};
   });
   const reviews=members.map(t=>{
    const input=document.querySelector('[data-linked-pointer-sites="'+t.id+'"]');
    const sites=input.value.split(/[\s,;]+/).filter(Boolean).map(x=>parseROMOffset(x,bytes.length));
    return{tableId:t.id,sites,...(t===base?{countSite:site,countWidth:width,extraCountSites:extra,engineSites:thumb}:{})};
   });
   api.change(()=>planLinkedTableExpansionGroup(project,sourceId,bytes,{
    anchorName,newBaseCount:count,members:reviews,seed:$('#hmaLinkedSeed').value
   }));
   onCommit?.(base);
   return false;
  },'Queue linked tables');
 return{anchorName,members:members.map(t=>t.id)};
}
