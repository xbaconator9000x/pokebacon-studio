/* Dedicated persistent project flags. No native story flag allocation.
 * The helper is verified against the stock profile and keeps its save data
 * with native saves, fresh boots, ownership conflicts and guard regions. Thumb code is position
 * independent; its sole build-time token literal is patched at byte 0xC0.
 */
import {STOCK_FIRE_RED_SHA,verifiedFRLGSource} from './verified-frlg.js';
export const QUEST_SOURCE_SHA=STOCK_FIRE_RED_SHA;
export const QUEST_SLOTS=1024;
export const newerQuestSource=()=>false;
export const verifiedQuestSource=hash=>verifiedFRLGSource(hash);
const HEX='0220274bf0b51a682649274b274c1b88098820808020c000834220d202291ed88020800482421ad32148824217d821488446214e10589444b04204d11f4817581f48874213d060461e4fd7190578002d05d10130b842f9d1002903d12180f0bc01bc00471348164d165014481550072001221840db0810338240634401290ad1197811430906090e19701b781a40531e9a412280e3e70229f7d119789143f3e708500003ba700302b8700302d070030200c003028c340000534d513190340000887766551c350000';
const installed=new WeakMap();
function integer(n,min,max,message){if(!Number.isInteger(n)||n<min||n>max)throw Error(message);return n;}
function slot(n){return integer(n,0,QUEST_SLOTS-1,'Choose a project quest slot from 0 to 1023.');}
function label(s){if(typeof s!=='string'||!/^@?[A-Za-z_][\w@]*$/.test(s))throw Error('A quest branch needs a valid script label.');return s;}
function checked(runtime){if(!runtime||!verifiedQuestSource(runtime.sourceSHA)||!Number.isInteger(runtime.entry)||(runtime.entry&1)!==1||runtime.entry<0x08000001||runtime.entry>=0x0A000000)throw Error('Install the verified project quest runtime first.');return runtime;}
export function installQuest(output,sourceSHA,projectToken){
 if(!verifiedQuestSource(sourceSHA))throw Error('The opened ROM needs a compatible project-save adapter for persistent quests and counters. Repeatable scenes without saved state remain available.');
 integer(projectToken,1,0xFFFFFFFF,'A project quest token must be an unsigned 32-bit integer greater than 0. Preserve it with your project.');
 if(!output||typeof output.allocate!=='function')throw Error('A ROM output allocator is required.');
 const prior=installed.get(output);if(prior){if(prior.token!==projectToken)throw Error('One ROM export cannot contain two different project quest owners.');return prior;}
 const bytes=Uint8Array.from(HEX.match(/../g),h=>parseInt(h,16)),view=new DataView(bytes.buffer);
 if(bytes.length!==200||view.getUint32(0xC0,true)!==0x55667788)throw Error('The project quest runtime template is invalid.');
 view.setUint32(0xC0,projectToken,true);const address=output.allocate(bytes,'Persistent project quest runtime');
 if(!Number.isInteger(address)||address<0x200||(address&3)||address+bytes.length>0x02000000)throw Error('Project quest code must be installed at a 4-byte-aligned ROM address.');
 const result=Object.freeze({address,entry:0x08000000+address+1,token:projectToken,sourceSHA,maxFlags:QUEST_SLOTS,saveBlock:1,savePointer:0x03005008,saveOffset:0x348C,saveLength:144});installed.set(output,result);return result;
}
// Result: 0 unset, 1 set, 2 storage conflict/invalid operation. Always branch out
// on 2; otherwise a bag reward could be granted without remembering the claim.
export function questReadSource(runtime,index,conflictLabel){checked(runtime);return ['setvar 0x8000 '+slot(index),'setvar 0x8001 0','callnative '+runtime.entry,'compare_var_to_value 0x800D 2','goto_if 1 '+label(conflictLabel)];}
export function questWriteSource(runtime,index,value,conflictLabel){checked(runtime);if(typeof value!=='boolean')throw Error('A project quest value must be true or false.');return ['setvar 0x8000 '+slot(index),'setvar 0x8001 '+(value?1:2),'callnative '+runtime.entry,'compare_var_to_value 0x800D 2','goto_if 1 '+label(conflictLabel)];}
export function questConditionSource(runtime,{index,isSet=true,yes,no,conflict}){if(typeof isSet!=='boolean')throw Error('Choose whether the project quest flag should be set or unset.');return [...questReadSource(runtime,index,conflict),'compare_var_to_value 0x800D '+(isSet?1:0),'goto_if 1 '+label(yes),'goto '+label(no)];}
export function questLogGuardSource(exitLabel){return ['special 0x187','compare_var_to_value 0x800D 2','goto_if 1 '+label(exitLabel)];}
