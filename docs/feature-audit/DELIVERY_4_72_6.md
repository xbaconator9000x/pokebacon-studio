# 4.72.6 development delivery — 7 November 2026

This signed **test update** reconciles the delivered 4.72.5 web application
with PR #19's GBA adapters, storage repairs and retained development fixes.
It is not a claim of complete editor parity, physical Android acceptance or
Shattered gameplay validation.

## Implemented in this batch

- Recovered mobile sprite workspace, player wardrobe bindings, UI tools and
  supporting modules from the exact delivered APK. Preserved Git's event
  recipes, selection/layer tools, palette planning, source runtimes, sprite
  library, source-sheet controls and all split-section persistence fixes.
- Phone sprite canvas with six visible drawing tools, six tool-sheet shortcuts,
  visible Save/undo/redo, internal sheet scrolling and no page scrolling to find
  core tools. Selection/clipboard and independent comparison controls are
  accessible rather than stranded in the original hidden form.
- ROM catalogue search retains input focus/caret; previews preserve aspect
  ratio. Player access includes clothes/hair where a verified wardrobe exists.
- Wardrobe edits now pass project validation. Copy/export keeps the wardrobe
  binding instead of accidentally treating its slot as a Pokémon species.
  Shared outfit palettes require explicit approval; pixel edits detach from
  aliased source data through the existing native writer.
- Cross-map existing-event finder: speaker, indexed dialogue context, map,
  event type and native address, with direct navigation to the original entry.
  Search scope and partial indexing are explained; unknown commands remain
  opaque and original native bindings are retained.
- Protected off-map border metatiles and stale-pack refusal retained together
  with Git's reviewed palette-overflow conversion. Owned-space support retains
  packed/unaligned pointer safeguards and excludes explicit writes from the
  allocator's free spans. No replacement ROM-writing pipeline added.
- Offline cache includes recovered modules and the retained sprite library.
  Visible/diagnostic/web/package/Android build identifiers agree on 4.72.6.

## Acceptance evidence

- Portable suite: **406 passed, zero failed, two optional skips (408 total)**.
- Real Chromium at 360×800, 412×915 and 640×360: tool access and canvas bounds;
  touch paint/undo/redo; all six sheets; all sixteen palette swatches fit;
  selection/comparison access; save/reload through browser IndexedDB; existing
  event search and navigation. Synthetic fixtures use no copyrighted game art.
- Existing jsdom/canvas layer/selection/locking checks and project source-session
  recovery checks pass. Four-engine IndexedDB abort/history/fallback coverage
  is retained; these do not prove process-death or worker timeout/race behavior.
- Native synthetic event: imported dialogue edit → split save/reopen → native
  relocation → reimport. Unknown opcode bytes and original event binding remain
  unchanged; already-applied dialogue is not replayed.
- Native border fixtures: missing reserved border IDs and malformed dimensions
  refuse export; supported alternate dimension offsets are respected.
- A private Shattered xx1.08 rider-test ROM was inspected locally, never placed
  in Git. Discovered 437 maps, 547 species, 107 NPC entries and 942 wardrobe
  entries. Selected species/NPC/wardrobe records decode. A wardrobe pixel edit
  passes project save/reopen validation, native export and fresh discovery /
  reimport; the original ROM remains unchanged. This is not emulator execution.
- `scripts/qa-source-gate.mjs`: 1,874 deployed source fingerprints and identity
  parity. `scripts/test-offline.mjs`: all module/style imports cached.
- APK build uses `android/repack-assets.py` and the exact delivered 4.72.5
  native shell. It verifies the same package, certificate, unchanged native
  files, increasing version code 145→146, ZIP alignment and every packaged
  web asset. Java/resource source was not changed or independently rebuilt.

## Remaining gates

Physical installation/update and retained on-device projects, real touchscreen
acceptance, private Shattered emulator execution, complete event-page semantics,
quest/action-track parity and broader native UI/engine support remain open.
Wardrobe acceptance above names one specific revision, not arbitrary ROMs.
No automatic merge, Pages deployment, public binary release, DS implementation
or paid service was initiated. Sources remain on PR #19 for review.

Repeatable browser checks are in `scripts/test-release-mobile-browser.mjs`;
instrumentation is served only by its test server and is absent from the APK.
The source manifest and signed artifact hashes identify the delivered candidate.

Signed APK: `PokeBacon_Studio_v4.72.6.apk`, 32,812,744 bytes.
SHA-256: `2eec5f5a67603b1738932e57657d769cdc2d19d2f4f171dd6394adeea2e11381`.
Signer certificate SHA-256:
`9f453803f6fe2feb834fc799b8c9cfef5520bb6567b1d55e22baccfb81b59343`.
These are public artifact/certificate fingerprints, not signing credentials.
