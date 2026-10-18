---
phase: 03-dynamic-questionnaire-workflow
reviewed: 2026-08-29T19:14:41Z
depth: standard
files_reviewed: 56
files_reviewed_list:
  - apps/strapi/src/api/csrm-question/operations.ts
  - apps/strapi/src/api/csrm-question/routes/csrm-question.ts
  - apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/strapi/src/api/csrm-questionnaire/operations.ts
  - apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
  - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts
  - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
  - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
  - apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts
  - apps/strapi/src/index.ts
  - apps/strapi/src/policies/csrm-authorization.ts
  - apps/strapi/tests/authorization.integration.test.ts
  - apps/strapi/tests/contract-catalogue.integration.test.ts
  - apps/strapi/tests/helpers/strapi-http-harness.ts
  - apps/strapi/tests/questionnaire-seed.integration.test.ts
  - apps/strapi/tests/questionnaire-workflow.integration.test.ts
  - apps/strapi/tests/questionnaire-workflow.unit.test.ts
  - apps/web/app/(app)/app/questionnaires/[documentId]/error.tsx
  - apps/web/app/(app)/app/questionnaires/[documentId]/loading.tsx
  - apps/web/app/(app)/app/questionnaires/[documentId]/page.tsx
  - apps/web/app/(app)/app/questionnaires/error.tsx
  - apps/web/app/(app)/app/questionnaires/loading.tsx
  - apps/web/app/(app)/app/questionnaires/page.tsx
  - apps/web/app/(app)/app/review/questionnaires/[documentId]/error.tsx
  - apps/web/app/(app)/app/review/questionnaires/[documentId]/loading.tsx
  - apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx
  - apps/web/app/(app)/app/review/questionnaires/error.tsx
  - apps/web/app/(app)/app/review/questionnaires/loading.tsx
  - apps/web/app/(app)/app/review/questionnaires/page.tsx
  - apps/web/e2e/questionnaire-workflow.spec.ts
  - apps/web/playwright.config.ts
  - apps/web/src/components/csrm/confirm-dialog.tsx
  - apps/web/src/config/navigation/navigation.ts
  - apps/web/src/features/dashboard/requestor-dashboard-service.ts
  - apps/web/src/features/dashboard/requestor-dashboard.test.tsx
  - apps/web/src/features/dashboard/requestor-dashboard.tsx
  - apps/web/src/features/questionnaires/questionnaire-actions.test.ts
  - apps/web/src/features/questionnaires/questionnaire-actions.ts
  - apps/web/src/features/questionnaires/questionnaire-detail.tsx
  - apps/web/src/features/questionnaires/questionnaire-domain.ts
  - apps/web/src/features/questionnaires/questionnaire-list.tsx
  - apps/web/src/features/questionnaires/questionnaire-renderer.test.tsx
  - apps/web/src/features/questionnaires/questionnaire-renderer.tsx
  - apps/web/src/features/questionnaires/questionnaire-review-list.tsx
  - apps/web/src/features/questionnaires/questionnaire-review.tsx
  - apps/web/src/features/questionnaires/questionnaire-schema.test.ts
  - apps/web/src/features/questionnaires/questionnaire-schema.ts
  - apps/web/src/features/questionnaires/questionnaire-service.test.ts
  - apps/web/src/features/questionnaires/questionnaire-service.ts
  - apps/web/src/features/questionnaires/questionnaire-workflow.test.tsx
  - apps/web/src/lib/api/generated/schema.d.ts
  - docs/contract-gaps/phase-03-questionnaire-json-contract.md
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/specification.json
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-29T19:14:41Z
**Depth:** standard
**Files Reviewed:** 56
**Status:** issues_found

## Summary

The Phase 3 Strapi workflow, typed web boundary, UI, frozen contract artifacts, and automated tests were reviewed. Authorization is mounted server-side and the catalogue copies remain byte-identical, but the submitted-state projection is incorrect for conditional questionnaires and mutations can lose data or undo an immutable submission under concurrent requests. Test coverage also claims rollback evidence through a helper that production never calls, and workload summaries silently truncate at 10,000 questionnaires.

The existing Strapi suite passes (21 tests), but its fixtures and happy path do not exercise these defects.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 [BLOCKER]: Hidden conditional questions make valid submissions appear unsubmitted

**File:** `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts:120-160`

**Issue:** `questionnaireState` and `projectQuestions` decide that a batch is submitted only when every persisted question has a submitted answer. Submission deliberately clears inactive conditional answers and stamps only visible questions (`questionnaire-workflow.ts:129-137`). Therefore, a valid questionnaire submitted while a conditional branch is hidden is subsequently projected as `draft`, remains in the Requestor's action queue, is counted as awaiting submission, and has every answer masked from Security Analysts. The detail page can then render edit controls even though any attempted save is rejected as immutable. Progress has the same root problem because `projectQuestionnaire` counts all persisted questions instead of the active visibility set. The browser test selects “Yes” at `apps/web/e2e/questionnaire-workflow.spec.ts:100`, making the sole dependent question active and leaving this branch untested.

**Fix:** Parse the persisted definition, derive the visible question keys from authoritative values, and use that active set consistently for state, progress, and analyst batch masking. For example:

```ts
const definition = parseQuestionnaireDefinition(questions);
const values = Object.fromEntries(definition.map((q) => [q.questionKey, answerValue(q.answer)]));
const activeKeys = new Set(getVisibleQuestionKeys(definition, values));
const active = questions.filter((q) => activeKeys.has(questionKeyOf(q)));
const submittedBatch = active.length > 0 && active.every((q) => isSubmittedAnswer(q.answer));
```

Add mounted coverage that submits with the controller value `false`, then verifies the Requestor header/list/summary and analyst list/detail/questions all report and expose one complete submitted batch while the inactive dependent answer remains absent.

### CR-02 [BLOCKER]: Concurrent saves can lose answers or reopen a submitted questionnaire

**File:** `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts:220-245`

**Issue:** Both mutations load and validate the questionnaire before opening the write transaction, then write the complete answer set question by question. Two PATCH requests from separate tabs can read the same snapshot and the later transaction overwrites fields saved by the first. More seriously, a PATCH and POST can both pass `assertMutableAnswerBatch`; if POST commits first and the stale PATCH commits second, the PATCH rewrites submitted envelopes as drafts and defeats the promised irreversible submission. The transaction makes each individual write batch atomic but does not serialize or version the read-modify-write operation.

**Fix:** Put the authoritative reload, mutability/state checks, normalization, and writes in one serialized transaction and lock the questionnaire/answer rows before calculating the next batch. If row locking is not portable across supported databases, add an optimistic concurrency token/precondition at the Strapi boundary and reject stale writers with 409. Add concurrent mounted tests for PATCH/PATCH and PATCH/POST interleavings, asserting no lost fields and that submitted envelopes can never revert to draft.

## Warnings

### WR-01 [WARNING]: Rollback test exercises a test-only helper, not the production submit path

**File:** `apps/strapi/tests/questionnaire-workflow.unit.test.ts:110-128`

**Issue:** The rollback test calls `persistSubmittedAnswerBatch`, but that function is referenced only by this test. Production `submitQuestionnaire` uses the separate `persistAnswers` implementation at `questionnaire-workflow.ts:207-217,244`. Consequently the passing test cannot detect a regression that moves a production write outside the Strapi transaction, changes the production write loop, or otherwise causes partial persistence. This does not substantiate the plan's claimed production rollback guarantee.

**Fix:** Remove the parallel test-only persistence path. Route production submission through the tested primitive and add a mounted test that injects a failure during the second real document-service update, then reloads every question from the database and proves none changed.

### WR-02 [WARNING]: Workload summaries silently ignore questionnaires after the first 10,000

**File:** `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts:111-118`

**Issue:** Both Requestor and analyst summaries hard-code `limit: 10_000` and derive every count from that truncated page. Once an authorized scope contains more than 10,000 questionnaires, `total` and every state bucket are wrong without any error or truncation signal. The OpenAPI operation describes workload counts, not sampled counts.

**Fix:** Compute exact state totals server-side using database aggregation where possible. If answer JSON prevents one aggregate query, page deterministically through the complete authorized result set and accumulate counts; do not expose a partial result as an exact summary. Add a boundary test with more than the chosen page size.

---

_Reviewed: 2026-08-29T19:14:41Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
