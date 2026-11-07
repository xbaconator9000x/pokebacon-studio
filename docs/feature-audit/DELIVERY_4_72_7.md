# 4.72.7 event development batch — 7 November 2026

## Implemented

- Guided conditions in the existing native event structure editor: check an
  indexed progress flag (set/not set) or compare an indexed story variable
  (equal, unequal, less, greater, at most, at least). Choose separate branch
  continuations and optional dialogue for either branch. Generated dialogue
  waits for input and closes before joining the selected continuation.
- Readable project-local names for existing native flags/variables. Names
  survive saves and reindexing, appear in the readable event view, and do not
  allocate or change any native IDs or count as ROM patches.
- A direct condition shortcut, friendly continuation labels, separate phone
  step/detail tabs and a full-height phone dialog with visible save controls.
  Advanced commands and their original numeric fields remain available.
- Both guided and advanced editing modify the same flow IR and use the existing
  native flow compiler. No parallel ROM writer, copied event engine or inferred
  custom command implementation was introduced.
- Browser CI uses normal desktop Chrome launch flags. The local serverless
  browser's single-process/SwiftShader flags are isolated to that environment.
- Android preview capture handles the native first-launch welcome screen and
  a specifically identified Quickstep launcher ANR. Studio/other ANRs still fail
  the test; failures retain screenshots and logcat rather than being hidden.

## Verification

- Portable suite: **412 passed, zero failed, two optional skips (414 total)**.
- Three Python preview-control checks: welcome/launcher recovery, Studio ANR
  refusal, and rejection of invisible/invalid tap targets.
- Native-byte fixtures for FRLG/RSE command schemas: both flag outcomes, all
  six variable comparisons, split save/reopen, native compile and fresh index.
  Branches join without looping. Other entries sharing a source script retain
  their original binding and bytes. The RSE fixture selects the common Gen III
  script schema; it is not a retail Emerald execution test.
- Real Chromium phone workflow: open an imported event, name an existing flag,
  create true/false dialogue branches, save and reload; names and flow remain.
  Existing sprite drawing/palette/sheet/storage checks also pass. Save controls
  are asserted inside the viewport. Tests produce actual browser screenshots.
- Private Shattered xx1.08 index: 437 maps, 3,666 roots, 31,797 commands,
  336 referenced flags and 88 referenced variables. A condition was added to
  one existing Viridian locked-gate sign entry. Export and fresh reindex find
  both new dialogues; original script bytes and five shared entries remain
  unchanged. ROM/project data stayed outside Git.

## Remaining limits

Names are editor metadata scoped to the imported native graph; they do not
infer a flag's meaning, make an unused ID safe, or unify authored runtime flags
with arbitrary engine state. The guided picker uses indexed existing IDs.
Creating/allocating new quest state safely remains a separate requirement.

This batch does not finish event-page semantics, quest/action-track parity or
arbitrary engine scripting. A structural flow still depends on its original
source/sidecar; refreshing an exported relocated flow against its old baseline
is not claimed to be automatically reconciled. Unknown commands remain opaque.

No emulator gameplay or physical Android acceptance is claimed. The previous
337c954 CI run passed unit/source/Android compilation and iOS, but Chrome launch
and Android preview capture failed. Their causes and repairs are recorded
above; new CI results must be tied to the new commit, not assumed in advance.
No main merge, Pages deployment, public release or paid usage was initiated.

Signed test APK: `PokeBacon_Studio_v4.72.7.apk`, version code 147,
32,816,914 bytes. SHA-256:
`c6908b8640654fc5d3f3202f121faac81cb0e5e80a3f55f9a735e563839cdf9f`.
The native shell and signing certificate match 4.72.6. Alignment, signature and
all 1,863 packaged web assets were verified; the source gate tracks 1,875 files
including the development-only examples excluded from APK packaging.
