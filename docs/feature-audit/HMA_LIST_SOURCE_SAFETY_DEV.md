# HMA numeric list source-safety regression (18 November 2026)

This batch tightens source-authoritative Hex Maniac Advance TOML list interpretation without changing the native ROM writer or Android identity.

- Multiline numeric label arrays now strip comments only outside quoted values. A hash inside a quoted label remains data. Original TOML is retained byte-for-byte in the project sidecar.
- Duplicate keys in a single HMA list are rejected for numeric-label binding, rather than allowing a first/last value to silently become a native enum.
- Regression covers multiline comments, literal hash labels, source metadata project save/reopen, duplicate rejection and subsequent valid list recovery.
- The production interpreter SHA-256 is refreshed in qa/source-manifest.json.
- No source-engine byte layout is inferred from a list; native table exports retain existing explicit ownership checks. HMA-HEX-06 and HMA-TBL-01 remain partial/not_verified in the 101-item contract.

This source-level regression is not evidence of physical Android upgrade retention, emulator gameplay or full source-to-ROM-to-reimport acceptance.
