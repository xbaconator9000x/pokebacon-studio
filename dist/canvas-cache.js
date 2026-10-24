// Reset discarded canvases so their backing stores can be released immediately,
// including on WebViews where native allocations outpace JavaScript collection.
export function releaseCanvas(canvas){if(canvas&&typeof canvas.getContext==='function'){canvas.width=1;canvas.height=1;}}
export class CanvasCache extends Map{
 set(key,value){const old=super.get(key);if(old&&old!==value&&old.image!==value?.image)releaseCanvas(old.image);return super.set(key,value);}
 delete(key){const old=super.get(key);if(!super.delete(key))return false;releaseCanvas(old?.image);return true;}
 clear(){for(const value of super.values())releaseCanvas(value?.image);super.clear();}
}
