// Explicitly reviewed HMA source-length dependency groups. A linked TOML
// count is a declaration about metadata, not proof of engine runtime usage.
// Groups are atomic, source-scoped, and refuse every omitted sibling.
import {hexState,stagedROMByte} from './native-hex-workspace.js';
import {hmaMetadata,tableDefinitions,fixedNumericHMATable} from './hma-table-workspace.js';
import {planSafeTableExpansion,validatedRepointSites} from './hma-pointer-navigation.js';
const identifier=s=>typeof s==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(s);
const saneCount=n=>Number.isInteger(n)&&n>=1&&n<=4096;
const groupKey=(anchor,baseNewCount)=>'hma-link-'+anchor+'-'+baseNewCount;
const named=arr=>new Set(arr.map(x=>x.tableId));
const shape=(entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry);
function rowBytes(project,id,source,table,size,seed){
 const original=table.stride*table.count,extra=size*table.stride;
 if(!Number.isInteger(size)||size<1||size>64||extra>65536)throw Error('Linked expansion permits 1–64 appended rows and 64 KiB per table.');
 const row=seed==='copy-last'?Uint8Array.from({length:table.stride},(_,i)=>stagedROMByte(project,id,source,table.address+original-table.stride+i)):new Uint8Array(table.stride);
 return Array.from({length:extra},(_,i)=>row[i%row.length]);
}
function checkSourceGroup(project,id,source,anchorName,tables){
 if(typeof anchorName!=='string'||!/^[a-zA-Z_][a-zA-Z0-9_.-]{0,119}$/.test(anchorName))
  throw Error('Choose an HMA source anchor with an explicit fixed row count.');
 const metadata=hmaMetadata(project,id,source),baseAnchors=metadata.anchors.filter(a=>a.name===anchorName);
 if(baseAnchors.length!==1)throw Error('Linked-table growth requires exactly one original HMA source count anchor.');
 const expected=[];
 for(const a of metadata.anchors){
  const decoded=fixedNumericHMATable(a,source.length,{anchors:metadata.anchors});
  if(!decoded)continue;
  if(a.name===anchorName||decoded.linkedLength?.anchor===anchorName)expected.push(decoded);
 }
 const base=expected.find(x=>x.name===anchorName);
 if(!base||base.linkedLength)throw Error('The source HMA anchor is not an unlinked fixed-count native table.');
 if(expected.length<2||expected.length>8)throw Error('Choose a fixed HMA anchor with 1–7 linked tables.');
 const byName=new Map(tables.map(t=>[t.name,t]));
 if(expected.some(t=>!byName.has(t.name))||tables.length!==expected.length)
  throw Error('Include every HMA table depending on this anchor; partial linked growth is unsafe.');
 for(const raw of expected){
  const table=byName.get(raw.name);
  if(!table||table.address!==raw.address||table.stride!==raw.stride||table.count!==raw.count||
     JSON.stringify(table.fields.map(f=>[f.name,f.type,f.offset]))!==JSON.stringify(raw.fields.map(f=>[f.name,f.type,f.offset]))||
     JSON.stringify(table.linkedLength||null)!==JSON.stringify(raw.linkedLength||null))
   throw Error('Linked HMA metadata and the saved native table layout disagree for '+raw.name+'.');
 }
 return{base,expected};
}
export function verifyLinkedExpansionGroups(project,id,source,queued,definitions=tableDefinitions(project,id,source)){
 const groups=new Map();
 for(const plan of queued)if(plan.linkedGroup){
  const g=plan.linkedGroup;
  if(!shape(g)||!identifier(g.id)||!identifier(g.baseTableId)||!['base','dependent'].includes(g.role)||
     !saneCount(g.baseNewCount)||!Array.isArray(g.members)||g.members.length<2||g.members.length>8||
     g.members.some(x=>!identifier(x))||new Set(g.members).size!==g.members.length||
     !g.members.includes(plan.tableId)||!g.members.includes(g.baseTableId))
   throw Error('Saved linked-table group metadata is invalid.');
  const key=g.id;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(plan);
 }
 for(const [key,plans]of groups){
  const basePlan=plans.find(p=>p.tableId===p.linkedGroup.baseTableId);
  if(!basePlan||basePlan.linkedGroup.role!=='base'||plans.length!==basePlan.linkedGroup.members.length)
   throw Error('Linked-table expansion group is incomplete; all source dependencies must be queued together.');
  const {members,baseTableId,baseNewCount}=basePlan.linkedGroup;
  if(basePlan.newCount!==baseNewCount||members.some(x=>!plans.some(p=>p.tableId===x))||
     plans.some(p=>p.linkedGroup.id!==key||p.linkedGroup.baseTableId!==baseTableId||
       p.linkedGroup.baseNewCount!==baseNewCount||JSON.stringify(p.linkedGroup.members)!==JSON.stringify(members)))
   throw Error('Linked-table expansion group counts or membership changed since review.');
  const baseTable=definitions.find(t=>t.id===baseTableId);
  if(!baseTable||baseTable.linkedLength)throw Error('Linked-table root must have a fixed original HMA count.');
  const tables=members.map(x=>definitions.find(t=>t.id===x));
  if(tables.some(x=>!x))throw Error('Linked-table schema is missing a reviewed source table.');
  checkSourceGroup(project,id,source,baseTable.name,tables);
  // Explicitly refuse dependencies that own bytes inside another member's
  // original table. Copying linked rows could otherwise preserve a stale
  // pointer, count, or instruction which the original graph still references.
  const originals=tables.map(t=>({start:t.address,end:t.address+t.stride*t.count}));
  for(const p of plans){
   const sourceSites=[...p.sites.map(at=>({start:at,end:at+4})),
    ...(p.linkedGroup.role==='base'?[{start:p.countSite,end:p.countSite+p.countWidth},
      ...(p.extraCountSites||[]).map(c=>({start:c.at,end:c.at+c.width})),
      ...(p.engineSites||[]).map(x=>({start:x.at,end:x.at+2}))]:[])];
   if(sourceSites.some(r=>originals.some(t=>r.start<t.end&&r.end>t.start)))
    throw Error('A linked HMA table contains an original dependency write site; pointer ownership is unresolved.');
  }
 for(const p of plans){
   const table=definitions.find(t=>t.id===p.tableId),isBase=p.tableId===baseTableId;
   if((isBase&&p.linkedGroup.role!=='base')||(!isBase&&p.linkedGroup.role!=='dependent'))
    throw Error('Linked expansion root/dependent roles are inconsistent.');
   if(!isBase&&(table.linkedLength?.anchor!==baseTable.name||
       table.linkedLength?.verifiedBaseCount!==baseTable.count||
       p.newCount!==baseNewCount+table.linkedLength.delta||
       p.countSite!==undefined||p.countWidth!==undefined||
       (p.extraCountSites||[]).length||(p.engineSites||[]).length))
    throw Error('Linked dependent count must derive from its original HMA anchor; do not invent a second count field.');
  }
 }
 for(const table of definitions.filter(t=>t.linkedLength)){
  const plan=queued.find(p=>p.tableId===table.id&&p.newCount!==undefined);
  if(plan&&!plan.linkedGroup)throw Error('Linked HMA tables cannot grow without a fully reviewed dependency group.');
 }
 return [...groups.keys()];
}
export function planLinkedTableExpansionGroup(project,id,source,{anchorName,newBaseCount,members,seed='copy-last'}={}){
 if(!['zero','copy-last'].includes(seed))throw Error('Choose zero-filled or last-row template.');
 if(!(source instanceof Uint8Array)||!Array.isArray(members)||members.length<2||members.length>8||!saneCount(newBaseCount))
  throw Error('Review 2–8 linked table definitions with a valid new base count.');
 if(!members.every(shape)||members.some(m=>!identifier(m.tableId)||!Array.isArray(m.sites))||
    named(members).size!==members.length)throw Error('Linked expansion members must name distinct native tables and their reviewed pointer users.');
 const all=tableDefinitions(project,id,source);
 const tables=members.map(m=>all.find(t=>t.id===m.tableId));
 if(tables.some(t=>!t))throw Error('A linked-table member is not a saved native table.');
 const {base}=checkSourceGroup(project,id,source,anchorName,tables);
 const leader=tables.find(t=>t.name===anchorName);
 if(!leader||leader.count!==base.count||newBaseCount<=leader.count||newBaseCount-leader.count>64)
  throw Error('The source HMA root needs 1–64 additional rows.');
 const groupId=groupKey(leader.id,newBaseCount),groupMembers=[leader.id,...tables.filter(t=>t!==leader).map(t=>t.id)];
 const ordered=[leader,...tables.filter(t=>t!==leader)];
 const current=hexState(project,id)?.repoints||[];
 if(current.length+ordered.length>32||current.some(p=>ordered.some(t=>p.tableId===t.id)))
  throw Error('Another queued expansion already owns one linked HMA table.');
 const snapshots=new Map(),groupRows=[];
 for(const table of ordered){
  const i=members.findIndex(m=>m.tableId===table.id),review=members[i],isBase=table===leader;
  const newCount=isBase?newBaseCount:newBaseCount+table.linkedLength.delta;
  if(newCount<=table.count||newCount>4096||newCount-table.count>64)
   throw Error('Linked table '+table.name+' exceeds its allowed native row growth.');
  const pointers=validatedRepointSites(project,id,source,table.address,review.sites,{length:table.stride*table.count});
  const extraBytes=rowBytes(project,id,source,table,newCount-table.count,seed);
  const role=isBase?'base':'dependent';
  if(!isBase&&(review.countSite!==undefined||review.countWidth!==undefined||
     review.engineSites?.length||review.extraCountSites?.length))
   throw Error('Dependent HMA table rows derive their count from the reviewed base anchor, not an invented literal site.');
  groupRows.push({tableId:table.id,address:table.address,length:table.stride*table.count,sites:pointers.sites,
    newCount,extraBytes,linkedGroup:{id:groupId,baseTableId:leader.id,baseNewCount:newBaseCount,
      members:groupMembers,role},
    ...(isBase?{countSite:review.countSite,countWidth:review.countWidth??2,
      extraCountSites:review.extraCountSites||[],engineSites:review.engineSites||[]}:{})});
 }
 // Leverage the existing guarded engine-site/count checks with a detached
 // project copy, before publishing anything to the live project history.
 const trial=structuredClone(project);
 for(const plan of groupRows){
  if(plan.linkedGroup.role==='base'){
   planSafeTableExpansion(trial,id,source,leader,plan.sites,{
     newCount:plan.newCount,countSite:plan.countSite,countWidth:plan.countWidth,
     seed,reviewedLinkedRoot:true,extraCountSites:plan.extraCountSites,engineSites:plan.engineSites
   });
   const planned=hexState(trial,id).repoints.at(-1);
   Object.assign(planned,{linkedGroup:plan.linkedGroup});
   plan.engineSites=planned.engineSites||[];
   plan.engineCode=planned.engineCode;
   plan.engineFamily=planned.engineFamily;
  }else hexState(trial,id).repoints.push(plan);
 }
 verifyLinkedExpansionGroups(trial,id,source,hexState(trial,id).repoints,all);
 // Commit all plans atomically. Failed pointer, count or dependency review
 // leaves the caller's project unmodified.
 project.hexStudio=trial.hexStudio;
 return{groupId,anchorName,baseOldCount:leader.count,baseNewCount:newBaseCount,
  tables:groupRows.map(x=>({id:x.tableId,newCount:x.newCount,oldCount:all.find(t=>t.id===x.tableId).count,updatedPointers:x.sites.length}))};
}
