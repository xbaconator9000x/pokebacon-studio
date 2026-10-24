import {clone,usedAssetIds,validateProject} from './model.js';

export const blobBytes=async blob=>new Uint8Array(await blob.arrayBuffer());
export function canvasBlob(canvas){return new Promise((resolve,reject)=>{
  try{canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not create the image. Try a smaller map.')),'image/png');}catch(error){reject(error);}
});}
export async function makePortableProject(project,lookup,{fetchAsset=fetch,readBlob,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
  const copy=clone(project),ids=usedAssetIds(copy);for(const a of copy.assets)ids.add(a.id);copy.assets=[];
  for(const id of ids){const a=lookup(id);if(!a)throw Error('A referenced image is missing: '+id);let data=a.data;
    if(!data){const response=await fetchAsset(a.src);if(!response.ok)throw Error('Could not load '+a.name+' for export.');data=await readBlob(await response.blob());}
    const embedded={...clone(a),data};delete embedded.src;copy.assets.push(embedded);if(copy.assets.length%8===0)await yieldTask();
  }
  copy.exportedAt=new Date().toISOString();validateProject(copy);return copy;
}
