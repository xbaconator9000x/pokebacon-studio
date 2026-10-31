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

## Pokémon data workflow follow-up

Implemented and tested locally:
- Learnset authoring now matches the native form writer: 0–255 levels, level-0 evolution entries, and up to 256 moves. Added strict named/ID paste, stable level sorting and a four-move initial-level preview; evolution-only entries are reported separately. Invalid paste preserves the previous draft. Saved edits update already-queued form data.
- Dex-entry encoding status and an explicit text/unit preview (not a claim of native font/layout accuracy).
- Native ability workshop reachable from the Pokémon editor. Standalone ability saves validate rules before changing the project. Existing native bindings opened without the matching ROM get a clear guard; users can explicitly disable compilation to keep a design. No silent rebind or broken null-context access.
- Import the existing Pokémon data JSON format into a fresh sprite group. Stats, dex fields, learnset, evolution branches and rules are retained; native ability assignments are cleared and definition identities regenerated. Imported data is not automatically installed. Sprite pictures are not part of the data-only format.

Validation: 342 checks passed, 2 external-fixture skips. Real editor DOM tests passed locally for the Pokémon data workflow/import and ability design template/save/error handling. Prior reference, script-tree, event-template and sprite-layer UI regressions also passed in this run. All 1,857 deployed fingerprints passed. No supplied real-ROM fixture was used for new battle runtime or native form gameplay assertions.

The wider roadmap remains incomplete, including arbitrary custom move battle effects, additional evolution-method adapters, TM/tutor/egg compatibility editing, full event pages, in-game UI customisation and full Cartographer generation integration. These were not marked complete by the work above.
