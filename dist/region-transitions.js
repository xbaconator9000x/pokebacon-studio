import{MASKS}from'./smart-model.js';
export function regionSurface(node,profile,smart){
 const token={snow:'snow-1',desert:'desert-1'}[node.biome],asset=token&&smart.assets.find(a=>a.id==='smart-ekat-s-public-tiles-autotiles-'+token),full=MASKS.indexOf(255);
 return{asset:asset||null,tile:asset?{a:asset.id,sx:full%8*16,sy:Math.floor(full/8)*16,size:16}:{a:profile.terrain.floor,sx:0,sy:0,size:16}};
}
export function surfaceNodeAt(node,plan,x,y){
 if(node.biome==='underground')return node;const gx=node.worldX+x,gy=node.worldY+y,
  wx=gx+Math.sin((gy+plan.seed%97)/11)*3+Math.sin((gy-plan.seed%43)/23)*2,
  wy=gy+Math.sin((gx-plan.seed%71)/13)*3+Math.sin((gx+plan.seed%37)/29)*2,
  eligible=plan.nodes.filter(n=>n.biome!=='underground'),distance=n=>Math.max(n.worldX-wx,0,wx-(n.worldX+n.width))**2+Math.max(n.worldY-wy,0,wy-(n.worldY+n.height))**2,
  target=eligible.find(n=>wx>=n.worldX&&wy>=n.worldY&&wx<n.worldX+n.width&&wy<n.worldY+n.height)||eligible.sort((a,b)=>distance(a)-distance(b)||a.id-b.id)[0];
 return target||node;
}
// A single world-coordinate warp supplies the ground on both sides of every
// seam, including four-map corners. Roads use the same habitat choice.
export function blendRegionGround(map,node,plan,profile,smart){
 if(node.biome==='underground')return[];const assets=new Map(),surfaces=new Map(plan.nodes.map(n=>[n.id,regionSurface(n,profile,smart)]));
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const target=surfaceNodeAt(node,plan,x,y);if(target.biome===node.biome)continue;const surface=surfaces.get(target.id);if(surface.asset)assets.set(surface.asset.id,surface.asset);map.layers.ground[y*map.width+x]={...surface.tile};}
 return[...assets.values()];
}
export function regionPathAt(node,plan,profile,x,y){const biome=surfaceNodeAt(node,plan,x,y).biome,token={snow:'snow-3',desert:'desert-2'}[biome];return token?'smart-ekat-s-public-tiles-autotiles-'+token:profile.terrain.path;}
