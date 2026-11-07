import test from 'node:test';
import assert from 'node:assert/strict';
import {importSourceEntries, prepareSourceExport} from '../dist/source-project.js';
import {sourceBytes as b, sourceText as t} from '../dist/source-archive.js';
import {readSourceUILayouts} from '../dist/ui-source-layouts.js';

const windowSource = 'const struct WindowTemplate sWindows[] = {\n    { .tilemapLeft = 1, .tilemapTop = 2, .width = 10, .height = 8 },\n};\n';
function fixture(engine) {
  const files = new Map([['src/window.c', b(windowSource)], ['src/main.c', b('void main(void) {}')], ['include/global.h', b('')], ['data/layouts/layouts.json', b('{"layouts":[]}')]]);
  if (engine === 'pokefirered' || engine === 'pokeemerald') files.set('Makefile', b('ROM_NAME = ' + engine));
  else {
    files.set('README.md', b(engine === 'shiny' ? 'Shiny-Miner CFRU-expansion' : 'CFRU'));
    files.set('src/config.h', b(engine === 'shiny' ? '#define ENABLE_FOLLOWER_POKEMON\n' : '#define MEGA_EVOLUTION_FEATURE\n'));
    files.set('scripts/make.py', b('ROM_NAME="BPRE0.gba"'));
    files.set('hooks', b('original'));
    files.set('BPRE.ld', b('original'));
  }
  return files;
}

for (const engine of ['pokefirered', 'pokeemerald', 'cfru', 'shiny']) {
  test(`${engine}: registered runtime exports recovered source-window edits and rejects stale input`, async () => {
    const {files, settings} = await importSourceEntries(fixture(engine), 'Layout');
    assert.equal(settings.engine, engine);
    const slot = readSourceUILayouts(files, engine)[0];
    const edit = {...slot, tilemapLeft: 3, width: 8};
    const project = {authoring: {presentation: {sourceWindows: [edit]}}};
    const output = prepareSourceExport(files, settings, project);
    assert.equal(output.report.adapterId, 'gba-source-' + engine);
    assert.match(t(output.files.get('src/window.c')), /tilemapLeft = 3/);
    assert.match(t(output.files.get('src/window.c')), /width = 8/);
    assert.equal(t(files.get('src/window.c')), windowSource);
    assert.deepEqual(output.report.changes.map(row => row.path), ['src/window.c']);
    const reopened = await importSourceEntries(output.files, 'Reopened');
    assert.equal(readSourceUILayouts(reopened.files, engine)[0].width, 8);
    const stale = new Map(files);
    stale.set('src/window.c', b(windowSource.replace('width = 10', 'width = 9')));
    assert.throws(() => prepareSourceExport(stale, settings, project), /source changed/);
    assert.throws(() => prepareSourceExport(files, settings, {authoring: {presentation: {sourceWindows: [{...edit, width: 29}]}}}), /original tile allocation/);
    assert.equal(prepareSourceExport(files, settings, {}).report.changes.length, 0);
  });
}
