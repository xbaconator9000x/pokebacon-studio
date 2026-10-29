import{regionClimate}from'./region-climate.js';
import {landscapeHeight} from './landscape-field.js';
import {randomFor} from './town-plan.js';
export const REGION_CELL=64;
export const REGION_BIOMES=['meadow','forest','mountain','underground','snow','desert','coastal'];
export const REGION_THEMES=[['woodland','Woodland'],['countryside','Countryside'],['mixed','Mixed countryside'],['mountain','Highlands'],['underground','Caverns'],['snow','Snow country'],['desert','Desert'],['coastal','Coastal region'],['continent','Climate · varied region']];
const dirs=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]],key=(x,y)=>x+','+y;
export const oppositeEdge=e=>({north:'south',south:'north',east:'west',west:'east'})[e];
export function planRegion({seed=1,cells=9,settlements=3,loops=25,theme='mixed',settlementSize='village',temperature=50,rainfall=50}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Use a seed from 0 to 4294967295.');
 if(!Number.isInteger(cells)||cells<6||cells>20)throw Error('Choose 6–20 outdoor maps.');
 if(!Number.isInteger(settlements)||settlements<2||settlements>6||settlements>cells-2)throw Error('Keep 2–6 settlements and at least two route maps.');
 if(!Number.isInteger(loops)||loops<0||loops>100||!REGION_THEMES.some(t=>t[0]===theme)||!['village','town'].includes(settlementSize))throw Error('Choose an included theme, settlement size and 0–100% extra routes.');
 const random=randomFor(seed),nodes=[{id:0,x:0,y:0}],by=new Map([[key(0,0),0]]),edges=[];
 // Finite frontier growth gives a connected backbone without unbounded retries.
 for(let i=1;i<cells;i++){const frontier=[];for(const n of nodes)for(const[direction,dx,dy]of dirs){const x=n.x+dx,y=n.y+dy;if(!by.has(key(x,y))&&Math.abs(x)<=3&&Math.abs(y)<=3)frontier.push({from:n.id,x,y,direction});}const f=frontier[Math.floor(random()*frontier.length)];if(!f)throw Error('Region bounds are full.');nodes.push({id:i,x:f.x,y:f.y});by.set(key(f.x,f.y),i);edges.push({from:f.from,to:i,direction:f.direction,backbone:true});}
 for(const n of nodes)for(const[direction,dx,dy]of dirs){const id=by.get(key(n.x+dx,n.y+dy));if(id!==undefined&&id>n.id&&!edges.some(e=>e.from===n.id&&e.to===id||e.to===n.id&&e.from===id)&&random()*100<loops)edges.push({from:n.id,to:id,direction,backbone:false});}
 const chosen=[nodes[Math.floor(random()*nodes.length)]];while(chosen.length<settlements){const pool=nodes.filter(n=>!chosen.includes(n)).map(n=>({n,score:Math.min(...chosen.map(c=>Math.abs(n.x-c.x)+Math.abs(n.y-c.y)))+random()*.8})).sort((a,b)=>b.score-a.score);chosen.push(pool[0].n);}
 const minX=Math.min(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y)),ranked=[...nodes].sort((a,b)=>landscapeHeight(seed,a.x*64+32,a.y*64+32)-landscapeHeight(seed,b.x*64+32,b.y*64+32)||a.id-b.id),forest=new Set(ranked.slice(Math.floor(nodes.length/2)).map(n=>n.id));let town=0,route=0;for(const n of nodes){n.x-=minX;n.y-=minY;n.kind=chosen.includes(n)?'settlement':'route';n.biome=theme==='woodland'?'forest':theme==='countryside'?'meadow':!['mixed','continent'].includes(theme)?theme:forest.has(n.id)?'forest':'meadow';n.seed=Math.floor(random()*0x100000000);n.name=n.kind==='settlement'?'Settlement '+(++town):'Route '+(++route);}
 const plan={version:1,seed,cells,settlements,loops,theme,settlementSize,nodes,edges,width:Math.max(...nodes.map(n=>n.x))+1,height:Math.max(...nodes.map(n=>n.y))+1};plan.startNodeId=chosen[0].id;regionClimate(plan,{temperature,rainfall});syncRegionExits(plan);return plan;
}
export function syncRegionExits(plan){for(const n of plan.nodes)n.exits=[];for(const e of plan.edges){plan.nodes.find(n=>n.id===e.from).exits.push({edge:e.direction,position:50});plan.nodes.find(n=>n.id===e.to).exits.push({edge:oppositeEdge(e.direction),position:50});}}
export function validateRegionPlan(p){
 if(!p||!Array.isArray(p.nodes)||!Array.isArray(p.edges)||p.nodes.length<6||p.nodes.length>20||p.edges.length>40||!['village','town'].includes(p.settlementSize))throw Error('The region plan is invalid.');
 const ids=new Set(),positions=new Set();for(const n of p.nodes){if(!Number.isInteger(n.id)||ids.has(n.id)||![n.x,n.y].every(v=>Number.isInteger(v)&&v>=0&&v<7)||positions.has(key(n.x,n.y))||!['route','settlement'].includes(n.kind)||!REGION_BIOMES.includes(n.biome)||typeof n.name!=='string'||n.name.length>60||!Number.isInteger(n.seed)||n.seed<0||n.seed>0xffffffff)throw Error('A region location is invalid.');ids.add(n.id);positions.add(key(n.x,n.y));}
 for(const n of p.nodes)if(n.settings){const o=n.settings;if(typeof o!=='object'||o===null||Array.isArray(o)||o.houseCount!==undefined&&(!Number.isInteger(o.houseCount)||o.houseCount<0||o.houseCount>12)||o.facilities!==undefined&&(!Array.isArray(o.facilities)||o.facilities.some(k=>!['centre','mart','gym','game-corner','department-store','cave'].includes(k))||new Set(o.facilities).size!==o.facilities.length)||o.houseIds!==undefined&&(!Array.isArray(o.houseIds)||o.houseIds.length>100||o.houseIds.some(id=>typeof id!=='string'||id.length>160))||o.interiors!==undefined&&typeof o.interiors!=='boolean'||o.features&&Object.entries(o.features).some(([k,v])=>!['water','scenery','rocks','ledges','grass','sidePaths','encounters','landmarks','weather','music','population','milestones','items','trainers','puddles'].includes(k)||typeof v!=='boolean'))throw Error('An area has invalid house, facility or feature settings.');}
 if(p.startNodeId!==undefined&&!p.nodes.some(n=>n.id===p.startNodeId&&n.kind==='settlement'))throw Error('The starting location must be a settlement.');
 for(const n of p.nodes){for(const key of ['speciesPool','waterSpeciesPool','itemPool','trainerIds']){const pool=n.settings?.[key];if(pool!==undefined&&(!Array.isArray(pool)||(!pool.length&&key!=='trainerIds')||pool.length>64||pool.some(id=>!Number.isInteger(id)||id<1||id>8191)))throw Error('Use valid species/item/trainer record IDs (up to 64 per pool).');}if(n.settings?.levels&&(!Number.isInteger(n.settings.levels.min)||!Number.isInteger(n.settings.levels.max)||n.settings.levels.min<1||n.settings.levels.max>100||n.settings.levels.min>n.settings.levels.max))throw Error('Use an area level range between 1 and 100.');if(n.settings?.trainerTeamMode!==undefined&&!['keep','scale','generate'].includes(n.settings.trainerTeamMode))throw Error('Choose an included trainer team mode.');if(n.settings?.landmark!==undefined&&!['auto','rest','lookout','grove','echo','beacon','none'].includes(n.settings.landmark))throw Error('Choose an included route landmark.');}
 const settlements=p.nodes.filter(n=>n.kind==='settlement').length;if(settlements<2||settlements>6||settlements>p.nodes.length-2)throw Error('Keep 2–6 settlements and at least two route maps.');
 const used=new Set(),adj=new Map(p.nodes.map(n=>[n.id,[]]));for(const e of p.edges){const a=p.nodes.find(n=>n.id===e.from),b=p.nodes.find(n=>n.id===e.to),d=dirs.find(d=>d[0]===e.direction);if(!a||!b||!d||b.x!==a.x+d[1]||b.y!==a.y+d[2])throw Error('Routes must join neighbouring locations.');for(const k of [a.id+':'+e.direction,b.id+':'+oppositeEdge(e.direction)]){if(used.has(k))throw Error('Two routes use the same edge.');used.add(k);}adj.get(a.id).push(b.id);adj.get(b.id).push(a.id);}
 const seen=new Set(),todo=[p.nodes[0].id];while(todo.length){const id=todo.pop();if(seen.has(id))continue;seen.add(id);todo.push(...adj.get(id));}if(seen.size!==p.nodes.length)throw Error('That change would leave an unreachable location.');
 for(const n of p.nodes){const expected=[...used].filter(k=>k.startsWith(n.id+':')).map(k=>k.split(':')[1]);if(!Array.isArray(n.exits)||n.exits.length!==expected.length||n.exits.some(e=>e.position!==50||!expected.includes(e.edge))||new Set(n.exits.map(e=>e.edge)).size!==expected.length)throw Error('Exits do not match the region routes.');}return p;
}

// Reconnect only physically adjacent chunks. Never invent a long scrolling seam.
export function moveRegionLocation(source,id,x,y,{snap=true}={}){
 validateRegionPlan(source);if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Choose a position inside the layout.');
 const original=source.nodes.find(n=>n.id===id);if(!original)throw Error('Choose a region location.');
 const candidates=[];for(let yy=0;yy<7;yy++)for(let xx=0;xx<7;xx++)if(snap?Math.hypot(xx-x,yy-y)<=1.5:xx===Math.round(x)&&yy===Math.round(y))candidates.push({x:xx,y:yy,d:Math.hypot(xx-x,yy-y)});candidates.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
 for(const target of candidates){
  if(target.x===original.x&&target.y===original.y)continue;
  const p=structuredClone(source),moving=p.nodes.find(n=>n.id===id),occupied=p.nodes.find(n=>n.x===target.x&&n.y===target.y);if(occupied){occupied.x=moving.x;occupied.y=moving.y;}moving.x=target.x;moving.y=target.y;
  const by=new Map(p.nodes.map(n=>[n.id,n])),parent=new Map(p.nodes.map(n=>[n.id,n.id])),find=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;},join=(a,b)=>{a=find(a);b=find(b);if(a===b)return false;parent.set(a,b);return true;},direction=(a,b)=>b.x>a.x?'east':b.x<a.x?'west':b.y>a.y?'south':'north';
  p.edges=source.edges.filter(e=>{const a=by.get(e.from),b=by.get(e.to);return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;}).map(e=>{join(e.from,e.to);return{...e,direction:direction(by.get(e.from),by.get(e.to))};});
  for(const a of p.nodes)for(const b of p.nodes)if(a.id<b.id&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1&&join(a.id,b.id))p.edges.push({from:a.id,to:b.id,direction:direction(a,b),backbone:true});
  if(new Set(p.nodes.map(n=>find(n.id))).size!==1)continue;
  p.width=Math.max(...p.nodes.map(n=>n.x))+1;p.height=Math.max(...p.nodes.map(n=>n.y))+1;syncRegionExits(p);validateRegionPlan(p);return{plan:p,swapped:occupied?.id??null,snapped:target.x!==Math.round(x)||target.y!==Math.round(y)};
 }
 throw Error('No connected position near that drop. Try beside another location, or swap two locations.');
}

export function regionGeometry(source,sizing='varied'){
 if(!['uniform','varied'].includes(sizing))throw Error('Choose varied or uniform map dimensions.');const p=structuredClone(source),maxX=Math.max(...p.nodes.map(n=>n.x)),maxY=Math.max(...p.nodes.map(n=>n.y)),columns=Array.from({length:maxX+1},(_,x)=>sizing==='uniform'||p.nodes.some(n=>n.x===x&&n.kind==='settlement')?64:48),rows=Array.from({length:maxY+1},(_,y)=>sizing==='uniform'||p.nodes.some(n=>n.y===y&&n.kind==='settlement')?64:40);
 for(const n of p.nodes){n.width=columns[n.x];n.height=rows[n.y];n.worldX=columns.slice(0,n.x).reduce((a,b)=>a+b,0);n.worldY=rows.slice(0,n.y).reduce((a,b)=>a+b,0);}p.geometry={columns,rows,width:columns.reduce((a,b)=>a+b,0),height:rows.reduce((a,b)=>a+b,0),sizing};return p;
}
