// Portable game-data edit sets: export the edits made against one ROM and
// review them against another (a new release, a different build) before
// applying. Each edit keeps the values it replaced, so a target ROM that still
// holds the original values takes the edit cleanly, one that already has the
// new values is left alone, and anything else is a conflict for the user.
export const EDIT_SET_FORMAT='pokebacon-edit-set';
const KEYS=['species','moves','items','trainers','encounters'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const field=(key,rec,f)=>key==='encounters'?rec.groups?.[f]:rec[f];
const record=(data,key,id)=>key==='encounters'?(data.encounters||[]).find(r=>r.key===id):(data[key]||[])[Number(id)];
export function buildEditSet(edits,data,{name='',sha256='',engine=''}={}){
 const entries=[];
 for(const key of KEYS)for(const [id,patch] of Object.entries(edits?.[key]||{})){
  const rec=record(data,key,id)||{},before={};
  for(const f of Object.keys(patch))before[f]=structuredClone(field(key,rec,f)??null);
  entries.push({key,id,label:rec.name||rec.key||'',after:structuredClone(patch),before});
 }
 return{format:EDIT_SET_FORMAT,version:1,name,created:new Date().toISOString(),source:{sha256,engine},entries,
  skipped:{sprites:edits?.sprites?.length||0,forms:edits?.forms?.length||0}};
}
export function parseEditSet(text){
 let set;try{set=JSON.parse(text);}catch{throw Error('That file is not a PokéBacon edit set.');}
 if(!set||set.format!==EDIT_SET_FORMAT||set.version!==1||!Array.isArray(set.entries))throw Error('That file is not a PokéBacon edit set.');
 if(set.entries.length>20000)throw Error('This edit set is too large.');
 for(const e of set.entries){
  if(!KEYS.includes(e.key)||typeof e.id!=='string'&&typeof e.id!=='number'||!e.after||typeof e.after!=='object'||Array.isArray(e.after)||!e.before||typeof e.before!=='object')throw Error('The edit set has a damaged entry.');
 }
 return set;
}
export function reviewEditSet(set,data,{profile,validate}={}){
 const rows=[];
 for(const e of set.entries){
  const row={key:e.key,id:String(e.id),label:e.label||'',status:'clean',fields:[],note:''};
  const rec=record(data,e.key,String(e.id));
  if(profile?.capabilities?.[e.key]===false){row.status='unsupported';row.note='This ROM cannot edit '+e.key+' yet.';rows.push({...row,after:e.after});continue;}
  if(!rec){row.status='missing';row.note='This ROM has no such record.';rows.push({...row,after:e.after});continue;}
  let conflict=false,changed=false;
  for(const f of Object.keys(e.after)){
   const t=field(e.key,rec,f)??null;
   if(same(t,e.after[f]))row.fields.push([f,'same']);
   else if(same(t,e.before[f])){row.fields.push([f,'clean']);changed=true;}
   else{row.fields.push([f,'conflict']);conflict=true;}
  }
  if(e.label&&rec.name!==undefined&&rec.name!==e.label&&e.after.name===undefined&&!conflict){conflict=true;row.note='This record is named "'+rec.name+'" here but "'+e.label+'" in the source ROM.';}
  row.status=conflict?'conflict':changed?'clean':'already';
  if(row.status!=='already'&&validate){const msg=validate(e.key,e.id,e.after);if(msg){row.status='unsupported';row.note=msg;}}
  rows.push({...row,after:e.after});
 }
 const count=s=>rows.filter(r=>r.status===s).length;
 return{rows,summary:{clean:count('clean'),already:count('already'),conflict:count('conflict'),unsupported:count('unsupported'),missing:count('missing')},skipped:set.skipped||{sprites:0,forms:0}};
}
// Edits to merge into the project: clean ones always, conflicts only when asked.
export function editsToApply(review,{includeConflicts=false}={}){
 const out={species:{},moves:{},items:{},trainers:{},encounters:{}};
 for(const r of review.rows){
  if(r.status==='clean'||(includeConflicts&&r.status==='conflict'))out[r.key][r.id]={...out[r.key][r.id],...structuredClone(r.after)};
 }
 return out;
}
export function mergeEdits(target,incoming){
 let n=0;
 for(const key of KEYS)for(const [id,patch] of Object.entries(incoming[key]||{})){target[key]??={};target[key][id]={...(target[key][id]||{}),...patch};n++;}
 return n;
}
