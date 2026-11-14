# Native bit flags in typed HMA tables (13 Nov 2026)

Native tables now expose **Edit selected flag bits…** from the ordinary cell editor for unsigned u8, u16 and u32 fields. The dialog takes a zero-based least-significant bit offset, a bit width, the new bit value (decimal or \`0x\`), and an optional inclusive final row. The existing source table is bounded to a maximum 256 affected rows in a single transaction.

The implementation uses \`BigInt\` arithmetic for masks to avoid JavaScript's signed 32-bit shift pitfalls. It reads previously staged field bytes (rather than original source-only values), replaces only the target range, and serializes exact little-endian bytes through the normal staged ROM pipeline. Neighbouring bits, other columns, untouched rows and opaque byte padding stay unchanged. A late invalid row, out-of-range bit value, source mismatch or patch budget rejection leaves the entire project unchanged.

**Constraints:** supported unsigned numeric columns only, no signed interpretation, no automatic bitflag names from HMA TOML, no enum names, no dynamic table growth and no guest-engine code rewrites. Normal undo, split project save/reopen, ROM ownership checks and writer verification continue to apply.

Acceptance: \`tests/hma-table-bits.test.js\` verifies a 32-bit MSB write, cross-byte ranges, staged preservation, batch boundaries, signed/pointer rejection, atomic failure and native source immutability. GitHub QA remains authoritative for the production build; physical Android and gameplay acceptance are separate.
