// Public source-project API. Existing callers retain their imports while the
// GBA implementation is owned by a platform runtime.
import { resolveSourceRuntime } from './platform-runtime.js';
export { sourceDigest, makeSourceSettings, validateSourceSettings, sourceChanges } from './gba-source-project.js';
import { sourceDigest, makeSourceSettings } from './gba-source-project.js';
import { normalizeSource } from './source-archive.js';
import { detectSourceEngine } from './source-features.js';
export function sourceInventory(files, engine = detectSourceEngine(files)) {
  return resolveSourceRuntime(engine).inspect(files);
}
export function prepareSourceExport(original, settings, project, options = {}) {
  return resolveSourceRuntime(settings?.engine).export(original, settings, project, options);
}
export async function importSourceEntries(entries, name) {
  const files = normalizeSource(entries), engine = detectSourceEngine(files);
  const runtime = resolveSourceRuntime(engine);
  const settings = makeSourceSettings(engine, 'source-' + await sourceDigest(files), name);
  return { files, settings, inventory: runtime.inspect(files) };
}
