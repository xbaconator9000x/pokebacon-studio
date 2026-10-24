// Native event indices remain stable when a visual endpoint moves.
export function nativeWarpBinding(reader,project,link,end){
  if(!link.rom)return null;
  const original=end==='from'?link.rom.originalFrom:link.rom.originalTo;
  const map=project.maps.find(m=>m.id===original?.mapId),key=map?.rom?.key;if(!key)return null;
  const native=reader.byKey(key);if(!native)return null;
  const entries=(link.rom.events||[]).map(s=>/^(.+):warp-(\d+)$/.exec(s)).filter(Boolean).filter(m=>m[1]===key);
  const events=reader.events(native).warps;
  const direct=entries.find(m=>events.some(w=>w.index===+m[2]&&w.x===original.x&&w.y===original.y));
  if(direct)return{key,index:+direct[2]};
  // A one-way imported link stores only its departure event ID.
  const opposite=end==='from'?link.rom.originalTo:link.rom.originalFrom,other=project.maps.find(m=>m.id===opposite?.mapId)?.rom?.key,source=other&&reader.byKey(other);
  const warp=source&&reader.events(source).warps.find(w=>w.x===opposite.x&&w.y===opposite.y&&w.target===key);
  return warp?{key,index:warp.warp}:null;
}
export function shiftNativeEvents(map,events){
  const offset=map.rom?.cropOffset||{x:0,y:0};let changed=false;
  for(const [type,records]of Object.entries(events))for(const record of records){const off=type==='npcs'?4:0,v=new DataView(record.buffer,record.byteOffset,record.byteLength);if(offset.x||offset.y){v.setInt16(off,v.getInt16(off,true)-offset.x,true);v.setInt16(off+2,v.getInt16(off+2,true)-offset.y,true);changed=true;}}
  for(const n of map.markers){if(!n.rom)continue;const type={npc:'npcs',sign:'signs',warp:'warps',trigger:'triggers'}[typeof n.rom.type==='number'?'sign':n.rom.type];if(!type)continue;const record=events[type]?.[n.rom.index];if(!record)throw Error('A source event is missing. Reimport this map.');const off=type==='npcs'?4:0,v=new DataView(record.buffer,record.byteOffset,record.byteLength);if(v.getInt16(off,true)!==n.x||v.getInt16(off+2,true)!==n.y){v.setInt16(off,n.x,true);v.setInt16(off+2,n.y,true);changed=true;}}
  return changed;
}
export function adjustNativeConnections(output,reader,entries){
  const edited=new Map([...entries].filter(e=>!e.isNew&&(e.map.width!==e.native.layout.width||e.map.height!==e.native.layout.height||e.map.rom.cropOffset?.x||e.map.rom.cropOffset?.y)).map(e=>[e.native.key,e]));let count=0;if(!edited.size)return 0;
  const offset=e=>e?.map.rom.cropOffset||{x:0,y:0},dims=(key,native)=>{const e=edited.get(key);return e?{width:e.map.width,height:e.map.height}:native?.layout;};
  for(const native of reader.maps){
    const connections=reader.connections(native);if(!connections.length)continue;const a=edited.get(native.key),originA=offset(a);let changed=false;
    const data=new Uint8Array(connections.length*12),v=new DataView(data.buffer);
    for(let i=0;i<connections.length;i++){
      const c=connections[i],target=reader.byKey(c.target),b=edited.get(c.target),originB=offset(b);let next=c.offset;
      if(a||b){
        if(c.direction>4){const da=dims(native.key,native),db=dims(c.target,target);if((originA.x!==originB.x||originA.y!==originB.y||da?.width!==db?.width||da?.height!==db?.height)&&(originA.x||originA.y||originB.x||originB.y||a&&a.map.width!==native.layout.width||a&&a.map.height!==native.layout.height||b&&b.map.width!==target?.layout.width||b&&b.map.height!==target?.layout.height))throw Error('Crop '+native.label+' and '+(target?.label||c.target)+' to matching bounds before exporting their dive / emerge connection.');}
        else{const axis=c.direction<=2?'x':'y';next=c.offset-originA[axis]+originB[axis];const da=dims(native.key,native),db=dims(c.target,target),length=axis==='x'?'width':'height';if(da&&db&&Math.min(da[length],next+db[length])-Math.max(0,next)<=0)throw Error('The crop removes the overlap between '+native.label+' and '+(target?.label||c.target)+'. Keep some of their connected edges aligned.');}
      }
      const at=i*12;v.setUint32(at,c.direction,true);v.setInt32(at+4,next,true);v.setUint8(at+8,c.bank);v.setUint8(at+9,c.map);if(next!==c.offset)changed=true;
    }
    if(changed){const records=output.allocate(data,'Shifted map edge connections'),header=new Uint8Array(8),view=new DataView(header.buffer);view.setUint32(0,connections.length,true);view.setUint32(4,0x08000000+records,true);output.int(native.address+12,0x08000000+output.allocate(header,'Map connections header'));count++;}
  }
  return count;
}
