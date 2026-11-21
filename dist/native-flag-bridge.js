// Engine-native Gen III flags are NOT PokéBacon quest/save allocations.
export function nativeFlagNumber(raw){
 const valid=typeof raw==='number'?Number.isInteger(raw):typeof raw==='string'&&/^(0|[1-9][0-9]*)$/.test(raw);
 const id=Number(raw);
 if(!valid||id<0||id>65535)throw Error('Choose a source-ROM flag ID from 0 to 65,535 (decimal original ROM flag). This is not a project quest flag.');
 return id;
}
export function nativeFlagSource(action){
 return (action.value===false?'clearflag ':'setflag ')+nativeFlagNumber(action.nativeFlagId);
}
export function applyNativeFlagPreview(action,flags){
 const id=nativeFlagNumber(action.nativeFlagId),next=new Set(flags||[]);
 if(action.value===false)next.delete(id);else next.add(id);
 return next;
}
