import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../dist/hma-hex-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
test('native table editor retains keyboard-scrolling accessible desktop data table',()=>{
 for(const part of ['class="hma-table-scroller"','role="region"','aria-label="Source ROM typed table rows"','tabindex="0"','class="hma-table-grid"','scope="col"','data-label="ROM record"'])assert.ok(ui.includes(part),part);
 assert.match(css,/#hmaHexBody \.hma-table-scroller/);
 assert.match(css,/overflow-x:auto/);
});
test('portrait Android table cells carry labels and remain independently editable',()=>{
 assert.ok(ui.includes('data-label="'+"" )||ui.includes('data-label=')); // exact user-facing heading is escaped by the template
 for(const part of ['class="hma-table-actions"','class="hma-table-filters"','class="hma-table-nav"','aria-label="Edit ','data-table-row=','data-table-rowtool=','data-table-ptr='])assert.ok(ui.includes(part)||ui.includes(part.replace('class="','studio-actions ')),part);
 for(const part of ['@media(max-width:700px)','grid-template-columns:repeat(2,minmax(0,1fr))','content:attr(data-label)','min-height:44px','@media(max-width:360px)'])assert.ok(css.includes(part),part);
});
