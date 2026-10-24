const objects=[
 {id:'emerald-route120-puddle',name:'Emerald · Route 120 rain puddle',src:'assets/objects/emerald-route120-puddle.png',width:32,height:32,tileSize:16,category:'Objects · Ground details'},
 {id:'studio-puddle-blue',name:'Legacy · Shallow blue puddle',src:'assets/objects/studio-puddle-blue.png',width:32,height:16,tileSize:16,category:'Objects · Ground details'},
 {id:'studio-puddle-mud',name:'Legacy · Muddy puddle',src:'assets/objects/studio-puddle-mud.png',width:32,height:16,tileSize:16,category:'Objects · Ground details'},
 {id:'studio-puddle-small',name:'Legacy · Small rain puddle',src:'assets/objects/studio-puddle-small.png',width:16,height:16,tileSize:16,category:'Objects · Ground details'}
];
export const EXTRA_ASSETS=[...objects,
 {id:'emerald-puddle-terrain',name:'Emerald · Connected rain puddles',src:'assets/objects/emerald-puddle-terrain.png',width:128,height:96,tileSize:16,category:'Smart terrain'},
 {id:'emerald-puddle-preview',name:'Emerald rain puddles preview',src:'assets/objects/emerald-puddle-preview.png',width:96,height:64,tileSize:16,category:'Terrain previews'}
];
export const EXTRA_PREFABS=objects.map(a=>({id:a.id,name:a.name,category:a.id.startsWith('emerald')?'Ground details · Hoenn puddles':'Ground details · Legacy puddles',tags:['puddle','rain','wet','water','walkable','shallow','ground',...(a.id.startsWith('emerald')?['hoenn','ruby','sapphire','emerald','route 120','fortree']:[])],assetId:a.id,sx:0,sy:0,sw:a.width,sh:a.height,w:a.width/16,h:a.height/16,collisionChoice:'walk',source:a.id.startsWith('emerald')?'Pokémon Emerald · original Fortree / Route 120 pixels':'Shattered Studio original artwork'}));
export const EXTRA_TERRAINS=[{id:'emerald-puddle-terrain',assetId:'emerald-puddle-terrain',name:'Emerald · Rain puddles',category:'Water · Walkable puddles',tags:['puddle','rain','wet','hoenn','ruby','sapphire','emerald','route 120','fortree'],locations:['Route 120','Fortree'],movementMode:'walk',paintLayer:'details',preview:'assets/objects/emerald-puddle-preview.png',source:'Pokémon Emerald · Fortree; connected joins composed from original bank pixels'}];
