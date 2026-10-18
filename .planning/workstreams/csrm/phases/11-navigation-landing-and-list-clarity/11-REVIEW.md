---
phase: 11-navigation-landing-and-list-clarity
reviewed: 2026-10-04T10:02:55Z
depth: standard
diff_base: 9f95575
lanes: 4
files_reviewed: 231
files_reviewed_list:
  - CONTEXT.md
  - apps/backend/src/api/csrm-analyst-insight/services/alert-repository.ts
  - apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts
  - apps/backend/src/api/csrm-analyst-insight/services/report-definitions.ts
  - apps/backend/src/api/csrm-analyst-insight/services/report-repository.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/my-request-status-summary.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/operations.ts
  - apps/backend/src/api/csrm-assessment-request/routes/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
  - apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts
  - apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
  - apps/backend/src/api/csrm-risk/services/risk-register.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/bootstrap/seed-analyst-insights.ts
  - apps/backend/src/csrm/insights/insight-constants.ts
  - apps/backend/src/csrm/insights/treatment-due-state.ts
  - apps/backend/tests/analyst-dashboard.integration.test.ts
  - apps/backend/tests/analyst-insights-seed.integration.test.ts
  - apps/backend/tests/analyst-insights.unit.test.ts
  - apps/backend/tests/analyst-reports.integration.test.ts
  - apps/backend/tests/assessment-workflow.integration.test.ts
  - apps/backend/tests/authorization-matrix.integration.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/fixtures/authorization-matrix.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
  - apps/backend/tests/my-requests.integration.test.ts
  - apps/backend/tests/request-lifecycle.unit.test.ts
  - apps/backend/tests/request-status-summary.integration.test.ts
  - apps/backend/tests/request-workflow.integration.test.ts
  - apps/backend/tests/review-queue-buckets.integration.test.ts
  - apps/backend/tests/review-queue.unit.test.ts
  - apps/backend/tests/risk-register.integration.test.ts
  - apps/backend/tests/risk-register.unit.test.ts
  - apps/backend/tests/served-operations.integration.test.ts
  - apps/csrm/app/(app)/app/assessments/error.tsx
  - apps/csrm/app/(app)/app/assessments/loading.tsx
  - apps/csrm/app/(app)/app/assessments/page.tsx
  - apps/csrm/app/(app)/app/error.tsx
  - apps/csrm/app/(app)/app/loading.tsx
  - apps/csrm/app/(app)/app/page.tsx
  - apps/csrm/app/(app)/app/questionnaires/error.tsx
  - apps/csrm/app/(app)/app/questionnaires/loading.tsx
  - apps/csrm/app/(app)/app/questionnaires/page.tsx
  - apps/csrm/app/(app)/app/requests/error.tsx
  - apps/csrm/app/(app)/app/requests/loading.tsx
  - apps/csrm/app/(app)/app/requests/new/loading.tsx
  - apps/csrm/app/(app)/app/requests/new/page.tsx
  - apps/csrm/app/(app)/app/requests/page.tsx
  - apps/csrm/app/(app)/app/review/assessments/error.tsx
  - apps/csrm/app/(app)/app/review/assessments/page.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/error.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/loading.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/page.tsx
  - apps/csrm/app/(app)/app/review/requests/error.tsx
  - apps/csrm/app/(app)/app/review/requests/page.tsx
  - apps/csrm/app/(app)/app/risks/error.tsx
  - apps/csrm/app/(app)/app/risks/loading.tsx
  - apps/csrm/app/(app)/app/risks/page.tsx
  - apps/csrm/app/(app)/layout.tsx
  - apps/csrm/app/(app)/not-found.tsx
  - apps/csrm/app/globals.css
  - apps/csrm/app/not-found.tsx
  - apps/csrm/e2e/accessibility.spec.ts
  - apps/csrm/e2e/administration-workflow.spec.ts
  - apps/csrm/e2e/analyst-insights.spec.ts
  - apps/csrm/e2e/app-shell.spec.ts
  - apps/csrm/e2e/assessment-navigation-lifecycle.spec.ts
  - apps/csrm/e2e/assessment-release-workflow.spec.ts
  - apps/csrm/e2e/design-contract.spec.ts
  - apps/csrm/e2e/design-system-conformance.spec.ts
  - apps/csrm/e2e/helpers/navigation.ts
  - apps/csrm/e2e/helpers/requests.ts
  - apps/csrm/e2e/navigation-and-home.spec.ts
  - apps/csrm/e2e/performance.spec.ts
  - apps/csrm/e2e/production-hardening.spec.ts
  - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
  - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts
  - apps/csrm/e2e/questionnaire-workflow.spec.ts
  - apps/csrm/e2e/quick-find.spec.ts
  - apps/csrm/e2e/request-relationship-states.spec.ts
  - apps/csrm/e2e/requestor-request-workflow.spec.ts
  - apps/csrm/e2e/review-lists.spec.ts
  - apps/csrm/e2e/risk-register-workflow.spec.ts
  - apps/csrm/next.config.ts
  - apps/csrm/playwright.config.ts
  - apps/csrm/scripts/verify-shared-list-states.mjs
  - apps/csrm/src/components/csrm/bar-chart.test.tsx
  - apps/csrm/src/components/csrm/bar-chart.tsx
  - apps/csrm/src/components/csrm/data-table.test.tsx
  - apps/csrm/src/components/csrm/feedback-composites.test.tsx
  - apps/csrm/src/components/csrm/navigation-guard.test.tsx
  - apps/csrm/src/components/csrm/navigation-guard.tsx
  - apps/csrm/src/components/csrm/status-badge.test.tsx
  - apps/csrm/src/components/csrm/status-badge.tsx
  - apps/csrm/src/components/shell/app-shell-account.test.tsx
  - apps/csrm/src/components/shell/app-shell.tsx
  - apps/csrm/src/components/shell/capability-navigation.tsx
  - apps/csrm/src/components/shell/mobile-navigation.test.tsx
  - apps/csrm/src/components/shell/navigation-counts.test.ts
  - apps/csrm/src/components/shell/navigation-counts.ts
  - apps/csrm/src/components/shell/quick-find-trigger.test.tsx
  - apps/csrm/src/components/shell/quick-find-trigger.tsx
  - apps/csrm/src/components/states/states.test.tsx
  - apps/csrm/src/components/states/states.tsx
  - apps/csrm/src/config/navigation/navigation.test.ts
  - apps/csrm/src/config/navigation/navigation.ts
  - apps/csrm/src/config/navigation/page-boundaries.test.tsx
  - apps/csrm/src/config/navigation/page-headings.ts
  - apps/csrm/src/features/administration/administration-workflow.test.tsx
  - apps/csrm/src/features/alerts/alert-domain.test.ts
  - apps/csrm/src/features/alerts/alert-domain.ts
  - apps/csrm/src/features/alerts/alert-list.test.tsx
  - apps/csrm/src/features/alerts/alert-list.tsx
  - apps/csrm/src/features/alerts/alert-schema.test.ts
  - apps/csrm/src/features/alerts/alert-schema.ts
  - apps/csrm/src/features/alerts/alerts-page-header.tsx
  - apps/csrm/src/features/alerts/alerts-page.test.tsx
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-schema.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.tsx
  - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
  - apps/csrm/src/features/assessments/assessment-detail.tsx
  - apps/csrm/src/features/assessments/assessment-domain.ts
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/src/features/assessments/assessment-list.test.tsx
  - apps/csrm/src/features/assessments/assessment-list.tsx
  - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-service.test.ts
  - apps/csrm/src/features/assessments/assessment-service.ts
  - apps/csrm/src/features/assessments/assessment-status-filters.test.tsx
  - apps/csrm/src/features/assessments/released-assessment.test.tsx
  - apps/csrm/src/features/assessments/released-assessment.tsx
  - apps/csrm/src/features/contract-response-parity.test.ts
  - apps/csrm/src/features/home/analyst-home.tsx
  - apps/csrm/src/features/home/home-page-header.tsx
  - apps/csrm/src/features/home/home-page.test.tsx
  - apps/csrm/src/features/home/home-section.tsx
  - apps/csrm/src/features/home/own-requests-panel.test.tsx
  - apps/csrm/src/features/home/own-requests-panel.tsx
  - apps/csrm/src/features/home/requestor-home-presentation.ts
  - apps/csrm/src/features/home/requestor-home-service.ts
  - apps/csrm/src/features/home/requestor-home.test.tsx
  - apps/csrm/src/features/home/requestor-home.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-detail.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
  - apps/csrm/src/features/questionnaires/questionnaire-list.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-review-list.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
  - apps/csrm/src/features/questionnaires/questionnaire-service.ts
  - apps/csrm/src/features/questionnaires/questionnaire-submitted-answers.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
  - apps/csrm/src/features/quick-find/quick-find-actions.test.ts
  - apps/csrm/src/features/quick-find/quick-find-actions.ts
  - apps/csrm/src/features/quick-find/quick-find-dialog.test.tsx
  - apps/csrm/src/features/quick-find/quick-find-dialog.tsx
  - apps/csrm/src/features/quick-find/quick-find-domain.ts
  - apps/csrm/src/features/reports/assessment-throughput-report.tsx
  - apps/csrm/src/features/reports/control-effectiveness-report.tsx
  - apps/csrm/src/features/reports/figure-link-audit.test.ts
  - apps/csrm/src/features/reports/report-copy.json
  - apps/csrm/src/features/reports/report-detail.tsx
  - apps/csrm/src/features/reports/report-presentation.test.ts
  - apps/csrm/src/features/reports/report-presentation.ts
  - apps/csrm/src/features/reports/report-schema.test.ts
  - apps/csrm/src/features/reports/report-schema.ts
  - apps/csrm/src/features/reports/report-section.tsx
  - apps/csrm/src/features/reports/report-service.test.ts
  - apps/csrm/src/features/reports/report-table.test.tsx
  - apps/csrm/src/features/reports/report-table.tsx
  - apps/csrm/src/features/reports/report-views.test.tsx
  - apps/csrm/src/features/reports/reports-page-header.tsx
  - apps/csrm/src/features/reports/reports-pages.test.tsx
  - apps/csrm/src/features/reports/risk-exposure-report.tsx
  - apps/csrm/src/features/reports/treatment-performance-report.tsx
  - apps/csrm/src/features/requests/my-requests-copy.ts
  - apps/csrm/src/features/requests/request-domain.test.ts
  - apps/csrm/src/features/requests/request-domain.ts
  - apps/csrm/src/features/requests/request-hub.test.tsx
  - apps/csrm/src/features/requests/request-hub.tsx
  - apps/csrm/src/features/requests/request-lifecycle-stepper.test.tsx
  - apps/csrm/src/features/requests/request-lifecycle-stepper.tsx
  - apps/csrm/src/features/requests/request-routes.test.tsx
  - apps/csrm/src/features/requests/request-schema.ts
  - apps/csrm/src/features/requests/request-service.test.ts
  - apps/csrm/src/features/requests/request-service.ts
  - apps/csrm/src/features/requests/request-table.test.tsx
  - apps/csrm/src/features/requests/request-table.tsx
  - apps/csrm/src/features/risks/risk-actions.test.ts
  - apps/csrm/src/features/risks/risk-actions.ts
  - apps/csrm/src/features/risks/risk-details.test.tsx
  - apps/csrm/src/features/risks/risk-details.tsx
  - apps/csrm/src/features/risks/risk-domain.test.ts
  - apps/csrm/src/features/risks/risk-domain.ts
  - apps/csrm/src/features/risks/risk-register-filters.tsx
  - apps/csrm/src/features/risks/risk-register-page.test.tsx
  - apps/csrm/src/features/risks/risk-register.test.tsx
  - apps/csrm/src/features/risks/risk-register.tsx
  - apps/csrm/src/features/risks/risk-schema.test.ts
  - apps/csrm/src/features/risks/risk-schema.ts
  - apps/csrm/src/features/risks/risk-service.test.ts
  - apps/csrm/src/features/risks/risk-service.ts
  - apps/csrm/src/lib/capabilities/strapi-capabilities.test.ts
  - apps/csrm/src/lib/capabilities/strapi-capabilities.ts
  - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
  - apps/csrm/src/lib/performance/zod-client-boundary.test.ts
  - apps/csrm/src/lib/security/next-config-redirects.test.ts
  - apps/csrm/src/lib/security/root-fallbacks.test.tsx
  - apps/csrm/src/lib/security/server-only-boundary.test.ts
  - apps/csrm/src/lib/testing/e2e-sign-in-assertions.test.ts
  - apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
  - apps/csrm/src/lib/testing/e2e-ui-state.test.ts
  - apps/csrm/src/lib/testing/e2e-ui-state.ts
  - docs/design/csrm-design-direction.md
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
findings:
  critical: 2
  warning: 21
  info: 25
  total: 48
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-04T10:02:55Z
**Depth:** standard
**Files Reviewed:** 231
**Status:** issues_found

## Summary

Phase 11 is reviewed from `9f95575` (`PHASE_11_BASE`, the last commit before any Phase 11 code). The scope is every file the 137 Phase 11 plan commits touched (subjects `type(11-NN):`, including the five walk fixes of 11-21) that still exists: 231 files. It excludes the planning documents, the generated `schema.d.ts`, the files Phase 11 deleted (the analyst dashboard route group and the retired Requestor dashboard), and the operator commits in the same range (the `origin/post-demo` merges `0d16f0d` and `b4a6e85` with `326eb3a` and `383b44e`, PR #2 `c89587f`, and the workstream move `5a3c94b` and `90cbe89`).

Four `gsd-code-reviewer` lanes reviewed it in parallel at standard depth, read-only, each writing its own report; this file merges the four reports verbatim, one section per lane, with their headings moved down one level. Finding IDs keep their lane's hundreds: 1xx Strapi backend, its tests, the seed and the API contract (44 files); 2xx web routes, shell and navigation, Home, quick find and the request features (56 files); 3xx lists, register, alerts, reports, analyst dashboard, the web lib layer, scripts and the design documents (47 files); 4xx web unit tests and Playwright specs (84 files). Large contract and data files were reviewed by their Phase 11 diff only.

| Lane | Critical | Warning | Info | Total |
|---|---|---|---|---|
| 1 | 1 | 5 | 5 | 11 |
| 2 | 0 | 6 | 7 | 13 |
| 3 | 0 | 3 | 7 | 10 |
| 4 | 1 | 7 | 6 | 14 |
| All | 2 | 21 | 25 | 48 |

The dispositions are in `11-REVIEW-DISPOSITION.md`. The supplements below independently checked HEAD `260c97c`; aliases are deduplicated in the disposition. Supplemental severities are reviewer claims until adjudicated against the phase policy.

---
phase: 11-navigation-landing-and-list-clarity
reviewed: 2026-10-04
depth: deep
diff_base: 9f95575
review_head: 260c97c
status: issues_found
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
---

# Phase 11 backend review

Read-only review against binding baseline `9f95575`, through current HEAD `260c97c`. The backend changes initially staged are now committed in `260c97c`; no source, index or planning artifact was modified by this reviewer. Findings below cite the current files. The existing Phase 11 review was read as evidence, and these claims were independently checked against source.

## Narrative Findings (AI reviewer)

### BE-01: A valid long requestor name makes the entire Requests queue response unparseable

**Severity:** Critical. **Classification:** BLOCKER.

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts:358-362`, projection call at `389`.

**Trigger:** An IdamBox User has a nonblank `displayName` longer than 255 characters and owns a submitted request included in a queue page.

**Issue:** `requestorDisplayName` checks only that the string is nonblank, then returns its full value. `AssessmentRequestQueueItem.requestorName` has a published maximum of 255 (`docs/references/specification.json:25007`), and the closed client parser rejects longer strings (`apps/csrm/src/features/assessments/assessment-schema.ts:55`). The IdamBox User attribute has no `maxLength` (`apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json:31-34`). Strapi's installed entity-validator only adds a maximum when the attribute explicitly configures it (`node_modules/@strapi/core/dist/services/entity-validator/validators.js:15-16`), and the default SQLite database does not impose VARCHAR length. Therefore this is valid persisted input, not necessarily corrupt data. One name causes the entire queue page, and quick find's Requests group when it reads that page, to fail parsing.

**Evidence:** A read-only probe loaded the current TypeScript source with an in-memory transpilation hook and called `projectAnalystReviewRequest` with a 256-character name. Output: `requestorNameLength: 256`, versus contract maximum `255`. The current source continues to emit the value unchanged.

**Fix:** Normalize the display name into the published bounds before projection, for example return null for blank or overlong values, as `projectRequestTitle` already does. Add a boundary assertion for 255 and 256 characters to the queue projection test, and a mounted response/parser proof if the fixture permits a long user name. If names above 255 should be invalid globally, enforce that upstream too through the approved model/contract process.

**Existing review status:** The first half of `IN-105` remains unfixed and was materially understated as an Info suggestion; it has a concrete page failure.

### BE-02: The Risk Register cannot apply the published open-Risk requirement for the Accepted marker

**Severity:** Warning. **Classification:** BLOCKER (incorrect displayed business state).

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-risk/services/risk-register.ts:339-361`; affected client `/Users/vanbui/src/test/idambox/apps/csrm/src/features/risks/risk-domain.ts:118-129`.

**Trigger:** A released Risk with `treatmentAction: "Accept"` also has a recorded closure date. The default register and `state=closed` include it.

**Issue:** D-41 and `RiskRegisterItem.treatmentAction` (`docs/references/specification.json:25836`) define Accepted as released, open and Accept. The backend reads the closure date to derive `treatmentDueState` but excludes it from the item. The client consequently checks only `stage === 'released' && treatmentAction === 'Accept'` and renders Accepted on closed Risks. The `complete-or-closed` state cannot repair this: it merges an open Risk with a Complete treatment and a closed Risk. Exposure counts correctly exclude closed Risks (`dashboard-summary.ts:163-170,284` and `report-repository.ts:176-188,297`), so the marker contradicts the figures and contract.

**Evidence:** A read-only probe passed a completely released assessment and Risk with `closureDate: "2026-10-02"`, Accept and no treatment status to current `projectRiskRegisterItem`, then current `riskRegisterCardMarker`. The projected row had `treatmentDueState: "complete-or-closed"`, `stage: "released"`, `treatmentAction: "Accept"` and no closure fact. Marker output: `Released · Accepted`.

**Fix:** Decide acceptance on the server and publish `accepted: boolean` computed from release stage, Accept and absence of a closure date, updating the contract, generated client and closed parser in one change. Alternatively publish an exact openness field and apply the same predicate in the client. Test a released/open Accept, released/closed Accept, under-assessment Accept and released/open/Complete Accept.

**Existing review status:** `WR-102` remains unfixed. This is a cross-scope backend contract/client issue; coordinate with the web reviewer to avoid duplicating it.

### BE-03: The status summary's total and holder counts can describe different database states

**Severity:** Warning. **Classification:** WARNING (response consistency/robustness).

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-assessment-request/controllers/my-request-status-summary.ts:38-41`; `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts:97-108`.

**Trigger:** A caller creates a request after the status-group query completes but before the holder queries complete; on a pooled database, a workflow transition can also occur between holder queries.

**Issue:** The handler awaits the status group-by, then executes three separate holder counts through the plain connection, outside a read transaction/snapshot. The new response can therefore report `total: N` while `byHolder.requestor + byHolder.analyst + byHolder.none === N + 1`. A transition between the holder queries can count a request twice or omit it. `MyRequestStatusSummary` explicitly promises both sums equal total. The new Home and sidebar counts consume `byHolder`, so the invariant now matters to served behavior. This is a statement-order/source proof; no deterministic database interleaving probe was run.

**Fix:** Compute the seven status counts and three holder counts in one SQL statement using conditional aggregates with the same owner scope, or use a transaction with a repeatable read snapshot appropriate to the database. A default PostgreSQL READ COMMITTED transaction alone does not give multiple statements one snapshot. Add a controlled concurrent-create/transition assertion for the invariant.

**Existing review status:** `IN-104` remains unfixed; retain as a robustness Warning rather than a stylistic Info item.

## Previously reported findings and exclusions

- **CR-101 fixed:** Current `projectRiskRegisterItem:350-352` normalizes off-ladder ratings/status into null, and the `nonePage` integration helper now calls the served-shape assertion (`risk-register.integration.test.ts:698`). Do not report the former parser defect again.
- **Release-triple figure/list mismatch fixed in the formerly staged change:** `assessment-scope.ts:181-182` adds approval date and approver predicates when analyst `status=approved`; current tests cover partial approval exclusion. Partial records remain visible to an unfiltered analyst read as intended.
- **Severity sort fixed in the formerly staged change:** `risk-register.ts:533-542` ranks ratings in severity order and places unrecognized ratings last in both directions; mounted regression coverage exists.
- **WR-105 does not establish its seed-comment claim:** The actual seed comment promises no alert figure moves, not no treatment-report figure moves. The Moderate Accept fixture is undated, has no ineffective mitigation control and never alerts. Counting Accept as no-target-date follows the existing D-04/D-43 population; changing that population needs a domain decision and is not a proven Phase 11 defect.
- **WR-104 is a future coupling concern:** Four SQL placeholders currently match each of the three four-value vocabularies. No current binding failure is present; do not call a hypothetical future enum edit a present functional defect.
- **WR-101 seed preservation requires scope evidence:** The accepted record uses the preexisting date-anchored Phase 7 reconciliation pattern. Current Phase 11 D-45 asks for a seeded fixture, not an edit-preservation guarantee. No new authoritative requirement was located that would make the deliberate fixture reconciliation a confirmed Phase 11 bug.
- **WR-103 invalid action handling is deliberate:** The parser rejects off-enum persisted treatment action as a data defect, and normal writes enforce the enumeration. No supported ordinary write path producing that action was found. HTTP 400 for server-data defects is questionable but not independently established as a shipping failure here.
- No independently verified injection, owner-scope bypass or new authorization leak was found in the new endpoint. Its closed query, numeric policy-resolved owner predicate and owner-rebound hydration were traced; this does not claim absence of all security defects.

## Coverage and verification limits

Reviewed the changed backend implementation modules, their changed-test evidence and the immediate cross-module call chains: review queue/lifecycle predicates, new owner endpoint and summary, assessment filtering and bounded grouped Risk projections, Risk stage/due-state/none/mitigation predicates and ordering, dashboard/report/alert populations, catalogue/route policy chain and accepted seed. Source changes were compared against `9f95575`, and initial staged changes were reread at `260c97c` after the shared checkout changed. Large existing tests and catalogue/contract data were inspected through the changed hunks plus targeted definitions/cases. Pure-source probes were run without writing source; no mounted Strapi suite or full regression gate was rerun in this lane.
# Phase 11 shell, Home, navigation, and quick-find review

Reviewed baseline `9f95575` through current HEAD `260c97c`. The staged changes visible at initialization became part of HEAD during the handoff; the tree is now clean. No source, index, commits, or planning artifacts were changed by this reviewer.

Reviewed the changed shell/navigation configuration and components, navigation guard, quick-find action/domain/dialog/trigger, Home services/presentation/components, protected layout, Home/list/new-request route changes and their loading/error boundaries, relevant global CSS, redirect, and associated tests. Traced the service calls, session action, OIDC capability resolution, and local installed Next error-boundary implementation. Existing review claims below were independently verified against current source. No Phase 11 disposition artifact exists in the current tree.

Validation: the targeted Vitest run passed **84 tests in 5 files** (quick-find dialog and trigger, navigation counts, Home page, page boundaries). A separate in-memory React reproduction of the actual `useSingleFlightSearch` implementation demonstrates the identity-cache issue below. Passing existing tests does not cover these findings.

## Narrative findings

### SH-01 — WARNING: Quick find retains the previous identity's private results across a development role switch

**Severity:** Warning. **Classification:** WARNING. **New finding.** The demonstrated switch is the explicitly supported development identity switch; a production account-switch flow is not claimed.

**Files:**

- `/Users/vanbui/src/test/idambox/apps/csrm/src/components/shell/app-shell.tsx:47`
- `/Users/vanbui/src/test/idambox/apps/csrm/src/components/shell/quick-find-trigger.tsx:126-135,200-209`
- `/Users/vanbui/src/test/idambox/apps/csrm/src/features/quick-find/quick-find-dialog.tsx:115-160,243-250`
- Related caller: `/Users/vanbui/src/test/idambox/apps/csrm/app/actions/session.ts:7-11`

**Trigger and evidence:** Search Jane's own request while signed in as Requestor, close Search, switch to Secondary Requestor using the supported shell select, and reopen Search without changing the retained term. `setDevelopmentRole` changes the cookie and revalidates the layout; it performs no full-page navigation. The unkeyed trigger and dialog retain React state across that refresh. Both identities have `viewer='requestor'`; no identity is passed to quick find. The hook retains its prior outcome and its only search effect depends on `[search, term]`, so reopening performs no fresh scoped read. Previously rendered Jane titles, identifiers, status labels, and hrefs appear under Maya's current identity. Clicking the href may be refused by Strapi, but the display fields have already been disclosed by the cache.

The in-memory reproduction mounted the actual hook with a mocked scoped action, completed Jane's `RAR` search, closed it, changed the mock identity to Maya, and reopened the same term. Output:

```text
First identity: {"open":true,"outcome":{"term":"RAR","groups":[{"options":[{"primary":"Jane private request"}]}]}} calls 1
New identity: {"open":true,"outcome":{"term":"RAR","groups":[{"options":[{"primary":"Jane private request"}]}]}} calls 1
```

**Fix:** Key the complete quick-find state owner by a stable server-resolved viewer identity (the development role is sufficient for this supported flow; production should use its stable user identity). That remount must clear term, cached results, and outstanding response state. A viewer category alone cannot distinguish Requestor from Secondary Requestor. Add a role-switch regression that searches Jane, switches without a page reload, and proves none of Jane's display fields are visible after reopening as Maya.

### SH-02 — WARNING: Seven route recovery controls reuse the failed server payload

**Severity:** Warning. **Classification:** WARNING. Independently confirmed existing WR-202; remains unfixed. These handlers predate Phase 11 and are retained in files changed by this phase.

**Files:**

- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/assessments/error.tsx:7-11`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/questionnaires/error.tsx:7-14`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/requests/error.tsx:8-15`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/review/assessments/error.tsx:9-10`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/review/questionnaires/error.tsx:7-11`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/review/requests/error.tsx:9-10`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/risks/error.tsx:7-8`

**Trigger and evidence:** A transient failure causes a Server Component to throw into one of these boundaries. Every Try again control calls `reset`. The installed Next 16.3.6 implementation, `apps/csrm/node_modules/next/dist/client/components/error-boundary.js:39-47`, implements `reset` solely as `setState({error:null})`; `retry` additionally calls the router's `refresh()` in a transition. Reset therefore renders the same rejected RSC payload and repeats the error even after the underlying fault has cleared. Home already uses the correct `retry` contract.

**Fix:** Accept and wire Next's `retry` prop in all seven boundaries, matching the Home boundary. Test recovery from an actual initially rejected server render whose next render succeeds; mocked callback invocation alone does not prove refetching.

### SH-03 — WARNING: The shell-wide permission refusal sends the user back into itself

**Severity:** Warning. **Classification:** WARNING. Independently confirmed existing WR-203; remains unfixed.

**Files:**

- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/layout.tsx:25-32`
- `/Users/vanbui/src/test/idambox/apps/csrm/src/components/states/states.tsx:12,132-133`

**Trigger and evidence:** An authenticated user has no `assessment-request:read` capability. This also happens when OIDC access resolution fails: `strapiGrantedCapabilities` returns an empty set on any transport/contract error. The layout replaces every protected page, including `/app`, with default `PermissionDeniedState`. That state's sole recovery link is Go to Home → `/app`. Following it renders the same shell-wide refusal; its supporting claim that Home shows available work is false for this case. The individual Home refusals already use Return to sign in, but the earlier layout refusal prevents reaching those.

**Fix:** Give this layout refusal an explicit working recovery action (Return to sign in or authenticated sign-out, and/or retry access resolution) and supporting copy appropriate to unavailable access. Do not point its sole next step to a destination this layout always rejects.

### SH-04 — WARNING: Home advertises request creation without the creation capability

**Severity:** Warning. **Classification:** WARNING. Independently confirmed existing WR-205; remains unfixed. This is an action-availability defect; Strapi still enforces mutation authorization.

**Files:**

- `/Users/vanbui/src/test/idambox/apps/csrm/src/features/home/home-page-header.tsx:21-24`
- `/Users/vanbui/src/test/idambox/apps/csrm/src/features/home/requestor-home.tsx:101-103`
- `/Users/vanbui/src/test/idambox/apps/csrm/src/features/home/requestor-home-presentation.ts:74-77,258-260`
- Related page: `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/requests/new/page.tsx:11-21`

**Trigger and evidence:** A capability set contains `assessment-request:read` but lacks `assessment-request:create`. These capabilities are independently anchored to GET `/api/v1/my_requests` and POST `/api/csrm-assessment-requests`; the frontend supports such a set and the sidebar correctly removes New request. Home nonetheless renders the prominent New request header action, the Requestor first-use action, and the analyst own-requests footer action without consulting create. The new-request page checks only its selector reads; if those are allowed, it renders a create form whose submission is inevitably refused. This creates inconsistent navigation and lets the user spend time completing an unavailable workflow.

**Fix:** Pass the resolved creation permission to Home header, empty-state, and own-requests panel, omitting these actions when false. Gate the new-request page on `assessment-request:create` before selector reads/form rendering. Cover a read-only capability set in tests.

### SH-05 — WARNING: A changed search term leaves obsolete results looking current during debounce

**Severity:** Warning. **Classification:** WARNING. Independently confirmed existing WR-206; remains unfixed.

**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/quick-find/quick-find-dialog.tsx:154-160,243-250,350-353`

**Trigger and evidence:** Complete a broad search such as RA, replace it with a specific request number, then press Enter within 250ms. `outcome` remains the broad search's result; `busy` only becomes true when the debounce timer dispatches the new action. Consequently both pending opacity and `aria-busy` remain absent during the entire debounce window, while cmdk's selected old option is openable. The user opens an unrelated RA result although the dialog displays the newly typed number. UI-SPEC §4.4 permits retaining openable previous results when they are marked pending; this implementation marks them only after dispatch, leaving the preceding window misleading.

**Fix:** Immediately treat a searchable term that differs from `outcome.term` as pending, including both styling and busy semantics. If product policy requires Enter to open only current matches, disable activation until the latest outcome arrives. Add a regression that replaces a completed term and activates within the debounce window.

### SH-06 — WARNING: Cold-open typing can exceed the only searchable input bound

**Severity:** Warning. **Classification:** WARNING. Independently confirmed existing IN-203; remains unfixed. Classified as robustness because it leads to an unusable retained input value.

**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/components/shell/quick-find-trigger.tsx:48-54`

**Trigger and evidence:** Open Search while its lazy chunk is delayed, and type more than 100 characters using the loading frame's key handler. `keep` appends every character without a limit. When the dialog loads, React sets the controlled input to the entire stored value; native `maxLength=100` does not truncate a programmatically assigned value. `isSearchableTerm` rejects lengths above 100, so the dialog displays the misleading Type 2 or more characters hint and sends no search despite already holding a long term. The same handler prevents Backspace's native behavior and updates this retained state itself, so the user must manually delete the excess or clear it.

**Fix:** Apply the same `QUICK_FIND_MAX_TERM_LENGTH` to the loading-frame state updates (or use a bounded real input for typed-ahead text). Add a delayed-loader test typing 101 characters and assert the loaded input never exceeds 100 and can run its search.

## Additional independently verified existing issue

### SH-07 — WARNING: The three review list routes perform analyst reads before their route capability check

**Severity:** Warning. **Classification:** WARNING. Independently confirmed existing WR-204; remains unfixed and inherited from before this phase. Backend policies still refuse unauthorized access; no data leak from these reads is claimed.

**Files:**

- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/review/requests/page.tsx:10-14`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/review/questionnaires/page.tsx:11-17`
- `/Users/vanbui/src/test/idambox/apps/csrm/app/(app)/app/review/assessments/page.tsx:10-15`

**Trigger and evidence:** A Requestor opens a bookmarked/shared review-list URL. The base shell gate allows `assessment-request:read`, then these routes immediately invoke the analyst queue, questionnaire-review, or assessment-review service. They never check `assessment:review` before the read; only the resulting backend 403 becomes a permission state. This bypasses the project's frontend route-gate convention used by analyst detail routes, Home, Alerts, Reports, and Risk register and guarantees an unnecessary forbidden backend read whenever the URL is opened by a Requestor. It also allows analyst-specific query/presentation work before refusal.

**Fix:** Resolve the session's granted capabilities and return the appropriate permission state before invoking each analyst service, matching the existing guarded analyst routes. Retain all Strapi authorization checks. Add assertions that the service is not called for a Requestor opening each list directly.

## Limits and exclusions

No production authorization bypass was established in this lane. Source trace confirms that the quick-find action validates input and calls existing Strapi-scoped services; the risk group requires `risk:manage`, and forbidden groups are omitted. Navigation visibility is presentation only. The recorded owner-isolation problem is retained client state during the supported development identity switch, not a server-scope failure. Performance observations were excluded from defect findings except where the parent specifically requested budget verification; this lane did not rerun a production build or browser budget suite.
# Phase 11 features/API and E2E review

Reviewed current committed tree `260c97c` against `9f95575`; earlier staged fixes are now committed. Read-only review: no source, index, or planning artifact changed. Browser reproduction used an in-memory bundle of the actual current React component and the existing compiled app CSS, without a server or source edits. Full suites were not run in this lane.

## Critical

### FT-01 — BLOCKER: Desktop Risk Register filter popover exceeds the viewport and cannot scroll

**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/risks/risk-register-filters.tsx:263` (new fields at 153–180; shared primitive `/Users/vanbui/src/test/idambox/apps/csrm/src/components/ui/popover.tsx:36`).

**Trigger:** At a normal 1440×900 desktop viewport, open More filters. Phase 11 adds Stage, Treatment action, Due state and Mitigation-control effectiveness to the existing relation/status/date controls, but the desktop `PopoverContent` has only `w-80`; neither this surface nor the shared primitive limits its height or enables scrolling. Its fixed-position Radix popup cannot fit its contents in the viewport. Mobile uses an explicitly scrollable sheet, which does not repair desktop.

**Evidence:** Chromium rendering of the actual current component with app CSS measured popup height **1148px**, `clientHeight = scrollHeight = 1146px`, `overflowY = visible`. In the minimal reproduction, the trigger was positioned beneath 150px of page padding: popup top 263px, bottom 1411px; Stage was at y904–940, Treatment action at 978–1014, Due state at 1052–1088, effectiveness at 1126–1162, target dates at 1220–1342, and Clear target dates at 1350–1394. Even positioning the popup at y0 cannot fit 1148px in a 900px screen. No scroll container exists around those controls.

**Fix:** Constrain this popup to Radix's computed available viewport height (with a semantic viewport margin) and add `overflow-y-auto`, or use the same scrollable dialog/sheet at desktop widths. Add a browser check at desktop and short desktop heights that tabs/scrolls to the final target-date control and asserts that its box is inside the viewport and can be activated.

**Existing review:** New finding; not in the previous 11-REVIEW.md.

## Warnings

### FT-02 — WARNING: Released-date chips and displayed row dates silently use different zones

**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/assessments/assessment-list.tsx:297` (local row date at 287; personal list equivalents in `released-assessment.tsx:101`).

**Trigger/evidence:** Throughput links filter by UTC calendar days (`assessment-scope.ts` `approvalDatePredicates`), while the Released column uses `LocalInstant` in the viewer's zone. A Sydney viewer following September's report figure can see `Released to: 30 Sept 2026` and a row released `2026-09-30T22:00:00Z` displayed as `1 Oct 2026`. The chips and report month text never identify UTC. This looks like a filter failure even though the underlying predicates match the report.

**Fix:** Label the range and report buckets explicitly as UTC, and explain that row dates use the viewer's zone; alternatively keep range-view dates in UTC consistently. Avoid changing report predicates to local time without changing the report aggregation contract.

**Existing review:** Confirms WR-301; still present. No missing-approver mismatch remains: current `assessment-scope.ts` now narrows `status=approved` to the full release triple, resolving IN-306.

### FT-03 — WARNING: Browser time-zone test accepts UTC rendering for most of each day

**File:** `/Users/vanbui/src/test/idambox/apps/csrm/e2e/review-lists.spec.ts:139`.

**Trigger/evidence:** The test creates its submission at the wall-clock current instant, formats only its date in Brisbane (UTC+10), and compares that text to the UI. For submissions before 14:00 UTC, the Brisbane and UTC dates are equal. A regression removing browser-zone synchronization can therefore pass this asserted D-55 browser proof for 14 hours daily. `formatInstant` deliberately does not append UTC to date-only text, so no other label distinguishes these two outputs.

**Fix:** Use a controlled submission instant whose Brisbane date differs from UTC (e.g. 20:30Z), and assert that the expected local label differs from the UTC label before comparing the UI. Alternatively additionally assert the actual synchronized time-zone cookie and a rendered timestamp with time of day.

**Existing review:** Confirms CR-401's mechanism, but classify as WARNING: this is a test coverage defect, not a proven production vulnerability/crash.

### FT-04 — WARNING: Home workflow test flakes across UTC midnight

**File:** `/Users/vanbui/src/test/idambox/apps/csrm/e2e/navigation-and-home.spec.ts:240`.

**Trigger/evidence:** The test submits a request, navigates Home, and requires `Submitted today`. The server computes `daysSinceSubmission` from UTC calendar days; a submission just before 00:00 UTC and Home read just after it legitimately yields `Submitted 1 day ago`. The review-list test already accepts both zero and one days for the equivalent freshly-created record.

**Fix:** Accept the legitimate day-boundary result (`/ · Submitted (today|1 day ago)$/`) while keeping exact age behavior in deterministic unit tests.

**Existing review:** Confirms WR-402; still present.

### FT-05 — WARNING: New filter E2E checks pass when the server ignores their filters

**File:** `/Users/vanbui/src/test/idambox/apps/csrm/e2e/risk-register-workflow.spec.ts:875` and `/Users/vanbui/src/test/idambox/apps/csrm/e2e/analyst-insights.spec.ts:895`.

**Trigger/evidence:** The mitigation-any/no-system check only requires `narrowedTotal <= registerTotal`, which also holds when both totals are equal because both filters were ignored. The Existing-control row-header journey checks URL/chip and the presence of a result count; those come from the client query and do not prove the returned records have Existing controls. These tests consequently cannot detect the filter regression they claim to cover.

**Fix:** Use positively identified seeded records: under no-system require a matching record and exclude a known impacted-system record; under Existing require a matching Risk and exclude the seeded Planned-control Risk. Use strict narrowing only after confirming that the fixture guarantees a proper subset.

**Existing review:** Confirms WR-405; still present.

## Disposition notes

- The earlier staged selected-assessment label-width fix is present: `risk-schema.ts` allows the valid joined 513-character assessment label.
- Current released assessment filtering includes the complete release triple; do not repeat previous IN-306.
- Inverted approval-date ranges are intentionally dropped in the current parser and its comment. Previous WR-303 describes that behavior accurately, but a source finding needs a policy decision about forgiving URLs; it is not an independent implementation contradiction.
- The accepted-marker wording is explicitly required by Phase 11 D-41. Previous WR-302 is a glossary/product decision conflict to resolve, not evidence that the implemented Phase 11 predicate is wrong.
- The previous report references `11-REVIEW-DISPOSITION.md`, but that file does not exist in the current tree.


---


## Phase 11: Code Review Report, Lane 1 (Strapi backend, tests, seed, contract)

**Reviewed:** 2026-10-04
**Depth:** standard (with cross-file call tracing on every new read path)
**Files Reviewed:** 44
**Status:** issues_found

### Summary

I reviewed each file's Phase 11 change (`git diff 9f95575..HEAD`). I also read the callees and callers each claim depends on: `csrm-authorization.ts` (`requireRequestCollectionScope`, `setCollectionScope`), `relationship-scope.ts`, `assessment-workflow.ts` (`isReleased`, the release transaction and `revertRequestToDraft`), `utc-date.ts`, `report-math.ts`, the content-type schemas, and the web parsers `request-schema.ts`, `risk-schema.ts` and `risk-domain.ts` that consume these shapes. I read the large contract and data files through their Phase 11 diff and through targeted extraction of the changed operations and schemas.

**Checked and found correct:**

- **`GET /api/v1/my_requests` owner scope.**
  - The route sets `requireRequestCollectionScope`, so the policy writes `assessmentRequestCollectionScope: "own"` with the resolved numeric user id. `ownRequestorId` refuses anything else with 403.
  - The SQL joins `csrm_assessment_requests_requestor_lnk` on that id alone. Hydration re-binds `requestor.id = requestorId`.
  - No query value reaches the owner check, and the query keys are closed: a repeated parameter or an operator object gets a 400.
  - The analyst view is forced to `REQUESTOR_VIEW`, so an analyst's own item never carries an analyst href or an unreleased questionnaire or assessment identity.
  - The matrix row (`everyIdentity(200)` plus `mustNotDisclose` plus `ownedRecordTotal`) and the integration test prove the scope for all six actors.
- **The SQL holder equals `holderFor` (11-10).** I traced every lifecycle step against `applyRequestHolder`:
  - a draft is `requestor` in both. `revertRequestToDraft` refuses a revert once a questionnaire or assessment exists, so a draft with work attached is unreachable;
  - `approved`/`closed` are `none` in both. The release transaction sets the request to `approved` atomically (`assessment-workflow.ts:548`), so "assessment released but request still reviewable" is unreachable;
  - the "some answer submitted" versus "all submitted" divergence is the documented D-30 one.
- **Holder counts.** `countOwnedRequestsByHolder` reuses `applyRequestHolder` and `ownedRequests`. The three buckets partition the seven statuses, so they sum to `total`, apart from a race (IN-104).
- **Review queue.**
  - `queue=all` is exactly `REVIEWABLE ∪ RELEASED`. A `requestStatus=draft` is outside the queue and returns an empty page.
  - `filters[q]` binds one `literalContains` pattern twice with `ESCAPE '!'`, and escapes `!`, `%` and `_`.
  - Hydration reads the requestor's `displayName` only. `sanitizeOutput` runs on the projected item, and the computed keys survive, which the mounted tests assert.
- **Assessment lists.**
  - `overallRating` is a closed enum.
  - `approvedFrom`/`approvedTo` are validated calendar dates, with an inclusive UTC-day range of `[from 00:00Z, to+1 00:00Z)`. An inverted range gets a 400.
  - On the owner list every new predicate sits in the same `$and` as `releasedAssessmentQuery`, so no filter widens it.
  - `riskSummariesFor` binds only positive integer ids taken from the already-scoped page, and its SQL is constant.
- **Risk Register filters.**
  - `stage` only ANDs a branch onto `applyDisclosableParent`, which is now the literal union of the same two branch bodies.
  - `treatmentAction` binds a closed enum value.
  - `any`, `impactedSystem=none` and `mitigationEffectiveness` are EXISTS or NOT EXISTS clauses ANDed onto the scope.
  - Every column is a constant, and every value is bound.
  - Count and page share `applyFilters(filters, today)`.
- **`dueState` SQL mirror (11-15).** The `OPEN`/`CLOSED` conditions match `isTreatmentOpen`, NULL status included. At the boundaries, `overdue` is `< today`, `due-soon` is `[today, today+14]` inclusive and `later` is `> today+14`. These are the same string comparisons as `deriveTreatmentDueState`, and they partition the open set. The integration test covers both window edges in both stages and guards against UTC rollover.
- **14-day window (11-17).** `TREATMENT_REPORT_DUE_WINDOW_DAYS` now aliases `ALERT_DUE_SOON_WINDOW_DAYS`. The alerts, the report and the register all call `applyTreatmentDueStatePredicate` with 14, and the report's four states sum to its total.
- **Released / under-assessment partition (11-14, 11-16).** The dashboard and the risk-exposure report read `applyReleasedParent` and `applyUnderAssessmentParent`, never added together. `releasedAccepted` reads the released branch only, so a draft's Accept never counts. `ratingCounts` is exact-case, the same as the register's `none` `NOT IN`. The report's `risksWithoutSystem` (inner join) equals the register's `impactedSystem=none` (left join with `IS NOT NULL`).
- **`daysSinceSubmission`.** It is the UTC calendar date of the instant, then `daysBetween`, clamped at 0, with null when the date is missing. The clock is read once per request.
- **Insight, report and alert repositories.** The scope is unchanged (`requireAnalystInsightScope`), and no count query drops the register scope.
- **Contract parity and catalogue.**
  - Both catalogue copies are byte-identical (`cmp`).
  - Only design note 9 changed, and no grant, Function or FunctionApi was added.
  - `served-operations.json` moves `GET:/api/v1/my_requests` to `served` with `role.requestor`.
  - The spec parameters and enums match the parsers: page ≤ 1,000,000, pageSize 10/20/50, q 1–200, the sort enum, and the holder enum.

### Critical Issues

#### CR-101: Risk Register "none" lists serve values outside the published closed schema, so the linked figure's list fails to parse

**File:** `apps/backend/src/api/csrm-risk/services/risk-register.ts:343-350` (projection), `:451`, `:459` (the "none" filters); test masking at `apps/backend/tests/risk-register.integration.test.ts:658-666`

**Issue:** 11-15 added `treatmentStatus=none`, `inherentRating=none` and `residualRating=none` for one purpose: to list the Risks whose stored value is null **or outside the vocabulary**. These are the reports' `notProvided`/`notRated` figures, which the dashboard and reports link to (D-35).

`projectRiskRegisterItem`, however, passes the stored strings through unchanged:
- `stringOrNull(document.treatmentStatus)`;
- `stringOrNull(document.inherentRating)` and `stringOrNull(document.residualRating)`.

So a row selected *because* its value is off-vocabulary is served with that value, for example `treatmentStatus: "Deferred"` or `residualRating: "Extreme"`. That breaks the published `RiskRegisterItem` schema: `treatmentStatus` enum `["Not Started","In Progress","Overdue","Complete",null]`, and the ratings `AssessmentRating | null`.

The web's closed parser (`apps/csrm/src/features/risks/risk-schema.ts:158-172`: `ratingSchema.nullable()`, `z.enum(riskRegisterTreatmentStatuses).nullable()`, `.strict()`) rejects the whole page.

The new test builds exactly these rows (`writeStoredValueFixture(... "treatment_status", "Deferred")`, and `residualRating: "Extreme"` / `inherentRating: "Extreme"` through the Document Service, because both columns are free `string` attributes). Unlike `duePage` (`:567`) and `figurePage` (`:726`), however, its `nonePage` helper does **not** call `assertServedRegisterShape`. The very test that proves the filter therefore skips the contract check that would fail on it.

**Failure scenario:** The analyst opens the Risk exposure report. "Not rated: 1" counts a released open Risk with a legacy residual rating of "Medium", which predates the current write validation or comes from a migration. The figure links to `/api/v1/risks?residualRating=none&state=open&stage=released`. Strapi returns 200 with `residualRating: "Medium"`, the web parse throws, and the list shows its error state. The figure's records can never be opened, which defeats D-35, and any default register page that holds such a row fails the same way.

The current API write paths validate ratings (`assessment-workflow.ts:569`), so the trigger is legacy or directly written data. That is precisely the data this filter was added to serve.

**Fix:** Normalise on projection, so the served value is always inside the contract, and make the test pin the shape.

```ts
const treatmentStatus = RISK_REGISTER_TREATMENT_STATUSES.find((s) => s === document.treatmentStatus) ?? null;
const rating = (value: unknown) => RISK_REGISTER_RATINGS.find((r) => r === value) ?? null;
// ...
inherentRating: rating(document.inherentRating),
residualRating: rating(document.residualRating),
treatmentStatus,
```

Keep `deriveTreatmentDueState` on the raw status, or on the normalised one, because both read "not Complete" the same way. Then add `assertServedRegisterShape(body, ...)` to `nonePage`, and extend `assertServedRegisterShape` to check the enum values, not only the key sets.

### Warnings

#### WR-101: The D-45 accepted Risk is force-reconciled on every boot, so an operator's edit to it is silently reverted

**File:** `apps/backend/src/bootstrap/seed-analyst-insights.ts:116-125` (`reconcile`), `:296-307`

**Issue:** `reconcile` updates the record whenever its stable key exists. The accepted Risk `RSK-E2E-P7-ACCEPTED-001` therefore has these fields rewritten on every Strapi start with `IDAMBOX_SEED_CSRM=true`:
- `riskStatement`, `treatmentAction: "Accept"` and `treatmentStatus: null`;
- `targetDate: null`, ratings and `closureDate: null`.

The seed is idempotent in record count, which the test proves by running it twice. It is not edit-preserving, which the review brief requires ("must never overwrite an operator's edit"). The sibling seed `seed-risk-register-workflow.ts:73-77` shows the create-if-absent pattern the project already uses for that guarantee. No test covers "an operator edit survives a reseed".

**Failure scenario:** During a UAT walk the operator changes the accepted Risk to Treat, adds a target date, or closes it to test the Accepted marker's disappearance. They then restart Strapi. The Risk is Accept, open and undated again, and the walk's evidence no longer matches the database.

**Fix:** Create the accepted Risk only when it is absent, and leave an existing one untouched. If the date-anchored Phase 7 siblings must keep reconciling, write that exception down explicitly. Add a seed test that edits `treatmentAction` and `closureDate`, reseeds, and asserts both edits survive.

#### WR-102: The `RiskRegisterItem` contract defines "Accepted" as released **and open**, but the row carries no openness, so the client marks closed Risks "Accepted"

**File:** `docs/references/specification.json:25835` (`RiskRegisterItem.treatmentAction` description); `apps/backend/src/api/csrm-risk/services/risk-register.ts:336-360` (the closure date is read but deliberately not disclosed)

**Issue:** The published description says "Accepted is a released, open Risk whose treatment action is Accept", and the server's exposure figures apply that rule. The row exposes `stage` and `treatmentAction`, but no closure fact.

`treatmentDueState: "complete-or-closed"` cannot stand in for it, because it merges "Complete with no closure date" (open) with "closed". As a result the web's `isAcceptedRiskRow` (`risk-domain.ts:123-125`) checks only `stage === 'released' && treatmentAction === 'Accept'`, and its own comment admits the gap.

**Failure scenario:** A released Accept Risk is closed (closure date set). The register row still reads "Released · Accepted". The analyst Home's accepted count, which requires open, excludes it, so the marker and the figure disagree.

**Fix:** Have the server decide it, and serve an `accepted: boolean` computed as `stage === "released" && treatmentAction === "Accept" && closureDate == null`. That is a contract addition through the full D-02 chain. Alternatively, reword the description to drop "open" and say so on the marker. Either way the contract must not describe a rule its consumers cannot apply.

#### WR-103: An off-vocabulary stored `treatment_action` turns every register page that contains it into a 400

**File:** `apps/backend/src/api/csrm-risk/services/risk-register.ts:320-325` (also `projectStage` `:328-332`)

**Issue:** `projectTreatmentAction` throws `RiskRegisterError(400, "CSRM Risk Register data is invalid.")` for any stored value other than Accept or Treat. Before Phase 11 the register never read this column, so legacy or directly written values were harmless.

Now one such row fails the entire page, and every figure link whose list contains it, with a **client-error** status for a **server-data** defect. This is also inconsistent with 11-15's own stance on legacy values: `treatment_status` and `effectiveness_rating` off-vocabulary values are listed under "none", not refused.

`projectStage` has the same failure mode, a 400, if the parent's facts change between `selectPage` and `hydrate`. The release is transactional, so that path is a race only, but it is still a 400 for a server condition.

**Failure scenario:** A data migration leaves `treatment_action = 'accept'` (lowercase) on one Risk. The register's default page, which sorts by target date, includes it, so every analyst gets "CSRM Risk Register data is invalid." and the register is unusable until the database is fixed.

**Fix:** Project an unknown action as `null`, so the contract and the client stay intact, and log the defect server-side. Return 5xx, or drop and log the row, for genuine server inconsistencies rather than 400.

#### WR-104: The "none" SQL hard-codes four placeholders that must track three independently maintained vocabularies

**File:** `apps/backend/src/api/csrm-risk/services/risk-register.ts:422`, `:451`, `:459`, `:511`

**Issue:** `FOUR_VALUES = "(?, ?, ?, ?)"` is paired with `RISK_REGISTER_TREATMENT_STATUSES`, `RISK_REGISTER_RATINGS` and `RISK_REGISTER_EFFECTIVENESS_RATINGS`, which are each exported and maintained separately in `risk-register-query.ts`. Nothing ties the placeholder count to the array length.

**Failure scenario:** A later phase adds a fifth treatment status. Phase 17.1's acceptance work is a plausible candidate, and the JDL enum would grow with it. Then `whereRaw` receives five bindings for four placeholders. Knex throws "Expected 4 bindings", so `treatmentStatus=none`, and every report link to `notProvided`, returns 500. Worse, if the array shrinks, the stale placeholder count silently mis-binds.

**Fix:** Derive the placeholders from the list.

```ts
const placeholders = (values: readonly string[]) => `(${values.map(() => "?").join(", ")})`;
query.whereRaw(`(r.treatment_status IS NULL OR r.treatment_status NOT IN ${placeholders(RISK_REGISTER_TREATMENT_STATUSES)})`, [...RISK_REGISTER_TREATMENT_STATUSES]);
```

Or use knex's `whereNotIn` inside a grouped `orWhereNull`.

#### WR-105: The D-45 fixture is documented as inert, but it moves the treatment figures, and Accept Risks count as open treatments with no target date

**File:** `apps/backend/src/bootstrap/seed-analyst-insights.ts:18-21`, `:296-307`; `apps/backend/src/csrm/insights/treatment-due-state.ts:39-41`

**Issue:** The header says the accepted Risk "raises no alert and moves no alert figure". The alert part holds. However, `isTreatmentOpen` treats `treatmentStatus: null` with no closure date as an **open treatment**, so the Accept Risk is counted in:
- the treatment-performance report's `noTargetDate` and its total (D-43 keeps both stages);
- the register's `dueState=no-target-date`;
- the Home's "Treatments due" population wording.

The due-state rule has no notion of treatment action. Every released Accept Risk, the very population D-41 says has no treatment, is therefore reported as an untreated treatment that lacks a target date.

**Failure scenario:** After a restart, the Treatment performance report in the development database shows "No target date: N+1". A browser or E2E assertion that pinned the Phase 7 fixture's treatment figures by value drifts, and the report tells the analyst an accepted risk needs a treatment date.

**Fix:** At minimum, correct the seed comment and confirm that every spec pinning treatment figures was updated. On substance, record a decision (D-43 or Phase 17.1) on whether `treatmentAction = 'Accept'` leaves the treatment population. If it does, add `r.treatment_action IS DISTINCT FROM 'Accept'` (portable form: `(r.treatment_action IS NULL OR r.treatment_action <> ?)`) to the open-treatment condition in both `isTreatmentOpen` and `OPEN_TREATMENT` together.

### Info

#### IN-101: Two different exports named `listMyRequests` in the same API folder

**File:** `apps/backend/src/api/csrm-assessment-request/operations.ts:7`, `apps/backend/src/api/csrm-assessment-request/services/my-requests.ts:277`

**Issue:** The route imports the operation-id string `listMyRequests` from `../operations`, and the controller imports the service function `listMyRequests` from `../services/my-requests`. A future edit that imports the wrong one type-checks in some positions: a string passed where a policy operation is expected is fine, but an editor's auto-import can pick either.

**Fix:** Rename the constant `listMyRequestsOperation` (or `MY_REQUESTS_OPERATION`), matching how `myRequestStatusSummary` is used.

#### IN-102: The spec defines `holder: "none"` two different ways

**File:** `docs/references/specification.json` (`/v1/my_requests` description and `holder` parameter versus `MyRequestItem.holder`)

**Issue:** The operation says nobody holds a request "once the request is approved or closed", which is the SQL rule. `MyRequestItem.holder` says "once the assessment is released or the request is closed", which is the lifecycle rule. The two agree only because the release transaction sets `approved` atomically. An approved request without a complete release triple, for example from a seed or a migration, would get `none` from the filter and `analyst` (step 5 or 6) from `holderFor`, so a row filtered by `holder=none` could show `holder: "analyst"`.

**Fix:** Use one wording, and either have the holder SQL read `assessmentReleased` like the lifecycle, or add a guard test that no approved request lacks the release triple.

#### IN-103: Contradictory register filters are accepted silently in one case and refused in another

**File:** `apps/backend/src/api/csrm-risk/services/risk-register-query.ts:197`; `apps/backend/src/api/csrm-risk/services/risk-register.ts:507-515`

**Issue:** `impactedSystem=none` together with `system=<id>` is refused with 400 (Pitfall 21), but `mitigationStatus=none` together with any `mitigationEffectiveness` value is accepted and always returns an empty page. The two inconsistencies are harmless but surprising to a client building figure links.

**Fix:** Refuse `mitigationStatus=none` combined with `mitigationEffectiveness`, as the system pair is refused, and publish the rule in the spec.

#### IN-104: The status summary's invariant "byHolder sums to total" is not snapshot-consistent

**File:** `apps/backend/src/api/csrm-assessment-request/controllers/my-request-status-summary.ts:38-40`; `services/request-status-summary.ts:97-108`

**Issue:** The status group-by and the three holder counts are four separate statements outside a transaction. A request created or deleted between them makes `byHolder` sum to `total ± 1`, while the contract (`MyRequestStatusSummary` description) states the sums are equal. No current consumer enforces the sum, so the effect is a transient off-by-one badge.

**Fix:** Run the reads in one read transaction or snapshot, or compute both from one grouped query. Alternatively, soften the published invariant.

#### IN-105: Server-side bounds the contract publishes are not enforced on two computed strings

**File:** `apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts:361-364`; `services/my-requests.ts:117-121`

**Issue:**
- `requestorName` is published with `maxLength: 255`, but `requestorDisplayName` passes any non-blank `displayName`. The attribute is an unbounded `string` on SQLite, and Keycloak provisioning may supply long names. One long name would make the closed web parser reject the whole queue page.
- The My requests and queue `q` are not trimmed: `"   "` is accepted and matches every title that contains spaces. The register trims and refuses blank input.

**Fix:** Clamp or null `requestorName` above 255 characters, as `projectRequestTitle` does. Trim `q` and refuse a blank result, matching `risk-register-query.ts:128-134`.

---

_Reviewed: 2026-10-04_
_Reviewer: Claude (gsd-code-reviewer), Lane 1_
_Depth: standard_

---


## Phase 11: Code Review Report, Lane 2

**Reviewed:** 2026-10-04
**Depth:** standard (each file's `git diff 9f95575..HEAD`, plus the callers and callees needed to prove or refute each claim)
**Files Reviewed:** 56
**Status:** issues_found

### Summary

This lane covers the shell and navigation, Home for both actors, quick find, My requests, the lifecycle stepper and hub, the route boundaries and the walk fixes. No Critical defect was found. No scope leak, open redirect or authorisation bypass showed up. Six Warnings and seven Info items follow.

**Checked and found correct:**

- **Gate before read (D-16, T-11-01):**
  - `app/(app)/app/page.tsx:24-35` chooses the Home variant from the session's capabilities before any data read.
  - `AnalystHomeContent` re-checks `assessment:review` before `getAnalystDashboard()` (`analyst-home.tsx:33`).
  - The Requestor Home issues only the owner-scoped `my_requests` and `my_risk_assessments` reads.
  - The E2E fixtures and partial selectors resolve only after the real reads succeed.
- **`/app/review` redirect:** `next.config.ts` declares an exact-path 307 (`permanent: false`) to a fixed `/app`, so no open redirect. No page remains at `/app/review`, and no in-app link points to it.
- **Navigation counts (11-13):**
  - The counts are started unawaited in the layout (`layout.tsx:44`).
  - `loadNavigationCounts` never rejects: each `figure()` catches and drops its own read, and the outer try/catch returns `{}`.
  - A key is read only when the viewer's profile shows an item that carries it, so a Requestor issues no analyst read.
  - Requests reads the same `filters[queue]=requires-attention` the list opens on by default.
  - Each count sits in its own `Suspense` with a `null` fallback. The count is part of the link's content-derived name ("My requests, 3 need your action"), and a zero or unknown count renders nothing.
  - The counts promise is built per request from the session, so no count leaks across actors.
- **Navigation:**
  - The profile data matches UI-SPEC §1.1.
  - The longest-match current item works, and the own-requests section opens itself on its own pages.
  - Collapsed items are neither rendered nor prefetched.
  - The guard is wired on every link (`onClick` then `onNavigate`), and the drawer closes only once the guard allows the navigation.
  - The walk fix `3117ba9` puts `key` before the spread (`capability-navigation.tsx:157`).
- **Quick find (11-19, 11-20):**
  - Search runs through one `'use server'` action with no Route Handler.
  - The term is validated by a strict zod schema, trimmed and 2 to 100 characters, before the session is read.
  - The capabilities only choose which lists are asked, and every list is an existing service function scoped by Strapi. A Requestor gets only `my-requests`, `my-questionnaires` and `my-assessments`, so a Secondary Requestor cannot see Jane's records.
  - A 403 hides that group, and a failure or throw marks only its own group failed.
  - Each server `term` is trimmed with the same `String.prototype.trim` as the client, so the stale-response check (`next.term === latestTerm.current`) holds. The single-flight and pending-term logic is correct under fast typing, backspacing and clearing.
  - Results open through the new `guard.navigate`, and Keep answering returns focus to the input.
  - The shortcut listener is registered with `{ capture: true }` and removed with the same options, with no leak. It ignores `isComposing` and `repeat`, and it is blocked while another `role=dialog` or `role=alertdialog` is open.
  - The platform hint renders after mount, so there is no hydration mismatch.
  - zod stays out of client bundles: the dialog imports only the server reference, and the domain modules are zod-free.
- **Status mapping:**
  - `statusPresentation` is the only label source, and "Approved" no longer appears as a label anywhere in `src`.
  - `approved` reads Released in both the request and assessment families.
  - Unknown values fall back to a neutral label (but see IN-206).
- **Lifecycle:** `nextActionPresentation` links only when `holder === actor` and an href is served, and `myRequestNextStep` pins the viewer to the Requestor. The stepper and hub show one line per width (`md:hidden` and `hidden md:block`). The generation-job override feeds both.
- **Boundaries and copy:**
  - `PermissionDeniedState` defaults to "Go to Home".
  - Both not-found pages and `review/requests/error.tsx` say "Go to Home".
  - The loading and error defaults no longer say "workspace".
- **Walk fixes:**
  - `body` has no `min-width`, and nothing in this lane's markup or CSS relies on a 320px floor: every new `min-width` is 0 or 44px, and the widest flow control is the 208px `min-w-52` select.
  - The phone-card row wraps (`flex flex-wrap`, `grow basis-24`).
- **Tokens and dates:**
  - Every new CSS rule uses tokens, and the new rules are unlayered, so they beat the shadcn utility classes as intended.
  - Instants on My requests, the hub and Home go through `LocalInstant`.
  - Calendar due dates use `formatRequestDate`, which formats in UTC and so shows the stored date.

### Warnings

#### WR-201: The quick-find live region does not announce a search whose result text equals the previous one

**File:** `apps/csrm/src/features/quick-find/quick-find-dialog.tsx:366` (with `quick-find-domain.ts:353-361`)

**Issue:** The polite region renders `quickFindAnnouncement(outcome)` as plain text. React only writes to the DOM when the text changes, so a completed search whose announcement equals the previous one causes no DOM mutation, and screen readers announce nothing. UI-SPEC §4.4 requires "each completed search, once".

**Failure scenario:** A screen-reader user searches "RAR-2026-1" (5 matches) and then "RAR-2026-2" (also 5 matches): the second search is silent. Likewise, Retry search after "Search isn’t available right now." fails again silently, so the user cannot tell that the retry ran.

**Fix:** Make each completed search a distinct mutation. Either key the region's child by a per-outcome sequence number (`<p aria-live="polite" className="sr-only"><span key={outcomeSeq}>{text}</span></p>`, with `outcomeSeq` bumped in `apply`), or clear the text and set it on the next frame. Put the term in the results announcement too, as the no-matches one already does.

#### WR-202: Seven route error boundaries call `reset`, which does not re-fetch, so Try again cannot recover from a server error

**Files:**
- `apps/csrm/app/(app)/app/assessments/error.tsx:7,11`
- `apps/csrm/app/(app)/app/questionnaires/error.tsx:7,15`
- `apps/csrm/app/(app)/app/requests/error.tsx:8,16`
- `apps/csrm/app/(app)/app/review/assessments/error.tsx:9`
- `apps/csrm/app/(app)/app/review/questionnaires/error.tsx:7,11`
- `apps/csrm/app/(app)/app/review/requests/error.tsx:9`
- `apps/csrm/app/(app)/app/risks/error.tsx:6`

**Issue:** Next 16.3's docs (`03-file-conventions/error.md`) say `reset()` re-renders the boundary's children *without re-fetching*, and that `retry()` is the recovery function. These boundaries sit over Server Components, so `reset` re-renders the same failed RSC payload and the boundary shows again at once. Phase 11 rewrote each of these files (headings and copy) but kept `reset`, while the Home and Alerts boundaries in the same phase use `retry`.

**Failure scenario:** A transient Strapi or network failure makes `/app/review/requests` throw. Every click on "Try again" redisplays the error until the user reloads the page.

**Fix:** Take `retry` instead of `reset` in each boundary, as `app/(app)/app/error.tsx` does: `({ retry }: { error: …; retry: () => void }) => … <ErrorState retry={retry} />`.

#### WR-203: The layout's permission state sends the user to "Go to Home", which is the same refused page

**Files:** `apps/csrm/app/(app)/layout.tsx:25-34`, `apps/csrm/src/components/states/states.tsx:12,132-133`

**Issue:** When the viewer lacks `assessment-request:read`, the layout replaces every page, `/app` included, with `<PermissionDeniedState />`. That now defaults to the body "Home shows the work you can open" and the action "Go to Home" (→ `/app`). The Requestor and analyst Homes avoid this loop with "Return to sign in" (UI-D19), but the shell-wide refusal does not.

**Failure scenario:**
- In OIDC mode, any `/v1/me/access` failure grants nothing (`oidc-session-adapter.ts:88-99`), so the user sees "Home shows the work you can open… Go to Home".
- Clicking it renders the same refusal on `/app`. That is a dead end, and the copy is untrue.

**Fix:** Pass an explicit action at the layout: `<PermissionDeniedState action={{ label: 'Return to sign in', href: '/sign-in' }} />`, or a sign-out action in OIDC mode. Use a description that does not point to Home.

#### WR-204: The three review list routes read analyst data before checking `assessment:review`

**Files:**
- `apps/csrm/app/(app)/app/review/requests/page.tsx:10-13`
- `apps/csrm/app/(app)/app/review/questionnaires/page.tsx:11-14`
- `apps/csrm/app/(app)/app/review/assessments/page.tsx:10-13`

**Issue:** The binding rule for this phase is that every route rendering analyst data checks the capability before reading. These three lists call `listAssessmentRequests`, `listQuestionnairesForReview` and `listAnalystAssessments` unconditionally, and fall back to a permission state only when Strapi answers 403. Other routes check first: the review *detail* routes are gated before any read (`analyst-route-gate.test.tsx`), and so are `/app/alerts`, `/app/reports` and `/app/risks` (`risks/page.tsx:21`). Strapi still refuses the read, so no data leaks. But a Requestor who opens a bookmarked or typed URL issues an analyst read on every visit, which is the pattern T-11-01 and 07 D-16 forbid. Phase 11 touched each file (headings) without closing the gap.

**Failure scenario:** A Requestor opens `/app/review/requests?queue=all&q=RAR` (for example a Show all link shared by an analyst). The web server sends an analyst queue read to Strapi under her identity before showing the refusal.

**Fix:** Mirror `RiskRegisterContent`. Read the session's capabilities first, and return the permission state (or the detail routes' "Go to My requests" gate) before calling the service when `!can('assessment:review', granted)`.

#### WR-205: The new "New request" links on Home are not gated on `assessment-request:create`

**Files:**
- `apps/csrm/src/features/home/home-page-header.tsx:22-23`
- `apps/csrm/src/features/home/requestor-home-presentation.ts:258-261` (the Your own requests footer)
- `apps/csrm/src/features/home/requestor-home-presentation.ts:77` (the first-use empty-state action)

**Issue:** The sidebar's primary action and the analyst's own-requests item are gated on `assessment-request:create` (`navigation.ts:124`, D-07). The three Home entry points render New request for any viewer who reaches the Requestor or analyst Home. In OIDC mode, capabilities come from Strapi's FunctionAPI grants (`strapi-capabilities.ts:17`), so a viewer can hold read without create.

**Failure scenario:** An OIDC user with request read but no create grant sees a prominent New request pill on Home. Following it lands on `/app/requests/new`, which reads the selectors and then shows a refusal. The navigation and Home disagree about the same action.

**Fix:** Pass `canCreate = can('assessment-request:create', granted)` from `HomePage` and `AnalystHomeContent` into `HomePageHeader`, `RequestorHome` and `OwnRequestsPanel`, and omit the action when it is false. The same applies to `requests/page.tsx:46` (the same pattern, from before this phase).

#### WR-206: During the 250ms debounce, the previous term's results stay fully active, and Enter opens a record for a term no longer typed

**File:** `apps/csrm/src/features/quick-find/quick-find-dialog.tsx:225-230,329-331`

**Issue:** `outcome` is shown whenever the current term is searchable, even when `outcome.term !== term.trim()`. The pending opacity and `aria-busy` key off `search.busy`, which only becomes true once the debounced search is *sent*. For up to 250ms after each keystroke, the list shows the old term's results at full opacity, with cmdk's first option selected and no busy state. UI-D14 allows opening a pending result only when it is visibly marked as pending.

**Failure scenario:**
- An analyst searched "RA" earlier, then types the full number "RAR-2026-5WWFVQ" and presses Enter within 250ms.
- The dialog opens the first "RA" match, a different request, through the guard and closes.

**Fix:** Treat an outcome for a different term as pending. Compute `stale = outcome !== null && outcome.term !== term.trim()` and use `pending = (search.busy || stale) && outcome !== null`. Then either keep `Enter` from opening while `stale`, or keep the dimmed styling so the user can see the list is out of date.

### Info

#### IN-201: The hub's `hrefs.nextAction` override is not mirrored in the stepper, so the one-presentation guarantee is broken if a caller ever uses it

**Files:** `apps/csrm/src/features/requests/request-hub.tsx:169`, `apps/csrm/src/features/requests/request-lifecycle-stepper.tsx:45`

**Issue:** The hub substitutes `hrefs.nextAction` for the served href, but the stepper's compact line (phone width) reads only `lifecycle.nextAction.href`. No caller passes `hrefs.nextAction` today, so the two agree, but the prop is a trap: the phone and desktop lines would link to different places.

**Fix:** Remove `nextAction` from `RequestHubHrefs`, or pass the same resolved href to the stepper.

#### IN-202: The shortcut matches on `event.key`, which catches Ctrl+Shift+K and misses non-Latin keyboard layouts

**File:** `apps/csrm/src/components/shell/quick-find-trigger.tsx:144-145`

**Issue:** `event.key.toLowerCase() !== 'k'` also matches Ctrl+Shift+K, a browser developer-tools shortcut in Firefox, and calls `preventDefault` on it. On Cyrillic or Greek layouts the key is not "k", so the shortcut never fires. Safari's composition-end keydown (`keyCode === 229`) is not excluded either.

**Fix:** Require `!event.shiftKey`, match `event.code === 'KeyK' || event.key.toLowerCase() === 'k'`, and ignore `event.keyCode === 229`.

#### IN-203: The loading frame's typed-ahead term is not bounded to 100 characters

**File:** `apps/csrm/src/components/shell/quick-find-trigger.tsx:46-52`

**Issue:** `keep` appends every key to `term` with no cap. Once the dialog loads, the input holds more than its `maxLength` (100), and the dialog shows the hint instead of searching.

**Fix:** `onTermChange((term + event.key).slice(0, QUICK_FIND_MAX_TERM_LENGTH))`.

#### IN-204: On short desktop-width viewports, the quick-find list's magic-number height can shrink to almost nothing

**File:** `apps/csrm/app/globals.css:831`

**Issue:** `max-height: calc(100dvh - var(--header-h-md) - 48px - 44px - 37px - 48px)` subtracts 241px. At 768px or wider and 256px tall (the WCAG 1.4.10 landscape case), the list is 15px tall. The 44px and 37px are hard-coded row heights.

**Fix:** Use a `min()` or `max()` floor (for example `max(8rem, …)`), or let the frame cap at `100dvh - top - 16px` and scroll the list within a flex column.

#### IN-205: Copy and dead code in the review boundaries

**Files:**
- `apps/csrm/app/(app)/app/review/assessments/error.tsx:10`
- `apps/csrm/app/(app)/app/review/requests/error.tsx:10`
- `apps/csrm/app/(app)/app/review/questionnaires/page.tsx:15-17,42`

**Issue:**
- The descriptions "We couldn't load the assessment review queue." and "We couldn't load submitted assessment requests." use a straight apostrophe, against the voice rule's ’.
- The assessments boundary's way out reads "Back to assessment requests" to a page now headed "Requests" (UI-D1: name the page by its heading, so "Go to Requests" or "Go to Home").
- In the questionnaire review page, `state` is always `undefined` in the success branch, where it is still passed.

**Fix:** Use typographic apostrophes, rename the link, and drop the dead `state` in the success path.

#### IN-206: The status fallback renders "Null" or an empty badge for a null or empty value

**File:** `apps/csrm/src/components/csrm/status-badge.tsx:135-147`

**Issue:** `unknownStatusPresentation(String(value))` turns `null` into "Null" and `''` into an empty label. The closed parsers make this unlikely, but the fallback exists exactly for values that slip through.

**Fix:** Return a fixed "Status not recorded" label when `value` is null, undefined or blank, as `request-hub.tsx:149` already does.

#### IN-207: A returned draft with an unparseable `at` renders "Returned to draft on ."

**File:** `apps/csrm/src/features/home/requestor-home.tsx:139-143` (and `request-schema.ts:192`, where `at: z.string()`)

**Issue:** My requests guards instants with `shownInstant`, but the Requestor Home passes `returned.at` straight to `LocalInstant`, whose fallback is `null`. The sentence then reads "Returned to draft on ." The bar chart has a similar silent gap (`bar-chart.tsx:157`): a `secondary` link on a datum without `href` is dropped without notice.

**Fix:** Check the value with `shownInstant(item.returned.at)` in `needsActionItemView` and omit the date clause when it is null. Tighten `at` to an ISO date-time in the schema.

---

_Reviewed: 2026-10-04_
_Reviewer: Claude (gsd-code-reviewer), Lane 2_
_Depth: standard_

---


## Phase 11: Code Review Report, Lane 3

**Reviewed:** 2026-10-04T09:00:00Z
**Depth:** standard (with cross-checks into the Strapi predicates each figure link depends on)
**Files Reviewed:** 47
**Status:** issues_found

### Summary

I read each file's Phase 11 change (`git diff 9f95575..HEAD`), plus the walk-fix commits `08d850f`, `cea169e` and `82d2b20`. To prove or refute each figure-equals-list claim, I traced callers and callees into Strapi: `treatment-due-state.ts`, `alert-repository.ts`, `report-repository.ts`, `review-queue-repository.ts`, `collection-scope.ts`, `assessment-scope.ts`, `risk-register.ts` `selectedLabels`, `effective-access.ts` and the role-function catalogue. I ran no tests, servers or typechecks.

**Checked and found correct:**

- **URL readers (the `08d850f` class).**
  - No `z.record` remains on any searchParams path. The only `z.record` in `apps/csrm` is the questionnaire form's `answers` field.
  - The register (`riskRegisterQuerySchema`) uses `z.object`.
  - Both assessment lists and the request queue copy each value into a fresh literal, taking the first entry of an array.
  - Alerts now uses `z.looseObject({})`.
  - Every enum is closed:
    - register stage, treatment action, due state, effectiveness, `impactedSystem`, the rating and treatment-status `none` values;
    - assessment `overallRating`;
    - queue `queue` (with `all`);
    - queue `sort`, now a closed enum that matches `REVIEW_QUEUE_SORT_FIELDS`, including `updatedAt`.
  - Every page is bounded to 1..1,000,000 and every page size to a closed set.
  - Pagination and sorting keep every filter:
    - risk register: `searchParametersFor` iterates the extended `filterKeys`;
    - analyst assessment list: `navigateFor` writes `overallRating`, `approvedFrom` and `approvedTo`;
    - My risk assessments: `navigate`;
    - request queue: `onSortingChange` resets only `page`.
  - `system` and `impactedSystem=none` are made exclusive in all three places: the zod `.overwrite`, the zod-free reader and the filter UI.
- **Figure-equals-list.** Each link's parameters map to the predicate the server counts with:
  - **Exposure (dashboard and report):** released open (`state=open&stage=released`); accepted (`&treatmentAction=Accept`); under assessment (`stage=under-assessment`); `none` for Not rated and Not provided. These match `openReleasedRisks`, `openUnderAssessmentRisks` and the `treatment_action = 'Accept'` partition.
  - **Treatment performance:** the `dueState=later` and `dueState=no-target-date` links, and the overdue and due-soon alert kinds. All of them use `applyTreatmentDueStatePredicate` with `ALERT_DUE_SOON_WINDOW_DAYS`, so the report, the register and the alerts share one predicate, which also puts the open condition inside the due states.
  - **Throughput lifecycle rows:** `queue=all&status=...` covers exactly `REVIEWABLE_REQUEST_STATUSES` plus `RELEASED_REQUEST_STATUSES`, the same set the report groups.
  - **Throughput month and period links:** these use the same UTC `[from 00:00, to + 1 day)` window as the report's UTC month buckets.
  - **Exceptions:** the mitigation-control row headers and tile are the cited D-36 exception. The High+Critical total, the systems' Total and the no-system note are cited D-37 sums.
  - **Defaults:** no list applies a default filter, and no sort changes a total.
- **Scope statements and the 14-day window.**
  - "Released Risks only" appears on the Home exposure widget, the High and Critical widget and the report tiles.
  - "Includes Risks under assessment." appears on every D-43 surface.
  - "Due within {n} days" always comes from the served window.
  - No 30-day copy remains in production code. The 30s left are test fixtures that pass the window in.
- **Lists.**
  - The queue has its nine columns and phone cards.
  - The assessment lists show the request title, the Risk count and the highest residual rating (with a "Not rated" fallback).
  - The Related assessment picker searches on the server. The action no longer re-filters by label, which would drop matches on the summary. `selectedLabels` sends `{number} · {title}`.
  - `LocalInstant` is used for Submitted, Released and Recent activity. Due and target dates stay zone-free.
- **Questionnaires (11-09).** The submitted-answers split matches the old renderer branch exactly: same notice map, same visibility rule, same section order, same `question-{key}` ids. The analyst review drops `mode="read-only"`, which only ever reached that branch. `QuestionnaireRequestRelationship` is proven equal to its parser with `SameType`. I found no Phase 10 regression.
- **Capabilities.** `assessment-request:read` is now anchored to `GET:/api/v1/my_requests`. Only the Requestor birthright's My Requests Function holds that operation, and `effective-access.ts` folds the birthright into every human user's operations. So the change narrows the capability and grants nothing the server refuses.
- **E2E fixtures.** `resolveE2eRequestorHomePartial` stays behind `isAttestedUiStateHarness()` (`CSRM_E2E_UI_STATE_HARNESS=1` plus the attested runtime), and nothing still references `resolveE2eDashboardPartial`.
- **Design document.** X-6 to X-10 in `docs/design/csrm-design-direction.md` match the UI-SPEC table byte for byte (checked programmatically). The `CONTEXT.md` sentence matches UI-SPEC §10 verbatim.
- **Hygiene.** No hard-coded colours were added, and no zod value import reaches a client module in this lane.

**Findings:**
- **Warnings (3):**
  - the released-date filter uses UTC dates while the list beside it shows local dates;
  - the "Accepted" marker contradicts the binding glossary;
  - an inverted released-date range is dropped without any message.
- **Info (7):** robustness and consistency notes.

### Warnings

#### WR-301: Released-date filters and chips use UTC calendar days, but the same list shows the release date in the viewer's time zone

**File:** `apps/csrm/src/features/assessments/assessment-list.tsx:285-298` (with `report-presentation.ts:154`, `released-assessment.tsx:59`, and Strapi `assessment-scope.ts` `approvalDatePredicates`)

**Issue:**
- The throughput tiles and month cells open `/app/review/assessments?status=approved&approvedFrom=…&approvedTo=…`.
- Strapi applies those bounds to the approval instant's UTC date. The report's month buckets are UTC too, so the counts match.
- The chips (`Released from` and `Released to`, formatted with `formatRequestDate`) also read UTC calendar dates.
- The list's own `Released` column renders the same instant with `LocalInstant` in the viewer's zone (D-55).

**Failure scenario:**
- A Sydney analyst (UTC+10) opens the "September 2026: 3" month cell.
- One assessment was released at `2026-09-30T22:00Z`.
- The list shows the chip "Released to: 30 Sept 2026" next to a row whose Released column reads "1 Oct 2026".
- The October cell holds a release from `2026-10-31T20:00Z`, which shows as "1 Nov 2026".
- For an en-AU product, every release made before 10:00 or 11:00 local time on the first of a month lands in a month the row's own date contradicts. Analysts reading the list will conclude the figure is wrong.

**Fix direction:** pick one zone for the date-range view and say so. Either:
- render `approvalDate` as a UTC calendar date wherever `approvedFrom` or `approvedTo` is active, and label the chips "(UTC)"; or
- send the viewer's IANA zone to Strapi, and compute both the month buckets and the range in that zone (a contract change).

At minimum, add "UTC" to the chips and to the month table's caption, so the two dates on one screen cannot silently disagree.

#### WR-302: The "Accepted" marker labels the analyst's recorded value as a decision, which the binding glossary says it is not

**File:** `apps/csrm/src/features/risks/risk-domain.ts:118-130`, `apps/csrm/src/features/risks/risk-register.tsx:67-70`, `apps/csrm/src/features/reports/report-presentation.ts:227-232`, `apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts:354-366`

**Issue:**
- Root `CONTEXT.md` ("Accept, Treat (risk decisions)") is the domain source of truth under AGENTS.md. It says Accept and Treat are the risk owner's decisions, and that "a value set before the owner decides is the analyst's recommendation, not a decision."
- No owner decision exists until Phase 17.1. Today a Security Analyst sets `treatmentAction = Accept` and releases.
- Phase 11 nevertheless labels such a Risk "Accepted":
  - on the register row and card ("Released · Accepted");
  - in the Home "{n} accepted" links;
  - in the report's "Accepted" tile and column.
- `isAcceptedRiskRow`'s doc comment calls it "the recorded decision".
- The Phase 11 glossary edit touched `CONTEXT.md`, but it did not reconcile this, and it added no "Accepted (exposure)" entry. D-41 defers the refinement to 17.1 but does not override the glossary.

**Failure scenario:** a governance reader sees "Accepted" on a released Risk and treats it as formal risk acceptance (ISO/IEC 27001 6.1.3 f). It is only the analyst's recommendation. This is exactly the conflation the glossary's _Avoid_ guidance exists to prevent, and it will collide with 17.1's real acceptance facts.

**Fix direction:** either:
- record an interim glossary entry: "Accepted (exposure marker): a released open Risk whose `treatmentAction` is `ACCEPT`; until Phase 17.1 it records the released value, not an owner's decision". Also correct the `isAcceptedRiskRow` comment. Or:
- reword the marker to the field it reads ("Accept recorded", or "Treatment action: Accept") until 17.1. The report tile's supporting line already does this.

Record the choice against D-41.

#### WR-303: An inverted released-date range is silently dropped, so the list shows more records than the URL asks for, with no chip or message

**File:** `apps/csrm/src/features/assessments/assessment-service.ts:209-225`

**Issue:**
- `collectionQuerySchema` drops both `approvedFrom` and `approvedTo` when from follows to, and it drops an unparseable date on its own (`.catch(undefined)`).
- Nothing tells the user. The date chips are the only visible trace of the range (UI-D30 gives no control), so both disappear.
- The list then renders every assessment matching the remaining filters.
- The Risk register handles the same case explicitly: `readRiskRegisterQuery` and `riskRegisterQuerySchema` refuse an inverted target-date range, and the page shows `RiskRegisterInvalidFilterState`.
- The lane brief asks for from-after-to validation. This version validates by discarding.

**Failure scenario:**
- A bookmarked or hand-edited link `…?status=approved&approvedFrom=2026-09-30&approvedTo=2026-09-01`, or a future figure link that swaps its arguments, opens the full released list.
- No chip and no notice appear, and the total is larger than the figure the user clicked.
- Likewise, `approvedTo=2026-09-31` silently becomes an open-ended "from" filter.

**Fix direction:** have the server page read the raw values and render an invalid-filter state, as the register does ("Check the Released date range, or clear the invalid filters"), instead of dropping them. Or keep each malformed value as a visible chip marked invalid. Add a test that an inverted range never yields a populated, unfiltered list.

### Info

#### IN-301: The Alerts loading state reads repeated parameters last-wins, while the server reads first-wins, despite the "never read a URL apart" claim

**File:** `apps/csrm/src/features/alerts/alert-list.tsx:213`, `apps/csrm/src/features/alerts/alert-schema.ts:148-154`

**Issue:**
- `AlertListLoading` passes `Object.fromEntries(searchParams.entries())`, which keeps the last value.
- The server passes Next's array, and `readAlertListUrlQuery` takes the first.
- So `?urgency=overdue&urgency=due-soon` shows a "Due soon" skeleton, then an "Overdue" list.
- The register's loading state already builds arrays (`searchParamsRecord` in `risk-register-loading.tsx`).

**Fix:** use the same `getAll`-based record builder for Alerts. Or soften the comment.

#### IN-302: "View Critical" and "View High" always render after the no-impacted-system note, even when one of them opens an empty list

**File:** `apps/csrm/src/features/reports/report-presentation.ts:462-468`

**Issue:**
- `exposedSystemsNoteLinks` emits both links whenever `risksWithoutSystem > 0`.
- The served figure is only their sum, so when, for example, all such Risks are High, "View Critical" opens an empty register.
- The table's own rule is that a zero is plain text and that no link from a table opens an empty list (`report-table.tsx`, X-10).

**Fix:** have the report serve `risksWithoutSystem` by rating (Critical and High), and omit a link whose part is zero.

#### IN-303: Figure links are stringly typed, and the register silently ignores a value it does not know

**File:** `apps/csrm/src/features/reports/report-presentation.ts:109-111` (and the hand-written hrefs at `report-presentation.ts:112-160`, `analyst-dashboard-presentation.ts:349-351`)

**Issue:**
- `riskListHref(filters: Record<string, string>)` and the literal hrefs are not typed against `RiskRegisterQuery`.
- `oneOf` and `optionalEnum` turn an unknown key or value into `undefined` with no error.
- A typo, or a vocabulary rename (for example `'Partially Effective'`, or a Phase 20 status), would open a broader list whose total silently differs from the figure.
- All current values are valid; this is a guard gap.

**Fix:** type the builder as `Partial<Pick<RiskRegisterQuery, …>>` and serialise it with the register's own key list. Or add one test that parses every generated href with `parseRiskRegisterQuery` and asserts that no parameter was dropped.

#### IN-304: The queue's sort fields are a hand-kept list, cast into the closed sort type

**File:** `apps/csrm/src/features/assessments/assessment-list.tsx:80-91`

**Issue:** `requestSortFields: readonly string[]` is not derived from the `requestReviewQuerySchema` sort enum, and `requestSortFor` casts the template string with `as AssessmentRequestReviewQuery['sort']`. Adding a sortable column whose field the server does not serve would compile and send an unserved sort. It would then degrade to the default on the next server parse, so the column header would show the wrong sort state.

**Fix:** export the sort tuple from a zod-free domain module, derive the field list from it, and narrow with a type guard instead of `as`.

#### IN-305: The parameter `statusLabel` shadows the imported `statusLabel` function

**File:** `apps/csrm/src/features/reports/report-presentation.ts:125`

**Issue:** `lifecycleLinkName(count, statusLabel: string)` shadows the `statusLabel` imported at line 2. It is harmless today, but any later call inside that function would hit the string.

**Fix:** rename the parameter to `label`.

#### IN-306: The released-in-period list counts approved assessments with no approver; the report does not

**File:** `apps/csrm/src/features/reports/report-presentation.ts:154-156` (Strapi `report-repository.ts` `releasedAssessments` and `assessment-scope.ts`)

**Issue:**
- The report's releases require the full release triple: `approved`, an approval date and an `approvedBy` link.
- The linked list filters only `status=approved` plus the date range.
- An approved assessment whose approver link is missing therefore sits in the list but not in the figure. Example: an approver's user record removed, which drops the link row.

**Fix:** narrow the assessment list's `status=approved` filter to the same triple, or add a `released=true` filter that reuses the server's release predicate.

#### IN-307: The capability re-anchor removes `assessment-request:read`, and with it the whole `(app)` layout, from any user who holds `core_api` but not the Requestor birthright

**File:** `apps/csrm/src/lib/capabilities/strapi-capabilities.ts:16`

**Issue:**
- The old anchor, `GET:/api/csrm-assessment-requests`, is held by the Requestor, Security Analyst and Security Analyst Agent Roles.
- The new anchor, `GET:/api/v1/my_requests`, is held only through the Requestor birthright.
- Every human user gets the birthright, so no human loses access, and nothing is over-granted.
- But an identity without the birthright, such as the agent Role if it ever signs in to the web, now fails `requireCapability('assessment-request:read')` in `app/(app)/layout.tsx` and loses every page.

**Fix:** record this narrowing in ADR 0004 or the 11-11 SUMMARY. If machine identities must never use the web, say so beside the anchor.

---

_Reviewed: 2026-10-04T09:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---


## Phase 11: Code Review Report, Lane 4 (web unit tests and Playwright specs)

**Reviewed:** 2026-10-04T09:30:00Z
**Depth:** standard. Each file's change was read with `git diff 9f95575..HEAD`, plus enough of the code under test to check what each test claims.
**Files Reviewed:** 84
**Status:** issues_found

### Summary

I read every Phase 11 change in the 84 test files. For the claims that carry weight, I also traced the component, service or seed underneath: the quick-find dialog's outcome state, `daysSinceSubmission`, the seed's day offsets, the DataTable mobile markup, `RecordLink` display, `nextActionPresentation`, the shell header and `globals.css`. I did not run any suite, as the lane brief required.

**What I checked and found sound:**

- **Signing in as the right actor.** `signInAs` and each spec's own copy (analyst-insights, design-system-conformance, design-contract, production-hardening and app-shell) assert two things after the click: the level-one Home heading, and the exact role text in `.header-role` in the banner. A session left over from the previous actor therefore fails `SIGN_IN_ROLE`. The development role switcher is portalled out of the banner, so it cannot satisfy that check. No helper can race the cookie into a pass.
- **The Secondary Requestor's quick-find scope (`UX10_SCOPE_SECONDARY_REQUESTOR`).** "No matches for “{term}”" renders from `outcome.term`, the server's answer for that exact term (`quick-find-dialog.tsx:314`). The check therefore cannot pass while results are loading, or on the previous term's answer. The test also has a positive control: the same word finds the record for Jane.
- **The analyst-only refusals.** The analyst-insights matrix, the Secondary Requestor refusals in accessibility and the D-18 lifecycle refusals all assert the permission alert and its heading, not an empty list.
- **Unit authorisation proofs.** `e2e-ui-state-route-authorization.test.tsx` checks that fixtures resolve only after the reads, and its `indexOf` checks fail when a fixture never resolves. `navigation-counts.test.ts` asserts that a Requestor issues no analyst read. `quick-find-actions.test.ts` asserts that a Requestor gets no analyst list, that an invalid term reads nothing, and that there is no read without a session.
- **Figure-equals-list browser tests.** Most compare a server figure with the total of a list read through a different endpoint, so they can fail:
  - DASH03_REPORT_SCOPE and DASH03_UNDER_ASSESSMENT_APART compare the report and dashboard figures with the register's lists.
  - DASH03_ACCEPTED_SEED does the same for the accepted figure.
  - UX08_ANALYST_OWN_REQUESTS compares `status_summary.byHolder` with `my_requests`.
  - The alert-count tests compare the alerts summary with the alerts list.
  - UX07_COUNT_EQUALS_LIST compares `status_summary` with the holder list.
  - DASH03_REGISTER_STAGE's stage sum fails if the stage filter is ignored (2 × total ≠ total).
- **The 11-18 unit audit.** It proves that every walked figure has an href or a documented exception, and that every stale exception fails. That each href carries the right filters is proved separately, in `report-presentation.test.ts`.
- **Real layout boxes.** These proofs measure real boxes at a real viewport:
  - UX08_ANALYST_PHONE_FIRST_SCREEN in the mobile project;
  - UX08_REQUESTOR_PHONE_FIRST_SCREEN and UX08_PHONE_STEPPER, which set 375×812 themselves;
  - UX10_KEYBOARD_PHONE, whose sheet box must equal exactly 0, 0, 375 and 812;
  - the last drawer item in UX07_DRAWER_SAME_SECTIONS.
- **Dates.**
  - Seed dates are relative to boot, with safe margins: due soon at +7 days inside the 14-day window, overdue at −30 days, and the release at −5 days.
  - The review-queue age accepts `0 days|1 day`.
  - Due dates are generated and formatted in UTC.
  - The unit tests use fake timers or fixed instants.
- **The walk-fix tests.**
  - **08d850f:** the test proxy binds `constructor`, so it really reproduces zod 4's `isPlainObject` refusal.
  - **cea169e:** the new terms in the copy guard would have flagged `reports-page-header.tsx`.
  - **3117ba9:** the AST guard fails on a key placed after a spread.
  - **601d2e3:** the CSS guard fails if `min-width` comes back on the top-level body rule.
  - **82d2b20:** the source guard flags rows that do not wrap. Its e2e card-box check, with a 0.5px tolerance, would have caught the 2px overrun at a 320px viewport. See WR-403 for what it cannot catch.
- **A clean tree (Phase 8 D-12, G-6).** The only file a spec writes is `performance.spec.ts`, into `apps/csrm/.tmp/performance`, which `.gitignore:18` ignores. Phase 11 adds no spawned server and no write to tracked paths.
- **Boundary guards.**
  - The zod-boundary test now classifies every `(app)` route directory.
  - The server-only guard now includes `navigation-counts.ts`.
  - The redirect test pins one exact, temporary rule.
  - The sign-in guard follows the Home heading.
  - The copy guard list is sorted, unique and every file exists, but it is not complete (WR-404).

**Key concerns:**

- The only e2e proof of D-55's local zone cannot fail on most runs (CR-401).
- Several "count" and "filter" assertions cannot fail when the behaviour they name is missing (WR-401, WR-405, WR-406).
- The reflow proof cannot see the classic-scrollbar defects the walk found (WR-403).
- The copy guard's file list does not match UI-SPEC §11.2 (WR-404).

### Critical Issues

#### CR-401: The viewer-time-zone proof for the queue's Submitted date cannot fail for most of each day

**File:** `apps/csrm/e2e/review-lists.spec.ts:134-145` (`UX09_QUEUE_SUBMITTED_IN_VIEWER_ZONE`)

**Issue:**

- **What the test does.** It creates a request moments before the check. It then compares the rendered Submitted date with that instant formatted as a calendar date in `Australia/Brisbane` (UTC+10, no daylight saving).
- **Why it usually cannot fail.** A Brisbane calendar date differs from the UTC date only when the instant falls between 14:00 and 23:59 UTC. For the other 14 hours of each day, a page that ignored the viewer's zone and rendered in UTC (or in the server's zone) shows the same text.
- **The comment admits the window.** It says the page "may first render in UTC until the shell sends the zone … the poll absorbs that one re-render". So the poll accepts the UTC render whenever the two strings are equal.
- **The recorded gate proved nothing.** The gate re-run recorded in `f875411` was committed at 18:57 +1100 (07:57 UTC). In that run, D-55's only browser proof was vacuous.
- **Nothing else covers it.** The other D-55 surfaces in the e2e suite are checked only for the presence of a `<time>` element: UX09_ASSESSMENT_RELEASED_LOCAL, Recent activity's `datetime` attribute, and "Updated .+". The unit tests set the zone through `TimeZoneProvider` directly. Nothing else proves that the browser's zone reaches the server render (the zone cookie and `ViewerTimeZoneSync`).

**Scenario:** A change drops `ViewerTimeZoneSync` from `AppShell`, or the cookie stops being read. The queue renders in UTC. The gate runs at 09:00 Sydney time (22:00 UTC the previous day, 08:00 Brisbane). The UTC date is the previous day and the Brisbane date is today, so the test fails, correctly. The same regression run at 15:00 Sydney time (04:00 UTC) passes.

**Fix:** Measure an instant whose zone always shows.

- Seed or create a request with a fixed `submittedDate` between 14:00 and 23:59 UTC (for example 20:30 UTC). Brisbane is always the next day for that instant.
- Assert the Brisbane label, and assert that it differs from the UTC label:

```ts
const utcLabel = await page.evaluate((iso) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso)).replace(/\s/g, ' '), instant!);
expect(expectedSubmitted, 'the instant must distinguish Brisbane from UTC').not.toBe(utcLabel);
```

- Alternatively, assert on a style that includes the time of day, as `questionnaire-governance-workflow.spec.ts:193` already does with hour and minute.

### Warnings

#### WR-401: "counts only their own work" cannot fail, and races the streamed counts

**File:** `apps/csrm/e2e/navigation-and-home.spec.ts:610-623` (`UX07_REQUESTOR_NO_ANALYST_COUNTS`)

**Issue:** Line 620 reads `a:has(.nav-count)` with `evaluateAll`, which does not wait.

- **It runs too early.** The counts stream in under Suspense after the navigation renders (D-11). The read runs straight after the Home link is visible, so it usually sees no counted link, and `[].every(...)` is `true`.
- **It cannot detect a mis-scoped count.** Even after the counts settle, the check only requires each counted link's href to be `/app/requests` or `/app/questionnaires`. A count scoped to the wrong owner sits on exactly those hrefs. The title still claims the navigation "counts only their own work".
- **What still holds.** The analyst-figure half of T-11-07 does hold: there is no Requests or Alerts link, and `navigation-counts.test.ts` proves there is no analyst read. The server-side holder scope is covered by the Strapi `request-status-summary` and `my-requests` integration tests.

**Scenario:** A regression makes `my_requests/status_summary` count every requestor's records. The Secondary Requestor's sidebar shows "My requests, 37 need your action". The href is `/app/requests`, so the test passes, with or without the race.

**Fix:**

1. In the same test, have Jane save a draft first.
2. Sign in as the Secondary Requestor, who holds no requests.
3. Wait for the counts to settle. For example, wait for the My questionnaires name to stop changing, or expose a `data-counts="settled"` marker.
4. Assert `await expect(navigation.getByRole('link', { name: navigationText('My requests') })).toHaveAccessibleName('My requests')`, which means no count is shown.

#### WR-402: "Submitted today" fails around midnight UTC

**File:** `apps/csrm/e2e/navigation-and-home.spec.ts:240`

**Issue:**

- **The cause.** `daysSinceSubmission` counts whole UTC days from the submission's UTC date to the server's UTC today (`collection-scope.ts:371-375`). Between the submit and the Home read there are several seconds of navigation.
- **The window.** A submit at 23:59:5x UTC read at 00:00:0x UTC renders "Submitted 1 day ago". For the operator, 00:00 UTC falls at 11:00 Sydney time (10:00 Brisbane), during working hours.
- **The inconsistency.** `review-lists.spec.ts:128,152` already tolerates this with `/^(0 days|1 day)$/`. This assertion does not.

**Scenario:** The full suite reaches UX08_REQUESTOR_HOME_SPLIT at 10:59:58 Brisbane time and fails with no regression.

**Fix:** `await expect(submittedItem.getByText(/ · Submitted (today|1 day ago)$/)).toBeVisible();`. Use whatever the exact one-day copy is in `requestor-home-presentation.ts:177`.

#### WR-403: The 320px reflow and badge proofs cannot see the classic-scrollbar defects, and skip most phone lists

**File:** `apps/csrm/e2e/accessibility.spec.ts:700-733` and `770-822`. Context: 82d2b20 and 601d2e3.

**Issue:** Playwright's headless Chromium hides scrollbars, so a 320px viewport always gives a 320px content box.

- **The 82d2b20 overruns.** The walk found two classic-scrollbar overruns at a 305px content box. The badge overran its card by 17px, and the page scrolled sideways by 1px. Neither can occur in this harness.
- **The 601d2e3 body minimum.** The same blind spot applies to the `body { min-width: 320px }` defect. The commit message says so, and the unit CSS guard stands in for it.
- **The 320px card sweep's coverage.** The sweep visits only My requests, the questionnaire, the released assessment, the assessment editor, the Risk register and the CSV import. The Requests queue, where the defect was found, is checked for one searched fixture card only. Alerts, both questionnaire lists and both assessment lists have no card check at any narrow width.

**Scenario:**

- A later change makes a fixed-width element 320px wide again. It scrolls every page by 15px beside a Windows classic scrollbar, and the e2e passes.
- A status badge longer than "Questionnaire in progress" overruns the questionnaire-review card. That card is never measured, so the e2e passes.
- What the e2e does catch: the original 2px overrun at a 320px viewport on the queue's long card. It would fail before the fix.

**Fix:**

1. Run the reflow pass and `expectPhoneCardsHoldTheirBadges` again at `page.setViewportSize({ width: 305, height: 568 })`, which emulates 320 minus a 15px scrollbar.
2. Add `/app/review/requests?queue=all`, `/app/review/questionnaires`, `/app/review/assessments`, `/app/questionnaires`, `/app/assessments` and `/app/alerts` to the card sweep, as the right actor.

#### WR-404: The interface copy guard's file list does not match UI-SPEC §11.2, and nothing checks that it is complete

**File:** `apps/csrm/src/lib/performance/interface-copy-guard.test.ts:63-152, 207-211`

**Issue:** UI-SPEC §11.2 makes the guard scan whole directories.

- **Missing files.** It requires `features/home/**`, `components/shell/**` and `config/navigation/**` (plus named files). The hand-written list omits:
  - `src/features/home/own-requests-panel.tsx`, a Home module with rendered copy (header comment: "plan 11-12 adds every module of features/home");
  - `src/components/shell/navigation-counts.ts`;
  - `src/components/shell/account-initials.ts`.
- **The structural gap.** The only structural test is "sorted, unique, exists". A new module in a guarded directory is never scanned unless someone remembers to list it.
- **Spelling variants.** The new term `'authorised scope'` has no US-spelling variant (`'authorized scope'`).

**Scenario:** A later edit gives `own-requests-panel.tsx` an empty state reading "Nothing in your workspace yet". The guard does not read the file, so the forbidden term ships.

**Fix:** Derive the file list from the directory globs in §11.2, keeping an explicit exclusion list (`components/shell/role-switcher.tsx`). Or add a completeness test:

```ts
const guardedDirectories = ['src/features/home', 'src/features/analyst-dashboard', 'src/features/reports', 'src/features/quick-find', 'src/components/shell', 'src/config/navigation'];
const excluded = new Set(['src/components/shell/role-switcher.tsx']);
for (const dir of guardedDirectories) for (const file of readdirSync(resolve(webRoot, dir)).filter((n) => /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n))) {
  const path = `${dir}/${file}`;
  if (!excluded.has(path)) expect(guardedFiles, path).toContain(path);
}
```

#### WR-405: The "filter is honoured" checks cannot fail when the filter is ignored

**File:**

- `apps/csrm/e2e/risk-register-workflow.spec.ts:875` (`UX09_FIGURE_FILTERS_ONLY_NARROW`)
- `apps/csrm/e2e/analyst-insights.spec.ts:893-895` (`UX09_FIGURE_CONTROL_ROW_HEADER`)

**Issue:**

- **`UX09_FIGURE_FILTERS_ONLY_NARROW`** asserts `narrowedTotal <= registerTotal` after applying `mitigationStatus=any` and `impactedSystem=none`. If Strapi ignored both filters, the totals would be equal and the test would pass. The URL and chip assertions come from the web's own reading of the URL, not from the server applying the filter.
- **`UX09_FIGURE_CONTROL_ROW_HEADER`** opens `?mitigationStatus=Existing&state=open` and only asserts that some "N results" text is visible. The full unfiltered register satisfies that. The test claims the header "opens the Risks with those mitigation controls" (D-36), but nothing checks membership or narrowing.

**Scenario:** A refactor drops `impactedSystem=none` from the register query builder, or the `Existing` mitigation predicate. Both tests stay green.

**Fix:**

- Assert `toBeLessThan(registerTotal)`. The seed holds Risks with an impacted system, so `none` must exclude some.
- Assert membership: a seeded Risk with an impacted system is absent under `impactedSystem=none`, and `RSK-DEV-MUTABLE-001` (Planned control) is absent under `mitigationStatus=Existing` while a Risk with an Existing control is present.

#### WR-406: `shownCount` treats a missing badge as zero and does not wait, so several count comparisons can pass vacuously

**File:** `apps/csrm/e2e/navigation-and-home.spec.ts:402-405`. Used at 463, 577, 582, 592-593 and 599-600.

**Issue:** `shownCount` returns 0 whenever `.nav-count` is absent at the instant of the read. It cannot tell these apart:

- a zero (no badge, by design);
- a failed or refused count read (no badge, D-11);
- a count that has not streamed in yet.

Consequences:

- **UX07_COUNTS_REFRESH_AFTER_SUBMIT (line 463)** polls for `before - 1`. When `before` is 1, a regression where the counts read fails after the submit's revalidation also yields 0 and passes. That happens on a fresh database, or with `-g` running this test alone.
- **UX07_DRAWER_COUNTS (lines 592-600)** compares the analyst's Requests and Alerts counts between the sidebar and the drawer without asserting that either is above zero. A drawer that renders no analyst counts passes whenever the sidebar also renders none. The seed has overdue alerts, so the sidebar should show a count.

**Scenario:** The analyst's counts promise starts rejecting after a refactor, which hides every badge in both places. UX07_DRAWER_COUNTS reads 0 = 0 for Requests and Alerts and passes the "drawer carries the same counts" claim.

**Fix:**

- Where a count is expected, use `navigationCount` (which requires the tag) and assert `> 0` for the analyst's overdue Alerts count.
- In UX07_COUNTS_REFRESH_AFTER_SUBMIT, save two complete drafts so that `before - 1 >= 1`, then assert the exact accessible name `My requests, ${before - 1} need…`.
- Keep `shownCount` only where a zero is genuinely expected, and give it a settled-counts wait.

#### WR-407: The 1440 first screen of both Homes is never proven, though D-57 claims both widths

**File:**

- `apps/csrm/e2e/navigation-and-home.spec.ts:97-135` (`UX08_ANALYST_PHONE_FIRST_SCREEN`)
- `apps/csrm/e2e/navigation-and-home.spec.ts:143-183` (`UX08_REQUESTOR_PHONE_FIRST_SCREEN`)

**Issue:** D-57 requires "Home per actor, at 375px and 1440px: the Requestor's first screen shows the action panel, and the analyst's shows the queue".

- **The analyst test.** The comment says it "reads the real layout boxes at the project's own width". In the desktop project (1440×900), though, the Review queue's box is measured only inside `if (width < 768)`. At 1440 it checks the tile-row count and heading order only.
- **The Requestor test.** It forces 375×812 in both projects, so 1440×900 is never measured.
- **UX08_REQUESTOR_HOME_SPLIT** checks relative positions at 1440, but not the 900px fold.

**Scenario:** A Home layout change at desktop width pushes the Review queue below 900px, for example tiles stacking one per row at xl. The heading order is unchanged, the tiles still form one row, and the test passes at 1440.

**Fix:** Drop the `width < 768` guard and assert `headingBox.y + headingBox.height <= height` at the project's own height. Add the same Needs your action fold check to UX08_REQUESTOR_HOME_SPLIT at 1440×900.

### Info

#### IN-401: The phone-card source guard sees only inline cards, and its class match is loose

**File:** `apps/csrm/src/components/csrm/data-table.test.tsx:443-499`

**Issue:**

- **Inline JSX only.** `cardRows` finds rows only when the `renderMobileCard={...}` initialiser holds the JSX inline. A card rendered through a named component (`alert-list.tsx:197`, `<AlertRow/>`) or through a forwarded prop (`assessment-list.tsx:381`) is invisible.
- **The expected file list.** It is what the walker found, so it cannot reveal such an omission. `AlertRow` wraps today, so there is no live defect.
- **The class match.** `/\bflex-wrap\b/` also accepts a responsive-only `md:flex-wrap` and `flex-wrap-reverse`.

**Fix:**

- Fail on a `renderMobileCard` whose initialiser is not an inline arrow returning JSX, unless it is listed with the component file to scan.
- Match only an unprefixed `flex-wrap` class token: `(?:^|[\s'"`])flex-wrap(?=[\s'"`])`.

#### IN-402: The walk-fix source guards cover narrower ground than the defect class

**File:** `apps/csrm/src/components/shell/mobile-navigation.test.tsx:689-696` and `699-722`

**Issue:**

- **The CSS guard (601d2e3)** reads only the first unindented `\nbody {` and `\nhtml {` rules. A `min-width` added in a combined `html, body {` rule, an `@layer base { body { … } }` block or a second `body {` rule passes.
- **The key-order guard (3117ba9)** parses only `capability-navigation.tsx`. The commit's scan of all 260 TSX modules was a one-off.

**Fix:**

- Collect every rule whose selector list contains `body` or `html` outside `@media print`, and check them all.
- Run the key-after-spread AST check over `src/**/*.tsx` and `app/**/*.tsx`.

#### IN-403: An ordering assertion passes vacuously when the capability check is never called

**File:** `apps/csrm/src/features/home/home-page.test.tsx:139`

**Issue:** `calls.indexOf('capability:assessment:review') < calls.indexOf('requestor-home')` is `-1 < n`, which is true, if the page stops calling `can('assessment:review', …)`. That happens, for example, if it reads `granted.has(...)` directly or decides from another capability. The test then no longer proves the variant is chosen from that capability before the read.

**Fix:** Add `expect(calls).toContain('capability:assessment:review')` before the comparison.

#### IN-404: A few checks are trivially true or can hang without a message

**File:**

- `apps/csrm/e2e/navigation-and-home.spec.ts:503`
- `apps/csrm/e2e/request-relationship-states.spec.ts:220`, `265`
- `apps/csrm/e2e/helpers/navigation.ts:50-52`

**Issue:**

- **Trivially true checks.** The drawer's `scrollTop === 0` is read straight after the drawer opens, and `window.scrollY === 0` straight after `goto`. Both are always 0. The real proofs are the box measurements that follow.
- **A loop that can hang.** `openFromNavigation`'s `while` loop clicks collapsed section buttons until the link shows. If a button never toggles (for example before hydration, or after a regression), it spins until the 180s test timeout, with no failure message naming the section.

**Fix:** Drop the trivial checks or re-read `scrollY` at measurement time. Bound the loop (for example three iterations) and throw `OPEN_FROM_NAVIGATION_SECTION_DID_NOT_OPEN:${name}`.

#### IN-405: Stale names left behind by the renames

**File:**

- `apps/csrm/e2e/administration-workflow.spec.ts:113`
- `apps/csrm/e2e/questionnaire-governance-workflow.spec.ts:125`

**Issue:**

- `getByRole('link', { name: 'My Requests' })` still uses the retired label. It passes only because Playwright's string name match is case-insensitive and a substring match ("My requests, 3 need your action").
- `CRITERION_1_NEXT_ACTION_IS_IN_HUB_BENEATH_STEPPER` now passes on the stepper's compact line at 375, not the hub's.

**Fix:** Use `navigationText('My requests')`, and rename the message to describe the displayed line.

#### IN-406: Two tests claim an order or completeness they do not check

**File:**

- `apps/csrm/src/components/csrm/navigation-guard.test.tsx:232-241`
- `apps/csrm/src/features/reports/figure-link-audit.test.ts:309-312`

**Issue:**

- "Leave questionnaire runs onLeave, then pushes the route" asserts both calls but not their order.
- The figure audit walks presentation functions, not rendered components. A figure added directly in a report or Home component, outside those functions, is never audited. The e2e equality tests sample only the first non-zero figure in each table.

**Fix:**

- Compare `onLeave.mock.invocationCallOrder[0]` with `push.mock.invocationCallOrder[0]`.
- Add a rendered pass, for example rendering each report view from the populated fixture and requiring every element that shows a figure to be inside a link or carry a documented exception marker.

---

_Reviewed: 2026-10-04T09:30:00Z_
_Reviewer: Claude (gsd-code-reviewer), lane 4_
_Depth: standard_
