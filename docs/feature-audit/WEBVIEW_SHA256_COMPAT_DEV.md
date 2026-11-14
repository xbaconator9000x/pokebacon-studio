# WebView SHA-256 correction and nonbreaking ROM sidecar verification

The `dist/sha256.js` fallback previously contained 65 SHA-256 constants with several incorrect values and did not return standards-compliant SHA-256. Its historical output is retained as **`legacyPokebaconSha256()`** for explicit identification/migration audits only; **`sha256()`** is corrected against published vectors and Node's reference implementation.

`dist/rom-project.js` now uses the standards-compliant fallback when WebCrypto is not available on Android WebViews. New sidecar fingerprints are identical on secure and nonsecure platforms. Sidecar `sourceId` remains unchanged: it identifies the pre-existing project map and is **not silently replaced by a new digest**. Compiled and source ROM byte verification remains mandatory on sidecar reopen and resolution.

The historical noncryptographic ROM-open fallback in `dist/app.js` has deliberately **not been changed in this batch**. Changing it without explicit project-source migration may orphan older map/source bindings. New source-ID creation on WebViews, historical weak identifiers and any saved legacy digest migration still require a separate reviewed implementation and device test. No ROM data or signing credentials were bundled.

Tests: `tests/sha256-webview-compat.test.js`; target Node 20+ test runner and GitHub CI plus unsigned Android build.
