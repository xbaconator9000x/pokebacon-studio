# HMA native typed-table row operations — development evidence

Updated 12 November 2026 · PR #29 · `development/studio-upgrades`.

## Integrated functionality

The existing **ROM hex & typed tables** phone-friendly modal now provides **search in a typed column**, **copy/swap existing native table rows**, and a **bounded multi-row column fill**. These are operations on the verified original-ROM table layout, not synthetic editor-only objects. Numeric search accepts decimal and 0x hexadecimal; fixed ASCII fields use case-insensitive substring matching. Results show the first 32 matching rows with direct, already-existing editable cells.

Row copy and two-way swap operate on the complete fixed-width row, **including opaque padding bytes**; the UI warns of this deliberate behaviour. They preserve edits already staged on the source row, including when both rows were edited before swapping. Bulk fill targets a specified existing column and inclusive range of up to **256 rows**, using the existing little-endian typed encoder and pointer validation. No ROM image is modified until the authoritative exporter stages its source-matched writer changes.

All multi-write operations have a transaction barrier: the entire proposed staged-patch list is built separately and committed only after every source precondition and 65,536-byte patch-budget check passes. Failure on a later row leaves the live project unchanged. The ordinary project history provides undo/redo; the split project store persists edited rows, and `installROMHexEdits` still aborts compiler ownership conflicts before writes. Original table row count, pointer ownership, opaque custom routines, and source ROM provenance are unchanged.

## Evidence

`tests/hma-table-bulk.test.js` exercises exact byte copies (including opaque fields), edited-source row swap, undo/redo, typed search, multi-row numeric/ASCII updates, late-limit transaction rollback, split-store save/reopen, native GBA reindexing, and deliberate native writer ownership collisions. Source-manifest hashes are synchronized for both deployed JS modules.

## Limits

This is **fixed-capacity existing-row CRUD**, not automatic HMA linked-table expansion, free-row detection, semantic duplicate/unique key enforcement, inferred original engine record counts, arbitrary TOML format parsing, or proof of Pokémon battle/runtime behaviour. Copying a trainer or species record may require other engine-linked changes; the user must understand the table schema. True HMA parity and signed Android-device acceptance remain open.
