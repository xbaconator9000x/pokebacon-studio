// Descriptors describe supported operations, not every workspace the app shows.
// Capabilities default to false: a family label cannot verify an arbitrary hack.
const sourceCapabilities = Object.freeze({
  project: true, inspect: true, validate: true, sourceExport: true,
  features: true, sprites: true, music: true, build: false,
});
const romCapabilities = Object.freeze({
  project: true, inspect: true, maps: true, tilesets: true, romExport: true,
  build: false, sourceExport: false,
});
const make = (id, value) => Object.freeze({
  id, ...value,
  capabilities: Object.freeze({ ...value.capabilities }),
  ...(value.externalBuild ? {externalBuild: Object.freeze({...value.externalBuild})} : {}),
});
const source = (engine, label, needsBaseRom = false) => make('gba-source-' + engine, {
  label, platform: 'gba', generation: 3, delivery: 'source', family: engine,
  capabilities: sourceCapabilities,
  externalBuild: {
    kind: needsBaseRom ? 'cfru-insertion' : 'decomp',
    helper: 'studio/build-source-project.py',
    requiresBaseRom: needsBaseRom, availableInApp: false,
  },
});
export const PLATFORM_ADAPTERS = Object.freeze({
  'gba-rom-frlg': make('gba-rom-frlg', {label: 'FireRed/LeafGreen ROM', platform: 'gba', generation: 3, delivery: 'rom', family: 'frlg', capabilities: romCapabilities}),
  'gba-rom-rse': make('gba-rom-rse', {label: 'Ruby/Sapphire/Emerald ROM', platform: 'gba', generation: 3, delivery: 'rom', family: 'rse', capabilities: romCapabilities}),
  'gba-source-pokefirered': source('pokefirered', 'FireRed decomp'),
  'gba-source-pokeemerald': source('pokeemerald', 'Emerald decomp'),
  'gba-source-cfru': source('cfru', 'Complete FireRed Upgrade', true),
  'gba-source-shiny': source('shiny', 'Shiny CFRU expansion', true),
});
export const sourceAdapterId = engine => 'gba-source-' + engine;
export const romAdapterId = engine => engine === 'frlg' ? 'gba-rom-frlg' : engine === 'rse' ? 'gba-rom-rse' : null;
export function getPlatformAdapter(id) {
  if (!Object.hasOwn(PLATFORM_ADAPTERS, id)) throw Error('Unsupported platform adapter: ' + id);
  return PLATFORM_ADAPTERS[id];
}
export function adapterForSourceEngine(engine) { return getPlatformAdapter(sourceAdapterId(engine)); }
export function adapterForRomEngine(engine) { const id = romAdapterId(engine); return id ? getPlatformAdapter(id) : null; }
export function supportsCapability(adapter, capability) {
  return !!adapter && Object.hasOwn(adapter.capabilities, capability) && adapter.capabilities[capability] === true;
}
export function requireCapability(adapter, capability) {
  if (!supportsCapability(adapter, capability)) throw Error((adapter?.label || 'This project') + ' does not support ' + capability + '.');
  return adapter;
}
export function projectAdapters(project) {
  const adapters = [];
  if (project?.sourceEngine?.engine) adapters.push(adapterForSourceEngine(project.sourceEngine.engine));
  for (const engine of new Set((project?.maps || []).map(map => map?.rom?.engine).filter(Boolean))) {
    const adapter = adapterForRomEngine(engine);
    if (adapter) adapters.push(adapter);
  }
  return adapters;
}
