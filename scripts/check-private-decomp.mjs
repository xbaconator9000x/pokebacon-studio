// Checks an open-source decomp build (pret/pokeemerald or pret/pokefirered) or
// any other ROM you supply. Usage: node scripts/check-private-decomp.mjs ROM.gba [trainerCount]
// Build the ROMs yourself from the open-source repositories; none are committed here.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GbaMaps} from '../dist/rom.js';
import {discoverGameData,readGameData,applyGameDataEdits} from '../dist/game-data.js';
import {RomOutput} from '../dist/rom-writer.js';
const [file,expectTrainers]=process.argv.slice(2);
if(!file){console.error('Usage: check-private-decomp.mjs ROM.gba [trainerCount]');process.exit(2);}
const reader=await new GbaMaps(new Uint8Array(fs.readFileSync(file))).discover();
const profile=await discoverGameData(reader,{sourceSha256:'check'});
assert.ok(profile,'game data tables found');
const caps=profile.capabilities;
console.log('engine',reader.engine,'species',profile.speciesCount,'moves',profile.moveCount,'items',profile.itemCount,'trainers',profile.trainerCount,caps);
const data=readGameData(reader.bytes,profile);
if(expectTrainers)assert.equal(profile.trainerCount,Number(expectTrainers),'trainer count');
let bad=0;for(const t of data.trainers)for(const m of t.party)if(!(m.level>=1&&m.level<=100&&m.species>=1&&m.species<profile.speciesCount))bad++;
assert.equal(bad,0,'every party member is plausible');
const out=new RomOutput(reader.bytes),edits={};
if(caps.species)edits.species={1:{stats:data.species[1].stats.map(n=>Math.min(255,n+1))}};
if(caps.moves)edits.moves={1:{power:Math.min(255,data.moves[1].power+1)}};
if(caps.items)edits.items={1:{price:data.items[1].price+1}};
if(caps.trainers){const t=structuredClone(data.trainers[5]);t.party[0].level=Math.min(100,t.party[0].level+1);edits.trainers={5:{party:t.party,customMoves:t.customMoves,heldItems:t.heldItems}};}
applyGameDataEdits(reader.bytes,profile,edits,out);
const back=readGameData(out.bytes,profile);
if(caps.species)assert.equal(back.species[1].stats[0],edits.species[1].stats[0]);
if(caps.moves)assert.equal(back.moves[1].power,edits.moves[1].power);
if(caps.items)assert.equal(back.items[1].price,edits.items[1].price);
if(caps.trainers)assert.equal(back.trainers[5].party[0].level,edits.trainers[5].party[0].level);
console.log('edits read back');
