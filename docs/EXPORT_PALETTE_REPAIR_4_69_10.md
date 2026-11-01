# Reviewed palette export repair — 4.69.10

When exact native artwork needed more than thirteen palette groups, the export dialog rejected it even with reviewed conversion enabled. Native tile hints were always packed in exact mode before the allowed conversion could run.

The planner now preserves exact native colours when they fit and consolidates the complete artwork set when the user explicitly allows colour changes. Source artwork, masks and movement remain unchanged. A transaction-scoped raster snapshot keeps palette preparation and compilation consistent, preserves ImageData dimensions, detects edits during compilation and releases its buffers afterward. Successful exports retain the prepared pack and conversion/static-art settings for subsequent exports.

Complete validated replacement banks no longer depend on guessing the old secondary-bank count. Unprepared exports retain strict bounds checks. Unchanged NPC appearances from the matching expanded source are retained without requiring a fresh appearance selection.

## Validation

- `npm test`: 382 passed, 2 skipped, zero failures.
- Actual mobile-layout export dialog: a private unmodified fifteen-map project, conversion enabled, review shown and `.gba` saved. A second export remembered the setting and produced byte-identical ROM output. Original map data remained unchanged.
- All fifteen exported maps reopened with matching dimensions; the compiler's native graphics, collision/elevation and declared-write checks passed.
- Source deployment gate: 1,861 fingerprints and Android version/package parity passed.
- APK 4.69.10, version code 123: 1,849 embedded web assets matched the tested source; native code/resources and existing signing certificate were preserved; signature and alignment passed.
- The manifest repacker now handles a longer version string while retaining indexed XML strings and package identity.

No physical Android installation test is claimed. The regression runs the actual app dialog in the existing DOM/canvas harness; signed-APK packaging is independently verified.

Private fixture reproduction:

```
MAP_STUDIO_TEST_PROJECT=/private/project.json \
MAP_STUDIO_TEST_SOURCE=/private/source.gba \
MAP_STUDIO_QA_RUNTIME=/path/to/runtime/node_modules \
MAP_STUDIO_BUILD_RUNTIME=/path/to/runtime/node_modules \
node scripts/test-private-palette-export-ui.mjs
```

Fixture ROMs, project data and signing credentials are not included in the repository.
