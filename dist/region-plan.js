import {randomFor} from './town-plan.js';
export const REGION_CELL=64;
export const REGION_THEMES=[['woodland','Woodland'],['countryside','Countryside'],['mixed','Mixed countryside']];
const dirs=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]],key=(x,y)=>x+','+y;
export const oppositeEdge=e=>({north:'south',south:'north',east:'west',west:'east'})[e];
export function planRegion({seed=1,cells=9,settlements=3,loops=25,theme='mixed',settlementSize='village'}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Use a seed from 0 to 4294967295.');
 if(!Number.isInteger(cells)||cells<6||cells>20)throw Error('Choose 6–20 outdoor maps.');
 if(!Number.isInteger(settlements)||settlements<2||settlements>6||settlements>cells-2)throw Error('Keep 2–6 settlements and at least two route maps.');
 if(!Number.isInteger(loops)||loops<0||loops>100||!REGION_THEMES.some(t=>t[0]===theme)||!['village','town'].includes(settlementSize))throw Error('Choose an included theme, settlement size and 0–100% extra routes.');
 const random=randomFor(seed),nodes=[{id:0,x:0,y:0}],by=new Map([[key(0,0),0]]),edges=[];
 // Finite frontier growth gives a connected backbone without unbounded retries.
 for(let i=1;i<cells;i++){const frontier=[];for(const n of nodes)for(const[direction,dx,dy]of dirs){const x=n.x+dx,y=n.y+dy;if(!by.has(key(x,y))&&Math.abs(x)<=3&&Math.abs(y)<=3)frontier.push({from:n.id,x,y,direction});}const f=frontier[Math.floor(random()*frontier.length)];if(!f)throw Error('Region bounds are full.');nodes.push({id:i,x:f.x,y:f.y});by.set(key(f.x,f.y),i);edges.push({from:f.from,to:i,direction:f.direction,backbone:true});}
 for(const n of nodes)for(const[direction,dx,dy]of dirs){const id=by.get(key(n.x+dx,n.y+dy));if(id!==undefined&&id>n.id&&!edges.some(e=>e.from===n.id&&e.to===id||e.to===n.id&&e.from===id)&&random()*100<loops)edges.push({from:n.id,to:id,direction,backbone:false});}
 const chosen=[nodes[Math.floor(random()*nodes.length)]];while(chosen.length<settlements){const pool=nodes.filter(n=>!chosen.includes(n)).map(n=>({n,score:Math.min(...chosen.map(c=>Math.abs(n.x-c.x)+Math.abs(n.y-c.y)))+random()*.8})).sort((a,b)=>b.score-a.score);chosen.push(pool[0].n);}
 const minX=Math.min(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y));let town=0,route=0;for(const n of nodes){n.x-=minX;n.y-=minY;n.kind=chosen.includes(n)?'settlement':'route';n.biome=theme==='woodland'?'forest':theme==='countryside'?'meadow':random()<.5?'forest':'meadow';n.seed=Math.floor(random()*0x100000000);n.name=n.kind==='settlement'?'Settlement '+(++town):'Route '+(++route);}
 const plan={version:1,seed,cells,settlements,loops,theme,settlementSize,nodes,edges,width:Math.max(...nodes.map(n=>n.x))+1,height:Math.max(...nodes.map(n=>n.y))+1};syncRegionExits(plan);return plan;
}
export function syncRegionExits(plan){for(const n of plan.nodes)n.exits=[];for(const e of plan.edges){plan.nodes.find(n=>n.id===e.from).exits.push({edge:e.direction,position:50});plan.nodes.find(n=>n.id===e.to).exits.push({edge:oppositeEdge(e.direction),position:50});}}
export function validateRegionPlan(p){
 if(!p||!Array.isArray(p.nodes)||!Array.isArray(p.edges)||p.nodes.length<6||p.nodes.length>20||p.edges.length>40||!['village','town'].includes(p.settlementSize))throw Error('The region plan is invalid.');
 const ids=new Set(),positions=new Set();for(const n of p.nodes){if(!Number.isInteger(n.id)||ids.has(n.id)||![n.x,n.y].every(v=>Number.isInteger(v)&&v>=0&&v<7)||positions.has(key(n.x,n.y))||!['route','settlement'].includes(n.kind)||!['meadow','forest'].includes(n.biome)||typeof n.name!=='string'||n.name.length>60||!Number.isInteger(n.seed)||n.seed<0||n.seed>0xffffffff)throw Error('A region location is invalid.');ids.add(n.id);positions.add(key(n.x,n.y));}
 const settlements=p.nodes.filter(n=>n.kind==='settlement').length;if(settlements<2||settlements>6||settlements>p.nodes.length-2)throw Error('Keep 2–6 settlements and at least two route maps.');
 const used=new Set(),adj=new Map(p.nodes.map(n=>[n.id,[]]));for(const e of p.edges){const a=p.nodes.find(n=>n.id===e.from),b=p.nodes.find(n=>n.id===e.to),d=dirs.find(d=>d[0]===e.direction);if(!a||!b||!d||b.x!==a.x+d[1]||b.y!==a.y+d[2])throw Error('Routes must join neighbouring locations.');for(const k of [a.id+':'+e.direction,b.id+':'+oppositeEdge(e.direction)]){if(used.has(k))throw Error('Two routes use the same edge.');used.add(k);}adj.get(a.id).push(b.id);adj.get(b.id).push(a.id);}
 const seen=new Set(),todo=[p.nodes[0].id];while(todo.length){const id=todo.pop();if(seen.has(id))continue;seen.add(id);todo.push(...adj.get(id));}if(seen.size!==p.nodes.length)throw Error('That change would leave an unreachable location.');
 for(const n of p.nodes){const expected=[...used].filter(k=>k.startsWith(n.id+':')).map(k=>k.split(':')[1]);if(!Array.isArray(n.exits)||n.exits.length!==expected.length||n.exits.some(e=>e.position!==50||!expected.includes(e.edge))||new Set(n.exits.map(e=>e.edge)).size!==expected.length)throw Error('Exits do not match the region routes.');}return p;
}
