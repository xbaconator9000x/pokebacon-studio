import{uid}from'./model.js';import{createMovementQuery}from'./world-model.js';
export function addRegionLandmark(map,node,smart,{enabled=true,kind='auto'}={}){
 if(!enabled||node.kind!=='route')return null;
 if(!['auto','rest','lookout','grove','echo','beacon','none'].includes(kind))throw Error('Choose an included route landmark.');if(kind==='none')return null;
 const chosen=kind==='auto'?({forest:'grove',mountain:'lookout',underground:'echo',coastal:'beacon',snow:'rest',desert:'rest'}[node.biome]||'rest'):kind,
  target=map.generator.landscape.sideClearings?.[0]||map.generator.landscape.clearing||{x:map.width/2,y:map.height/2},query=createMovementQuery(map),walk=(x,y)=>x>2&&y>2&&x<map.width-3&&y<map.height-3&&!query(x,y).collision&&query(x,y).mode!=='water',
  options=[];
 for(let y=3;y<map.height-3;y++)for(let x=3;x<map.width-3;x++)if(walk(x,y)&&walk(x,y-1)&&walk(x,y+1)&&walk(x-1,y)&&walk(x+1,y)&&!map.objects.some(o=>x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.h)&&!(map.nativeAssemblies||[]).some(a=>x>=a.x-1&&x<a.x+a.w+1&&y>=a.y-1&&y<a.y+a.h+1))options.push({x,y,score:Math.abs(x-target.x)+Math.abs(y-target.y)});
 options.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);const p=options[0];if(!p)return null;
 const prefab=smart.prefabs.find(p=>p.id==='route-direction-sign'),asset=smart.assets.find(a=>a.id===prefab?.assetId);if(!asset)throw Error('The included route marker artwork is missing.');
 const names={rest:'Rest stop',lookout:'Highland lookout',grove:'Old grove',echo:'Echo chamber',beacon:'Coastal marker'},texts={lookout:'The ridge overlooks the country below.',grove:'An old tree grove. The air is still.',echo:'Every sound carries through the chamber.',beacon:'A marker above the tide line.'},steps=chosen==='rest'?[{type:'choice',text:'Rest here?',yes:[{type:'heal'},{type:'say',text:'Your Pokémon are rested.'}],no:[]}]:[{type:'say',text:texts[chosen]}];
 map.objects.push({id:uid(),assetId:asset.id,name:names[chosen],x:p.x,y:p.y-1,w:1,h:2,sx:prefab.sx||0,sy:prefab.sy||0,sw:16,sh:32,collisionChoice:'base'});
 const event={id:uid(),x:p.x,y:p.y,kind:'event',title:names[chosen],text:'',runtime:{action:'sequence',enabled:true,trigger:'interact',blocksMovement:true,steps}};map.markers.push(event);
 map.generator.landscape.landmark={kind:chosen,x:p.x,y:p.y,eventId:event.id};return{asset,approach:{x:p.x,y:p.y+1,label:names[chosen]}};
}
