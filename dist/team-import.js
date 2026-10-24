// Strict subset of Showdown text; unsupported mechanics are reported, never discarded.
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
export function parseTrainerTeam(text,data){
 const entries=String(text).trim().split(/\n\s*\n/).filter(Boolean);if(!entries.length||entries.length>6)throw Error('Import one to six Pokémon, separated by blank lines.');
 const find=(key,name)=>{const row=data[key].find(r=>norm(r.name)===norm(name));if(!row||!row.id)throw Error('Unknown '+key+': '+name);return row.id;};
 const team=entries.map((block,i)=>{
  const lines=block.split('\n').map(s=>s.trim()).filter(Boolean),header=lines.shift().replace(/\s*\([MF]\)$/,'');const [mon,held]=header.split(/\s+@\s+/),species=mon.match(/\(([^)]+)\)$/)?.[1]||mon;
  let automatic=false;const row={species:find('species',species),level:5,ivQuality:0,heldItem:held?find('items',held):0,moves:[]};
  for(const line of lines){if(/^Moves:\s*Automatic$/i.test(line)){automatic=true;continue;}if(line.startsWith('- ')){if(row.moves.length===4)throw Error('Pokémon '+(i+1)+' has more than four moves.');row.moves.push(find('moves',line.slice(2)));}else if(/^Level:\s*\d+$/i.test(line)){row.level=+line.split(':')[1];if(row.level<1||row.level>100)throw Error('Levels must be 1–100.');}else if(/^IV Quality:\s*\d+$/i.test(line)){row.ivQuality=+line.split(':')[1];if(row.ivQuality>255)throw Error('IV quality must be 0–255.');}else throw Error('Unsupported trainer field: '+line+'. Native trainer data cannot preserve this field.');}
  if(automatic&&row.moves.length)throw Error('Choose automatic moves or explicit moves, not both.');if(!row.moves.length&&!automatic)throw Error('List at least one move for each Pokémon.');while(row.moves.length<4)row.moves.push(0);return row;
 });if(team.some(m=>m.moves.some(Boolean))&&team.some(m=>!m.moves.some(Boolean)))throw Error('This native trainer format needs either explicit moves for the whole party or automatic moves for the whole party.');return team;
}
export function exportTrainerTeam(party,data){const name=(k,id)=>data[k].find(r=>r.id===id)?.name||String(id);return party.map(m=>name('species',m.species)+(m.heldItem?' @ '+name('items',m.heldItem):'')+'\nLevel: '+m.level+'\nIV Quality: '+m.ivQuality+'\n'+((m.moves||[]).some(Boolean)?m.moves.filter(Boolean).map(id=>'- '+name('moves',id)).join('\n'):'Moves: Automatic')).join('\n\n');}
export function parseEncounterTable(text,kind,data){
 const lines=String(text).trim().split('\n').map(s=>s.trim()).filter(Boolean);if(lines.length!==kind.count+1||!/^Rate:\s*\d+$/i.test(lines[0]))throw Error('Use Rate: N followed by '+kind.count+' rows: Species | minimum | maximum.');const rate=+lines.shift().split(':')[1];if(rate<0||rate>100)throw Error('Rate must be 0–100.');
 const slots=lines.map(line=>{const parts=line.split('|').map(s=>s.trim());if(parts.length!==3)throw Error('Use Species | minimum | maximum.');const species=data.species.find(r=>norm(r.name)===norm(parts[0]));const minLevel=Number(parts[1]),maxLevel=Number(parts[2]);if(!species?.id||!Number.isInteger(minLevel)||!Number.isInteger(maxLevel)||minLevel<1||maxLevel>100||minLevel>maxLevel)throw Error('Invalid species or level range: '+line);return{species:species.id,minLevel,maxLevel};});return{rate,slots};
}
export function exportEncounterTable(group,data){return 'Rate: '+group.rate+'\n'+group.slots.map(s=>(data.species.find(r=>r.id===s.species)?.name||s.species)+' | '+s.minLevel+' | '+s.maxLevel).join('\n');}
