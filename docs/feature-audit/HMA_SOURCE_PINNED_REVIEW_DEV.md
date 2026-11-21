# Source-pinned engine review packages and transactional native table writes

**13 November 2026 · PokéBacon Studio · HMA interoperability**

This batch extends the guarded FireRed, LeafGreen and Emerald native-table expansion system. It does not claim automated engine compatibility or actual gameplay proof.

## Portable dependency-review manifests

The HMA native table screen supports exporting a small JSON review package from an existing queued table expansion and loading a previously reviewed package into another matching project. The manifest contains only the table layout, pointer sites, primary and additional count sites, selected Thumb CMP/MOVS instruction sites, a suggested expanded count, original source ROM length, game code, and **full original ROM SHA-256**. It does not contain the source ROM, original map bytes, sprite data, saved project, or signing keys.

Manifest creation re-validates all original pointer, count and Thumb instruction sites on a temporary project. Import recomputes the full source SHA-256 and requires exact matching of the original ROM revision, game header and every typed table field. The import then runs a complete, non-mutating dry-run of the existing source-bound expansion planner. It refuses unknown metadata fields, forged/changed ROM digests, altered layouts, stale literal counts, mismatched instructions, missing pointer users and unsafe source addresses.

**Import only prefills the existing review form.** It does not install or authorise code edits and explicitly clears the user-confirmation checkbox. The user must independently confirm actual runtime dependencies before queuing. Matching a Thumb immediate, pointer or count byte is structural evidence only; it does not prove instruction reachability or table-specific semantics. There are no invented built-in addresses for public FireRed or Emerald revisions.

## Multiple literal count dependencies

A table expansion can now update the primary reviewed count field plus up to **16 additional original count fields**, each with its own width of 8, 16 or 32 bits. Every original value must equal the old row count and the proposed new value must fit every selected width. The installer blocks overlapping source table bytes, direct pointers, Thumb instructions, staged hex patches, compiler-owned native writers and other reviewed count sites. Saved projects validate this bounded metadata on reopen. The existing limits remain 64 appended rows, 64 KiB of new data and up to 16 reviewed Thumb instruction sites. Older saved expansion plans without the optional additional-count list remain valid.

## All-or-nothing multi-table install

The native table installer now runs every allocation, pointer redirect, literal-count write and reviewed Thumb patch against a **detached copy of the current RomOutput state** (bytes, writes, allocations, free spans and allocator cursor). On complete success, it publishes the new state. If any table fails—including the second or final allocation—**the original output object is left exactly as it was before HMA installation**. This is important when map, artwork, script and other editor output has already been compiled before HMA table writes.

## Tests and limitations

The new test files are tests/hma-table-transaction-counts.test.js and tests/hma-engine-manifest.test.js. They cover concrete ROM byte output, multiple native count fields, late allocation failure rollback, successful multi-table writes, project persistence, file SHA-256 identity, failed SHA/ROM/layout/pointer/instruction tampering, and Android import/export wiring.

The original source and original project binding are never silently rewritten. This provides a portable **user-reviewed dependency registry**, not a publicly validated engine-site database. Real FireRed/Emerald gameplay in mGBA and physical Android signed APK acceptance still require separate evidence.
