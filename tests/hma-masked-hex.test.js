import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticROM} from '../scripts/synthetic-map-rom.mjs';
import {newProject} from '../dist/model.js';
import {stageROMHex,parseMaskedHexSearch,findMaskedROMHex} from '../dist/native-hex-workspace.js';
const ID='d'.repeat(64),AT=0x7500;
function fixture(){
 const source=syntheticROM(),project=newProject();
 source.set([8,0x12,0x3f,0xff],AT);
 source.set([8,0x34,0x31,0xff],AT+6);
 source.set([8,0xab,0x30,0xff],AT+12);
 return {source,project};
}
test('masked hex parser supports exact, high/low nibble and whole-byte wildcards',()=>{
 const p=parseMaskedHexSearch('08 ?? 3? ?F');
 assert.deepEqual([...p.bytes],[8,0,0x30,0x0f]);
 assert.deepEqual([...p.masks],[255,0,240,15]);
 assert.deepEqual([...parseMaskedHexSearch('0x08, A?; ?f').masks],[255,240,15]);
 for(const input of ['', '?? ??','0','not hex','00 ?? 1','0xGG','00'.repeat(257)]){
  assert.throws(()=>parseMaskedHexSearch(input),undefined,input);
 }
});
test('mask search checks staged byte changes without mutating source ROM',()=>{
 const {project,source}=fixture(),original=source.slice();
 const pattern=parseMaskedHexSearch('08 ?? 3? FF');
 let report=findMaskedROMHex(project,ID,source,pattern,{from:AT,maxScan:17});
 assert.deepEqual(report.hits,[AT,AT+6,AT+12]);
 stageROMHex(project,ID,source,AT+8,Uint8Array.of(0x40));
 report=findMaskedROMHex(project,ID,source,pattern,{from:AT,maxScan:17});
 assert.deepEqual(report.hits,[AT,AT+12]);
 stageROMHex(project,ID,source,AT+1,Uint8Array.of(0xab));
 report=findMaskedROMHex(project,ID,source,parseMaskedHexSearch('08 AB ?? FF'),{from:AT,maxScan:17});
 assert.deepEqual(report.hits,[AT,AT+12]);
 assert.deepEqual(source,original);
});
test('bounded scans return a resume offset without skipping overlap candidates',()=>{
 const {source,project}=fixture(),pattern=parseMaskedHexSearch('08 ?? 3? FF');
 const first=findMaskedROMHex(project,ID,source,pattern,{from:AT,maxScan:6,limit:16});
 assert.deepEqual(first.hits,[AT]);assert.equal(first.scanned,6);assert.equal(first.nextFrom,AT+6);
 const second=findMaskedROMHex(project,ID,source,pattern,{from:first.nextFrom,maxScan:7,limit:16});
 assert.deepEqual(second.hits,[AT+6,AT+12]);assert.equal(second.nextFrom,AT+13);
 const capped=findMaskedROMHex(project,ID,source,pattern,{from:AT,maxScan:17,limit:1});
 assert.deepEqual(capped.hits,[AT]);assert.equal(capped.nextFrom,AT+1);
});
test('invalid masks and unreasonable limits fail with no side effects',()=>{
 const {source,project}=fixture(),before=JSON.stringify(project),pattern=parseMaskedHexSearch('08 ?? 3? FF');
 for(const options of [{from:-1},{from:source.length},{maxScan:0},{maxScan:1048577},{limit:0},{limit:33}]){
  assert.throws(()=>findMaskedROMHex(project,ID,source,pattern,options));
  assert.equal(JSON.stringify(project),before);
 }
 assert.throws(()=>findMaskedROMHex(project,ID,source,{bytes:Uint8Array.of(0),masks:Uint8Array.of(0)},{from:AT}));
});
test('actual Android hex workspace integrates bounded search, resume and jump controls',()=>{
 const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
 for(const marker of ['hmaMaskQuery','hmaMaskFind','hmaMaskNext','data-hma-mask-hit','parseMaskedHexSearch(','findMaskedROMHex(','Continue search'])assert.ok(ui.includes(marker),marker);
});
