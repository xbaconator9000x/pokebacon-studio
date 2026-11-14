// Deliberately bounded native-to-visual bridge. No attempt to translate
// arbitrary Gen III bytecode: only bounded linear conditions, movements,
// standard trainer battles, flags and dialogue are translated. Other script
// variants, calls, jumps and shared subroutines remain native-only.
import {sceneIssues,prepareScene} from './authoring-model.js';
import {decodeNativeMovement} from './native-movement-bridge.js';
import {nativeTrainerId,nativeTrainerLocalId} from './native-trainer-bridge.js';

const BASE=0x08000000,MAX_COMMANDS=128,MAX_ACTIONS=64;
const fail=(message,at)=>{throw Error('Native event conversion: '+message+(Number.isInteger(at)?' at 0x'+at.toString(16):'')+'. Keep its original native script or edit it in ROM story.');};
function textAt(graph,at,pointer){
 if(!Number.isInteger(pointer)||pointer<BASE+512)fail('dialogue pointer could not be verified',at);
 const row=graph.texts?.[pointer-BASE];
 if(!row||typeof row.text!=='string')fail('dialogue bytes could not be decoded',at);
 if(graph.edits?.commands?.[at])fail('edited dialogue pointer needs a native flow review',at);
 return graph.edits?.texts?.[row.at]?.text??row.text;
}
function textFor(graph,at,node){return textAt(graph,at,node.args.find(a=>a.kind==='text')?.value);}
function stepsFromNativeGraph(graph,root,newId,map){
 if(!root||!['npcs','signs','triggers'].includes(root.kind))fail('only original NPC, sign and tile event entries can become visual scenes');
 if(graph.edits?.flows?.[root.id])fail('this entry has a native structural flow; restore that flow before converting',root.address);
 const seen=new Set(),state={commands:0,actions:0};
 const current=(at,{allowMessageStd=false}={})=>{
  const n=graph.nodes?.[at];
  if(!n||n.opaque||(n.external||n.adapter)&&!(allowMessageStd&&n.code===9))fail('an unresolved or engine-specific command cannot be translated',at);
  if(graph.edits?.commands?.[at])fail('this event has edited native command arguments',at);
  return n;
 };
 const visit=at=>{
  if(++state.commands>MAX_COMMANDS)fail('this event exceeds the 128-command conversion limit',at);
  if(seen.has(at))fail('a script loop or shared branch needs the native flow editor',at);
  seen.add(at);
 };
 const newAction=(data,at)=>{
  if(++state.actions>MAX_ACTIONS)fail('this event exceeds the 64-action visual conversion limit',at);
  const id=newId();if(typeof id!=='string'||!id.trim())fail('action IDs could not be allocated',at);
  return{id,...data};
 };
 const actorFor=(local,at)=>{
  if(local===255)return'player';
  if(local===254){if(root.kind!=='npcs')fail('last-talked NPC cannot be resolved for this trigger',at);return'self';}
  const marker=map.markers?.find(m=>(m.rom?.type==='npc'||m.npc)&&Number(m.rom?.localId??m.npc?.localId)===local);
  if(!marker)fail('movement targets an NPC not imported on this map (local ID '+local+')',at);
  return marker.id;
 };
 function parse(start,stop=null,depth=0){
  if(depth>8)fail('conditional branches exceed eight visual levels',start);
  const out=[];let at=start,hadDialogue=false,lastSound=null;
  for(;;){
   if(at===stop)return out;
   if(stop!==null&&at>stop)fail('conditional branch passed its verified join point',at);
   const n=current(at);visit(at);
   const args=(n.args||[]).map(a=>a.value),code=n.code;
   if(code===2){if(stop!==null)fail('conditional branch returns before its expected join point',at);return out;}
   if([0,1,104,105,107].includes(code)){
    if(code===104&&!hadDialogue)fail('closing an unrecognised message',at);
    at=n.end;continue;
   }
   if(code===15&&args[0]===0){
    const next=current(n.end,{allowMessageStd:true}),style=next.code===9?next.args?.[0]?.value:null;
    if(![4,6].includes(style))fail('unsupported message box mode or command sequence',at);
    visit(next.at);out.push(newAction({type:'say',text:textFor(graph,at,n),messageType:style},at));
    hadDialogue=true;at=next.end;continue;
   }
   if(code===103||code===155){
    out.push(newAction({type:'say',text:textFor(graph,at,n),...(code===155?{scroll:true}:{})},at));
    hadDialogue=true;at=n.end;continue;
   }
   if(code===102||code===109){if(!hadDialogue)fail('message wait without a decoded message',at);at=n.end;continue;}
   if(code===40){
    if(!Number.isInteger(args[0])||args[0]<1||args[0]>36000)fail('delay is outside the visual scene range',at);
    out.push(newAction({type:'wait',frames:args[0]},at));at=n.end;continue;
   }
   if(code===47){lastSound=newAction({type:'sound',soundId:args[0],wait:false},at);out.push(lastSound);at=n.end;continue;}
   if(code===48){if(!lastSound)fail('a delayed sound cannot be reconstructed without its source',at);lastSound.wait=true;lastSound=null;at=n.end;continue;}
   lastSound=null;
   if(code===51){if(args.length!==2||args[1]!==0)fail('music playback has an unsupported continuation mode',at);out.push(newAction({type:'music',songId:args[0]},at));at=n.end;continue;}
   if(code===151){if(!Number.isInteger(args[0])||args[0]>3)fail('screen-fade mode is not supported',at);out.push(newAction({type:'fade',mode:args[0]},at));at=n.end;continue;}
   if(code===79){
    const pointer=n.args?.find(a=>a.kind==='movement')?.value;
    const record=Number.isInteger(pointer)&&graph.movements?.[pointer-BASE];
    if(!record)fail('movement bytes were not indexed',at);
    const bytes=graph.edits?.movements?.[record.at]?.bytes??record.bytes;
    let moves;try{moves=decodeNativeMovement(bytes);}catch(error){fail(error.message,at);}
    const actorId=actorFor(args[0],at),next=graph.nodes?.[n.end];
    let wait=false;
    if(next?.code===81){
     if(next.args?.[0]?.value!==args[0])fail('waitmovement targets a different NPC or an ambiguous last-moved actor',next.at);
     current(next.at);visit(next.at);wait=true;
    }
    out.push(newAction({type:'nativeMovement',actorId,moves,wait},at));
    at=wait?next.end:n.end;continue;
   }
   if(code===92){
    // Only the original type-1 NPC battle with two indexed messages and an
    // immediate post-battle continuation has a safe one-action equivalent.
    if(root.kind!=='npcs'||args.length!==6||args[0]!==1||
       n.args?.[3]?.kind!=='text'||n.args?.[4]?.kind!=='text'||n.args?.[5]?.kind!=='script'||
       args[5]!==BASE+n.end)fail('trainer battle variant or post-battle continuation is not safely convertible',at);
    let trainerId,localId;
    try{trainerId=nativeTrainerId(args[1]);localId=nativeTrainerLocalId(args[2]);}catch(e){fail(e.message,at);}
    out.push(newAction({type:'battle',trainerId,nativeLocalId:localId,
      intro:textAt(graph,at,args[3]),defeat:textAt(graph,at,args[4])},at));
    at=n.end;continue;
   }
   if(code===97||code===98){
    if(args.length!==1)fail('trainer defeated-state command has invalid arguments',at);
    let trainerId;try{trainerId=nativeTrainerId(args[0]);}catch(e){fail(e.message,at);}
    out.push(newAction({type:'nativeTrainerFlag',trainerId,value:code===97},at));at=n.end;continue;
   }
   if(code===41||code===42){
    if(args.length!==1||!Number.isInteger(args[0])||args[0]<0||args[0]>65535)fail('native flag write has an invalid original engine ID',at);
    out.push(newAction({type:'nativeFlag',nativeFlagId:args[0],value:code===41},at));at=n.end;continue;
   }
   if(code===43||code===96){
    const conditional=current(n.end),flag=args[0];
    if(code===96)try{nativeTrainerId(flag);}catch(e){fail(e.message,at);}
    if(conditional.code!==6||conditional.args?.[0]?.value!==1||conditional.args.length!==2)fail('native flag check must use an explicit checkflag/goto_if 1 pair',at);
    const trueAt=conditional.args[1].value-BASE,falseAt=conditional.end;
    if(!graph.nodes?.[trueAt]||trueAt<=falseAt)fail('flag branch target is not a forward original script block',conditional.at);
    let seek=falseAt,exit=null;
    for(let i=0;i<MAX_COMMANDS&&seek<trueAt;i++){
     const candidate=current(seek,{allowMessageStd:true});
     if(candidate.code===5){exit=candidate;break;}
     if(candidate.end<=seek||candidate.end>trueAt)fail('flag branch has an unresolved forward command boundary',seek);
     seek=candidate.end;
    }
    if(!exit||exit.end!==trueAt)fail('only bounded if/else flag diamonds with a verified branch join can be converted',conditional.at);
    const join=exit.args?.[0]?.value-BASE;
    if(!Number.isInteger(join)||join<=trueAt||!graph.nodes?.[join])fail('flag branches do not have a shared forward join point',exit.at);
    visit(conditional.at);visit(exit.at);
    // Parse false and true as separate paths. Any shared command, loop, goto
    // inside the arm or unsupported opcode aborts the *whole* conversion.
    const otherwise=parse(falseAt,exit.at,depth+1),then=parse(trueAt,join,depth+1);
    out.push(newAction(code===43?{type:'nativeFlagIf',nativeFlagId:flag,then,else:otherwise}:{type:'nativeTrainerIf',trainerId:flag,then,else:otherwise},at));
    at=join;continue;
   }
   fail('unsupported '+(n.name||'opcode '+code)+' command',at);
  }
 }
 const steps=parse(root.address);
 if(!steps.length)fail('the event has no convertible visual actions',root.address);
 return{steps,commands:state.commands};
}
function sourceMarker(project,sourceId,root){
 const map=project.maps?.find(m=>m.rom?.sourceId===sourceId&&m.rom?.key===root.mapKey&&!m.rom.isCopy);
 if(!map)fail('import the original map into the project before converting this event');
 const kind={npcs:'npc',signs:'sign',triggers:'trigger'}[root.kind];
 if(!kind)fail('this map-script entry cannot be converted to a map object');
 const marker=map.markers?.find(n=>n.rom?.type===kind&&n.rom?.index===root.index);
 if(!marker)fail('import the original '+kind+' pin to retain its script pointer and event identity');
 if(marker.runtime)fail('this event already has authored actions; open the existing event instead');
 if(kind==='sign'&&(marker.rom?.signType??0)>4)fail('a hidden item is not an editable dialogue sign');
 return{map,marker};
}
// Pure preview for the ROM event screen; neither the graph nor the project
// changes until the user explicitly applies the draft through a history action.
export function previewNativeVisualImport(project,sourceId,graph,root,{newId=()=> 'preview-action'}={}){
 try{
  if(!graph||!['frlg','rse'].includes(graph.engine))fail('a decoded FireRed/Emerald native event graph is required');
  const {map,marker}=sourceMarker(project,sourceId,root);
  const {steps,commands}=stepsFromNativeGraph(graph,root,newId,map);
  const runtime={action:'scene',trigger:root.kind==='triggers'?'step':'interact',enabled:true,repeat:'always',blocksMovement:false,conditions:[],steps,repeatSteps:[]};
  const draft={...structuredClone(marker),runtime:{...runtime,importedNative:{version:1,sourceId,mapKey:root.mapKey,rootId:root.id,address:root.address}}};
  // Strictly check the same model used by the visual editor and exporter.
  const issues=sceneIssues(draft,project,map).filter(i=>i.severity!=='warning');
  if(issues.length)fail(issues[0].path+': '+issues[0].message);
  return{supported:true,map,marker,draft,steps,commands};
 }catch(error){return{supported:false,reason:error.message};}
}
export function applyNativeVisualImport(project,sourceId,graph,root,newId){
 const preview=previewNativeVisualImport(project,sourceId,graph,root,{newId});
 if(!preview.supported)throw Error(preview.reason);
 const {map,marker,draft}=preview;
 // validate before mutating so even a failed quest-slot reservation cannot
 // destroy original imported markers or overwrite a pre-existing authored scene.
 const before=structuredClone(project.questFlags||[]),token=project.questToken;
 try{
  prepareScene(project,draft);
  Object.assign(marker,draft);
 }catch(error){project.questFlags=before;project.questToken=token;throw error;}
 return{map,marker,steps:preview.steps,commands:preview.commands};
}
