# Future Nintendo DS integration roadmap

## Scope guard

This is research only. PokéBacon implements no DS import, editing or export in this phase.

| Project | Useful direction | Licence/dependency guard |
| --- | --- | --- |
| [DSPRE](https://github.com/DS-Pokemon-Rom-Editor/DSPRE) | Gen 4 extracted-workspace lifecycle for headers, matrices, maps, events, scripts, encounters, trainers and repacking. | AGPL-3.0 upstream: research only until a deliberate licence decision. |
| [Pokémon DS Map Studio](https://github.com/Trifindo/Pokemon-DS-Map-Studio) | Tilemap-to-3D conversion concept; it does not import original maps. | Java tool with converter dependencies; audit licence/redistribution first. |
| [hg-engine](https://github.com/BluRosie/hg-engine) | Gen 4 engine overhaul as a distinct compatibility target. | Non-standard stated terms; not a reusable dependency without agreement. |
| [pret/pokeplatinum](https://github.com/pret/pokeplatinum) | Source adapter target with revision-specific builds and a separate toolchain; inspect INSTALL and source archive structures at a pinned commit. | README describes a work-in-progress decompilation. Licence and included tool/data rights require per-component review. |
| [pret/pokeheartgold](https://github.com/pret/pokeheartgold) | HeartGold/SoulSilver symbols, overlays and game-specific format research. | Upstream warns that incomplete decompilation can make size/layout changes unsafe. No blanket compatibility claim with hg-engine. |
| [pret/pokediamond](https://github.com/pret/pokediamond) | Diamond/Pearl source and separate revision targets. | Work in progress; pin a specific commit and audit tools/licences before reuse. |
| [Frost's Gen 5 Editor](https://github.com/FrostFalcon/FrostsGen5Editor) | Shared vocabulary: data, trainers, encounters, entities, scripts, text and sprites. | Audit licence/dependencies before reuse. |
| [CTRMap CE](https://github.com/ds-pokemon-hacking/CTRMap-CE) | Game-adapter/plugin architecture validates capability registration for Gen 5. | GPL-3.0 plus Java modules: no embedding/copying without a compatible decision. |
| [Project Holon](https://github.com/Project-Holon) / [pokebw2](https://github.com/fuddlesworth/pokebw2) | Source/data/tool separation and reproducible builds. | Recheck current licences, revisions and ownership requirements before use. |

## Staged work after GBA completion

1. Select one legal game/revision and document licences, dependencies and legal fixtures.
2. Build a read-only, non-mutating fixture inspector.
3. Prove one reversible data-type import/export with byte-level tests.
4. Prove maps/events, then platform-specific build/package/playtest support.
5. Decide which heavy archive/3D operations are viable on Android while retaining the same portable project and user experience.

Future NDS adapters own NitroFS/NARC extraction, NSBMD/NSBTX assets, compression, ARM9/overlay changes and per-game scripts. Shared workspaces receive normalised data only after codecs are proven. No code, assets or binaries may be adopted until licence, attribution, Android viability and zero-paid-overage implications are reviewed.
