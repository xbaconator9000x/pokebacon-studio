# Import a Cartographer region

Cartographer creates the region on a computer. PokéBacon converts its generated maps for GBA editing and ROM export; the desktop generator is not bundled or run inside the app.

1. Generate your region with Cartographer 1.3 and choose **Output Map files**.
2. ZIP the generated project's `YAML`, `Data`, `Graphics` and `CartographerOutput` folders. Keep the folder structure. No Ruby packing step is needed: PokéBacon reads `Tilesets.rxdata` directly. You can use unpacked `Tilesets.yaml` instead.
3. In PokéBacon, open your supported GBA base and choose **Projects → Import Cartographer region**.
4. Choose the ZIP, check the terrain-tag mappings and select **Convert & review**.
5. Review the conversion report, then import. Existing maps remain and Undo removes the import.
6. Link your game's accessible starting area to the imported region, check its collision and events, then use **Export → Edited GBA ROM → Compile & review**. Check the exported artwork and playtest the saved ROM.

The converter keeps the source tile positions, resizes 32-pixel artwork to 16 pixels without smoothing, assembles XP autotile corners, and separates ground from overhead artwork using source priorities. Passage tables supply movement defaults. Conventional water/grass tags are suggested and can be changed before import.

Large maps are split into connected sections no larger than 64 × 64 tiles. Imported edge connections retain their offsets. Fixed-coordinate transfer events become one-way doors/warps. Simple unconditional dialogue becomes an editable event. Conditional pages, scripts and other unsupported commands are reported for manual conversion. They are not executed as Ruby.

There are limits: the current project supports 80 maps (including interiors), 400,000 total map cells and 512 assets. Some source edge layouts need splitting/adjustment because one GBA chunk cannot safely use multiple continuous neighbours on the same edge. Invalid or missing destinations stop conversion. Animated autotiles use their first frame. Directional passage cells that have no verified native equivalent are blocked and reported. NPC graphics/movement require native character assignment. Encounter and trainer PBS data, source music and the Town Map are not automatically installed by this map importer.

GBA palette, tileset and ROM-space limits are checked during native compilation. A successful editable import is not a guarantee that every Essentials script or map will fit a particular ROM.

Cartographer is by Unbayleefable: https://www.pokecommunity.com/threads/pokemon-region-generator.429142/

The importer is an independent file-format converter. It does not redistribute Cartographer's executable or artwork. YAML parsing uses js-yaml 4.1.1 (MIT). The XP autotile quadrant lookup comes from SerifeusStudio/rpgmaker-xp-mcp (MIT). Their notices are included under `dist/vendor/js-yaml` and `dist/vendor/rgss-autotile`.
