# Comparative editor and reuse review

See upstream-evidence.json for exact commit pins, dates, licences and source links. Maintenance dates here describe the inspected branch head only. They are not a compatibility endorsement. Selected source was inspected; these desktop editors were not interactively executed during this session.

## HMA — primary functional benchmark

Inspected PokemonModel, ModelDelta, ChangeHistory, ScriptParser, map tooling, palette tooling and engine metadata/reference files. The useful design is a typed model of data runs with pointer sources and named anchors, reversible model changes, semantic tables, scripts, maps and image ownership. The metadata includes ordinary event commands and specialised battle/AI references. Its UI joins map selection to text/trainer/script context.

PokéBacon should match the practical controls: table row creation/duplication/deletion, constants and cross-references, pointers and relocation, text growth, palette/tilemap ownership, trainer composition, map events, scripted battles, battle/animation/AI command families, patching and recoverable changes. A visual editor must retain advanced values and raw commands on the same data.

Reuse recommendation: first evaluate MIT metadata/schema and small pure core algorithms using golden fixtures. A direct WPF desktop port is a poor Android/web fit. Even the core needs dependency separation (.NET, UI command interfaces, serialization and model contracts). A .NET/WASM experiment may be worthwhile only if measured against JS integration cost and mobile memory. Never run HMA's writer and PokéBacon's writer independently against the same output; use reviewed import/normalised change sets into the single authoritative export pipeline.

HMA does not confer compatibility with arbitrary Shattered native functions. Metadata must pin signatures, symbol meanings, argument contracts and resource ownership.

## CUBHMA — verified Cradi fork and additional requirements

Canonical source is [kcradi/CUBHMA](https://github.com/kcradi/CUBHMA), pinned at ac5a6405fd73e884ffd7ae0fdf4beba56f64cdb9 (CUBHMA 0.7.3, 2026-10-30). GitHub repository metadata identifies haven1433/HexManiacAdvance as its parent and source. The repository retains HMA's MIT licence. Its README identifies Cradi's Unofficial Build and explains its focus on Cradi's Ultimate Build of Emerald (CUBE). CUBHMA is an editor fork; CUBE is a game-engine distribution. They are not interchangeable names or evidence of Shattered compatibility.

Selected actual implementations add concrete parity requirements:
- OverworldSlotImport.Prepare detaches shared picture lists and can allocate a separate palette tag before editing. ReflectionPalette and CharacterCustomization handle additional palette contexts; colour-role metadata distinguishes skin, clothes and secondary channels. A generic pixel canvas does not supply these engine bindings.
- ExpansionTrainerTeamRun describes expansion-specific party fields, including pointers, IV/EV data, ability, nature, gender, shiny, Tera and Dynamax fields. Its omission-preserving text updates illustrate why expanded teams cannot use a vanilla fixed record blindly.
- PokemonAnimationLayout/Timeline reads engine-specific front-animation commands and frame images. The animation engine is distinct from merely previewing a sequence of PNGs.
- MidiToAgb exposes priority, reverb, voicegroup, clock resolution, exact gate times and compression. Sound tooling includes M4A playback and voicegroup models. MIDI import without native instrument mapping is incomplete.
- CubeUpdateService fingerprints known CUBE versions and uses a graph-based migration; it does not transplant arbitrary custom ASM. Its recursive worker uses a 512 MiB stack, unsuitable as-is for Android. Study provenance/ownership contracts rather than importing this desktop execution strategy.
- ApplyCubeOptimization plans on a snapshot, retains only shorter compressed streams that decode identically, and gates its operation on CUBE identity. Unknown or SMOL streams are excluded. This is useful evidence for safe recompression, not a universal way to recover free ROM space.
- ModelEditStamp invalidates stale model views without rebuilding all tabs. Intro/spawn and event-template source/tests also reveal missing engine-specific workflow controls; these require focused execution review before adoption.

Comparison against the independently pinned HMA head changes 365 files, including metadata/binary/generated content; this is a point-in-time tree comparison, not an ancestry attribution or a count of unique features. Upstream source/tests were inspected but not compiled or executed here. Nine additional inventory records capture these requirements within the existing capability categories.

Reuse recommendation: evaluate small MIT model algorithms, schemas and golden test vectors behind PokéBacon's existing adapter and single writer. Do not port WPF controls, ship upstream ROM patches/assets, bypass source hashes for speed, or assume CUBE hooks work in FireRed/Shattered. Review component dependencies and preserve attribution before copying anything. Begin with ownership-safe sprite editing, versioned expanded-party schemas and lossless compression fixtures; defer engine-update migration until provenance and rollback are proven.

## Porymap — source maps, event context and metadata

Inspected core map connections, event coordinate controls, map headers and palette editor. Porymap targets Gen III decomp projects rather than being a generic binary writer. Connected boundaries, border drawing, collision/elevation, custom attributes, encounters, prefabs and engine configuration are useful workflow references. Its event coordinates permit signed/off-map entities, relevant to cutscenes.

PokéBacon already has map painting, seams, cropping and generated interiors; extend these rather than replacing them. The big gap is source-authoritative map/event writing: exporting source with a project JSON backup is not equivalent to generating decomp map/layout/event files. Qt/C++ widgets should not be ported wholesale. LGPL-3.0 code adaptation requires component-specific compliance. Prefer compatible source formats and tested conversion at the adapter boundary.

## Poryscript — structured scripting, not a decompiler

Inspected parser and emitter structure: scripts, raw blocks, text, movements, marts and map scripts feed an AST and compiler. The useful abilities are branching, loops, inline resources, text formatting and diagnostics. It does not recover unknown native engine logic automatically.

MIT Go code offers a practical external source compiler or a measured WASM candidate. First preserve its syntax/AST contracts and golden source output. Do not build a second incompatible native event writer. Visual flow editing should compile through an engine-aware intermediate representation with source locations and an advanced text view.

## Advance Map — workflow reference only

Official developer pages document binary map/header/block/event workflows and an old Delphi-to-Lazarus rewrite. No reusable source or licence was established. The official maintenance note limits confidence in current support. Use the workflow to identify missing border/header/connection/behavior controls, not as code to copy or a safety model. The historical resize corruption warning reinforces transactional/export-preview acceptance.

## RPG Maker XP and Pokémon Essentials

The XP editor is proprietary; its event-page UI is a workflow benchmark. Inspected Essentials Game_Event refresh/page handling, Interpreter command dispatch, movement waits, compilation and plugin management. Conditions, ordered page selection, self-switches, action/touch/autorun/parallel triggers, nested branches, common events and command parameters are separate capabilities.

PokéBacon's native script graph is useful but not equivalent to these page semantics. A parallel trigger also differs from launching multiple movement tracks and waiting for all actors. Document both the scheduler and export semantics rather than giving every event the same “parallel” checkbox.

Essentials source is Ruby/RGSS, PBS and RXDATA-based. Its inspected repository carries CC-BY-NC-SA-4.0; RPG Maker/runtime and assets have separate terms. Adapt workflow/format ideas and maintain explicit boundaries with the separate Essentials Studio project. Do not convert or execute imported Ruby silently or treat the Shattered remake as a GBA ROM.

## Engine source workflows

pokeemerald-expansion's configuration headers contain version-dependent numeric/symbolic settings; mapjson/gbagfx tools, source window templates and native C callbacks matter as much as boolean switches. CFRU configuration distinguishes saved runtime flags/variables from compile-time options and structural installation requirements. Bag or trainer-card windows are one part of a screen alongside tilemaps, palettes, sprites and code.

The current source scanner edits a safe subset of directives. It does not expose all symbolic enum choices or resolve all engine dependency combinations. Prefer engine-provided constants, symbol/build manifests and reproducible build reports. No blanket reuse licence was located at the inspected roots of these engine trees; individual tools/credits/assets need review.

## Pixelorama and LibreSprite

Pixelorama's MIT source exposes layers, visibility/locking, clipping, animation state and independent reference images with filters/opacity. LibreSprite's GPLv2 source includes timeline/onion-skin, palette and document undo logic. These demonstrate that reference images, layer/cel/frame identity, onion-skin preview and export pixels are distinct data.

Keep PokéBacon's indexed sprite model and improve its touch workspace: persistent canvas, collapsible palette/tools, sheet/frame navigation, linked views and a preflight panel. Pixelorama is GDScript/Godot; LibreSprite is native C++ with UI dependencies. Treat either as full logic integration only after a dependency/performance experiment. Do not confuse modern Aseprite's licence with LibreSprite's historical GPL fork. No sprite/art assets were copied.

## Tiled — connected worlds and intelligent painting

Inspected libtiled world/Wang data and editor automapping management. World placement, terrain constraints, rule-based brushes, object properties, reusable templates and grouped undo are useful. libtiled has BSD-licensed parts while editor automapping is GPL-2.0-or-later. Audit file headers before copying.

Recommended approach: import compatible authored rules/data where lawful; retain PokéBacon's GBA metatile/collision semantics and export writer. Use Tiled as a benchmark for rule preview/explanations and world selection, not a replacement frontend.

## VGMTrans and specialist audio

Inspected the zlib-licensed MP2K scanner/sequence modules: detection validates player parameters and ties sequences to instruments, rather than treating a song as MIDI notes alone. It is a good candidate for targeted codec/detection adaptation if current music tests demonstrate a missing format. Preserve tempo maps, loop points, samples, envelopes and native voice limits.

PokéBacon already has an extensive MIDI, arrangement, native music and cry stack. Reuse its score and export pipeline. General SFX editing, multi-engine detection and actual on-device neural inference need separate verification; do not replace existing Hybrid/Atmosphere work.

## PKHeX — optional save tooling

Inspected SaveFile and LegalityAnalysis under GPLv3. Save checksums, trainer/party/storage and legality are useful only for the optional save-workspace boundary. They are not ROM species/trainer/script editing and cannot satisfy ROM parity counts. Any integration belongs behind its own adapter with game/save version checks. Existing paused PKHeX work is not resumed by this audit.

## Remaining specialist source reviews

LDtk, Godot/GDevelop action graphs, font/tilemap and battle-animation editors, Sappy/GBAMusRiper, and additional engine-specific debug tools remain named follow-up research. They may add requirements; they are not counted as source-reviewed here. Do not repeat settled source reviews unless a concrete new requirement or revision warrants it.
