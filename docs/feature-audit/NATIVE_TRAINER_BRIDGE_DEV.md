# Native trainer script bridge — 14 November 2026

## Implemented on PR #29

The original Gen III `trainerbattle` **variant 1** with independently indexed intro/defeat text, valid trainer ID, original local ID and **post-battle pointer equal to the immediate script continuation** now converts into the existing editable Visual Scene battle action. Recompilation retains the original local parameter, including zero, rather than substituting the NPC object ID. Other trainer variants and nonlocal continuations deliberately remain native-only, preserving source bytes and semantics.

Original `settrainerflag` and `cleartrainerflag` now convert to a separate original-ROM trainer defeated-state action, distinct from PokéBacon project quest flags. The mobile editor supports trainer ID, intro/defeat text, original local-ID review and defeated/reset toggles; scene preview explicitly warns that battles are not simulated. Pure state preview models only explicit defeated-state commands, not winning a battle. Pages copied within the same NPC retain source-specific local IDs; cloned scenes for a different NPC drop them, including nested branches and page actions.

Synthetic native GBA event-table tests exercise read-only source preview, shared original NPC script preservation, imported local ID 0, text pointers, compilation, split project save/reopen, NPC-root repoint, native-byte reindex, nonlocal/unsupported variant refusal and editable trainer-flag commands.

## Deferred and not claimed

Actual trainer-party schema editing, NPC trainer sight/approach range, automatic rematch logic, Shattered/Team Rocket engine gameplay, real mGBA battle and save/cold-start persistence, physical Android acceptance, signing and full ROM reimport require separate evidence. No ROM, saves, signing keys or private assets were added.
