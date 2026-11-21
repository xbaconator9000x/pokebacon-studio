# HMA hex navigation

The ROM Hex workspace now has source-ROM scoped, non-mutating navigation:

- direct decimal/hex address jumps;
- exact case-insensitive jumps to unambiguous imported HMA named anchors;
- Back/Forward traversal across address jumps, pointer follows, byte searches,
  masked-search hits and page navigation; and
- a bounded 128-location history that discards the forward branch after a new
  jump.

Navigation is held only while the currently opened ROM workspace is active. It
does not become a native ROM edit or alter the HMA TOML. Invalid, missing and
ambiguous anchors fail closed.

Source coverage is in `tests/hma-hex-navigation.test.js`. This is editor-source
acceptance only: it does not prove a native gameplay behavior and therefore
does not promote HMA parity to verified status.
