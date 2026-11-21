# HMA named-anchor source ownership hardening (17 November 2026)

HMA TOML import now treats duplicate case-insensitive anchor names and duplicate source ROM addresses as **ambiguous ownership**, rather than selecting whichever definition happens to be encountered first. All participating definitions are excluded from the interpreted anchor set, while the exact imported TOML remains preserved for review. Unrelated unique anchors remain usable.

This is deliberately fail-closed: a native editor must not infer that two incompatible table definitions own the same source address or that two case variants are different native tables. The parser emits an explicit conflict warning, and a later third conflicting definition cannot restore an earlier rejected anchor.

Regression coverage: `tests/hma-anchor-ownership.test.js` checks case-insensitive duplicate names, duplicate addresses, chained conflicts, preservation of unrelated anchors, and import/re-read retention of original metadata.

**Limits:** This does not provide full HMA TOML grammar, dynamic format interpretation, source engine validation, native emulator acceptance, or complete HMA parity. No ROM bytes or signed Android binaries are included.
