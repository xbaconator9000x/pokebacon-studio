import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { newProject, validateProject } from '../dist/model.js';
import { planSave, savedProjectKeys, assembleSavedProject } from '../dist/project-store.js';
import { importSourceEntries, prepareSourceExport, sourceInventory } from '../dist/source-project.js';
import { resolveSourceRuntime } from '../dist/platform-runtime.js';
import { getPlatformAdapter, supportsCapability } from '../dist/platform-adapters.js';
import { sourceBytes as bytes, sourceText, readSourceZip } from '../dist/source-archive.js';
import { makeZip } from '../dist/zip.js';
import { makeSpriteGroup } from '../dist/sprite-workbench.js';

function fixture(engine) {
  if (['cfru', 'shiny'].includes(engine)) return new Map([
    ['README.md', bytes(engine === 'shiny' ? 'Shiny CFRU expansion' : 'CFRU')],
    ['scripts/make.py', bytes('# original build')], ['hooks', bytes('hooks')], ['BPRE.ld', bytes('linker')],
    ['src/config.h', bytes('#pragma once\n//#define FEATURE_ONE\n')],
    ['data/untouched.bin', Uint8Array.of(0, 255, 40, 9)],
  ]);
  return new Map([
    ['Makefile', bytes('ROM_NAME = ' + engine)], ['src/main.c', bytes('void main(void) {}')],
    ['include/global.h', bytes('')], ['data/layouts/layouts.json', bytes('{"layouts":[]}')],
    ['include/config.h', bytes('#ifndef CONFIG_H\n#define CONFIG_H\n//#define FEATURE_ONE\n#endif\n')],
    ['data/maps/Test/map.json', bytes('{"id":"MAP_TEST","events":[]}')],
    ['data/untouched.bin', Uint8Array.of(0, 255, 40, 9)],
  ]);
}

for (const engine of ['pokefirered', 'pokeemerald', 'cfru', 'shiny']) {
  test(engine + ': import, edit, split-save, reopen, ZIP export and reimport preserve data', async () => {
    const original = fixture(engine), originalCopy = structuredClone(original);
    const imported = await importSourceEntries(original, engine);
    const project = newProject('Lifecycle test');
    project.sourceEngine = imported.settings;
    project.maps[0].notes = 'Edited on Android';
    const feature = imported.inventory.features.find(row => row.name === 'FEATURE_ONE');
    project.sourceEngine.features[feature.id] = true;
    project.spriteStudio = { version: 1, groups: [makeSpriteGroup('Saved sprite')], palettes: [], drafts: {} };
    validateProject(project);
    const plan = planSave(project);
    const parts = new Map(plan.parts.map(part => [part.id, structuredClone(part.value)]));
    const storedHeader = structuredClone(plan.header), beforeHeader = structuredClone(storedHeader);
    const reopened = assembleSavedProject(storedHeader, savedProjectKeys(storedHeader).map(key => parts.get(key)));
    validateProject(reopened);
    assert.deepEqual(reopened, project);
    assert.deepEqual(storedHeader, beforeHeader);
    const result = prepareSourceExport(imported.files, reopened.sourceEngine, reopened);
    const zipped = new Uint8Array(await makeZip([...result.files]).arrayBuffer());
    const unpacked = await readSourceZip(zipped, { inflate: inflateRawSync });
    assert.deepEqual(validateProject(JSON.parse(sourceText(unpacked.get('studio/editor-project.pokebacon.json')))), reopened);
    const report = JSON.parse(sourceText(unpacked.get('studio/source-report.json')));
    assert.equal(report.adapterId, 'gba-source-' + engine);
    assert.equal(report.build.requiresBaseRom, ['cfru', 'shiny'].includes(engine));
    assert.equal(report.build.availableInApp, false);
    assert.deepEqual(report, result.report);
    assert.deepEqual(original, originalCopy);
    for (const [path, value] of original) if (path !== feature.path) assert.deepEqual(unpacked.get(path), value, path);
    assert.match(sourceText(unpacked.get(feature.path)), /^#define FEATURE_ONE/m);
    assert.equal((await importSourceEntries(unpacked, engine)).settings.engine, engine);
    assert.throws(() => sourceInventory(original, engine === 'pokeemerald' ? 'pokefirered' : 'pokeemerald'), /differs/);
    const runtime = resolveSourceRuntime(engine), group = makeSpriteGroup('Codec');
    group.views.front.frames[0][2] = 7;
    const raw = runtime.codecs.encodeSprite(group, 'front', 'graphics/test.4bpp', new Uint8Array(2048));
    assert.equal(raw[1] & 15, 7);
  });
}

test('capabilities fail closed for unverified features and inherited property names', () => {
  const adapter = resolveSourceRuntime('pokeemerald').descriptor;
  for (const capability of ['build', 'maps', 'trainers', 'uiTemplates', 'toString']) assert.equal(supportsCapability(adapter, capability), false);
  assert.throws(() => getPlatformAdapter('toString'), /Unsupported/);
  assert.throws(() => resolveSourceRuntime('nds-gen4'), /Unsupported/);
  assert.throws(() => assembleSavedProject({storageFormat:'split-v1', storageParts:{maps:['missing'],assets:[]}}, []), /missing/);
});
