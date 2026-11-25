# PokéBacon event-authoring integration — safe trades and cross-map review

14 November 2026 · Development batch for PR #29

## Native item exchange integrated across two editing systems

The basic Events & Triggers editor and the advanced Visual Scenes editor now share a single native item trade action. It takes two different native item IDs, quantities from 1–999, and an optional award receipt. An editable repeatable Barter recipe is available in Events; the existing one-time item-exchange/quest recipe and Visual Scenes **Fetch supplies** and **Item exchange** presets use this new action instead of a potentially partial two-item operation.

**Native ROM source generation:** check the player's requested item and check Bag capacity for the reward *before* removing payment. Only after both checks succeed, remove the requested item and give the reward. If the native add-item call unexpectedly fails, attempt to refund the removed item before ending the script. On success the receipt and engine-specific fanfare (FireRed/LeafGreen or Ruby/Sapphire/Emerald) are played once. Failed checks jump out of the event before its end-of-event completion flag is written. Existing custom item and manual two-step actions are preserved; the new action explicitly uses native item IDs, and rejects missing ROM item-table records.

**Project preview:** a pure inventory transaction calculates a prospective Bag state without modifying the original. It rejects insufficient payment, missing reward capacity and overfull item stacks. Only successful previews replace the preview Bag with the complete new state. Preview storage capacity can be supplied where known; otherwise runtime Bag occupancy remains an explicit emulator-acceptance limit.

**Native limitations:** GBA script operations are sequential rather than a database transaction; the refund is a defined compensation path, not a guarantee against out-of-band engine modifications. A full Bag may cause an exchange to be refused even if removing the payment could free a slot; this is conservative. Normal native ROM item IDs, user editing, original ROM ownership, quest save adapters and build constraints still apply.

## Event health across all maps

Events & Triggers now includes **Audit all events**. It inspects up to 10,000 authored events without changing project data or imported binary commands. The results are filterable (all / warnings and errors / errors only) and link directly to the correct map and event editor.

The audit reports invalid sequences and scene pages, overlapping tile triggers, unresolved one-time completion bindings, reused completion flags requiring an explicit decision, reward-before-payment item chains and native portal-trigger caveats. It does not assume the compiled game can execute a script just because its editor shape is valid.

## Source and acceptance

Modified source: dist/event-trade.js, dist/event-model.js, dist/event-ui.js, dist/event-recipes.js, dist/event-presets.js, dist/scene-compiler.js, dist/scene-ui.js, dist/authoring-model.js and dist/event-audit.js.

Targeted regression: tests/event-native-trade.test.js and tests/event-audit.test.js (pure preview, source guards, real FRLG/RSE script byte compilation, both authoring systems, recipe safety and project audit / mobile UI wiring).

This is a real editor and compiler integration batch. Hardware Android acceptance and tests of modified private original ROM gameplay remain separate and must not be inferred from passing portable tests.
