# Development checkpoint — 31 October 2026

Development and testing were performed locally in ChatGPT. GitHub stores this branch; main/release remains unchanged. Removed the development-only Actions workflow because the requested role for GitHub is storage.

Implemented and locally verified:
- Events editor item pickup recipe, editable receipt/fanfare and persistent one-time flag; removed duplicate hard-coded gift receipt.
- Visual scene item actions now check add/remove success and stop before later actions/completion on failure. Give actions emit engine-specific receipt fanfare and wait for completion. A checkbox permits silent awards. FireRed and Emerald generated scripts compile locally.
- Sprite editor per-layer lock checkbox; move selected layer one pixel in four directions; flip/move respects locks and clothing silhouette clipping; undo/redo and save/reopen retain layer state. Animation delay is adjustable from 40 to 2000ms.
- New event recipe module added to offline cache. Development source fingerprints refreshed without changing release metadata or app identity.

Validation: 333 checks passed, 2 private/external-fixture checks skipped; local full-editor UI tests passed for event placement/save and sprite controls. These do not establish physical APK installation or emulator gameplay correctness. Test harness emits existing IIFE/import.meta warnings and an existing duplicate story label warning.

Remaining roadmap: full story/event-page upgrade, richer templates, sprite selection/clipboard and animation authoring, ability/move/species native coverage, dex authoring audit, UI customisation and full Cartographer integration. See STUDIO_UPGRADES.md and issue #15. These are not marked complete by this checkpoint.

Local test commands:
- npm test
- node scripts/qa-source-gate.mjs
- With MAP_STUDIO_QA_RUNTIME and MAP_STUDIO_BUILD_RUNTIME pointing to node_modules containing jsdom@26, fake-indexeddb, esbuild and @napi-rs/canvas: node scripts/test-event-template-ui.mjs and node scripts/test-sprite-layer-controls.mjs

## Reference and script-tree follow-up

Implemented tracing background visibility, independent X/Y/width/height, aspect-preserving resize, existing opacity/scale/drag controls, fit, removal and undo image rehydration. Added an independent comparison pane with image upload, pin-original-ROM-sprite/current-custom-sprite, sizing, hide/remove, and project-wide persistence across groups/views. Referenced assets survive project asset collection. Tracing/comparison references remain separate from sprite PNG/native pixel output and can be packaged as editable references. Reference data receives bounds/asset validation.

Added a read-only script tree of the actual nested first/repeat actions, including Yes/No, conditions, multiple answers and cancel branches. Clicking an action opens its editor; nested edits persist through scene/project save. Cyclic/oversized drafts are bounded safely. This is a navigation improvement, not the full event-page overhaul.

Local full-editor UI checks passed for reference import/size/visibility/removal/undo, comparison persistence, clean sprite PNG export, nested tree editing/save/reopen, and existing layer controls. 337 unit/regression checks passed, with 2 external-fixture skips. All 1,856 deployed source fingerprints passed locally. No release or main merge performed.
