# QA readiness and source recovery — 29 October 2026

## Why this branch exists

**Do not treat successful tests on the old repository as evidence that the user's current app works.**
The main branch was identified at 4.38.0, while the latest available Android APK is 4.66.0. The last recoverable source checkpoint is 4.62.0. Production web assets have been recovered from the user's own 4.66 APK: 13 modified and 2 added JavaScript files relative to the 4.62 checkpoint. The recovered APK production web assets are **not a complete replacement for native Android build scripts, project metadata, tests or credentials**. A full source tree must be reconciled first.

The canonical recovered asset SHA-256 values are in `qa/recovery-466-manifest.json`. The version gate fails intentionally on a repository older than 4.66.0, including current main. For a 4.66.0 package, all 15 baseline asset fingerprints must match. Newer versions must establish their own release evidence; passing the version gate is **not** proof of a reproducible Android build.

## Automated coverage

`.github/workflows/pokebacon-qa.yml` is designed to run on pushes, pull requests, daily at 02:23 UTC, and manually. **GitHub scheduled workflows only run from the default branch**, so the schedule will not start until the workflow is reviewed and merged. The workflow uses standard GitHub-hosted runners, no external AI API or paid repair service, restricts permissions to read-only, sets job timeouts, cancels superseded runs, and saves portable test logs for seven days.

- `source-parity` independently blocks releases based on stale/mismatched 4.66 source.
- `portable-regressions` runs the existing repository's `npm test` suite plus `tests/music-existing-song.test.js`.
- The music test starts from an existing encoded music **asset** (generated synthetically for copyright-safe CI), decodes it, transforms the existing score without modifying the source, recompiles it and reads it back.
- Five separate checkpoint tests under `tests/*.mjs` were executed locally against recovered 4.66 web production source and passed: authority guards, native exit authority, native layer encoding, project authority and refresh matching. These tests are not yet installed or executed in GitHub Actions from the reconciled repository.

## Known acceptance gaps — not verified or finished

- **Existing-song music arrangements**: a synthetic asset test does not prove that a user can open Pallet Town from their authorised ROM, select a full-song Shattered filter, change the major-key harmony to minor, alter tempo/voices and save a recognisable working in-ROM arrangement. A musical quality listening gate is also needed.
- **Full ROM round-trips**: restore original native map layers, movement, elevation, events, connections, door directions and arrival positions; compile ROM; cold boot and play in mGBA. Use privately supplied authorised ROM fixtures outside Git history, never publish Nintendo ROM binaries or Shattered user saves.
- **Event editor completeness**: branching, conditional flags/variables, movement queues, camera, scripting, state transitions, battle hooks and repeatability; confirm that UI authors all required behaviour and exporter preserves it.
- **Android**: reproducible offline APK, install/update continuity, storage and platform permissions; physical-device testing remains unverified.
- **Integration**: importing JSON alone is not compilation. Exercise project import → edit → compile → emulator → reimport; fail if resulting game behaviour changes unexpectedly.

## Reconciliation procedure

1. Start from the recovered 4.62 source checkpoint, overlay the 15 updated 4.66 web files, and keep a read-only copy of both inputs. Check source provenance and licensing before commit.
2. Compare this tree against the existing GitHub repository. Preserve user-facing documentation, support files, notices and any independently updated modules.
3. Update the top-level package/build metadata to the **actually verified** version; replace old scripts with verified newer native/Android implementations. Do not upload ROMs, saves, user JSON, certificates, signing keys, generated APKs or old embedded builds.
4. Open a reviewable source synchronization PR, run portable unit tests, UI tests with their dependency runtime, a clean APK build, and ROM/emulator acceptance with private fixtures. Record PASS/FAIL/SKIPPED with actual evidence.
5. Only after reconciliation and passing checks, merge source and enable scheduled QA on main. For each confirmed bug, create a regression test and repeat the full relevant workflow.

## Cost guard

No external commercial AI API, auto-spending, paid runner, automatic code-writing bot or auto-merge is enabled. GitHub Actions may be subject to the account's usual usage terms; keep budgets and execution timeouts configured. QA failures require review, they do not authorise unattended code changes.
