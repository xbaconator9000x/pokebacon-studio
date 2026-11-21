# Native trainer party editing — development PR #29

Implemented a source-verified serializer for **original Gen III trainer party formats** and wired it into the existing Game workshop trainer editor. No second trainer database or writer is introduced.

## Native source contract

The selected trainer comes from a verified, fingerprint-bound game table. A trainer header is exactly 40 bytes. Its type uses flags 0–3 for default/custom moves and no-item/held-item variants. Ordinary party entries occupy 8 or 16 bytes; the already-confirmed expanded engine adapter can use 32 bytes for custom-move+item entries. The original party offset must be in the source ROM and halfword aligned, the count between 0 and 6 and each source level/species must be valid. Unknown flags, stale/invalid pointers and unsupported layouts fail closed.

On an unchanged party shape, the serializer begins with a copy of the original byte rows, then applies validated field changes. This preserves native padding and other unedited bytes. When toggling a format or changing party size, new rows are freshly allocated, with zero-filled padding and explicit IV/level/species/item/move fields. The 32-byte variant preserves supported nature/ability, IV/EV spreads and the tera field.

The trainer header is rewritten through the existing `applyGameDataEdits` / `RomOutput.allocate` path, so another trainer pointing at the same original party is not modified in place. The source remains immutable; an allocation failure aborts compilation. Native scripts that reference the same original trainer ID continue to point to the edited team.

## Phone editor

In **Game workshop → Trainers → Trainer**, users can reorder team slots, duplicate a Pokémon subject to the six-member limit, remove/add members and copy the whole party from another ID *in the same verified source*. Copy is an editable draft until Save; it does not change the donor. Existing held-item, custom-move, import/export team text and trainer bag-item controls remain.

## Evidence and limits

Synthetic source ROM tests cover all four original party formats, the expanded 32-byte case, source byte/padding preservation, invalid flags/pointers, species/levels/items/moves, double-battle count, draft project JSON and mobile UI integration. Native compilation has not yet been exercised for every proprietary expanded ROM variant, battle AI/rematch flags are unchanged and physical phone/mGBA battle or Flash cold-restart proof is not claimed. No ROMs, trainer data, save files or private keys were committed. This work does not change the installed APK.
