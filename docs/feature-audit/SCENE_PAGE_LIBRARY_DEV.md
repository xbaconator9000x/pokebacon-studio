# Reusable visual event pages and safe scene duplication

**PokéBacon Studio — 14 November 2026 | PR #29**

The Visual Scenes editor now has **Copy page** and **Paste copied page** actions.
The copied page is held in the current editor session, scoped to its original
project identity. Paste works both in a scene already using event pages and in
a flat scene, where the original actions become the base page. Imported source
events and their native script bytes are not modified by clipboard operations.

## Integrity and native-boundary rules

- Pasted pages get fresh page, action, nested branch, and custom-answer IDs.
  Named quest flags, counters, item references, dialogues and actor references
  remain references **within the same project**; the destination is still
  validated against its original authoring and game-engine bindings.
- Clipboard input is structurally checked; malformed pages, capacity overflow,
  project switching and ID collisions fail without mutating the destination.
- **Duplicate scene** allocates an entirely new event identity, new nested
  action/answer identities and new page IDs. It drops original native object
  identity, original visual-import provenance and project-owned completion/area
  bits. New save bits are allocated only when the duplicate is actually saved.
- The original source event, native ownership, ROM data, script table and shared
  resources are never rewritten by copying or previewing these drafts.
- The clipboard is deliberately transient, not persisted or exported as an
  independent source package, and cannot be pasted into another project.

## Verification

`tests/scene-page-library.test.js` covers source immutability, deep nested
answer identities, retained project-local references, cross-project rejection,
all-or-nothing error handling, 16-page limit, safe native-origin duplication,
project split-save/reopen, real FRLG native script byte compilation, and editor
wiring. This establishes editor/export-layer behavior, **not** native emulator
gameplay, physical Android touch acceptance, original-key APK signing or
full Hex Maniac Advance feature parity. The PR stays open and unmerged.
