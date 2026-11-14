// Shared native + editor simulation for all-or-nothing item exchanges.
// All checks happen before removing the player's item. If the native reward
// add still fails, the original item is refunded before ending the event.
import {wrapDialogue} from './world-model.js';
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function validateItemTrade(step,gameProfile=null){
 if(!step||step.type!=='trade'||!integer(step.fromItemId,1,4095)||!integer(step.fromQuantity,1,999)||
  !integer(step.toItemId,1,4095)||!integer(step.toQuantity,1,999)||step.fromItemId===step.toItemId)
  throw Error('Choose two different native items with quantities from 1 to 999 for an exchange.');
 if(gameProfile){
  for(const n of [step.fromItemId,step.toItemId])
   if(n>=gameProfile.itemCount||gameProfile.itemIds&&!gameProfile.itemIds.includes(n))
    throw Error('The exchange refers to an item not initialized in this ROM.');
 }
 return step;
}
export function previewItemTrade(bag,step,{slotLimit=Infinity,stackLimit=999}={}){
 validateItemTrade(step);
 if(!(bag instanceof Map)||!(slotLimit===Infinity||integer(slotLimit,0,65535))||!integer(stackLimit,1,9999))
  throw Error('Invalid preview inventory or item storage capacity.');
 const have=bag.get(step.fromItemId)||0,reward=bag.get(step.toItemId)||0;
 if(!integer(have,0,999999)||!integer(reward,0,999999))throw Error('The preview inventory is invalid.');
 if(have<step.fromQuantity)return {ok:false,reason:'missing',message:'You do not have the requested item.',next:null};
 const occupied=[...bag.values()].filter(count=>count>0).length;
 if(reward+step.toQuantity>stackLimit||reward===0&&occupied>=slotLimit)
  return {ok:false,reason:'bag-full',message:'There is no room in your Bag.',next:null};
 const next=new Map(bag),remaining=have-step.fromQuantity;
 if(remaining)next.set(step.fromItemId,remaining);else next.delete(step.fromItemId);
 next.set(step.toItemId,reward+step.toQuantity);
 return {ok:true,reason:null,message:null,next};
}
export function nativeItemTradeSource(step,prefix,{end='@field_event_end',gameProfile}={}){
 validateItemTrade(step,gameProfile);
 if(!/^[A-Za-z0-9_]{1,60}$/.test(String(prefix))||!/^@[A-Za-z0-9_]{1,80}$/.test(end))
  throw Error('An item exchange requires safe, local script labels.');
 if(!gameProfile||!['frlg','rse'].includes(gameProfile.engine))throw Error('Choose a verified FRLG or RSE native item table.');
 const at=name=>'@trade_'+prefix+'_'+name;
 const fail=(label,text)=>[at(label)+':','msgbox '+at(label)+'_text 4','goto '+end];
 const commands=[
  'checkitem '+step.fromItemId+' '+step.fromQuantity,'compare_var_to_value 0x800D 1',
  'goto_if 1 '+at('have'),...fail('missing','You do not have the requested item.'),
  at('have')+':',
  'checkitemspace '+step.toItemId+' '+step.toQuantity,'compare_var_to_value 0x800D 1',
  'goto_if 1 '+at('room'),...fail('bagfull','There is no room in your Bag.'),
  at('room')+':',
  'removeitem '+step.fromItemId+' '+step.fromQuantity,'compare_var_to_value 0x800D 1',
  'goto_if 1 '+at('removed'),'goto '+at('missing'),
  at('removed')+':',
  'additem '+step.toItemId+' '+step.toQuantity,'compare_var_to_value 0x800D 1',
  'goto_if 1 '+at('awarded'),
  // A failed add must not silently consume the player's payment.
  'additem '+step.fromItemId+' '+step.fromQuantity,
  ...fail('failed','The exchange could not be completed. Please try again.'),
  at('awarded')+':'
 ];
 const data=[
  at('missing')+'_text:\n= '+wrapDialogue('You do not have the requested item.')+'$',
  at('bagfull')+'_text:\n= '+wrapDialogue('There is no room in your Bag.')+'$',
  at('failed')+'_text:\n= '+wrapDialogue('The exchange could not be completed. Please try again.')+'$'
 ];
 if(step.notify!==false){
  const receipt=at('receipt');
  commands.push('bufferitemname 0 '+step.toItemId,'playfanfare '+(gameProfile.engine==='rse'?370:258),
   'msgbox '+receipt+' 4','waitfanfare','closemessage');
  data.push(receipt+':\n= '+wrapDialogue('Obtained {STR_VAR_1}'+(step.toQuantity>1?' x'+step.toQuantity:'')+'!')+'$');
 }
 return {commands,data};
}
