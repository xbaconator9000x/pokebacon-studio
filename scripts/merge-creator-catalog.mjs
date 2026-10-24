import fs from 'node:fs';
export function mergeCreator(smart){
 const path='dist/assets/creator/catalog.json';if(!fs.existsSync(path))return smart;
 const creator=JSON.parse(fs.readFileSync(path));
 for(const key of ['assets','prefabs','rooms','buildings','interiorPlans','furnishingSets']){
  const incoming=creator[key]||[],ids=new Set(incoming.map(v=>v.id));smart[key]=[...(smart[key]||[]).filter(v=>!ids.has(v.id)),...incoming];
 }
 for(const c of creator.corrections||[]){const old=smart.prefabs.find(p=>p.id===c.id);if(old)Object.assign(old,{name:c.name,category:c.category,tags:c.tags,legacyNames:[...new Set([...(old.legacyNames||[]),...c.legacyNames])],legacyCategories:c.legacyCategories});}
 for(const path of ['dist/assets/interiors-v32/catalog.json','dist/assets/interior-templates-v32/catalog.json'])if(fs.existsSync(path)){const extra=JSON.parse(fs.readFileSync(path));for(const key of ['assets','prefabs','buildings','furnishingSets']){const entries=extra[key]||[],ids=new Set(entries.map(v=>v.id));smart[key]=[...(smart[key]||[]).filter(v=>!ids.has(v.id)),...entries];}if(extra.templates)smart.interiors=extra.templates.map(t=>({...t,sourceCode:'FRLG'}));}
 const landmarkRooms={'celadon-mansion':'celadoncity-condominiums-1f','celadon-game-corner':'celadoncity-gamecorner','celadon-prize-room':'celadoncity-gamecorner-prizeroom','cinnabar-lab':'cinnabarisland-pokemonlab-entrance','saffron-silph-tower':'silphco-1f','saffron-dojo':'saffroncity-dojo'};for(const [building,room]of Object.entries(landmarkRooms)){const t=smart.buildings.find(t=>t.id==='native-v32-building-'+building);if(t)t.interiorTemplateId='interior-v32-'+room;}
 smart.coverageNotes=creator.coverageNotes;return smart;
}
if(process.argv[1]?.endsWith('merge-creator-catalog.mjs')){const path='dist/assets/smart-catalog.json',smart=mergeCreator(JSON.parse(fs.readFileSync(path)));fs.writeFileSync(path,JSON.stringify(smart));console.log(JSON.stringify({objects:smart.prefabs.length,buildings:smart.buildings.length,themes:smart.rooms.length,sets:smart.furnishingSets.length}));}
