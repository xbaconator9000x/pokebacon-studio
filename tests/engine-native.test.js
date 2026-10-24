import {readCries,installCries} from '../dist/cry-editor.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {engineDigest,installEngine} from '../dist/engine-install.js';import{identifyEngineProfile}from'../dist/engine-profiles.js';import{installQuest,verifiedQuestSource}from'../dist/quest-runtime.js';import{GbaMaps}from'../dist/rom.js';import{gameContext}from'../dist/game-runtime.js';import{applyGameDataEdits,readGameData}from'../dist/game-data.js';import{RomOutput}from'../dist/rom-writer.js';
const fixture=process.env.POKEBACON_ENGINE_ROM;
test('prepared engine exposes expanded tables, preserves trainer fields and recognises edited copies',{skip:!fixture},async()=>{
 const b=new Uint8Array(fs.readFileSync(fixture)),hash=await engineDigest(b),p=identifyEngineProfile(b,hash);assert.ok(p);assert.ok(verifiedQuestSource(hash));
 const r=new GbaMaps(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'Expanded FireRed');await r.discover();assert.equal(r.maps.length,425);const g=await gameContext(r);assert.equal(g.issues.length,0);assert.equal(g.data.species.length,1489);assert.equal(g.data.moves.length,992);assert.equal(g.data.abilities.length,317);assert.equal(g.data.items.length,814);assert.equal(g.data.trainers.length,743);assert.equal(g.sprites.speciesIds.length,1484);
 const cries=readCries(r,hash);assert.equal(cries.profile.count,1489);assert.equal(cries.rows.length,1463);assert.equal(cries.rows.find(c=>c.id===25).name,'Pikachu');
 const trainer=g.data.trainers.find(t=>t.customMoves&&t.heldItems&&t.party.length);assert.ok(trainer);const output=new RomOutput(b),party=structuredClone(trainer.party);party[0].level=42;
 applyGameDataEdits(r.bytes,g.profile,{species:{1:{abilities:[300,316],learnset:[{level:1,move:900},{level:5,move:991}]}},moves:{},items:{},trainers:{[trainer.id]:{party}},encounters:{}},output);
 const data=readGameData(output.bytes,g.profile);assert.deepEqual(data.species[1].abilities,[300,316]);assert.deepEqual(data.species[1].learnset,[{level:1,move:900},{level:5,move:991}]);assert.equal(data.trainers[trainer.id].party[0].level,42);for(const key of ['ability','nature','ivSpread','evSpread','teraType'])assert.deepEqual(data.trainers[trainer.id].party[0][key],trainer.party[0][key]);
 const editedHash=await engineDigest(output.bytes);assert.ok(identifyEngineProfile(output.bytes,editedHash));assert.ok(verifiedQuestSource(editedHash));const runtime=installQuest(output,editedHash,123);assert.equal(runtime.saveBlock,2);assert.equal(runtime.saveOffset,0xE20);
 const broken=output.bytes.slice();broken[p.anchors[0].at]^=1;assert.equal(identifyEngineProfile(broken,await engineDigest(broken)),null);
});
