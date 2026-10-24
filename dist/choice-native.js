// Exact FireRed-family adapter. Preserve all original menus; append owned IDs.
import {readAuthoring,sceneActions} from './authoring-model.js';
import {encodedText} from './item-maker.js';
import {STOCK_FIRE_RED_SHA} from './verified-frlg.js';
const TABLE=0x3fe494,COUNT=65,REFS=[0xa070c,0xa0b88];
export function installChoices(project,reader,hash,output){
 const profile=hash===STOCK_FIRE_RED_SHA?{table:4064432,refs:[641880,643028]}:null;
 const COUNT=profile?.count??65;
 const nativeTable=profile?.table??TABLE,nativeRefs=profile?.refs??REFS;
 const ids=new Map(),menus=new Map();for(const map of project.maps)for(const n of map.markers)if(n.runtime?.enabled!==false)for(const s of sceneActions(n))if(s.type==='answers'){
  if(!s.id)throw Error('An answer menu needs a stable action ID.');const labels=(s.choices||[]).map(c=>c.label);if(labels.length<2||labels.length>4||labels.some(t=>typeof t!=='string'||!t.trim()||t.length>24))throw Error('Use two to four answer labels, each at most 24 characters.');const key=JSON.stringify(labels);if(!menus.has(key))menus.set(key,{labels,id:COUNT+menus.size});ids.set(s.id,menus.get(key).id);
 }
 if(!menus.size)return{ids,reports:[]};if(!profile)throw Error('The opened ROM needs a compatible native answer-menu table adapter.');if(COUNT+menus.size>255)throw Error('At most 190 distinct custom answer menus fit this native engine.');
 for(const ref of nativeRefs)if(reader.u32(ref)!==0x08000000+nativeTable)throw Error('The native answer menu table reference changed.');
 for(let i=0;i<COUNT;i++){const at=nativeTable+i*8,list=reader.ptr(at),count=reader.u8(at+4);if(!count||count>32||!reader.valid(list,count*8))throw Error('The native answer menu table is invalid.');for(let j=0;j<count;j++)if(!reader.valid(reader.ptr(list+j*8),1)||reader.u32(list+j*8+4)!==0)throw Error('An original answer menu uses an unsupported callback.');}
 const bytes=new Uint8Array((COUNT+menus.size)*8);bytes.set(reader.bytes.subarray(nativeTable,nativeTable+COUNT*8));const v=new DataView(bytes.buffer);
 for(const {id,labels}of menus.values()){const rows=new Uint8Array(labels.length*8),rv=new DataView(rows.buffer);labels.forEach((text,i)=>rv.setUint32(i*8,0x08000000+output.allocate(encodedText(text),'Answer label'),true));v.setUint32(id*8,0x08000000+output.allocate(rows,'Custom answer choices'),true);v.setUint8(id*8+4,labels.length);}
 const table=output.allocate(bytes,'Expanded answer menus');for(const ref of nativeRefs)output.int(ref,0x08000000+table);return{ids,reports:[menus.size+' custom answer menus · original '+COUNT+' menus preserved']};
}
