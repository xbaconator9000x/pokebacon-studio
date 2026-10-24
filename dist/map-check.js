import{inspectNativeJoins}from'./tile-grammar.js';
import{assemblyFindings}from'./native-assemblies.js';import{createMovementQuery}from'./world-model.js';
export function checkMap(project,map,{grammar=null}={}){
 const findings=assemblyFindings(map).filter(f=>!f.message.endsWith('entrance: check its interior link.')||!project.links.some(l=>['from','to'].some(k=>l[k].mapId===map.id&&l[k].x===f.x&&l[k].y===f.y))),add=(severity,x,y,message)=>findings.push({severity,x,y,message});
 for(const o of map.objects)if(o.x<0||o.y<0||o.x+o.w>map.width||o.y+o.h>map.height)add('warning',Math.max(0,o.x),Math.max(0,o.y),(o.name||'Object')+' extends beyond the map edge.');
 const rule=createMovementQuery(map,{ignoreFieldObjects:true}),n=map.width*map.height,groups=new Int32Array(n).fill(-1),sizes=[];
 const walk=(x,y)=>x>=0&&y>=0&&x<map.width&&y<map.height&&!rule(x,y).collision&&rule(x,y).behavior!==16;
 // Walking connectivity is an advisory geometric check. Quests, Surf, elevation
 // changes and directional ledges require playtesting; never rewrite them here.
 for(let i=0;i<n;i++){const x=i%map.width,y=Math.floor(i/map.width);if(groups[i]>=0||!walk(x,y))continue;const id=sizes.length,todo=[i];groups[i]=id;let count=0;while(todo.length){const p=todo.pop(),xx=p%map.width,yy=Math.floor(p/map.width);count++;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=xx+dx,ny=yy+dy,j=ny*map.width+nx;if(walk(nx,ny)&&groups[j]<0){groups[j]=id;todo.push(j);}}}sizes.push(count);}
 const main=sizes.indexOf(Math.max(0,...sizes));
 for(const marker of map.markers.filter(m=>m.npc||m.rom?.type==='npc')){const{x,y}=marker;if(x<0||y<0||x>=map.width||y>=map.height)continue;if(rule(x,y).collision)add('warning',x,y,(marker.title||'NPC')+' stands on blocked terrain.');else if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>walk(x+dx,y+dy)&&groups[(y+dy)*map.width+x+dx]===main))add('warning',x,y,(marker.title||'NPC')+' may be unreachable from the main walking area.');}
 for(const l of project.links)for(const k of ['from','to']){const e=l[k];if(e.mapId!==map.id)continue;const b=rule(e.x,e.y).behavior,door=l.runtime?.type==='portal'&&b>=0x60&&b<=0x6f&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>walk(e.x+dx,e.y+dy)&&groups[(e.y+dy)*map.width+e.x+dx]===main);if(!walk(e.x,e.y)&&!door)add('warning',e.x,e.y,(l.label||'Connection')+' uses a blocked tile or needs Surf.');else if(!door&&groups[e.y*map.width+e.x]!==main)add('warning',e.x,e.y,(l.label||'Connection')+' is separated from the main walking area.');}
 return findings.concat(inspectNativeJoins(map,grammar));
}
