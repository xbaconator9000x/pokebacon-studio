# Shattered compatibility benchmark

Shattered GBA and the separate Essentials remake are distinct engine/data formats. This audit inspected the public editor's adapters, not the current private ROM or complete current engine source; gameplay claims therefore remain unverified.

## Current evidence and required contracts

| Mechanic | Public editor evidence | Required adapter metadata / proof |
| --- | --- | --- |
| HUMAN participant | Guarded Shattered class/data reader; ability compiler explicitly rejects HUMAN species binding | Versioned participant identity, class/stat/type rules, battle hooks, graphics IDs and save fields |
| Equipment/techniques | Guarded record readers/writers; ordinary item and scene tooling | Slot enum, equip/unequip functions, granted-move refresh contract, availability rules, ownership and UI linkage |
| Shared stamina | No general dedicated editor located | Cost/restore functions, shared pool/save field, HUD ownership and migration |
| Specialisations | Editable class-like data limited to known tables | Level/requirement/combination schema, passive hook contracts, transitions and learnsets |
| Befriending/party cap | No general engine editor located | HUMAN exclusion, one-partner selection, eligibility, safe swap conditions and saved partner identity |
| Followers/riding | Sprite/frame extraction exists for verified layouts | Indoor/size rules, mounted state, sprite/rider layering, animation mapping, speeds, collision/camera/door transitions |
| Multi-actor raid scene | Native graph and authored scene code | Exact special/call schemas, movement concurrency and cancellation, state progression and battle outcome contracts |
| Custom UI/battle rules | Presentation text/known tables only on this branch | Source symbols, screen/window/tilemap/palette/code ownership and reproducible compiler |

## Required first acceptance scenario

Use an authorised matching GBA ROM and project privately. Open an event ChatGPT authored for Shattered, such as the Gate → Aipom transition. The editor must show the actual imported commands, shared calls, speaker/actor context, conditions and unresolved blocks. Change one line of dialogue and one safe branch through the visual interface. Save/reopen, export a new ROM, execute both branches and save/reload, then reimport and compare the adjacent untouched event.

If a native call is unknown, preserve its original bytes and address and block unsafe structural movement. A friendly label alone does not establish its semantics. If a source manifest exists, it must include engine revision, symbol addresses/sizes, custom opcode widths, input/output variables, side effects, resource dependencies and validation signatures. Symbols are data; imported source may not execute arbitrary build scripts in the app.

## Preservation and ownership

Use one authoritative project model and one reviewed writer per engine. Edited resources retain stable IDs and original/source/applied fingerprints. A built ROM may already contain a patch: reconciliation must recognise that applied state rather than replaying older patches. Refresh cannot overwrite current authored geometry or silently discard opaque commands.

Private ROMs, saves, artwork, JSON snapshots and keys do not belong in these public audit files. Only sanitised synthetic fixtures or permission-cleared metadata may be committed.
