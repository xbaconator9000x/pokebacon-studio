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

## Sci-fi, Horror, Space and Technology vibes

Added all four to Quick Track and the general composition mood list. Original recipes use distinct scales, contours, rhythms, progressions and sound palettes: cold whole-tone electronic signals; Phrygian mansion/corridor suspense; sparse Lydian space atmosphere without percussion; Dorian sequencer/machine rhythms. They support existing whole/selected source arrangements, key/scale overrides and the existing composition/Atmosphere controls. Electronic/chip voices now carry appropriate General MIDI program metadata rather than defaulting to piano.

Local validation: 344 checks passed, 2 external-fixture skips. Full-editor source-song, multipart MIDI and mobile Quick Track UI checks passed. All four completed actual bundled contour + melody Hybrid inference, then compiled and rendered finite, non-silent PCM. New original arrangements and MIDI loop round trips were tested. No commercial API or GitHub execution was used. Inspirations describe mood/texture rather than copied melodies. The generic composition dependency test now allows percussion-free moods to omit unused drum samples.

### Hidden items and guarded passage templates

Added a nonblocking, once-per-save hidden-item tile interaction with the shared native receipt/fanfare; a reusable key-locked door that checks but retains its chosen item; and a Yes/No toll passage that checks funds before charging and travelling. Door destinations start unset and must be explicitly selected. All fields remain editable. Missing ROM metadata for item requirements now produces a clear error instead of a null-reference failure. These are script templates, not native hidden-item detector registration, animated doors, or respawn checkpoints.

Validation: all 350 tests completed (348 passed, 2 private/external-fixture skips); local editor placement, failed destination validation, destination picking, JSON/save and reopen passed for the new recipes. Key/toll scripts compiled for FRLG and RSE. Source fingerprint gate passed. No private ROM gameplay or physical APK test was performed. Main/release remain unchanged.

### Item map markers

Visible pickup recipes now carry a red Poké Ball editor marker. Hidden-item recipes and imported native hidden-item sign records use a dashed purple Poké Ball with a question mark. Legacy single-action tile pickups receive the visible marker; NPC gifts and quest rewards retain their normal markers. The event editor exposes an explicit marker override, preserved through JSON/save/reopen. Markers do not change native NPC graphics, hidden-item detector registration or gameplay visibility. Native visible item NPCs continue to use their imported sprite art.

Validation: 351 tests passed, 2 skipped; editor pickup/hidden-item appearance controls and save/reopen passed. Rendering uses a shared canvas function for editor and annotated-map export. Source gate passed.

### Sprite selection and clipboard

Added drag rectangle selection, select-all/deselect, active-layer copy/cut/paste/clear. Existing flips and one-pixel arrows now target the selected area when present, preserving surrounding pixels. Movement clamps at sprite edges. Pixel changes use existing undo/redo and project drafts; selection itself is temporary and resets when opening a frame. Clipboard persists during the workshop session across frames and requires matching palettes, avoiding index-colour corruption. Locked layers reject destructive operations; paste respects clothing silhouette clipping. Transparent pixels are included in a rectangular paste.

Validation: full suite 351 passed, 2 fixture skips. Local editor checks cover pointer selection, copy/paste, selected movement preserving outside pixels, cut/clear, undo/redo and saved-frame reopen. Existing locked-layer controls still pass. Source gate passed. No new ROM encoding format or native sprite-table changes.

### Large item cleanup navigation and bundled water brushes

Object/background cleanup now offers Move/pan, zoom in/out and Fit whole item. The initial view fits both dimensions; zoom preserves viewport centre. Pan drags scroll the viewport without touching the cleanup mask or history. Pixel hit testing continues to account for displayed scale.

Both bundled water study sheets were incorrectly treated as complete XP autotiles: one lacks a south water boundary, while the other's lower rows are land. Their stable-ID connected atlases now use the source water centre plus narrow, complete water-coloured contours instead of sampling land/empty rows. All 47 variants are opaque over the surf cell, and picker previews were regenerated. Original source sheets remain intact. The standard asset builder uses the corrected generation; repair-water-atlases.mjs rebuilds just these assets/previews. This intentionally replaces the flawed broad stone/land bank with a narrow water contour. Existing embedded/custom copies of old image data are not rewritten.

Validation: local large-object 512×768 fit/zoom/pan, bottom-right erase and undo passed. Both brush atlases checked for every pixel of all 47 masks, south-edge presence, reproducible output and water movement metadata. Full suite: 351 passed, 2 fixture skips. No running-ROM surf test or physical APK test. Main/release unchanged.

### Private installable development build 4.69.4

Prepared version 4.69.4/code 117 on request, using the original package and signing certificate. Recovered 4.69.2 native shell SHA-256 matches the reconciled source manifest's reference APK. Asset repack preserves native DEX/resources byte-for-byte, verifies the same signing certificate, zip alignment, version advance and all 1847 packaged web assets. Includes development changes through da492cab. Main, Pages and public releases remain unchanged. Physical device installation has not been tested.

APK SHA-256: `7f211c73e3bb0ddc46564ef3d1bcae469bcedf6a7661ccf517f970bced8c719d`. Signing secrets remain external to repository/output.

### Edit saved objects in place (private APK 4.69.5)

Placed-object artwork editing now resolves its existing prefab ID and updates that saved template instead of creating another template. Saving updates the selected placement's artwork/name while retaining its object ID, map position and collision setup. Other placements retain their prior artwork. The Objects library editor also preserves project-owned saved IDs, even before device-library migration. The Duplicate action remains separate. New objects acquire their saved prefab link after the first save.

Local actual SharedLibrary/editor checks: initial save, edit selected placement, edit saved template again, export/reopen; exactly one template and one placed object, stable IDs, position/collision retained. Large-item navigation checks still pass. Full suite 351 passed, 2 fixture skips. Private APK version 4.69.5/code 118; original Android package/certificate and native shell retained. Main/public release unchanged.
