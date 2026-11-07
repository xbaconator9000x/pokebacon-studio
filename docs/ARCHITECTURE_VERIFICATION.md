# Architecture verification

This batch extends PR #19 against `development/studio-upgrades`. That branch
contains the 4.70.5 native shell; this change reconciles its stale 4.70.2 web
metadata to 4.70.5. It is not a replacement or downgrade for the separately
delivered 4.72.5 APK. Reconciliation with that later source remains separate.

## Verified locally

- `npm test`: 387 tests; 385 pass, zero failures, two optional fixture skips.
- `node scripts/qa-source-gate.mjs`: passes 1,863 deployed fingerprints,
  Android package identity, version name and version code parity.
- Syntax checks for the new runtime, GBA source implementation, public source
  API, project store, ROM writer and source UI pass.
- `git diff --check` passes.
- Four new lifecycle scenarios exercise FireRed, Emerald, CFRU and Shiny:
  source import, feature and project edits, full split-save/reassembly,
  validation, source ZIP export, embedded project reopening and reimport.
- These scenarios compare every unrelated source file byte for byte, verify
  that original inputs and stored headers remain unchanged, retain sprite
  groups, and verify adapter/build details in the exported report.
- Existing GBA tests cover ROM discovery, rendering, map import, writer
  behaviour and data preservation. These use synthetic fixtures, not a full
  run through the user's Shattered game.

## Not verified locally

The scratch environment has no Android SDK. Native APK compilation and signing
were not performed here. The existing public-repository QA workflow includes
an unsigned Android build and will run for the updated PR. Source-engine ROM
compilation and emulator gameplay were not performed. The new lifecycle tests
exercise the same pure reassembly used by IndexedDB, but do not constitute an
Android device storage test.

No layout or visual controls changed in this batch, so there are no new UI
screenshots to review. The service-worker cache includes the new modules.
No DS editing, new dependencies, paid APIs or external build services were
introduced.
