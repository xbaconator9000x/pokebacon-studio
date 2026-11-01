# ROM storage analysis — 1 November 2026

The demo's small authored scope does not explain its export failures. The immediate issue is export scope, contiguous allocation and automatic migrations, against a large inherited game. A 32 MiB file length is an address-space ceiling, not proof that all bytes contain useful content. Earlier explanations conflated those facts.

## Measurements

Measured locally using the recovered 23-map project and its fingerprint-verified embedded source, with 4.69.9 production export code. This is not a capture of the current phone's exact project.

| Measurement | Bytes/count | Meaning |
| --- | ---: | --- |
| Source ROM length | 33,554,432 | Already expanded to the writer's 32 MiB ceiling |
| Native maps present | 437 | The source retains much more than the 23-map project |
| Project maps / tileset pairs | 23 / 21 | Palette preparation covers all linked maps |
| Long `FF` runs, at least 4 KiB | 4,309,014 | Erasure patterns; not all proved safe to overwrite |
| Largest raw erasure-pattern run | 1,641,106 | Physical padding can be large before reference guards |
| Format-aware guarded allocation space before export | 1,455,704 | 714 separate spans; largest 31,326 bytes |
| Generic every-byte pointer scan space | 694,016 | Largest 8,752 bytes; much more conservative |
| New allocations for completed project export | 111,674 | About 109 KiB; excludes reused existing storage |
| New allocation records | 161 | Payload only; alignment/guards are additional |
| Maps marked changed | 23 | Prepared-artwork presence itself sets changed |
| Completed output verification | 23 maps; 17,912 cells; 2,194 metatiles | Full compile and reopen passed |

New allocation payload: graphics 54,216 bytes; metatile planes 26,896; attributes 4,652; palettes 2,560; tileset headers 1,680; map blocks 14,286; layouts 644; all remaining event/runtime/border data 6,740. Some material is shared/deduplicated: these are not 42 distinct newly allocated graphics banks. The existing source already contains earlier story/game work, so 109 KiB is this export's new allocation footprint, not a measurement of all historic demo authorship.

## Confirmed design problems

1. `prepareNativeArtworkAttempt` groups every linked map. `buildRom` sets `changed` when `compiler.usesPreparedArtwork` is true, even if no authored tile differs. The writer consequently installs layouts/tileset headers for every prepared map. Current deduplication reduces bytes, but the workflow is broader than the edit set. A change-aware dependency closure is needed: include actual changed maps, shared tilesets, scrolling neighbours and referenced script tiles, rather than blindly repack the entire project.
2. Fragmentation can fail a small allocation with abundant total space remaining. The device report requests 12,220 contiguous bytes against a largest remaining span of 10,814, with 1,287,508 total bytes still available. Largest-first batch allocation improves order; it does not establish a sustainable storage budget by itself.
3. An unchanged full-project native round trip is not currently reliable. A fresh import of the same 23 source maps, with no authored events/story and no palette repacking, reaches the automatic Shattered gate-repair path and fails with `Restoring scripted gates needs a repacked tileset`. The repair attempts to allocate metatiles in an already full bank. This is a per-bank tile-capacity failure, distinct from total ROM-byte capacity, and occurs without user edits in this control.
4. The exporter preserves old source allocations when replacements move; it does not have comprehensive ownership/reachability metadata to reclaim retired data safely. A matching sidecar restores a consistent original source and avoids blindly chaining exports, but arbitrary compiled ROMs cannot be treated as freely reclaimable.
5. Coarse pointer guards substantially reduce the physical erasure-pattern regions. The excluded bytes are not all waste: some may genuinely be referenced. Separating false positives from live targets requires typed reference/ownership evidence, not disabling guards or overwriting every `FF` region.

## Control results and limits

- Fresh native import/export of map 1.0 alone, no edits and no repacking: passed; zero changed maps and **zero allocated bytes**, with 3,726 cells and 238 metatiles verified.
- Fresh import/export of all 23 maps with the same settings: failed at automatic gate repair, as above. This is a real failing control, not a passed test.
- Full recovered authored project with prepared artwork: passed; storage measurements above.
- These tests validate binary/map output and expose export design defects. They do not establish gameplay correctness, exact current-phone reproduction or full-campaign capacity.
- No claim is made that 437 minus 23 maps can be safely deleted. Unbound maps may still be used by native scripts or future content. No source content was stripped.

## Required engineering priorities

- [ ] Make a no-edit import/export of all supported maps succeed without adding data or initiating unrelated content migrations. Verify actual output byte differences, not just allocation counts.
- [ ] Make gate-repair decisions explicit and idempotent, inspect whether repair is actually required, and preflight its tile budget. Preserve correct scripted gate behaviour; do not simply disable the repair to pass a test.
- [ ] Repack only actual artwork changes plus their proven shared/connected/script dependencies. Collision-only, dialogue-only and unchanged maps should retain native artwork.
- [ ] Track source allocation capacity, ownership, aliases and replacement reachability. Reuse exclusive fitting storage; reclaim only proven retired ranges.
- [ ] Plan all large relocations together and expose preflight figures for new bytes, largest required block, verified capacity, fragmentation and remaining headroom before export.
- [ ] Test repeated exports from original source and matching sidecars for stable size/address use. Add one-tile, collision-only, dialogue-only and new-map budget controls.
- [ ] Build a campaign headroom budget. If genuine content eventually exceeds it, use a source-linked rebuild or separately verified engine expansion. Neither is established as necessary by this 109 KiB export.

The allocator improvements are useful, but declaring the storage architecture solved from a successful fixture export was premature. No new APK is issued for this analysis; fixes above remain open.

## Reproduction tools

`MAP_STUDIO_TEST_PROJECT` supplies a private project with its embedded source; no ROM/project is checked in. `scripts/test-private-rom-export.mjs` can write private allocation diagnostics through `MAP_STUDIO_TEST_REPORT`. `scripts/audit-private-rom-storage.mjs` calculates aggregate source and allocation figures. `scripts/test-private-native-noop.mjs` imports the fixture's native map keys afresh; optionally set `MAP_STUDIO_TEST_KEYS=1.0` for the single-map control. These are local external-fixture scripts, not GitHub execution jobs.
