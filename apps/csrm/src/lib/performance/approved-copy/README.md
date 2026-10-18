# Approved interface copy (interface-copy guard reference)

`interface-copy-guard.test.ts` admits the export, report and import copy only when one of these contracts approves it
(Phase 19 review amendment R1 part 1, FE4-06). The guard reads these checked-in copies, never the planning records, so
archiving or moving the csrm phase directories (`/gsd-cleanup`) cannot break it.

| File | Copied verbatim from the csrm workstream's phase record | Last changed there |
| --- | --- | --- |
| `19-UI-SPEC.md` | `phases/19-csv-export-and-import-hardening/19-UI-SPEC.md` | `0e9190fd` (2026-10-17, review amendments R1 and R2) |
| `10-UI-SPEC.md` | `phases/10-existing-flow-gap-closure/10-UI-SPEC.md` | `5a3c94bf` (2026-10-04) |
| `06-UI-SPEC.md` | `phases/06-administration-and-csv-imports/06-UI-SPEC.md` | `5a3c94bf` (2026-10-04) |

These copies are now the guard's source of approved copy. When the pilot approves, rewords or retires a string, change
the copy here in the same commit as the code it admits (and the phase record too, while that phase is still open).
Never edit a copy only to make the guard pass: copy that no contract writes goes to `awaitingThePilot` instead.
