# Original Gen III engine flag writes — 14 November 2026

PR #29 now supports source-native `setflag` (0x29) and `clearflag` (0x2A) during bounded FireRed/Emerald original-script → visual-scene import, alongside earlier `checkflag` conditional branches.

- Typed 'Set / clear original ROM flag' action, distinct from PokéBacon project quest-save slots, with shared strict decimal 0–65535 validation.
- Android-first action editor, flags listed in Test game state, editable Set/Clear switch, immutably updated preview state consumed by subsequent conditional branches.
- Source-native script compiler emits exact Gen III engine commands; dependency search labels original-ROM reads and writes separately.
- Conservative unsupported-opcode fail-closed import; preserve other NPC roots sharing original script bytes.
- Synthetic source ROM tests cover read-only preview, conversion, source identity, nested branch edits, save/reopen, bytecode compile, NPC pointer relocation and native script reindex. No user-owned ROM or keys stored.

**Not established:** Shattered gameplay, native flag persistence through a real game save/restart, signed APK installation, emulator video or end-to-end modified-ROM acceptance. This is development-branch integration only.
