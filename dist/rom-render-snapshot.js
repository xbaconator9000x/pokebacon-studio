// A single export transaction must pack and compile the same raster planes.
// Copy ImageData dimensions explicitly: they are prototype accessors in some
// canvas implementations and structuredClone alone can omit them.
const signature=map=>JSON.stringify({width:map.width,height:map.height,layers:map.layers,objects:map.objects,gates:map.gates,wallCells:map.wallCells,fieldObjects:map.fieldObjects,movement:map.movement,nativeAssemblies:map.nativeAssemblies,renderIntentVersion:map.renderIntentVersion,rom:map.rom});
function copyPlanes(planes){return Object.fromEntries(Object.entries(planes).map(([key,value])=>[key,value?.data?{width:value.width,height:value.height,data:new Uint8ClampedArray(value.data)}:structuredClone(value)]));}
export function createROMExportRenderSnapshot(renderMap){
 const cache=new Map();let released=false;
 return{
  async render(map,options={}){
   if(released)throw Error('This ROM export has finished. Start a new export.');
   const key=map.id+':'+JSON.stringify({openGates:[...(options.openGates||[])].sort(),extraAssets:options.extraAssets||[]}),stamp=signature(map);
   let entry=cache.get(key);
   if(entry&&entry.stamp!==stamp)throw Error(map.name+': artwork or movement changed during export. Compile again.');
   if(!entry){entry={stamp,planes:Promise.resolve(renderMap(map,options)).then(copyPlanes)};cache.set(key,entry);}
   return copyPlanes(await entry.planes);
  },
  release(){released=true;cache.clear();}
 };
}
