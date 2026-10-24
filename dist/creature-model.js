import{studioData,nearestPixels,indexRGBA}from'./sprite-workbench.js';
export const ABILITY_TRIGGERS=['switch_in','turn_start','hit_received','move_used','turn_end'];
export const ABILITY_CONDITIONS=['always','hp_below','move_type','weather','status'];
export const ABILITY_EFFECTS=['damage_multiplier','heal_percent','stat_stage','status','weather'];
const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
export function validateCreature(c){
 if(!c||!['new','regional','alternate','evolution'].includes(c.category)||c.parent!==null&&c.parent!==undefined&&!int(c.parent,1,8191))throw Error('Choose a creature type and valid parent species.');
 for(const[k,len,a,b]of[['stats',6,1,255],['types',2,0,19],['abilities',3,0,1023]]){const arr=c[k];if(!Array.isArray(arr)||arr.length!==len||arr.some(v=>!int(v,a,b)))throw Error(k+' needs '+len+' valid values.');}
 for(const[k,a,b]of[['catchRate',0,255],['baseExp',0,65535],['friendship',0,255],['height',0,65535],['weight',0,65535]])if(!int(c[k],a,b))throw Error('Invalid '+k+'.');
 if(typeof c.description!=='string'||c.description.length>2048||String(c.dexCategory||'').length>12||String(c.nativeName||'').length>12)throw Error('Check the creature name, category and Pokédex description lengths.');
 if(!Array.isArray(c.learnset)||c.learnset.length>127||c.learnset.some(e=>!int(e.level,1,255)||!int(e.move,1,65534)))throw Error('Level-up moves need a level from 1–255 and a move ID.');
 if(!Array.isArray(c.evolutions)||c.evolutions.length>32||c.evolutions.some(e=>!['level','trade','item'].includes(e.method)||!int(e.target,1,8191)||!int(e.param,0,65535)||e.method==='level'&&!int(e.param,1,100)))throw Error('Check the evolution targets and requirements.');
 if(!Array.isArray(c.abilityDesigns)||c.abilityDesigns.length>32)throw Error('Use up to 32 custom ability designs.');
 for(const a of c.abilityDesigns){if(typeof a.id!=='string'||typeof a.name!=='string'||a.name.length>40||!a.name.trim()||String(a.description||'').length>1024||!Array.isArray(a.rules)||a.rules.length>32)throw Error('An ability design needs a name and up to 32 rules.');for(const r of a.rules)if(!ABILITY_TRIGGERS.includes(r.when)||!ABILITY_CONDITIONS.includes(r.condition)||!ABILITY_EFFECTS.includes(r.effect)||!Number.isFinite(r.value)||Math.abs(r.value)>10000||String(r.parameter||'').length>80)throw Error('An ability design rule is invalid.');}
 return c;
}
export function creatureDefaults(g){const c=g.creature??={};Object.assign(c,{category:c.category||'new',parent:c.parent??null,types:c.types||[1,1],stats:c.stats||[50,50,50,50,50,50],abilities:[...(c.abilities||[0,0]),0].slice(0,3),catchRate:c.catchRate??45,baseExp:c.baseExp??64,friendship:c.friendship??70,height:c.height??10,weight:c.weight??100,description:c.description||'',dexCategory:c.dexCategory||'',nativeName:c.nativeName||g.name.slice(0,12),learnset:c.learnset||[],evolutions:c.evolutions||[],abilityDesigns:c.abilityDesigns||[]});return c;}
export function formRecord(g,slot){const c=validateCreature(creatureDefaults(g));if(!c.parent)throw Error('Choose an existing parent before adding a native form.');return{slot,parent:c.parent,groupId:g.id,name:c.nativeName||g.name.slice(0,12),...(c.dexCategory?{category:c.dexCategory}:{}),dexText:c.description,stats:[...c.stats],types:[...c.types],abilities:[...c.abilities],height:c.height,weight:c.weight,catchRate:c.catchRate,friendship:c.friendship,baseExp:c.baseExp,learnset:structuredClone(c.learnset),evolutions:structuredClone(c.evolutions)};}
/** Installation always reads current group art; clothing stays editable in the project. */
export function formSpriteEdits(project,forms,readRecord){
 const groups=studioData(project).groups,edits=[],pixelsDone=new Set(),palettesDone=new Set();
 for(const f of forms){const g=groups.find(g=>g.id===f.groupId);if(!g)throw Error('A queued native form is missing its sprite group.');
  for(const role of['front','back','icon','overworld'])for(const female of[false,true]){
   const view=g.views[role];if(!view)continue;
   const kind=role==='icon'?'icon':role==='overworld'?'overworld':'mon',choice={kind,id:f.slot,side:role==='back'?'back':'front',female};let record;
   try{record=readRecord(choice);}catch(e){if(role==='overworld'||female)continue;throw e;}
   for(let i=0;i<record.frames.length;i++){
    const key=record.pixelRow+':'+i;if(pixelsDone.has(key))continue;pixelsDone.add(key);
    const frame=view.frames[Math.min(i,view.frames.length-1)];let pixels=nearestPixels(frame,view.width,view.height,record.width,record.height);
    if(role==='icon'){const rgba=new Uint8ClampedArray(pixels.length*4);for(let j=0;j<pixels.length;j++){const col=parseInt(g.normal[pixels[j]].slice(1),16);rgba.set([col>>>16,col>>>8&255,col&255,pixels[j]?255:0],j*4);}pixels=indexRGBA(rgba,record.palettes[0]).pixels;}
    edits.push({...choice,frame:i,pixels});
   }
   if(role==='icon')continue;
   for(const shiny of[false,true]){let r;try{r=readRecord({...choice,shiny});}catch{continue;}
    for(let i=0;i<r.palettes.length;i++){const key=r.paletteRow+':'+i;if(palettesDone.has(key))continue;palettesDone.add(key);edits.push({...choice,shiny,paletteFrame:i,palette:[...g[shiny?'shiny':'normal']],allowSharedPalette:true,detachPalette:true});}
   }
  }
 }
 return edits;
}
