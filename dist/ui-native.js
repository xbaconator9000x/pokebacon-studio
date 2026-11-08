// Conservative adapter: only a unique, complete pair of verified FRLG templates.
const SIGNATURE=[0,3,1,24,2,15,1,0,0,3,1,24,10,15,1,0];
export function discoverUIWindows(reader){
 if(reader.engine!=='frlg')return [];
 const hits=[];for(let at=512;at<=reader.bytes.length-16;at+=4)if(SIGNATURE.every((v,i)=>reader.bytes[at+i]===v))hits.push(at);
 if(hits.length!==1)return [];
 return ['New game menu','Continue menu'].map((name,i)=>({id:'main-menu-'+i,name,address:hits[0]+i*8,original:SIGNATURE.slice(i*8,i*8+8)}));
}
export function installUIWindows(project,reader,output){
 const edits=project.authoring?.presentation?.nativeWindows||[],slots=discoverUIWindows(reader),writes=[];
 for(const edit of edits){const slot=slots.find(s=>s.id===edit.id);if(!slot||JSON.stringify(edit.original)!==JSON.stringify(slot.original))throw Error('UI layout source changed. Reopen Native UI layouts.');
 const {x,y,width,height}=edit;if(![x,y,width,height].every(Number.isInteger)||x<1||y<1||width<1||height<1||x+width>29||y+height>19||width>slot.original[3]||height>slot.original[4])throw Error('Keep the window inside the screen and within its original tile capacity.');
 const bytes=Uint8Array.from(slot.original);bytes.set([x,y,width,height],1);writes.push({slot,bytes});}
 for(const {slot,bytes}of writes)output.write(slot.address,bytes);
 return writes.map(({slot})=>'UI layout: '+slot.name);
}
export function nativeUIEditor(api){return async()=>{try{
 if(!api.session())throw Error('Open the source ROM first.');const reader=api.session().reader,slots=discoverUIWindows(reader);if(!slots.length)throw Error('No verified menu layout adapter was found for this ROM.');
 const values=api.project().authoring?.presentation?.nativeWindows||[];
 api.modal('Native UI layouts',`<p>Move and resize verified game menu windows. Values are in 8-pixel tiles. Changes apply on ROM export.</p><details><summary>Help</summary><p>The frame must remain inside the screen. Larger windows require additional engine tile storage, so this adapter preserves each original capacity. Unrecognised engines are left untouched.</p></details>${slots.map(s=>{const v=values.find(v=>v.id===s.id)||{x:s.original[1],y:s.original[2],width:s.original[3],height:s.original[4]};return `<fieldset data-ui-slot="${s.id}"><legend>${s.name}</legend>${['x','y','width','height'].map(k=>`<label>${k}<input data-ui-field="${k}" type="number" min="1" max="28" value="${v[k]}"></label>`).join('')}</fieldset>`;}).join('')}`,()=>{
 const edits=slots.map(s=>{const e={id:s.id,original:s.original};document.querySelector(`[data-ui-slot="${s.id}"]`).querySelectorAll('[data-ui-field]').forEach(n=>e[n.dataset.uiField]=Number(n.value));return e;});
 const draft={authoring:{presentation:{nativeWindows:edits}}};installUIWindows(draft,reader,{write(){}});
 api.change(()=>{const p=api.project();p.authoring??={};p.authoring.presentation??={texts:{},scenes:[],playerLooks:[]};p.authoring.presentation.nativeWindows=edits;});api.toast('Native menu layouts saved.');},'Save layouts');
 }catch(e){api.error(e);}};}
