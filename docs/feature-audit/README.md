# PokéBacon comprehensive feature audit

This is the persistent entry point for subsequent development sessions. The first pass covers **98 capability records across 13 major categories**, with smaller controls and dependencies inside each record. Twelve upstream source trees are pinned, including the independently verified Cradi CUBHMA fork. It is a broad source review, not a claim that every editor has been exhaustively reverse-engineered.

Read in order:
1. [Roadmap and delivery gates](ROADMAP.md)
2. [Capability inventory](INVENTORY.md) and [machine-readable fields](inventory.json)
3. [Comparative editor review](COMPARATIVE_EDITORS.md)
4. [Workflow acceptance matrix](WORKFLOWS.md)
5. [Shattered compatibility contract](SHATTERED_BENCHMARK.md)
6. [Pinned upstream evidence](upstream-evidence.json)
7. [Verification and unfinished audit](VERIFICATION.md)
8. [Recovered delivered-source reconciliation](DELIVERED_SOURCE_RECONCILIATION.md)

## Baseline and status discipline

Audited implementation starts at PR #19 commit 57fde6d. The original 4.70.5 branch has now been reconciled with the delivered 4.72.5 web assets for the **4.72.6 signed test update**. Both recovered work and later Git fixes are retained. The APK preserves the exact delivered native shell; physical update/gameplay acceptance remains open. See [delivery evidence and limitations](DELIVERY_4_72_6.md).

Each inventory record carries controls, upstream references, code/test evidence, limitations, dependencies, reuse direction, complexity, priority and acceptance criteria. Stages are distinct: planned, implemented, tested, integrated and released. No native feature is labelled fully verified solely because a unit test or button exists. None of these records claims a complete Shattered gameplay round trip.

The immediate milestone is independently editing an existing Shattered event, NPC/trainer and connected map safely. Full HMA/CUBHMA parity is a long-term target. No DS editing is scheduled here.

## Session protocol

- Read this roadmap, inventory and open GitHub work before selecting a task.
- Pin current repository/source/release versions; preserve later and unrelated work.
- Start with the highest-priority unmet dependency. Reuse completed work.
- Implement one coherent acceptance slice, including error paths and recovery.
- Record implementation commit, exact tests, engine/revision and execution evidence.
- Update the relevant inventory records and existing issue checklist; do not equate PR creation with integration/release.
- For native features require Import → Inspect → Edit → Save → Reopen → Export → Execute → Reimport → Validate.
- Record skipped stages with reasons; never manufacture screenshots or infer gameplay from a preview.
- Keep private game files, saves, project assets and signing credentials outside Git.

## Current useful improvement

The source-settings undo/redo persistence defect has a fix in this batch. A shared split-section registry now drives undo/redo save scope, covering text, region, cry, door and HM sections as well. Map-only strokes retain incremental saves. The raw planSave map-only API still intentionally omits unchanged section payloads: callers must supply the correct scope. Actual IndexedDB API tests use fake-indexeddb; they do not claim a physical Android test.
