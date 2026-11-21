import {flowCommands,insertFlowStep} from './story-flow.js';
const hex=n=>'0x'+n.toString(16).toUpperCase();
const validId=n=>Number.isInteger(n)&&n>=0&&n<=65535;
const kinds={flag:'flags',variable:'variables'};
const operators={eq:1,ne:5,lt:0,gt:2,lte:3,gte:4};
export function validateStorySymbols(symbols){
 if(symbols===undefined)return;
 if(!symbols||Array.isArray(symbols)||typeof symbols!=='object'||Object.keys(symbols).some(k=>!['flags','variables'].includes(k)))throw Error('Invalid native state names.');
 for(const group of Object.values(symbols)){
  if(!group||Array.isArray(group)||typeof group!=='object'||Object.keys(group).length>4096)throw Error('Invalid native state names.');
  for(const [id,name]of Object.entries(group))if(!/^(0|[1-9]\d*)$/.test(id)||!validId(Number(id))||typeof name!=='string'||!name.trim()||name.length>80)throw Error('Use a native state ID and a name of up to 80 characters.');
 }
}
export function nameStoryState(graph,kind,id,name){
 if(!Object.hasOwn(kinds,kind)||!validId(id)||typeof name!=='string'||name.trim().length>80)throw Error('Choose a native state and a name of up to 80 characters.');
 validateStorySymbols(graph.symbols);const symbols=structuredClone(graph.symbols||{});symbols[kinds[kind]]??={};
 if(name.trim())symbols[kinds[kind]][id]=name.trim();else delete symbols[kinds[kind]][id];
 validateStorySymbols(symbols);graph.symbols=symbols;
}
export function storyStateLabel(graph,kind,id){return graph.symbols?.[kinds[kind]]?.[id]||((kind==='flag'?'Flag ':'Variable ')+hex(id));}
// Importer references, authored flow actions, map-entry conditions and named
// states share one collision set. A name is a reservation, not proof of usage.
function stateArgument(kind,name,width,index){
 const n=String(name||'').toLowerCase();
 if(kind==='flag')return width===2&&(/flag/.test(n)||index===0&&['checkflag','setflag','clearflag'].includes(n));
 return width===2&&(/^(var|variable|destvar|srcvar|destinationvariable|sourcevariable)/.test(n)||/variable/.test(n));
}
export function storyStateReferences(graph,kind){
 if(!Object.hasOwn(kinds,kind))throw Error('Choose a flag or variable.');
 const ids=new Set();
 const add=id=>{if(validId(id))ids.add(id);};
 for(const id of Object.keys(graph.symbols?.[kinds[kind]]||{}))add(Number(id));
 for(const id of Object.keys(graph.stateReservations?.[kinds[kind]]||{}))add(Number(id));
 const scan=(name,args,values)=>{
  if(!Array.isArray(args)||!Array.isArray(values))return;
  for(let i=0;i<args.length;i++)if(stateArgument(kind,args[i]?.name,args[i]?.width,i)&&validId(values[i]))add(values[i]);
  // The primary flag argument is unnamed in some native command profiles.
  if(kind==='flag'&&['checkflag','setflag','clearflag'].includes(name))add(values[0]);
 };
 for(const node of Object.values(graph.nodes||{})){
  if(node.opaque)continue;
  scan(node.name,node.args,(graph.edits?.commands?.[node.at]?.args)||node.args?.map(a=>a.value));
 }
 if(kind==='variable'){
  for(const root of graph.roots||[])if(root.kind==='map condition')add(root.variable);
  for(const patch of Object.values(graph.edits?.conditions||{}))add(patch.variable);
 }
 const definitions=new Map(flowCommands(graph.engine).map(command=>[command.code,command]));
 for(const flow of Object.values(graph.edits?.flows||{})){
  for(const row of Object.values(flow?.nodes||{})){
   const source=graph.nodes?.[row.sourceAt];
   const def=definitions.get(row.code);
   scan(source?.name||def?.name,source?.args||def?.params,row.args);
  }
 }
 return [...ids].sort((a,b)=>a-b);
}
export function validateStoryReservations(reservations){
 if(reservations===undefined)return;
 if(!reservations||Array.isArray(reservations)||typeof reservations!=='object'||Object.keys(reservations).some(k=>!['flags','variables'].includes(k)))throw Error('Invalid native state reservations.');
 for(const group of Object.values(reservations)){
  if(!group||Array.isArray(group)||typeof group!=='object'||Object.keys(group).length>4096)throw Error('Invalid native state reservations.');
  for(const [id,claim] of Object.entries(group)){
   if(!/^(0|[1-9]\d*)$/.test(id)||!validId(Number(id))||!claim||Array.isArray(claim)||typeof claim!=='object'||Object.keys(claim).some(k=>!['from','to','owner'].includes(k))||!validId(claim.from)||!validId(claim.to)||claim.to<claim.from||claim.to-claim.from>255||Number(id)<claim.from||Number(id)>claim.to||claim.owner!=='verified-source-range')throw Error('Invalid verified native state reservation.');
  }
 }
}
// A caller must confirm a source-verified, persistent ID range. Searching a
// script graph alone cannot establish that an ID is unused by native routines.
export function reserveStoryState(graph,kind,{from,to,name,verified=false}={}){
 if(!Object.hasOwn(kinds,kind)||!validId(from)||!validId(to)||from>to||to-from>255)throw Error('Provide a verified native state range of up to 256 IDs.');
 if(!verified)throw Error('Confirm the range is persistent and unowned in this ROM source before allocating.');
 if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('Give the new state a name of 1–80 characters.');
 validateStorySymbols(graph.symbols);
 validateStoryReservations(graph.stateReservations);
 if(!graph.mapKeys?.length||graph.notices?.some(n=>/limit reached/i.test(n.message||'')))throw Error('Import a complete event graph before allocating a state.');
 const used=new Set(storyStateReferences(graph,kind));
 let id=from;while(id<=to&&used.has(id))id++;
 if(id>to)throw Error('No unclaimed IDs remain in that verified range.');
 const symbols=structuredClone(graph.symbols||{}),reservations=structuredClone(graph.stateReservations||{});
 symbols[kinds[kind]]??={};reservations[kinds[kind]]??={};
 symbols[kinds[kind]][id]=name.trim();
 reservations[kinds[kind]][id]={from,to,owner:'verified-source-range'};
 validateStorySymbols(symbols);validateStoryReservations(reservations);
 graph.symbols=symbols;graph.stateReservations=reservations;
 return{id,label:storyStateLabel(graph,kind,id)};
}
export function nativeStateChoices(graph,kind){
 return storyStateReferences(graph,kind).map(id=>({id,label:storyStateLabel(graph,kind,id)}));
}
// Add native IR nodes, not a second script writer. Branch-local dialogue joins
// the selected continuation; inserting it must not redirect unrelated edges.
export function insertStoryCondition(flow,before,engine,{kind,id,operator='eq',value=0,whenTrue=before,whenFalse=before,trueText='',falseText=''}={}){
 if(!Object.hasOwn(kinds,kind)||!validId(id)||!validId(value)||!Object.hasOwn(operators,operator)||kind==='flag'&&!['eq','ne'].includes(operator)||!flow.nodes[before]||!flow.nodes[whenTrue]||!flow.nodes[whenFalse])throw Error('Choose a valid native state and both branch continuations.');
 if([trueText,falseText].some(t=>typeof t!=='string'||t.length>8000))throw Error('Branch dialogue must be text of up to 8,000 characters.');
 if(whenTrue===whenFalse&&!trueText.trim()&&!falseText.trim())throw Error('Give the branches different continuations or add branch dialogue.');
 const commands=flowCommands(engine),command=name=>{const c=commands.find(c=>c.name===name);if(!c)throw Error('This engine does not support '+name);return c;};
 const check=command(kind==='flag'?'checkflag':'compare_var_to_value'),jump=command('goto_if');
 for(const name of ['message','waitmessage','waitbuttonpress','closemessage'])command(name);
 const branch=insertFlowStep(flow,before,jump,{args:[kind==='flag'?(operator==='ne'?0:1):operators[operator],0]});
 const first=insertFlowStep(flow,branch.id,check,{args:kind==='flag'?[id]:[id,value]});
 const dialogue=(text,next)=>{if(!text.trim())return next;let entry=next;for(const name of ['closemessage','waitbuttonpress','waitmessage','message']){const c=command(name),stepId='a'+(++flow.serial);flow.nodes[stepId]={id:stepId,code:c.code,args:c.params.map(()=>0),targets:{},data:name==='message'?{0:{kind:'text',text}}:{},next:entry};entry=stepId;}return entry;};
 branch.targets[1]=dialogue(trueText,whenTrue);branch.next=dialogue(falseText,whenFalse);
 return{entry:first.id,branch:branch.id};
}
