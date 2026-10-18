---
phase: 19-csv-export-and-import-hardening
plan: 01
subsystem: contract-records
tags: [contract-gap, G-6, design-direction, csv-export, xlsx-export, import-tolerance, shared-backend]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "X-27 to X-29 in the direction (X-30 follows the X-29 Record history bullet); Phase 16 closed at bdd0f698"
  - phase: 14-request-attachments
    provides: "the security event log, ZIP reader, XLSX reader and stored-file sender the records reuse; the Approval line format in force"
  - phase: 06-administration-import
    provides: "the import contract the Phase 19 import-tolerance record amends"
  - phase: 07-derived-insights
    provides: "items 4 and 5: the reserved report export the Phase 19 amendment serves"
provides:
  - "X-30 Export, X-31 Print report and X-32 Matched by similar name in docs/design/csrm-design-direction.md"
  - "the approved record docs/contract-gaps/phase-19-exports-and-export-log.md (14 export operations, file responses, Functions, SERVICE_IDENTITY_REFUSED_OPERATIONS, the released-assessment read check, the row cap, neutralisation, export events, closed reasons, delivery)"
  - "the approved record docs/contract-gaps/phase-19-import-tolerance.md (XLSX input, archive bounds, file refusals, header matching, #CLEAR, the similar state and its decisions, templates, error reports, the result record, import.committed)"
  - "the approved Phase 19 amendments to the Phase 06 import record and the Phase 07 insights record"
  - "PHASE_19_BASE=bdd0f698 for every later freeze check and the 19-15 gate"
affects: [19-02, 19-03, 19-04, 19-05, 19-06, 19-07, 19-08, 19-09, 19-10, 19-11, 19-12, 19-13, 19-14, 19-15, phase-17, phase-17.1, phase-19.1, phase-22]

actuals:
  tokens: 21200
  tasks: 3
  commits: 4  # git rev-list --count c5c994ee..e287e692: two Task 1 commits, the worker's pause-state commit and the pilot's approval commit; the docs(19-01) metadata commit follows

plan_head_before: c5c994ee7541fc31fdb7fdcbdb5d56c7c4f8e257
plan_head_after: e287e6921673d12197f8fd05d6ca0b74eb29fb24

tech-stack:
  added: []
  patterns:
    - "One released-assessment record-read module (released-assessment-read.ts) that Phases 17 and 17.1 widen in one place"
    - "A generic SERVICE_IDENTITY_REFUSED_OPERATIONS set decided by isEligiblePerson, beside HUMAN_ANALYST_ONLY_OPERATIONS"
    - "An export is its list whole: the list's own parser, scope, repository and order, plus the underlying-read grant"

key-files:
  created:
    - docs/contract-gaps/phase-19-exports-and-export-log.md
    - docs/contract-gaps/phase-19-import-tolerance.md
  modified:
    - docs/design/csrm-design-direction.md
    - docs/contract-gaps/phase-06-administration-import-contract.md
    - docs/contract-gaps/phase-07-derived-insights.md

key-decisions:
  - "Phase 19 contract records and the Phase 06 and 07 amendments approved by the pilot on 2026-10-16 (G-6)"
  - "Keep ASSESSMENT_NOT_RELEASED (not the UI-SPEC's EXPORT_NOT_RELEASED) so Phase 17 D-29 reuses one reason; the 19-UI-SPEC row follows the record when its owning plan reaches it"
  - "columns applies to the 12 list views only; the report export and the released-assessment export take none (UI-D5)"
  - "An unreadable import file answers 422 with a closed reason; a malformed multipart request stays 400; the web's handling is updated in 19-15"
  - "A record over 64 KiB becomes one rejected row VALUE_TOO_LONG, not a refusal of the whole file"

patterns-established:
  - "Each Phase 19 record and amendment carries Affected Workstreams with both iam greps and every change's backward-compatibility position"

requirements-completed: []

coverage:
  - id: D1
    description: "X-30 to X-32 recorded verbatim from 19-UI-SPEC at the planned places in the design direction"
    requirement: CSV-01
    verification:
      - kind: other
        ref: "Task 1 <automated> verify (direction label greps); git diff bdd0f698 -- docs/design/csrm-design-direction.md removes no line"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both Phase 19 contract-gap records and the two dated amendments, each with Affected Workstreams, approved by the pilot (G-6)"
    requirement: CSV-02
    verification:
      - kind: other
        ref: "Task 1 <automated> verify; Task 3 <automated> verify (four approval lines, no awaiting line), exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "No application source, reference file or content type changed since PHASE_19_BASE"
    requirement: CSV-03
    verification:
      - kind: other
        ref: "git diff --name-only bdd0f698 HEAD -- apps docs/references prints nothing"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-16
status: complete
---

# Phase 19 Plan 01: Contract Records and Direction Entries Summary

**The approved Phase 19 contract: 14 export operations (12 list views, the report export and the released-assessment export) with exact CSV and OOXML file responses, five new API-only Functions and the moved register and report FunctionApis, a generic `SERVICE_IDENTITY_REFUSED_OPERATIONS` refusal, one released-assessment record-read module, the 10,000-row cap and export events; and an import-tolerance record adding XLSX input, label header matching, `#CLEAR`, the sixth row state `similar` with analyst decisions, templates and error reports. The direction now records X-30 to X-32.**

PHASE_19_BASE=bdd0f698

## Performance

- **Duration:** about 15 min of execution (22:26 to 22:40 +11:00, 2026-10-16), with the pilot's review in between; Task 3 and this summary at 2026-10-16T11:40Z
- **Started:** 2026-10-16T11:26:12Z
- **Completed:** 2026-10-16T11:45:00Z
- **Tasks:** 3 (Task 1 executed, Task 2 the pilot's approval, Task 3 check-only)
- **Files modified:** 5

## Accomplishments

- **Direction.** X-30 "Export (CSRM extension, 2026-10-01)" is a bullet in `### Dialogs` after the X-29 Record history bullet; X-31 "Print report (CSRM extension, 2026-10-01)" is a paragraph in `### Print` after the Print refinements paragraph; X-32 "Matched by similar name (CSRM extension, 2026-10-01; extends CSV import rows)" is a bullet in `### Status & risk badges` after the CSV import rows bullet. The file has only added lines since `bdd0f698`.
- **Export record** `docs/contract-gaps/phase-19-exports-and-export-log.md`, with all 15 planned sections: the 12 list exports and the two fixed-table exports with their parameters (no `columns` on reports or the released assessment); the exact media types `text/csv; charset=utf-8` and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` plus `X-CSRM-Row-Count`; the Functions, the two FunctionApi moves, `underlyingRead`, `HUMAN_ANALYST_ONLY_OPERATIONS`, `SERVICE_IDENTITY_REFUSED_OPERATIONS` and the two exact 403 messages; `released-assessment-read.ts` and `findReadableReleasedAssessment`; `EXPORT_ROW_CAP`; neutralisation; `export.completed` and `export.refused`; the closed reasons; delivery; Affected Workstreams with nine changes.
- **Import record** `docs/contract-gaps/phase-19-import-tolerance.md`, with all 16 planned sections: UTF-8 CSV and the first `.xlsx` worksheet, the 512-entry and 52,428,800-byte archive bounds, every file refusal with its reason and `found` details, header matching, `#CLEAR`, the example row, the `similar` state with `matchedName` and `decisions` (`IMPORT_DECISION_MISSING`), templates, error reports and the result record (`resultToken`), `import.committed`, Affected Workstreams with six changes.
- **Phase 06 amendment** "XLSX input, header matching and the similar row state" and **Phase 07 amendment** "the report export served", each dated 2026-10-16 with `### Affected Workstreams` naming `csrm` and `iam`. Neither record lost a line.

## The `iam` greps

Run by Task 1 on 2026-10-16, recorded in both records and both amendments, and re-run unchanged at Task 3:

```
grep -rlE "csrm-authorization|idambox-csrm-role-function-api-catalogue|served-operations|specification\.json|conflict-reasons" .planning/workstreams/iam/
```

Grep A printed 10 files, all in IAM phase 02 (`02-identity-model-and-leaver-safe-keycloak-sync`): `02-03-PLAN.md`, `02-03-SUMMARY.md`, `02-05-PLAN.md`, `02-13-PLAN.md`, `02-CONTEXT.md`, `02-GATE-EVIDENCE.md`, `02-RESEARCH.md`, `02-REVIEW.md`, `02-SECURITY.md`, `02-VALIDATION.md`.

```
grep -rlE "CONFLICT_REASONS|HUMAN_ANALYST_ONLY|SERVICE_IDENTITY_REFUSED|/v1/[a-z_]+/export|export_api|csv-import|import/preview|import/template|error_report|function\.risk_register|function\.reports|function\.administration|AssessmentWorkflowErrorResponse|write-excel-file|xlsx-reader|security-event-log" .planning/workstreams/iam/
```

Grep B printed nothing (exit status 1). `iam` reads the shared policy, catalogue and served inventory for registered-source-service isolation and `function.identity_provisioning.api`, none of which Phase 19 changes.

## The pilot's answer (Task 2), verbatim

The pilot resolved the checkpoint by writing the four dated approval lines, each followed by a "What the pilot checked (2026-10-16)" paragraph, and committing them as `e287e692` ("docs(19-01): the pilot approves the two Phase 19 records and the Phase 06 and 07 amendments (G-6)"). The answer was **approved**, as relayed: "Task 2's checkpoint was resolved by the pilot, who wrote the four G-6 approval lines in commit `e287e692` (with "What the pilot checked" text after each)."

The pilot's rulings on the executor's four points, verbatim from the approval notes in both records:

> Rulings on the executor's four points: (1) `ASSESSMENT_NOT_RELEASED`, not the UI-SPEC's `EXPORT_NOT_RELEASED`, so Phase 17 D-29 reuses one reason, and the UI-SPEC row follows the record; (2) `columns` applies to the 12 list views only, never to the report export (UI-D5); (3) an unreadable import file answers 422 with a closed reason and a malformed multipart request stays 400, and `csrm` (the only caller) is updated in 19-15; (4) a record over 64 KiB becomes one rejected row `VALUE_TOO_LONG`, not a whole-file refusal, which keeps the import tolerant and the error report correctable.

## Approval lines (approval written by the pilot, dated 2026-10-16, commit `e287e692`)

Copied verbatim:

- `docs/contract-gaps/phase-19-exports-and-export-log.md`: `Status: **approved by the pilot on 2026-10-16** (G-6).`
- `docs/contract-gaps/phase-19-import-tolerance.md`: `Status: **approved by the pilot on 2026-10-16** (G-6).`
- `docs/contract-gaps/phase-06-administration-import-contract.md`: `Phase 19 amendment status: **approved by the pilot on 2026-10-16** (G-6).`
- `docs/contract-gaps/phase-07-derived-insights.md`: `Phase 19 amendment status: **approved by the pilot on 2026-10-16** (G-6).`

**Task 3 check.** The plan's verify command (`tr -d '*'`, the two record greps, the two Phase 19 section greps, and no `status: awaiting` line in any of the four files) exited 0. This task changed no file and made no commit. `git diff --name-only bdd0f698 HEAD -- apps docs/references` prints nothing, and no file under `apps/backend/src/api/*/content-types/` changed.

## Task Commits

1. **Task 1: direction entries.** `2080259b` (docs)
2. **Task 1: both records and the two amendments.** `555b518c` (docs)
3. **Pause state at the checkpoint.** `0c5f38b8` (docs, the worker's STATE.md handoff)
4. **Task 2: the pilot's approval lines.** `e287e692` (docs, written and committed by the pilot)
5. **Task 3:** no commit (check-only)

**Plan metadata:** the `docs(19-01)` commit that adds this summary, STATE.md and ROADMAP.md.

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-30 to X-32
- `docs/contract-gaps/phase-19-exports-and-export-log.md`: the new export record
- `docs/contract-gaps/phase-19-import-tolerance.md`: the new import-tolerance record
- `docs/contract-gaps/phase-06-administration-import-contract.md`: the Phase 19 amendment
- `docs/contract-gaps/phase-07-derived-insights.md`: the Phase 19 amendment

## Decisions Made

The four points the Task 1 executor raised at the checkpoint, ruled by the pilot (see the rulings above):

1. **`ASSESSMENT_NOT_RELEASED`** stays the reason name. The 19-UI-SPEC's `EXPORT_NOT_RELEASED` row is changed to match when the plan that owns that copy reaches it.
2. **`columns`** applies to the 12 list views only (the record counts "13 list exports" as the 12 list views plus the report export; the report export takes no `columns`).
3. **An unreadable import file** answers 422 with a closed reason; a malformed multipart request stays 400. 19-15 updates the web's handling.
4. **A record over 64 KiB** becomes one rejected row `VALUE_TOO_LONG`, not a refusal of the whole file.

## Deviations from Plan

None. The plan was executed as written. Task 3 was check-only on the approve path and changed nothing.

## Issues Encountered

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 19-02 can start: its precondition on both records' pilot-written approval lines holds.
- Every later contract plan's precondition on the four approval lines holds.
- 19-15 greps `PHASE_19_BASE=bdd0f698` from this summary.

## Self-Check: PASSED

- Files present: `docs/contract-gaps/phase-19-exports-and-export-log.md`, `docs/contract-gaps/phase-19-import-tolerance.md` and the three modified files.
- Commits present: `2080259b`, `555b518c`, `0c5f38b8` and `e287e692`.
- Task 3's verify exits 0; `git diff --name-only bdd0f698 HEAD -- apps docs/references` is empty.

---
*Phase: 19-csv-export-and-import-hardening*
*Completed: 2026-10-16*
