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

Select your signing team in Xcode, choose an iPhone/iPad or simulator and run. For a physical device, select your Apple development team and a bundle identifier registered to that team. Xcode handles provisioning when supported by your account. The unsigned device package from Actions must be signed before installation; it is not an App Store or TestFlight release.

For the simulator smoke test:

```sh
xcodebuild -project ios/PokeBaconStudio.xcodeproj -scheme PokeBaconStudio -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO test
```

The simulator checks editor boot, the export bridge, secure context, WebAssembly, cryptography, nested native Back navigation and an IndexedDB write/read across an editor reload. It also captures the running map editor, menus and sprite workshop. Device testing still needs import/export round trips for ROMs, MIDI, projects and sprites; nested Back navigation; audio previews; Hybrid composition; screen rotation; memory pressure; and project persistence after a cold launch. The port is not release-ready until those checks pass.

Minimum iOS: 16.4. The local resource server listens only on the loopback interface and serves bundled files. External links open in the system browser. File exports stream in bounded chunks into a temporary file before showing Files or Share.

## GitHub builds

Open the **iOS preview** workflow in Actions, select a successful run, and look under Artifacts:

- **PokeBacon-iOS-simulator-preview** contains `PokeBacon-iOS-simulator.zip`. Unzip it to recover the app bundle with its executable permissions, then install it into a booted simulator with `xcrun simctl install booted /path/to/PokeBaconStudio.app`.
- **PokeBacon-iOS-unsigned-device** contains a Release device archive packaged as an unsigned IPA. It needs signing and provisioning before device installation.
- **PokeBacon-iOS-screenshots** contains captures from the native simulator run.
- **ios-smoke-results** contains the Xcode test results and attachments.

GitHub requires a signed-in account to download Actions artifacts. For a physical iPhone, building and running the source through Xcode is the supported setup path at present.
