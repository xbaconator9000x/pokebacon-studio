# Dependency-aware roadmap and gap backlog

Canonical tracking: [audit #20](https://github.com/xbaconator9000x/pokebacon-studio/issues/20), [feature backlog #15](https://github.com/xbaconator9000x/pokebacon-studio/issues/15), [adapters #18](https://github.com/xbaconator9000x/pokebacon-studio/issues/18), [release acceptance #14](https://github.com/xbaconator9000x/pokebacon-studio/issues/14). Reuse those issues and draft event-page PR #11; do not create a fresh issue for each inventory row.

Complexity is a relative planning label, not a duration promise: M is a bounded cross-module slice, L is multi-system integration, XL needs engine/runtime work and substantial acceptance.

## Immediate delivery sequence

| Batch | Priority / complexity | Dependencies | Coherent deliverable and stop gate | Tracking |
| --- | --- | --- | --- | --- |
| REL | P0 / L | none | Reconcile delivered source; fix history save scope; prove storage/exports/reimport, ownership and failure recovery. Gate: data preserved through reopen and native export on target fixture. | #18, #14 |
| EVT | P0 / XL | REL | Imported-event inspector + visual/advanced editing, unknown command retention, shared-root review, conditions/IDs, reconcile draft pages. Gate: edit an existing Shattered gate/Aipom event and execute both branches. | #15, PR #11 |
| SCN | P0 / XL | EVT | Draw movement paths; action tracks and join/cancel semantics; human-readable conditions; scene diagnostics. Gate: multi-actor cutscene behaves and saves correctly in game. | #15 |
| QST | P0 / L | EVT, SCN | Quest graph, named state, composed recipes, failure/retry, repeatability and rewards. Gate: quest accept/refuse/complete/revisit tests with native persistence. | #15 |
| NPC | P0 / L | REL, EVT | Searchable NPC context, actual appearance/profile, trainer team/range/approach/rematch controls. Gate: complete trainer win/loss/rematch and reimport round trip. | #15 |
| MAP | P1 / L | REL; EVT for triggers | Connected canvas, intelligent path/water/room handling, seam/border diagnostics, resize and cross-map references. Gate: traverse all edited exits and borders in both directions. | #15 |
| ART | P0 / L | REL; MAP for tile ownership | Reconcile latest sprite workspace, touch canvas/docks, player/outfit navigation, palette/VRAM ownership. Gate: edit real player/NPC/mon and see exported frames/colours correctly in game. | #15, #14 |
| SHA | P0/P1 / XL | EVT, NPC, ART; source/symbol manifest | Versioned Shattered extension metadata for HUMAN, equipment, stamina, classes, partner/riding and custom calls. Gate: existing custom behavior remains intact after visual edit. | #15, #18 |
| MON/ITM | P1 / XL | REL, SHA where custom | Native data CRUD, teachability/evolution/form slot validation, items/equipment/shops and cross-references. Gate: actual encounter/evolution/equip/battle/save tests. | #15 |
| UI | P1 / XL | REL, ART, SHA | Reconcile 4.72.5 UI work; source screen ownership/templates, compiled layouts and text/fonts/HUD. Gate: altered bag/trainer/options/battle screen running in target engine. | #15 |
| AUD | P1/P2 / L | REL | Retain existing composition stack; close detection/SFX/sample and on-device model gaps. Gate: native audition with correct loop/voices and reopened score. | #15 |
| UX | P0 cross-cutting / L | every batch | Phone interaction/accessibility/performance, contextual help, recovery, original-key update. Gate: independent user can complete task without programming or hidden controls. | #14, #15 |

Do not wait for every parity item before delivering REL → EVT plus NPC/ART. MAP and bounded ART work can proceed once REL contracts are stable. QST depends on actual event-state semantics; UI cannot bypass asset ownership. DS remains deferred.

## Highest-priority findings

1. **Version/source drift:** architecture branch is based on 4.70.5; delivered 4.72.5 work is not reconciled here. Never label later UI/sprite work globally absent or release an older branch as an update.
2. **History persistence:** sourceEngine/text/region/cry/door/HM undo/redo could be saved with a map-only scope. Current batch fixes that caller using one shared section registry. Direct mutations must still use the documented scope contract.
3. **Unknown scripts:** native graph preserves unresolved entries, while raw disassembly throws on unknown opcodes. There must be one clear read-only/unsafe-relocation policy across both views.
4. **Two authoring models:** native story graphs and authored scene templates are not identical. Bridge them through stable typed actions or explicitly linked source nodes; do not discard advanced/native data when opening a simplified view.
5. **Native versus preview:** scene previews, presentation timelines and creature designs cannot count as native functionality without a matching compiler/profile and execution evidence.
6. **Profile-specific support:** Shattered's guarded data/hook adapters do not support arbitrary updated custom code. Refine capability declarations per revision and require source/symbol manifests.
7. **Resource ownership:** isolated free-space, sprite, palette, tileset and script guards need a common review of aliases, shared changes and capacity before export.
8. **Phone acceptance:** repeated historical screenshots show canvas occlusion/scrolling issues. Preserve touch target sizes, move secondary tools into docks/sheets and prove the task on a representative phone viewport/device.

## Deferred parity work

Battle AI/effect/animation scripting, arbitrary fonts/native menu code, comprehensive source-map conversion, crafting, generic plugin execution, save-editor integration and advanced bulk data balancing follow the immediate usability milestone. Each remains in inventory with priority/acceptance, not silently dropped.

## No automatic completion

“Implemented” requires a code path; “tested” names exact fixtures/stages; “integrated” requires inclusion in the canonical source; “released” requires the delivered build identity and user-facing acceptance. Update each independently. Existing green CI is evidence for that commit, not all future branches or game engines.
