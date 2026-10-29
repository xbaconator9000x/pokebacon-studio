import {SCRIPT_DATA} from './script-data.js';
const BASE=0x08000000;
const terminals=new Set([2,3,5,8,12,13,94,95]);
const fail=message=>{throw Error(message);};
const number=(v,w)=>Number.isSafeInteger(v)&&v>=0&&v<2**(w*8);
export const flowId=at=>'s'+at;
export function flowCommands(engine){return (SCRIPT_DATA[engine]||[]).filter(c=>![12,13,17,18,19,21,29,30,31,32,35,36,120,134,135,136,184,185,186,187,188,189,190,191,200,211].includes(c.code)&&c.params.every(p=>p.width!==4||[4,5,6,7,79,80,103,133,144,145,146,155].includes(c.code)||c.code===92)).map(c=>c.code===92?{...c,name:'trainerbattle',params:[...c.params,{name:'Challenge dialogue',width:4,kind:'text'},{name:'Defeat dialogue',width:4,kind:'text'}]}:c);}
export function flowParams(engine,row){if(row.sourceAt===undefined&&row.code===92)return flowCommands(engine).find(c=>c.code===92).params;return SCRIPT_DATA[engine].find(c=>c.code===row.code)?.params;}
export function createStoryFlow(graph,root){
 const nodes={},queue=[root.address],seen=new Set();
 while(queue.length){const at=queue.shift();if(seen.has(at))continue;seen.add(at);if(seen.size>12000)fail('This event exceeds the 12,000-step structure-editing limit.');const n=graph.nodes[at];if(!n)fail('An event branch has no decoded command.');
  const args=n.args?.map((a,i)=>graph.edits.commands?.[at]?.args[i]??a.value)||[],next=n.edges?.find(e=>e.kind==='next'||e.kind==='otherwise')?.to;
  const row={id:flowId(at),sourceAt:at,original:n.original??null,code:n.code??null,args,next:next===undefined?null:flowId(next),targets:{},data:{}};
  for(const [i,a] of (n.args||[]).entries())if(a.kind==='script'){const to=args[i]-BASE;if(!graph.nodes[to])fail('A branch target is unresolved.');row.targets[i]=flowId(to);queue.push(to);}
  if(next!==undefined)queue.push(next);nodes[row.id]=row;
 }
 return {version:1,rootId:root.id,reference:root.reference,address:root.address,entry:flowId(root.address),serial:0,baseline:Object.fromEntries(Object.values(nodes).map(n=>[n.id,n.original])),nodes};
}
export function flowOrder(flow){const seen=new Set(),out=[],queue=[flow.entry];while(queue.length){let id=queue.shift();while(id&&!seen.has(id)){seen.add(id);const n=flow.nodes[id];if(!n)break;out.push(n);queue.push(...Object.values(n.targets));id=n.next;}}return out;}
export function flowIncoming(flow,id){return Object.values(flow.nodes).flatMap(n=>[...(n.next===id?[{node:n,kind:'next'}]:[]),...Object.entries(n.targets).filter(([,to])=>to===id).map(([field])=>({node:n,kind:field}))]);}
function redirect(flow,old,to){if(flow.entry===old)flow.entry=to;for(const n of Object.values(flow.nodes)){if(n.next===old)n.next=to;for(const i of Object.keys(n.targets))if(n.targets[i]===old)n.targets[i]=to;}}
export function removeFlowStep(flow,id){const n=flow.nodes[id];if(!n||!n.next||n.next===id)fail('Choose a continuation before removing an ending or looping step.');redirect(flow,id,n.next);delete flow.nodes[id];}
export function swapFlowSteps(flow,id){const a=flow.nodes[id],b=flow.nodes[a?.next],incoming=b&&flowIncoming(flow,b.id);if(!a||!b||!b.next||Object.keys(a.targets).length||Object.keys(b.targets).length||a.sourceAt===undefined&&a.code===5||b.next===a.id||b.id===flow.entry||incoming.length!==1||incoming[0].node!==a)fail('Reordering is available within a straight sequence. Branches and shared entry points keep their links.');const next=b.next;redirect(flow,a.id,b.id);b.next=a.id;a.next=next;}
export function insertFlowStep(flow,before,command,{args=null,data={}}={}){if(!flow.nodes[before])fail('Choose an existing step.');const id='a'+(++flow.serial),row={id,code:command.code,args:args??command.params.map(()=>0),targets:{},data,next:terminals.has(command.code)?null:before};for(const [i,p] of command.params.entries())if(p.width===4&&[4,5,6,7].includes(command.code))row.targets[i]=before;redirect(flow,before,id);flow.nodes[id]=row;return row;}
export function validateStoryFlow(flow,graph,root){
 if(!flow||flow.version!==1||flow.rootId!==root.id||flow.reference!==root.reference||flow.address!==root.address||typeof flow.entry!=='string'||!flow.nodes||Array.isArray(flow.nodes)||!Number.isSafeInteger(flow.serial)||flow.serial<0||flow.serial>1000000||Object.keys(flow.nodes).length>14000)fail('Invalid event structure draft.');
 const originals=createStoryFlow(graph,root);if(!flow.baseline||Object.keys(flow.baseline).length!==Object.keys(originals.baseline).length||Object.entries(flow.baseline).some(([id,value])=>originals.baseline[id]!==value))fail('The source event structure changed. Keep its original ROM or rebuild this draft.');const defs=new Map((SCRIPT_DATA[graph.engine]||[]).map(c=>[c.code,c])),allowed=new Set(flowCommands(graph.engine).map(c=>c.code));
 for(const [id,n]of Object.entries(flow.nodes)){
  if(n.id!==id||!/^([sa]\d+)$/.test(id)||!Array.isArray(n.args)||!n.targets||!n.data||Array.isArray(n.targets)||Array.isArray(n.data))fail('Invalid event step.');
  if(n.sourceAt!==undefined){const source=originals.nodes[id],raw=graph.nodes[n.sourceAt];if(!source||source.sourceAt!==n.sourceAt||source.original!==n.original||(raw.code??null)!==n.code)fail('An original event step changed. Reopen its original ROM.');if(raw.opaque){if(n.next!==null||Object.keys(n.targets).length||n.args.length)fail('Unresolved commands must remain unchanged.');continue;}}
  else if(!allowed.has(n.code))fail('This command needs an engine adapter before it can be added.');
  if(n.sourceAt!==undefined&&n.code===92&&n.args[0]!==graph.nodes[n.sourceAt].args[0].value)fail('Keep the original trainer battle variant. Add a new battle to change its format.');const def=defs.get(n.code),params=n.sourceAt===undefined?flowParams(graph.engine,n):graph.nodes[n.sourceAt].args;if(!params||n.args.length!==params.length||n.args.some((v,i)=>!number(v,params[i].width)))fail('A command value does not fit its field.');
  const branches=params.map((p,i)=>p.width===4&&([4,5,6,7].includes(n.code)||n.sourceAt!==undefined&&p.kind==='script')?String(i):null).filter(x=>x!==null);
  if(branches.some(i=>typeof n.targets[i]!=='string')||Object.keys(n.targets).some(i=>!branches.includes(i)))fail('A branch destination is missing or invalid.');
  for(const to of Object.values(n.targets))if(!flow.nodes[to])fail('A branch points to a removed step.');
  if(terminals.has(n.code)){if(n.next!==null)fail('Ending commands cannot have a Continue link.');}else if(typeof n.next!=='string'||!flow.nodes[n.next])fail('Choose a continuation for this command.');
  for(const [key,d]of Object.entries(n.data)){const i=Number(key),p=params[i],sourceKind=p?.kind,kind=sourceKind??([79,80].includes(n.code)?'movement':[103,133,155].includes(n.code)?'text':null);if(!p||p.width!==4||d.kind!==kind)fail('Invalid linked event data.');if(d.kind==='text'){if(typeof d.text!=='string'||d.text.length>8000)fail('Dialogue is too long.');}else if(d.kind==='movement'){if(!Array.isArray(d.bytes)||d.bytes.length<1||d.bytes.length>512||d.bytes.at(-1)!==254||d.bytes.slice(0,-1).some(b=>!number(b,1)||b===254))fail('Movement needs a terminated action list.');}else fail('Unsupported event data.');}
  if(n.sourceAt===undefined&&n.code===92&&n.args[0]!==0)fail('New trainer battles use the normal battle template. Existing battle variants keep their original format.');if(n.sourceAt===undefined)for(let i=0;i<params.length;i++)if(params[i].width===4&&([79,80,103,133,155].includes(n.code)||params[i].kind==='text')&&!n.data[i])fail('Add the linked dialogue or movement.');
  if(n.sourceAt!==undefined)for(let i=0;i<params.length;i++)if(['native','text','movement'].includes(params[i].kind)&&n.args[i]!==graph.nodes[n.sourceAt].args[i].value)fail('Use linked data editing instead of changing its pointer.');
 }
 if(!flow.nodes[flow.entry])fail('This event has no entry step.');return flowOrder(flow);
}
export function assertStoryFlowBindings(saved,fresh){for(const [id,flow]of Object.entries(saved.edits.flows||{})){const root=fresh.roots.find(r=>r.id===id);if(!root)fail('An edited event entry changed in the source ROM.');validateStoryFlow(flow,{...fresh,edits:saved.edits},root);}}
export function previewStoryFlow(graph,root,flow){
 const order=validateStoryFlow(flow,graph,root),at=new Map(order.map((n,i)=>[n.id,graph.sourceSize+i*32])),view={...graph,nodes:{},texts:{...graph.texts},movements:{...graph.movements},edits:{...graph.edits,commands:{...graph.edits.commands},texts:{...graph.edits.texts},movements:{...graph.edits.movements}}};let dataAt=graph.sourceSize+order.length*32+32;
 for(const row of order){const source=graph.nodes[row.sourceAt],def=SCRIPT_DATA[graph.engine].find(c=>c.code===row.code),n=source?structuredClone(source):{code:row.code,name:def.name,args:flowParams(graph.engine,row).map(p=>({...p,kind:p.kind??(p.width===4&&[4,5,6,7].includes(row.code)?'script':p.width===4&&[79,80].includes(row.code)?'movement':p.width===4&&[103,133,155].includes(row.code)?'text':'number')}))};n.at=at.get(row.id);n.flowStep=row.id;n.edges=[];
  for(const [i,a]of (n.args||[]).entries()){a.at=n.at+1+i*4;a.value=row.targets[i]?BASE+at.get(row.targets[i]):row.args[i];if(row.targets[i])n.edges.push({to:at.get(row.targets[i]),field:a.at,kind:[6,7].includes(n.code)?'condition '+row.args[0]:n.code===4?'call':'jump'});if(row.data[i]){const d=row.data[i],key=dataAt++;a.value=BASE+key;view[d.kind==='text'?'texts':'movements'][key]={at:key,...d,references:[]};}}
  if(row.next)n.edges.push({to:at.get(row.next),kind:n.code===6?'otherwise':'next'});view.nodes[n.at]=n;
 }
 view.roots=graph.roots.map(r=>r.id===root.id?{...r,address:at.get(flow.entry)}:r);return view;
}
// Relocate each selected event independently. Original script bytes and other
// event entries remain intact; implicit fallthrough becomes an explicit jump.
export function installStoryFlows(saved,fresh,reader,output,{encodeText,validateArgs}={}){
 const reports=[];
 for(const [id,flow]of Object.entries(saved.edits.flows||{})){
  const root=fresh.roots.find(r=>r.id===id);if(!root)fail('An edited event entry is missing.');const order=validateStoryFlow(flow,{...fresh,edits:saved.edits},root),v=new DataView(output.bytes.buffer),nativeMap=reader.byKey(root.mapKey);let ref=root.reference;
  if(['npcs','signs','triggers'].includes(root.kind)){const header=v.getUint32(nativeMap.address+4,true)-BASE;if(header!==nativeMap.events){ref=output.storyReferences?.get(root.reference);if(ref===undefined)fail('An edited native event was removed or replaced by an authored scene.');}}
  else if(v.getUint32(nativeMap.address+8,true)!==reader.u32(nativeMap.address+8))fail('This map has separate authored arrival logic. Keep one source of changes for its entry script.');
  if(new DataView(output.bytes.buffer).getUint32(ref,true)!==BASE+root.address)fail('The event entry already has another replacement.');
  const pieces=[],offsets=new Map();let length=0;
  for(const row of order){const n=row.sourceAt===undefined?null:fresh.nodes[row.sourceAt],params=n?.args??flowParams(fresh.engine,row),bytes=n?.opaque?new Uint8Array(5):n?output.bytes.slice(n.at,n.end):new Uint8Array(1+params.reduce((s,p)=>s+p.width,0));offsets.set(row.id,length);if(n?.opaque)bytes[0]=5;else bytes[0]=row.code;pieces.push({row,n,params,bytes,offset:length});length+=bytes.length+(row.next?5:0);}
  const at=output.allocate(new Uint8Array(length),'Edited native event flow'),compiled=new Uint8Array(length),cv=new DataView(compiled.buffer);
  for(const {row,n,params,bytes,offset}of pieces){const bv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(n?.opaque){bv.setUint32(1,BASE+n.at,true);}else{
    if(n&&output.bytes[n.at]!==n.code)fail('An exported engine patch replaced this event command.');const current=new DataView(output.bytes.buffer),values=n?n.args.map(a=>a.width===1?current.getUint8(a.at):a.width===2?current.getUint16(a.at,true):current.getUint32(a.at,true)):row.args;
    // Flow-local fields override the snapshot only when explicitly changed.
    const baseline=n?.args.map(a=>a.value),args=row.args.map((a,i)=>n&&a===baseline[i]?values[i]:a);validateArgs?.(n??{code:row.code},args);
    let off=1;for(const [i,p]of params.entries()){let value=args[i];if(row.targets[i]!==undefined)value=BASE+at+offsets.get(row.targets[i]);else if(row.data[i]){const d=row.data[i],data=d.kind==='text'?encodeText(d.text):Uint8Array.from(d.bytes);value=BASE+output.allocate(data,'Event '+d.kind);}else if(n&&['text','movement'].includes(p.kind))value=new DataView(output.bytes.buffer).getUint32(p.at,true);
      p.width===1?bv.setUint8(off,value):p.width===2?bv.setUint16(off,value,true):bv.setUint32(off,value,true);off+=p.width;}
   }compiled.set(bytes,offset);if(row.next){compiled[offset+bytes.length]=5;cv.setUint32(offset+bytes.length+1,BASE+at+offsets.get(row.next),true);}}
  output.write(at,compiled);output.int(ref,BASE+at+offsets.get(flow.entry));if(compiled.some((b,i)=>output.bytes[at+i]!==b))fail('Event structure readback failed.');reports.push(root.title+': '+order.length+' event steps relocated; other event entries retained.');
 }return reports;
}
