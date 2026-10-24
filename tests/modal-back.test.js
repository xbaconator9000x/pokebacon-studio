import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';
test('nested dialogs retain live controls and hardware/Escape Back restore one level',()=>{
 const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),events={},els={};
 for(const id of ['dialog','dialogForm','dialogBody','dialogTitle','submitDialog','cancelDialog','dialogFooter','dialogBack','closeDialog'])els[id]={textContent:'',hidden:false,disabled:false,childNodes:[],className:'',classList:{remove(){}},replaceChildren(...nodes){this.childNodes=nodes;},addEventListener(type,fn){(events[type]??=[]).push(fn);}};
 let closes=0;const d=els.dialog;d.open=false;d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;closes++;queueMicrotask(()=>events.close?.forEach(fn=>fn()));};
 Object.defineProperty(els.dialogBody,'innerHTML',{set(value){this.childNodes=[{value}];}});
 const c=vm.createContext({$:s=>els[s.slice(1)],pointers:new Set(),modalHistory:[],dialogGeneration:0,replacingModal:false,cancelGesture(){},queueMicrotask,showError(){},window:{},sceneUI:null,romPlayer:null});
 vm.runInContext(source.slice(source.indexOf('function dialogSnapshot()'),source.indexOf('function field(')),c);
 vm.runInContext("modal('Root','root');modal('Child','child');modal('Grandchild','grandchild');",c);assert.equal(closes,0);assert.equal(c.modalHistory.length,2);
 const back=source.match(/window\.mapStudioBack=\(\)=>\{.*?\};/)[0];vm.runInContext(back,c);
 assert.equal(c.window.mapStudioBack(),true);assert.equal(els.dialogTitle.textContent,'Child');assert.equal(c.modalHistory.length,1);assert.equal(d.open,true);
 let prevented=false;events.cancel.forEach(fn=>fn({preventDefault(){prevented=true;}}));assert.equal(prevented,true);assert.equal(els.dialogTitle.textContent,'Root');assert.equal(d.open,true);assert.equal(closes,0);
});
