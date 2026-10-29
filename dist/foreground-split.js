// A deliberate pixel selection, never colour/shape inference. All inputs survive
// in the layer decision history; the original asset remains in the project.
export function splitGroundPixels(original,floor,mask){
 if(original.length!==1024||floor.length!==1024||!Array.isArray(mask)||mask.length!==256||mask.some(v=>v!==0&&v!==1)||!mask.some(Boolean))throw Error('Select at least one foreground pixel and a 16 × 16 floor tile.');
 if(!mask.some((v,p)=>v&&original[p*4+3]))throw Error('Select visible foreground pixels.');
 const lower=new Uint8ClampedArray(original),upper=new Uint8ClampedArray(1024);
 for(let p=0;p<256;p++)if(mask[p]){const i=p*4;if(!original[i+3])continue;upper.set(original.slice(i,i+4),i);lower.set(floor.slice(i,i+4),i);}
 return{lower,upper};
}
export function installGroundSplit(project,map,index,split){
 if(!split||!Array.isArray(split.mask)||split.mask.length!==256||split.mask.some(v=>v!==0&&v!==1)||!split.mask.some(Boolean)||!split.floorSource)throw Error('Select foreground pixels and the floor beneath them.');
 const assets=[split.lowerAsset,split.upperAsset];
 for(const a of assets)if(!a||a.width!==16||a.height!==16||a.tileSize!==16||!/^data:image\/png;base64,/.test(a.data)||!a.id||project.assets.some(v=>v.id===a.id))throw Error('Invalid separated foreground artwork.');
 if(assets[0].id===assets[1].id)throw Error('Separated artwork needs distinct asset IDs.');
 const x=index%map.width,y=Math.floor(index/map.width);if((map.nativeAssemblies||[]).some(a=>a.overlay&&x>=a.x&&y>=a.y&&x<a.x+a.w&&y<a.y+a.h&&a.overlay.mask[(y-a.y)*a.w+x-a.x]))throw Error('This tile has a native object overlay. Edit its existing object mask before separating the ground.');
 const ground=map.layers.ground[index];if(!ground)throw Error('This tile has no ground artwork to separate.');
 project.assets.push(...structuredClone(assets));
 map.layers.ground[index]={a:assets[0].id,sx:0,sy:0,size:16,renderRole:'ground',...(ground.nativeRule?{nativeRule:structuredClone(ground.nativeRule)}:{})};
 map.objects.push({id:assets[1].id+'-object',assetId:assets[1].id,sx:0,sy:0,sw:16,sh:16,x:index%map.width,y:Math.floor(index/map.width),w:1,h:1,renderRole:'foreground',renderMask:[['foreground']],collisionChoice:'keep',foregroundSplit:true});
}
