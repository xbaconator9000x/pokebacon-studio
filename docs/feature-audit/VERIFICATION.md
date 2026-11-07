# Verification, scope and unfinished research

Latest continuation: [4.72.7 batch and exact limits](DELIVERY_4_72_7.md), including
the actual 4.72.6 CI failures and their repairs. Those failures were not failures
of the earlier locally reported unit/browser tests; neither result substitutes
for the other environment.

Current candidate: [4.72.6 delivery evidence](DELIVERY_4_72_6.md). Source
reconciliation, mobile browser workflow checks, native wardrobe/data fixtures
and original-certificate packaging are completed for that test update. Earlier
counts and open reconciliation findings below are historical evidence for
their named commits. They do not override the newer candidate report.

## Inspected baseline

Editor code: PR #19 at 57fde6d, built on the existing 4.70.5 development shell. The preceding 402b020 implementation passed 385 tests (two optional skips), source parity, unsigned Android compilation, existing UI checks and iOS simulator/unsigned device builds. Those are historical results, not automatic acceptance of this batch.

12 upstream trees were cloned read-only and pinned in upstream-evidence.json. Selected core source, interpreter/compiler/model files and licence files were inspected. CUBHMA was subsequently identified through GitHub repository search: canonical kcradi/CUBHMA, fork parent/source HMA, retained MIT licence and selected implementation delta verified. No upstream application was compiled or interactively reviewed, and no upstream code/art was copied into the editor in this batch.

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
98-record inventory/evidence validation also pass. Implementation commit
255759a14d1cfa190d5ff641386b5ed5fa5c4b32 passed all three jobs in
[QA run 42229902586](https://github.com/xbaconator9000x/pokebacon-studio/actions/runs/42229902586):
source parity, portable/UI (including the new four-engine IndexedDB checks),
and unsigned Android source build. That run validated the initial 89 records;
the nine additional CUBHMA records are a documentation-only follow-up checked
locally. iOS run 42229902583 was still running when recorded; no result assumed.

Open tests: Android process death/quota/storage, actual browser-worker timeout/race, interrupted native export, private Shattered gameplay and later-source reconciliation. These remain open even if the automated suite passes.

## Research not yet complete

Delivered-source follow-up: recovered the 4.72.5/code-145 APK and 4.72.3 source archive. Byte comparison against 630d1b7 identifies 1,795 identical, 47 differing and 11 delivered-only assets; 21 Git-only dependencies also require preservation. The source archive retains stale 4.69.3 package/Android metadata. See DELIVERED_SOURCE_RECONCILIATION.md and its reproducible hash report. Recovery is no longer blocked on locating these artifacts; integration remains open. Application assets were not replaced by the trial comparison.

- CUBHMA: identity/licence/fork and selected source comparison completed; interactive workflows, expanded-engine fixture execution and per-component dependency review remain outstanding. CUBE migration/recompression is not established as compatible with Shattered.
- Advance Map: official workflow documentation reviewed; source reuse rights not established.
- RPG Maker XP: proprietary editor not source-audited; command/page semantics compared through inspected Essentials code and official documentation.
- HMA/Porymap/Pixelorama/LibreSprite/Tiled: source review completed for listed components, but interactive usability and full advanced feature coverage need targeted follow-ups.
- LDtk, Godot/GDevelop, specialist font/UI/battle-animation tools and supplementary audio tools: named source-level follow-ups.
- Detailed licence review is per copied component, not “GitHub repository is public”. Engine data/assets and third-party tool dependencies have independent rights.

## What was not claimed

No record is marked fully_verified for a complete native gameplay workflow. No Android physical test, current private Shattered ROM acceptance, arbitrary custom code editing, delivered APK integration, DS implementation or automatic development daemon is claimed. Future sessions follow the roadmap and existing GitHub tracking.

Reconciliation slice validation: 399 tests passed, zero failed, two optional skips (401 total); 1,864 deployed fingerprints and all 98 inventory records/12 upstream pins validate. Four new source-layout runtime tests exercise synthetic fixtures only. Full recovered editor UI, native compilation, physical Android and Shattered gameplay remain open.
