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

No project schema or user data changes occur in this phase. GBA remains the shipping priority.