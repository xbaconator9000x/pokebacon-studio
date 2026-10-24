import {createMovementQuery} from './world-model.js';
export function checkGenerationAccess(map,points){
 const rule=createMovementQuery(map),walk=(x,y)=>{if(x<0||y<0||x>=map.width||y>=map.height)return false;const r=rule(x,y);return !r.collision&&r.mode!=='water'&&r.elevation===3;},first=points[0],seen=new Set();if(!first)return{reachable:0,checked:0};if(!walk(first.x,first.y))throw Error(map.name+': '+first.label+' is blocked.');
 const todo=[first.y*map.width+first.x];seen.add(todo[0]);while(todo.length){const i=todo.pop(),x=i%map.width,y=Math.floor(i/map.width);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*map.width+xx;if(!seen.has(j)&&walk(xx,yy)){seen.add(j);todo.push(j);}}}
 for(const p of points)if(!walk(p.x,p.y)||!seen.has(p.y*map.width+p.x))throw Error(map.name+': '+p.label+' cannot be reached on foot.');return{reachable:seen.size,checked:points.length};
}
