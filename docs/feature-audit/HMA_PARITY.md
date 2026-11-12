# Hex Maniac Advance → PokéBacon feature parity contract

**Objective: functional parity with all applicable [Hex Maniac Advance](https://github.com/haven1433/HexManiacAdvance) capabilities**, with a mobile-first Android/web implementation, safe original-ROM handling, and additional PokéBacon capabilities retained. This is an engineering target, **not** a statement that the editor already has parity.

**Canonical machine-readable contract:** [hma-parity.json](hma-parity.json) — **101 atomic HMA features across eight sections**, independently linked to the existing [98-record broad capability inventory](inventory.json). Source reference: [HMA README](https://github.com/haven1433/HexManiacAdvance/blob/master/README.md), [UI guide](https://github.com/haven1433/HexManiacAdvance/wiki/Understanding-the-User-Interface), [tutorial index](https://github.com/haven1433/HexManiacAdvance/wiki/Tutorials), and [releases](https://github.com/haven1433/HexManiacAdvance/releases). The previously pinned [upstream source audit](upstream-evidence.json) and [comparative review](COMPARATIVE_EDITORS.md) provide architectural context. This new checklist breaks broad items into user-verifiable actions; it is **not** an exhaustive enumeration of every undocumented upstream command or minor future release.

## Release baseline and scope

- **Stable reference:** upstream **v0.5.6.1**. HMA itself marks this release as the currently stable/latest one; its release note says 0.6.0/0.6.1 have stability regressions.
- **Additional scope:** every documented **0.6.0/0.6.1** capability, including dynamic expanded overworld rendering, complex-script partial display, native-flag/variable picking, wave-function-collapse map generation, tile/block diagnostics and trainer learnability warnings. The fact that a newer feature is currently unstable upstream is not permission to omit it.
- **Target ROM families:** English Ruby, Sapphire, FireRed, LeafGreen and Emerald, including documented 1.0/1.1 revisions where relevant. Expanded/custom engines must be identified separately; no unknown Shattered ROM patch is assumed compatible.
- **Feature equivalence:** the same practical ROM-changing outcome matters more than copying HMA's Windows/WPF controls. PokéBacon can use friendlier touch-centric authoring and need not duplicate upstream UI arrangement.
- **No arbitrary assets copied:** independently implement interfaces and tests; inspect and reuse MIT-licensed upstream code only with attribution and implementation review. One authoritative PokéBacon export writer.

## Eight feature families

| Family | Atomic requirements | High-impact cases |
| --- | ---: | --- |
| Hex editor, metadata, navigation | 12 | Raw byte editing; pointers, anchors, HMA TOML, cross-reference search, safe repoint |
| General typed tables | 10 | Add/edit/duplicate records, linked expansion, field types, constants, miscellaneous native lookup tables |
| Pokémon, trainers, moves, encounters | 16 | Species/learnsets/evolutions, trainers and AI, wild encounters, abilities, actual battle code |
| Maps and events | 16 | Original-map writeback, warp/event/connection editing, visual+raw scripts, blocksets, bank allocation |
| Text, graphics, tilemaps, palettes | 13 | Automatic text repointing, PNG/tilemap interchange, shared palette ownership, UI/titlescreen/fonts |
| Code and automation | 13 | Event/battle/AI/animation code, THUMB assembly, symbolic macros, script templates, automation console |
| Utilities, patching, extensions, UX | 11 | IPS/UPS create/apply, backups, safe Fairy/expansion hooks, engine metadata, navigation |
| HMA 0.6.x additional capabilities | 10 | WFC map generation, dynamic OW, complex-script previews, trainer warnings, UI diagnostics |
| **Total** | **101** | |

### The nine HMA requirements not separately covered by the original 98-item inventory

These are explicit entries in [hma-parity.json](hma-parity.json) with an empty `inventoryIds` list, meaning **unmapped/unproven work**, not a feature silently considered complete:

1. Unrestricted raw hex editing, byte search, arbitrary-region read/write and diff.
2. Import/export of HMA `.toml` anchors/metadata and custom formats.
3. Fully generic typed table CRUD (not just fixed Pokémon/trainer forms).
4. HMA's miscellaneous native lookup tables, such as Soundproof/Metronome exclusions, payouts and trades.
5. Original trainer-class payout table support, including native payout checks.
6. THUMB disassembly/assembly, guardrails and native code relocation.
7. Sandboxed scripted/Python-like table automation with rollback.
8. **IPS** creation and application (UPS must remain supported too).
9. HMA 0.6.x code-size compile diagnostics for THUMB editing.

The nine lines correspond to approximately **seven larger implementation workstreams**; individual cases retain separate acceptance requirements to prevent false completion. Other HMA features **do** have broad inventory links, but those links prove *tracking*, not functionality. For example, `MON06` custom battle effects, `UI04` battle/AI scripts, `MAP09` native map interchange and `SCN06` debugger remain missing/partial in the broad inventory.

## Implementation order — substantial, linked batches

1. **P0: Source-authoritative editor foundations.** Raw hex viewer/editor; HMA-style typed table and TOML metadata; safe relocation and where-used ownership; reversible patch/backup. Guarantee source-fidelity and recovery on all supported ROM revisions.
2. **P0: Existing ROM content end-to-end.** Native map/event/warp and script editing, Pokémon/trainer/move/item data and image repoint, visual/advanced editor interoperability. All edit types must survive save, reopen and actual ROM reindex.
3. **P0/P1: Deep code and battle coverage.** THUMB, battle scripts, move animations, trainer AI, expansion hooks and miscellaneous lookup tables. Per-engine prerequisites and emulator proof are mandatory; no blanket custom-ROM support.
4. **P1: HMA productivity parity.** Linked-table expansion, aliases/goto/anchors, data references, image/palette ownership, source automation, map templates, trainer UX and invalid-data warnings.
5. **P1/P2: v0.6.x and advanced editor features.** Dynamic OW, WFC backtracking, updated map tooling, diagnostics, original-code warnings, power-user scripting/automation and full touch/desktop usability.

Parallel work is allowed where data ownership is clear; do not wait for these phases to finish before shipping independently verified features. Maintain the existing [dependency roadmap](ROADMAP.md), original Shattered compatibility and mobile performance requirements.

## Acceptance rule (no green-by-assumption)

**No HMA parity row may be marked `verified`** until it has: (1) matching source-ROM revision and original data, (2) a usable edit operation including mobile UI, (3) save/reopen, (4) native ROM export and reimport, (5) **actual emulator/game execution** when the operation affects behavior, (6) unchanged unknown/unrelated bytes with pointer/ownership audit, and (7) exact-head CI evidence and reproducible artifacts. For methods without meaningful runtime behavior (e.g. a table search), the record must still show equivalent observable source-asset results and an explicit reason the execution stage is N/A.

Existing source/build/fixture/browser tests help development but **do not** mark any of these rows parity-verified by themselves. A row mapped to `implemented_not_gameplay_verified` is not automatically promoted; a row mapped to `missing` is not considered implemented.

**Tracking:** Existing [feature issue #15](https://github.com/xbaconator9000x/pokebacon-studio/issues/15) and [audit issue #20](https://github.com/xbaconator9000x/pokebacon-studio/issues/20) remain canonical. Update the checklist and source evidence in the same PR as work, avoid duplicate tracking issues, and never call a source-only Android APK build a signed device-ready release.
