// A native warp index is also an arrival coordinate used by other maps/scripts.
// Retain that anchor, but use impossible player elevation 255 to remove departure.
export const INACTIVE_WARP_ELEVATION=255;
export function removeNativeWarp(map,index){
 const original=map.rom?.events?.warps?.find(w=>w.index===index);
 if(!original)throw Error('This warp has no retained native record. Refresh its source map first.');
 map.rom.removedWarps??=[];
 if(!map.rom.removedWarps.some(w=>w.index===index))map.rom.removedWarps.push(structuredClone(original));
 map.markers=map.markers.filter(n=>n.rom?.type!=='warp'||n.rom.index!==index);
}
export function applyWarpRemovals(reader,entry){
 if(entry.isNew)return 0;
 const removed=entry.map.rom?.removedWarps||[];
 for(const saved of removed){
  const native=reader.events(entry.base).warps.find(w=>w.index===saved.index),fields=['x','y','elevation','target','warp'];
  if(!native||fields.some(k=>native[k]!==saved[k]))throw Error(entry.map.name+': deleted warp '+saved.index+' no longer matches its source. Refresh the project before exporting.');
  const record=entry.events.warps[saved.index];if(!record)throw Error('Deleted warp index is missing.');record[4]=INACTIVE_WARP_ELEVATION;entry.changed=true;
 }
 return removed.length;
}
export function validateWarpRemovals(map){const rows=map.rom?.removedWarps;if(rows===undefined)return;if(!Array.isArray(rows)||rows.length>255)throw Error('Invalid deleted warp collection.');const ids=new Set();for(const w of rows){if(!w||!Number.isInteger(w.index)||w.index<0||w.index>254||ids.has(w.index)||!Number.isInteger(w.x)||!Number.isInteger(w.y)||!Number.isInteger(w.elevation)||w.elevation<0||w.elevation>255||!Number.isInteger(w.warp)||w.warp<0||w.warp>255||!/^\d+\.\d+$/.test(w.target||''))throw Error('Invalid deleted warp binding.');ids.add(w.index);}}
