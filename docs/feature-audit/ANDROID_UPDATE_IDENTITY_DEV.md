# PokéBacon Android in-place update identity — 16 November 2026

## Source-backed original app identity

**Preserve Android package `dev.shattered.mapstudio.next` and the release-signing certificate SHA-256 `1181de51b390457daaf04ea9c63108dc084da9597bef23bf2bc19090e1ae7add`.** Both must match the installed release for Android to offer an in-place update preserving app storage. Java source class names under `dev.pokebacon.studio` are implementation classes and **must not be mistaken for the package ID**.

On 16 Nov, a 4.72.7 build incorrectly set the Android package to `dev.pokebacon.studio`, producing a second app on the user's Samsung phone. Screenshots showed the original installation with ~394 MB internal storage and the duplicate with ~37.81 MB, both version 4.72.7. The earlier signed 4.72.7 verification record confirms the original package ID, uploaded private keystore certificate, and Android v2/v3 signatures; compare the new release to that **original**, not to the accidentally renamed APK.

This repair restores manifest package + provider authority, updates QA source identity, and increments internal Android versionCode **147 → 148** while retaining versionName **4.72.7** for this corrective test build. A source gate now explicitly refuses unreviewed changes to the Android package or release certificate fingerprint. The existing signing/update script's fingerprint assertion is aligned to the verified original release keystore.

## Acceptance and precautions

The original installation must not be uninstalled or have its data cleared. **Source checks and emulator install are not proof that the specific user's existing app certificate matches**; prefer inspecting the installed APK with Android's package manager if possible. Android update acceptance must demonstrate original project storage persists and the duplicate is not needed. Ask user to back up projects before removing the accidental duplicate, and remove the duplicate only after separately confirming it has no unique projects.

Source-only public repo: never commit keystore, passwords, user ROMs or backup projects. Test-signed APKs from GitHub Actions remain unsigned for private local release signing; original release keystore is used only in the private runtime.
