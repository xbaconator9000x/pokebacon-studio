# Shattered Map Studio

Shattered Map Studio is a phone-friendly editor for Pokémon-style Game Boy Advance projects. It combines map authoring, object and interior libraries, event and quest tools, native game-data editing, world-map layout, sprite editing, music tools, and an offline playtester.

This repository contains the browser editor, its bundled public assets, the offline Android wrapper, and the portable test suite. It does not contain a game ROM, extracted ROM dump, signing key, or user project.

## Use the editor

The editor is a static web application. Serve the repository root over HTTP, then open `dist/index.html` in a browser:

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080/dist/> and choose **Projects → Help & shortcuts** for the in-app guide.

The included **Publish editor page** workflow deploys `dist/` to GitHub Pages on pushes to `main`. After the first successful workflow run, GitHub shows the published page under the repository's **Deployments** menu.

1. Choose **Open ROM** and select the `.gba` file you are authorised to edit. The original file remains unchanged.
2. Import maps or create a new planning map.
3. Paint the ground first, then use **Layers** for details, objects and overhead tiles. Use **Connections** to join maps and **Collision** to check movement before exporting.
4. Use **Game workshop** for scenes, dialogue, quests, shops, Pokémon data, trainer parties, encounters, sprites, and native game options.
5. Use **Export → Edited GBA ROM** to compile a separate playable copy. The review step reports unsupported features, map limits, and unresolved links before writing the file.

## Authoring notes

- Imported maps retain the ground, detail, overhead, and movement layers exposed by the source layout. If a layout cannot be decoded safely, it is shown as a planning map instead of being silently flattened.
- Objects use transparent cutouts and movement masks. The **Footprint** editor shows which cells block movement, allow walking behind, or remain walkable.
- Ledges are one-way by default. Water, HM objects, gates, doors, and portals have explicit previews and validation.
- Generated towns and interiors are bounded to the selected tile family. The generator checks edges, corners, building footprints, entrances, collision, and exits before accepting a layout.
- Projects can be backed up as editable `.shattered.json` files. Keep a backup before clearing browser or app data.

The **World map** tool arranges maps visually and can edit supported Town Map artwork and location bounds. The **ROM dialogue**, **Menu text**, **Game rules**, **Animated tiles**, and **Asset usage** tools appear when the opened source exposes the matching native table.

## Music

Music tools import GBA/Sappy and MIDI material, show track names and parts, and let you select a visible A–B motif. A reference composition can use an exact motif or an inspired motif, with controls for resemblance, placement, section scope, key, scale, genre, tempo, and variation seed. Quick Track presets create an intro, repeating main theme, and bridge in one pass. **Hybrid composer** is the recommended mode; it runs offline and keeps the result within GBA timing and voice limits.

## Test the source

Node.js 20 or newer is recommended. The test suite has no install step or network dependency:

```sh
npm test
```

The portable tests exercise models, import/export logic, map validation, native data handling, music composition, and editor utilities. ROM-specific emulator fixtures are intentionally not part of the public repository.

## Build the Android package

The wrapper uses the Android SDK and JDK 17 directly; Gradle and Maven are not required. Set the SDK and signing variables locally, then run:

```sh
export ANDROID_SDK_ROOT=/path/to/android-sdk
export MAP_STUDIO_KEYSTORE=/path/to/your/release-key.jks
export MAP_STUDIO_KEY_ALIAS=mapstudio
export MAP_STUDIO_KEY_PASSWORD='use-a-local-secret-store'
python3 android/build.py
```

The signed APK is written to `dist/`. Never commit a keystore, password, or generated signing files. `android/repack-assets.py` can update web assets in an existing signed shell when the native source and signing certificate are unchanged.

## Compatibility and limits

The editor supports common Generation III map, graphics, event, and music layouts and can discover compatible tables in many ROMs. Native features are enabled only after table and pointer checks pass. Unsupported native code does not disable map planning, asset organization, or project backup.

New battle mechanics, arbitrary script code, extra native capacity, and unknown save layouts require a compatible source adapter. The export review explains a limitation before writing anything and leaves the source ROM untouched.

## Credits and permissions

Developed by xbaconator9000x. Bundled art and reference libraries retain their original credit and usage terms in [`dist/assets/credits`](dist/assets/credits). Imported artwork remains the responsibility of the person who imports it. ROM-format research references PokéWebKit, [pret/pokefirered](https://github.com/pret/pokefirered), and [pret/pokeemerald](https://github.com/pret/pokeemerald). Third-party licenses and notices are preserved with the relevant files.

No blanket license is asserted for bundled game-derived or third-party artwork. Check each credit file before redistributing assets or a derivative ROM.

## Contributing

Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening an issue or pull request. Bug reports should include the browser or Android version, source type, reproducible steps, and a redacted project sample when one is necessary. Do not upload ROMs, save files, signing keys, passwords, or other material you are not authorised to share.
