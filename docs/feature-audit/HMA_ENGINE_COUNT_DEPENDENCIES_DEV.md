# Engine-bound count dependencies for native HMA table growth

## Supported in this batch

The existing guarded, source-bound copy-and-repoint table expansion now supports *reviewed 16-bit Thumb instructions* whose 8-bit immediate operand equals the original table row count. This adds native code-bound editing alongside the existing literal data counter. Applicable ROM header families: FireRed (BPR), LeafGreen (BPG) and Emerald (BPE).

- Thumb CMP Rn, #imm8: little-endian opcode 0x2800 | (register << 8) | oldCount.
- Thumb MOVS Rn, #imm8: little-endian opcode 0x2000 | (register << 8) | oldCount.
- Each instruction must be aligned, contain the original old count, and have a unique source address; at most 16 extra sites per table. The new count must fit 8 bits.
- The original literal count site is still required. Normal pointer completeness, linked-length denial, bounded rows, original-ROM checks, collision checks and engine identity guards remain.
- The installer preflights the original opcode, all native compiler-owned write ranges, existing edited bytes and any count/pointer/code overlap across queued tables.
- ROM export allocates the enlarged table, repoints each reviewed direct reference, updates the primary count and changes only the low immediate byte of each instruction. The opcode/register and original input ROM remain unchanged.
- Saved plans retain the exact source game code, engine family and original instruction words; stale/rebound instructions are rejected.
- The Android editor shows ROM-family provenance and offers a bounded (256 KiB) candidate scan. Search results require manual inspection and explicit selection. A matching two-byte pattern is not proof of a valid table-dependent code site.

## Explicit limitations

This is **not** an automatic engine disassembler or a fully source-hash-pinned table dependency registry. It cannot establish instruction reachability, infer every table consumer, fix computed/ARM instruction bounds, repair off-by-one loops or expand linked HMA tables. Game-code prefixes distinguish families, not actual binary semantics. A human must verify that each selected instruction controls the intended table.

## Tests and acceptance

tests/hma-engine-count.test.js checks FRLG/Emerald family detection, opcode decoding, bounded candidate scans, concrete compiled ROM allocation/pointer/count/instruction bytes, 8-bit bounds, source drift, conflicting compiled writes, extra staged edits and saved-project validation. The synthetic ROM fixtures use native compiler byte output; these tests do **not** prove gameplay with a private or commercial ROM. mGBA and physical signed Android acceptance remain outstanding.
