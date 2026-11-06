# Verification, scope and unfinished research

## Inspected baseline

Editor code: PR #19 at 57fde6d, built on the existing 4.70.5 development shell. The preceding 402b020 implementation passed 385 tests (two optional skips), source parity, unsigned Android compilation, existing UI checks and iOS simulator/unsigned device builds. Those are historical results, not automatic acceptance of this batch.

11 upstream trees were cloned read-only and pinned in upstream-evidence.json. Selected core source, interpreter/compiler/model files and licence files were inspected. No upstream application was compiled or interactively reviewed, and no upstream code/art was copied into the editor in this batch.

## Immediate implementation

The confirmed storage failure occurs because app.js dirtyEdit omitted sourceEngine and several other split sections when deciding whether undo/redo needs a full save. project-store.js now owns SPLIT_PROJECT_SECTIONS and saveScopeForEdit; app undo/redo uses that shared rule. The existing map-only storage fast path remains intentional and efficient.

Added verification:
- Ten unit/model cases: nine split-section history save/reopen checks and a map-only/deletion scope case. These generic section payloads test persistence, not game-data validity.
- scripts/test-project-storage.mjs: actual IndexedDB API through fake-indexeddb, using valid source settings for FireRed, Emerald, CFRU and Shiny.
- That script covers source-setting redo/undo/redo, structured-clone transaction failure retaining previous header/parts, and worker postMessage failure followed by transactional fallback.
- The same storage script is included in CI after the existing test runtime installation.
- No extra runtime or paid dependency is added to the app.

This batch's local results: npm test reports **395 passed, zero failed, two
optional fixture skips (397 total)**. The four-engine IndexedDB script and
89-record inventory/evidence validation also pass. CI results must be recorded
against the actual new commit after publication; previous green runs do not
certify it.

Open tests: Android process death/quota/storage, actual browser-worker timeout/race, interrupted native export, private Shattered gameplay and later-source reconciliation. These remain open even if the automated suite passes.

## Research not yet complete

- CUBHMA: canonical source/release identity, parent relationship, licence and delta unverified despite both search engines. Requesting a creator URL is appropriate if it cannot be independently located; do not invent compatibility or substitute HMA CE.
- Advance Map: official workflow documentation reviewed; source reuse rights not established.
- RPG Maker XP: proprietary editor not source-audited; command/page semantics compared through inspected Essentials code and official documentation.
- HMA/Porymap/Pixelorama/LibreSprite/Tiled: source review completed for listed components, but interactive usability and full advanced feature coverage need targeted follow-ups.
- LDtk, Godot/GDevelop, specialist font/UI/battle-animation tools and supplementary audio tools: named source-level follow-ups.
- Detailed licence review is per copied component, not “GitHub repository is public”. Engine data/assets and third-party tool dependencies have independent rights.

## What was not claimed

No record is marked fully_verified for a complete native gameplay workflow. No Android physical test, current private Shattered ROM acceptance, arbitrary custom code editing, delivered APK integration, DS implementation or automatic development daemon is claimed. Future sessions follow the roadmap and existing GitHub tracking.
