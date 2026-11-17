# HMA TOML native metadata safety — 17 November 2026

This source-level integration hardens the existing HMA TOML import path in `dist/hma-table-workspace.js`. The original complete TOML remains project-owned and losslessly retained, including unsupported formats and comments.

- Numeric `NamedAnchors.Address`, `OffsetPointer.Address`, and `OffsetPointer.Offset` are parsed only from explicit decimal or `0x` hexadecimal integer literals. Empty strings, booleans, exponent notation, partial hexadecimal tokens and fractional values are not silently coerced into ROM addresses.
- Trailing TOML comments are stripped only outside quoted values. Literal `#` within triple-quoted format strings is retained.
- Repeated keys within a native anchor or offset-pointer record generate warnings and exclude that record from the interpreted native ownership set. Raw metadata is preserved for inspection instead of choosing the last assignment.
- Previously implemented cross-record anchor name/address conflict rejection remains in force.

Regression additions in `tests/hma-table-workspace.test.js` cover valid commented offsets, literal hashes, invalid numeric values, duplicate anchor/pointer keys, and raw-source preservation. This batch changes no engine hooks, ROM data, app identity, signing keys, or Android shell.

**Acceptance limits:** These are strict parser and source-ownership checks, not generic HMA TOML interpretation or full HMA parity. Native original-ROM gameplay, arbitrary table expansion, actual Shattered round-trip and physical Android upgrade safety remain unverified. CI must be checked at the exact commit SHA before any test pass is claimed.
