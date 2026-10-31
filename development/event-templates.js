// Development-only recipes. Not wired into the released editor.
// Use event-model.js validation/compiler: item receipt, engine fanfare,
// inventory failure and onceFlag completion remain owned by that compiler.
export const EVENT_TEMPLATE_NAMES = {
 itemPickup: 'Pick up an item', itemGift: 'Receive an item from an NPC',
 heal: 'Heal the party', shop: 'Open a shop', pokemonGift: 'Receive a Pokémon'
};
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export function eventTemplate(kind,options={}){
 const steps=[];
 if(options.intro)steps.push({type:'say',text:String(options.intro)});
 if(kind==='itemPickup'||kind==='itemGift'){
  const itemId=options.itemId,quantity=options.quantity??1;
  if(!integer(itemId,1,4095)||!integer(quantity,1,999))throw Error('Choose an item and quantity.');
  steps.push({type:'item',operation:'give',itemId,quantity,notify:true});
 }else if(kind==='heal')steps.push({type:'heal'});
 else if(kind==='shop'){
  if(!Array.isArray(options.items)||!options.items.length||options.items.length>50||options.items.some(id=>!integer(id,1,4095)))throw Error('Choose 1–50 items.');
  steps.push({type:'shop',items:[...options.items]});
 }else if(kind==='pokemonGift'){
  if(!integer(options.species,1,8191)||!integer(options.level,1,100)||!integer(options.itemId??0,0,4095))throw Error('Choose a species, level and held item.');
  steps.push({type:'giveMon',species:options.species,level:options.level,itemId:options.itemId??0});
 }else throw Error('Unknown event template.');
 // The compiler exits on failed awards before later steps or completion.
 if(options.after)steps.push({type:'say',text:String(options.after)});
 if(kind==='itemPickup'&&!options.onceFlag)throw Error('Choose a saved flag so this pickup cannot repeat.');
 return {action:'sequence',trigger:'interact',enabled:true,blocksMovement:false,
  ...(options.onceFlag?{onceFlag:options.onceFlag}:{}),steps};
}
