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
export function nativeStateChoices(graph,kind){
 if(!Object.hasOwn(kinds,kind))throw Error('Choose a flag or variable.');
 const ids=new Set(Object.keys(graph.symbols?.[kinds[kind]]||{}).map(Number));
 for(const node of Object.values(graph.nodes||{})){
  if(node.opaque)continue;
  for(const [i,arg]of (node.args||[]).entries()){
   const isFlag=i===0&&['checkflag','setflag','clearflag'].includes(node.name);
   const isVariable=/var/i.test(arg.name||'')&&arg.width===2;
   if(kind==='flag'?isFlag:isVariable){const id=graph.edits?.commands?.[node.at]?.args[i]??arg.value;if(validId(id))ids.add(id);}
  }
 }
 return [...ids].sort((a,b)=>a-b).map(id=>({id,label:storyStateLabel(graph,kind,id)}));
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
