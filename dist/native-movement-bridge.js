import {SCRIPT_DATA} from './script-data.js';

// Only bytecodes the visual script compiler can reproduce exactly. A ROM may
// use dozens of custom/extended movement commands; never guess their effects.
const SIMPLE=/^(?:face_(?:up|down|left|right)|walk_(?:(?:slower|slow|fast|faster)_)?(?:up|down|left|right)|set_(?:visible|invisible))$/;
const byCode=new Map(Object.entries(SCRIPT_DATA.movements||{}).map(([name,code])=>[code,name]));
const byName=new Map(Object.entries(SCRIPT_DATA.movements||{}));
export function nativeMovementIssues(moves){
 const issues=[];
 if(!Array.isArray(moves)||moves.length<1||moves.length>128)return['Use 1–128 native movement instructions.'];
 for(const [i,name]of moves.entries()){
  if(typeof name!=='string'||!SIMPLE.test(name)||!byName.has(name))issues.push('Movement '+(i+1)+' is not a verified walk, face or visibility command.');
 }
 return issues;
}
export function decodeNativeMovement(bytes){
 if(!Array.isArray(bytes)||bytes.length<2||bytes.length>129||bytes.at(-1)!==254||bytes.slice(0,-1).includes(254))throw Error('Movement byte stream is missing its unique terminator or exceeds 128 commands.');
 const names=bytes.slice(0,-1).map(code=>byCode.get(code)||null);
 const issues=nativeMovementIssues(names);
 if(issues.length)throw Error(issues[0]);
 return names;
}
export function nativeMovementDisplay(moves){return Array.isArray(moves)?moves.map(name=>name.replaceAll('_',' ')).join(' · '):'Unrecognised native movement';}
