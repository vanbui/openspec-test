---
phase: 10-existing-flow-gap-closure
reviewed: 2026-10-02T19:38:53Z
depth: standard
files_reviewed: 196
files_reviewed_list:
  - .gitignore
  - apps/backend/src/api/csrm-administration/services/administration-query.ts
  - apps/backend/src/api/csrm-administration/services/administration-repository.ts
  - apps/backend/src/api/csrm-administration/services/csv-import.ts
  - apps/backend/src/api/csrm-administration/services/served-text.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/operations.ts
  - apps/backend/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
  - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
  - apps/backend/src/bootstrap/controls/csrm-control-titles.json
  - apps/backend/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/bootstrap/seed-assessment-workflow.ts
  - apps/backend/src/bootstrap/seed-csrm-data.ts
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/backend/tests/administration.integration.test.ts
  - apps/backend/tests/administration.unit.test.ts
  - apps/backend/tests/assessment-seed.integration.test.ts
  - apps/backend/tests/assessment-workflow.integration.test.ts
  - apps/backend/tests/authorization-matrix.integration.test.ts
  - apps/backend/tests/conflict-reasons.unit.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/control-library-bounds.unit.test.ts
  - apps/backend/tests/control-titles.unit.test.ts
  - apps/backend/tests/fixtures/authorization-matrix.ts
  - apps/backend/tests/helpers/conflict-reason-fixtures.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
  - apps/backend/tests/questionnaire-generation.integration.test.ts
  - apps/backend/tests/questionnaire-generation.unit.test.ts
  - apps/backend/tests/questionnaire-governance.integration.test.ts
  - apps/backend/tests/questionnaire-governance.unit.test.ts
  - apps/backend/tests/questionnaire-workflow.integration.test.ts
  - apps/backend/tests/request-workflow.integration.test.ts
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
  - package.json
  - scripts/csrm-seed-control-files.mjs
  - scripts/verify-csrm-seed-runtime.mjs
  - scripts/verify-csrm-seed.mjs
  - apps/csrm/app/(app)/app/admin/[collection]/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/admin/[collection]/new/page.tsx
  - apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/requests/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/risks/[documentId]/page.tsx
  - apps/csrm/app/(app)/layout.tsx
  - apps/csrm/src/features/assessments/assessment-actions.ts
  - apps/csrm/src/features/assessments/assessment-detail.tsx
  - apps/csrm/src/features/assessments/assessment-domain.ts
  - apps/csrm/src/features/assessments/assessment-draft-job.tsx
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/src/features/assessments/assessment-request-link.tsx
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-service.ts
  - apps/csrm/src/features/assessments/control-implementation-editor.tsx
  - apps/csrm/src/features/assessments/control-label.ts
  - apps/csrm/src/features/assessments/owner-combobox.tsx
  - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
  - apps/csrm/src/features/assessments/release-readiness-summary.ts
  - apps/csrm/src/features/assessments/released-assessment.tsx
  - apps/csrm/src/features/assessments/released-risk-details.tsx
  - apps/csrm/src/features/assessments/risk-editor.tsx
  - apps/csrm/src/features/assessments/use-record-save-status.ts
  - apps/csrm/src/features/requests/request-actions.ts
  - apps/csrm/src/features/requests/request-context-details.tsx
  - apps/csrm/src/features/requests/request-domain.ts
  - apps/csrm/src/features/requests/request-form.tsx
  - apps/csrm/src/features/requests/request-hub.tsx
  - apps/csrm/src/features/requests/request-workflow-actions.tsx
  - apps/csrm/src/components/csrm/confirm-dialog.tsx
  - apps/csrm/src/components/csrm/detail-section.tsx
  - apps/csrm/src/components/csrm/local-time.tsx
  - apps/csrm/src/components/csrm/navigation-guard.tsx
  - apps/csrm/src/components/csrm/relation-picker.tsx
  - apps/csrm/src/components/csrm/revert-audit-summary.tsx
  - apps/csrm/src/components/csrm/save-status.tsx
  - apps/csrm/src/components/csrm/segmented-control.tsx
  - apps/csrm/src/components/shell/account-menu.tsx
  - apps/csrm/src/components/shell/app-shell.tsx
  - apps/csrm/src/components/shell/capability-navigation.tsx
  - apps/csrm/src/components/shell/wordmark.tsx
  - apps/csrm/src/components/states/states.tsx
  - apps/csrm/src/components/ui/radio-group.tsx
  - apps/csrm/src/features/administration/administration-actions.ts
  - apps/csrm/src/features/administration/administration-config.ts
  - apps/csrm/src/features/administration/administration-form.tsx
  - apps/csrm/src/features/administration/administration-schema.ts
  - apps/csrm/src/features/administration/administration-workspace.tsx
  - apps/csrm/src/features/administration/applicable-controls.ts
  - apps/csrm/src/features/administration/csv-client-parser.ts
  - apps/csrm/src/features/administration/csv-import-flow.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-actions.ts
  - apps/csrm/src/features/questionnaires/questionnaire-detail.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
  - apps/csrm/src/features/questionnaires/questionnaire-governance.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-introduction.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-placement.ts
  - apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-service.ts
  - apps/csrm/src/features/questionnaires/questionnaire-workflow-rules.ts
  - apps/csrm/src/features/questionnaires/use-answer-autosave.ts
  - apps/csrm/src/features/risks/mitigation-control-list.tsx
  - apps/csrm/src/features/risks/risk-detail-editor.tsx
  - apps/csrm/src/features/risks/risk-details.tsx
  - apps/csrm/src/features/risks/risk-register-filters.tsx
  - apps/csrm/src/features/risks/risk-schema.ts
  - apps/csrm/src/lib/api/conflict-reasons.ts
  - apps/csrm/src/lib/api/refusal-copy.ts
  - apps/csrm/src/lib/api/transport/server-client.ts
  - apps/csrm/src/lib/capabilities/analyst-review-gate.ts
  - apps/csrm/src/lib/schemas/validation-messages.ts
  - apps/csrm/src/lib/time/format-instant.ts
  - apps/csrm/src/lib/time/time-zone-actions.ts
  - apps/csrm/src/lib/time/viewer-time-zone.ts
  - apps/csrm/e2e/accessibility.spec.ts
  - apps/csrm/e2e/administration-workflow.spec.ts
  - apps/csrm/e2e/assessment-navigation-lifecycle.spec.ts
  - apps/csrm/e2e/assessment-release-workflow.spec.ts
  - apps/csrm/e2e/helpers/settle.ts
  - apps/csrm/e2e/performance.spec.ts
  - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
  - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts
  - apps/csrm/e2e/questionnaire-workflow.spec.ts
  - apps/csrm/e2e/request-relationship-states.spec.ts
  - apps/csrm/e2e/requestor-request-workflow.spec.ts
  - apps/csrm/e2e/risk-register-workflow.spec.ts
  - apps/csrm/src/components/csrm/confirm-dialog.test.tsx
  - apps/csrm/src/components/csrm/local-time.test.tsx
  - apps/csrm/src/components/csrm/navigation-guard.test.tsx
  - apps/csrm/src/components/csrm/relation-picker.test.tsx
  - apps/csrm/src/components/csrm/revert-audit-summary.test.tsx
  - apps/csrm/src/components/csrm/save-status.test.tsx
  - apps/csrm/src/components/csrm/section-composites.test.tsx
  - apps/csrm/src/components/shell/app-shell-account.test.tsx
  - apps/csrm/src/components/states/states.test.tsx
  - apps/csrm/src/components/ui/radio-group.test.tsx
  - apps/csrm/src/features/administration/administration-schema.test.ts
  - apps/csrm/src/features/administration/administration-workflow.test.tsx
  - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
  - apps/csrm/src/features/assessments/assessment-actions.test.ts
  - apps/csrm/src/features/assessments/assessment-domain.test.ts
  - apps/csrm/src/features/assessments/assessment-editor.test.tsx
  - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
  - apps/csrm/src/features/assessments/assessment-service.test.ts
  - apps/csrm/src/features/assessments/control-label.test.ts
  - apps/csrm/src/features/assessments/owner-combobox.test.tsx
  - apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx
  - apps/csrm/src/features/assessments/release-readiness-summary.test.ts
  - apps/csrm/src/features/assessments/released-assessment.test.tsx
  - apps/csrm/src/features/contract-response-parity.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-placement.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-workflow-rules.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
  - apps/csrm/src/features/questionnaires/use-answer-autosave.test.tsx
  - apps/csrm/src/features/requests/request-actions.test.ts
  - apps/csrm/src/features/requests/request-context-details.test.tsx
  - apps/csrm/src/features/requests/request-domain.test.ts
  - apps/csrm/src/features/requests/request-form.test.tsx
  - apps/csrm/src/features/requests/request-hub.test.tsx
  - apps/csrm/src/features/requests/request-workflow.test.tsx
  - apps/csrm/src/features/risks/risk-details.test.tsx
  - apps/csrm/src/features/risks/risk-register.test.tsx
  - apps/csrm/src/features/risks/risk-schema.test.ts
  - apps/csrm/src/lib/api/conflict-reasons.test.ts
  - apps/csrm/src/lib/api/refusal-copy.test.ts
  - apps/csrm/src/lib/api/transport/server-client.test.ts
  - apps/csrm/src/lib/metadata/record-route-titles.test.ts
  - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
  - apps/csrm/src/lib/security/server-only-boundary.test.ts
  - apps/csrm/src/lib/time/format-instant.test.ts
  - apps/csrm/src/lib/time/time-zone-actions.test.ts
findings:
  critical: 3
  warning: 25
  info: 28
  total: 56
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-02T19:38:53Z
**Depth:** standard
**Files Reviewed:** 196
**Status:** issues_found

## Summary

Phase 10 changed 199 files since `5ea2b77` (the post-demo baseline before any Phase 10 code, 10-CONTEXT D-49; the workflow's phase-directory diff base `130f34f` would have pulled in 575 files of v1 and quick-task work). The scope excludes the two design and contract-gap documents and the generated `schema.d.ts`. Four `gsd-code-reviewer` lanes reviewed it in parallel at standard depth, each writing its own report; this file merges them verbatim, grouped by severity (finding IDs keep their lane's hundreds: 1xx backend, 2xx web routes and assessment/request features, 3xx shared and other web features, 4xx tests). Large contract and data files were reviewed by their Phase 10 diff only.

### Lane 1: Strapi backend, its tests, the seed scripts and the API contract

This lane covers the Strapi changes, their tests, the seed and seed-verification scripts, and the contract files (`specification.json`, `served-operations.json` and both catalogue copies, read as Phase 10 diffs only).

These checks passed:
- **Catalogue copies.** The two catalogue copies are byte-identical (`cmp`).
- **No schema change (D-01).** No `content-types/*` file changes between `5ea2b77` and `HEAD`.
- **New generation-jobs read.** `GET /v1/assessment_requests/{requestId}/generation_jobs` is granted to `role.security_analyst` only. It is listed in `HUMAN_ANALYST_ONLY_OPERATIONS` and has a matrix row. Its projection never exposes `initiatingAnalystDocumentId`.
- **Conflict reasons.** Every 409 in the request, questionnaire, governance and generation workflows carries exactly one closed reason. The controllers send `details` as exactly `{ reason }`, and both conflict schemas publish the same enum.
- **Released-risk projection.** `projectAssessmentRiskListItem` never sends analyst working fields. The Requestor path stays gated on `releasedForOwner`.
- **Information System owner.** The owner projection populates and serves only `documentId` and `displayName`. The selector path a Requestor uses does not go through `projectAdministrationRecord`.

The main defect is a concurrency gap. The new `regenerated` event is written by a transaction that locks only the request row, while every governance mutation locks only the questionnaire row. So a replacement and a release or question edit running at the same time can drop events from the append-only governance log. They can also put AI questions no analyst reviewed in front of a released Requestor, which D-09 is meant to prevent.

The other problems are smaller:
- The seed reconciliation does not keep two kinds of operator edit.
- A generation that fails because of the governance log gives a generic failure that does not say why.
- The runtime seed verifier was saved with a raw NUL byte and CRLF line endings.

### Lane 2: Web routes and the assessment and request features

Lane 2 covers the nine route files and the assessment and request feature modules that Phase 10 changed (diff base `5ea2b77`). The analyst route gate (D-23) is correct: all three analyst detail routes and their `generateMetadata` await the cached `canViewerReviewAssessments()` before any record read. Raw fetch stays out of pages and components; every read goes through the typed service layer or a Server Action. The request and questionnaire "offer" predicates are zod-free domain functions that both actors use.

The main defects are state that drifts from server facts in long-lived client components:

- **The assessment editor never resyncs mitigation controls.** It seeds its mitigation-control state from props once and ignores the revalidated props. Each control editor therefore compares later saves against the values from page load. An analyst who sets a field back to its stored-at-load value is told "No changes to save." and the change is never sent (CR-201).
- **The hub's Next action goes stale after a job completes.** It drops the in-progress override when a generation job completes but never refreshes the route. The line then falls back to the served "Generate the questionnaire." / "Draft the assessment." while the card beside it says the result is ready (WR-201).
- **The generation cards have races and missing error handling.** The questionnaire card's polling can stop for good when a refreshed seed arrives while a slow poll is in flight (WR-202). A Server Action that throws leaves both generation cards stuck in their pending state (WR-203).

Smaller issues:

- The owner combobox lets Enter submit the surrounding form (WR-204).
- Assessment-draft refusals still say "This assessment changed. Reload and try again." (WR-205).
- Optional reads block the analyst editor (WR-206).
- A swallowed library read turns every saved Risk Type control into "Control not found" (WR-207).

### Lane 3: Shared components and shell, questionnaires, administration, risks and the web lib layer

I read every file in the lane in full and checked each against `git diff 5ea2b77..HEAD`. I also read the callers and callees needed to test each claim: the Strapi `projectControlImplementationControlSummary` and question-deletion code, Next's `cookies()` and `Link onNavigate` docs in `node_modules/next/dist/docs`, the development `RoleSwitcher`, `DataTable`, and the page that builds `initialControlOptions`.

These areas hold up under tracing:

- **Time-zone cookie.** It is validated on write (`syncViewerTimeZoneAction`) and on read (`readViewerTimeZone`), and again by `formatInstant`, so a forged cookie cannot raise a `RangeError`.
- **Transport conflict reason.** Only a closed-list `error.details.reason` crosses, and only on a 409. No served message reaches the UI.
- **Autosave action.** `autosaveQuestionnaireDraftAction` calls neither `revalidatePath` nor `cookies().set`.
- **Autosave hook.** Its in-flight, queued and blocked state machine serialises correctly, including two `saveNow` calls at once and a follow-up save queued during `saveNow`.
- **Back/Forward session record.** It is only written from client event paths, so the module-level `Map` stays empty during SSR (no cross-user leak, no hydration mismatch). It compares the latest-answer timestamp on both sides, which matches the backend's `projectMutation`.
- **Navigation guard.** It covers the sidebar, the mobile sheet, the wordmark, the request record link and OIDC Sign out, with `beforeunload` while armed.
- **Placement module.** It counts removed questions for both section order and question order, which matches Strapi's definition check.
- **CSV copy.** It matches UI-SPEC §17.1.
- **Radio arrow-key fix.** It avoids the double check through Radix's focus-click detection.
- **No regressions found.** No hard-coded colours, no raw `fetch`, and no `server-only` gaps were found in the lane's server modules.

The defects are in these areas:

- the record picker's failure and keyboard paths;
- one navigation control that bypasses the guard (the development role switcher);
- a new "success reported as failure" path in the mitigation editor;
- a hydration risk in `LocalInstant`;
- two focus and error-state leaks in the governance editor;
- Administration columns that still force the table wide.

### Lane 4: Web unit tests and Playwright specs

Lane 4 covered the 51 web unit test files and 12 Playwright files that Phase 10 added or changed between `5ea2b77` and `HEAD`. I read each Phase 10 diff and enough of the code under test to check the claims. I ran nothing: no tests, no dev server.

**What holds up**

- **Axe exclusions.** The policy holds. The only axe exception in the e2e tree is `withoutAcceptedPopupScroll` (`accessibility.spec.ts:864-887`). It drops only `scrollable-region-focusable`, and only on a node that is `[data-slot="popover-content"][data-state="open"]` and contains a `role="listbox"`. Every other rule and node still counts, and an APG comment explains it. No spec uses `disableRules` or `.exclude(`.
- **Live AI.** No spec depends on a live AI provider. The harness forces `CSRM_AI_PROVIDER: 'deterministic'`.
- **Operator data.** No spec writes operator data. The only new write fixture is the 26 "Picker proof" Information Systems, and they go into the run's own throwaway SQLite database.

**Main concerns**

1. **CR-401: a check that cannot fail.** The browser proof for UAT-041 ("no Generate or Replace while a job runs") puts its assertions inside `toPass`. The deterministic job always finishes, so `toPass` swallows any failure. The check can never fail, and its annotation can claim a check that passed when it did not.
2. **WR-401: a unit test that locks in a contradiction.** One hub test asserts that after the polled questionnaire job completes, the Next action line reads "Generate the questionnaire." That names an action the page no longer offers, which contradicts walkthrough fix 4.
3. **Smaller gaps.**
   - Two Playwright assertions quietly become "the attribute exists" checks if an id goes missing.
   - The width-settle helper has no loop bound.
   - A new route test has no refused-viewer case.
   - A few assertions are vacuous or claim more than they check.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-101: A questionnaire replacement is not serialised with governance mutations, so governance events can be lost and D-09 does not hold

**File:** `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts:49,57-70` (with `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts:193-216`)

**Issue:**
- **What each side locks.** `persistGeneratedQuestionnaire` takes a `FOR UPDATE` lock on the assessment request row only (`lock()`, line 49). Inside that lock it reads the questionnaire, its questions and its `governanceLog` (line 57). It then deletes the questions it read (line 69) and writes back `appendGovernanceEvent(existing.governanceLog, regenerated)` (lines 68-70). Every governance mutation goes through `runGovernanceMutation`, which locks only the questionnaire row (`lockQuestionnaire`, lines 193-216). The in-process queues are separate too: generation uses the registry's per-request `inFlight`, and governance uses `governanceMutationTails`.
- **What goes wrong.** Nothing orders a replacement against a release, a return to review, or an add, edit or delete of a question. Under READ COMMITTED, interleavings that are easy to construct give these results:
  1. **Release during replacement.** The analyst's release commits after the generation transaction has read `existing` but before its `questionnaires.update`. The generation then overwrites `governanceLog` with its stale copy, so the `released` event disappears from the append-only log. It also replaces the questions under a questionnaire whose `releasedAt` is still set. The Requestor then sees AI-generated questions no analyst reviewed, which is exactly what D-09 forbids. The comment on line 58 ("a release that landed while this job waited is seen here, under the request row lock") is wrong for this window: a release never takes the request row lock.
  2. **Question added during replacement.** A governance `addQuestionnaireQuestion` commits in the same window. Its question survives, because the delete loop only removes the ids read earlier, and it now sits among the newly generated questions. Section and order can collide, which makes the definition invalid. Its `question-added` event is also overwritten.
  3. **Governance mutation that reads before the replacement commits.** A governance mutation that read the log before the replacement committed writes its stale log afterwards. That drops the `regenerated` event.
- **Test coverage.** The test "mounted replacement job fails when the questionnaire is released while it runs" (`apps/backend/tests/questionnaire-generation.integration.test.ts:234`) releases while the provider call is held, which is before the transaction starts. It never exercises this window.

**Fix:** Take the questionnaire row lock inside the generation transaction, then read the questionnaire again under that lock. Use one lock order everywhere: request, then questionnaire. Note that `questionnaire-workflow.ts` answer saves lock the questionnaire and then update the request, so either align them to the same order or accept that the database's deadlock detection will abort one of the two transactions.
```ts
return strapi.db.transaction(async ({ trx }) => {
  await lock(strapi, requestId, trx);
  const head = await requests.findOne({ documentId: requestId, populate: { questionnaire: true } });
  const existingId = record(head?.questionnaire) && typeof head.questionnaire.documentId === "string" ? head.questionnaire.documentId : null;
  if (existingId) {
    const q = strapi.db.queryBuilder("api::csrm-questionnaire.csrm-questionnaire");
    q.select(["id"]); q.where({ documentId: existingId }); q.forUpdate(); q.transacting(trx); await q.execute();
  }
  // Read the questionnaire, its questions and governanceLog only now, under both locks.
  const current = await requests.findOne({ documentId: requestId, populate: { questionnaire: { populate: { questions: true } } } });
  ...
});
```
Then add a mounted test that commits a release between the generation's read and its write, for example by holding a hook inside the transaction rather than the provider call.

_Lane 1_

### CR-201: Mitigation-control saves compare against values from page load, so a reverted field is never saved

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:159`, `:194-199`, `:292-303`; `apps/csrm/src/features/assessments/control-implementation-editor.tsx:111`, `:135-139`

**Issue:** `AssessmentEditor` keeps `implementations` in `useState(controlImplementations)` (line 159) and updates it only on create and remove. On an edit, `onUpdated` (line 299) only calls `refreshAssessment()`, and that function (lines 194-199) updates `currentAssessment` and `risks`, never `implementations`. The revalidation that `updateControlImplementationAction` triggers sends a fresh `controlImplementations` prop, but `useState` ignores it. So each `ControlImplementationEditor` keeps receiving the `implementation` loaded with the page. Its baseline is computed from that prop on every render: `const initial = initialValues(implementation)` (line 111). The unchanged-save rule then diffs against it (line 135).

A concrete case where the analyst's change is silently not saved:

1. The control status is stored as `Planned`.
2. The analyst changes it to `Implemented` and saves. The change persists.
3. The analyst changes it back to `Planned` and saves. `changedWritableValues` compares `Planned` with the stale `Planned`, so the form shows `No changes to save.` and sends nothing.
4. Strapi still holds `Implemented`, while the form shows `Planned` and says nothing needed saving.

The same stale state also affects the released view in this session. After a release, the read-only `ReleasedRiskDetails` gets `implementations[risk.documentId]` (line 327), so a control the analyst re-pointed before releasing still shows the old `controlSummary` name.

`RiskEditor` has the same exposure whenever `refreshAssessment` fails, because that function swallows the failure (`if (!result.ok) return;`) and `risks` keeps the old values. The editor also ignores the merged risk that `RiskEditor` passes to `onUpdated` (line 289). On that same failure path, a just-created Risk never appears, because `onCreated` discards `created` and depends on the refresh.

**Fix:** Keep the editor's state in step with the last successful save, and stop ignoring the server's answer:

```tsx
// assessment-editor.tsx: update the edited implementation from the action's response
onUpdated={(updated) => {
  setImplementations((current) => ({
    ...current,
    [risk.documentId]: (current[risk.documentId] ?? []).map((item) => item.documentId === updated.documentId ? updated : item),
  }));
  void refreshAssessment();
}}

// control-implementation-editor.tsx: pass the saved record back
else { confirmation.saved(); onUpdated?.(result.data); }
```

Also resync from revalidated props: either key the editor on a server revision, or `useEffect(() => setImplementations(controlImplementations), [controlImplementations])`. Apply the same treatment to `risks` (use the `RiskEditor` `onUpdated` and `onCreated` payloads) so a failed refresh cannot leave a stale baseline. Add a unit test: change a field, save, change it back, save, and expect a second update call.

_Lane 2_

### CR-401: UX06_JOB_STATUS_ON_RETURN can never fail on the regression it names

**File:** `apps/csrm/e2e/questionnaire-generation-workflow.spec.ts:209-216`

**Issue:** The step claims that while the job is queued or running, the hub offers neither Generate nor Replace. Both negative assertions sit inside `expect(async () => { ... }).toPass({ timeout: 45_000 })`:

```ts
if (await inProgress.count() > 0) {
  observed = 'a queued or running job';
  expect(await generateAction.count(), '...no Generate questionnaire while a job runs').toBe(0);
  expect(await replaceAction.count(), '...no Replace questionnaire while a job runs').toBe(0);
}
expect(await reviewLink.count() + await replaceAction.count(), '...').toBeGreaterThan(0);
```

`toPass` retries the whole closure and discards earlier failures. Suppose the hub regresses and shows Replace next to a running job. The in-progress attempts throw, and `toPass` retries them. The card keeps polling (`questionnaire-generation-job.tsx:175-221`) and the deterministic job completes, so the next attempt takes the other branch and passes. The regression is never reported.

Worse, `observed` stays set to `'a queued or running job'`. The annotation and the `console.log` then report that the in-progress state was observed, as if the check had passed.

Separately, the deterministic provider usually finishes before `page.goto(requestUrl)` renders, so the in-progress branch is rarely reached at all. The comment admits this. The step is browser evidence for UAT-041 (D-26), and its result does not prove the claim.

**Fix:** Record what each attempt saw inside the poll, assert after it, and make the in-progress state reachable:

```ts
const violations: string[] = [];
await expect(async () => {
  if (await inProgress.count() > 0) {
    observed = 'a queued or running job';
    if (await generateAction.count() > 0) violations.push('Generate shown while a job runs');
    if (await replaceAction.count() > 0) violations.push('Replace shown while a job runs');
  }
  expect(await reviewLink.count() + await replaceAction.count()).toBeGreaterThan(0);
}).toPass({ timeout: 45_000 });
expect(violations, 'UX06_JOB_STATUS_ON_RETURN').toEqual([]);
```

Also hold the job in `running` deterministically, for example with a test-only provider delay behind the E2E attestation, and assert `observed === 'a queued or running job'`. Otherwise drop the browser claim and cite the unit tests (`analyst-route-gate.test.tsx:265-279`, `questionnaire-generation-job.test.tsx` "seeded when the analyst comes back") as the proof.

_Lane 4_

## Warnings

### WR-101: The seed reconciliation does not keep an operator's cleared description, or operator edits to the other control fields

**File:** `apps/backend/src/bootstrap/seed-csrm-data.ts:599-663` (with `CONTROL_SEED_FIELDS` at 77-86)

**Issue:**
- **Cleared descriptions come back.** `operatorDescription` treats any stored description that is not a non-blank string as "not the operator's" (line 602). The Administration update accepts `description: null` (`administration-query.ts:174`). So an operator who clears a seeded control's description gets the catalogue text back on every seeded start. The comment above it (lines 585-590) says "Any other stored description is an operator's own, and a seeded start keeps it".
- **Some fields are always overwritten.** Only `name` and `description` are reconciled. Operator edits to `controlReference`, `framework`, `frameworkVersion` and `frameworkSource`, all of which the Administration form and CSV import can write, are still overwritten on every seeded start, because `controlNeedsUpdate` compares every field in `CONTROL_SEED_FIELDS` against the seed.
- **Untested.** No test covers either case, so the claim that operator edits are kept holds only for non-empty names and descriptions.

**Fix:**
- **Description.** Decide ownership from `sourceData`, not from the stored type. A stored `null` or blank description whose stored catalogue entry would derive a non-empty description is an operator clear, so keep it:
  ```ts
  const seededEntry = storedCatalogueEntry(existingControl);
  if (stored === null || (typeof stored === "string" && stored.trim() === "")) {
    return seededEntry && controlDescription(seededEntry) !== undefined ? null : undefined; // keep the operator's clear
  }
  ```
  (Return a sentinel so that `reconciledControlSeed` writes `description: null`.)
- **Other fields.** Apply the same "seed-written equals derived-from-stored-entry" test to the remaining fields. If overwriting them is intended, say so in the comment and in `10-CONTEXT.md`, and add a test that pins the behaviour either way.

_Lane 1_

### WR-102: A replacement refused by the governance log fails with a generic code, and the discard count reads 0 on a malformed log

**File:** `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts:68`; `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts:199-209`

**Issue:**
- **No reason given.** When `appendGovernanceEvent` throws `GovernanceLogError` (a log at 1,000 entries, or an unreadable one), the error is not a `QuestionnaireGenerationJobFailure`. The registry's `safeFailure` therefore records `QUESTIONNAIRE_GENERATION_FAILED` / "Questionnaire generation failed safely." The test `mounted replacement with a full governance log fails and changes nothing` even asserts that code. The analyst is not told why, and every retry fails the same way. Every governance path maps the same condition to `HISTORY_UNAVAILABLE` (`questionnaire-governance-workflow.ts:57-68`), and D-22 asks for a named reason for generation refusals.
- **Count reads 0.** `countAnalystChangesSinceGeneration` returns `0` for a malformed log (line 205). So the replace confirmation says "No analyst changes were discarded" in exactly the case where replacement will then fail. That contradicts the function's own rule that undercounting is the worse error.

**Fix:**
```ts
let governanceLog;
try {
  governanceLog = appendGovernanceEvent(existing.governanceLog, { ... });
} catch (error) {
  if (error instanceof GovernanceLogError) throw new QuestionnaireGenerationJobFailure("HISTORY_UNAVAILABLE", "The questionnaire's history cannot record a replacement.");
  throw error;
}
```
Add a web failure copy for the new code. For the count, either return `null` (unknown) and have the confirmation say so, or have the analyst read flag that the history is unavailable.

_Lane 1_

### WR-103: `verify-csrm-seed-runtime.mjs` now contains a raw NUL byte and was converted to CRLF line endings

**File:** `scripts/verify-csrm-seed-runtime.mjs:399`

**Issue:**
- **NUL byte.** `functionKey` uses a literal U+0000 character typed into the template literal, `` `${name}<NUL>${menuPath ?? ""}` ``. `grep` and `file` now classify the script as binary (`file` reports `data`, and `grep` prints "Binary file matches"). Any later search of the verifier silently returns no lines.
- **CRLF.** The whole file was rewritten from LF to CRLF. That is why the diff shows 1,293 changed lines when the real change is about 80 (`git diff -w --ignore-cr-at-eol` shows 44 insertions and 35 deletions). Line-level history and blame are lost.

**Fix:** Use an escape instead of the raw character, `` `${name}\u0000${menuPath ?? ""}` ``, or a printable separator such as `"␟"` or `JSON.stringify([name, menuPath ?? null])`. Restore LF endings, and add `scripts/*.mjs text eol=lf` to `.gitattributes` so it cannot recur.

_Lane 1_

### WR-201: Next action reverts to a stale "Generate the questionnaire." / "Draft the assessment." once a job completes

**File:** `apps/csrm/src/features/assessments/assessment-detail.tsx:86-90`, `:119-122`; `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:357-360`; `apps/csrm/src/features/assessments/assessment-draft-job.tsx:226-229`

**Issue:** `generationNextAction` overrides the hub's Next action only while a job is `queued` or `running`. When polling sees `completed`, the override drops and `RequestHub` falls back to `analystRequestLifecycle(request).nextAction`. That value is the server-rendered lifecycle from before the job finished. Neither card calls `router.refresh()` on completion (the "before" version did not either, but Phase 10 introduced the override and its hand-back).

The server's lifecycle derives from relations (`request-lifecycle.ts:52`, `:55`). The next action therefore still reads "Generate the questionnaire." (linking to this same page) while the card says "Questionnaire generation is ready for review" and offers "Review generated questionnaire". After a draft completes it reads "Draft the assessment." beside "Open assessment draft". The relationship cards also still say "No questionnaire is linked" / "No assessment exists".

This contradicts UI-SPEC §12.3 and D-26 ("Completed jobs leave the normal next action (review, or replace)"). It also contradicts the lane's rule that the Next action and the offered actions derive from the same facts.

**Fix:** When a card reports a transition from `queued`/`running` to `completed`, refresh the route so the served lifecycle and relationships catch up:

```tsx
// assessment-detail.tsx
const router = useRouter();
const previous = useRef<{ q?: GenerationJobStatus | null; d?: GenerationJobStatus | null }>({});
const report = (key: 'q' | 'd', set: (s: GenerationJobStatus | null) => void) => (status: GenerationJobStatus | null) => {
  if (isInProgress(previous.current[key]) && status === 'completed') router.refresh();
  previous.current[key] = status;
  set(status);
};
```

Alternatively, keep an override such as "Review the generated questionnaire." while the card shows `completed` and the served relation is still `absent`.

_Lane 2_

### WR-202: Questionnaire polling can stop permanently when a refreshed seed arrives during a slow poll

**File:** `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:308-319`, `:333`, `:361-364`

**Issue:** The timer callback returns early, without re-arming, when a poll is already in flight (`if (!mountedRef.current || requestInFlightRef.current) return;`, line 333). The in-flight poll's `finally` re-arms only if `activeJobIdRef.current === followedJobId` (line 363). The following sequence stops polling for good:

1. A poll for job A is in flight.
2. Revalidation (for example, from another Server Action on the page) delivers a seed for job B. The seed effect sets `activeJobIdRef.current = B` and `setJob(B)`, and the polling effect arms a new 1 s timer.
3. If the job-A poll takes more than 1 s, the new timer fires while it is still in flight and returns without re-arming.
4. Job A's poll then resolves. `then` exits because `activeJobIdRef.current !== polledJobId`, and `finally` skips `setPollCycle` because `followedJobId` (A) is not B.

No timer remains and `timedOut` is never set, so the card shows "running" indefinitely and never offers "Check again".

The draft card avoids the stall by always bumping `pollCycle` in `finally`. But its seed effect resets `requestInFlightRef.current = false` while an old poll may still be in flight (`assessment-draft-job.tsx:181`), which allows overlapping polls whose `finally` clears each other's flag.

**Fix:** Never drop a tick silently. Either re-arm when the timer finds a poll in flight, or always bump the cycle in `finally` when mounted:

```ts
}).finally(() => {
  requestInFlightRef.current = false;
  if (mountedRef.current) setPollCycle((current) => current + 1); // the effect re-reads the current job
});
```

In the draft card, track in-flight state by job id (for example `inFlightJobIdRef`) instead of resetting a shared boolean.

_Lane 2_

### WR-203: A thrown generation Server Action leaves the card stuck pending, and poll rejections go unhandled

**File:** `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:375-384`, `:406-415`, `:336`; `apps/csrm/src/features/assessments/assessment-draft-job.tsx:239-249`, `:264-273`, `:207`

**Issue:** `start()` and `retry()` set `requestInFlightRef.current = true` and `setPending(true)`, then `await` the Server Action with no `try/finally`. Server Action calls reject on a network failure, a deploy-time action-id mismatch or a server crash. When that happens, `requestInFlightRef` stays `true` and `pending` stays `true`. The button is then permanently disabled as "Starting questionnaire generation…" or "Retrying draft generation…".

Every later `start()` returns `false` at the guard, so `confirmReplacement` throws "Questionnaire replacement did not start" with no message shown in the dialog. Every later poll tick also skips (line 333). The poll chains (`void pollJob(...).then(...).finally(...)`) have no `catch`, so a rejected poll becomes an unhandled promise rejection and the card shows no "Status unavailable".

**Fix:**

```ts
let result;
try {
  result = await startQuestionnaireGenerationAction({ requestId, replaceUnansweredQuestionnaire });
} catch {
  result = { ok: false as const, formError: 'Questionnaire generation couldn’t start. Try again.' };
} finally {
  requestInFlightRef.current = false;
}
```

Apply the same to `retry()` and the draft card. Add `.catch(() => ({ ok: false, formError: '…' }))` to `pollJob` so a rejected poll reads as "Status unavailable".

_Lane 2_

### WR-204: `OwnerCombobox` lets Enter submit the surrounding form when the query is empty

**File:** `apps/csrm/src/features/assessments/owner-combobox.tsx:213-220`

**Issue:** Enter is prevented only when an option is active, or when `query.trim()` is non-empty. In an empty owner field, Enter therefore performs the browser's implicit submit of the enclosing form: `Save risk`, `Add risk`, `Save mitigation control` or `Add mitigation control`. Phase 10 made `OwnerCombobox` the control-owner field in both editors (UI-SPEC §13.2). The record-picker contract it generalises says "Enter never submits the surrounding form" (UI-SPEC §13.1 and X-2). The sibling `RelationMultiSelect` in the same file always prevents Enter (line 106).

**Fix:**

```ts
if (event.key === 'Enter') {
  event.preventDefault();
  const chosen = activeOwner ?? (query.trim() ? results[0] : undefined);
  if (chosen) choose(chosen);
}
```

_Lane 2_

### WR-205: Assessment-draft and generation refusals still use the misleading "changed, reload" copy and the wrong nouns

**File:** `apps/csrm/src/features/assessments/assessment-actions.ts:138-152`, `:158-161`, `:188`, `:214`

**Issue:** `startAssessmentDraftAction` and `retryAssessmentDraftJobAction` map every 409 through `serviceFailure` to "This assessment changed. Reload and try again." These 409s mean the questionnaire is not submitted, or an assessment already exists for the request. The first case refuses before any assessment exists, so nothing "changed" and reloading does not help. That is exactly the UAT-036 pattern D-22 removes: "an unknown code falls back to a generic message that never says 'changed, reload' unless that is the reason".

`generationFailure` sends every non-409 questionnaire-generation failure through the same `serviceFailure`. A refused or missing request therefore reads "You do not have permission to change this assessment." / "This assessment is no longer available." for an operation on a request that has no assessment.

**Fix:** Add a draft-generation family to `refusal-copy.ts`, keyed on the served reasons (`QUESTIONNAIRE_NOT_SUBMITTED`, `ASSESSMENT_STARTED`). Give it a fallback such as "An assessment draft can't be generated for this questionnaire in its current state.", and route both draft actions through it. Give `generationFailure` request-level wording for 403 and 404 ("You do not have permission to generate a questionnaire for this request." / "This request is no longer available.").

_Lane 2_

### WR-206: Optional suggestion and label reads block the whole analyst editor

**File:** `apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx:53-60`

**Issue:** The originating-request read (`getRequest`) only feeds the "On this request" suggestions (D-30). The new `listAssessmentRisks` parser feeds relation labels and the read-only view. Both still sit in `results`, and any error in them renders `<AssessmentEditor state="error" />` (or `permission`) for an assessment the analyst could otherwise edit. A transient request-read failure, or a contract mismatch in the new `AssessmentRiskListResponse` parser, therefore takes down the editor.

The Risk Register page treats the same request read as optional and degrades to search-only (`risks/[documentId]/page.tsx:20-36`, research Open Question 2). The two editors D-28 says share one picker therefore fail differently on the same fact.

**Fix:** Keep only `listRiskTypes` (and `listAssessmentRisks` when `!mutable`, where the released view needs it) as blocking. Treat the request read as optional:

```ts
const requestSelections = requestResult && !requestResult.error ? requestResult.data : undefined;
const blocking = [riskTypesResult, ...(!mutable ? [riskListResult] : [])];
if (blocking.some((r) => r.error?.status === 403)) return <AssessmentEditor state="permission" />;
if (blocking.some((r) => r.error)) return <AssessmentEditor state="error" />;
```

_Lane 2_

### WR-207: A failed control-library read on the Risk Type form shows every saved control as "Control not found"

**File:** `apps/csrm/app/(app)/app/admin/[collection]/[documentId]/page.tsx:59-65`

**Issue:** `listControls()` runs beside `getRiskType()`, but its error is never checked: `applicableControlOptions(controls.data ?? [], …)`. When the library read fails, no saved selection gets a label. `AdministrationForm` then renders each saved applicable control as `Control not found` (`administration-form.tsx:281`, the D-36 wording for a control deleted from the library). An administrator who sees that will reasonably untick "dead" controls and save, which removes valid applicable controls from the Risk Type. That in turn removes them from the analyst's suggested group (D-31).

The page also still loads the whole 2,646-control library on every Risk Type edit, the load D-28 set out to remove from pickers.

**Fix:** Treat a failed library read as an error state (`if (controls.error) return <AdministrationUnavailableState error />;`). Better still, label the saved ids through a bounded hydrate or search read, so the page no longer needs the whole library.

_Lane 2_

### WR-301: A rejected record-picker search leaves the picker stuck on "Searching…" with no retry

**File:** `apps/csrm/src/components/csrm/relation-picker.tsx:100-114` (also `:116-129`)
**Issue:** `runSearch` awaits `searchRef.current({ search: term })` without `try`/`catch`. Every caller passes a Server Action:

- `searchControlsAction`
- the system and asset searches, through `assessment-editor.tsx` and `risk-detail-editor.tsx`

A Server Action rejects when the network drops, the deployment changes underneath it, or the server returns a non-action response. When that happens:

- the promise rejects unhandled;
- `isLoading` stays `true`, so the status line reads `Searching controls…` forever;
- `error` is never set, so the UI-SPEC §13.1 `Retry search` affordance never appears.

The only way out is to type again.
**Fix:**
```tsx
const runSearch = useCallback(async (term: string) => {
  const request = ++sequence.current;
  setIsLoading(true);
  setError(null);
  let result: RelationPickerSearchResult;
  try {
    result = await searchRef.current({ search: term });
  } catch {
    result = { ok: false, formError: 'Search is unavailable. Try again.' };
  }
  if (request !== sequence.current) return;
  setIsLoading(false);
  if (!result.ok) { setResults([]); setError(result.formError); return; }
  setResults(result.data);
}, []);
```

_Lane 3_

### WR-302: "Retry search" cannot be reached from the keyboard

**File:** `apps/csrm/src/components/csrm/relation-picker.tsx:250`, `:292-297`
**Issue:** Focus stays in the input by design: the options use `aria-activedescendant` and `onOpenAutoFocus` is prevented. The `Retry search` button sits inside the portalled `PopoverContent`.

The only key that leaves the input is Tab, and `onKeyDown` runs `setIsOpen(false)` on Tab, which unmounts the popover and the button with it. A keyboard or switch user who gets a search error can see the alert announced, but cannot activate the recovery control it offers (WCAG 2.1.1).
**Fix:** Give retry a keyboard path from the input. For example, when `error` is set, Enter retries:

```tsx
if (event.key === 'Enter') {
  event.preventDefault();
  if (error && term) { void runSearch(term); return; }
  const chosen = isOpen ? active ?? options[0] : undefined;
  if (chosen) choose(chosen);
}
```

Then say so in the alert ("Press Enter to retry"). Alternatively, render the retry button outside the popover, after the input in DOM order, so Tab reaches it.

_Lane 3_

### WR-303: The combobox does not expose the record already chosen

**File:** `apps/csrm/src/components/csrm/relation-picker.tsx:173`, `:300-305`
**Issue:** `choose()` clears `query`, so once a value is set the input is empty. The `Selected {noun}: {name}` line is not referenced by `aria-describedby` (`describedBy` lists only the hint and the error).

A screen-reader user tabbing through the Risk editor or the mitigation form hears "Information system impacted, combobox, Search by name…". Nothing says a system is already set. Clearing or replacing it is therefore blind, and the edit forms open pre-filled from the served relation (`risk-detail-editor.tsx:179-182`, `mitigation-control-list.tsx:194-196`).
**Fix:** Give the selected line an id and include it in the description while a value is set. The accessible name stays the label, as the spec requires.

```tsx
const selectedId = useId();
const describedBy = [hint ? hintId : null, value ? selectedId : null, invalid && errorId ? errorId : null]
  .filter(Boolean).join(' ') || undefined;
// …
<span className="min-w-0 break-words" id={selectedId}>Selected {noun}: {value.name}</span>
```

_Lane 3_

### WR-304: `LocalInstant` server and client output can differ, causing a hydration mismatch on every page with a time

**File:** `apps/csrm/src/components/csrm/local-time.tsx:31-33`; `apps/csrm/src/lib/time/format-instant.ts:51`
**Issue:** The zone is shared between server and client, but the text is produced twice by two different ICU builds: Node's at SSR and the browser's at hydration.

The `en-AU` patterns depend on the CLDR version:

- `Sep` vs `Sept`;
- the space before `am`/`pm`, including U+202F narrow no-break space in newer CLDR;
- `dateStyle: 'long'` wording.

Safari and Firefox ship their own ICU and CLDR versions. When the strings differ, React 19 raises a hydration error and client-renders from the nearest Suspense boundary. On the shell, that means the whole page.

`LocalInstant` now renders in the save status, the revert summary, the revision timeline and other Phase 10 surfaces. The component does not guard against this, and the zone itself is not the source of the difference.
**Fix:** Mark the inner text as a known server/client difference, keeping the machine-readable `dateTime`:
```tsx
return value && text !== null
  ? <time dateTime={value} suppressHydrationWarning>{text}</time>
  : <>{fallback}</>;
```
`suppressHydrationWarning` covers one level of text, which is exactly this node. Add a browser test that renders a fixed instant in WebKit and Firefox and compares the result with the Node output.

_Lane 3_

### WR-305: The development role switcher bypasses the leave guard and loses or misroutes unsaved answers

**File:** `apps/csrm/src/components/shell/app-shell.tsx:22`, `:34`, `:38` (renders `RoleSwitcher` inside `NavigationGuardProvider`); `apps/csrm/src/components/csrm/navigation-guard.tsx:21-33`
**Issue:** In development and E2E mode, `RoleSwitcher` (in the sidebar footer and in the mobile sheet) is the identity control. Changing it runs `setDevelopmentRole`, which writes the role cookie and calls `revalidatePath('/app', 'layout')`. That re-renders the questionnaire page under the new identity, with no consultation of the guard.

If a change is waiting, the renderer either:

- unmounts into the permission state, and its unmount flush (`use-answer-autosave.ts:210-213`) sends the Requestor's waiting answers under the new identity, which fails with 403 and loses them silently; or
- stays mounted and autosaves under the wrong identity.

The focus requirement asked for the guard to cover "every in-app navigation control in both auth modes". This is the one control in development mode that the guard does not see.
**Fix:** Have `RoleSwitcher` consult the guard the way `AccountMenu` does: `const guard = useNavigationGuard();`. In `onChange`, while `guard.blocking`, restore the select to `role`. Then call `guard.guardLink({ preventDefault() {} }, { trigger: event.currentTarget, onLeave: () => startTransition(() => setDevelopmentRole(data)) })`, and dispatch only from `onLeave`.

_Lane 3_

### WR-306: A mitigation-control save that succeeded is reported as "not changed", and Save again creates a duplicate

**File:** `apps/csrm/src/features/risks/mitigation-control-list.tsx:83-88`, `:248-252`
**Issue:** This is new in Phase 10 (the old `mergeImplementation` always returned a card). `mergeImplementation` now returns `null` when `result.controlSummary` is null and the control did not change. In create mode there is no `current`, so a null summary always means `null`. The editor then shows `Mitigation control not changed` / `The selected control is no longer available…`, but the server has already created or updated the record.

Strapi returns a null summary whenever any of `documentId`, `controlNumber`, `name` or `framework` is empty or longer than 255 characters (`assessment-scope.ts:423-431`). The form stays open with its values. In create mode, pressing `Save mitigation control` again posts a second `createMitigationControlAction` for the same control. The result is a duplicate implementation, and the list never shows the first one until reload.
**Fix:** Do not report a completed write as a failure. Name the card from the client's own selection when the response cannot:
```ts
function mergeImplementation(current, values, result, chosen: RelationPickerItem | null): Mitigation {
  const summary = result.controlSummary;
  const control = summary
    ? { documentId: summary.documentId, controlNumber: summary.controlNumber, name: summary.name }
    : current?.control.documentId === values.control
      ? current.control
      : { documentId: values.control, controlNumber: chosen?.name ?? values.control, name: '' };
  …
}
```
Then call `onChanged(merged)` unconditionally. If an unnamed control must still be flagged, show the §13.5 sentence as a non-blocking note on the saved card, not as a form failure.

_Lane 3_

### WR-307: A stale `openForm` lets the governance editor pull focus to "Add question" on later renders

**File:** `apps/csrm/src/features/questionnaires/questionnaire-governance.tsx:166`, `:195-206`
**Issue:** If the question being edited disappears after a reload, `activeForm` becomes `null` but `openForm` is never cleared. The effect has no dependency list, so it runs after every render. While `openForm && !activeForm` holds, it focuses `EDITOR_ADD` whenever `document.activeElement` is `body`.

From then on, any render moves focus to `Add question` without the analyst asking. For example, the analyst clicks blank page space (focus moves to `body`) and then a refresh, an announcement or a timeline update renders the component. The condition stays true until another form is opened.
**Fix:** Clear the stale form once its focus fallback has landed:
```tsx
} else if (openForm && !activeForm) {
  if (document.activeElement === null || document.activeElement === document.body) control(EDITOR_ADD)?.focus();
  setOpenForm(null);
}
```
Alternatively, clear `openForm` in the render-time check that computes `activeForm`, using the "adjust state while rendering" pattern the renderer already uses.

_Lane 3_

### WR-308: Release and Return-to-review errors persist after dismissal and are announced twice

**File:** `apps/csrm/src/features/questionnaires/questionnaire-governance.tsx:229-230`, `:291`, `:295`, `:332`
**Issue:** `editorError` is set on a refused release or return. It is never cleared: not on dismiss, not on success (`router.refresh()` keeps the component mounted), and not when the dialog is reopened.

Two problems follow:

- The same message renders twice: in the panel (`role="alert"`, line 291) and inside the open dialog (`errorMessage`, also `role="alert"`). It is announced twice.
- If the analyst cancels, fixes the questions and opens `Release questionnaire` again, the dialog opens already showing the previous refusal. A successful release also leaves the old alert in the panel.

Phase 10 added `onDismiss={() => setDeleteError(null)}` for Delete but did not apply the same rule here.
**Fix:**
```tsx
<ConfirmDialog … errorMessage={editorError} onDismiss={() => setEditorError(null)} onConfirm={release} … />
// and in release()/returnToReview(): setEditorError(null) before router.refresh()
```
Show the panel alert only when no dialog is open, or drop it, since D-06 says the dialogs carry their own errors.

_Lane 3_

### WR-309: Administration list columns still force the table wide with unbounded long text

**File:** `apps/csrm/src/features/administration/administration-workspace.tsx:214-215`, `:229`, `:232`, `:234-235`, `:243`, `:246`
**Issue:** Phase 10 added `wrap: true` to the control Name and Framework columns and the Risk Type Description column. The comment states the goal: "a long title never pushes Type and Reference out of view". Other columns holding equally long or longer free text stay on `TableCell`'s default `whitespace-nowrap`:

| Column | Line | Bound |
|---|---|---|
| Controls `Reference` | 229 | up to 500 characters |
| Information Asset `Location` | 246 | up to 500 characters |
| `Name` on Risk Types, Systems and Assets | 214, 232, 243 | 255 characters |
| New `Owner` and `Business criticality` | 234-235 | 255 characters each |

A single long Reference or Location stretches its column across the viewport and pushes every later column out of view. The Systems list now has two more nowrap text columns placed straight after Name, so it is the most exposed.
**Fix:** Mark every free-text column as long text, with the same clamp:
```tsx
{ accessorKey: 'controlReference', header: 'Reference', wrap: true, cell: (value) => <span className="line-clamp-2">{String(value ?? 'Not provided')}</span> },
{ accessorKey: 'location', header: 'Location', wrap: true, cell: (value) => <span className="line-clamp-2">{String(value ?? 'Not provided')}</span> },
{ accessorKey: 'ownerName', header: 'Owner', wrap: true, cell: (_v, r) => <span className="line-clamp-2">{systemOwnerLabel(r)}</span> },
{ accessorKey: 'businessCriticality', header: 'Business criticality', wrap: true, cell: (_v, r) => <span className="line-clamp-2">{systemCriticalityLabel(r)}</span> },
```
Apply `wrap: true` with a clamped `RecordLink` to the three `Name` columns. Extend the existing backstop (UI-SPEC §18 "overflow / Administration controls list") to the Systems and Assets lists.

_Lane 3_

### WR-401: A hub unit test locks in a Next action that names a control the page no longer offers

**File:** `apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx:926-936` (behaviour in `apps/csrm/src/features/assessments/assessment-detail.tsx:86-90, 119-122`)

**Issue:** The test seeds a running questionnaire job and lets the poll return `completed`. It then asserts that the Next action line reads `Next action: Generate the questionnaire.` and links to it.

Once the job completes, the card shows "Questionnaire generation is ready for review" and a "Review generated questionnaire" link. It renders no Generate button (`questionnaire-generation-job.tsx:307, 320, 336`), and nothing calls `router.refresh()`.

So the hub tells the analyst to generate a questionnaire that was just generated, and links to an action the page does not offer. That is exactly what walkthrough fix 4 and `analystRequestLifecycle` (`request-domain.test.ts:1-10`) forbid: "a Next action line never names an action the page does not offer". The test turns the contradiction into a requirement.

**Fix:** On `completed`, either refresh the route (`router.refresh()` from the card's `onJobStatusChange`) so the served lifecycle moves on, or override the line, for example: "Review the generated questionnaire." Then change the test to expect that, and to expect no link named "Generate the questionnaire.".

_Lane 4_

### WR-402: Two attribute assertions quietly become presence checks when an id is missing

**File:** `apps/csrm/e2e/accessibility.spec.ts:771`, `apps/csrm/e2e/accessibility.spec.ts:929`

**Issue:** Two lines pass a possibly null id with a non-null assertion:

- `toHaveAttribute('aria-controls', (await popup.getByRole('listbox').getAttribute('id'))!)`
- `toHaveAttribute('aria-activedescendant', (await last.getAttribute('id'))!)`

If the listbox or option has no `id`, `getAttribute` returns `null`. In the installed Playwright 1.58.2 (`playwright/lib/matchers/matchers.js:172-183`), `toHaveAttribute(name, expected)` treats an `expected` with `typeof === 'object'` (which includes `null`) as the options bag. It then only checks that the attribute exists.

So "the combobox controls the open listbox" passes for any `aria-controls` value, and so does "ArrowDown makes the last option active". The pickers set ids today (`relation-picker.tsx:275`, `owner-combobox.tsx:114, 243`), so the gap is latent, but the TypeScript `!` hides it.

**Fix:**

```ts
const listboxId = await popup.getByRole('listbox').getAttribute('id');
expect(listboxId, `${label}: the listbox has an id`).toBeTruthy();
await expect(combobox).toHaveAttribute('aria-controls', listboxId as string);
```

Apply the same pattern to the last option's id before the `aria-activedescendant` check.

_Lane 4_

### WR-403: `settleElementWidth` has no loop bound, so an oscillating layout hangs until the test timeout

**File:** `apps/csrm/e2e/helpers/settle.ts:34-45`

**Issue:** The loop `for (let stable = 0; stable < 3;)` exits only after three identical readings in a row. Its callers measure the `[data-overflow]` scroller, whose attribute is set by a ResizeObserver and drives the "scrolls horizontally" region and scrollbar styling. If that feedback loop ever toggles `clientWidth` back and forth, the `evaluate` never resolves.

The test then dies at the 180 s budget (or 600 s in `accessibility.spec.ts`) with a generic timeout. There is no message saying the layout never settled. This is the flakiness the helper was added to fix, turned into a hang.

**Fix:** Cap the frames and report what was seen:

```ts
await element.evaluate(async (node) => {
  const read = () => `${node.scrollWidth}x${node.clientWidth}`;
  let previous = read();
  for (let stable = 0, frames = 0; stable < 3; frames += 1) {
    if (frames > 120) throw new Error(`WIDTH_NEVER_SETTLED:${previous}`);
    await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    const current = read();
    stable = current === previous ? stable + 1 : 0;
    previous = current;
  }
});
```

_Lane 4_

### WR-404: The new Risk detail route tests have no refused-viewer case for their new reads

**File:** `apps/csrm/src/features/risks/risk-details.test.tsx:630-692` (route `apps/csrm/app/(app)/app/risks/[documentId]/page.tsx:26-60`)

**Issue:** Phase 10 made the Risk detail route call `getAnalystAssessment` and `getRequest` in addition to `getRiskDetail`, and added route-level tests for it. Every one of those tests runs with `granted = {'risk:manage','assessment:review'}`.

No test checks either of these:

- A viewer without `risk:manage` gets `state="permission"` and none of `getRiskDetail`, `getAnalystAssessment` or `getRequest` runs.
- A `getRiskDetail` 403 or 404 triggers no assessment or request read.

The sibling analyst routes have exactly this kind of negative test (`analyst-route-gate.test.tsx` `expectNoRecordRead`). Here a regression that moved `readRequestSelections` ahead of the gate would go unnoticed.

**Fix:** Add a Requestor case to the describe:

```ts
it('refuses a viewer without risk:manage before any read', async () => {
  pageMocks.granted.mockResolvedValue(new Set(['assessment-request:read', 'assessment-request:create']));
  const element = await RiskDetailsContent(routeProps()) as ReactElement<React.ComponentProps<typeof RiskDetails>>;
  expect(element.props.state).toBe('permission');
  for (const read of [pageMocks.getRiskDetail, pageMocks.getAnalystAssessment, pageMocks.getRequest]) expect(read).not.toHaveBeenCalled();
});
```

Add a matching case for `getRiskDetail` returning 403.

_Lane 4_

### WR-405: An `every()` over a possibly empty list makes "the existing Risk shows no confirmation" vacuous

**File:** `apps/csrm/src/features/assessments/assessment-editor.test.tsx:987`

**Issue:** The assertion is:

```ts
expect(within(document.getElementById('risk-risk-1')!).getAllByRole('status').every((region) => region.textContent === '')).toBe(true)
```

`getAllByRole` throws when it finds nothing, so this looks guarded. But it searches the whole card, so any other polite region in the card satisfies it. If the Risk form's own save-status region were removed or moved outside `#risk-risk-1`, the check would still pass on whatever status region is left, or on a single empty one. The test should prove that the Risk's own save confirmation is empty. Instead it proves only that every status region is empty, which says nothing about where those regions are.

**Fix:** Target the Save risk action row, as the neighbouring tests do:

```ts
const existingSave = within(document.getElementById('risk-risk-1')!).getByRole('button', { name: 'Save risk' });
expect(within(actionRow(existingSave)).getByRole('status')).toBeEmptyDOMElement();
```

_Lane 4_

### WR-406: "Each Risk row says what is missing" checks only the first row

**File:** `apps/csrm/e2e/assessment-release-workflow.spec.ts:212`

**Issue:** The line is:

```ts
await expect(readinessRequirements.getByText(/^Missing: /).first(), 'ASSESS06_READINESS_BY_RISK each Risk row says what is missing').toBeVisible();
```

It passes if just one of the three or more outstanding Risk rows has a caption. The message claims every row. A regression that drops the caption, or its `aria-describedby`, from all rows but one would pass.

**Fix:** Check the count and the accessible description of every row:

```ts
const rows = await outstandingRiskLinks.all();
for (const row of rows) await expect(row).toHaveAccessibleDescription(/^Missing: /);
await expect(readinessRequirements.getByText(/^Missing: /)).toHaveCount(rows.length);
```

_Lane 4_

## Info

### IN-101: `canRetry` means "initiated by this viewer", not "may retry"

**File:** `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts:51`; `apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts:250`

**Issue:** `canRetry` is `true` for the initiator whatever the job's status. The registries' `retry` refuses anything that is not `failed` with a 409, so a queued, running or completed job reads `canRetry: true` even though a retry would be refused. The specification describes it as "Whether the viewing analyst may retry the job". The web relies on the initiator meaning: `questionnaire-generation-job.tsx:308` shows "started by another analyst" when it is `false` on a running job.

**Fix:** Either rename or document the field as the initiator fact (for example `startedByViewer`), or compute `canRetry = initiator && job.status === "failed" && !active` and add a separate initiator flag for the web.

_Lane 1_

### IN-102: The title file's strict checks can stop a seeded Strapi start, contrary to its comment

**File:** `apps/backend/src/bootstrap/seed-csrm-data.ts:240-244,415-428,491`

**Issue:** The comment says "a later catalogue update cannot stop Strapi from starting". But `parseControlTitleFile` throws in two cases, and the throw aborts `seedCsrmData` during bootstrap:
- a catalogue update removes a titled control id ("titles X, which … does not contain");
- a catalogue update starts labelling a control that the title file titles ("… already labels").

**Fix:** Either correct the comment (these are fail-fast checks), or log and skip the stale entries at runtime and leave the strictness to `control-titles.unit.test.ts`.

_Lane 1_

### IN-103: The seed verifiers no longer check the catalogue list independently

**File:** `scripts/csrm-seed-control-files.mjs:16-19`; `scripts/verify-csrm-seed.mjs:11-13`

**Issue:** The fixed 12-file manifest was replaced by a regex that extracts `CONTROL_CATALOGUE_FILES` from the seed's source text. The verifier now checks the seed against itself, so a catalogue added or removed by mistake is caught only by the 2,646 count. Reformatting the declaration, for example a trailing comment or a different quote style, also breaks both verifiers.

**Fix:** Export the lists from a small JSON manifest that both the seed and the verifiers import, and keep an expected file count in the verifier.

_Lane 1_

### IN-104: The control text bounds are declared in four places

**File:** `apps/backend/src/api/csrm-administration/services/administration-query.ts:173-185,245-253`; `apps/backend/src/api/csrm-administration/services/csv-import.ts:202`; `apps/backend/src/bootstrap/seed-csrm-data.ts:33`

**Issue:** These must all match `ControlsAdministrationRecord` in the specification, and nothing ties them together except `control-library-bounds.unit.test.ts`, which covers only seeded values:
- the write bounds (`parseAdministrationMutation`);
- the read bounds (`CONTROL_RECORD_TEXT_BOUNDS`);
- the CSV change bound (`CSV_CHANGE_VALUE_MAX_LENGTH`);
- the seed's `CONTROL_DESCRIPTION_MAX_LENGTH`.

**Fix:** Derive the write and read bounds from one exported table, and add a unit test comparing that table with the specification schema.

_Lane 1_

### IN-105: The D-09 race test claims more than it proves

**File:** `apps/backend/tests/questionnaire-generation.integration.test.ts:229-252`

**Issue:** The comment says the test proves the race "under the request row lock". The release actually commits while the provider call is held, before the transaction opens, so the test proves only the before-transaction check (see CR-101).

**Fix:** Reword the comment, and add a test that injects the release inside the transaction window once CR-101 is fixed.

_Lane 1_

### IN-201: The "released" hint is shown for questionnaires that are not released

**File:** `apps/csrm/src/features/requests/request-domain.ts:154-157`; `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:448`, `:481`

**Issue:** `questionnaireGenerationAction` returns `'released'` for every non-`analyst-review` relation: `unavailable`, `submitted`, or a served `state: null`. The card then always says "This questionnaire has been released to the Requestor. To replace it, return … to analyst review first." For an unavailable or state-less questionnaire, that states something the page does not know.

**Fix:** Return a distinct value (for example `'unavailable'`) for the non-`released` cases and show a neutral line, such as "A questionnaire already exists for this request."

_Lane 2_

### IN-202: `releaseReadinessPresentation` still builds an em-dash label that nothing reads

**File:** `apps/csrm/src/features/assessments/assessment-domain.ts:112-120`

**Issue:** The only caller (`release-readiness-summary.ts:42`) uses `href` alone. The unused `label` still builds `Risk N — label`, which uses the em dash D-38 and D-43 replace.

**Fix:** Reduce the function to `releaseReadinessHref(requirement): string`, or switch the label to the X-4 middle dot.

_Lane 2_

### IN-203: The focus-after-transition flag can fire on a later, unrelated status change

**File:** `apps/csrm/src/features/requests/request-workflow-actions.tsx:39`, `:46-53`

**Issue:** `transitioned.current` is cleared only when `status` changes. If the refresh after a submit or revert returns the same status (for example, a concurrent change by the other actor), the flag stays `true`. Focus then jumps on some later status change.

**Fix:** Clear the flag after the refresh settles: wrap the refresh in `startTransition` and reset the flag in an effect keyed on the request object, not only on `status`.

_Lane 2_

### IN-204: Unknown third-party involvement reads as "No"

**File:** `apps/csrm/src/features/requests/request-context-details.tsx:164`

**Issue:** `thirdPartyInvolvement` is optional on `CsrmAssessmentRequest`. When it is `undefined`, the read-only context says `No` instead of `Not provided`, unlike every other row in the component.

**Fix:** `{request.thirdPartyInvolvement === undefined ? notProvided : request.thirdPartyInvolvement ? 'Yes' : 'No'}`.

_Lane 2_

### IN-205: The readiness summary groups Risks by display number instead of identity

**File:** `apps/csrm/src/features/assessments/release-readiness-summary.ts:48-55`

**Issue:** Groups are keyed on `riskNumber`. Two Risks that share a number (Strapi only checks that it is a non-empty string of 100 characters or fewer) would merge into one row, with the first Risk's `href` and the combined counts.

**Fix:** Key the map on `requirement.destination` (`risk-{documentId}`), which is unique per Risk, and keep `riskNumber` for display.

_Lane 2_

### IN-206: The analyst's read-only details show the raw ISO date

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:471`

**Issue:** For an immutable assessment, `DetailValue label="Next review date" value={assessment.nextReviewDate}` renders `2026-10-01`. The Requestor's released view renders the same field with `formatCalendarDate` (`1 October 2026`), against D-34's intent that the released view reads alike for both actors.

**Fix:** `value={assessment.nextReviewDate ? formatCalendarDate(assessment.nextReviewDate) : null}`.

_Lane 2_

### IN-207: "Return to draft" is offered beside "Questionnaire generation is in progress"

**File:** `apps/csrm/src/features/assessments/assessment-detail.tsx:131`

**Issue:** `canRevertRequestToDraft` reads only the relations. While a seeded questionnaire job is queued or running, the questionnaire relation is still `absent`. The hub therefore says generation is in progress and, in the same view, offers to return the request to draft, which makes the job fail with `REQUEST_NOT_ELIGIBLE`. Strapi permits it, so this is not an authorisation issue, but the offered actions and the Next action disagree.

**Fix:** Hide or caveat the revert while `nextActionOverride` reports a questionnaire job in progress. Alternatively, mention in the dialog that a running generation will stop.

_Lane 2_

### IN-301: The picker reports `aria-expanded="true"` while no listbox exists

**File:** `apps/csrm/src/components/csrm/relation-picker.tsx:216-218`, `:274`
**Issue:** `aria-expanded={isOpen}` is true whenever the popover is open, even when it holds only a status line (`Type to search…`, `Searching…`, no match) or an error. In those states there is no listbox and `aria-controls` is undefined. APG reserves `aria-expanded="true"` for a displayed listbox popup.
**Fix:** `aria-expanded={listboxShown}`. The status lines already announce through their own `role="status"`.

_Lane 3_

### IN-302: The introduction's question count can disagree with the completion card after Back or Forward

**File:** `apps/csrm/src/features/questionnaires/questionnaire-detail.tsx:56-58`, `:77-83`
**Issue:** `introductionFacts(definition)` counts visible questions from the page's served answers. When `savedQuestionnaireAfter` wins at mount, the renderer is seeded from the newer session record (`questionnaire-renderer.tsx:277`). If the newer answers toggle a conditional question, the introduction's `{n}` and the card's `of {total}` differ. UI-SPEC §5.2 says they are "the same count".
**Fix:** Compute the introduction facts from the same seed the renderer uses: lift `savedQuestionnaireAfter(...)?.answers ?? definition` into `QuestionnaireDetail` and pass it to both.

_Lane 3_

### IN-303: The session-record comparison rule lives in a JSX module

**File:** `apps/csrm/src/features/questionnaires/questionnaire-detail.tsx:69-83`
**Issue:** `answersUpdatedAt` is the rule that decides whether the Back/Forward record wins, which is domain logic. It sits in a client JSX file, away from its pair `savedQuestionnaireAfter` in `use-answer-autosave.ts`, and it has no direct test. AGENTS.md says "Business/domain logic must not live in JSX."
**Fix:** Move `answersUpdatedAt` (and `introductionFacts`) into `questionnaire-domain.ts` or beside `savedQuestionnaireAfter`, and unit-test it with offset timestamps and an unparseable `updatedAt`.

_Lane 3_

### IN-304: The `pagehide` and unmount flush may never reach the server

**File:** `apps/csrm/src/features/questionnaires/use-answer-autosave.ts:205-215`
**Issue:** On `pagehide` (reload, close, external navigation) the waiting save goes out as a Server Action `fetch`. The browser normally cancels it as the document unloads. Only `visibilitychange` to hidden (tab switch) reliably completes. UI-SPEC §6.2 promises the save is "sent at once".
**Fix:** Record this as a known limit next to UI-D11, or add a small `navigator.sendBeacon`/`keepalive` route for the final flush, if a non-Strapi route is acceptable under the "no frontend API facade" rule. The guard's `beforeunload` prompt is the real protection today.

_Lane 3_

### IN-305: The Requestor's timeline summary can render an empty list

**File:** `apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx:269-273`
**Issue:** `events.length === 0` chooses between the empty message and the list. With `depth="summary"`, `summarise()` drops pre-release question changes and pre-release `regenerated` events. A projection that holds only such events produces an empty `<ol>` with no `No revisions have been recorded.` line.
**Fix:** Branch on `summaryEntries.length === 0` when `depth === 'summary'`.

_Lane 3_

### IN-306: Editing a select question re-derives every choice value from its label (pre-existing, unchanged in Phase 10)

**File:** `apps/csrm/src/features/questionnaires/questionnaire-governance.tsx:81-86`, `:101-111`, `:246`
**Issue:** `draftOf` keeps only the labels, and every edit re-sends `choices` with `value = slug(label)`. A question whose stored values are not slugs (template- or AI-generated), or two labels that slug the same way (`A & B`, `A B`), gets new or duplicate values on any edit, including a text-only edit. Strapi may then clear the Requestor's answers through `clearedAnswers`.
**Fix:** Carry `{ value, label }` pairs in the draft, keep a stored value when its label is unchanged, and send `choices` only when the choice list actually changed.

_Lane 3_

### IN-307: The Risk Register filter combobox keeps a stale active option and can hang on a rejected search

**File:** `apps/csrm/src/features/risks/risk-register-filters.tsx:59-73`, `:81-85`
**Issue:**

- `active` is never reset when `query` changes. While the next search loads, the listbox unmounts but `aria-activedescendant` still names `${listboxId}-${active}`.
- If the new results are shorter, `results[active]` is undefined, and Enter neither chooses nor is prevented.
- The `searchRelations` await has the same unguarded rejection as WR-301, which leaves `loading` stuck at true.

**Fix:** In the search effect, call `setActive(-1)`. Wrap the await in `try`/`catch` and set `loading` to false. Set `aria-activedescendant` only when `open && !loading && results[active]`.

_Lane 3_

### IN-401: Red-phase scaffolding left in unit tests

**File:** `apps/csrm/src/lib/api/refusal-copy.test.ts:9-11`, `apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts:239, 243, 256, 275`, `apps/csrm/src/features/administration/administration-workflow.test.tsx` (`const optionsPath = './applicable-controls'; await import(optionsPath)`)

**Issue:** These scaffolds were written so the tests could fail before the modules existed:

- `refusal-copy.test.ts` imports the module only `if (existsSync(...))`, through an obfuscated `['./refusal', 'copy'].join('-')` with `@vite-ignore`. That hides the module from Vitest's import graph and from type checking.
- `questionnaire-actions.test.ts` repeats `expect(actions.autosaveQuestionnaireDraftAction).toBeTypeOf('function')` four times.

The modules exist now, so the scaffolding only adds noise and weakens dependency tracking.

**Fix:** Replace these with static imports (`import { refusalMessage, answerSaveRefusal, requestConflictMessage } from './refusal-copy'`, `import { applicableControlOptions } from './applicable-controls'`) and drop the repeated type checks.

_Lane 4_

### IN-402: The "leaving times labelled UTC" assertion holds whatever the sync does

**File:** `apps/csrm/src/components/csrm/local-time.test.tsx:108-118`

**Issue:** The provider's `zone` is `null` and never changes in the test, so `LocalInstant` renders "5:47 am UTC" whether the sync rejects or succeeds. The only real evidence that the rejection is swallowed is that Vitest reports no unhandled rejection. The visible assertion proves nothing about the failure path.

**Fix:** Rename the test to "swallows a rejected sync without an unhandled rejection". Add an explicit check, for example spy on `console.error` and expect no call, or register a `process.on('unhandledRejection')` spy for the test.

_Lane 4_

### IN-403: A stale comment and vacuous negatives after the D-23 route gate

**File:** `apps/csrm/e2e/questionnaire-workflow.spec.ts:194-199`

**Issue:** The comment says "The analyst is told which questionnaire this is — the title, its number and its request…". The Requestor is now refused before any read, so no metadata renders. The `draftContent` `toHaveCount(0)` checks that follow are now trivially true.

**Fix:** Rewrite the comment to describe the refused state, and drop or relabel the three negatives (the permission alert already proves no read).

_Lane 4_

### IN-404: A spied getter leaks into later tests when its assertion fails

**File:** `apps/csrm/src/features/questionnaires/use-answer-autosave.test.tsx:260`

**Issue:** `vi.restoreAllMocks()` runs at the end of the `it.each` body. If `expect(save).toHaveBeenCalledTimes(1)` fails, the `document.visibilityState` spy stays set to `'hidden'` for every later test in the file.

**Fix:** Move the restore into an `afterEach(() => vi.restoreAllMocks())`.

_Lane 4_

### IN-405: The Requestor refusal on the request route checks fewer reads than its siblings

**File:** `apps/csrm/src/features/assessments/analyst-route-gate.test.tsx:177-189`

**Issue:** The questionnaire and assessment refusal tests call `expectNoRecordRead()`. The request-route refusal asserts only `getRequest` and `getRequestGenerationJobs`, even though that page now also calls `getQuestionnaire` (the change count, lines 237-248).

**Fix:** Call `expectNoRecordRead()` here too.

_Lane 4_

### IN-406: The overflow test proves only that the last option scrolls into view

**File:** `apps/csrm/e2e/accessibility.spec.ts:853-863, 925-946`

**Issue:** The accepted-exception comment says "ArrowDown reaches all ten options, each scrolled into view… the test below proves the same keyboard path". The test checks only that the last option is active and in view after N presses.

**Fix:** Either assert `inView` for each option as it becomes active inside the loop, or reword the comment so it does not claim per-option proof.

_Lane 4_

### IN-407: The picker proof depends on the server's unspecified default sort

**File:** `apps/csrm/e2e/risk-register-workflow.spec.ts:639` (query built in `apps/csrm/src/features/requests/request-service.ts:138`)

**Issue:** The line `'the 26th system is past the first page'` assumes the inventory search returns `…01`-`…25` before `…26`. `searchInventory` sends no `sort`, so the result order depends on Strapi's default. If that default changes, for example to newest first, the proof fails for a reason unrelated to the picker.

**Fix:** Assert the bounded page without depending on order. For example, require exactly 25 options plus the status line, then prove the missing one is found by its full name. Or send an explicit `sort` in the search contract.

_Lane 4_

### IN-408: The "unchanged save sends nothing" listener stops at the first UI change

**File:** `apps/csrm/e2e/assessment-release-workflow.spec.ts:195-199`

**Issue:** `page.off('request', recordWrite)` runs as soon as "No changes to save." renders. A regression that shows the note and then posts, such as an optimistic note followed by a Server Action, would be missed.

**Fix:** Keep listening for a short settle period before detaching, or assert that `page.waitForRequest((r) => r.method() !== 'GET', { timeout: 2_000 })` rejects.

_Lane 4_

### IN-409: `.first()` hides duplicate owner options

**File:** `apps/csrm/e2e/administration-workflow.spec.ts:325`

**Issue:** `getByRole('option', { name: 'Jane Doe', exact: true }).first()` picks silently if the owner search ever lists the same user twice. A duplicated result row would go unnoticed.

**Fix:** Assert `toHaveCount(1)` before clicking, or drop `.first()` so strict mode catches the duplicate.

_Lane 4_

---

_Reviewed: 2026-10-02T19:38:53Z_
_Reviewer: Claude (gsd-code-reviewer), four lanes merged by the orchestrator_
_Depth: standard_
