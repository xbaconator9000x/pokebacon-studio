# HMA named list labels (13 Nov 2026)

PokéBacon now retains both simple and multiline numeric arrays from the original imported HMA \`[[List]]\` TOML metadata. The raw metadata text remains unchanged, even when some structures cannot be decoded.

The native table editor can bind one explicitly selected, unambiguous list name to an existing u8, u16 or u32 field. The label is a UI aid only: binary editing continues to use the original field width, endian encoding, ROM identity, staged ownership, undo and save semantics. Names cannot retype another field or expand native tables.

Each named list is capped at 1,024 numeric labels, requires unique nonnegative indices (up to 65,535), and rejects unsupported/malformed arrays. Missing, duplicate or obsolete bindings never authorize guessing an encoded value. Direct numeric editing remains available.

No inferred HMA enum \`Format\` syntax, arbitrary text format decoding or engine-native table growth is claimed. Emulator and physical Android acceptance remain separate from GitHub source/build QA.
