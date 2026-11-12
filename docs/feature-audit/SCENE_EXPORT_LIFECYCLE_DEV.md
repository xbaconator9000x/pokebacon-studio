# Event-page repair, early ROM export gates and project-source recovery

Development integration evidence for PR #29. The working source version remains 4.72.7; this is **not** a signed or playable Shattered release.

## Newly implemented

1. **Nested page validation and atomic edits.** Imported event pages are scanned through up to eight levels of yes/no, then/else, cancel and custom-answer branches. Malformed action nodes, non-array branches, missing action types, malformed prerequisite records, invalid enabled values, duplicate page/action IDs and excessive depth/action budgets are reported for the explicit in-editor repair flow. Historical actions without IDs remain readable; existing valid pages remain unchanged.
2. **Failure-atomic page insertion.** A new page is validated against the entire existing page collection **before** committing. First-time conversion from one flat scene prepares its base page without changing the scene; a duplicate generated ID, invalid clone or invalid nested branch leaves the original steps intact.
3. **Mobile visual-scene list clarity.** The list now counts populated actions across event pages instead of incorrectly reporting zero after the flat action queue has been migrated. Malformed imported pages can still appear in the list for repair.
4. **Early native scene export preflight.** `buildRom` validates all enabled visual scenes on ROM-linked maps before allocating scripts, scanning source pointer graphs or compiling graphics. Errors identify **map / scene / field** and preserve the input project/source. Disabled and excluded maps are not required to be export-ready. Existing original-map enter/portal limitations are still enforced; no unsafe automatic map-script injections were added.
5. **Editable ROM sidecar recovery.** Corrupted gzip source snapshots now produce a clear error without overwriting the open project, rather than leaking an empty stream `TypeError`.

## New integration coverage

- `tests/scene-export-preflight.test.js`: nested corruption cases, explicit recovery atomicity, action ID collision refusal, 8-level depth limit, accurate scene summaries, enabled/disabled/excluded map scoping, native page prerequisite selection, and production `buildRom` preflight rejecting malformed input before source modification.
- `tests/scene-sidecar-roundtrip.test.js`: native GBA fixture with original NPC script, authored visual scene with highest-priority flag page, generated FRLG script bytes, original event-pointer replacement, editable source/quest/page JSON sidecar, compressed original source recovery, ROM reader reindexing and source identity across original/exported ROMs. Corrupted sidecar and unrelated ROM are rejected; multiple successive exports retain valid earlier source aliases.
- Existing `tests/native-story-coexistence.test.js` continues verifying two original NPCs sharing a script, visually authored replacement, direct same-root conflicts, native shared dialogue and byte-level reindex.

## Explicitly not proven yet

These tests compile/decode **synthetic ROM bytes** and exercise project/sidecar persistence. They do **not** run a retail/modded Pokémon engine, prove quest-save helper durability inside a live save, validate a private Shattered ROM, test all visual cutscene effects on a real GBA emulator, or confirm Android installation under the user's original signing key. Those are separate acceptance gates.

Original-map **enter** cutscenes remain intentionally gated: Gen III map-script transition/load handlers use an immediate script context and can deadlock if used for dialogue/waits. Safe enter cutscenes require a verified on-frame script/temporary-variable allocation that preserves existing original map scripts. This must be engineered before enabling the original-map trigger, rather than making a superficially successful but unsafe script patch.

See `EVENT_PAGES_INTEGRITY_DEV.md`, `SHARED_SCRIPT_COEXISTENCE_DEV.md`, and issues #15, #18, #14, #20.
