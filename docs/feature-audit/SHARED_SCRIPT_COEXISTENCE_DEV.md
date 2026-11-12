# Native/script + visual-scene co-existence — development evidence

## Why this batch exists

A Gen III map can contain two different NPC event *entries* pointing to one original script. When a visual scene replaces one NPC, the other NPC still uses the original shared script. Previously the native-story exporter expanded shared-text/command impact up to every original event and refused the edit as soon as it encountered **any** authored replacement. That made non-conflicting edits unusable and blocked mixed visual/native event workflows.

## Correct ownership model

- A **native structural flow** controls one specific event entry pointer and conflicts with an active visual/authored replacement of the **same root**. The exporter still rejects this combination before it writes changes.
- Shared original **command, dialogue and movement data** can be updated while a different entry now points to an authored scene. Source bytes remain for other roots. Existing output-byte alias guards continue protecting overlapping writes.
- Disabled visual replacements and markers bound to a different original ROM do not claim the native root's pointer.
- Reports explicitly distinguish accepted coexistence from conflicts. No source event identifiers, map IDs, or original maps are renumbered.

## End-to-end bounded regression

`tests/native-story-coexistence.test.js` uses the existing `scripts/synthetic-map-rom.mjs` GBA fixture and an actual native event table with two NPC entries referencing the same original script. It models an authored visual script at a distinct ROM address, updates the first NPC's pointer, applies native shared-script changes through the production `installNativeStoryEdits` function, and reindexes the output with the actual `GbaMaps` and `indexNativeStory` readers.

Separate cases check:
1. Authored NPC replacement + native shared dialogue edit survives project-store round trip and native export/reindex, with source dialogue bytes preserved and the untouched NPC still using updated dialogue.
2. A conflicting original-root structural flow + authored replacement throws without changing the candidate output bytes.
3. Authored NPC replacement + a native structural flow for the **other** NPC + shared source dialogue are all preserved.
4. Disabled and different-ROM scenes do not falsely claim the source entry.

This is a **native-byte integration fixture**, not retail Pokémon engine execution or a Shattered runtime acceptance test. No private game data, ROM or certificate is included. Test status must be assigned from the exact-head GitHub QA result, not from this document alone.

## Outstanding next gates

- Test the same shared-root patterns on an authorized private Shattered ROM source and the current map/project backup, including real dialogue, quests, NPC appearance, save/reload and gameplay.
- Verify quest save owner tokens and completion behaviour in the engine; synthetic decoding cannot prove save-state persistence.
- Extend a safe read-only cross-map reference/ownership preview and multi-actor scene execution checks.
- Test the installable APK on a physical Android device with the existing signing identity.

Tracking: #15, #18, #14, #20. Development PR #29 is not a release.
