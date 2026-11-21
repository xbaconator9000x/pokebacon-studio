# Native trainer encounter settings — development PR #29

Original Gen III 24-byte NPC object template inspection and guarded native export are exposed under **ROM story → original NPC → Trainer sight & patrol**. Changes bind to source ROM ID, map key, NPC record index/local ID and the original full record. All changes are validated before applying any bytes; on source mismatch, output is left unchanged.

Fields: movement-range X/Y are four-bit nibbles in byte +10 (byte +11 is preserved). Trainer type is a 16-bit LE value at +12, and the trainer sight/berry-tree field is 16-bit LE at +14. Only existing standard trainers (type 1/2) are editable; non-trainer or custom union records are rejected. Sight range 1–15 tiles; movement range each 0–15. Source refresh preserves an old edit only as a conflict requiring re-review against the new ROM, not a silent remap.

Synthetic original GBA event table tests prove source inspection, staging, project save/reopen, atomic all-or-nothing mutation, event relocation and native reader reindexing. Actual sight-trigger gameplay, movement pathfinding, arbitrary ROM revisions, trainer-party table editing, real save/rematch persistence, physical Android and signed release are **not** established.

Reference: pret/pokefirered ObjectEventTemplate in include/global.fieldmap.h (https://github.com/pret/pokefirered/blob/master/include/global.fieldmap.h). No user ROM bytes or signing keys are included.
