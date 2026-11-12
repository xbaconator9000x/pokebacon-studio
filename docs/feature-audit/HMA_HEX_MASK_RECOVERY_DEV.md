# HMA hex search with wildcards and selective staged edit recovery (13 Nov 2026)

Native ROM Hex now supports byte and nibble wildcard patterns such as \`08 ?? 3? ?F\`. The search checks the **staged** ROM view, not just the original source buffer; it does not mutate either one. The parser accepts 1–256 byte pairs, rejects malformed or all-wildcard matches, and supports exact nibbles alongside \`?\`.

For Android responsiveness, each search inspects at most **256 KiB of candidate offsets**. If no result is found, the next chunk can be scanned explicitly. Up to 16 results per scan are shown as tap-to-jump addresses. Search continuation tracks the next unchecked candidate instead of repeatedly restarting or skipping overlapping candidates. Search is not a background job.

The **Review changes** screen also supports reverting an individual staged raw-byte span, subject to a 4,096-byte cap and explicit confirmation. The implementation reuses the existing source-bound writer, verifies source-byte preconditions, removes only edits in the chosen range, preserves other hex/HMA authoring state and retains normal Undo/Redo and split save/reopen. This does **not** undo game changes made by different PokéBacon editor subsystems; those remain separately owned.

Tests cover nibble masks, staged overlays, scan continuation/bounds, partial-byte span reversion, no project mutation for invalid input, original-ROM immutability, exact native writer bytes, undo/reopen and Android UI wiring. Native emulator gameplay and physical Android tests remain separate.
