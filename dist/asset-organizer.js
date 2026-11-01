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

// Source-sheet browsing is a view over assets, never a destructive merge.
export function sourceSheetKind(a){
 const category=a.category||'',name=a.name||'';
 if(/preview/i.test(category)||a.preview===true)return'preview';
 if(Number.isInteger(a.rom?.layer)||category==='ROM layers'||/\b(?:Lower|Middle|Upper) tiles$/i.test(name)||/-(?:lo|hi)$/.test(a.id||''))return'layer';
 if(a.rom||/^ROM\s/i.test(name)||category==='ROM tiles')return'rom';
 if(/Smart terrain|Objects|objects|Included settlement assets|Curated creator assets|Interior ·|Doors & portals|Walls & gates/.test(category))return'piece';
 return'sheet';
}
export function sourceSheetCategory(a){const k=sourceSheetKind(a);if(k==='rom'||k==='layer')return'ROM maps';if(k==='piece')return'Object pieces';if(k==='preview')return'Previews';const s=[a.name,a.category,words(a.tags)].join(' ');return /interior|room|furniture|bed|kitchen|office|shop/i.test(s)?'Interiors':/water|sea|ocean|river|puddle/i.test(s)?'Water':/cave|rock|mountain|cliff/i.test(s)?'Caves & rock':/house|building|roof|city|town|gate/i.test(s)?'Buildings & towns':/tree|garden|forest|flower|grass|plant/i.test(s)?'Nature':a.data?'Imported sheets':'Mixed sheets';}
const cleanSheetName=a=>String(a.name||'Untitled sheet').replace(/^ROM\s+[^·]+·\s*/i,'').replace(/\s*·\s*(Lower|Middle|Upper) tiles$/i,'').replace(/\s+/g,' ').trim();
function sourceSheetPart(a){const named=/\b(Lower|Middle|Upper) tiles$/i.exec(a.name||'');if(named)return named[1]+' layer';if(Number.isInteger(a.rom?.layer))return(a.rom.metatileLayers===3?['Lower layer','Middle layer','Upper layer']:['Lower layer','Upper layer'])[a.rom.layer]||'Individual layer';return /-lo$/.test(a.id||'')?'Ground layer':/-hi$/.test(a.id||'')?'Foreground layer':'Individual layer';}
export function sourceSheetChoices(assets,{maps=[],activeMapId,selectedId,scope='map',showParts=false,category='all',query=''}={}){
 const used=new Map(),mark=(id,m)=>{if(!id)return;if(!used.has(id))used.set(id,[]);if(!used.get(id).includes(m))used.get(id).push(m);};
 for(const m of maps){for(const id of [m.rom?.atlasId,...m.rom?.layerAtlasIds||[]])mark(id,m);for(const layer of Object.values(m.layers||{}))for(const t of layer)if(t)mark(t.a,m);for(const o of m.objects||[])mark(o.assetId,m);for(const g of m.gates||[])for(const id of [g.closedAssetId,g.openAssetId])mark(id,m);}
 const active=maps.find(m=>m.id===activeMapId),projectIds=new Set(used.keys()),currentIds=new Set([...used].filter(([,ms])=>ms.includes(active)).map(([id])=>id)),payloads=new Map(),rows=[],seenIds=new Set();
 for(const a of assets){if(seenIds.has(a.id))continue;seenIds.add(a.id);const kind=sourceSheetKind(a);if(kind==='preview'||!showParts&&['layer','piece'].includes(kind))continue;if(scope==='map'&&!currentIds.has(a.id)||scope==='project'&&!projectIds.has(a.id))continue;
  const context=used.get(a.id)||[],current=context.find(m=>m.id===activeMapId),native=current||context[0],part=sourceSheetPart(a),label=cleanSheetName(a)+(kind==='layer'?' · '+part:''),pack=packInfo(a).name,group=['rom','layer'].includes(kind)?(current?'Current map':'ROM map sheets'):sourceSheetCategory(a),subtitle=[native?.name,`${Math.ceil(a.width/(a.tileSize||16))} × ${Math.ceil(a.height/(a.tileSize||16))} tiles`,!['rom','layer'].includes(kind)?pack:null].filter(Boolean).join(' · '),payload=a.data||a.src||a.id,meta=JSON.stringify([a.width,a.height,a.tileSize||16,kind,a.rom||null]);
  let byMeta=payloads.get(payload);if(!byMeta){byMeta=new Map();payloads.set(payload,byMeta);}let row=byMeta.get(meta);if(row){row.aliases.push(a.id);row.search+=' '+assetSearchText(a);if(a.id===selectedId)row.asset=a;continue;}
  row={asset:a,label,subtitle,group,category:sourceSheetCategory(a),kind,aliases:[a.id],search:[assetSearchText(a),label,subtitle,...context.map(m=>m.name)].join(' ').toLowerCase(),current:!!current};byMeta.set(meta,row);rows.push(row);
 }
 const categories=[...new Set(rows.map(r=>r.category))].sort(),terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean),visible=rows.filter(r=>(category==='all'||r.category===category)&&terms.every(t=>r.search.includes(t)));
 const names=new Map();for(const r of visible){const n=r.label.toLowerCase();names.set(n,(names.get(n)||0)+1);}for(const r of visible)if(names.get(r.label.toLowerCase())>1)r.label+=' · '+r.subtitle;
 const repeated=new Map(),labelCounts=new Map();for(const r of visible)labelCounts.set(r.label,(labelCounts.get(r.label)||0)+1);for(const r of [...visible].sort((a,b)=>a.asset.id.localeCompare(b.asset.id))){const label=r.label;if(labelCounts.get(label)>1){const n=(repeated.get(label)||0)+1;repeated.set(label,n);r.label+=' · Variant '+n;}}
 visible.sort((a,b)=>Number(b.current)-Number(a.current)||a.group.localeCompare(b.group)||a.label.localeCompare(b.label,undefined,{numeric:true})||a.asset.id.localeCompare(b.asset.id));
 return{rows:visible,categories,aliases:visible.reduce((n,r)=>n+r.aliases.length-1,0)};
}
