// Gen III trainer IDs and script-local IDs belong to the original ROM,
// not PokéBacon quest/save allocations.
function decimalId(value,min,max,label){
 const valid=typeof value==='number'?Number.isInteger(value):typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value);
 const id=Number(value);
 if(!valid||id<min||id>max)throw Error(label+' must be a decimal integer from '+min+' to '+max+'.');
 return id;
}
export const nativeTrainerId=value=>decimalId(value,1,65535,'Original ROM trainer ID');
export const nativeTrainerLocalId=value=>decimalId(value,0,65535,'Native trainer local ID');
export function nativeTrainerFlagSource(action){
 const id=nativeTrainerId(action.trainerId);
 return(action.value===false?'cleartrainerflag ':'settrainerflag ')+id;
}
export function applyNativeTrainerFlagPreview(action,flags){
 const id=nativeTrainerId(action.trainerId),next=new Set(flags||[]);
 if(action.value===false)next.delete(id);else next.add(id);
 return next;
}
