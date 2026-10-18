---
phase: 10-existing-flow-gap-closure
plan: 14
subsystem: ui
tags: [generation-jobs, questionnaire-generation, assessment-draft, request-hub, next-action, retry-rights, copy-guard, d-26, d-27, d-38, d-39, d-47, ux-06, uat-041, uat-054]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-13 GET /api/v1/assessment_requests/{requestId}/generation_jobs, getRequestGenerationJobs, getRequestGenerationJobsAction and canRetry; 10-12 the Replace flow, failure copy and the generation journey's replacement step; 10-02 the analyst request route gate; 10-04 RequestContextDetails"
provides:
  - "The analyst request page reads the request's generation jobs after the gate and the request read, and passes generationJobs and jobsReadFailed to AssessmentDetail"
  - "AssessmentDetail seeds both job cards with queued, running or failed jobs (never completed ones) and derives UI-SPEC 12.3's Next action override from the cards' reported statuses"
  - "QuestionnaireGenerationJob and AssessmentDraftJob: seededJob { job, canRetry }, jobsReadFailed and onJobStatusChange props; AssessmentDraftJob also takes requestId"
  - "Polling by request (getRequestGenerationJobsAction) for any job the viewer may not retry, or one a start handed back; by id only for the viewer's own job"
  - "RequestHub nextActionOverride: plain text after the unchanged Next action prefix"
  - "Own titles for a refused start or retry (Questionnaire generation couldn’t start, Draft generation couldn’t start)"
  - "Both job cards in the D-38 interface copy guard"
  - "Generation journey step UX06_JOB_STATUS_ON_RETURN"
affects: [10-23 pilot walkthrough, phase-13 job reads by id (D-27), phase-21 jobs]

actuals:
  tokens: 13960
  tasks: 3
  commits: 6
plan_head_before: 2ef9e7296680a5bded1509e6b432d1276944c7a7
plan_head_after: 2a9adcdecf70619d4cc12f8bbb7a8f5f3b753b34

tech-stack:
  added: []
  patterns:
    - "A client card seeded from a server read resets only when the seed's content key (job id, status, retry right) changes, so router.refresh() and revalidation never reset it; a seed that disappears leaves the session's job in place"
    - "A card reports its status upward through a stable state setter (onJobStatusChange); the parent falls back to the seeded status until the card has reported, so the server render already carries the override"
    - "Poll by request whenever the viewer's retry right is false or unknown (after a start, which may hand back another analyst's active job); poll by id only for the viewer's own job"

key-files:
  created: []
  modified:
    - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
    - apps/csrm/src/features/assessments/assessment-draft-job.tsx
    - apps/csrm/src/features/requests/request-hub.tsx
    - apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
    - apps/csrm/src/features/requests/request-hub.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
    - .planning/phases/10-existing-flow-gap-closure/deferred-items.md

key-decisions:
  - "10-14: a refused start or retry gets its own alert title, Questionnaire generation couldn’t start (and Draft generation couldn’t start on the draft card, which had the same defect); Status unavailable stays for a failed status check only. UI-SPEC names no title for a refused start; this resolves the 10-12 deferred item"
  - "10-14: after a start the viewer's retry right is unknown (the registry hands back the request's active job to any analyst), so the card polls by request until the read says; only a job the viewer started or retried is polled by id. This keeps UI-SPEC 12.5's promise true without a by-id 403 (D-27)"
  - "10-14: the seed's reset key is job id, status and canRetry; a seed that disappears (the job completed, so it is no longer seeded) keeps the session's job and its review link, as UI-SPEC 12.1's completed-in-session row requires"
  - "10-14: a poll by request that finds no job clears the card to its idle action (D-26: jobs are process-local, so after a Strapi restart nothing is shown)"
  - "10-14: the page reads the generation jobs for every populated request (in parallel with the change-count read), not only when a card will show, so the mounting rule lives in one place (AssessmentDetail)"
  - "10-14: the jobs-read-failed line shows only above an idle action that is actually offered (Generate or Replace; Generate assessment draft), never above the released hint or the draft precondition"

patterns-established:
  - "Seeded client state keyed on content, not object identity"
  - "Card-reported status lifted through a stable setter, with the seeded status as the server-render fallback"

requirements-completed: [UX-06]

coverage:
  - id: D1
    description: "An analyst who comes back mid-generation sees the questionnaire job's status (queued or running, with the leave-and-return line) in place of Generate or Replace; another analyst's job adds Started by another Security Analyst. and is polled by request (D-26, D-27, D-47)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#shows a running job another Security Analyst started and polls it by request, never by id"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#shows a %s job the viewer started in place of Generate and Replace, polled by id"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-route-gate.test.tsx#reads the request generation jobs after the request and shows a running job in place of Generate"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-generation-workflow.spec.ts#UX06_JOB_STATUS_ON_RETURN"
        status: pass
    human_judgment: false
  - id: D2
    description: "A completed job is not seeded and an equal re-seed does not reset the card (D-26)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#does not seed a completed job, so the hub offers its normal action"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#does not reset the card when the page hands it a new but equal seeded job"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only the analyst who started a failed job is offered Retry; another analyst reads who may retry it and may start a new job, on both cards (D-26, T-10-36)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#shows another analyst’s failed job with who may retry it, and offers %s instead of Retry"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#lets another analyst start a new job after a failure they cannot retry"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#shows another analyst’s failed draft job with who may retry it, and offers Generate assessment draft"
        status: pass
    human_judgment: false
  - id: D4
    description: "While a questionnaire or draft job is queued or running the hub's Next action reads UI-SPEC 12.3's line as plain text; on completion or failure the served next action returns"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#says questionnaire generation is in progress, with no link, then returns the served next action"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#says assessment draft generation is in progress while a draft job runs"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#reads a next-action override as plain text after the unchanged prefix (UI-SPEC §12.3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "With a failed jobs read both cards show UI-SPEC 12.5's line above their idle actions"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#says what starting does above %s when the jobs read failed"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#says what starting does above Generate assessment draft when the jobs read failed"
        status: pass
    human_judgment: false
  - id: D6
    description: "The job cards' internal copy is gone (queued, running and timed-out bodies per UI-SPEC 12.1 and 12.2), a refused start has its own title, and both cards are in the D-38 copy guard (UAT-054)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts#%s shows no internal term"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#titles a refused start as a start that could not begin, not as a failed status check"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#keeps the %s state advisory and provider-neutral"
        status: pass
    human_judgment: false
  - id: D7
    description: "The refused-start title wording and the in-progress Next action read well to an analyst at 375 and 1440"
    verification: []
    human_judgment: true
    rationale: "Copy tone and the plain-text Next action's weight beside the cards are judgements no test asserts; 10-14 chose the refused-start title (UI-SPEC names none), so the pilot's 10-23 walkthrough should confirm it"

duration: 19min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 14: Generation status on return Summary

**The analyst hub now reads the request's generation jobs on load. It shows a queued, running or failed questionnaire or draft job in place of Generate or Replace for every analyst, offers Retry only to the job's initiator, and says generation is in progress on the Next action line. It explains a failed jobs read and gives a refused start its own title. Both job cards lose their internal copy and join the copy guard.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-02T08:17:06Z
- **Completed:** 2026-10-02T08:36:00Z
- **Tasks:** 3 of 3
- **Files modified:** 11 source and test files, plus `deferred-items.md`

## Accomplishments

- **Page (D-26, D-47).** `AssessmentRequestDetailContent` runs `getRequestGenerationJobs(request.documentId)` after the gate and the request read. It runs in parallel with the change-count read, never for a refused viewer and never after a refused read. The page passes `generationJobs` and `jobsReadFailed` to `AssessmentDetail`.
- **Seeding.** `AssessmentDetail` seeds the questionnaire card (shown while the request is submitted) and the draft card (shown while a questionnaire is available) with queued, running or failed jobs. Completed jobs are not seeded.
- **Questionnaire card.**
  - It takes `seededJob { job, canRetry }`. Its reset key is the job id, the status and `canRetry`, so an equal re-seed never resets it.
  - Queued and running read `You can leave this page. The status shows here when you come back.`. A job another analyst started adds `Started by another Security Analyst.`.
  - A failed job the viewer cannot retry adds `Only the Security Analyst who started it can retry it.` inside the failure alert and offers `Generate questionnaire` or `Replace questionnaire` per §3.1, never Retry.
  - Timed out reads `Automatic checks stopped after 30 seconds. Generation may still be running.`.
- **Draft card.**
  - It has the same seeding, retry rights and polling, and takes `requestId` so it can poll by request.
  - Queued reads `Generation is waiting to start. You can leave this page; the status shows here when you come back.`.
  - Another analyst's failed job offers `Generate assessment draft`.
  - The precondition sentence is unchanged.
- **Polling (D-27).** A job the viewer started or retried is polled by id. Any other job, or one a start handed back, is polled through `getRequestGenerationJobsAction({ requestId })`. The 1-second interval and 30-second budget are unchanged (T-10-37).
- **Next action (§12.3).** Each card reports its status through `onJobStatusChange`. `AssessmentDetail` falls back to the seeded status until a card reports, so the server render already says it. While a job is queued or running, `RequestHub` renders `nextActionOverride` as plain text after `Next action: `. The served next action returns when the job completes or fails.
- **Failed read (§12.5).** Both cards show the read-failed line in `text-sm text-foreground-secondary` above their idle action.
- **Deferred item resolved.** A refused start or retry now shows under `Questionnaire generation couldn’t start` (or `Draft generation couldn’t start`), not `Status unavailable`.
- **Copy guard.** `assessment-draft-job.tsx` and `questionnaire-generation-job.tsx` are in `guardedFiles`.
- **Journey.** `UX06_JOB_STATUS_ON_RETURN` leaves the request after the replacement is confirmed, opens the review queue and comes back. While a queued or running line is visible, neither Generate nor Replace may show. It then waits for the job's review link or the hub's Replace, and checks that the hub's `QNR-` link opens `/app/review/questionnaires/{id}`. The replacement step's fixed `ready for review` and review-link checks moved into this tolerant check; its `finally` with `attachReplacementDiagnostic` stays.

## Task Commits

1. **Task 1 (tracer): a running questionnaire job shows on return.** RED `57c758f` (test), GREEN `4dd456b` (feat).
2. **Task 2: failed jobs, retry rights, the draft card, the Next action override and a failed read.** RED `096d9f1` (test), GREEN `f865b2d` (feat).
3. **Task 3: guard the job cards' copy, then the journey.** `37f3b5d` (test). The journey fix is `2a9adcd` (fix; see Deviations).

**Plan metadata:** the docs commit that follows this SUMMARY.

## TDD record

- **Task 1 RED.** Six cases failed on their target assertions, for example `Unable to find ... Questionnaire generation is running` (the card ignored `seededJob`) and `getRequestGenerationJobs` called 0 times. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`) for `shows a running job another Security Analyst started and polls it by request, never by id`.
- **Task 2 RED.** 18 cases failed on assertions, with no TypeError or ReferenceError. `RED_EVIDENCE_OK` was returned for `shows another analyst’s failed job with who may retry it, and offers generate instead of Retry`. `keeps the served next action when the seeded job failed` passed at RED because no override existed yet; it is a regression proof.
- **Fixtures.** The existing tests that passed `initialJob` moved to `seededJob={{ job, canRetry: true }}` in each GREEN commit. RED kept them unchanged, so they did not muddy the evidence. The draft card's queued row (`assessment-review-workflow.test.tsx`) now expects the §12.2 body; its title is unchanged.
- No refactor commit was needed.
- TDD gate: `test(10-14)` commits `57c758f` and `096d9f1` each precede their `feat(10-14)` commits `4dd456b` and `f865b2d`.

## Tests run

| Run | Result |
|-----|--------|
| Task 1 RED (three unit files) | 90 tests: 84 passed, 6 failed (the targets) |
| Task 1 verify: the card, review-workflow and route-gate files plus `zod-client-boundary.test.ts`; web typecheck | 101/101; typecheck clean |
| Task 2 RED (`src/features/assessments`, `src/features/requests`) | 288 tests: 270 passed, 18 failed (the targets) |
| Task 2 verify (same folders); web typecheck | 288/288 in 21 files; typecheck clean |
| Task 3: `interface-copy-guard.test.ts` | 34/34 |
| Playwright `e2e/questionnaire-generation-workflow.spec.ts`, first run (no dev servers listening) | `desktop` project: 0 passed, 1 failed (test timeout of 180 s in `UX06_JOB_STATUS_ON_RETURN`; see Deviations), 0 flaky, 0 skipped |
| Playwright, same spec after the fix | `desktop` project: 1 passed, 0 failed, 0 flaky, 0 skipped; test 13.5 s, run 1.1 min. **On return the journey observed a completed job:** the deterministic provider finished before the page loaded, so the hub showed `Replace questionnaire` and no job, and the in-progress branch was covered by the unit tests. The run changed nothing in the tree (D-48). |
| Full web suite (`pnpm --dir apps/csrm test`) | 2,583/2,583 in 125 files, 0 failed, 0 skipped, 30.7 s |
| Web typecheck and lint | clean |
| Strapi suite, `api:check` | not run: no Strapi source, spec or client change |

## Files Created/Modified

- `apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx`: reads the generation jobs after the gate and the request read.
- `apps/csrm/src/features/assessments/assessment-detail.tsx`: `generationJobs` and `jobsReadFailed`, seeding through `seedable`, and the §12.3 override through `generationNextAction`. The full-width Request context (261001-kxa), the section gap (261001-le4), 10-02's permission copy and 10-04's `RequestContextDetails` and revert predicate are intact.
- `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx`: seeded states, retry rights, polling by request, the §12.1 copy, the read-failed line and the refused-start title.
- `apps/csrm/src/features/assessments/assessment-draft-job.tsx`: the same for the draft card (§12.2), with `requestId`.
- `apps/csrm/src/features/requests/request-hub.tsx`: `nextActionOverride`.
- Tests: `questionnaire-generation-job.test.tsx`, `assessment-review-workflow.test.tsx`, `analyst-route-gate.test.tsx`, `request-hub.test.tsx` and `interface-copy-guard.test.ts`.
- `apps/csrm/e2e/questionnaire-generation-workflow.spec.ts`: `UX06_JOB_STATUS_ON_RETURN`, plus the bounded diagnostic read.
- `.planning/phases/10-existing-flow-gap-closure/deferred-items.md`: the 10-12 item is marked resolved.

## Decisions Made

- **Refused-start title.** `Questionnaire generation couldn’t start` on the questionnaire card and `Draft generation couldn’t start` on the draft card, which had the same defect. Both cover a refused start and a refused retry, since a retry starts the next attempt. `Status unavailable` stays only for a failed status check. UI-SPEC names no title for this, so the copy is this plan's choice, in the UI-SPEC's voice with the typographic apostrophe.
- **Retry right after a start is unknown.** The registry hands any analyst the request's active job, so a start may return another analyst's job. The card polls by request until the read says who may retry, which keeps §12.5's promise true without a by-id 403 (D-27). Only a job the viewer started or retried is polled by id.
- **Reset key.** It is the job id, the status and `canRetry`. A seed that disappears (the job completed, so it is no longer seeded) keeps this session's job and its review link (§12.1, "Completed (started in this session)").
- **Empty read clears the card.** A poll by request that finds no job returns the card to its idle action (D-26: jobs are process-local).
- **The page always reads the jobs** for a populated request, in parallel with the change-count read, so the mounting rule lives only in `AssessmentDetail`.
- **Read-failed line placement.** It shows only above an idle action the card actually offers, never above the released hint or the draft precondition.
- **The page-level case lives in `analyst-route-gate.test.tsx`.** That file already renders the route with its services mocked. The plan named `assessment-review-workflow.test.tsx`, which now holds the `AssessmentDetail`-level seeding, Next action and read-failed cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The journey's replacement diagnostic waited indefinitely for an absent link**
- **Found during:** Task 3, first journey run.
- **Issue:** `attachReplacementDiagnostic` read the review link's `href` with no timeout. The new return step calls it in `finally`. On return the job had already completed, so it was not seeded and there was no review link. The read therefore waited out the test's 180-second budget, although every assertion had passed (the trace showed one `getAttribute` running for 167.9 s).
- **Fix:** The read is bounded to one second and still falls back to `null`.
- **Files modified:** `apps/csrm/e2e/questionnaire-generation-workflow.spec.ts`.
- **Verification:** The journey passed (13.5 s test).
- **Commit:** `2a9adcd`.

**2. [Rule 3 - Blocking] The route test's service mocks needed the new read**
- **Found during:** Task 1 RED.
- **Issue:** `analyst-route-gate.test.tsx` mocks `assessment-service` and `assessment-actions` with explicit factories, so the page's new `getRequestGenerationJobs` call, and the card's `getRequestGenerationJobsAction`, needed entries. The plan did not list this file.
- **Fix:** Both mocks are added, with a default of no jobs. `getRequestGenerationJobs` joins `recordReads`, and the Requestor test asserts that it never runs.
- **Commit:** `57c758f`.

**3. [Rule 2 - Correctness] The draft card's refused start had the same `Status unavailable` defect**
- **Found during:** Task 2.
- **Fix:** It gets `Draft generation couldn’t start`, matching the questionnaire card (Decisions above).
- **Commit:** `f865b2d`.

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 correctness). **Impact:** No scope change. No Strapi source, content type, spec, client, Keycloak flag or `CSRM_AI_*` setting is touched.

## Issues Encountered

- The first journey run failed on its time budget (Deviation 1). It kept its database and builds for debugging (`apps/backend/.tmp/playwright-e2e-11267807-….db`, `apps/csrm/.tmp/playwright-next-11267807-…`) and a `test-results` folder. All are git-ignored, and they were removed once the trace was read. The passing run left the tree clean.
- A Bash heredoc holding the edit script failed on quoting, so the edits went through small Python scripts in the session scratchpad that keep each file's own line endings.

## Deferred

- None new. The 10-12 item (`Status unavailable` on a refused start) is resolved in `deferred-items.md`. The 10-08 item (`@radix-ui/react-dialog`) stays open and is unrelated.

## Threat Flags

None. No new endpoint or trust boundary; the cards call the existing `getRequestGenerationJobsAction` (10-13).
- **T-10-36:** Retry is offered only while the served `canRetry` is not false, and Strapi's by-id retry still refuses anyone else.
- **T-10-37:** Polling keeps the 1-second interval and the 30-second budget.

## Known Stubs

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

UAT-041 is closed on the web side (UX-06 criterion 2), and the job cards' internal copy (UAT-054) is gone.
- The pilot's 10-23 walkthrough should look at the refused-start title and the plain-text Next action while a job runs.
- Phase 13 widens the by-id job reads and retry (D-27). The cards then still poll by request for others' jobs, and that keeps working.

## Self-Check: PASSED

- Every modified key file exists. Commits `57c758f`, `4dd456b`, `096d9f1`, `f865b2d`, `37f3b5d` and `2a9adcd` are on `post-demo`, and the ledger count from `2ef9e72` is 6.
- Acceptance checks:
  - **Task 1:** the page calls `getRequestGenerationJobs` after `canViewerReviewAssessments()` and `readRequest`. The questionnaire card contains both §12.1 strings. The spec contains `UX06_JOB_STATUS_ON_RETURN`, and the replacement step no longer waits for `ready for review`.
  - **Task 2:** `assessment-draft-job.tsx` contains `Generation is waiting to start.` and `Generation may still be running.`. `request-hub.tsx` accepts `nextActionOverride`. `assessment-detail.tsx` contains the §12.3 questionnaire line. The draft precondition sentence is unchanged.
  - **Task 3:** both card files are in `guardedFiles`, and the journey passes.
