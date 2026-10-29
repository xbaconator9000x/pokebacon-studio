# Source reconciliation — 30 October 2026

The canonical source is 4.69.3: complete deployed 4.69.2 web assets plus the
multipart MIDI work already merged in #12. The source archive was found;
no web application logic needed to be guessed or recreated.

Every asset in the recovered 4.69.2 APK matched the source archive byte for
byte. `qa/source-manifest.json` records archive/APK fingerprints and every
final deployed file. All paths changed by #12 were retained. Native ability
and item runtime sources/builders and five portable authority/refresh/layer
regressions were recovered from the older 4.66 checkpoint.

## Android identity and builds

The reference APK manifest names package `dev.shattered.mapstudio.next`,
provider `dev.shattered.mapstudio.next.files`, and fully qualified Java
classes under `dev.pokebacon.studio`. The repository manifest now agrees.
Version is 4.69.3, code 116. The original signing certificate fingerprint is
recorded in the manifest; no signing keys or passwords are committed.

`android/build.py --unsigned` builds the complete native shell from Java and
resources and verifies all packaged assets; CI supplies JDK 17 and Android 35.
For a signed full build, omit `--unsigned` and supply the private environment
variables documented in that script. `android/repack-assets.py` provides
the alternative that preserves the reference APK's native shell byte for byte.
Use its full `--base-commit` guard; never pass an unrelated APK.

The Java/resource source survived in GitHub and the older source archive.
The newer archives contain deployed web source, not an independent newer
Java tree. A rebuilt native shell is therefore not claimed byte-identical to
the reference DEX. The shell-preserving repack path remains available.

## Validation

327 portable checks passed; two external-fixture checks skipped. Direct MIDI
two/three-part selection, source-song controls, and full-editor mobile Quick
Track UI checks passed with jsdom/canvas. Recovered project authority, native
exit authority, native layer encoding and refresh checks run in `npm test`.

Old fixtures were migrated to explicit render roles/masks. Export protection
fixtures now declare a supported engine. Portal expectations retain the
deployed regular-warp/source-behaviour rules; paragraph dialogue uses native
scroll controls after the second line. No production behaviour was changed
to make legacy expectations pass.

The offline cache now includes the recovered root modules. Version/fingerprint
parity runs on pushes/PRs and daily. Android compilation is a separate CI job;
physical-device update/install and private-ROM emulator acceptance remain
unverified in this reconciliation run. No signed APK release is implied by
source synchronization.
