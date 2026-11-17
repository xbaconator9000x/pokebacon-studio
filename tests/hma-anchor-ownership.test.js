import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHMAToml,importHMAToml,hmaMetadata} from '../dist/hma-table-workspace.js';

const anchor=(name,address,format='[id::]4')=>[
 '[[NamedAnchors]]',`Name = '''${name}'''`,`Address = 0x${address.toString(16)}`,`Format = '''${format}'''`
].join('\n');

test('ambiguous HMA names fail closed irrespective of case and retain unrelated anchors',()=>{
 const raw=[anchor('Species',0x4000),anchor('species',0x5000),anchor('Moves',0x6000)].join('\n');
 const result=parseHMAToml(raw);
 assert.deepEqual(result.anchors.map(a=>a.name),['Moves']);
 assert.equal(result.warnings.length,1);
 assert.equal(result.raw,raw);
});
test('ambiguous HMA source addresses fail closed even when names differ',()=>{
 const result=parseHMAToml([anchor('Species',0x4000),anchor('Moves',0x4000),anchor('Items',0x6000)].join('\n'));
 assert.deepEqual(result.anchors.map(a=>a.name),['Items']);
 assert.equal(result.warnings.length,1);
});
test('three-way conflict excludes all members and never restores an earlier definition',()=>{
 const result=parseHMAToml([anchor('A',0x4000),anchor('B',0x4000),anchor('A',0x6000),anchor('C',0x7000)].join('\n'));
 assert.deepEqual(result.anchors.map(a=>a.name),['C']);
 assert.equal(result.warnings.length,2);
});
test('HMA raw metadata persists across import and conflict review',()=>{
 const source=new Uint8Array(0x10000),project={};
 const raw=[anchor('Species',0x4000),anchor('species',0x5000),anchor('Moves',0x6000)].join('\n');
 const summary=importHMAToml(project,'source',source,raw);
 assert.equal(summary.anchors,1);
 assert.equal(summary.warnings,1);
 assert.equal(hmaMetadata(project,'source',source).raw,raw);
 assert.deepEqual(hmaMetadata(project,'source',source).anchors.map(a=>a.name),['Moves']);
});
