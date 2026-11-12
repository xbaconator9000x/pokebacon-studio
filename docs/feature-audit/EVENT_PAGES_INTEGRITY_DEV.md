# Event-page identity and malformed-import integrity — development batch

Base: 4.72.7 on current main, carried in PR #29 on development/studio-upgrades. This is not an APK release or Pokémon gameplay proof.

## Repairs

- A duplicated page now receives fresh stable IDs for each nested action, including conditional yes/no/then/else/cancel branches and individual multi-answer choice action queues. The source page remains unchanged.
- Page duplication validates the draft before first enabling pages, preventing partially consumed original scene actions when a malformed clone or invalid ID is rejected.
- Empty, malformed and oversized page collections yield explicit validation errors; the priority selector ignores malformed page entries instead of throwing.
- Scene diagnostics return actionable errors for malformed imported page collections or nested actions rather than crashing the inspector. The visual scene editor now pauses page actions and exposes an explicit editable page-JSON recovery panel. Validation must pass before applying a replacement; failed validation leaves the original page list unchanged.

## Verification

Regression tests added to `tests/scene-pages.test.js` cover deep ID uniqueness, no source mutation, maximum-page refusal, malformed import resilience, validation-first JSON recovery and actual project-store save/reopen plus generated FRLG native script-byte compilation for a page-priority flag condition. Native script compilation is **not an emulator run**.

Open gates: retail/modified FireRed and Emerald runtime execution of page selection, private Shattered ROM export/reimport/gameplay, on-device touch/edit session, Android original-key update and full runtime cross-system state validation. Existing visual page UI and authored scripts are reused, not replaced. No private project/game assets, signing keys or copyrighted ROM binaries committed.
