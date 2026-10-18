---
status: awaiting_human_verify
trigger: Full Phase 4 Playwright closure gate fails outside the assessment journey.
created: 2026-08-30
updated: 2026-08-30
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-27
  status: awaiting_human_verify
---

## Symptoms

- expected: The complete Playwright suite passes against a fresh process-unique database after Phase 4 gap-closure changes.
- actual: Focused assessment E2E passes, but the full suite fails independently in the questionnaire workflow and Requestor request workflow.
- errors: `e2e/questionnaire-workflow.spec.ts:85` is missing "Awaiting questionnaire submission"; `e2e/requestor-request-workflow.spec.ts` has a submit-dialog button detachment/timeout and later misses "Approved assessments are not shown as released".
- timeline: Reproduced during 04-21's final closure task on fresh isolated databases.
- reproduction: Run the full web Playwright suite using its process-unique `.tmp` database configuration.

## Current Focus

reasoning_checkpoint:
  hypothesis: "The questionnaire E2E fails because it selects QUES-DEV-001, whose bootstrap seed deliberately persists submitted answers for assessment-release-workflow; the Requestor E2E fails because it asserts retired empty-widget text."
  confirming_evidence:
    - "The isolated questionnaire failure snapshot renders QUES-DEV-001 as Submitted with all answers, and its seed assigns each answer state: submitted."
    - "assessment-release-workflow.spec.ts requires that same submitted fixture before generating an assessment draft."
    - "The isolated Requestor failure snapshot renders the dashboard's current empty copy, which matches both RequestorDashboard and its unit test."
  falsification_test: "After adding a distinct mutable seed questionnaire and retargeting the questionnaire E2E, that E2E must complete save/reload/submit and the full E2E suite must pass; if it still renders Submitted, the seed separation is ineffective."
  fix_rationale: "A separate draft fixture removes the incompatible state requirement without weakening either end-to-end workflow; replacing the stale dashboard expectation asserts the current intentional empty state."
  blind_spots: "The previously reported detached confirmation button did not recur in isolated reproduction; the passing full suite did not reproduce it, but a single successful run cannot rule out an external intermittent condition."
- next_action: "Have the user confirm the original Phase 4 workflow in their environment; archive only after that confirmation."
- verification_plan: "Run `pnpm exec playwright test` from apps/web. All eleven E2E tests must pass against one fresh process-unique database; the Requestor test now verifies its submitted request is absent from the released region under both isolated and full-suite state."

## Evidence

- timestamp: 2026-08-30
  detail: Focused assessment E2E, Strapi tests, web typecheck/tests, API check, integrity test/script, and diff check passed before the full suite failure.
- timestamp: 2026-08-30
  detail: `pnpm exec playwright test e2e/questionnaire-workflow.spec.ts` failed independently against its own fresh process-unique database. At line 85, `Awaiting questionnaire submission` was absent after the Requestor discovered the seeded questionnaire and navigated directly to `/app/review/questionnaires/{documentId}`.
- timestamp: 2026-08-30
  detail: The questionnaire failure snapshot shows the sole `QUES-DEV-001` fixture is already `Submitted` with all seeded answers. `seed-questionnaire-workflow.ts` seeds those submitted answers, while `assessment-release-workflow.spec.ts` requires that same submitted questionnaire as its Phase 4 draft-assistance prerequisite.
- timestamp: 2026-08-30
  detail: `pnpm exec playwright test e2e/requestor-request-workflow.spec.ts` also failed independently on a fresh isolated database, at line 119 because the dashboard did not contain `Approved assessments are not shown as released`.
- timestamp: 2026-08-30
  detail: RequestorDashboard and its unit test intentionally use `No risk assessments have been released to you yet.` for the zero-released-assessments state, exactly matching the failed E2E snapshot.
- timestamp: 2026-08-30
  detail: The exact full suite passed assessment-release and questionnaire workflows but failed the Requestor E2E only because the preceding assessment workflow correctly released an assessment for Jane. Therefore the dashboard is populated in the complete suite and empty in the isolated Requestor run.
- timestamp: 2026-08-30
  detail: After splitting the mutable questionnaire fixture and making the Requestor released-region assertion state-independent, `pnpm exec playwright test` passed all 11 tests against a fresh process-unique database.

## Eliminated

- hypothesis: The questionnaire failure requires prior full-suite state or test interference.
  evidence: The same single test failed with a fresh Playwright-launched Strapi database and one worker.
  timestamp: 2026-08-30
- hypothesis: The Requestor workflow failure is caused by the previously reported confirmation-dialog button detachment.
  evidence: Its isolated reproduction completed both save/submit confirmation interactions and instead failed later on the dashboard text assertion.
  timestamp: 2026-08-30
- hypothesis: The Requestor E2E can always assert the released-assessments empty state after the dashboard change.
  evidence: It is empty in isolated execution but populated after assessment-release-workflow in the exact ordered full suite.
  timestamp: 2026-08-30

## Resolution

- root_cause: The questionnaire E2E used the sole seeded submitted questionnaire even though its own workflow requires it to begin mutable; that fixture must remain submitted for assessment-release E2E. The Requestor E2E also asserted stale dashboard copy rather than the intentional released-assessments empty state.
- fix: Added a separate Jane-owned mutable questionnaire seed (`QUES-DEV-DRAFT-001`) for questionnaire-workflow E2E, preserved the existing submitted fixture for assessment-release E2E, and aligned the Requestor dashboard assertion with the intentional empty state copy.
- files_changed:
  - apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts
  - apps/web/e2e/questionnaire-workflow.spec.ts
  - apps/web/e2e/requestor-request-workflow.spec.ts
- verification:
- verification: `pnpm exec playwright test` in apps/web: 11 passed (assessment release, questionnaire, Requestor request, accessibility, and shell E2E) against the Playwright fresh isolated SQLite database.
- files_changed:
