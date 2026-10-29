import{indexNativeStory,reachableStory}from'./native-story.js';
import{shatteredAdapter}from'./shattered-adapter.js';
import{SHATTERED_GATE_REPAIR as GATES}from'./shattered-gates-data.js';
import{SOUTH_GATE_ART}from'./shattered-south-gate-data.js';
const hex=b=>Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
export function gateScriptBytes(args){const out=new Uint8Array(9),v=new DataView(out.buffer);out[0]=0xa2;args.forEach((n,i)=>v.setUint16(1+i*2,n,true));return out;}
export function gatePackMatches(profile,pack){const name=pack?.scriptTileProfile;return !!(name&&(name===profile.id||name===profile.artworkProfile)&&profile.bindings.every(b=>pack.reservedIds?.includes(b.args[2]&1023)));}
function southGateBindings(reader){
 const out=[];for(let row=0;row<2;row++)for(let x=0;x<3;x++){
  const at=0x10d7907+(row*3+x)*9,raw=reader.bytes.slice(at,at+9),zero=raw.every(v=>v===0),tile=SOUTH_GATE_ART.ids[row*3+x];
  if(zero){if(row)return null;out.push({at,original:hex(raw),args:[22+x,34,tile,0]});continue;}
  if(raw.length!==9||raw[0]!==0xa2||reader.u16(at+1)!==22+x||reader.u16(at+3)!==34+row)return null;
  const old=reader.u16(at+5),collision=reader.u16(at+7),id=old&1023;if(![tile,(row?427:405)+x,(row?51:24)+x].includes(id)||collision>1)return null;
  out.push({at,original:hex(raw),args:[22+x,34+row,(old&~1023)|tile,collision]});
 }return out;
}
export function shatteredGateRepair(reader){
 if(!shatteredAdapter(reader))return null;
 const bindings=[];let closedOpening=false;
 for(const b of GATES.bindings){const raw=hex(reader.bytes.slice(b.at,b.at+9));if(raw===b.original){bindings.push(b);continue;}
  // The repaired first encounter keeps the west gate shut until Powell arrives.
  // Accept only this exact, guarded script variant; all other snapshots remain strict.
  if(b.at===0x10ba9c7&&raw===hex(gateScriptBytes([1,18,1272,1]))){bindings.push({...b,original:raw,args:[1,18,1272,1]});closedOpening=true;continue;}
  return null;
 }
 const south=southGateBindings(reader),id=closedOpening?'shattered-all-three-gates-v4':'shattered-all-three-gates-v3';
 return south?{...GATES,id,artworkProfile:closedOpening?'shattered-all-three-gates-v3':undefined,tiles:{...GATES.tiles,...SOUTH_GATE_ART.tiles},bindings:[...bindings,...south],gates:['west','north','south']}:{...GATES,bindings};
}
export function legacyGateTile(reader,native,id){const p=native.key===GATES.mapKey&&shatteredGateRepair(reader),t=p&&p.tiles[id];if(!t)return null;return{planes:t.planes.map(s=>Uint8ClampedArray.from(atob(s),c=>c.charCodeAt(0))),attr:t.attr};}
export async function scriptTileReferences(reader,mapKeys=null){const g=await indexNativeStory(reader,{mapKeys}),byMap=new Map();for(const root of g.roots){const rows=byMap.get(root.mapKey)||new Map();byMap.set(root.mapKey,rows);for(const at of reachableStory(g,root.address)){const n=g.nodes[at];if(n.name==='setmetatile'){const id=n.args[2].value;if(id>=0x4000)throw Error(root.mapName+': a script chooses a metatile dynamically; palette repacking needs an adapter for its possible values.');rows.set(at,{...n,id:id&1023});}}}return byMap;}
