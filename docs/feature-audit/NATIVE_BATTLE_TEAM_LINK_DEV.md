# Native trainer battle → source team editor

16 November 2026 · PR #29 · development-only

## Practical workflow

A visual Scene **Trainer battle** action now has a **View / edit this trainer’s Pokémon** control. It reads the entered numeric native trainer ID, retains unsaved battle introduction/defeat/local-ID fields, verifies the currently opened ROM matches the event map's original source ID, and opens the Game Workshop trainer editor for that exact source table entry.

The game editor resolves original game data through `gameContext`, checks the original source SHA-256 and verified trainer-table capability, checks original party flags, count, pointer alignment and levels/species, and rejects blank trainer slots and malformed staged teams. A successful team save records changes in the **source-hash-scoped** `project.romEdits`, not source ROM bytes. It returns to the original scene action; saving the scene is still an independent action. Cancel/Back returns through Android's existing modal history.

The user's existing trainer party controls (native item/move fields, party copy, reorder, duplicate) remain available. This is a navigational link, **not** a new battle engine or a shadow duplicate of the trainer database. Native `trainerbattle` scripts retain the original trainer ID and script-local parameter. If two trainers share an original party pointer, new party data is allocated and only the edited trainer's header receives the new pointer.

## Acceptance

Added tests for source-bound resolution, original/staged trainer identity, stale source fingerprints, unsupported/uninitialized tables, invalid staged teams, split project save/reopen, preserved original native trainerbattle parameters/text, independent party allocation and unchanged shared original bytes. UI wiring is also checked. Tests run in the project's real Node suite; an exact-head Android build and Chromium UI suite are required to pass separately before accepting this slice.

**Not proven:** actual win/loss/rematch behaviour, full physical device navigation, private Shattered gameplay, Flash cold restart, or every expanded-ROM variant. Preserve the original Android package ID `dev.shattered.mapstudio.next`, original release signing certificate, and current versionCode 148; no new APK is delivered by this PR batch. Do not publish ROMs, private projects, save data or signing secrets.

## Direct access from the native ROM story inspector

The **ROM story** inspector now exposes **Trainer team #ID** alongside the existing **Trainer sight & patrol** control. It inspects the reachable native `trainerbattle` commands from the currently selected original NPC entry and enables the link only for a **single unambiguous native trainer slot** (recognized standard variants 0/1, with pending safe command edits reflected). Ambiguous multiple trainer IDs, unsupported variants, non-NPC roots and structurally replaced flows do not expose a link.

Selecting it opens the same source-bound Game Workshop trainer editor without converting the original script to a visual scene. No trainer event bytes are modified by navigation. A saved party goes to the verified source-hash-scoped project edit record and requires native ROM export to play. The original event graph remains intact.

Additional tests cover original and patched native trainer IDs, multiple reachable battle slots, scene override refusal, non-NPC refusal and direct UI wiring. Both the scene action and original event paths therefore lead to the **same original team data**, not separate implementations.
