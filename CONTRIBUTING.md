# Contributing

Thanks for helping improve Shattered Map Studio.

## Before opening a change

- Run `npm test` with Node.js 20 or newer.
- Keep browser and Android behaviour aligned when changing shared editor code.
- Preserve the existing credit and permission files for bundled artwork and reference data.
- Do not add ROMs, extracted game assets, save files, signing keys, passwords, or user projects.
- Keep generated build output, emulator fixtures, screenshots, and local QA data out of commits.

## Pull requests

Describe the user-facing behaviour, the source formats or profiles affected, and the checks you ran. Include a small redacted fixture only when a test cannot be expressed with the portable models already in `tests/`.

For map, object, collision, event, or music changes, include the relevant validation case. For native ROM changes, explain how unsupported layouts fail safely and confirm that the input ROM remains unchanged.

## Issues

Use the issue templates for reproducible bugs and feature requests. Include versions and steps rather than private project files. If a project sample is essential, remove personal information and use only material you are authorised to share.
