# HMA typed table format and exact replacement integration (12 Nov 2026)

Implemented in \`dist/hma-table-workspace.js\` and exposed through the existing Android/web \`dist/hma-hex-ui.js\`, not a stand-alone demo.

## Supported HMA fixed-width expressions

- \`[level. stats: total::]6\`: exact inline unsigned 8/16/32-bit columns and literal row counts.
- \`[script<> level.]\` followed by an integer count: direct, *untyped* four-byte pointer column, navigable by the source-pointer inspector. Pointed-to text/scripts/tables remain outside this decoder.
- \`[offset:|z flags::|h]6\`: signed integer semantics and a hexadecimal display hint. The underlying write path validates integer boundaries.
- \`[value. reference<>]data.pokemon.names+2\`: resolves count only where exactly one metadata NamedAnchor called \`data.pokemon.names\` exists and its own format has a literal final row count (such as \`[name""11]412\`). Saves an immutable count provenance annotation alongside the imported table.

Unsupported formats (dynamic/stream length, compressed graphics, inline text payloads, nested pointers, enum/tuple/bitfield modifiers, ambiguous/count-cyclic links) remain HMA metadata, not interpreted editable records. The matched-count provenance does not rewire engine code, automatically resize tables, or guarantee safe linked expansion.

## Existing record exact find-and-replace

In **ROM hex & typed tables → Typed tables → Replace matches**, select a field, inclusive source row range, exact old value, and new value. Both values are encoded using the same strict type and ROM pointer rules as single-cell edits. All staged rows are compared before writing. At most 256 matching rows may be modified in one transaction; a larger match set aborts with instructions to narrow the range. On any invalid value, changed ROM source, or patch budget failure, **no partial table edits are committed**. An existing undo operation can restore the previous patch set.

Row-jump input was added for long native tables, reducing repeated pagination on phones. All changes reuse project persistence and original source validation; no foreign game assets or private ROMs are distributed.

## Acceptance boundary

Source test coverage: HMA parsing, linked literal counts and rejection of unsupported formats; literal source-byte signed/pointer edits; stable save/reopen, source immutability, native writer, exact/atomic bulk replacement and UI wiring. GitHub CI is the automated gate. Actual modified-ROM gameplay, full engine-native linked table growth and on-device sign-off are separate acceptance stages.
