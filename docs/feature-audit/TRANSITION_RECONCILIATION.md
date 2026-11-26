# Native transition reconciliation

Base: main 889c7ed213f2ad549bc1ecedcb43a9fe6c14339d.
Donor: PR #17 f3aaa959d3e3f1b24513f9a8bc42e17daf5ee9ac.

The door, connection, facing and world-model files were unchanged between
the relevant donor merge base and current main. Their transition changes
were ported together. Only the quick-player rendering and transition-specific
writer hunks were taken from the divergent application/export files.
Current adapter checks, packed-border verification, artwork ownership and
free-space allocation are retained.

Includes independent entrance/return native behaviors, Centre escalators,
directional stairs, native frame selection, relocated door-table validation,
door audit and a 16 by 32 quick-test body with foreground repainting across
both occupied rows. Three new modules are included in the offline cache.

Five focused fixtures pass: independent transitions, quick-player bounds,
dynamic return audit, relocated tables and reopening modified door timing.
These are synthetic byte/model tests, not device or gameplay acceptance.
Physical Android, private-ROM gameplay and signed APK acceptance remain open.

PR #17 closeout (checked against main 1c8563a on 2026-11-26): the three items
once held back are already present on main and were not ported again.
- Palette-export review: planArtworkPalettes with reviewed conversion, covered
  by tests/palette-review-budget.test.js and tests/palette-conversion.test.js.
- Prepared-artwork initialisation: PackedArtworkCompiler bounds, covered by
  tests/prepared-artwork-init.test.js.
- Independent pin visibility: the sprite comparison pin has its own visibility
  toggle (spriteComparisonVisible), covered by tests/sprite-reference-validation.test.js.
The 11 palette and artwork tests pass on main. The donor's remaining differences
are older copies of files that main has since moved past (adapter capability
check, protected-border verification, hex workspace, trainer encounters), so
merging it would remove current behaviour. One donor-only script,
scripts/test-private-palette-export-ui.mjs, needs a private ROM and project and
was not ported. None of this is device or gameplay acceptance.
PR #11 remains unmerged: page dispatch needs validation of disabled pages,
malformed conditions, sidecar persistence, compiler and preview equivalence.

Inventory baseline: 98 records; 78 mark implementation present, 59 are partial,
19 implemented without gameplay verification, 11 missing, 6 engine-limited,
1 UI/design-only, 2 outside scope. These overlapping implementation/status
counts are not a percentage of HMA functionality. No record is fully verified.
