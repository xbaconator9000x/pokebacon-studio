# Guarded native HMA table growth — source-bound prototype (13 November 2026)

PokéBacon now has **reviewed copy-on-write expansion for a narrowly defined fixed-width native table**, building directly on the existing typed-table and exhaustive direct-pointer review system. This is real export-time ROM data allocation, not a mock preview or a claim of generic engine compatibility.

## Workflow

1. Attach the exact original GBA ROM and define an existing typed table containing 1–32 verified native columns. Enter **Grow records…** from the native HMA typed-table screen.
2. Review all discovered normal, packed/unaligned direct references. The installer refuses hidden interior pointers, HMA offset-pointer users, missing direct references, overlapping ownership, ambiguous source bytes and different ROM revisions.
3. Supply an **explicitly verified literal native count-field address** and choose its 8/16/32-bit width. The saved original source value must equal the table's original row count. Affirm that the chosen count is the real runtime count field. Computed counts, linked-length dependencies, hardcoded engine loops and unsupported formats are *not inferred*.
4. Choose a new total (at most **64 appended rows**, **64 KiB** of appended bytes, and an overall 4,096 rows) and initialize the new rows either by copying the final staged original row or with zeros. The existing source table and original ROM file remain untouched.
5. The queued new rows appear as **NEW — allocated on export** in the actual mobile/desktop table screen. Edit their u8/s8/u16/s16/u32/s32/pointer/ASCII fields with the same strict codec as original native records. No source address is invented for them.
6. On export, all relevant original pointer sites and the count field are revalidated against the real source and compiler ownership. The writer allocates a new table containing the final edited original bytes plus the saved appended records, rewrites the reviewed direct pointers to the allocated address, and writes the explicitly reviewed count field. Unhandled native code or ownership conflicts block the operation.
7. The queued table-growth plan, appended record edits and count verification are part of the saved project's native hex state. All changes are reversible through project Undo/Redo; **Remove queued table plan** discards the new rows if the user chooses.

## Explicit boundaries

This is an opt-in **literal-count table growth adapter**. It deliberately refuses HMA linked-length tables, computed count sites, unidentified semantic references and native pointer offsets that require relocation math. It does not automatically patch arbitrary FRLG/Emerald engine constants or establish full Hex Maniac Advance parity. It cannot prove that a source count field is actually used by the engine: that remains a user-attested ROM-specific dependency, requiring separate emulator/runtime verification. It does not allow arbitrary growth beyond GBA writer allocation limits or bypass the existing source SHA-256 and native ownership protections.

Acceptance evidence: \`tests/hma-table-expansion.test.js\` covers real \`RomOutput\` allocations and pointer/count bytes; 8/16/32-bit native counts, typed appended fields, source immutability, split save/reopen, undo/redo, retained original records, duplicate/missing users, interior pointers, unsafe source counts, queued changes, export-time collisions and Android UI integration. GitHub source/build QA is **not** the same as a signed-device APK or actual game execution.
