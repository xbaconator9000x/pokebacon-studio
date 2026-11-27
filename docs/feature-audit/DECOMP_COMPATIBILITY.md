# Decomp and expansion compatibility

Checked with `scripts/check-private-decomp.mjs` against ROMs built from the open-source repositories (nothing is committed; build them yourself with `make MODERN=1`).

| Source | Maps | Species | Moves | Items | Trainers | Wild encounters |
| --- | --- | --- | --- | --- | --- | --- |
| pret/pokeemerald (modern build) | 518 read | 412 | 355 | 377 | 855 (matches the decomp) | yes |
| pret/pokefirered (modern build) | read | 412 | 355 | 375 | 743 | yes |
| rh-hideout/pokeemerald-expansion (build of master, commit cabac595) | read | 1573 species (stats, catch rate; names read-only for pointer names) | 935 moves (power, accuracy, PP) | 874 items (price) | not found | not found |

Edits to species stats, move power, item price and a trainer's team were written and read back on both pret builds.

Emerald trainers were not found before this change: the FireRed-style discovery cannot see them. They are now found by structure (40-byte records, the class-name table directly in front), which also covers hacks such as Monomyth.

pokeemerald-expansion changes its tables between releases, so species, moves and items are found by structure: known entries (Bulbasaur line, Pound, Karate Chop, ball prices) locate each table, its record size and its field positions, including bit-packed fields. Only commit cabac595 has been tested. Trainers are generated from `trainers.party` in the expansion and are not supported yet; names stored as text pointers cannot be renamed yet.
