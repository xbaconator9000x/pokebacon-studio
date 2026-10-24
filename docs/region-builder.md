# Build a region

Open **Projects → Build a region**. No source ROM is needed to plan or generate editable maps. Open a compatible ROM before compiling them into a game.

1. Choose 6–20 outdoor maps and 2–6 settlements. Keep at least two route maps.
2. Pick woodland, countryside or a mix. Choose village or town layouts for the settlements.
3. Change the seed to replace the region layout. Reusing the same seed and settings reproduces its geography and object placement.
4. Select a location in the preview to rename it, switch between settlement and route, or change its meadow/forest terrain. Press **Update location** to keep those edits.
5. Adjust connections from the selected location. A change that disconnects the region is rejected. Extra routes add loops; 0% retains the original connected backbone.
6. Select terrain and building sources. Building sources can be mixed independently of the currently opened ROM. Choose service buildings and whether to create their interiors.
7. Choose streams and ponds, woodland scenery and boulders. These can be switched off independently.
8. Press **Build & check region**. Review the results, then **Add region**. Nothing is added until that final step; cancellation and failed checks leave the project intact.

The generated region is added alongside your existing maps. Use Undo to remove that addition. Connect an existing game map to an unused region edge to enter it. All maps, buildings, collision settings and scripts remain editable.

## What gets checked

- The planned locations form one connected graph. Two connections cannot compete for the same edge.
- Outdoor maps use a shared 64-tile chunk grid with aligned three-tile-wide openings. Connections scroll; they are not doorway warps.
- Path edges account for the neighbouring map rather than ending in a cap at the seam.
- Trees and buildings use whole included objects, with no sliced objects across chunk boundaries.
- Exits and building entrances must be reachable on foot. Objects are never deleted to force a failed path through them.
- Settlement generation has at most three attempts per location. Project map, image, object, connection and tile limits are checked before adding the result.
- Interior doors are linked. Included Centre and mart service actions are retained from the settlement generator.

These are geometric and structural checks, not a complete game playthrough. Use the playtester and ROM export review to check the actual result.

## Current limits

The first region builder supports meadow and forest terrain and village/town settlements. The separate town generator retains its other biomes, coastal layouts and city presets. Region routes have clustered woodland, winding walking paths, streams, ponds and masonry crossings; they do not yet generate encounters, trainers, quests or story progression. A dead-end route can be developed into a landmark or event area.

The diagram is a layout preview, not the game's Town Map. Town Map artwork and travel locations are edited separately. Generated maps do not automatically replace the existing game's region or start location.

Generating editable maps does not guarantee that every source ROM has room for all of them. **Export → Edited GBA ROM → Compile & review** checks source compatibility, map capacity, graphics and palettes. Keep an exported project backup.

## Implementation

The region planner is an independent implementation. It grows a connected set of neighbouring chunks from a finite frontier, places settlements at dispersed locations and optionally adds neighbouring edges. Each location gets its own deterministic seed. The planner is separate from terrain, scenery, settlement interiors and validation, so those stages can be expanded without changing the graph rules. Cartographer by Unbayleefable informed the terrain-first approach, route planning and whole-footprint placement checks. Adaptation permission covers non-RPG Maker use. This implementation uses its own world-coordinate noise fields and weighted route search; no recovered Java code or artwork is bundled. See [the original project](https://www.pokecommunity.com/threads/pokemon-region-generator.429142/).

Water uses the included shoreline autotile, with Surf movement away from crossing platforms. Settlement buildings occupy a compact district surrounded by woodland. Shared landscape coordinates and blended forest density soften connected map boundaries. Closed edges retain blocking boundaries.
