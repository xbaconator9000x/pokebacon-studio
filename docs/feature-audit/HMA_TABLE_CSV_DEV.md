# Source-bound native typed table CSV — development evidence

Updated 12 November 2026 · PR #29 · `development/studio-upgrades`.

The real Android/web ROM hex workspace now offers **Export CSV** and **Import CSV** for verified, fixed-capacity native GBA tables. Export includes zero-based source row IDs, the current project-staged typed values, original field names in order, 0x-prefixed 32-bit ROM pointers and correctly quoted comma/quote-bearing ASCII. Import permits a subset of existing columns in any order but requires exact names and distinct existing row IDs. It never adds records, changes table geometry, guesses unknown HMA formats or writes opaque bytes outside the specified typed columns.

**Safety contract:** input must be UTF-8 CSV <= 2 MiB, at most 256 data rows and 2,048 editable typed cells per import. All rows, quotes, pointers, numeric widths, field names and row IDs are parsed/validated before any project mutation. A temporary staged patch transaction ensures a late edit-budget or original-source precondition failure is failure-atomic. Actual writes still pass through the single native `RomOutput` and block overlap with other editor owners. The attached source session is checked again after asynchronous file reading.

`tests/hma-table-csv.test.js` checks quoted CSV, selected-row export, partial/reordered column imports, literal ASCII, 0x pointers, failure rollback, split-store persistence, writer byte output and UI wiring. Deployed hashes are in the authoritative source manifest.

**Not claimed:** automatic linked-table growth, field semantics for undocumented ROM hacks, native gameplay verification, HMA full parity or signed Android installation. CSV files opened in spreadsheet software should be treated as untrusted input; the editor itself does not execute spreadsheet formulas.
