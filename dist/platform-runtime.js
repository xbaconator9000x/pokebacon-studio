import { adapterForSourceEngine, requireCapability } from './platform-adapters.js';
import { sourceInventory, prepareSourceExport, validateSourceSettings } from './gba-source-project.js';
import { detectSourceEngine } from './source-features.js';
import { sourceSpriteBytes, readRawSourceSprite } from './source-assets.js';

// Runtime registration is closed over trusted bundled implementations. A saved
// project never supplies executable plugins, commands, or codec module paths.
const runtimes = new Map(['pokefirered', 'pokeemerald', 'cfru', 'shiny'].map(engine => {
  const descriptor = adapterForSourceEngine(engine);
  const check = files => {
    if (detectSourceEngine(files) !== engine) throw Error('Attached engine differs from saved settings.');
  };
  return [engine, Object.freeze({
    descriptor,
    codecs: Object.freeze({ encodeSprite: sourceSpriteBytes, decodeSprite: readRawSourceSprite }),
    inspect(files) { check(files); return sourceInventory(files, engine); },
    validate(files, settings) {
      validateSourceSettings(settings);
      if (settings?.engine !== engine) throw Error('Source settings do not match the selected adapter.');
      check(files);
      return descriptor;
    },
    export(files, settings, project, options) {
      requireCapability(descriptor, 'sourceExport');
      validateSourceSettings(settings);
      if (settings?.engine !== engine) throw Error('Source settings do not match the selected adapter.');
      check(files);
      return prepareSourceExport(files, settings, project, options);
    },
  })];
}));

export function resolveSourceRuntime(engine) {
  const runtime = runtimes.get(engine);
  if (!runtime) throw Error('Unsupported source runtime: ' + engine);
  return runtime;
}
