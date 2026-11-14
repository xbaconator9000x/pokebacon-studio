# Trainer defeated-state branches — 14 November 2026

Original Gen III `checktrainerflag` + `goto_if 1` with a verified forward two-arm diamond and shared join now converts to a typed Visual Scene branch, just like bounded native flag conditional import. This is distinct from both project quest flags and a native battle result: it reads the engine's existing saved trainer defeated-state flag. Supported branch arms may contain `settrainerflag`, `cleartrainerflag`, standard dialogue or other already-supported visual actions; unsupported/looping/shared entry paths fail closed.

The mobile editor supports a **Check trainer defeated state** action with separate defeated/not-defeated branches and a preview-only test state selector. The native compiler emits `checktrainerflag N` / `goto_if 1` with native labels; the reference index includes read/write trainer IDs separately from project flags, including nested branches. The scene outline can navigate both branches. Synthetic native GBA event-root fixtures test import, original script survival, save/reopen, export bytecode and native graph reindex.

This does not claim rematch save persistence, actual battle AI, sight/approach behaviour in Shattered, emulator testing or signed APK. Complex or custom trainer state scripts remain in the native graph editor. No copyrighted ROM bytes or credentials committed.
