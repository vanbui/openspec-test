---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 06
subsystem: backend-assessment-readers
tags: [active-risk-rule, release-readiness, risk-withdrawal, requestor-reads, assessment-lists, relationship-counts, contract, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-02's active-risk.ts (isActiveRisk, activeRisks, ACTIVE_RISK_FILTER, activeRiskSql); 16-03's withdrawal facts (withdrawnAt, withdrawnBy, withdrawalReason); 16-05's withdrawRisks served at POST /api/v1/risk_assessments/{assessmentId}/risk_withdrawals"
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-07's riskSummariesFor and projectAssessmentSummary(document, riskSummary) on both assessment lists"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "AnalystRiskDetail.aiProvenance and the aiProposalsReviewed readiness requirement"
provides:
  - "assessment-workflow.ts: releaseReadinessRisks (activeRisks, malformed entries kept), iterated by validateReleaseReadiness and projectReleaseReadiness"
  - "assessment-scope.ts: projectRiskWithdrawal (exported) and AnalystRiskDetail.withdrawal in projectAnalystRiskDetail"
  - "risk-workflow.ts: loadAnalystAssessmentRiskDetails populates withdrawnBy (documentId, displayName); listAssessmentRiskDocuments filters ACTIVE_RISK_FILTER"
  - "csrm-assessment.ts controller: ACTIVE_RISK_FILTER on listAssessmentRisks, the Requestor's 404 on a withdrawn Risk's control implementations, activeRiskSql('r') in riskSummariesFor"
  - "relationship-scope.ts: residualRiskCounts and controlImplementationCount over activeRisks"
  - "Spec: component RiskWithdrawal (closed: at date-time, by ActiveUserSummary or null, reason 1-500); AnalystRiskDetail.withdrawal required, RiskWithdrawal or null; generated client"
  - "Web: riskWithdrawalSchema and type RiskWithdrawal exported from assessment-schema.ts; analystRiskDetailSchema.withdrawal; parity guard case for AnalystRiskDetail and RiskWithdrawal"
affects: [16-07, 16-08, 16-09, 16-11, 16-12, 17, 17.1, 18, 19]

actuals:
  tokens: 15200
  tasks: 2
  commits: 4

plan_head_before: 7cc83800095ad99501f1de5bcba1c2f1b6f06968
plan_head_after: a2cf4926a2e3911ec59b64f238d72fba823db4de

tech-stack:
  added: []
  patterns:
    - "Readiness iterates one helper list (releaseReadinessRisks) in both functions, so the risks[index] paths can never disagree"
    - "A Requestor's read of a withdrawn record returns the same 404 body as an unknown record"
    - "SQL aggregates take the active-risk rule through activeRiskSql(alias) in whereRaw"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
    - apps/backend/src/api/csrm-assessment-request/services/relationship-scope.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx
    - apps/backend/tests/assessment-workflow.unit.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/risk-curation.integration.test.ts

key-decisions:
  - "Readiness drops a withdrawn Risk but keeps an entry that is not a record, so a malformed populate still fails closed (risks[i] missing; the projection still throws 400). activeRisks alone would have dropped it silently."
  - "The analyst assessment detail lists every Risk, each with withdrawal null or { at, by, reason }. Its readiness and owner labels are computed over the loaded Risks. Readiness drops the withdrawn ones itself, and owner labels keep their owners because the analyst still sees them."
  - "The assessment risk list (GET /api/v1/risk_assessments/{id}/risks) serves active Risks to both actors, as the plan records. The analyst sees a withdrawn Risk only in the assessment detail."
  - "withdrawal.at is normalised to an ISO instant. withdrawal.by is ActiveUserSummary, or null when the person is not populated."
  - "The web RiskWithdrawal.by mirrors ActiveUserSummary without bounds, and reason keeps the contract's 1-500 without trim, so the new paths add no grandfathered client bound."

patterns-established:
  - "Later readers that list or count an assessment's Risks use ACTIVE_RISK_FILTER (Document Service) or activeRiskSql (SQL), as the assessment controller does here"

requirements: [ASSESS-09]
requirements-completed: []  # shared ID: marked complete by the phase's last plan (shared-ID gate)

duration: 52min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 06: The Active-Risk Rule on Every Assessment-Side and Requestor Reader Summary

**A withdrawn Risk no longer counts toward release readiness, release, either assessment list's count and highest residual rating, the request relationship counts, or any Requestor read. The analyst's assessment detail still lists it with `withdrawal: { at, by, reason }`. The `AnalystRiskDetail.withdrawal` change landed in the spec, the generated client, the closed web parser and the parity guard together.**

## Performance

- **Duration:** 52 min
- **Started:** 2026-10-15T07:55:33Z
- **Completed:** 2026-10-15T08:47:27Z
- **Tasks:** 2 (TDD: 2 RED and 2 GREEN commits)
- **Files modified:** 14

## Accomplishments

- **Readiness (D-12, D-13, Pitfall 2).** `validateReleaseReadiness` and `projectReleaseReadiness` both iterate `releaseReadinessRisks(...)`, which is built on `activeRisks`. Their `risks[index]` paths name the same Risk. An incomplete withdrawn Risk no longer blocks release, and a mounted release succeeds with one. When every Risk is withdrawn, "At least one Risk" is outstanding. The release path and the pre-edit transition in `withMutableAssessmentMutation` read readiness through `validateReleaseReadiness`, so they follow the same rule.
- **Analyst detail (D-08, D-03 item 9).** `projectAnalystRiskDetail` adds `withdrawal`. It is null on an active Risk and `{ at, by: { documentId, displayName } | null, reason }` on a withdrawn one. `loadAnalystAssessmentRiskDetails` populates `withdrawnBy` with `documentId` and `displayName` only.
- **Readers changed** (the plan's output asks for the full list):

  | Reader | File | Change |
  | --- | --- | --- |
  | Release readiness, release path, pre-edit transition | `assessment-workflow.ts` | Only active Risks count, through one shared list |
  | Analyst assessment detail | `assessment-scope.ts`, `risk-workflow.ts` | Every Risk listed with `withdrawal`; readiness counts active Risks |
  | Assessment risk list, both actors | `controllers/csrm-assessment.ts` `listAssessmentRisks` | `...ACTIVE_RISK_FILTER` |
  | Control implementations of a Risk | `controllers/csrm-assessment.ts` `listRiskControlImplementations` | Requestor: the unknown Risk's 404 on a withdrawn Risk. Analyst: 200 |
  | Both assessment lists' `riskCount` and `highestResidualRating` | `controllers/csrm-assessment.ts` `riskSummariesFor` | `.whereRaw(activeRiskSql("r"))` |
  | Request relationship counts, both actors, also used by `my_requests` and the lifecycle | `relationship-scope.ts` | `activeRisks` around `residualRiskCounts` and `controlImplementationCount` |
  | `listAssessmentRiskDocuments` (loader of the unrouted csrm-risk copy) | `risk-workflow.ts` | `...ACTIVE_RISK_FILTER` |
  | Released assessment detail | `assessment-scope.ts` | No change: `RequestorReleasedAssessmentDetail` carries no Risks (see deviation 2) |

- **Did both controllers serve the risk list route?** No. Only `api::csrm-assessment.csrm-assessment.listAssessmentRisks` is routed. `api::csrm-risk.csrm-risk.listAssessmentRisks` has no route. Its loader `listAssessmentRiskDocuments` gets the same filter, so it follows the rule if a route is ever added.
- **Contract (D-02).** The spec gains the closed component `RiskWithdrawal`, and `AnalystRiskDetail.withdrawal` is required and nullable with `additionalProperties: false` kept. The client was regenerated. The web adds `riskWithdrawalSchema` and the widened `analystRiskDetailSchema`. The parity guard compares both components with their parsers key for key and refuses an unknown key inside `withdrawal`.

## Task Commits

1. **Task 1 RED:** `3b82ef44` `test(16-06): expect withdrawn risks out of readiness and marked in the analyst detail`
2. **Task 1 GREEN:** `6aec8f25` `feat(16-06): count only active risks in readiness and mark withdrawn risks for analysts`
3. **Task 2 RED:** `c834c6ce` `test(16-06): expect every Requestor read and list count to exclude withdrawn risks`
4. **Task 2 GREEN:** `a2cf4926` `feat(16-06): exclude withdrawn risks from every Requestor read and list count`

## Verification

| Command | Result |
| --- | --- |
| Task 1 RED: `assessment-workflow.unit`, `risk-curation.integration`, `assessment-workflow.integration` | 111 tests, 4 failed as intended. The web RED run also failed as intended. |
| Task 1 verify: backend `tsc`, tests `tsc`, the three Strapi files | 111 tests: 111 passed, 0 failed |
| `pnpm --dir apps/csrm api:check` (after the commit) plus `git update-index --refresh` | Clean (exit 0) |
| `vitest run src/features/contract-response-parity.test.ts src/features/assessments` | 18 files, 749 tests passed |
| Task 2 RED: `risk-curation.integration` | 36 tests, 3 failed as intended. The Secondary Requestor case already passed. |
| Task 2 focused: `risk-curation.integration` and `request-workflow.integration` | 46 tests: 46 passed |
| Full Strapi suite: `pnpm --dir apps/backend test` | 1,916 tests: 1,915 passed, 0 failed, 1 skipped |
| Full web suite: `pnpm --dir apps/csrm test` | 222 files, 5,419 tests passed |
| `pnpm --dir apps/csrm typecheck`, `pnpm --dir apps/csrm lint`, backend `tsc` | Exit 0 |

The tracer feedback gate for Task 1 passed: its whole verify command was re-run and passed before Task 2 started.

## Decisions Made

See `key-decisions`. What later plans need to know:

- `projectRiskWithdrawal(document)` is exported from `assessment-scope.ts`. The Risk Register detail can reuse it when it adds `withdrawal`.
- The risk list route serves active Risks to the analyst too. A web view that needs withdrawn Risks reads them from the analyst assessment detail.

## Deviations from Plan

**1. [Rule 2 - Fail closed] Readiness keeps malformed Risk entries**
- **Found during:** Task 1 GREEN
- **Issue:** `activeRisks` drops any entry that is not a record. Before this plan, `validateReleaseReadiness` reported such an entry as `risks[i]` and `projectReleaseReadiness` threw a 400. Calling `activeRisks` directly would have silently ignored a malformed populate.
- **Fix:** Both functions iterate `releaseReadinessRisks`. That helper calls `activeRisks` and keeps non-record entries. The acceptance criterion "both call `activeRisks`" is met through this one helper.
- **Commit:** `6aec8f25`

**2. [Plan detail] The released assessment detail needed no change**
- `projectReleasedAssessmentDetail` and `releasedAssessmentQuery` neither populate nor serve Risks. The contract's `RequestorReleasedAssessmentDetail` has no `risks`. A Requestor's released view gets its Risks from the risk list route, which now filters. The mounted test proves that Jane's detail response holds no trace of the withdrawn Risk: its id, number, reason and control implementations are all absent.

**3. [Plan detail] No change to the analyst detail handler**
- `getAssessment` already passes the loaded Risks to `projectReleaseReadiness`, which now drops withdrawn Risks itself. Computing `activeRisks` in the handler as well would apply the rule twice.

**4. [Plan detail] Only the assessment controller serves the risk list route**
- `csrm-risk.ts`'s `listAssessmentRisks` is not routed, so the controller was left unchanged. The `ACTIVE_RISK_FILTER` went into its loader `listAssessmentRiskDocuments` in `risk-workflow.ts`. That loader feeds `projectRiskSummary`, so no `withdrawnBy` populate was needed there. Only `loadAnalystAssessmentRiskDetails` populates it.

**5. [Rule 1 - Test kept true] The parity case uses the registered analyst detail parser**
- The RED parity case took `getAssessment`, whose component `AssessmentDetailResponse` carries no Risks. The GREEN commit points it at `getReleasedAssessment (analyst actor)`, the `AnalystAssessmentDetail` branch, with a released instance. It also compares the `withdrawal` property's `anyOf` rather than the whole property, because the spec property carries a description.
- **Commit:** `6aec8f25`

**6. [Rule 3 - Blocking] Web fixtures gain `withdrawal: null`**
- Once `withdrawal` became required, two web fixtures failed typecheck and parse: `analyst-assessment-route.test.tsx`'s `satisfies AnalystRiskDetail` Risk and the AI provenance case in `assessment-service.test.ts`.
- **Commit:** `6aec8f25`

**7. [Plan detail] Withdrawn fixture in the Task 2 scenario**
- The released scenario writes the withdrawal facts through `setRiskWithdrawalFactsFixture` rather than calling the API. On a release-ready in-review assessment, an API withdrawal regresses it to draft (D-12), and the scenario needs a released assessment. The API path is covered by Task 1's mounted case, which withdraws, then releases.

**Total deviations:** none changes behaviour beyond the plan. One fail-closed refinement, one test corrected to the registered parser, one fixture update, and four plan-shape notes.

## Issues Encountered

- A Bash heredoc holding the Task 2 tests failed to parse (quotes inside the TypeScript). The block was written to a scratch file and appended instead. The result was unaffected.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register.
- T-16-16 is covered by the mounted reads for Jane and the Secondary Requestor: the identical 404 bodies, and no trace of the withdrawn Risk in the detail, the risk list or the lists.
- T-16-17 is covered by the unit index-alignment case and the mounted release with an incomplete withdrawn Risk.

## Next Phase Readiness

- 16-11 and 16-12 can render `withdrawal` from the analyst detail through `riskWithdrawalSchema`.
- 16-07 to 16-09's proposal contexts can apply `activeRisks` in the same way.
- Phases 17 to 19 read the rule through the same three forms.

## Self-Check: PASSED

- All 14 modified files exist; commits 3b82ef44, 6aec8f25, c834c6ce and a2cf4926 are in history.
