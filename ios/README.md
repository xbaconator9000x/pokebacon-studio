# iPhone and iPad port

Development preview. The wrapper bundles the same offline editor as Android, serves it from a stable loopback origin, and adds Save to Files, the share sheet and a native Back button. Existing file inputs use the system document picker. Project storage remains on this device; export a project backup to move between platforms.

## Build

On a Mac with Xcode and XcodeGen installed:

```sh
python3 ios/prepare-assets.py
cd ios
xcodegen generate
open PokeBaconStudio.xcodeproj
```

Select your signing team in Xcode, choose an iPhone/iPad or simulator and run. No Apple account credentials or certificates belong in this repository. Device distribution needs Apple provisioning; this source preview is not an installable IPA or an App Store release.

For the simulator smoke test:

```sh
xcodebuild -project ios/PokeBaconStudio.xcodeproj -scheme PokeBaconStudio -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO test
```

The smoke test checks editor boot, the export bridge, secure context, WebAssembly, cryptography and an IndexedDB open. Device testing still needs import/export round trips for ROMs, MIDI, projects and sprites; nested Back navigation; audio previews; Hybrid composition; screen rotation; memory pressure; and project persistence after a cold launch. The port is not release-ready until those checks pass.

Minimum iOS: 16.4. The local resource server listens only on the loopback interface and serves bundled files. External links open in the system browser. File exports stream in bounded chunks into a temporary file before showing Files or Share.
