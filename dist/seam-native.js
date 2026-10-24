import{EDGES,seamGeometry}from'./map-seams.js';
const BASE=0x08000000;
export function installSeams(output,reader,project,byId){
 const changed=new Map(),entries=[...byId.values()],byKey=new Map(entries.map(e=>[e.native.key,e]));
 const records=e=>{if(!changed.has(e.native.key))changed.set(e.native.key,{entry:e,list:reader.connections(e.native).filter((c,i)=>!e.map.rom?.disabledConnections?.includes(i)).map(c=>{const axis=c.direction<=2?'x':'y',a=e.map.rom?.cropOffset?.[axis]||0,b=byKey.get(c.target)?.map.rom?.cropOffset?.[axis]||0;return{...c,offset:c.direction<=4?c.offset-a+b:c.offset};})});return changed.get(e.native.key).list;};
 for(const e of entries)if(e.map.rom?.disabledConnections?.length)records(e);
 for(const l of project.links.filter(l=>l.seam)){
  const a=byId.get(l.from.mapId),b=byId.get(l.to.mapId);if(!a||!b)throw Error('Include both continuous-edge maps in the opened ROM export.');
  const{direction,offset}=l.seam;seamGeometry(a.map,b.map,direction,offset);
  if(reader.pairKey(a.base)!==reader.pairKey(b.base))throw Error(a.map.name+' and '+b.map.name+': continuous edges need matching native tilesets. Choose a matching ROM template or use a portal.');
  const add=(a,b,d,off)=>{const list=records(a),code=EDGES[d].code;if(list.some(c=>c.direction===code))throw Error(a.map.name+': the '+d+' edge already has a native connection. Import and edit that edge first.');list.push({direction:code,offset:off,bank:b.native.bank,map:b.native.index});};
  add(a,b,direction,offset);if(l.twoWay)add(b,a,EDGES[direction].opposite,-offset);
 }
 for(const{entry:e,list}of changed.values()){
  if(list.length>30)throw Error(e.map.name+': too many native connections.');
  if(!list.length){output.int(e.native.address+12,0);continue;}
  const data=new Uint8Array(list.length*12),v=new DataView(data.buffer);list.forEach((c,i)=>{v.setUint32(i*12,c.direction,true);v.setInt32(i*12+4,c.offset,true);data[i*12+8]=c.bank;data[i*12+9]=c.map;});
  const header=new Uint8Array(8),hv=new DataView(header.buffer);hv.setUint32(0,list.length,true);hv.setUint32(4,BASE+output.allocate(data,'Continuous map edges'),true);output.int(e.native.address+12,BASE+output.allocate(header,'Continuous map connections'));
 }return changed.size;
}
