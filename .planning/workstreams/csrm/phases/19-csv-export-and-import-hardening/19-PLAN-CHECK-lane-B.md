# Phase 19 plan check, lane B (19-06 to 19-10)

## Fresh pre-execution check (2026-10-16)

Checked against HEAD `bdd0f698` (the code at Phase 16's close). Read-only: no plan or code edited, no test run.

### What still holds today

- All five plans pass `verify plan-structure` (valid, no errors or warnings) and `frontmatter validate --schema plan`. Every `<automated>` command passes `bash -n` (18 commands).
- No G-6 approval precondition appears in 19-06 to 19-10, so the executor-written "Approved by the pilot on" form does not occur here.
- Web anchors used by 19-06 exist: `validateFileResponse`, `parseContentDispositionFileName`, `FileResponseRule`, `FileSignature`, `attachmentFileRule` (`apps/csrm/src/lib/files/file-response.ts:13-187`; its header already names Phase 19 D-19); `saveFile` (`save-file.ts:23`); `readViewerTimeZone` (`lib/time/viewer-time-zone.ts:14`); `riskRegisterQuerySchema`, `parseRiskRegisterQuery` (`features/risks/risk-schema.ts:67,107`); `SegmentedControl` (`components/csrm/segmented-control.tsx`); the parity guard's `file-response` mode (`features/contract-response-parity.test.ts:48`); `downloadRequestAttachment` with `parseAs: 'arrayBuffer'` (`features/attachments/attachments-service.ts:221`); `interface-copy-guard.test.ts`, `contract-operation-chain.test.ts`; e2e helpers `signInAs`, `primaryViewport` (`e2e/helpers/navigation.ts:12,84`); the mobile `testMatch` (`playwright.config.ts:198`).
- The Withdrawn filter travels: the register's `state` parameter (`risk-schema.ts:84`) takes `open | closed | withdrawn` (`risk-domain.ts:68`), so parsing the export input with `riskRegisterQuerySchema` minus `page`/`pageSize` carries Show/Withdrawn with the other filters. The journey scopes with a search (`HYPERLINK`), which matches the >25-row harness rule.
- Route budget: `/app/risks` measures 264,769 delivered bytes against 300,000 (`apps/csrm/.tmp/performance/baseline-desktop.json`), so a small `ExportButton` plus a `next/dynamic` dialog fits. 19-06 to 19-10 add nothing to `/app/risks/{documentId}` or `/app/requests/{documentId}`.
- Backend anchors used by 19-07 to 19-10 exist: `parseAnalystReviewQuery` (`collection-scope.ts:345`), `projectAnalystReviewRequest` (`:476`), `REVIEW_QUEUE_BUCKETS` (`:70`), the assignee and notes filters (`:268`), `createReviewQueueRepository`, `MAX_REVIEW_QUEUE_HYDRATION = 100` (`review-queue-repository.ts:38,369`), My requests' service, route and `requireRequestCollectionScope`; `buildQuestionnaireCollectionQuery`, `projectQuestionnaireCollection` (`questionnaire-scope.ts:100,228`), `CSRM_QUESTIONNAIRE_OPERATIONS.listAll`/`listMine`; `CSRM_ANALYST_INSIGHT_OPERATIONS` with five entries (`csrm-analyst-insight/operations.ts`), `parseAlertListQuery` (`alert-query.ts:76`), the `insightPolicies` helper (`routes/reports.ts:11`), `parseReportRequest`, `ReportQueryError`, `ReportNotFoundError` (`report-query.ts`), `REPORT_DEFINITIONS` (`report-definitions.ts:20`), the per-report figure types (`report-repository.ts`); `releasedForOwner`, `releasedAssessmentDetailQuery`, `isReleasedAssessmentForOwner`, `releasedAssessmentQuery`, `projectReleasedAssessmentDetail`, `projectAnalystAssessmentDetail`, `buildAssessmentCollectionQuery`, `assertAnalystAssessmentScope` (assessment controller and scope).
- `requireAnalystInsightScope` adds the four underlying reads to any route that sets it (`csrm-authorization.ts:476-477`), so the alert and report exports get Phase 7's underlying reads without joining `ANALYST_INSIGHT_OPERATIONS`.
- 19-09's pinned tests are where it says: `PHASE7_REPORT_EXPORT_PUBLISHED` (`contract-catalogue.integration.test.ts:1794`), the seed expectation (`analyst-insight-catalogue-seed.integration.test.ts:155`), the deferred reason (`served-operations.integration.test.ts:112`), and `function.reports.reports.api.03` in the catalogue (line 2909).
- Grants follow today's model. The Requestor birthright is `role.requestor` (for example, `GET:/api/v1/my_requests` -> `function.risk_assessment_requests.my_requests` -> `[role.requestor]`). The released detail is granted to the Requestor through `function.risk_assessments.risk_assessment_details_read_only`, so 19-10's `underlyingRead: findOne` works for Jane.
- The new export paths are routed ahead of conflicting parameterised routes as planned: `/v1/questionnaires/:questionnaireId` (`routes/csrm-questionnaire.ts:190`), `/v1/risk_assessments/:assessmentId` (first at `routes/csrm-assessment.ts:39`), and `/v1/alerts/summary` (`routes/alerts.ts:20`).
- Every required script exists (`api:check`, `api:generate`, `typecheck`, `lint`, `test:e2e` in apps/csrm; `served-operations:write`, `test` in apps/backend), and so does every named backend test file.

### Blockers

1. **Host-specific verify preamble (all five plans, 23 occurrences).** These plans still carry `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm() { ... corepack/dist/pnpm.js "$@"; }`:
   - 19-06: lines 130, 175, 212, 236, 259 (5)
   - 19-07: lines 117, 160, 190, 212 (4)
   - 19-08: lines 121, 160, 185, 213, 235 (5)
   - 19-09: lines 118, 160, 190, 210 (4)
   - 19-10: lines 123, 164, 200, 228, 249 (5)

   Fix: replace the Hard-rules line and each `<automated>` prefix with Phase 15's host-neutral Node 24.19 check followed by `pnpm --version >/dev/null && ...` (`15-10-PLAN.md:187`).

2. **The human-only count and literal guards will fail the full Strapi suite (19-07, 19-08, 19-09, 19-10).** Today's guard asserts `HUMAN_ANALYST_ONLY_OPERATIONS.length === 31 + insightOperations.size` (`apps/backend/tests/authorization-matrix.integration.test.ts:264`). Each listed operation that is not an insight operation must also appear as a quoted literal in the policy source (`:266-267`, `HUMAN_ANALYST_GUARD_LITERAL_MISSING_*`). `insightOperations` is `Object.values(CSRM_ANALYST_INSIGHT_OPERATIONS)` (`:263`), and 19-08 deliberately keeps the alert and report exports out of it (19-08:102).

   The plans add five human-only operations to the fixture mirror (`tests/fixtures/authorization-matrix.ts:80`): 19-07 one, 19-08 two (19-08:232), 19-09 one (19-09:207) and 19-10 one (19-10:246). None of them edits the `31` literal or lists `authorization-matrix.integration.test.ts` in `files_modified`. None of them says the operations must be quoted literals in `csrm-authorization.ts`; 19-07:99 and 19-08:102 describe them as operation constants. Each plan's final full-suite verify (19-07:212, 19-08:235, 19-09:210, 19-10:249) therefore fails.

   Fix: in each plan, add `authorization-matrix.integration.test.ts` to the files list, raise the count by that plan's additions (31 to 32 to 34 to 35 to 36, plus whatever 19-05 adds; lane A should confirm 19-05's change), and add each export URL to `HUMAN_ANALYST_ONLY_OPERATIONS` as a quoted literal.

3. **The 19-06 register-page wiring does not match the page, and as written it shows Export to the Requestor.**
   - `PageHeader`'s prop is `action`, not "actions" (`apps/csrm/src/components/csrm/page-header.tsx:17`; the page imports it through the `@/components/shell/app-shell` re-export).
   - `RisksPage` renders `PageHeader` outside the `Suspense` boundary, before the register is fetched (`apps/csrm/app/(app)/app/risks/page.tsx:41`). `meta.pagination.total` only exists inside `RiskRegisterContent` (`:35`).
   - There is no page-level gate. The Requestor's "gate" is the API 403, rendered as `state='permission'` inside the content (`:37`).

   So "passes to `PageHeader`'s actions an `ExportButton` with ... `meta.pagination.total` ... renders nothing ... where the page renders its gate" (19-06:114) cannot be built as described. Putting the button in the static header shows it to Jane, which fails the must-have at 19-06:38 and the journey `register export refused to a Requestor @journey` (19-06:256).

   Fix: render the header action from the data-loaded content (for example, move `PageHeader` into `RiskRegisterContent`, or give it a header action inside its own Suspense) and only when `result.data` is present with no error. Name `action` and the 403 condition explicitly.

4. **19-06 Task 4's clean-tree filter rejects the verification ledger.** The filter at 19-06:259 accepts only the generated `.d.ts` files and `example-risk-assessment-questions/`. Today the line ` M .planning/workstreams/csrm/.verification-ledger.json` is in `git status --short`, so `test -z` fails. Fix: add the ledger line to the alternation, escaped as the other entries are. Hard-rules line 135 ("three operator items") should name it too.

5. **19-10 leaves out a released-read caller that its own verify requires it to migrate.** `myRatingSummary` (`GET /v1/my_risk_assessments/rating_summary`, `controllers/csrm-assessment.ts:343-348`) calls `releasedAssessmentQuery(ownerDocumentId)` and `isReleasedAssessmentForOwner`. It is not among the callers the plan switches (19-10:37, :107, :147-161). The plan says to delete the helpers "once nothing calls them" (19-10:107), but Task 2's verify fails while `isReleasedAssessmentForOwner` exists anywhere in `apps/backend/src` (19-10:200). D-14's "every released read" is incomplete without it. Fix: name `myRatingSummary` as a fourth caller of `readableAssessmentFilters` + `RELEASED_ASSESSMENT_FILTERS` / `isReadableReleasedAssessment`, and add a rating-summary regression to Task 1's behaviour.

### Warnings

1. **19-07 to 19-10 never name the active-risk rule or `active-risk-readers.unit.test.ts`.**
   - In 19-10, the list columns "Risks" and "Highest residual rating" come from `riskSummariesFor(connection, ids)` (`controllers/csrm-assessment.ts:110`, used at `:187`), not from `projectAssessmentSummary` alone. The My list projects with `projectRequestorAssessmentSummary` (`:190`).
   - A view in `src/csrm/exports/` that re-reads Risks without one of `RULE_NAMES` in the guard window fails the suite (`apps/backend/tests/active-risk-readers.unit.test.ts:25-35`). The released export must reuse the ruled read of `listAssessmentRisks` (`ACTIVE_RISK_FILTER`, `:362-367`) and the Requestor's `isActiveRisk` check on control implementations (`:390`).

   Fix: name `riskSummariesFor` and `projectRequestorAssessmentSummary`, state that every export Risk read reuses a ruled reader, and add `active-risk-readers.unit.test.js` to the full-suite expectations.

2. **19-06 Task 3 weakens the parity guard.** The guard requires the validator's media types to be exactly the 200's declared content (`contract-response-parity.test.ts:32-33,234`). The plan registers `text/csv; charset=utf-8` while assuming the spec says `text/csv`, and tells the executor to "ignore the charset parameter" (19-06:233). Fix: make `EXPORT_RESPONSE_CONTENT_TYPES` and 19-05's spec declaration identical, and keep `exportFileRule`'s tolerance for the charset parameter separate from the registered list.

3. **19-06's journey edits an unnamed shared seed Risk.** It changes a statement to a HYPERLINK formula on "a seeded draft assessment's Risk (the path `assessment-release-workflow.spec.ts` uses)" (19-06:115, :256). The Risk is not named, and other specs (`risk-register-workflow`, `assessment-release-workflow`, `risk-curation`) read seeded Risk statements. Fix: name the Risk number and show that no other spec asserts its statement, or note that the edit is restored to the original within the journey.

4. **19-09: a second pinned entry.** `contract-catalogue.integration.test.ts:1123` has a published-path row for `POST /v1/reports/{reportKey}/export` with functionId `function.reports.reports`, which must move to `function.reports.export_api`. 19-09:106 names only the `:1794` assertion. Fix: name `:1123` too.

5. **The human-only denial wording for exports is unowned.** `humanAnalystDenialMessage` falls through to "CSRM questionnaire governance requires a human Security Analyst." (`csrm-authorization.ts:157`). 19-07 to 19-10 add export operations to the human-only set without a branch, so an automation identity refused at the Requests, Questionnaires, Alerts, Report or Assessments export gets questionnaire wording. Fix: confirm that 19-05 adds an export branch (lane A), or have 19-07 add it.

### Info

1. All five plans end with a duplicated `</output>` line (19-06:301-302, 19-07:252-253, 19-08:275-276, 19-09:250-251, 19-10:291-292). Harmless.
2. `PHASE_19_BASE` in the acceptance criteria (for example, 19-06:179, 19-07:217) must be defined by an earlier plan (lane A).
3. `ASSESSMENT_NOT_RELEASED` does not exist in Strapi source today (0 hits). 19-10 relies on 19-02/19-04 for the reason and `ExportRefusalError` (lane A).
4. No hand-rolled Strapi doubles are introduced in 19-06 to 19-10. All new authorization proofs use the live `exports.integration.test.ts` and the matrix, so the identity-source double rule does not apply. The only `UNSERVED_REASONS` edit is 19-09 removing the report export's deferred reason, which is not an IAM/SCIM reservation.
