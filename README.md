# Shattered Map Studio

I wanted to make a Pokémon ROM hack without needing a dozen different programs open. So, this is Shattered Map Studio: maps, events, quests, sprites, music and game data in one place, with controls you can actually use on a phone.

## Try it

**[Download the Android APK](https://github.com/xbaconator9000x/shattered-map-studio/releases/latest)** — grab the `.apk` under Assets, open it on your phone and allow installation from your browser when Android asks.

**[Open the web editor](https://xbaconator9000x.github.io/shattered-map-studio/)** — no install needed. Open the link in your browser, choose **Open ROM**, and select your own `.gba` file. You don't need GitHub or a development setup to use it.

The Android APK packages the editor for offline use. The browser version is available at the link above. Back up your projects before clearing app or browser data; those saves aren't a cloud account or an automatic sync between devices.

**Coming soon: iOS.** Planned, with no release date yet.

## Have a look

Map workspace, layers and connections:

![Map workspace, layers and connections](docs/previews/map-workspace.gif)

Game maker, music library and Quick Track settings:

![Music tools and Quick Track](docs/previews/music-workspace.gif)

## What's in it?

### Maps and world building

- Paint individual tiles or stamp whole buildings, trees, furniture and other objects. Search asset packs, keep favourites, and make your own reusable pieces.
- Separate ground, detail and overhead layers, automatic collision defaults, and manual movement/footprint editing. One-way ledges, water and obstacles have their own behaviour.
- Terrain, path, tree and rocky-wall brushes; map resizing and cropping; colour picking and palette tools.
- Generate towns, villages, cities and interiors with biome presets, building choices, source families, exits and variation seeds. Generated layouts are a starting point you can edit, not a substitute for checking your map.
- Building/interior templates, Pokémon Centres, marts, gyms and multi-floor department stores.
- Connect neighbouring maps, position scrolling exits, edit doors and warps, and arrange the world visually. Edit supported Town Map artwork and location bounds too.

### Events, quests and field rules

- Place NPCs, write dialogue, draw movement paths, and build scenes with triggers, conditions, branches and repeatable or one-time events.
- Quest templates, stages and prerequisites, plus shops and interactive objects.
- Weather and compatible field effects, including screen shakes, rock falls and reflections.
- Adjust requirements separately for each HM: badges, items, possession, events or quest progress. Configure persistent cleared obstacles and conditional Strength puzzles.
- Preview maps and events in the playtester, with validation and debugging tools to help catch broken links and movement problems.

### Game data and sprites

- Edit supported Pokémon data, trainer parties, encounters, items, dialogue, menu text and game rules.
- Browse compatible ROM sprites, edit copies or use templates, work with palettes and animation frames, and manage imported artwork.
- Supported animated tiles, door animations, cries and asset-usage tools appear when the source exposes the required data.
- Source-project tools for supported decompilation workflows. Native features depend on the actual base and adapter; opening a ROM doesn't magically make every engine extension compatible.

### Music

- Import MIDI or compatible ROM music, preview individual tracks, and choose which reference to compose from.
- See and edit notes, select an A–B motif, and decide how closely the new track should follow it, where it appears and how often it returns.
- Quick Track presets for different settings and moods, with genre, key, scale, tempo and variation controls.
- Build intros, main themes and bridges with section lengths and a repeating song structure, rather than just a tiny loop.
- Hybrid composition, arrangement and instrument controls, playback with a stop button, and GBA-aware timing and voice limits.

### Import, export and backups

- Import supported ROM maps with editable layout and movement data instead of treating them as one flat picture.
- Save editable project backups, review export warnings, and compile a separate edited ROM where the source supports it. Your original ROM stays untouched.
- In-app help and shortcuts. Compatibility checks make unsupported native features explicit instead of pretending they were exported.

## Running locally

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
