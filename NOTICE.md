# Notices

## Music models and runtimes

- MusiGAN: elsalmi and upstream contributors, https://github.com/elsalmi/MusiGAN. Studio bundles a converted pretrained GAN generator for melodic contour suggestions; its origin and architecture are recorded in `dist/vendor/musigan/meta.json`. Upstream has no blanket licence file at its repository root. Attribution does not establish redistribution permission or relicense the checkpoint or source material.
- Magenta.js 1.23.1 / MusicRNN and the official `chord_pitches_improv` checkpoint: The Magenta Authors / Magenta Team, Apache-2.0.
- TensorFlow.js 2.8.6 and WebAssembly backend: Google LLC and contributors, Apache-2.0.
- Tonal: MIT. protobuf.js: BSD-3-Clause. Both are included in the MusicRNN browser bundle.

The corresponding Magenta/runtime licence texts and upstream notice are retained under `dist/vendor/magenta/`. Hybrid runs the MusiGAN contour stage followed by Magenta's chord-aware melody stage. Melody composer uses Magenta; Phrase composer uses Studio's own arrangement rules without running these pretrained models.

Shattered Map Studio is distributed with a mixture of original code, third-party libraries, reference data, and game-derived artwork. The repository does not grant a single blanket license for every file.

- Review the credit and permission files under [`dist/assets/credits`](dist/assets/credits) before reusing bundled artwork or reference material.
- Third-party runtime notices remain beside the relevant vendor files under `dist/vendor/`.
- The Android wrapper uses the platform SDK and the bundled WebView shell; it does not include a game ROM.
- Imported ROMs, music, sprites, and other user material remain the responsibility of the person importing them.

If a file has a more specific license or notice, that file's terms take precedence over this summary.
