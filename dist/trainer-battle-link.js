// The trainer ID in a visual trainerbattle action is a slot in the opened
// source ROM. Never resolve it against a project-local trainer or another ROM.
import {editsFor} from './game-edits.js';
import {trainerPartySource,encodeTrainerParty} from './native-trainer-party.js';

export function inspectTrainerBattle(context,project,trainerId){
 if(!Number.isInteger(trainerId)||trainerId<1||trainerId>65535)
  throw Error('Choose a valid original ROM trainer ID (1–65535).');
 if(!context?.reader?.bytes||!context.profile||context.profile.capabilities?.trainers!==true||
    !context.data?.trainers||!context.hash||context.profile.sourceSha256!==context.hash)
  throw Error('Trainer teams are unavailable: open the original source ROM and verify its native trainer table first.');
 const profile=context.profile;
 if(trainerId>=profile.trainerCount||trainerId>=context.data.trainers.length)
  throw Error('Trainer '+trainerId+' is outside the verified source ROM trainer table.');
 const native=trainerPartySource(context.reader.bytes,profile,trainerId);
 if(!native.count)throw Error('Trainer '+trainerId+' is an unused source slot, not a playable native trainer team.');
 const source=context.data.trainers[trainerId];
 if(!source||source.id!==trainerId||!Array.isArray(source.party)||source.party.length!==native.count)
  throw Error('Trainer data does not match the original ROM table. Refresh the source before editing.');
 const patch=editsFor(project,context.hash)?.trainers?.[trainerId];
 const team=patch?{...structuredClone(source),...structuredClone(patch)}:structuredClone(source);
 // A previously staged edit can become invalid after a source refresh. Check
 // the whole output record before presenting that edit as a valid battle team.
 if(patch)encodeTrainerParty(context.reader.bytes,profile,trainerId,team);
 return{
  id:trainerId,sourceSha256:context.hash,sourceAddress:native.at,
  name:team.name,party:team.party,customMoves:!!team.customMoves,
  heldItems:!!team.heldItems,doubleBattle:!!team.doubleBattle,
  hasStagedEdits:!!patch,
  sourcePartyAddress:native.start,
  sourcePartyCount:native.count
 };
}
