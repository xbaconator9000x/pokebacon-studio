import{randomFor}from'./town-plan.js';
export const HABITAT_POOLS={meadow:[16,19,29,32,39,52],forest:[10,13,16,43,46,48,69],mountain:[27,41,66,74,95],underground:[41,50,74,95],snow:[41,86,90,124],desert:[23,27,50,74,111],coastal:[19,43,60,79,98],water:[60,72,79,90,98,116,118,120,129]};
export function regionProgression(plan,{startLevel=3,endLevel=45}={}){
 if(!Number.isInteger(startLevel)||!Number.isInteger(endLevel)||startLevel<1||endLevel>100||startLevel>endLevel)throw Error('Choose a starting and final level between 1 and 100.');
 const start=plan.nodes.find(n=>n.id===plan.startNodeId&&n.kind==='settlement')||plan.nodes.find(n=>n.kind==='settlement'),adj=new Map(plan.nodes.map(n=>[n.id,[]]));for(const e of plan.edges){adj.get(e.from).push(e.to);adj.get(e.to).push(e.from);}
 const order=[start.id],distance=new Map([[start.id,0]]);for(let i=0;i<order.length;i++)for(const id of adj.get(order[i]).sort((a,b)=>a-b))if(!distance.has(id)){distance.set(id,distance.get(order[i])+1);order.push(id);}
 if(order.length!==plan.nodes.length)throw Error('Progression contains an unreachable area.');const depth=Math.max(1,...distance.values());
 for(const n of plan.nodes){const level=Math.round(startLevel+(endLevel-startLevel)*distance.get(n.id)/depth),custom=n.settings?.levels;if(custom&&(!Number.isInteger(custom.min)||!Number.isInteger(custom.max)||custom.min<1||custom.max>100||custom.min>custom.max))throw Error(n.name+': use levels 1–100.');n.progression={order:order.indexOf(n.id)+1,distance:distance.get(n.id),minLevel:custom?.min??level,maxLevel:custom?.max??Math.min(100,level+2)};}
 return{startNodeId:start.id,startLevel,endLevel,order};
}
export function regionEncounters(node,map){
 const settings=node.settings,pool=settings?.speciesPool||HABITAT_POOLS[node.biome]||HABITAT_POOLS.meadow,water=settings?.waterSpeciesPool||HABITAT_POOLS.water,random=randomFor(node.seed^0x55e91),levels=node.progression;
 const table=(choices,count,rate)=>({rate,slots:Array.from({length:count},(_,i)=>({species:choices[i<choices.length?i:Math.floor(random()*choices.length)],minLevel:levels.minLevel,maxLevel:levels.maxLevel}))}),out={};
 if(map.movement.some(r=>r?.behavior===2)||node.biome==='underground')out.land=table(pool,12,20);
 if(map.movement.some(r=>r?.mode==='water')){out.water=table(water,5,8);out.fishing=table(water,10,30);}
 return out;
}
export function portableEncounterEdits(maps){return Object.fromEntries(maps.filter(m=>m.generatedEncounters&&Object.keys(m.generatedEncounters).length).map(m=>['map:'+m.id,m.generatedEncounters]));}

export function validateGeneratedEncounters(map){
 const tables=map.generatedEncounters;if(tables===undefined||tables===null)return;
 if(typeof tables!=='object'||Array.isArray(tables))throw Error('Generated encounters must be a table collection.');
 const counts={land:12,water:5,rock:5,fishing:10};for(const[kind,group]of Object.entries(tables)){
  if(!Object.hasOwn(counts,kind)||!group||!Number.isInteger(group.rate)||group.rate<0||group.rate>100||!Array.isArray(group.slots)||group.slots.length!==counts[kind]||group.slots.some(s=>!s||!Number.isInteger(s.species)||s.species<1||s.species>8191||!Number.isInteger(s.minLevel)||!Number.isInteger(s.maxLevel)||s.minLevel<1||s.maxLevel>100||s.minLevel>s.maxLevel))throw Error('A generated encounter table has invalid slots, species or levels.');
 }
}
