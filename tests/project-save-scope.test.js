import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../dist/model.js';
import {captureEdit,finishEdit,applyEdit} from '../dist/edit-history.js';
import {SPLIT_PROJECT_SECTIONS,saveScopeForEdit,planSave,savedProjectKeys,assembleSavedProject} from '../dist/project-store.js';

for(const section of SPLIT_PROJECT_SECTIONS)test(section+' undo/redo persists existing split sections',()=>{
 const project=newProject();project[section]={auditValue:'Original'};
 let first=planSave(project),known=first.known;
 const storage=new Map(first.parts.map(part=>[part.id,structuredClone(part.value)]));
 const before=captureEdit(project);project[section]={auditValue:'Changed'};
 const edit=finishEdit(project,before);assert.equal(saveScopeForEdit(edit),null);
 for(const forward of [true,false,true]){
  applyEdit(project,edit,forward);
  const scope=saveScopeForEdit(edit),plan=planSave(project,scope||{all:true},known);known=plan.known;
  for(const part of plan.parts)storage.set(part.id,structuredClone(part.value));
  const reopened=assembleSavedProject(plan.header,savedProjectKeys(plan.header).map(key=>storage.get(key)));
  assert.deepEqual(reopened[section],project[section]);
 }
});
test('map-only strokes retain incremental saving and section removal requests full save',()=>{
 assert.deepEqual(saveScopeForEdit({root:[],maps:[{id:'map'}]}),{mapIds:['map']});
 assert.equal(saveScopeForEdit({root:[['sourceEngine',{},undefined]],maps:[]}),null);
});
