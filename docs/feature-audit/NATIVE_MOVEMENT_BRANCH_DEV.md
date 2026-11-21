# Native movement and original-engine flag branch conversion

Development branch: `development/studio-upgrades`, PR #29. This document describes editor-native-byte acceptance only; actual game engine and physical Android acceptance remain outstanding.

## New editable visual actions

**Native walking / facing:** `nativeMovement` stores a bound actor, 1–128 explicitly whitelisted movement instruction names and the original wait/nonblocking choice. The ROM Story converter resolves the original event's last-talked NPC (254), player (255) or other imported map-local NPC and reuses the original bytes decoded from the native movement pointer. It preserves varied movement speeds, facing and visibility in one script sequence rather than flattening them into an inaccurate single-speed drawn path. The visual editor provides a mobile-friendly multi-line movement editor, actor selector and wait toggle. The standard GBA compiler emits `applymovement`, the original movement names and a terminating `step_end`; `waitmovement` is emitted only when requested. Unknown bytecodes, malformed streams, dynamic unindexed actors and ambiguous waits are refused.

**Check original ROM flag:** `nativeFlagIf` stores an **original source-game 16-bit flag ID**, not a project quest flag. The importer recognizes **only** forward structured `checkflag / goto_if 1` if/else diamonds with one verifiable forward join. It translates both arm bodies into editable action branches, preserving further instructions after the join. Unsupported comparisons, native routines, loops, goto patterns or missing joins remain in ROM Story unchanged. The visual editor includes the raw flag number, Flag is set/Flag is clear branch editors, nested outline and a *separate* original-engine flag section in the state dependency explorer.

Native flag checks use `checkflag ID` plus an explicit `goto_if 1` branch in the compiled script; no local project save slot is allocated or remapped to the engine's flag ID. The Test Game State preview can explicitly toggle the original flag values. Unchecked flags preview as clear; this is only an editor simulation, not a claim to read live emulated save flags.

## Integration and data preservation

- Original NPC/sign/trigger entry identity remains unchanged, as does the source script for other entries sharing it.
- Nested branch actions participate in existing scene outline, editable branch UI, page/save-state validation and project-store save/reopen.
- Original engine flags have their own *read-only* dependency index and map/scene navigation, separate from persisted project-owned flags/counters.
- All originally supported linear dialogue/SFX/music/fade conversion stays supported, including the verified `loadword + callstd` message-box pattern. An engine-external call is accepted only when it is exactly the known `callstd` part of that message macro.
- Conversion remains atomic: malformed or unsupported original command sequences cannot partially replace the source event's visual scene.

## Native-byte integration tests

`tests/native-scene-movement.test.js` exercises a genuine synthetic Gen III event root with native flag comparison, two arms, source movement pointer bytes and distinct message-box styles, then verifies editable actions, state/branch outlines, project save/reopen, compiled native GBA script bytes, an exported NPC entry pointer, decoded native movement and unchanged second NPC source.

`tests/quest-reference-index.test.js` covers read-only original ROM flag dependencies with nested branches across project-store save/reopen.

These tests do not prove that original engine map scripts, user-specific ROM hacks, Shattered story scripts, or real device installation have fully interoperable behaviour. Existing special scripts and effects must remain conservatively native-only unless a validated conversion exists.
