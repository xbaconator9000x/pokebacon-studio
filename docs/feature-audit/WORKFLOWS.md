# Verification and acceptance matrix

Stages: I import; N inspect; E edit; S save; O reopen; X export; R execute in emulator; U reimport; V validate. “Tested” below means existing bounded automated fixtures; it never substitutes for R. Engine identity and hash/signature must accompany native evidence.

| Workflow | Existing evidence | Missing acceptance gate | Feature IDs |
| --- | --- | --- | --- |
| Existing Shattered event | Native story indexing, opaque nodes, flow validation, script-byte tests | Select a real authored gate/Aipom/raid event; see every root/step; edit dialogue plus one branch; S/O/X/R/U/V without changing adjacent behavior | EVT01–08, SHA07–08 |
| Event pages | Separate draft #11 plus current flow editor | Reconcile the draft; prove precedence, page-local appearance, saved self-state and trigger behavior | EVT04 |
| New complex quest | Scene/quest compiler and template tests | Draw actor paths, run simultaneous tracks, test all choices and bag/party-full failures, save during progression and revisit after reload | SCN01–06, QST01–05 |
| Trainer/NPC | Table/profile and event compiler code | Create or duplicate trainer identity; edit team/range/dialogue; approach, win/lose, repeat/rematch; reopen and reimport | NPC01–05 |
| Connected maps | Seam/crop/warp and native import tests | Pan connected maps on phone; resize room; cross every edge both ways; check signed offsets and out-of-map borders | MAP01–10 |
| Pokémon/form | Species/learnset/form models and native hooks | Allocate real empty slot; edit dex/ability/art; encounter/evolve/battle/save; preserve other species and shared palettes | MON01–08 |
| Item/equipment | Item table/reward code; guarded Shattered tables | Equip/unequip refreshes actual techniques and battle state; bag-full reward does not consume success flag | ITM01–05, SHA02 |
| Sprite/clothing | Pixel/frame/layer/palette and byte encode tests | Open actual player/NPC/mon frame, trace without baking reference, draw using phone gestures; native frame, palette and animation readback | ART01–08 |
| Music/cry/SFX | Rich MIDI/native codec/arrangement tests | Select imported parts and source bank, preview/stop on phone, native audition after export; retain loop/sample ownership | AUD01–05 |
| Native UI | Limited presentation text slots; later 4.72.5 layout work unreconciled | Edit bag/trainer card/battle screen and compile/play it; preview-only designs cannot pass | UI01–06 |
| Storage recovery | Full-save fixtures; new history-scope and IndexedDB-shim checks | Physical Android quota/worker timeout/process death, retry and original-key update; no successful save label after a failed write | REL03–07 |
| Optional save workspace | PKHeX reference only | Explicit future scope/format separation, checksums and backup validation | UX06 |

## Common failure cases

Every applicable workflow needs cancellation, unsupported revision, missing asset/ROM, changed source binding, oversized resources, shared resource aliases and failed writes. Test original bytes and unrelated project sections before/after, not only the intended visible result.

An emulator clip must show the actual exported ROM hash, setup/action/result and save/reload when persistence matters. A browser canvas simulation or an unsigned APK compile is not native gameplay evidence. UI evidence should use measured phone viewports and touch interactions.

## Simplified and advanced modes

Both views edit the same typed action/resource IDs and history entries. Visual edits must preserve unknown fields and advanced values. Raw/script edits that cannot be represented visually remain visible as technical/read-only blocks with reasons. Never approximate an opaque instruction's size or effects. Shared scripts require an explicit modify-all or detach workflow.
