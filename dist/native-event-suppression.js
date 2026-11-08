const GROUPS={npcs:{pointer:4,size:24,xy:4},triggers:{pointer:12,size:16,xy:0},signs:{pointer:16,size:12,xy:0}};
export const SUPPRESSED_EVENT_COORDINATE=32760;
export function rawNativeEvent(reader,native,group,index){const g=GROUPS[group];if(!g||!Number.isInteger(index)||index<0||index>=reader.u8(native.events+({npcs:0,triggers:2,signs:3}[group])))return null;const at=reader.ptr(native.events+g.pointer)+index*g.size;return reader.valid(at,g.size)?reader.bytes.slice(at,at+g.size):null;}
export function isAppliedSuppression(reader,native,row){const b=rawNativeEvent(reader,native,row.group,row.index),g=GROUPS[row.group];if(!b||!g)return false;const v=new DataView(b.buffer,b.byteOffset,b.byteLength);return v.getUint16(g.xy,true)===32760&&v.getUint16(g.xy+2,true)===32760&&b.every((n,i)=>i>=g.xy&&i<g.xy+4||n===row.bytes[i]);}
export function applyNativeEventSuppressions(reader,entry){entry.suppressedEvents=new Set();if(entry.isNew)return;for(const row of entry.map.rom?.suppressedEvents||[]){const current=rawNativeEvent(reader,entry.base,row.group,row.index);if(!current||current.some((v,i)=>v!==row.bytes[i]))throw Error(entry.map.name+': a project-overridden native event changed. Refresh its source binding before exporting.');if(entry.map.markers.some(n=>n.rom?.index===row.index&&({npc:'npcs',sign:'signs',trigger:'triggers'}[n.rom.type]===row.group)))throw Error('A suppressed native event still has an active pin. Review its binding.');const g=GROUPS[row.group],record=entry.events[row.group][row.index],v=new DataView(record.buffer,record.byteOffset,record.byteLength);v.setUint16(g.xy,32760,true);v.setUint16(g.xy+2,32760,true);entry.suppressedEvents.add(row.group+':'+row.index);entry.changed=true;}}
export function validateNativeEventSuppressions(map){const rows=map.rom?.suppressedEvents;if(rows===undefined)return;if(!Array.isArray(rows)||rows.length>765)throw Error('Invalid overridden native events.');const seen=new Set();for(const r of rows){const g=GROUPS[r?.group],key=r?.group+':'+r?.index;if(!g||!Number.isInteger(r.index)||r.index<0||r.index>254||seen.has(key)||!Array.isArray(r.bytes)||r.bytes.length!==g.size||r.bytes.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Invalid native event override binding.');seen.add(key);}}
// Explicit recovery only, after the caller verifies the two source revisions.
// A suppression of an appended record cannot apply to a source without that
// record. Keep its evidence in the project; never reinterpret an existing row.
export function retireAbsentSuppressionBindings(existing,previous,next){
 const project=structuredClone(existing),retired=[];
 for(const map of project.maps){const before=previous.byKey(map.rom?.key),after=next.byKey(map.rom?.key);if(!before||!after)continue;
  map.rom.suppressedEvents=(map.rom.suppressedEvents||[]).filter(row=>{const records=next.events(after)[row.group]||[],raw=rawNativeEvent(previous,before,row.group,row.index),matches=b=>b?.length===row.bytes.length&&b.every((v,i)=>v===row.bytes[i]);
   if(row.index<records.length||!matches(raw)||records.some(e=>matches(rawNativeEvent(next,after,row.group,e.index))))return true;
   retired.push({mapId:map.id,key:map.rom.key,...structuredClone(row),reason:'Absent from restored original source; exact record verified in previous exported source'});return false;
  });
 }
 if(retired.length){project.sourceRecoveryHistory??=[];project.sourceRecoveryHistory.push({kind:'retired-absent-native-suppressions',records:retired});}return{project,retired};
}
