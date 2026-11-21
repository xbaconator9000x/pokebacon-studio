import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedNumericHMATable} from '../dist/hma-table-workspace.js';

const anchor=(name,format,at)=>({name,format,at});
test('transitive HMA fixed-count links resolve explicit signed deltas without changing source',()=>{
 const source=[anchor('Base','[value.]10',0x100),anchor('Middle','[value:]Base+2',0x200),anchor('Final','[value::]Middle-1',0x300)];
 const table=fixedNumericHMATable(source[2],0x1000,{anchors:source});
 assert.equal(table.count,11);
 assert.equal(table.stride,4);
 assert.equal(table.linkedLength.verifiedBaseCount,10);
 assert.deepEqual(table.linkedLength.chain,[{anchor:'Middle',delta:2}]);
});
test('transitive HMA count links fail closed for cycles, missing sources and ambiguous names',()=>{
 const scenarios=[
  [anchor('A','[value.]B',0x100),anchor('B','[value:]A',0x200)],
  [anchor('A','[value.]Missing',0x100)],
  [anchor('A','[value.]B',0x100),anchor('B','[value:]4',0x200),anchor('B','[value.]5',0x300)],
  [anchor('A','[value.]B',0x100),anchor('B','[value:]10',0x10000)]
 ];
 for(const anchors of scenarios)assert.equal(fixedNumericHMATable(anchors[0],0x1000,{anchors}),null);
});
test('transitive links reject zero, negative and oversized derived counts',()=>{
 for(const suffix of ['Middle-3','Middle+999']){
  const anchors=[anchor('Base','[value.]2',0x100),anchor('Middle','[value:]Base',0x200),anchor('Final','[value::]'+suffix,0x300)];
  assert.equal(fixedNumericHMATable(anchors[2],0x1000,{anchors}),null);
 }
});
