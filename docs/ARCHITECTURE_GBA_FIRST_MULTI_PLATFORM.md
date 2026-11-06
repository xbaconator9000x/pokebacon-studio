# PokéBacon Studio: GBA-first multi-platform architecture

PokéBacon remains a GBA editor. This is an extensibility boundary, not a DS editor or a rewrite.

## Current boundary

`dist/platform-adapters.js` is the capability registry. An adapter declares platform, generation, delivery type, engine family and only capabilities it actually supports. Shared workspaces must request capabilities rather than assume GBA offsets, palettes, map layouts or script opcodes.

## GBA adapter registrations

| Adapter | Delivery | Existing path |
| --- | --- | --- |
| `gba-rom-frlg` | ROM | FireRed/LeafGreen binary importer/writer |
| `gba-rom-rse` | ROM | Ruby/Sapphire/Emerald binary importer/writer |
| `gba-source-pokefirered` | source | source archive inspection/export |
| `gba-source-pokeemerald` | source | source archive inspection/export |
| `gba-source-cfru` | source | source archive inspection/export |
| `gba-source-shiny` | source | source archive inspection/export |

The portable project remains the shared lifecycle: import, inspect, edit, save, export, reopen and validate. A future adapter must supply codecs, import/inspect, validation, export/build/patch and playtest hooks. It may not advertise a capability until those are verified.

## Implemented operations

`source-project.js` retains the public API used by existing workspaces. It now
resolves a bundled runtime from `platform-runtime.js`. Each runtime provides
inspection, validation, export, sprite encoding/decoding and external build
requirements. `gba-source-project.js` owns the existing GBA source pipeline.
Family mismatches fail before export; saved projects cannot register code or
choose executable modules. The ROM writer's family guard also reads the
registry. Binary data layout details remain inside the GBA reader/writer.

Capabilities describe export operations, not all the tools visible in Studio.
Source maps, events, trainers, UI templates and in-app compilation are therefore
not advertised by source adapters. Missing and inherited capability names fail
closed. Game/revision-specific ROM features continue to use their existing
signature checks; a family descriptor never bypasses those checks.

`project-store.js` now exposes the same pure key-list/reassembly functions used
by IndexedDB reopening. Tests exercise full saves, portable JSON and source ZIP
round trips for all four source engines, preserving original maps, unrelated
binary files, feature edits and sprite groups. Reassembly leaves the stored
header unchanged. Service-worker precaching includes the new modules.

## Audit findings and deferred work

| Boundary | Reusable today | Remaining restriction |
| --- | --- | --- |
| Workspaces | DOM/canvas interaction, touch gestures, selection, undo | Some canvases/models assume 16-pixel tiles; DS maps need a separate rendering implementation behind the same workspace. |
| Projects | Portable v1 JSON, split IndexedDB, edit history | Snapshot/undo and storage have independent field lists; new platform payloads need preservation tests before schema additions. |
| Assets | Indexed sprite frames, palettes, animation models, GBA codec functions | GBA 4bpp, RGB5 and LZ are not general DS graphics codecs. |
| ROM | FRLG/RSE map reader/writer, signature-based feature validation | Pointer arithmetic and allocation are GBA internals. They must never receive a DS image. |
| Source | Archive normalisation, source review/export, feature and asset edits | Paths, configuration macros and MP2K songs are GBA-specific; source maps/events remain preserved rather than compiled from Studio maps. |
| Build | Python helper and external engine toolchains | No compiler on Android; source export success does not prove native game execution. |

## Next integration gates

Keep current GBA features moving. Additional capabilities should be registered
only as the corresponding reader/writer is implemented and verified. Do not
normalise every editor model in advance. A future DS codec must prove bounded
decode, reversible encode, revision detection and preservation of unknown
fields before its workspace integration begins. No dependencies or paid
services were introduced by this change.

No project schema or user data migration occurs in this phase.
