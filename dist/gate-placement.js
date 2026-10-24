import {gateBounds} from './gate-cells.js';
export function gateAt(map,x,y){return [...(map.gates||[])].reverse().find(g=>{const b=gateBounds(g);return x>=b.x&&y>=b.y&&x<b.x+b.w&&y<b.y+b.h;});}
export function checkGatePosition(map,gate,x=gate.x,y=gate.y){
 const b=gateBounds({...gate,x,y});if(!Number.isInteger(x)||!Number.isInteger(y)||b.x<0||b.y<0||b.x+b.w>map.width||b.y+b.h>map.height)throw Error('The complete gate must fit inside the map.');
 if((map.gates||[]).some(g=>{if(g.id===gate.id)return false;const a=gateBounds(g);return b.x<a.x+a.w&&b.x+b.w>a.x&&b.y<a.y+a.h&&b.y+b.h>a.y;}))throw Error('Move the gate away from the other gate.');
}
export function clearGateWalls(map,gate){
 gate.replacedWalls=[];if(gate.replaceWalls===false||!map.wallCells)return;const b=gateBounds(gate);
 for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const i=(b.y+y)*map.width+b.x+x,cell=map.wallCells[i];if(cell)gate.replacedWalls.push({x,y,cell:structuredClone(cell)});map.wallCells[i]=null;}
}
export function restoreGateWalls(map,gate){if(!map.wallCells)return;const b=gateBounds(gate);for(const saved of gate.replacedWalls||[]){const x=b.x+saved.x,y=b.y+saved.y;if(x>=0&&y>=0&&x<map.width&&y<map.height){const i=y*map.width+x;if(!map.wallCells[i])map.wallCells[i]=structuredClone(saved.cell);}}}
export function moveGate(map,gate,x,y){checkGatePosition(map,gate,x,y);if(x===gate.x&&y===gate.y)return;restoreGateWalls(map,gate);gate.x=x;gate.y=y;clearGateWalls(map,gate);}
export function removeGate(map,gate){restoreGateWalls(map,gate);map.gates=(map.gates||[]).filter(g=>g.id!==gate.id);}
