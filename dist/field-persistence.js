import {addQuestFlag} from './quest-model.js';
import {questReadSource,questWriteSource} from './quest-runtime.js';
export function configureFieldPersistence(project,o,enabled,{x=o.x,y=o.y}={}){
 o.permanent=!!enabled;if(!enabled)return;
 if(o.kind==='strength'){const m=project.maps.find(m=>m.fieldObjects?.includes(o));if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||!m||x>=m.width||y>=m.height)throw Error('Choose the solved boulder tile inside this map.');o.solvedPosition={x,y};}
 if(!o.completionFlag){const q=addQuestFlag(project,'Cleared: '+o.name);q.hidden=true;q.ownerId=o.id;o.completionFlag=q.id;}
}
export function fieldSlot(o,flags){const q=flags.find(q=>q.id===o.completionFlag);if(!q)throw Error('Save the permanent HM object again to reserve its state.');return q.slot;}
export function fieldWriteSource(o,context,conflict){if(!o.permanent)return[];return questWriteSource(context.questRuntime,fieldSlot(o,context.questFlags||[]),true,conflict);}
export function fieldRestoreSource(objects,context){const out=[];let i=0;for(const o of objects.values()){if(!o.permanent)continue;const next='@field_restore_'+i++;out.push(...questReadSource(context.questRuntime,fieldSlot(o,context.questFlags||[]),'@field_restore_end'),'compare_var_to_value 0x800D 0','goto_if 1 '+next);const p=o.kind==='strength'?o.solvedPosition:{x:1000,y:1000};if(!p)throw Error('Choose the solved position for this boulder.');out.push('setobjectxyperm '+o.localId+' '+p.x+' '+p.y,next+':');}return out.length?[...out,'@field_restore_end:']:[];}
export function completeFieldPreview(o,play){if(!o?.permanent)throw Error('Enable permanence on the target HM object first.');play.quests??=new Set();play.fieldPositions??=new Map();play.removedField??=new Set();play.quests.add(o.completionFlag);if(o.kind==='strength'){play.fieldPositions.set(o.id,{...o.solvedPosition});}else play.removedField.add(o.id);}
