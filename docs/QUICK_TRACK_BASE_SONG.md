# Quick Track source arrangements — 4.69.3

Quick Track supports original composition and arrangements based on imported
ROM songs, MIDI imports, or other songs in the project music library.

## Use

1. Use **Import MIDI · choose parts from one file** directly in Quick Track, or open Quick Track and choose **Base on track**, or select a library song and
   tap **Style this track**.
2. The **Parts inside this song / MIDI file** checkboxes are visible directly in Base on track. Use **Clear · choose 2–3 parts**, then tick two or three instrument parts from that one MIDI. Each row shows the original MIDI track name/number and channel. The selected count is shown, and the saved arrangement records the exact selection.

   Alternatively choose the source scope: **Whole song** (default), **Selected parts** (check
   several parts together), or **Single melody** (rebuild accompaniment).
3. Confirm the main tune with **Hear melody part**. The automatic suggestion
   considers early entry, register and sustained coverage, so a high part that
   starts halfway through Pewter no longer wins over its main tune.
4. Choose a vibe, such as Shattered, Wrath, Loss or Sunny Route. All existing
   vibes remain available for source arrangements and original compositions.
5. Choose a **Key** and **Scale**. Keep the source tonality, follow the vibe, or
   choose any of the twelve tonics and a supported scale. Natural, Harmonic and
   Melodic minor are available, along with Dorian, Phrygian and other scales.
   Pitched parts are converted together; percussion is not transposed.
6. Choose **Hybrid**, **Melody**, or instant **Phrase** composition. Atmosphere
   treatment remains available in either source or from-scratch mode.
7. Preview and save. The result is a new library copy; the source is unchanged.

Whole-song and selected-part modes use the source arrangement's chosen parts,
including its bass, harmony and percussion, rather than discarding everything
except one melody. The source length, intro and loop point remain intact.
The vibe adapts tempo, dynamics, instrumentation and backing density. The main
melodic rhythm remains recognisable, with pitches following the chosen key and
scale. Single-melody mode remains available as a separate option.

## Hybrid's contribution

Hybrid runs the bundled contour and melody models. It receives a source-derived
melody primer and chord conditioning inferred from the selected backing/bass.
It replaces a prominent backing part with actual generated note pitches,
onsets, lengths and rests. Previously the integration used only model pitches
on two sparse backing parts, which made its effect difficult to hear.
The source lead is retained as the recognition anchor. The completion report
shows the number of changed development notes. Model errors remain visible;
the app does not silently substitute the Phrase composer when Hybrid fails.

Worn atmosphere is applied after composition. The GBA output is kept within
8 simultaneous voices; lower-priority backing gates are trimmed if necessary.
Up to 10 export parts are supported. Larger MIDI arrangements can use Selected
parts to choose an exportable subset. Instrument changes in a source part are
consolidated to a compatible part instrument and reported by the importer.

## Validation

- 68 music tests pass, covering all vibes, whole/selected/single modes, minor
  scales across all 12 keys, unchanged percussion/source, native compilation,
  Hybrid orchestration, model errors, MIDI and rendering.
- Quick Track source UI and existing mobile Quick Track integration tests pass.
- Actual bundled Hybrid inference on imported native Pewter uses all 9 source
  parts, D harmonic minor, Shattered and Worn strong. It generates 72 changed
  development notes. A PCM comparison against phrase-only confirms different
  rendered audio (RMS difference approximately 0.008 on the test sample).
- Native bank compilation and finite non-silent PCM rendering pass. Source
  assets remain unchanged. A real Android installation/listening session has
  not been performed in this environment.
- APK signature, version, ZIP integrity and alignment are verified. The 4.69.1
  base shell, native code and unrelated assets are preserved, including the
  earlier 4.68.2 warp repair.

## Installation and source

4.69.3 uses the original package `dev.shattered.mapstudio.next` and certificate
SHA-256 `9F453803F6FE2FEB834FC799B8C9CFEF5520BB6567B1D55E22BACCFB81B59343`.
It installs as an update to 4.69.0/4.69.1. The visible name is PokéBacon Studio.
The older `dev.pokebacon.preview` Demo identity requires project export/import;
Android cannot migrate app-private data across package/signature identities.

The source archive includes complete deployed web assets in `dist/`, tests,
verification reports, the cumulative music patch and `android/build-music-update.py`.
The builder requires the 4.69.2 base APK, original signing JSON and PKCS12 key,
Android zipalign, apksigner.jar and an output directory. Secrets are never placed
in the APK/source archive or passed as command-line password arguments.

Run `node --test tests/music-*.test.js`. UI tests use jsdom, fake-indexeddb,
esbuild and @napi-rs/canvas from external node_modules paths configured through
MAP_STUDIO_QA_RUNTIME and MAP_STUDIO_BUILD_RUNTIME. The optional real-model ROM
integration test also needs MAP_STUDIO_SOURCE_ROM and MAP_STUDIO_MUSIC_TABLE.
No ROM or signing secrets are included in the source package.

Direct MIDI bases are kept in this workshop session; save the styled result to preserve it in the music library. Original MIDI files are never modified. GitHub CI checks the direct-import two/three-part workflow in addition to the music unit tests.
