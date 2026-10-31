import{STOCK_FIRE_RED_SHA}from'./verified-frlg.js';
import {questReadSource,questWriteSource,questLogGuardSource} from './quest-runtime.js';
import {readAuthoring,sceneIssues,pathDirections,findEvent} from './authoring-model.js';
import {wrapDialogue} from './world-model.js';
import {fieldWriteSource} from './field-persistence.js';
import {effectSource} from './scene-effects.js';
import {hmActionSource} from './field-rom.js';

const OPS={eq:1,ne:5,gt:2,ge:4,lt:0,le:3};
const HM_MOVES={cut:15,fly:19,surf:57,strength:70,flash:148,rocksmash:249,waterfall:127,dive:291};
// Counters use reserved project bits, never unallocated native story variables.
export function variableReadSource(v,context,prefix='@varread',destination='0x800A'){
  const out=['setvar '+destination+' 0'];for(let i=0;i<v.bits;i++)out.push(...questReadSource(context.questRuntime,context.slot(v.bitIds[i]),'@scene_conflict'),'compare_var_to_value 0x800D 0','goto_if 1 '+prefix+'_'+i,'addvar '+destination+' '+2**i,prefix+'_'+i+':');return out;
}
export function variableWriteSource(v,context,prefix='@varwrite',source='0x800B'){
  const out=[];for(let i=v.bits-1;i>=0;i--)out.push('compare_var_to_value '+source+' '+2**i,'goto_if 0 '+prefix+'_clear'+i,'subvar '+source+' '+2**i,...questWriteSource(context.questRuntime,context.slot(v.bitIds[i]),true,'@scene_conflict'),'goto '+prefix+'_next'+i,prefix+'_clear'+i+':',...questWriteSource(context.questRuntime,context.slot(v.bitIds[i]),false,'@scene_conflict'),prefix+'_next'+i+':');return out;
}
export function sceneSource(n,context={}){
  const {project,map,gameProfile,questRuntime,questFlags=[],resolveMap,gateCommands=new Map(),fieldProfile,fieldObjects=new Map(),npcBindings=new Map(),musicIds=new Map(),itemIds=new Map()}=context;
  if(!project||!map)throw Error('A visual scene needs its project and map.');
  if(n.runtime?.debugOnly&&!project.developer?.enabled)throw Error('Developer consoles are disabled for this export.');
  const issues=sceneIssues(n,project,map,{native:true});if(issues.length)throw Error(n.title+': '+issues.map(i=>i.path+' — '+i.message).join('; '));
  const a=readAuthoring(project),r=n.runtime,code=[...(questRuntime?questLogGuardSource('@scene_end'):[]),'lockall'],data=[];let serial=0;
  const label=prefix=>'@s'+serial+++'_'+prefix;
  const slot=id=>{const q=questFlags.find(q=>q.id===id);if(!q)throw Error('A scene references a missing saved flag.');return q.slot;};const ctx={questRuntime,slot};
  const valueText=s=>s.dialogueId?a.dialogues.find(d=>d.id===s.dialogueId)?.text:s.text;
  const say=(value,{scroll=false}={})=>{const at=label('text');data.push(at+':\n= '+wrapDialogue(value)+'$');if(scroll)code.push('messageautoscroll '+at,'waitmessage','waitbuttonpress','closemessage');else code.push('msgbox '+at+' 4','closemessage');};
  const actor=id=>{if(id==='player')return 255;const target=id==='self'?n:map.markers.find(m=>m.id===id),local=target&&(npcBindings.get(target.id)?.localId??target.rom?.localId);if(!Number.isInteger(local)||local<1||local>255)throw Error('A scene character has no native local ID.');return local;};
  const item=s=>{const id=s.itemRef?itemIds.get(s.itemRef):+s.itemId;if(!Number.isInteger(id)||id<1||id>=(gameProfile?.itemCount||0)||gameProfile?.itemIds&&!gameProfile.itemIds.includes(id))throw Error('Choose a bound item record for this scene.');return id;};
  function movement(id,actions,wait=true){const at=label('movement');data.push(at+':\n'+actions.join('\n')+'\nstep_end');code.push('applymovement '+actor(id)+' '+at);if(wait)code.push('waitmovement '+actor(id));}
  function condition(c,fail){const pass=label('requirement');
    if(['flag','event','visited'].includes(c.kind)){let id=c.flagId;if(c.kind==='event')id=findEvent(project,c.eventId)?.n.runtime?.completionFlag;if(c.kind==='visited')id=a.presentation.visitFlags?.[c.mapId];code.push(...questReadSource(questRuntime,slot(id),'@scene_conflict'),'compare_var_to_value 0x800D '+(c.value===false?0:1),'goto_if 1 '+pass);}
    else if(['variable','option'].includes(c.kind)){const v=a.variables.find(v=>v.id===c.variableId);code.push(...variableReadSource(v,ctx,label('read')),'compare_var_to_value 0x800A '+Math.max(0,Math.min(65535,+c.value||0)),'goto_if '+(OPS[c.operator]??4)+' '+pass);}
    else if(c.kind==='badge'){if(gameProfile?.engine&&gameProfile.engine!=='frlg')throw Error('Badge conditions need this engine’s badge flag adapter.');code.push('checkflag '+(0x820+(+c.badge)-1),'goto_if 1 '+pass);}
    else if(c.kind==='hm')code.push('checkpartymove '+HM_MOVES[c.hm],'compare_var_to_value 0x800D 6','goto_if 5 '+pass);
    else if(c.kind==='item')code.push('checkitem '+item(c)+' '+(c.quantity||1),'compare_var_to_value 0x800D 1','goto_if 1 '+pass);
    else if(c.kind==='money')code.push('checkmoney '+(+c.amount||0)+' 0','compare_var_to_value 0x800D 1','goto_if 1 '+pass);
    else throw Error('Unsupported scene requirement.');
    code.push('goto '+fail,pass+':');
  }
  function actions(steps,depth=0){if(depth>8)throw Error('Keep branching within eight levels.');for(const s of steps||[]){
    if(s.type==='say')say(valueText(s),s);
    else if(s.type==='respawn'){if(gameProfile?.sourceSha256!==STOCK_FIRE_RED_SHA||!Number.isInteger(s.healId)||s.healId<1||s.healId>20)throw Error('Respawn checkpoints need the verified FireRed healing-location adapter.');code.push('setrespawn '+s.healId);}
    else if(s.type==='wait')code.push('pause '+s.frames);
    else if(s.type==='flag')code.push(...questWriteSource(questRuntime,slot(s.flagId),s.value!==false,'@scene_conflict'));
    else if(['set','add'].includes(s.type)){const v=a.variables.find(v=>v.id===s.variableId),max=2**v.bits-1;let amount=Math.trunc(+s.value||0);if(s.type==='set')code.push('setvar 0x800B '+Math.max(0,Math.min(max,amount)));else{const finish=label('counter_clamp'),under=label('counter_under');code.push(...variableReadSource(v,ctx,label('counter_read')),'copyvar 0x800B 0x800A');if(amount>=0){amount=Math.min(max,amount);code.push('compare_var_to_value 0x800B '+(max-amount),'goto_if 3 '+under,'setvar 0x800B '+max,'goto '+finish,under+':','addvar 0x800B '+amount);}else{amount=Math.min(max,-amount);code.push('compare_var_to_value 0x800B '+amount,'goto_if 4 '+under,'setvar 0x800B 0','goto '+finish,under+':','subvar 0x800B '+amount);}code.push(finish+':');}code.push(...variableWriteSource(v,ctx,label('counter_write')));}
    else if(s.type==='if'){const no=label('else'),end=label('branch_end');for(const c of s.conditions||[])condition(c,no);actions(s.then,depth+1);code.push('goto '+end,no+':');actions(s.else,depth+1);code.push(end+':');}
    else if(s.type==='choice'){const at=label('question'),no=label('no'),end=label('choice_end');data.push(at+':\n= '+wrapDialogue(valueText(s))+'$');code.push('msgbox '+at+' 5','compare_var_to_value 0x800D 0','goto_if 1 '+no,'closemessage');actions(s.yes,depth+1);code.push('goto '+end,no+':','closemessage');actions(s.no,depth+1);code.push(end+':');}
    else if(s.type==='answers'){const id=context.choiceIds?.get(s.id);if(!Number.isInteger(id))throw Error('The custom answer menu was not installed.');const at=label('question'),end=label('answers_end'),branches=s.choices.map(()=>label('answer'));data.push(at+':\n= '+wrapDialogue(valueText(s))+'$');code.push('message '+at,'waitmessage','multichoice 0 0 '+id+' '+(s.allowCancel===false?1:0));branches.forEach((branch,i)=>code.push('compare_var_to_value 0x800D '+i,'goto_if 1 '+branch));code.push('closemessage');actions(s.cancel,depth+1);code.push('goto '+end);branches.forEach((branch,i)=>{code.push(branch+':','closemessage');actions(s.choices[i].steps,depth+1);code.push('goto '+end);});code.push(end+':');}
    else if(s.type==='shop'){const ids=(s.items||[]).map(i=>typeof i==='string'?itemIds.get(i):i);if(!ids.length||ids.length>50||ids.some(i=>!Number.isInteger(i)||i<1||i>=(gameProfile?.itemCount||0)||gameProfile?.itemIds&&!gameProfile.itemIds.includes(i)))throw Error('Choose 1–50 bound shop items.');const at=label('shop');code.push('closemessage','pokemart '+at);data.push('.align 2',at+':','.hword '+[...ids,0].join(' '));}
    else if(s.type==='battle'){if(s.trainerId<1||s.trainerId>=(gameProfile?.trainerCount||0))throw Error('Choose an existing trainer slot.');const intro=label('battle_intro'),defeat=label('battle_defeat'),after=label('battle_after');data.push(intro+':\n= '+wrapDialogue(s.intro||'Let us battle!')+'$',defeat+':\n= '+wrapDialogue(s.defeat||'You won!')+'$');code.push('closemessage','trainerbattle 1 '+s.trainerId+' '+(npcBindings.get(n.id)?.localId??n.rom?.localId??0)+' '+intro+' '+defeat+' '+after,after+':');}
    else if(s.type==='giveMon'){if(s.species<1||s.species>=(gameProfile?.speciesCount||0)||(s.itemId||0)>=(gameProfile?.itemCount||0))throw Error('Choose a native Pokémon and held item.');const ok=label('gift_ok');code.push('givemon '+s.species+' '+s.level+' '+(s.itemId||0)+' 0 0 0','compare_var_to_value 0x800D 2','goto_if 0 '+ok);say('Your party and storage have no room.');code.push('goto @scene_end',ok+':');if(s.unlockPartyMenu){if(gameProfile?.sourceSha256!==STOCK_FIRE_RED_SHA)throw Error('Starter party-menu access needs the verified FireRed system-flag adapter.');code.push('setflag 0x828');}}
    else if(s.type==='portrait'){if(s.species<1||s.species>=(gameProfile?.speciesCount||0))throw Error('Choose a native Pokémon portrait.');code.push('showmonpic '+s.species+' 10 3','waitbuttonpress','hidemonpic');}
    else if(s.type==='path')movement(s.actorId,pathDirections(s.points).map(d=>(s.speed==='run'?'walk_fast_':'walk_')+d),s.wait!==false);
    else if(s.type==='face')movement(s.actorId,['face_'+(s.direction||'down')]);
    else if(s.type==='emote'){const d=s.direction||'down',away={up:'down',down:'up',left:'right',right:'left'}[d],emotes={exclaim:['emote_exclamation_mark'],question:['emote_question_mark'],happy:['emote_smile'],shock:['emote_exclamation_mark','jump_in_place_'+d],fear:['emote_exclamation_mark','jump_in_place_'+d,'walk_'+away]};movement(s.actorId,emotes[s.emotion]||emotes.exclaim);}
    else if(s.type==='visible')movement(s.actorId,[s.visible===false?'set_invisible':'set_visible']);
    else if(s.type==='cry'){if(+s.species>=(gameProfile?.speciesCount||0))throw Error('The cry species is outside this ROM.');code.push('playmoncry '+s.species+' 0');if(s.wait!==false)code.push('waitmoncry');}
    else if(s.type==='music'){const id=s.trackId?musicIds.get(s.trackId):+s.songId;if(!Number.isInteger(id))throw Error('An event music track is missing.');code.push('playbgm '+id+' 0');}
    else if(s.type==='sound')code.push('playse '+(+s.soundId||5),...(s.wait===false?[]:['waitse']));
    else if(s.type==='fade')code.push('fadescreen '+(+s.mode||0));
    else if(s.type==='heal')code.push('special 0');
    else if(s.type==='item'){const id=item(s),quantity=Math.max(1,Math.min(999,+s.quantity||1)),ok=label('item_ok'),awarded=label('item_awarded'),failure=s.operation==='take'?'You do not have the required item.':'There is no room in your Bag.';code.push((s.operation==='take'?'checkitem ':'checkitemspace ')+id+' '+quantity,'compare_var_to_value 0x800D 1','goto_if 1 '+ok);say(failure);code.push('goto @scene_end',ok+':',(s.operation==='take'?'removeitem ':'additem ')+id+' '+quantity,'compare_var_to_value 0x800D 1','goto_if 1 '+awarded);say(failure);code.push('goto @scene_end',awarded+':');if(s.operation!=='take'&&s.notify!==false){const receipt=label('item_receipt');code.push('bufferitemname 0 '+id,'playfanfare '+(gameProfile.engine==='rse'?370:258),'msgbox '+receipt+' 4','waitfanfare','closemessage');data.push(receipt+':\n= '+wrapDialogue('Obtained {STR_VAR_1}'+(quantity>1?' x'+quantity:'')+'!')+'$');}}
    else if(s.type==='money'){const amount=Math.max(0,Math.min(999999,+s.amount||0));if(s.operation==='take'){const ok=label('money_ok');code.push('checkmoney '+amount+' 0','compare_var_to_value 0x800D 1','goto_if 1 '+ok);say('You do not have enough money.');code.push('goto @scene_end',ok+':');}code.push((s.operation==='take'?'removemoney ':'addmoney ')+amount+' 0');}
    else if(s.type==='warp'){const target=resolveMap(s.to.mapId);if(!target||[target.bank,target.index,s.to.x,s.to.y].some(n=>n<0||n>127))throw Error('The scene destination must be an exported map with coordinates below 128.');code.push('warp '+target.bank+' '+target.index+' 255 '+s.to.x+' '+s.to.y,'waitstate');}
    else if(s.type==='gate'){const commands=gateCommands.get(s.gateId);if(!commands)throw Error('Choose a gate on this map.');code.push(...commands);}
    else if(s.type==='hm'){const result=hmActionSource(s,serial++,{fieldProfile,fieldObjects,questRuntime,questFlags,project,itemIds});code.push(...result.commands.map(c=>c.replaceAll('@field_event_end','@scene_end')));data.push(...result.data);}
    else if(s.type==='completeField'){const o=fieldObjects.get(s.targetId);if(!o?.permanent)throw Error('Choose a permanent HM object.');code.push(...fieldWriteSource(o,{questRuntime,questFlags},'@scene_conflict'));if(o.kind==='strength')code.push('setobjectxyperm '+o.localId+' '+o.solvedPosition.x+' '+o.solvedPosition.y,'setobjectxy '+o.localId+' '+o.solvedPosition.x+' '+o.solvedPosition.y);else code.push('setobjectxyperm '+o.localId+' 1000 1000','removeobject '+o.localId);}
    else if(['shake','weather','rockfall'].includes(s.type)){const e=effectSource(s,{sourceHash:questRuntime?.sourceSHA||gameProfile?.sourceSha256,engine:gameProfile?.engine,actor:id=>fieldObjects.get(id)?.localId??actor(id),serial:serial++});code.push(...e.commands);data.push(...e.data);}
    else if(s.type==='stop')code.push('goto @scene_complete');
    else if(s.type==='abort')code.push('goto @scene_end');
    else throw Error('This scene action is not implemented: '+s.type);
  }}
  if(r.areaActiveFlag&&['area','radius'].includes(r.trigger))code.push(...questReadSource(questRuntime,slot(r.areaActiveFlag),'@scene_conflict'),'compare_var_to_value 0x800D 1','goto_if 1 @scene_end',...questWriteSource(questRuntime,slot(r.areaActiveFlag),true,'@scene_conflict'));
  const fail=label('requirements_failed');
  if(r.repeat==='once'){code.push(...questReadSource(questRuntime,slot(r.completionFlag),'@scene_conflict'),'compare_var_to_value 0x800D 1','goto_if 1 @scene_repeat');}
  for(const c of r.conditions||[])condition(c,fail);
  actions(r.steps);code.push('@scene_complete:');
  if(r.completionFlag&&questRuntime)code.push(...questWriteSource(questRuntime,slot(r.completionFlag),true,'@scene_conflict'));
  if(r.counterId)actions([{type:'add',variableId:r.counterId,value:1}]);
  code.push('goto @scene_end','@scene_repeat:');actions(r.repeatSteps);code.push('goto @scene_end',fail+':');if(r.failText?.trim())say(r.failText);code.push('goto @scene_end','@scene_conflict:');say('This save belongs to another project. Use its project or a fresh test save.');code.push('@scene_end:','closemessage','releaseall',context.endCommand==='return'?'return':'end');return code.join('\n')+'\n'+data.join('\n');
}
