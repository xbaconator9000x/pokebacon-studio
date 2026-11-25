# Shared script safety (EVT07), development batch after 4.72.8

Unreleased source work on a branch. It is not in the 4.72.8 APK, and it has not been run on a phone or in an emulator.

## The problem

Several original events often run the same script. Editing a command, a line of dialogue or a movement route in one of them changed all of them, and the dialogs only said so in a sentence with a count. Nothing showed which events were affected, and nothing stopped a quick save from changing a dozen NPCs.

## What changed

- **Where-used list.** The command, dialogue and movement dialogs now list every original event entry that reaches the script: map, event, and whether it still runs natively or has been replaced by an authored scene. Long lists are trimmed for display, and the counts always cover every entry.
- **Confirmation before a shared change.** If other live native events would also receive the change, saving needs a ticked confirmation that names how many. An unticked save is refused with a message and changes nothing. Events replaced by an authored scene are listed but are not counted as affected.
- **Edit only this event.** This opens the existing structural flow editor for the current event. Its changes are bound to that one event and are written as a private copy, so other events keep the shared script.
- **No gate when there is nothing shared.** An event with its own script shows a plain note and no tick box.

Logic is in `nativeStoryWhereUsed` and `planSharedEdit` in `dist/native-story.js`. The dialogs are in `dist/native-story-ui.js`. No new ROM writer or data format was added, and saved projects are unchanged.

## Acceptance

| Stage | Evidence |
| --- | --- |
| Inspect | Eight fixture tests (`tests/native-story-sharing.test.js`): shared, unshared, replaced, no current event, unknown event, large lists, events with their own copy. Deliberately breaking the logic fails 1 to 5 of them in each trial. |
| Edit | Real 412px Chromium workflow (`scripts/test-release-mobile-browser.mjs`): list contents, refusal without the tick, confirmed save, dialogue gate, no gate for a private script, and the route into the flow editor. Save controls and the tick stay inside the viewport and the tick is at least 24px. |
| Export and reindex | A root-bound flow copy leaves the other event's pointer and the shared source bytes unchanged, then the shared script is no longer reported as shared. Synthetic ROM only. |
| Engine execute | Not tested. No emulator, retail game or Shattered run. |
| Android device | Not tested. |

## Limits and still open

- "Edit only this event" copies the event's whole script through the flow editor. Copying a single routine out of a larger shared script is not done.
- An event that already has its own edited copy is marked as such in the list but still counted, because a flow copy can keep links to shared dialogue and routines. This asks more often than strictly needed, never less.
- An event already replaced by an authored scene cannot take a private native copy, and shared edits from it still need the confirmation.
- Parameter inputs, recursion limits and a call-graph view for common routines are still open under EVT07.
- Status stays `partial`. Nothing here is marked verified in game.

Tracking: issue #15, EVT07.
