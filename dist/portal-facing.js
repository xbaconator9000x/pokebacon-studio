// FRLG distinguishes cave doors, directional exits and stair animations.
// Reuse a source tile's native entrance semantics when the art supplies them.
export function nativePortalBehavior(engine,style,artBehavior){
 if(style==='door')return 0x69;
 // Keep native entrance/animation semantics on imported artwork. A regular
 // step warp must not silently become a cave door (with forced exit motion).
 if(Number.isInteger(artBehavior)&&artBehavior>=0x60&&artBehavior<=0x6f)return artBehavior;
 return 0x67;
}
import{compileScript}from'./script-engine.js';
import{FACINGS}from'./map-seams.js';
const BASE=0x08000000,DIRECTIONS={south:1,north:2,west:3,east:4};
export function installPortalFacing(output,reader,project,byId){
 const maps=new Map();
 for(const l of project.links.filter(l=>l.runtime?.type==='portal'))for(const[end,field]of[['to','arrivalFacing'],...(l.twoWay?[['from','returnFacing']]:[])]){
  const facing=l.runtime[field]||'auto';if(!FACINGS.includes(facing))throw Error('Choose a valid portal arrival direction.');if(facing==='auto')continue;
  const e=byId.get(l[end].mapId);if(!e)throw Error('Include every facing-controlled arrival map in the ROM export.');if(!maps.has(e))maps.set(e,[]);maps.get(e).push({...l[end],facing});
 }
 for(const[e,points]of maps){
  const coordinates=new Map();for(const p of points){const key=p.x+','+p.y;if(coordinates.has(key)&&coordinates.get(key)!==p.facing)throw Error(e.map.name+': portals sharing an arrival tile must use the same facing.');coordinates.set(key,p.facing);}
  const bytes=output.bytes,view=new DataView(bytes.buffer),valid=(at,n)=>at>=0&&at+n<=bytes.length,u32=at=>valid(at,4)?view.getUint32(at,true):0,ptr=at=>{const p=u32(at)-BASE;return valid(p,1)?p:-1;};
  const entries=[],p=ptr(e.native.address+8);if(p>=0){let at=p,ended=false;for(let i=0;i<32;i++,at+=5){if(!valid(at,1))break;const type=bytes[at];if(!type){ended=true;break;}if(type>7||ptr(at+1)<0)throw Error('The arrival map script table is invalid.');entries.push({type,pointer:u32(at+1)});}if(!ended)throw Error('The arrival map script table has no terminator.');}
  const old=entries.find(x=>x.type===3),frame=entries.find(x=>x.type===2);if(entries.filter(x=>x.type===3).length>1||entries.filter(x=>x.type===2).length>1)throw Error('This map has multiple native entry/frame scripts.');
  // Map-local temporary variable; cleared before control returns to the player.
  // Existing condition tables using this slot require an explicit adapter.
  const temp=0x400e,previous=[];if(frame){let at=frame.pointer-BASE,ended=false;for(let i=0;i<128;i++,at+=8){if(!valid(at,2))break;const variable=view.getUint16(at,true);if(!variable){ended=true;break;}if(variable===temp)throw Error(e.map.name+': native frame scripts already use temporary variable 0x400E. Keep automatic facing on this map.');if(!valid(at,8)||ptr(at+4)<0)throw Error('A native map frame condition is invalid.');previous.push(bytes.slice(at,at+8));}if(!ended)throw Error('The native frame condition table has no terminator.');}
  // Type 3 is a direct transition script. Type 4 points to a condition table.
  const commands=['setvar 0x400E 0','getplayerxy 0x8000 0x8001'];points.forEach((p,i)=>commands.push('compare 0x8000 '+p.x,'if 5 goto @next'+i,'compare 0x8001 '+p.y,'if 5 goto @next'+i,'setvar 0x400E '+DIRECTIONS[p.facing],'goto @done','@next'+i+':'));commands.push('@done:',old?'goto '+old.pointer:'end');
  const source=commands.join('\n'),checked=compileScript(source,0,reader.engine),at=output.allocate(checked.bytes,'Portal arrival facing'),compiled=compileScript(source,at,reader.engine);output.write(at,compiled.bytes);
  if(old)old.pointer=BASE+at;else entries.push({type:3,pointer:BASE+at});
  const conditions=[];for(const[facing,direction]of Object.entries(DIRECTIONS)){const source='setvar 0x400E 0\napplymovement 255 @face\nwaitmovement 0\nreleaseall\nend\n@face:\nface_'+({north:'up',south:'down',west:'left',east:'right'}[facing])+'\nstep_end',checked=compileScript(source,0,reader.engine),at=output.allocate(checked.bytes,'Post-warp facing movement'),compiled=compileScript(source,at,reader.engine);output.write(at,compiled.bytes);const c=new Uint8Array(8),cv=new DataView(c.buffer);cv.setUint16(0,temp,true);cv.setUint16(2,direction,true);cv.setUint32(4,BASE+at+compiled.entryOffset,true);conditions.push(c);}
  const table=new Uint8Array((conditions.length+previous.length)*8+2);[...conditions,...previous].forEach((c,i)=>table.set(c,i*8));const framePointer=BASE+output.allocate(table,'Portal facing frame conditions');if(frame)frame.pointer=framePointer;else entries.push({type:2,pointer:framePointer});
  const data=new Uint8Array(entries.length*5+1),v=new DataView(data.buffer);entries.forEach((x,i)=>{data[i*5]=x.type;v.setUint32(i*5+1,x.pointer,true);});output.int(e.native.address+8,BASE+output.allocate(data,'Map scripts with portal facing'));
 }return maps.size;
}
