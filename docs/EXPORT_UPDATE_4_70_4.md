# PokéBacon Studio 4.70.4

The previous 4.69.10 package used Android version code 123. Devices already running 4.70.3 (126) rejected it as a downgrade. This release uses 4.70.4 (127), retains the existing application ID and signing certificate, and preserves the newer 4.70.3 sprite implementation and bundled sprite pack. Signing material and the separately managed private sprite pack remain outside Git.

Combined the development branch's reviewed palette planner, exact native palette seeding and event/source-sheet updates with transaction-scoped export raster snapshots, remembered export preferences, validated prepared artwork initialization, unchanged expanded-source NPC appearances, and verified free-space ownership. Original project artwork is retained.

Validation: 391 tests passed, 2 skipped, 0 failed. The actual export dialog compiled and saved the unmodified fifteen-map fixture twice with identical SHA-256 `c715e5aa3526319cbf4a0d5ff541ef22a5cf38cdce5e2b04b6954a56bbeb4cac`; all maps reopened and remembered conversion settings. All 1,863 deployed fingerprints matched. APK verification checked 1,851 embedded assets, version code advance, unchanged native DEX/resources, matching certificate, v2/v3 signatures and ZIP alignment. Physical device installation is not claimed.

APK SHA-256: `6fac2897cf7a4dc43a4fb50b4abb26f0c849182f889d08918a1edf466a645d28`.
