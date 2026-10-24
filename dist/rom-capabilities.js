import{readRegionMap}from'./region-map.js';
import{verifiedQuestSource}from'./quest-runtime.js';
import{discoverNewMapSupport}from'./rom-world.js';
import{discoverFieldGraphics}from'./field-profile.js';
export function romCapabilities(c){const p=c.profile,cap=p?.capabilities||{};let region=false;try{region=!!readRegionMap(c.reader,c.hash);}catch{}return[
 ['Map editing',true,'Native artwork, layers, collision and links'],
 ['Settlement / interior generation',true,'Included artwork works with any source or without a ROM'],
 ['Add native map banks',!!discoverNewMapSupport(c.reader),'Requires a recognised map-group accessor'],
 ['World map painting',region,'Verified world-map graphics and location table; Fly / spawn hooks are separate'],
 ['ROM dialogue',true,'Each source text and decoded pointer is checked before export'],
 ['Native sprites',!!c.sprites,'Requires validated sprite records'],
 ['Native NPC placement',!!discoverFieldGraphics(c.reader),'Requires the opened ROM’s graphics and palette tables'],
 ['Pokémon data',!!p&&cap.species!==false,'Verified species record layout'],
 ['Move data',!!p&&cap.moves!==false,'Verified move record layout'],
 ['Item data',!!p&&cap.items!==false,'Verified item names, prices and records'],
 ['Trainer teams',!!p&&cap.trainers!==false,'Verified party and trainer layouts'],
 ['Wild encounters',!!p&&cap.encounters!==false,'Verified encounter-table layout'],
 ['Repeatable event scenes',true,'Dialogue, paths, sound, fades and supported native actions'],
 ['Persistent project state',verifiedQuestSource(c.hash),'Saved quests / counters require a compatible save adapter']
 ];}
