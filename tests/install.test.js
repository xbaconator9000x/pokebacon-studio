import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../dist/install.js',import.meta.url),'utf8');
function setup({apple=false,standalone=false,page=false,native=false}={}){
 const handlers={},nodes={};
 const el=()=>({hidden:false,innerHTML:'',open:false,setAttribute(){},addEventListener(k,v){this[k]=v;},querySelector(s){return nodes[s]??=el();},showModal(){this.open=true;},close(){this.open=false;}});
 const link=el(),dialog=el(),landing=page?el():null;let redirected;
 runInNewContext(source,{matchMedia:()=>({matches:standalone,addEventListener(){}}),navigator:{userAgent:apple?'iPhone':'Android',platform:'',maxTouchPoints:0},window:{NativeBridge:native?{}:undefined,addEventListener(k,v){handlers[k]=v;}},location:{replace(v){redirected=v;}},document:{querySelector:()=>landing,createElement:()=>dialog,body:{append(){}},querySelectorAll:()=>[link]}});
 return{handlers,nodes,link,dialog,get redirected(){return redirected;}};
}
test('iPhone installation explains signing and shows manual Home Screen steps',async()=>{const s=setup({apple:true});await s.link.click({preventDefault(){}});assert.equal(s.dialog.open,true);assert.match(s.nodes['#installInstructions'].innerHTML,/Apple requires signing/);assert.match(s.nodes['#installInstructions'].innerHTML,/Add to Home Screen/);});
test('supported browser prompt is consumed once and cancellation allows fallback',async()=>{const s=setup();let calls=0;s.handlers.beforeinstallprompt({preventDefault(){},async prompt(){calls++;},userChoice:Promise.resolve({outcome:'dismissed'})});await s.link.click({preventDefault(){}});assert.equal(calls,1);await s.link.click({preventDefault(){}});assert.equal(calls,1);assert.equal(s.dialog.open,true);});
test('installed and native sessions hide install link; installed landing opens editor',()=>{for(const opts of [{standalone:true},{native:true}]){const s=setup({...opts,page:true});assert.equal(s.link.hidden,true);assert.equal(s.redirected,'./');}});
