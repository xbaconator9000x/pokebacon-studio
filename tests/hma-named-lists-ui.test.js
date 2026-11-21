import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
test('native table presents optional source-backed list labels and still retains integer values',()=>{
 for(const key of ['hmaLabelTable','hmaEnumField','hmaEnumList','hmaEnumChoice','bindTableEnumList(','hmaListLabels(','data-enum-list'])assert.ok(ui.includes(key),key);
 assert.match(ui,/Use typed number above/);
 assert.match(ui,/labelMaps\.get\(f\.name\)/);
});
test('manual numeric entry is not overridden unless a named option is explicitly selected',()=>{
 assert.ok(ui.includes("labels.length&&$('#hmaEnumChoice').value!==''?$('#hmaEnumChoice').value:$('#hmaCellValue').value"));
 assert.ok(ui.includes('Unknown or duplicate HMA list definitions are not editable.'));
});
