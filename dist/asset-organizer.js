const words=v=>Array.isArray(v)?v.join(' '):String(v||'');
export function packInfo(p,lookup=()=>null){
 if(p.packId||p.packName)return{id:p.packId||p.packName,name:p.packName||p.packId};
 const a=lookup(p.assetId||p.a||p.id)||p,original=lookup(a.sourceId),file=p.provenance?.filename||p.provenance?.file;
 const source=p.source||original?.name||a.packName;
 let name=file?/heart.*soul/i.test(file)?'Heart & Soul · Johto':/fire.*red/i.test(file)?'FireRed · Kanto':file.replace(/\.gba$/i,''):source||(/^creator-/.test(a.id||'')?(p.region?'ROM · '+p.region:'Creator collection'):a.rom?'Imported ROM · '+(a.rom.sourceId||'').slice(0,8):a.data?'My imported artwork':a.name||'Other');
 name=String(name).replace(/\s+/g,' ').trim();return{id:name.toLowerCase(),name};
}
export function packOptions(items,lookup){const packs=new Map();for(const p of items){const info=packInfo(p,lookup);if(!packs.has(info.id))packs.set(info.id,{...info,count:0});packs.get(info.id).count++;}return[...packs.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));}
export function assetSearchText(p,lookup){return[p.name,p.category,words(p.tags),p.source,p.region,packInfo(p,lookup).name].filter(Boolean).join(' ').toLowerCase();}
export function paletteCell(event,canvas,tileSize){const r=canvas.getBoundingClientRect();if(r.width<=0||r.height<=0)return null;const x=Math.floor((event.clientX-r.left)/r.width*canvas.width/tileSize),y=Math.floor((event.clientY-r.top)/r.height*canvas.height/tileSize);return x>=0&&y>=0&&x*tileSize<canvas.width&&y*tileSize<canvas.height?{x,y}:null;}
