# Delivered 4.72.5 reconciliation preflight

**Follow-through:** [4.72.6 delivery](DELIVERY_4_72_6.md) completes the recovered
web-asset reconciliation, including the divergent sprite, allocator/artwork,
source/runtime, CSS and app callers. Both Git-only fixes and delivered features
are retained. The text below records the original preflight findings; it must
not be read as the current candidate's unresolved merge status. Device and
gameplay acceptance remain open.

## Recovered evidence

The delivered APK is available and its binary Android manifest reports **4.72.5 / code 145**. Its 1,853 web assets were compared byte-for-byte with PR #19 at `630d1b7417a669a1399752e8b448f41ccabe9559`. The source archive labelled 4.72.3 is also available; its SHA-256 is `49b4f01eee95701dea623aad9c2d4d939a6dc7af9535d4d7f3eb1a3c53a3d67a`.

That source archive's package.json and Android manifest still declare 4.69.3 (Android code 116). A filename is therefore insufficient to identify its build. APK assets are the evidence for what was delivered; the archive supplies maintainable source candidates, not an automatically authoritative replacement for Git.

The machine-readable comparison is [delivered-4725-comparison.json](delivered-4725-comparison.json). It contains paths, revision identifiers and hashes, without private APK contents or credentials. The comparison baseline is the verified source-reconciliation commit `0fea4b5`, rather than the later 4.70.5 shell: the later delivery itself retains some baseline files and lacks subsequent Git changes.

| Byte relationship | Assets | Required treatment |
| --- | ---: | --- |
| Identical | 1,795 | Reuse without changes |
| Delivered only | 11 | Review imports, ownership, persistence and integration |
| Delivery changed; Git remains at baseline | 6 | Review recovered implementation and its dependencies |
| Both differ from baseline and each other | 9 | Reconcile behavior explicitly |
| Git changed; delivery remains at baseline | 32 | Preserve Git fixes; investigate delivery omission |
| Git only | 21 | Preserve adapter/runtime dependencies unless independently superseded |

The first five rows total the 1,853 delivered assets. Including Git-only assets yields 1,874 paths. A byte difference alone does not prove which behavior is correct.

## Concrete review queue

Delivered-only files include mobile sprite controls, native/source UI editors, wardrobe binding, SHA-256 fallback and owned-free-space helpers. The nine divergent files are listed in the JSON; review them before integrating callers. In particular, source-project export must retain registered GBA runtimes **and** recovered source-window layout edits. ROM export must retain existing storage/ownership safeguards while reviewing later changes. Keep shared undo/redo save-scope handling and all nine split sections.

A trial three-way comparison exposed conflicts in source-project, ROM writer/free-space, native artwork, native sprites, sprite UI and service-worker files. Those trial changes were discarded; application assets remain at the verified branch revision. No partially reconciled editor is presented as an update.

Next acceptance slice:

1. Merge source-layout export through the existing GBA runtime, with unchanged-source and stale-layout rejection checks.
2. Reconcile sprite controls and native read/binding behavior; verify both mobile controls and existing player/outfit paths.
3. Reconcile owned-space/artwork export against the existing allocation guards and native fixtures.
4. Refresh package/Android/web version metadata and source fingerprints together, after choosing a candidate build identity.
5. Run storage, portable, browser UI and unsigned Android checks, then private Shattered export/emulator/reimport acceptance. Original-key device update remains a separate release gate.

## Reproduce and limits

From the repository root:

```sh
python3 scripts/audit-delivered-apk.py /path/to/delivered.apk --base 0fea4b5 --output /tmp/delivered-comparison.json
```

The script compares committed Git bytes rather than a dirty worktree, rejects duplicate/unsafe asset names and does not extract or execute the APK. It does not prove native Java/DEX parity, certificate continuity, physical Android behavior or gameplay. Source recovery is complete for these two artifacts; integration and release reconciliation remain open.

Validation in this session: unchanged branch suite **395 passed, zero failed, two optional skips**; direct ZIP comparison independently confirmed 1,795 identical, 47 differing and 11 delivered-only assets. APK manifest version/code was decoded with the existing repack helper. No paid services, signed release or automatic merge.

## First reconciled implementation slice

The recovered `ui-source-layouts.js` now participates in `gba-source-project.js` export behind the existing registered runtime. Four synthetic fixtures (FireRed, Emerald, CFRU, Shiny) prove exported window edits, reimported dimensions, unchanged original bytes, no-op exports, stale-source rejection and allocation guards. Source adapter identity remains in the report. The module is included in the offline cache, whose revision was advanced. This is a source-export slice, not the full recovered UI or native gameplay acceptance. UI02 remains partial and unreleased.
