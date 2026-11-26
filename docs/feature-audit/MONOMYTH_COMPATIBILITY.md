# Pokémon Monomyth compatibility (v1.0, 32 MB, Emerald-based)

Measured on a real, legally acquired `monomyth_v1_0.gba`. No ROM data is in this repository. Re-run `node scripts/check-private-monomyth.mjs path/to/rom.gba` to repeat the map checks.

## Working (read and export of maps)
- Engine is detected as Ruby/Sapphire/Emerald data. Tilesets use three-layer (24-byte) metatiles with the attribute table stored after the metatile table. This is now detected (`metatileFormatAfterAttrs`).
- All 828 maps load. 661 have no tile problems. 166 have a few blocks whose tile numbers are past the end of the tileset's stored graphics (1.2% of their cells in total, six maps over 10%). The likely cause is tiles filled at runtime, for example animated tiles. This is not confirmed and these tiles render blank.
- Map 6.17's secondary tileset points at empty data and now loads with no graphics instead of failing.
- Exporting a map with no edits gives a byte-identical ROM (tested on 0.0).
- Exporting a repainted map writes new blocks after the original data, changes only layout pointers elsewhere, and the new ROM reads back with the edit.
- Exporting repoints every layout sharing that tileset pair to the new tilesets. One other sharing map (0.12) was pixel-identical afterwards.

## Not working or not checked
- **Dialogue.** About 2,400 of the dialogue texts in the first 80 maps start with the control code `FC 1D` followed by bytes that do not look like normal text (high entropy). Monomyth appears to store dialogue in a format this editor does not know. These texts are reported as unreadable and have no editable text record. Do not edit them. Decoding needs the game's own text routine to be identified first.
- Event structures (NPCs, warps, signs, triggers) have standard sizes and parse sensibly (8,396 of 8,428 NPCs kept; null scripts and the dynamic warp 127.127 are normal). Script commands decode for the first 80 maps, apart from the text above. Nothing has been checked against the game's own custom routines.
- Running an exported ROM in an emulator or on a device has not been done. Exported ROMs are unverified in play.
- Editing events, scripts, trainers and species on Monomyth is not enabled or reviewed. No Monomyth engine profile exists yet.
