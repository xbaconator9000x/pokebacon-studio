import{discoverGameData,readSpecies}from'./game-data.js';
const starterNames=new Set('BULBASAUR IVYSAUR VENUSAUR CHARMANDER CHARMELEON CHARIZARD SQUIRTLE WARTORTLE BLASTOISE CHIKORITA BAYLEEF MEGANIUM CYNDAQUIL QUILAVA TYPHLOSION TOTODILE CROCONAW FERALIGATR TREECKO GROVYLE SCEPTILE TORCHIC COMBUSKEN BLAZIKEN MUDKIP MARSHTOMP SWAMPERT'.split(' '));
const cache=new WeakMap(),types={meadow:[0,2],forest:[6,12,3],mountain:[5,4,1],underground:[5,4,3],snow:[15,11],desert:[4,5],coastal:[11,2],water:[11]};
export function nativeRegionRoster(reader,sourceId){
 if(!reader)return Promise.resolve(null);if(!cache.has(reader))cache.set(reader,(async()=>{const profile=await discoverGameData(reader,{sourceSha256:sourceId});if(!profile||profile.capabilities?.species===false)return null;const species=[];
  for(let id=1;id<profile.speciesCount;id++){const s=readSpecies(reader.bytes,profile,id);if(starterNames.has(s.name.toUpperCase())||s.catchRate<=3||!s.name.trim()||/^\?+$/.test(s.name)||s.stats.reduce((a,b)=>a+b,0)<100)continue;species.push(s);}
  const minimum=new Map();for(const s of species)for(const e of s.evolutions||[])if(e.method){const level=e.method===4?e.param:15;minimum.set(e.species,Math.max(minimum.get(e.species)||1,level));}return{species,minimum,profile};})().catch(e=>{cache.delete(reader);throw e;}));return cache.get(reader);
}
export function nativeHabitatPool(roster,biome,level){
 if(!roster)return null;const favoured=types[biome]||types.meadow,eligible=roster.species.filter(s=>(roster.minimum.get(s.id)||1)<=level&&s.baseExp<=90+level*4&&s.stats.reduce((a,b)=>a+b,0)<=340+level*6),match=eligible.filter(s=>s.types.some(t=>favoured.includes(t))),pool=match.length?match:eligible;
 return pool.length?pool.sort((a,b)=>favoured.indexOf(a.types.find(t=>favoured.includes(t)))-favoured.indexOf(b.types.find(t=>favoured.includes(t)))||a.id-b.id).slice(0,64).map(s=>s.id):null;
}
