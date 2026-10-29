// Canonical attributes use stock FRLG bits 29..30. Native renderer and
// attribute getter are verified independently: CFRU uses bits 28..30, while
// older extended builds retain the stock two-bit getter. Never patch code.
const error=detail=>{throw Error('Unverified map-layer renderer: '+detail+'. No ROM was written.');};
export function detectLayerEncoding(reader){
 if(reader.engine!=='frlg')return{id:'standard',extended:false};
 let at=-1;
 for(const candidate of[0x5a9b4,0x5deb0])if(reader.u32(candidate)===0x1c0cb510&&reader.u32(candidate+4)===0x47084900){if(at>=0)error('multiple renderer hooks');at=candidate;}
 if(at<0)return{id:'standard',extended:false};
 const hook=reader.ptr(at+8),target=hook&~1;if(hook<0)error('invalid hook pointer');
 const valid=reader.u32(target)===0x0c120412&&reader.u16(target+4)===0x2804&&reader.u16(target+8)===0x0080&&reader.u16(target+12)===0x18c0&&reader.u16(target+14)===0x6800&&reader.u16(target+16)===0x4687;
 const ins=reader.u16(target+10);if(!valid||(ins&0xff00)!==0x4b00)error('unknown dispatcher');
 const literal=((target+14)&~3)+(ins&255)*4,table=reader.ptr(literal),normal=reader.u32(table),normalAlias=reader.u32(table+4),covered=reader.u32(table+8),triple=reader.ptr(table+12),split=reader.u32(table+16),base=0x08000000;
 if(table<0||normal!==base+at+0xb8||normalAlias!==normal||covered!==base+at+0x58||split!==base+at+0x1a||triple!==target+32||reader.u16(triple)!==0x481b||reader.u32(target+28)!==base+at+0x10b)error('dispatch arms differ from CFRU');
 const candidates=[];
 // Two original revisions keep their attribute getter literals at different
 // addresses. Validate the pointed-to mask and shift tables, not a game code.
 for(const ref of[0x58f40,0x5c414]){const masks=reader.ptr(ref),shifts=reader.ptr(ref+4);if(masks<0||shifts<0)continue;
  const prefix=[0x1ff,0x3e00,0x3c000,0xfc0000,0x7000000,0x18000000];if(!prefix.every((v,i)=>reader.u32(masks+i*4)===v))continue;
  const mask=reader.u32(masks+24),shift=reader.u8(shifts+6);if((mask===0x60000000&&shift===29)||(mask===0xe0000000&&shift===29)||(mask===0x70000000&&shift===28))candidates.push({mask,shift,ref});
 }
 if(candidates.length!==1)error('unknown attribute mask/shift');const{mask,shift,ref}=candidates[0],wide=(mask>>>shift)===7;
 return{id:shift===28?'cfru-extended-dispatch-3bit':wide?'frlg-extended-dispatch-3bit':'frlg-extended-dispatch-2bit',extended:true,nativeMask:mask,nativeShift:shift,foregroundNative:wide?4:1,hook:at,target,table,getterLiterals:ref};
}
export function nativeLayerValue(attribute,encoding){return encoding.extended?(attribute&encoding.nativeMask)>>> (encoding.nativeShift??29):attribute>>>29&3;}
export function decodeLayerAttribute(attribute,encoding){
 if(!encoding.extended)return attribute>>>0;const raw=nativeLayerValue(attribute,encoding);
 const type=raw===0?0:raw===2?1:raw===encoding.foregroundNative?2:raw===1?0:raw===3?3:null;
 if(type===null)throw Error('Unsupported extended native layer value '+raw+'.');
 return((attribute&~encoding.nativeMask)|(type*0x20000000))>>>0;
}
export function encodeLayerAttribute(attribute,encoding){
 if(!encoding.extended)return attribute>>>0;const type=attribute>>>29&3;
 return((attribute&~(encoding.nativeMask|0x60000000))|([0,2,encoding.foregroundNative,3][type]*2**(encoding.nativeShift??29)))>>>0;
}
