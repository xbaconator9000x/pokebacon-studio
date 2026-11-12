# Native ROM event → visual scene conversion (bounded feature batch)

Source branch `development/studio-upgrades`, PR #29. Engine and runtime acceptance remain separate from editor fixture acceptance.

## Implemented workflow

Open **ROM Story**, import/index the source graph, select an original NPC/sign/step-trigger entry on a map already imported into the project and tap **Convert to visual scene**. The editor displays the exact convertible action list, verifies the original ROM event pin and source binding, and asks for explicit confirmation. Successful conversion retains the same event marker ID and ROM type/index/script origin, saves its new actions through the usual project history mechanism, and opens the standard Visual Scenes editor.

This is a conservative **one-entry replacement**, not a rewrite of other original scripts. Shared source scripts remain for any other NPCs and roots that still use them. Existing native-story exporter ownership checks still reject a native structural flow on the same entry.

## Supported native commands

- Original `msgbox` standard mode **6** and keep-open mode **4**, including source-linked dialogue/text edits. Visual dialogue now has a user-editable native message-box style and the compiler preserves the chosen mode.
- Simple source `message`/`messageautoscroll` dialogue and associated wait/close operations.
- Delays (1–36,000 frames), sound effect + optional `waitse`, background music with default continuation mode, and supported fade-screen modes.
- `nop` and standard global lock/release wrappers are handled as wrappers; the visual compiler supplies its own.
- Original NPC, sign and coordinate trigger entries; triggers become step scenes.

## Strict non-conversion cases

Native branching, calls, trainer battles, flag/variable writes, engine-native routines, unindexed or unresolved commands, unverified message styles, script loops, over-limit events, map entries, missing original map pin, already-authored event or a native structural flow are **refused** with a concrete reason. No script bytes or project data are changed by preview or rejected conversion. The original ROM remains the source for edit/export. A simple event with unsupported syntax stays in ROM Story instead of silently losing behaviour.

## Quest-state usage explorer

The Authoring **Flags & Counters** screen now shows reference counts and a per-state **Uses** button. It indexes project-scoped save flags/counters in scene prerequisites, event page priorities, nested yes/no/if/multichoice actions, repeat paths, one-time completion flags, arrival latches, linked event completion, visited maps, field object persistence and reserved counter storage bits. Each reference carries its map/event identity and can open the original scene for editing. The scanner is read-only and bounded; source ROM-native flags remain a separate namespace and are not rewritten or silently mapped into project quest slots.

## Verification and caveats

`tests/native-scene-import.test.js` exercises actual synthetic GBA event table pointers, graph indexing, native dialogue/SFX/timing/music/fade decoding, conversion preview/apply, project save/reopen, visual compiler output, exported ROM pointer replacement and native script reindex, with strict failure cases for unsupported instructions and already-owned event entries.

`tests/quest-reference-index.test.js` exercises linked multi-map page/branch/field/visit/counter references, disabled and damaged scene handling, bounded indexing, read-only behaviour and project-store round trips.

No private Pokémon Shattered ROM, GitHub signing key or GBA game asset is copied to the repository. Synthetic native-byte reindexing is not live GBA gameplay, nor is source Android compilation equivalent to installation under the user's original app signing identity. All retained feature inventory records remain **partial** until those acceptance gates pass.
