import {hmRequirementSource} from './hm-rules.js';
import{HMS}from'./field-model.js';
import{compileScript}from'./script-engine.js';
import{wrapDialogue}from'./world-model.js';
import {questReadSource} from './quest-runtime.js';
import {fieldSlot,fieldWriteSource} from './field-persistence.js';
const BASE=0x08000000;
function installScript(output,source,engine){const checked=compileScript(source,0,engine),at=output.allocate(checked.bytes,'Field interaction');const compiled=compileScript(source,at,engine);output.write(at,compiled.bytes);return at+compiled.entryOffset;}
export function fieldObjectSource(o,localId,profile,context={}){
 const h=HMS[o.kind],standard=o.access==='standard',commands=['lockall'];if(o.permanent)commands.push(...questReadSource(context.questRuntime,fieldSlot(o,context.questFlags||[]),'@done'));
 if(standard&&context.project?.hmRules?.moves?.[o.kind])commands.push(...hmRequirementSource(context.project,o.kind,{...context,fail:'@blocked'}),'setfieldeffectargument 0 0x800D');
 else if(standard){const p=profile.scripts[o.kind];commands.push('checkflag '+p.badgeFlag,'goto_if 0 @blocked','checkpartymove '+p.moveId,'compare_var_to_value 0x800D 6','goto_if 1 @blocked','setfieldeffectargument 0 0x800D');}
 commands.push('msgbox @question 5','compare_var_to_value 0x800D 0','goto_if 1 @done','closemessage');
 if(standard&&(!context.project?.hmRules?.moves?.[o.kind]||context.project.hmRules.moves[o.kind].mode==='party'))commands.push('dofieldeffect '+profile.scripts[o.kind].fieldEffectId,'waitstate');
 if(o.kind==='strength')commands.push('setflag 0x805','msgbox @ready 4');
 else commands.push('applymovement '+localId+' @break','waitmovement '+localId,'setobjectxyperm '+localId+' 1000 1000','removeobject '+localId);
 if(o.kind!=='strength')commands.push(...fieldWriteSource(o,context,'@done'));
 commands.push('goto @done','@blocked:','msgbox @requirements 4','@done:','releaseall','end','@question:','= '+(o.kind==='strength'?wrapDialogue('Activate STRENGTH to push this boulder?'):o.kind==='rocksmash'?wrapDialogue('Break this rock with ROCK SMASH?'):'Cut down this tree?')+'$','@requirements:','= '+wrapDialogue('The field move requirements are not met.')+'$');
 if(o.kind==='strength')commands.push('@ready:','= You can now push boulders!$');else commands.push('@break:',o.kind==='cut'?'cut_tree':'rock_smash_break','step_end');return commands.join('\n');
}
export function installFieldObjects(output,reader,map,events,profile,{isNew=false,questRuntime,questFlags=[],project,itemIds}={}){
 const objects=new Map();if(!(map.fieldObjects||[]).length)return objects;if(!profile)throw Error('Native HM objects have not been verified for this ROM.');
 const converted=new Set(),used=new Set(events.npcs.map(a=>a[0]));for(const o of map.fieldObjects||[]){let at=o.rom?.type==='npc'&&!isNew?o.rom.index:-1,record=at>=0?events.npcs[at]?.slice():null;if(at>=0){if(map.fieldRemovedNPCs?.includes(at))throw Error('This original HM object is also marked for removal.');if(converted.has(at))throw Error('Two HM objects refer to the same original object.');converted.add(at);}if(at>=0&&!record)throw Error('An original field object is missing. Reimport its source map.');if(record&&record[1]!==HMS[o.kind].graphics)throw Error('This original object does not match its saved HM type.');if(!record){const id=Array.from({length:254},(_,i)=>i+1).find(id=>!used.has(id));if(!id)throw Error('No local object IDs remain on this map.');used.add(id);record=new Uint8Array(24);record[0]=id;record[1]=HMS[o.kind].graphics;record[8]=3;record[9]=8;}
  const v=new DataView(record.buffer);v.setInt16(4,o.x,true);v.setInt16(6,o.y,true);const script=installScript(output,fieldObjectSource(o,record[0],profile,{questRuntime,questFlags,project,itemIds}),reader.engine);v.setUint32(16,BASE+script,true);if(at>=0)events.npcs[at]=record;else events.npcs.push(record);objects.set(o.id,{...o,localId:record[0]});
 }if(events.npcs.filter((_,i)=>!map.fieldRemovedNPCs?.includes(i)).length>profile.limits.mapObjectTemplates)throw Error(map.name+': too many native field objects. Use at most64 total object records on a map.');return objects;
}
export function hmActionSource(s,index,{fieldProfile,fieldObjects=new Map(),questRuntime,questFlags=[],project,itemIds}={}){
 if(!fieldProfile)throw Error('HM actions have not been verified for this ROM.');const h=HMS[s.effect];if(!h||s.effect==='surf')throw Error('Choose a supported field action.');const commands=[],data=[],suffix='hm'+index;
 // Use explicit branches instead of calling an interaction script from an unrelated trigger.
 if(s.requireHM&&project?.hmRules?.moves?.[s.effect])commands.push(...hmRequirementSource(project,s.effect,{questRuntime,itemIds,fail:'@'+suffix+'blocked',prefix:'@'+suffix+'global'}));
 else if(s.requireHM){const badge=s.effect==='flash'?fieldProfile.flash.badgeFlag:fieldProfile.scripts[s.effect].badgeFlag;commands.push('checkflag '+badge,'goto_if 0 @'+suffix+'blocked','checkpartymove '+h.move,'compare_var_to_value 0x800D 6','goto_if 1 @'+suffix+'blocked');}
 if(s.effect==='flash')commands.push('animateflash 0','setflashlevel 0','setflag '+fieldProfile.flash.activeFlag);
 else if(s.effect==='strength')commands.push('setflag '+fieldProfile.strength.activeFlag);
 else{const target=fieldObjects.get(s.targetId);if(!target||target.kind!==s.effect)throw Error('Choose an HM object on this same map.');commands.push('applymovement '+target.localId+' @'+suffix+'move','waitmovement '+target.localId,'setobjectxyperm '+target.localId+' 1000 1000','removeobject '+target.localId);commands.push(...fieldWriteSource(target,{questRuntime,questFlags},'@field_event_end'));data.push('@'+suffix+'move:',s.effect==='cut'?'cut_tree':'rock_smash_break','step_end');}
 if(s.requireHM){commands.push('goto @'+suffix+'after','@'+suffix+'blocked:','msgbox @'+suffix+'text 4','goto @field_event_end','@'+suffix+'after:');data.push('@'+suffix+'text:','= '+wrapDialogue('The field move requirements are not met.')+'$');}
 return{commands,data};
}
