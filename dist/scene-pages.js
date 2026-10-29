// Multi-page scene data is kept in the project sidecar, never inferred from an imported ROM.
// Later pages take precedence, like RPG Maker event pages. All pages share a native trigger
// and completion/repeat policy until engine-specific page adapters are implemented.
export const MAX_SCENE_PAGES = 16;

export function scenePages(runtime) {
  return Array.isArray(runtime?.pages) && runtime.pages.length ? runtime.pages : null;
}

export function enableScenePages(runtime, newId) {
  if (!runtime || runtime.action !== 'scene') throw Error('Only visual scenes can have event pages.');
  if (!scenePages(runtime)) {
    runtime.pages = [{
      id: newId(), name: 'Page 1', enabled: true, conditions: [],
      steps: runtime.steps || []
    }];
    // Do not keep a second, executable copy of the original actions.
    runtime.steps = [];
  }
  return runtime.pages;
}

export function addScenePage(runtime, newId, from = null) {
  const pages = enableScenePages(runtime, newId);
  if (pages.length >= MAX_SCENE_PAGES) throw Error('An event supports at most 16 pages.');
  const page = from
    ? {...structuredClone(from), id: newId(), name: from.name + ' copy'}
    : {id: newId(), name: 'Page ' + (pages.length + 1), enabled: true, conditions: [],
      steps: [{id: newId(), type: 'say', text: 'Hello there!', fit: true}]};
  pages.push(page);
  return page;
}

export function chooseScenePage(runtime, satisfies) {
  const pages = scenePages(runtime);
  if (!pages) return null;
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i];
    if (page.enabled !== false && (page.conditions || []).every(satisfies)) return page;
  }
  return null;
}

export function pageStructureIssues(runtime) {
  if (runtime?.pages === undefined) return [];
  if (!Array.isArray(runtime.pages) || !runtime.pages.length ||
      runtime.pages.length > MAX_SCENE_PAGES) return ['An event needs 1–16 pages.'];
  const ids = new Set(), errors = [];
  runtime.pages.forEach((page, i) => {
    const index = i + 1;
    if (!page || typeof page.id !== 'string' || !page.id.trim() || ids.has(page.id))
      errors.push('Page ' + index + ' has a missing or duplicate stable ID.');
    if (page?.id) ids.add(page.id);
    if (typeof page?.name !== 'string' || !page.name.trim() || page.name.length > 120)
      errors.push('Page ' + index + ' needs a name of 1–120 characters.');
    if (!Array.isArray(page?.conditions) || page.conditions.length > 32)
      errors.push('Page ' + index + ' has an invalid prerequisite list.');
    if (!Array.isArray(page?.steps) || !page.steps.length || page.steps.length > 256)
      errors.push('Page ' + index + ' needs 1–256 actions.');
  });
  return errors;
}
