# Studio upgrades

Persistent development backlog. Work stays on development/studio-upgrades; no automatic merge, release, Pages deployment or replacement of the current build. Reuse and audit existing systems before marking anything complete. Implementation is incomplete until editor → save/reopen → native compile → runtime validation passes.

Priority order:
- [ ] Story/scripting upgrade: reconcile draft #11 with current source; visual storyboard/tree, event pages with ordered conditions, saved flags/variables, branching choices, movement/camera queues, battles, cutscenes, repeatability, debugging and native export parity.
- [ ] Reusable event recipes: item pickup/gift with correct engine-specific fanfare, obtained-item dialogue, bag-full failure, success-only one-time completion; hidden items, NPC gifts, shops, healing, trainer battles, Pokémon gifts, quests, locked doors and checkpoints. Retain editable defaults and custom overrides.
- [ ] Sprite editor: touch drawing/zoom/pan, selection/copy/transform, layers, onion skin, animation preview/frame ordering, linked front/back/icon/overworld/follower views, male/female sets, normal/shiny palettes, palette-index transparency, part recolouring, shared-palette safety and verified ROM export.
- [ ] Species/data workflow: audit custom abilities through actual battle hooks; custom moves and effects, level-up/TM/tutor/egg learnsets, stats/types, evolutions/forms, dex text/category/height/weight, encounters, sprites/cries and stable ID allocation. Distinguish editable designs from engine-supported executable features.
- [ ] In-game UI authoring: text boxes/fonts/palettes, windows, HUD/battle/menu layouts, icons and opening/title assets; preview, undo, engine capability checks and reversible native export.
- [ ] Full Cartographer integration: permitted source adaptation, in-app generation rather than import-only; draggable routes, node snapping, multi-biome landscapes, seed controls, progression/encounters/events, matching exteriors/interiors and two-storey buildings, door/connection alignment and runtime verification. Preserve upstream licence/credits.
- [ ] Generators/assets: Coastal/Forest/Mountain/Underground/Metro/City/Village, clusters, cave/ridge/ledge brushes, department-store floors, world map editor, intelligently sorted complete stamps, correct picker and town-matched palettes.
- [ ] Reliability: project-authoritative refresh, stable map/object IDs, conflict review, native layers/collision/elevation, one-way ledges, exits/arrival facing, NPC/event appearance/data, undo/redo, mobile Back/scroll/freeze recovery and ROM→project→ROM tests.
- [ ] Music: preserve Hybrid/Magenta/MusiGAN integration, multipart/whole MIDI source, Atmosphere, all keys/minor modes, track/section naming and selection, seeds, audition/stop, preview stability, MIDI and cry imports and ROM compilation.
- [ ] Engine/integration: CFRU/Shiny CFRU options and honest capability reporting, FireRed decomp export, planned expansion interoperability; CUBE/PKHeX mobile integrations tracked with their separate repositories.
- [ ] Product: help, bug reports, offline/PWA continuity, original signing/package identity, release evidence and recovery checkpoints.

Known source evidence: event-model.js already emits receipt dialogue and engine-specific fanfare for item gifts; this requires exposing consistent templates rather than implementing a duplicate award path. Sprite workbench and creature-model already contain palette/frame tools, ability designs, learnsets and dex fields; audit native coverage before replacing them.

Acceptance for every task: implementation commit + meaningful regression + UI/save round trip + native runtime proof where applicable. Unsupported engines must retain authored data and report limitations. No paid services without permission. Never publish ROMs, saves, projects or signing secrets.

### Locally implemented development increments

- [x] Item pickup recipe/editor integration and consistent scene receipt/fanfare handling.
- [x] Sprite layer lock/movement controls and configurable animation speed.
- [x] Trace reference sizing/position/opacity/visibility/removal and independent model comparison reference.
- [x] Navigable nested script action tree (full event-page upgrade still pending).
- [x] Pokémon data JSON import, native-aligned level-up authoring, moveset paste/level preview and dex text checks/preview.
- [x] Pokémon-editor link to native ability workshop and safer ability design saves.

These are development-branch features, with local validation recorded in PROGRESS.md; they do not imply a released APK or completion of their broader roadmap categories.

- [x] Sci-fi, Horror, Space and Technology music vibes, locally validated through actual Hybrid inference and cartridge/MIDI output.

- [x] Hidden-item tile interaction, key-locked door and toll passage recipes with explicit destinations and guarded native scripts (runtime ROM validation pending).

- [x] Poké Ball editor markers: red visible pickups, dashed purple hidden items; editable override and imported hidden-record detection.

- [x] Sprite rectangle selection and active-layer clipboard; selected flips/nudges, cut/clear, lock/clip protection and undo/redo.

- [x] Large object cleanup zoom/fit/pan and full-cell, complete south-edge repair for both bundled water brushes (native gameplay verification pending).
