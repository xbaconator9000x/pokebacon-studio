# Development batch after 4.72.7 — verified native state reservations

Base: main at a1672ed9468deec4bb503eda1a48ee27eb641538. This is an **unreleased source-development batch** on development/studio-upgrades, not a signed APK or proven ROM gameplay feature.

## Scope

- Extend native state reference detection to edited imported commands, authored event flows, existing map-entry conditions, project-local names and prior claims.
- Allow the editor to reserve the first unclaimed flag/variable ID in an **explicitly source-verified, persistent range** of at most 256 IDs, subject to a required confirmation.
- Keep reservations project-local and persist them across save/reopen and native graph refresh; do not write to a ROM merely when a reservation is created.
- Add a phone-accessible reservation panel to the guided condition builder. Require full-ROM event indexing in the UI before reservations.
- Preserve existing 4.72.7 event pages, sprite/wardrobe fixes, all imported command bytes and unknown scripts.

## Why manual verification is required

A script graph cannot prove an unused engine-save ID: native assembly/C routines, opaque commands, custom engine extensions and incompletely indexed maps may also reference it. A verified source range is therefore an explicit precondition, not a guessed vanilla flag/variable band. A reservation is an ownership record, **not proof** that the engine's persistence or game logic supports the ID. The user must inspect their engine source/symbol manifest. These reservations do not write save data or execute in-game.

## Acceptance and limitations

| Stage | Evidence / scope |
| --- | --- |
| Import/inspect | Existing synthetic FRLG/RSE native-map fixtures; reference scanner inspects imported nodes, authored flows, map conditions and claimed names |
| Edit | Source-range validation; first-free allocation; claim metadata; existing guided condition path consumes claimed ID |
| Save/reopen | Project-store serialization and graph reindex coverage added to native-story-state regression |
| Native export/reimport | Test constructs a flag condition using a newly reserved ID and verifies both branches on fresh indexed native script bytes, using the existing test's command evaluator |
| Engine execute | **Not tested** in retail FireRed/Emerald or private Shattered; synthetic evaluator is not an emulator |
| Android source/package | CI to be checked at the exact feature head; physical install and original-key signature not included |
| Safety | Verified-range confirmation; bounded widths; no partial graph or command-limit index; duplicate exclusion; failure does not mutate graph |

Open work remains source-aware automatic range provisioning, shared cross-system reservation ownership with authored quests, unknown native code cross-references, engine save-slot proof, private-ROM execution, physical Android update and project retention. Do not mark EVT06 complete or silently claim game persistence.

Tracking: issue #15, EVT06 and #14 release gates. No paid services, ROM bytes, private project files or signing secrets are committed.
