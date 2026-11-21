# Legacy ROM source-ID review and non-destructive attestation (13 Nov 2026)

## Why this is necessary

The original Android/WebView ROM-open fallback assigned a weak key of \`gameCode-fileLength-mapTable\` when WebCrypto was unavailable. Different hacks or revisions can share those properties. A matching key alone cannot authorize editor changes, so replacing the fallback with a corrected SHA-256 would otherwise silently disconnect existing maps, stage a wrong ROM, or leave earlier edits unavailable.

## Implemented

- Every newly opened ROM now computes a **standard SHA-256** via \`romFingerprint\`, even on nonsecure WebViews. No new weak IDs are ever issued.
- Existing SHA-bound source maps retain their stable canonical IDs. Verified legacy sidecar mappings retain their original saved source ID.
- A legacy source descriptor with \`verifiedSha256\` is only accepted if it equals the current ROM's complete SHA-256; a different revision is immediately refused.
- **Previously unverified weak IDs** are subjected to strict, read-only checks of the saved game code, engine, map-table location, bank/map counts, every imported map's header, layout, blocks and script addresses, original dimensions, and the exact complete original tile/collision block array.
- An exact native baseline match opens an explicit confirmation dialog. The user must affirm that this is the *original* ROM from the earlier import. Approval only adds \`verifiedSha256\` and \`verificationMethod\` to that saved source descriptor; it **never renames the weak ID** or rewrites map IDs, source assets, HEX/HMA state, scripts or project data.
- Unknown, changed or missing baselines remain blocked from attachment, while **Open separately** permits using the canonical digest as a new unrelated source without rewriting the saved project. No implicit acceptance of an unverified weak ID.
- The source descriptor is included in reversible project edit history; split save/reopen must retain the verification metadata.
- The original imported native baseline is only corroborating evidence, **not a proof that arbitrary other ROM bytes have never changed**. The confirmation explicitly asks the user to select their original file. The SHA-256 binding provides exact verification for later opens.

## Acceptance

\`tests/rom-source-identity.test.js\` covers original map baseline match, no-mutation review, explicit attestation, split save and undo/redo, changed source rejection with the same weak ID, missing descriptors/blocks and authentic legacy sidecar handling. \`tests/rom-source-identity-ui.test.js\` checks the actual ROM-open source selection and warning/consent actions. Both are run through the existing GitHub QA gate.

Still not a full project-wide key migration: this approach **deliberately preserves historical IDs**, protecting existing authoring. Native emulator gameplay, physical Android install and original-key signing remain separate acceptance work.
