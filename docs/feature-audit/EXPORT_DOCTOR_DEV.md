# Export Doctor (boot test)

Stage record. Status: implemented and unit tested; executed once in headless Chromium against the bundled mGBA core with a private Monomyth ROM (boots, 14 distinct screens) and a zero-filled ROM (fails with "Nothing was ever drawn"). Not released.

What it does: from Export, runs a ROM for 2400 frames (about 40 seconds of game time) in the existing playtest core, pressing A and Start on a fixed script after the first 240 frames, sampling the screen every 120 frames. Verdicts: pass (two or more distinct screens, still changing late), warn (one unchanging screen, or stopped changing), fail (ROM would not open, or nothing but one flat colour). An optional original ROM is run first so a regression from edits can be told apart from a ROM that never worked.

Limits: a pass means the game starts and changes screens, not that gameplay works. It cannot see crashes that only occur on a specific map or event. It does not press directions, so it never leaves the intro on most games. Saves are not read or written.

Files: dist/export-doctor.js (logic), dist/export-doctor-ui.js (dialog), tests/export-doctor.test.js. Entry point: Export dialog.
Next: a scripted route (walk, open the menu) and a "test the ROM I just exported" button that skips the file picker.
