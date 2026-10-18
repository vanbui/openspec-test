---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 03
subsystem: backend-schema-and-contract
tags: [risk-withdrawal, risk-history, content-type, conflict-reasons, contract, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-01's approved record (G-6 approval 2026-10-15) and 16-02's risk-history-changes.ts (RISK_HISTORY_KINDS, RISK_HISTORY_SOURCES, buildRiskHistoryChanges, parseRiskHistoryChanges)"
  - phase: 13-request-collaboration
    provides: "request-people.ts resolvePeople (one batched people read)"
  - phase: 12-ai-assisted-assessment
    provides: "csrm-ai-run (the history's aiRun target and the minimal folder shape), 12-06's deterministic draft job fixture"
provides:
  - "csrm-risk schema: withdrawnAt (datetime), withdrawnBy (unidirectional manyToOne idambox-user), withdrawalReason (text)"
  - "content type api::csrm-risk-history-event.csrm-risk-history-event (csrm_risk_history_events), core controller, router only: [], core service"
  - "apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts: RISK_HISTORY_PAGE_SIZE (25), RISK_HISTORY_PAGE_SIZE_MAX (100), RISK_HISTORY_REASON_MAX_LENGTH (500), RiskHistoryError (code RISK_HISTORY_ENTRY_INVALID | RISK_HISTORY_PAGE_INVALID, status 500 | 400), types RiskHistoryEntry, RiskHistoryEventView, RiskHistoryPage, RiskHistoryErrorCode; recordRiskHistory, readRiskHistory, latestWithdrawalReason"
  - "Closed reasons RISK_WITHDRAWN, RISK_NOT_WITHDRAWN, AI_ACCEPT_NOT_PERMITTED, REQUEST_HAS_ASSESSMENT (all 409) in Strapi, the web list, both spec enums (with descriptions) and the regenerated schema.d.ts"
  - "Harness helpers riskHistoryRowsFixture, riskWithdrawalFactsFixture, writeRawHistoryRowFixture (column checks reuse the existing listTableColumns)"
  - "apps/backend/tests/risk-curation.integration.test.ts (9 tests; later Phase 16 plans extend it)"
affects: [16-04, 16-05, 16-06, 16-07, 16-08, 16-09, 16-10]

actuals:
  tokens: 14800
  tasks: 3
  commits: 5

plan_head_before: c9c55a6715a15e14242aa7c2c99c328f69c3b966
plan_head_after: e22b410031a7bf26f8cfba914ec327efe82cf6d6

tech-stack:
  added: []
  patterns:
    - "An append-only audit type with one writer module that joins the caller's strapi.db.transaction and exports no update or delete"
    - "Mounted tests load the compiled service Strapi runs (dist) through a local structural type, so RED compiles and fails on assertions"

key-files:
  created:
    - apps/backend/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json
    - apps/backend/src/api/csrm-risk-history-event/controllers/csrm-risk-history-event.ts
    - apps/backend/src/api/csrm-risk-history-event/routes/csrm-risk-history-event.ts
    - apps/backend/src/api/csrm-risk-history-event/services/csrm-risk-history-event.ts
    - apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts
    - apps/backend/tests/risk-curation.integration.test.ts
  modified:
    - apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts

key-decisions:
  - "recordRiskHistory returns the new row's documentId and accepts an optional occurredAt (Date) so a caller can stamp the history row with the same instant as the change (for example withdrawnAt); the default is the server's time now"
  - "The writer is closed beyond the plan's minimum: reason only on withdrawn/reinstated (trimmed, 1 to 500) and refused elsewhere; undo true only on those two kinds; withdrawn/reinstated carry fields: []; control present exactly on the three control-implementation kinds; updated and control-implementation-updated need at least one field (a change of nothing writes no row); proposalItem only with an ai-run source (max 64); aiRunDocumentId present exactly when the source is ai-run; batchId is not accepted (reserved for Phase 18)"
  - "readRiskHistory validates page (positive safe integer) and pageSize (1 to 100 integer) itself and throws RiskHistoryError RISK_HISTORY_PAGE_INVALID (status 400), so 16-04's route maps it straight to a 400; pageCount is ceil(total / pageSize), 0 for an empty history"
  - "The history read projects occurredAt as an ISO string; reason and proposalItem as null when empty; a malformed changes envelope is null and the read logs one warn line per read with the count"
  - "Readiness 'unchanged' is proved structurally (the pre-Phase 16 checklist keys per drafted Risk, no withdrawal item, no Risk counted twice) and behaviourally (a history row on a Risk moves nothing, D-18), since the pre-plan output cannot be observed at runtime"

patterns-established:
  - "History rows are read in tests through riskHistoryRowsFixture (relations as documentIds, oldest first by id)"

requirements: [ASSESS-09]
requirements-completed: []  # shared ID: marked complete by the phase's last plan (shared-ID gate)

duration: 44min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 03: Withdrawal Facts, Append-Only Risk History and the Phase 16 Reasons Summary

**The approved D-01 schema change on a mounted Strapi: three withdrawal facts on `CsrmRisk`, the `CsrmRiskHistoryEvent` type with one transaction-joined writer and a paginated fail-safe read, and the four Phase 16 closed reasons in one contract change.**

## Performance

- Started: 2026-10-15 (after 16-02, `c9c55a67`)
- Tasks: 3 of 3
- Commits: 5 task commits plus this summary

## Accomplishments

- `csrm-risk/schema.json` gains `withdrawnAt`, `withdrawnBy` (no `inversedBy`) and `withdrawalReason` after `treatmentStatus`; nothing else changes.
- The `csrm-risk-history-event` folder copies `csrm-risk-type`/`csrm-ai-run`: core service, core controller, core router `{ only: [] }` (no route mounted).
- `risk-history.ts` is the only writer (validates whole, then one `documents().create` with no transaction of its own) and the only reader (newest first, bounded pages, one batched `resolvePeople`, `recordedFrom`, `changes: null` for a malformed envelope). `grep -cE "\.update\(|\.delete\("` on it prints 0.
- Four 409 reasons added to Strapi's `CONFLICT_REASONS`, the web list, both conflict enums and descriptions of `AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`; client regenerated.

## Task Commits

1. Task 1 RED `7cb3ff0a` test(16-03): expect the withdrawal columns and an append-only risk history
2. Task 1 GREEN `cbdb221d` feat(16-03): add the withdrawal facts and the append-only risk history
3. Task 2 RED `6cd658b5` test(16-03): expect the Phase 16 conflict reasons
4. Task 2 GREEN `256fcddc` feat(16-03): add the Phase 16 conflict reasons
5. Task 3 `e22b4100` test(16-03): prove withdrawal facts are server-owned and legacy risks unchanged

## Verification

- Task 1 RED: `risk-curation.integration.test.js` 0/6 pass, every failure an assertion (`CSRM_RISKS_WITHOUT_withdrawn_at`, `RISK_HISTORY_TABLE_MISSING`). GREEN: 6/6.
- Task 1 verify (backend `tsc`, tests `tsc`, the file): exit 0.
- Task 2 RED: Strapi reason test 5/6 (the Phase 16 test fails `RISK_WITHDRAWN_MISSING`); web 139/143 (the four Phase 16 cases fail). GREEN: Strapi 6/6, web 147/147, `api:check` exit 0 after the commit, then `git update-index --refresh`.
- `pnpm --dir apps/csrm typecheck` and `lint`: exit 0.
- Task 3: `risk-curation.integration.test.js` 9/9 (the three new cases pass with no source change, as the plan expected: the payload is closed).
- Full Strapi suite (`pnpm --dir apps/backend test`, after backend `tsc`): exit 0; 1871 tests, 1870 pass, 0 fail, 1 skipped (the pre-existing Windows POSIX-mode skip, IN-209), about 32 minutes.

**Freeze check** (`git diff --name-only 01dc4118 -- 'apps/backend/src/api/*/content-types/*' ':!apps/backend/src/api/idambox-user' ':!apps/backend/src/api/identity-source' ':!apps/backend/src/api/keycloak-sync-outbox'`):

```text
apps/backend/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json
apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
```

**PRAGMA lines the test asserted** (fresh harness database, `PRAGMA table_info`):

- `csrm_risks` includes `withdrawn_at` and `withdrawal_reason`.
- `csrm_risks_withdrawn_by_lnk` exists (non-empty column list).
- `csrm_risk_history_events` includes `kind`, `occurred_at`, `source_kind`, `proposal_item`, `batch_id`, `reason`, `undo`, `changes`.

`apps/backend/types/generated/*.d.ts` was not regenerated by the mounted runs (no diff), so nothing there was staged. `served-operations.json` and the catalogue copies are unchanged (no route added).

## Decisions Made

See `key-decisions`. What later plans need to know:

- `recordRiskHistory(strapi, entry)` must run inside the caller's `strapi.db.transaction`; pass `occurredAt` to share the change's instant. It throws `RiskHistoryError` (`RISK_HISTORY_ENTRY_INVALID`, status 500) for a writer bug.
- `readRiskHistory(strapi, { riskDocumentId, page?, pageSize? })` returns `{ events, pagination, recordedFrom }`; 16-04's route wraps it as `{ data: events, meta: { pagination, recordedFrom } }` and maps `RISK_HISTORY_PAGE_INVALID` to 400. It does no access check.
- `latestWithdrawalReason(strapi, riskDocumentId)` is the Undo source only.

## Deviations from Plan

**1. [Plan detail] `tableColumnsFixture` not added; the existing `listTableColumns` is reused**
- The harness already has `listTableColumns(table)` (Phase 13, `PRAGMA table_info`) with the same contract. No other Phase 16 plan names `tableColumnsFixture` (grep), so a duplicate helper was not added.

**2. [Plan detail] Mounted tests load `risk-history.js` from `dist`**
- The test reads the compiled service Strapi runs through a local structural type (the `attachment-quarantine` pattern), so the RED commit compiled and failed on assertions rather than on a missing import (#3770). Error identity is checked by `name: "RiskHistoryError"`.

**3. [Plan detail] Task 3 has no separate RED commit**
- The plan expected its cases to pass with no source change (the closed payload). They did, so Task 3 is one `test(...)` commit, as the plan names it.

**4. [Note] The acceptance grep for `AI_PROPOSAL_NOT_OPEN` prints one line**
- `apps/csrm/src/lib/api/conflict-reasons.test.ts:104` is Phase 15's (`206769e3`) assertion that the code is NOT a reason. No code, list or spec defines it.

**Total deviations:** none affecting behaviour; three plan-shape notes and one grep note.

## Issues Encountered

None.

## Known Stubs

None. `risk-history.ts` has no production caller yet by design (16-04 onwards wire it).

## Threat Flags

None beyond the plan's register: no route is mounted (T-16-06), and T-16-07 is proved on the mounted PATCH for both analyst identities.

## Next Phase Readiness

- 16-04 can mount `GET /api/v1/risks/{riskId}/history` over `readRiskHistory` and write rows from the update paths through `recordRiskHistory`; the four reasons are already in the contract.
- The operator's development database gains the columns and the table at the orchestrator's next Strapi start (manual, 16-VALIDATION).

## Self-Check: PASSED

All created files exist; commits 7cb3ff0a, cbdb221d, 6cd658b5, 256fcddc and e22b4100 are in history.
