let pending;
export function readSettlementLibrary(){return pending??=fetch('assets/settlements/library.json').then(r=>{if(!r.ok)throw Error('The included settlement library could not be opened.');return r.json();}).catch(e=>{pending=null;throw e;});}
export function adaptSettlementTemplate(template,layers=2,blankId='settlement-transparent'){
 const t=structuredClone(template);if(t.layerCount===layers)return t;if(t.portableBackground&&layers===3&&t.layerCount===2){t.layerCount=3;t.layers.overhead=t.layers.ground.map(()=>({a:blankId,sx:0,sy:0,size:16,renderRole:'foreground'}));return t;}if(!t.bundled)throw Error('This custom object needs a matching number of artwork planes.');t.layerCount=layers;t.overlay.planeAssetIds=layers===3?[t.overlay.planeAssetIds[0],blankId,t.overlay.planeAssetIds[1]]:[t.overlay.planeAssetIds[0],t.overlay.planeAssetIds.at(-1)];return t;
}
export function settlementAssets(library,ids){const by=new Map(library.assets.map(a=>[a.id,a]));return[...new Set(ids)].map(id=>{const a=by.get(id);if(!a)throw Error('Included settlement artwork is missing: '+id);return a;});}
export function chooseRoom(library,t){return library.rooms.find(r=>r.id===t.roomId)||library.rooms.find(r=>r.profileId===t.profileId&&r.kind===t.kind)||library.rooms.find(r=>r.kind===t.kind)||library.rooms.find(r=>r.kind==='house');}
