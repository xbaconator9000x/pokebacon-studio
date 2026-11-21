# MIDI import, automatic instruments and relative part density (14 Nov 2026)

## Source and native playback are different

The MIDI importer accepts up to 256 sounding source parts, retaining their names, MIDI program numbers, timing and all notes. PokéBacon now carries the complete editable source score in music-asset arrangement metadata if native playback requires packing or a polyphony reduction. It no longer asks users to discard parts solely to get below ten file tracks.

The original FireRed MP2K target in this project has a verified ten-physical-track export limit and an eight-simultaneous-voice playback safety budget. Original MIDI parts can share one physical playback track by switching the native VOICE program only between nonoverlapping notes. Timing, pitch, duration, velocity, per-note instrument and source automation snapshots are carried through the native note scheduler. Where eight-voice playback requires dropping/shortening backing voice gates, the original editable score is retained and a visible warning is produced. It is not an unmodified lossless render in those cases.

## Sound assignment

Imported General MIDI program IDs are mapped by family to compatible Studio chip instruments (piano, guitar, brass, woodwinds, bass, strings, synths, etc.). Percussion maps to a drum voice. Using a matching original ROM bank prefers the original native program where compatible for *every* part, rather than just the melody. Users can override instruments in the arranger. A ROM soundfont is not GM-compatible in general; matching timbres are approximations unless original ROM programs can be reused.

## Fewer / more instrument layers

Quick Track and the MIDI arranger offer a relative slider (neutral = existing/source count). Moving left removes less important backing parts from a new generated variation; right adds time-spaced supporting countermelody/colour parts where there is headroom in the eight-voice playback budget. The original source is not mutated. The editor reports the editable source-part count versus the compiled GBA playback-track count. A custom generated track starts with the six-part Quick Track arrangement.

## Verification and limitations

Synthetic 24-part MIDI, dense simultaneous-voice MIDI, independent program-switch playback, original-versus-playback preservation, source save/reopen, slider determinism and mobile UI wiring are tested. Real Team Rocket MIDI requires user source-specific acceptance, and in-game music on phone/mGBA and post-export ROM play remain unverified. MIDI SysEx soundbanks, dynamic MIDI program changes within a channel, custom native engines and all soundtrack formats are not claimed. No ROM data or copyrighted game music was committed.

## Additional source-preservation correction

Quick Track no longer pre-trims source score voices before compilation. Both the original ROM/MIDI part count and its authored note events survive into the editable asset metadata when the GBA mix must fit an eight-voice budget. Reduction occurs solely in the compiled native playback copy; the report discloses adjusted gates. MIDI export defers each track's GM program-change message to its first note onset, improving instrument recovery when more than fifteen source parts reuse MIDI channels sequentially. The original MIDI file remains unchanged.
