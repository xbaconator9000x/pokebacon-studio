# Edit sets

An edit set is a portable file of the game data edits made in a project (Pokémon, moves, items, trainers and wild encounters). It lets edits made against one ROM be reviewed and carried to another, for example a new release of a hack, instead of being tied to the exact ROM file they were made on.

Game workshop, Overview: **Export edit set** and **Import edit set**.

Each entry keeps the values it replaced. On import every entry is compared with the open ROM:

- **Ready**: the ROM still holds the original values, so the edit applies cleanly.
- **Already match**: the ROM already has the edited values; nothing to do.
- **Conflict**: the ROM holds values that match neither. These are skipped unless you tick the option to apply them. A record whose name differs from the source ROM's record at the same id is also a conflict, because ids may have shifted.
- **Cannot be applied**: the record does not exist, or this ROM's adapter cannot edit that table or field.

Sprite and form edits are not carried. Nothing is written to the ROM on import; edits join the project and are compiled as usual.

Verified with unit tests and by reviewing a Monomyth edit set against Monomyth itself (all ready) and against a pokeemerald-expansion build (items and trainers conflict, species and encounters not editable there). Not tried on a device.
