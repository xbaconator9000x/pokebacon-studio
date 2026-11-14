# HMA foundational integration: native ROM hex + typed tables + TOML metadata

Branch: `development/studio-upgrades`, PR #29, 12 November 2026.

## Implemented in this batch

This is the **first native HMA parity implementation**, not merely another checklist:

- `dist/native-hex-workspace.js`: bounded original-ROM hex viewer and read-back, hexadecimal address navigation, hex-byte search, sparse staged reversible overwrites (4,096 bytes per write, up to 65,536 changed bytes per original source), preview and contiguous before/after diff. No source bytes mutate in-place. Project saves retain the `sourceId` identity and every original-byte precondition.
- `dist/hma-table-workspace.js`: lossless original HMA TOML import/export **storage**, named-anchor/offset pointer inspection and diagnostics; source-scoped manually defined numeric/ASCII typed table layout with bounded counts, field widths, offset checks, little-endian unsigned/signed numbers, verified in-ROM pointers and source-byte edits. HMA's opaque complex formats are **preserved as original text** and **never guessed into an unsafe write**. A generic manually described table is not complete HMA table expansion or automatic linked tables.
- `dist/hma-hex-ui.js`: new mobile-first **ROM hex & typed tables** button inside **Game maker → Engine & source**. Four tabs: interactive 16-byte hex rows and byte editing; reusable table definitions and row/cell editing; anchor lookup/quick navigation and importing HMA .toml files; reversible before/after changes and source-only original-ROM export. Hex and typed table edits stage to the existing project change/undo system. A separate **Compile all project ROM edits** button invokes the production writer.
- Main `dist/rom-writer.js` now adds raw edits **after** all other source-map, story, Pokémon and image compilers, then rejects every patch that collides with any tracked native writer range or diverges from the original source byte. It preflights the *entire* patch set before applying any; completed writes enter the same authoritative writer integrity check. Unrelated bytes remain untouched. The standalone source + hex export explicitly does **not** include other project/map changes.
- `dist/app.js` reconnects the workspace automatically after a newly opened ROM, counts hex patches toward edited ROM export, and permits explicit linked-map-free exports for hex-only edits. `dist/project-store.js` splits hex metadata/edit state into its own persisted full-save section. `dist/edit-history.js` includes it in undo/redo. `dist/model.js` validates saved state and payload limits.

## Invariants and acceptance limits

- ROM bytes, new table metadata and native source fingerprint are **not** inferred from the user project's current map tiles. Open the original matching GBA file first. If source bytes change or another editor owns a region, export **fails closed** with the conflicting offset and preserves the project.
- A read-only HMA TOML anchor list is **not** automatically converted to writable fields. Most HMA `Format` expressions encode special text, bitfields, pointer tables, images, compressed data, linked table lengths and engine-specific descriptors. Editing them requires independent format adapters and pointer ownership checks; raw metadata is retained unmodified until that work is built.
- No HMA library or external game assets were imported into the repository; test scripts construct synthetic original GBA byte buffers and TOML examples.
- This batch does **not** yet provide IPS/UPS changes, arbitrary THUMB editing, true linked-table expansion, HMA TOML exports from edited named anchors, preconfigured complete HMA metadata catalogs, automatic resource repointing, original Japanese/French ROM formats, physical Android installation or native emulator proof of changed game behavior.
- Do not mark the nine previously unmapped HMA parity rows fully verified. This is bounded `implemented_not_gameplay_verified` coverage for raw edits, generic typed numeric records and anchor import, not all-feature parity.

## Tests

`tests/hma-hex-workspace.test.js`: source preservation, source-locked hex edits, search, bounds, atomic conflict rejection, export write ownership, history undo/redo, split save/reopen and untrusted saved edit validation.

`tests/hma-table-workspace.test.js`: HMA `[[NamedAnchors]]` and `[[OffsetPointer]]` parsing, complete unsupported metadata retention, typed table read/edit/export/reparse, numeric/pointer/ASCII field bounds, schema overlap refusal and full project persistence.

Update: [HMA pointer and IPS development evidence](HMA_POINTER_IPS_DEV.md) implements the next same-source integration batch: packed/unaligned direct pointer where-used, reviewable same-count table repoint, simple HMA numeric format import and verified IPS create/apply. Complex table growth and general engine-native relocation remain unverified.

Next integration work: indexed native table discovery/labels using actual HMA `Format` expressions; saveable pointer-follow navigation and source cross-reference graph; linked-table expansion and relocation, byte-level diff/IPS/UPS, verified THUMB assembler, and end-to-end original-ROM game/emulator behavior across FRLG/RSE revisions.
