# Hex Maniac Advance → PokéBacon feature parity contract

**Objective: functional parity with all applicable [Hex Maniac Advance](https://github.com/haven1433/HexManiacAdvance) capabilities**, with a mobile-first Android/web implementation, safe original-ROM handling, and additional PokéBacon capabilities retained. This is an engineering target, **not** a statement that the editor already has parity.

**Eleventh HMA integration batch:** [Source-pinned dependency review and atomic multi-table native export](HMA_SOURCE_PINNED_REVIEW_DEV.md) adds source SHA-256 reviewed manifest import/export, up to 16 extra count fields, immutable full-project review, and all-or-nothing ROM output allocation/pointer/count/code writes. This still requires engine-specific runtime validation.

**Tenth HMA integration batch:** [Engine-bound Thumb count dependencies](HMA_ENGINE_COUNT_DEPENDENCIES_DEV.md) support explicitly reviewed FireRed/LeafGreen/Emerald CMP/MOVS immediate instructions during native table growth. Source engine/opcode checks, 16-site caps, bounded candidate scanning and compiler ownership remain required; this is not automatic engine-code discovery or gameplay acceptance.

**Ninth HMA integration batch:** [Guarded fixed-width table expansion](HMA_TABLE_EXPANSION_DEV.md) now allocates a larger native table, copies original staged rows, supports edited appended typed rows, relinks every reviewed direct pointer and updates an explicit native literal count field. This remains an **opt-in, engine-specific prerequisite workflow**; it is not a generic dynamic-length HMA format interpreter or gameplay verification.

**Eighth HMA integration batch:** [Wildcard byte/nibble search and selective staged-range reversion](HMA_HEX_MASK_RECOVERY_DEV.md) extend the actual Android hex UI with bounded scanning and reversible edit cleanup; this is not a complete HMA assembly or code-repoint implementation.

**Seventh HMA integration batch:** [CSV preview and atomic numeric arithmetic](HMA_CSV_REVIEW_ARITHMETIC_DEV.md) adds an explicit review/confirm step for source-bound CSV imports and bounded signed numeric adjustments, without resizing engine tables.

**Fifth HMA integration batch:** Add atomic, bounded bit-range updates over verified native u8/u16/u32 fields, including the most significant bit of a 32-bit word, without overwriting unrelated flags. The existing touch-oriented cell editor exposes the bit editor, with optional batch edits across 256 rows. This is manual bit editing, **not inferred HMA bitfield/enum decoding**. [Implementation details](HMA_TABLE_BITS_DEV.md).

**Fourth HMA integration batch:** Strict HMA format recognition now supports plain four-byte pointer columns, signed `|z`, hexadecimal `|h`, and fixed-count linked-length sources with explicit metadata; native tables also support atomic exact typed find-and-replace (maximum 256 matches). All features remain source-bound; this is **not** generic HMA decoding or expanding live engine tables. See [HMA table format work](HMA_TABLE_FORMATS_DEV.md).

**Third HMA integration batch:** [existing-row copy/swap, bounded column fill and typed search](HMA_TABLE_ROW_TOOLS_DEV.md) plus [transactional CSV import/export](HMA_TABLE_CSV_DEV.md) are integrated into the existing source-bound Android/web table UI. These remain fixed-capacity operations; no inferred source-engine table growth or full parity is claimed.

**Second HMA integration batch:** [pointer-navigation, guarded copy-on-write repointing and IPS patching](HMA_POINTER_IPS_DEV.md) adds real source pointer lookup, read-only show-uses, strict fixed numeric HMA table formats, inspected same-size relocations and standard IPS create/apply. Each remains **partial**, not verified full HMA parity.

**Latest partial implementation:** [HMA hex, typed table and TOML foundation](HMA_HEX_TABLE_FOUNDATION_DEV.md) adds genuinely editable original ROM byte spans, manually described native typed records and losslessly imported HMA metadata, with export ownership conflicts blocked. This does **not** establish general HMA parity, linked-table expansion or broad metadata-format decoding.

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
