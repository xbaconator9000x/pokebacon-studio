// Deliberately bounded native-to-visual bridge. No attempt to translate
// arbitrary Gen III bytecode: conditions, flags, trainer battles, native calls,
// jumps and shared script subroutines must remain in the native editor.
import {sceneIssues,prepareScene} from './authoring-model.js';
import {scenePages} from './scene-pages.js';

const BASE=0x08000000,MAX_COMMANDS=128,MAX_ACTIONS=64;
const fail=(message,at)=>{throw Error('Native event conversion: '+message+(Number.isInteger(at)?' at 0x'+at.toString(16):'')+'. Keep its original native script or edit it in ROM story.');};
function textFor(graph,at,node){
 const original=node.args.find(a=>a.kind==='text'),pointer=original?.value;
 if(!Number.isInteger(pointer)||pointer<BASE+512)fail('dialogue pointer could not be verified',at);
 const row=graph.texts?.[pointer-BASE];
 if(!row||typeof row.text!=='string')fail('dialogue bytes could not be decoded',at);
 if(graph.edits?.commands?.[node.at])fail('edited dialogue pointer needs a native flow review',at);
 return graph.edits?.texts?.[row.at]?.text??row.text;
}
function stepsFromNativeGraph(graph,root,newId){
 if(!root||!['npcs','signs','triggers'].includes(root.kind))fail('only original NPC, sign and tile event entries can become visual scenes');
 if(graph.edits?.flows?.[root.id])fail('this entry has a native structural flow; restore that flow before converting',root.address);
 const steps=[],used=new Set();let at=root.address,done=false,hadDialogue=false,lastSound=null,commandCount=0;
 const add=(data,origin)=>{
  if(steps.length>=MAX_ACTIONS)fail('this event exceeds the 64-action visual conversion limit',origin);
  const id=newId();if(typeof id!=='string'||!id.trim())fail('action IDs could not be allocated',origin);
  steps.push({id,...data});return steps[steps.length-1];
 };
 const next=(node)=>{const n=graph.nodes?.[node.end];if(!n)fail('following command has not been indexed',node.end);return n;};
 while(!done){
  if(++commandCount>MAX_COMMANDS)fail('this event exceeds the 128-command conversion limit',at);
  if(used.has(at))fail('a script loop or shared branch needs the native flow editor',at);
  used.add(at);
  const n=graph.nodes?.[at];if(!n||n.opaque||n.external||n.adapter)fail('an unresolved or engine-specific command cannot be translated',at);
  if(graph.edits?.commands?.[at])fail('this event has edited native command arguments',at);
  const args=(n.args||[]).map(arg=>arg.value),code=n.code;
  if(code===2){done=true;break;}
  if([0,1,104,105,107].includes(code)){ // No-op, close message, lock all, release all.
   if(code===104&&!hadDialogue)fail('closing an unrecognised message',at);
   at=n.end;continue;
  }
  if(code===15&&args[0]===0){ // msgbox expands to loadword 0 @text / callstd style
   const follow=next(n),style=follow.code===9?follow.args?.[0]?.value:null;
   if(![4,6].includes(style)||graph.edits?.commands?.[follow.at])fail('unsupported message box mode or command sequence',at);
   add({type:'say',text:textFor(graph,at,n),messageType:style},at);
   hadDialogue=true;used.add(follow.at);commandCount++;
   at=follow.end;continue;
  }
  if(code===103||code===155){
   add({type:'say',text:textFor(graph,at,n),...(code===155?{scroll:true}:{})},at);
   hadDialogue=true;at=n.end;continue;
  }
  if(code===102||code===109){if(!hadDialogue)fail('message wait without a decoded message',at);at=n.end;continue;}
  if(code===40){if(!Number.isInteger(args[0])||args[0]<1||args[0]>36000)fail('delay is outside the visual scene range',at);add({type:'wait',frames:args[0]},at);at=n.end;continue;}
  if(code===47){lastSound=add({type:'sound',soundId:args[0],wait:false},at);at=n.end;continue;}
  if(code===48){if(!lastSound)fail('a delayed sound cannot be reconstructed without its source',at);lastSound.wait=true;lastSound=null;at=n.end;continue;}
  lastSound=null;
  if(code===51){if(args.length!==2||args[1]!==0)fail('music playback has an unsupported continuation mode',at);add({type:'music',songId:args[0]},at);at=n.end;continue;}
  if(code===151){if(!Number.isInteger(args[0])||args[0]>3)fail('screen-fade mode is not supported',at);add({type:'fade',mode:args[0]},at);at=n.end;continue;}
  fail('unsupported '+(n.name||'opcode '+code)+' command',at);
 }
 if(!steps.length)fail('the event has no convertible visual actions',root.address);
 return{steps,commands:commandCount};
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
  const {steps,commands}=stepsFromNativeGraph(graph,root,newId);
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
