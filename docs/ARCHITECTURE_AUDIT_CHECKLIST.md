# Architecture audit and completion checklist

Audited 6 November 2026 against code in [commit 402b020](https://github.com/xbaconator9000x/pokebacon-studio/commit/402b0203735585403fbb312e798d13d453b87c50) and [PR #19](https://github.com/xbaconator9000x/pokebacon-studio/pull/19). Checked items mean implemented or verified on that branch; they do not mean merged, shipped in 4.72.5, or physically tested on Android.

## Completed and evidenced

- [x] Audit the current GBA binary/source, project, editor, asset and build boundaries. See ARCHITECTURE_GBA_FIRST_MULTI_PLATFORM.md.
- [x] Identify reusable project models, archive handling, sprite frame/palette models, interaction/history tools and source review/export.
- [x] Identify GBA-specific obstacles: pointers/allocation, 16-pixel tile assumptions, source paths/configuration, MP2K and GBA graphics formats.
- [x] Register FRLG and RSE binary descriptors and FireRed, Emerald, CFRU and Shiny source descriptors.
- [x] Route existing source import, inspection, validation and export through bundled platform runtimes.
- [x] Preserve existing public source-project API imports.
- [x] Route the binary ROM export family guard through adapter capabilities, retaining existing signature checks.
- [x] Make unknown capabilities and inherited property names fail closed.
- [x] Expose existing GBA sprite encode/decode functions through source runtimes.
- [x] Include engine-specific external build requirements in exported source reports.
- [x] Share split-storage key listing and reassembly between reopening and lifecycle tests without changing the saved format.
- [x] Exercise source import → edit → full split-save/reassembly → validate → ZIP export → embedded JSON reopen → reimport for FireRed, Emerald, CFRU and Shiny.
- [x] Check original source bytes, unrelated source map/binary files, stored headers and sprite groups in those full-save fixtures.
- [x] Add new modules to offline precaching.
- [x] Reconcile the development branch's 4.70.5 Android version with web/QA metadata and refresh 1,863 deployed fingerprints.
- [x] Commit implementation and open PR #19 against development/studio-upgrades.
- [x] Run full automated suite: 385 passed, zero failed, two optional fixture skips; 387 total.
- [x] Pass GitHub source-parity, portable/UI checks and unsigned Android compilation in QA run 42203796425.
- [x] Pass iOS simulator offline smoke test, screenshot collection, simulator packaging and unsigned device archive in run 42203796545.
- [x] Document initial DS integration research covering DSPRE, DS Map Studio, hg-engine, pret Gen 4 decomps, Frost's Gen 5 Editor, CTRMap CE and Gen 5 source projects.
- [x] Document future format/toolchain/licensing gates and staged DS integration work.
- [x] Keep this phase free of DS editing features, new dependencies and paid services.
- [x] Keep existing released APK and main branch untouched by this PR.

## Partial or outstanding

- [x] **P1 implementation: correct undo/redo save scope for all split sections.** Added shared section registry, ten model regressions and four-engine IndexedDB API tests in the feature-audit batch. Integration, release and physical-device proof remain open.
- [ ] Verify incremental saves, source-settings undo/redo, worker failure/retry and actual IndexedDB transaction round trips for each relevant project section. Current added tests cover pure reassembly/full saves.
- [ ] Reconcile these changes with the separately delivered 4.72.5 source/APK before preparing a newer signed release.
- [ ] Complete shared runtime ownership for binary ROM operations where useful during current GBA work. The binary guard uses descriptors; reader/writer implementation still contains FRLG/RSE branches.
- [ ] Add per-project/revision/extension capability refinement when implementing the corresponding GBA feature. Current descriptors are family-level; signature validation still supplies detailed checks.
- [ ] Verify signed Android installation/update, retained local projects and physical touchscreen use.
- [ ] Compile representative source engines into games and run FireRed/Emerald/Shattered emulator regressions. APK compilation is not game compilation.
- [ ] Review and integrate PR #19 after addressing findings and later-source reconciliation. It is currently open and unmerged.
- [ ] Complete per-component licence/dependency/pinned-revision review before any future DS reuse. Existing research is an initial survey, not clearance to copy code/assets.
- [ ] Implement future DS codecs/adapters only after the GBA roadmap permits it; deliberately deferred.

## Finding A: existing section changes can be omitted on incremental save

**Original audit status:** reproduced. **Subsequent feature-audit batch:** the undo/redo caller now requests a full save for every split-section change using shared saveScopeForEdit. Generic map-only saves still intentionally omit existing sections; callers must provide the proper scope. Ten model cases and four-engine IndexedDB API tests pass; physical-device acceptance is open.

1. Save a project with an existing sourceEngine section using planSave(project).
2. Persist copies of that plan's parts, as a storage transaction would.
3. Change sourceEngine.name.
4. Call planSave(project, {all:false, mapIds:[]}, firstPlan.known).
5. Apply its returned writes and reassemble the project from stored parts.

Observed: zero parts written; expected name “Changed”; reopened name “Original”.

In dist/project-store.js, planSave writes an existing section only when all is true or known.sections lacks that section. It does not compare section changes. In dist/app.js, dirtyEdit classifies only authoring, spriteStudio, romEdits and interiorTemplates as requiring full saves. Undo/redo of sourceEngine and other omitted root sections can therefore request a map-only save and leave the previously stored section intact.

Ordinary edits through change() request full saves. The confirmed gap concerns the incremental path and its undo/redo caller; it does not show that every save fails.

Recommended coherent fix batch: define shared section-save ownership, ensure undo/redo requests writes for affected sections, retain unchanged-section savings, and add failing-then-passing source/settings and other-section round trips through actual IndexedDB/worker paths. Test interrupted saves and retry before claiming complete data preservation.

## Other audit conclusions

- No broad rewrite is justified by the present evidence. The source runtime seam is useful; GBA-specific binary internals can continue moving incrementally.
- No visual controls changed in this batch. Existing iOS smoke-test artifacts show the existing editor; they are not evidence of a new mobile layout or an Android usability test.
- The lifecycle test map note “Edited on Android” is fixture text, not proof that a test ran on an Android device.
- Capabilities for source maps/events/trainers/UI-native editing are not registered. Their absence must not be confused with the separate binary/authoring workspace feature set.
- All recorded CI evidence belongs to commit 402b020. Documentation-only audit updates do not expand its tested functionality.

## Evidence

- [Architecture PR](https://github.com/xbaconator9000x/pokebacon-studio/pull/19)
- [Goal issue](https://github.com/xbaconator9000x/pokebacon-studio/issues/18)
- [QA run](https://github.com/xbaconator9000x/pokebacon-studio/actions/runs/42203796425)
- [iOS run](https://github.com/xbaconator9000x/pokebacon-studio/actions/runs/42203796545)
- dist/platform-adapters.js, dist/platform-runtime.js, dist/source-project.js, dist/gba-source-project.js
- dist/project-store.js, dist/app.js (dirtyEdit/undo/redo)
- tests/platform-lifecycle.test.js, tests/source-project.test.js, tests/stability.test.js

The architecture phase is **implemented and CI-verified on its branch, but not ready to call fully complete or shipped** while the preservation finding and release reconciliation remain outstanding.
