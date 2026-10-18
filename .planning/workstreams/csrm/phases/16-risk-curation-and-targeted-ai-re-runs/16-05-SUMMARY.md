---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 05
subsystem: backend-risk-curation
tags: [risk-withdrawal, risk-reinstatement, undo, risk-history, human-analyst-only, authorization-matrix, no-hard-delete, contract, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-02's risk-curation-rules.ts (parseRiskCurationBody, RiskCurationBodyError, partitionWithdrawal, partitionReinstatement, UNDO_WITHDRAWAL_REASON); 16-03's risk-history.ts (recordRiskHistory, readRiskHistory, latestWithdrawalReason, RiskHistoryError) and the four Phase 16 reasons; 16-04's withMutableAssessmentMutation with a transition function of the result and assertAssessmentEditable"
  - phase: 15-steerable-questionnaire-ai
    provides: "15-09's human-only API-only Function pattern and catalogue test shape"
  - phase: 14-request-attachments
    provides: "14-04's unmounted matrix rows (unmountedRoute)"
provides:
  - "CSRM_RISK_OPERATIONS.withdrawRisks, .reinstateRisks, .getRiskHistory"
  - "routes/risk-curation.ts and controllers/risk-curation.ts (withdraw, reinstate, history) in api::csrm-risk"
  - "services/risk-curation.ts: withdrawRisks, reinstateRisks, getRiskHistory, RiskCurationError, RiskCurationStrapi, RiskHistoryResponse"
  - "Catalogue: function.risk_curation.withdraw_api (.api.01 withdrawals, .api.02 reinstatements), function.risk_curation.history_read_api (.api.01), one Phase 16 design note, both copies byte-identical"
  - "csrm-authorization.ts: RISK_CURATION_OPERATIONS (three literals) spread into HUMAN_ANALYST_ONLY_OPERATIONS; denial sentence 'CSRM risk curation is limited to human Security Analysts.'"
  - "Spec: tag risk-curation; risk-curation/withdraw-risks, /reinstate-risks, /get-risk-history; components RiskCurationReasonRequest, RiskCurationUndoRequest, RiskCurationRequest, RiskCurationResult, RiskCurationResponse, RiskHistoryRelationValue, RiskHistoryValue, RiskHistoryFieldChange, RiskHistoryControl, RiskHistoryChanges, RiskHistoryEvent, RiskHistoryResponse; generated client"
  - "Matrix: three humanAnalystOnly rows, two unmounted application rows (DELETE /api/v1/risks/{riskId}, DELETE /api/csrm-risks/{id}), a curation fixture; served inventory regenerated; regenerate_draft's new unserved reason"
affects: [16-06, 16-10, 16-11, 16-12, 17, 17.1, 18]

actuals:
  tokens: 24500
  tasks: 3
  commits: 6

plan_head_before: 0e1ba36285a34a5e30b48bb725250efd12b80829
plan_head_after: 8d75460ab2e95fc7676efd5a5db1f74871a62964

tech-stack:
  added: []
  patterns:
    - "A curation batch is one withMutableAssessmentMutation: load every named Risk with its assessment in the transaction, refuse the whole batch with one 404 on any foreign or missing id, partition, read every Undo reason, then write the facts and one history row per applied Risk at one server instant"
    - "transition: (result) => result.applied.length > 0 ? 'accepted-edit' : 'none'"
    - "A second router file in an existing API (the my-request-status-summary shape) with a plain-object controller over globalThis.strapi"
    - "Unmounted application paths are matrix rows (unmounted, not plugin) that the inventory's served rows must not list"

key-files:
  created:
    - apps/backend/src/api/csrm-risk/services/risk-curation.ts
    - apps/backend/src/api/csrm-risk/routes/risk-curation.ts
    - apps/backend/src/api/csrm-risk/controllers/risk-curation.ts
  modified:
    - apps/backend/src/api/csrm-risk/operations.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/served-operations.json
    - apps/backend/tests/served-operations.integration.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/risk-curation.integration.test.ts

key-decisions:
  - "withdrawRisks and reinstateRisks take one object input { strapi, assessmentDocumentId, actorDocumentId, body, now? }; the actor is ctx.state.idamboxUser.documentId, never the auth mode or the body"
  - "Every Undo reason is read before any write; an Undo withdrawal of a Risk with no earlier withdrawn event refuses the whole batch with 400 'CSRM Risk has no earlier withdrawal to restore.'"
  - "One server instant per batch: withdrawnAt equals every withdrawn row's occurredAt"
  - "Reinstating only active Risks is 409 RISK_NOT_WITHDRAWN ('CSRM Risk is not withdrawn.') from inside the mutation, so the transaction rolls back and the assessment is untouched"
  - "The history query is closed to page (1 to 1,000,000) and pageSize (1 to 100), each once as a positive integer string; anything else is 400 'CSRM risk history query is invalid.'; a Risk with no assessment reads as unknown (404)"
  - "RiskHistoryChanges is published as the stored envelope v1 (schemaVersion, fields, control only on control-implementation kinds), the shape 16-03's readRiskHistory serves, rather than 'control or null'"
  - "The matrix's unmounted rows now cover application paths too: a non-plugin unmounted row must be absent from the inventory's served rows, and no unmounted row may allow any caller"

patterns-established:
  - "16-10 adds the supersession of a withdrawn Risk's open rewrite units inside withdrawRisks' mutate, after the partition"

requirements: [ASSESS-09]
requirements-completed: []  # shared ID: marked complete by the phase's last plan (shared-ID gate)

duration: 62min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 05: Withdrawal, Reinstatement with Undo and the Risk History Read Summary

**Human Security Analysts withdraw and reinstate the Risks of an unreleased assessment in one guarded transaction, each change with its reason, its Undo and its history row, and read a Risk's history newest first. The Requestors and the service agent are refused all three operations, and no route deletes a Risk, proved for all six actors.**

## Performance

- Started: 2026-10-15T06:52Z (after 16-04, `0e1ba362`)
- Completed: 2026-10-15T07:54Z
- Duration: about 62 min, including about 31 min for the full Strapi suite
- Tasks: 3 (each RED then GREEN), 6 commits
- Files: 3 created, 12 modified

## Accomplishments

- `POST /api/v1/risk_assessments/{assessmentId}/risk_withdrawals`: 1 to 200 Risks with one reason or `undo: true`. Every applied Risk gets `withdrawnAt` (the server clock), `withdrawnBy` and `withdrawalReason`, plus one `withdrawn` row. Its number, fields, control implementations and AI provenance are kept. A Risk that is already withdrawn is reported as unchanged and gets no row.
- `POST /api/v1/risk_assessments/{assessmentId}/risk_reinstatements`: clears the three facts and adds one `reinstated` row. A batch of active Risks only is refused with 409 `RISK_NOT_WITHDRAWN`. In a mixed batch, the active Risks are reported as unchanged.
- Undo works both ways through the closed flag. On a reinstatement it records `Withdrawal undone`. On a withdrawal it restores the reason the Risk held before it was reinstated. Both rows carry `undo: true`. A typed `Withdrawal undone` records `undo: false`.
- The batch refusals all leave persistence deep-equal: a foreign or unknown id is a whole-batch 404 that names no id, a malformed body is a 400, and a released assessment is 409 `ASSESSMENT_NOT_MUTABLE`.
- The accepted-edit transition runs only when something is applied. A release-ready in-review assessment returns to draft. A batch where nothing changes leaves the assessment in review. Withdrawing the last active Risk is allowed.
- `GET /api/v1/risks/{riskId}/history` returns the history newest first, with `meta.pagination` and `meta.recordedFrom`. It includes a withdrawn Risk's history. A malformed page is a 400 and an unknown Risk a 404.
- All three operations are human Security Analyst only, enforced twice: API-only Functions granted to `role.security_analyst` and `HUMAN_ANALYST_ONLY_OPERATIONS`. Every Security Analyst may curate, including the second analyst, who is not the assignee, and Bob on a request he raised (D-44).
- In the matrix, `DELETE /api/v1/risks/{riskId}` and `DELETE /api/csrm-risks/{id}` answer 405 to all six actors and change nothing (D-16).

## Task Commits

1. **Task 1: withdraw one Risk end to end:** `c6aad38d` (test, RED), `c85f93b2` (feat, GREEN)
2. **Task 2: reinstatement, Undo, batch rules, transition, released refusal:** `74b72403` (test, RED), `420b6d4b` (feat, GREEN)
3. **Task 3: history read, matrix rows and delete probes, regenerate_draft's reason, full suite:** `7be10d14` (test, RED), `8d75460a` (feat, GREEN)

## Measured Counts (W3, against today's catalogue)

| Measure | Before (`0e1ba362`) | After |
| --- | --- | --- |
| Catalogue Functions / FunctionApis | 63 / 164 | 65 / 167 |
| Served operations (inventory `served`) | 99 | 102 |
| Unserved / spec-only / plugin routes | 54 / 78 / 32 | 54 / 78 / 32 |
| Matrix rows (served + unmounted application + plugin) | 136 (99 + 0 + 37) | 141 (102 + 2 + 37) |
| `HUMAN_ANALYST_ONLY_OPERATIONS` (fixture literals + 5 insight) | 23 + 5 = 28 | 26 + 5 = 31 |

Served-inventory diff: three `served` rows were added. Each names its route in `csrm-risk/routes/risk-curation.ts`, its FunctionApi, `role.security_analyst` and its `risk-curation/*` operationId. The `unserved` reason of `POST:/api/v1/risk_assessments/{assessmentId}/regenerate_draft` now reads `reserved Phase 4 intent: superseded by the targeted proposal operations POST /api/v1/risk_assessments/{assessmentId}/risk_suggestions and POST /api/v1/risks/{riskId}/rewrite (Phase 16 D-24); whole-draft regeneration is not offered`. `UNSERVED_REASONS` still opens with the `IAM_SCIM_RESERVATIONS` spread. The "Identity Provisioning", application-slug and repeated-`seedCsrmData` assertions pass unchanged, and both new Functions seed under `idambox-csrm`, granted to Security Analyst roles only (W3).

## Verification

| Command | Result |
| --- | --- |
| Task 1 verify (tsc, tests tsc, `risk-curation` + `contract-catalogue`, `api:check`, `cmp`) | 46/46 passed; api:check clean; cmp identical |
| Task 2 verify (same files) | 54/54 passed; api:check clean; cmp identical |
| Task 3 focused: `risk-curation`, `contract-catalogue`, `served-operations`, `authorization-matrix`, `authorization-matrix-provenance.unit`, `authorization-policy.unit`, `risk-no-delete.unit` | 251/251 passed |
| Task 3 verify: `tsc` + full Strapi suite `pnpm --dir apps/backend test` | 1,908 passed, 0 failed, 1 skipped of 1,909 (31.5 min) |
| `pnpm --dir apps/csrm api:check` + `git update-index --refresh` | clean |
| Web: `contract-operation-chain`, `contract-response-parity`, `strapi-capabilities`, `conflict-reasons` (vitest) | 357/357 passed |
| `pnpm --dir apps/csrm typecheck` | passed |
| `cmp` of the two catalogue copies | identical |

RED runs: Task 1 failed 3 of 46, Task 2 failed 8 of 54, and Task 3 failed 9 of 213 (the four files with the matrix), each on the missing route or grant.

## Decisions Made

See `key-decisions`. What later plans need to know:

- `withdrawRisks`, `reinstateRisks` and `getRiskHistory` are the service seam for 16-11's web service. The responses are `{ data: { applied, unchanged } }` and `{ data: RiskHistoryEvent[], meta: { pagination, recordedFrom } }`.
- 16-10 adds the supersession of a withdrawn Risk's open rewrite units inside `withdrawRisks`' `mutate`, after the partition and before the writes, in the same transaction.
- The refusal message for automation is `CSRM risk curation is limited to human Security Analysts.` The service agent does not hold the grant in the catalogue, so in practice it gets the generic FunctionAPI denial first.

## Deviations from Plan

**1. [Plan detail] The Undo branch of `withdrawRisks` came with Task 1**
- `parseRiskCurationBody` already admits `undo: true`, so Task 1's `withdrawRisks` handles both modes rather than leaving `undo` with a temporary refusal. Task 2's RED still failed on every reinstatement case (the Undo withdrawal case needs a reinstatement first). Its transition case already passed at RED, because the transition shipped with the withdrawal in Task 1.

**2. [Plan detail] The reinstate matrix row and its human-only literal moved to Task 2**
- The plan lists the matrix files in Tasks 1 and 3 only. Adding the reinstate row with its route keeps every commit's matrix consistent: the human-only count goes 24, 25, 26.

**3. [Rule 1 - Test kept true] `publishedAt` is excluded from the "content unchanged" comparison**
- Strapi 5's Document Service `update` moves `publishedAt` on a type without draft and publish. The Task 1 test compares a Risk's content without `updatedAt`, `publishedAt` and the withdrawal facts (fixed inside Task 1's GREEN commit `c85f93b2`).

**4. [Rule 3 - Blocking] The matrix's unmounted rows now cover application paths**
- 14-04's structural test required every `unmounted` row to be a plugin row, so the plan's two risk delete rows could not be expressed. The test now accepts an unmounted application row when the inventory's `served` rows do not list it. It also refuses any unmounted row that allows a caller. Served rows exclude unmounted rows. The two rows passed at RED, because they prove a state that already held.

**5. [Plan detail] `RiskHistoryChanges` follows the executed envelope**
- The plan describes `changes` as having `fields` and `control or null`. 16-03's `readRiskHistory` serves the stored envelope v1: `schemaVersion`, `fields`, and `control` only on the control implementation kinds, with `changes: null` for an unreadable row. The contract publishes that shape, so 16-11's parser matches the wire.

**6. [Plan detail] Catalogue `sourceEntities` use `CsrmAssessment`**
- This is the catalogue's existing name for the assessment entity (the JDL term). No new entity name was introduced.

**Total deviations:** none changes behaviour beyond the plan. One test was kept true to Strapi's timestamps, one structural test was extended for the planned rows, and four are plan-shape notes.

## Issues Encountered

- A Bash heredoc holding TypeScript with nested quotes failed to parse once. The edit was redone through script files. This had no effect on the result.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-16-12 is covered by the mounted 403s and the three matrix rows, with persistence deep-equal. T-16-13 is covered by the whole-batch 404 inside the transaction, which names no id. T-16-14 is covered by the mounted `ASSESSMENT_NOT_MUTABLE` for all four bodies. T-16-15 is covered by the case where a typed `Withdrawal undone` records `undo: false`.

## Next Phase Readiness

- 16-06 can apply the active-risk rule to readiness and the readers. Withdrawn Risks now arrive only through these operations, and fixtures can also set them directly.
- 16-11 can build the web service over the three published operations and the generated `RiskCuration*` and `RiskHistory*` types.

## Self-Check: PASSED

All three created files exist. Commits c6aad38d, c85f93b2, 74b72403, 420b6d4b, 7be10d14 and 8d75460a are in history.
