# Native source helpers

This directory contains the small ARM7TDMI helpers used by compatible native exports. The browser editor invokes the generated runtime only after the opened source passes its profile and pointer checks.

## Rebuild the quest helper

With an ARM bare-metal GCC toolchain installed:

```sh
ARM_PREFIX=arm-none-eabi ./build-quests.sh
```

The generated code is position-independent and is embedded into the browser runtime during the normal asset build. Native save data is written only to a compatible reserved region, uses a project ownership marker, and fails closed when the region contains foreign data. It does not consume story flags or variables.

The other C helpers follow the same pattern: they are optional, profile-gated additions and do not replace the source ROM's existing engine. The compiler reports unsupported profiles before writing an output file.

No game ROM, save file, or extracted NPC/script data is included here. Source-specific art and reference terms remain in `dist/assets/credits`.
