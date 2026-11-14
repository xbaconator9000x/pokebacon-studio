# HMA table CSV preview and numeric range arithmetic (13 Nov 2026)

Two new actions are part of the real ROM Hex & Typed Tables workshop, on the active Android/web editor.

**Review before CSV import:** Opening a CSV file now validates the full input, typed column schema, bounds, pointers and all staged changes in an isolated throwaway project. It shows the first eight changed native rows side-by-side and the validated record/cell/changed-byte count. **Stage reviewed CSV** must be pressed separately; a different ROM session or a changed staged-patch set invalidates the preview. The original source ROM is never modified. CSV remains capped at 2 MiB, 256 original row IDs and 2,048 typed cells; conflicting owner edits block final export.

**Numeric arithmetic:** In a typed table, **Add/subtract…** applies a signed integer delta to an existing u8/s8/u16/s16/u32/s32 column across 1–256 existing rows. Its input comes from the already-staged byte view. Every proposed result is range-checked with the normal native type encoder before a single atomic transaction. Overflow in a late record aborts the entire operation. Pointer arithmetic, engine table expansion and inferred HMA semantics remain deliberately unsupported.

The imported data is still subject to source-bound undo/redo, split save/reopen, ROM writer address ownership and native byte preservation. This development work is not hardware Android acceptance or game execution proof.
