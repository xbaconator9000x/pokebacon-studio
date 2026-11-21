# HMA linked native table groups — source-review and atomic export

**16 November 2026 · PR #29** — A narrow implementation slice for HMA-TBL-02, not full generic HMA table parity.

## Workflow and safety contract

Import original HMA TOML anchor metadata and create the corresponding bounded typed layouts for a fixed-count source anchor and **all** of its linked-length sibling tables (examples: `[id::]4` and `[move::]Species+2`). In the typed-table editor choose **Grow linked tables…** and review source pointer sites for every member, the original base count literal site and width, and any optional additional count/Thumb instruction sites. The UI requires explicit confirmation; candidates are not automatically assumed to be valid engine data.

The queued group contains a single base count plan and derived dependent counts; dependency `delta` values come from original parsed HMA metadata and are immutable for this review. The planner rejects missing siblings, duplicate tables, mismatched original anchor definitions, incorrect row formats/addresses, missing/offset/interior pointers, separate dependent count sites, any pointer/count/code write site contained inside another original member table, unknown source count values, and excessive count/size. A regular single-table growth attempt on a known linked root/dependent now fails closed.

The planner validates an entirely detached project before publishing **any** of the grouped plans. Saved project reopen validates group membership and derived counts. Discarding any queued member removes the whole group. On native ROM export all base/dependent table allocations, pointer redirects, original base count updates and selected count-instruction replacements use the existing **detached RomOutput transaction**, publishing only after every step succeeds. Other compiled ROM content and the original source bytes remain untouched on a late failure.

Scope: 2–8 plain HMA fixed numeric tables, max 64 appended rows/64 KiB per member, up to 32 existing queue plans, direct-pointer ownership review and a **human-authored** native base count site. We do **not** infer runtime code usage, dynamic/computed reference sites, generic HMA schema expressions, all engine count dependencies, or fully general HMA metadata compatibility. A group can still require manual engine-specific patches not in the reviewed plan. No acceptance without real native ROM gameplay and save/reimport evidence on verified game/revision. Do not publish copyrighted original ROMs or signed APK keys.

## Regression suite

`tests/hma-linked-expansion.test.js` covers three actual synthetic source-ROM tables with original HMA metadata and derived count offsets, queued appended field editing, all three actual native allocations/count/pointer byte changes, untouched source tables, project split save/reopen, missing dependencies, wrong counts, missing pointers, unsupported duplicate counts, oversized growth, tampered saved group, late second allocation rollback, count-field collision, solo anchor refusal, group-wide removal, and Android UI wiring.

Source identity: package `dev.shattered.mapstudio.next`, versionCode 148, original release certificate fingerprint preserved. CI may build unsigned Android only; physical signed update acceptance remains separate.
