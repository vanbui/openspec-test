---
phase: 10-existing-flow-gap-closure
plan: 12
subsystem: ui
tags: [questionnaire-generation, replace-questionnaire, confirm-dialog, change-count, released-hint, failure-copy, d-08, d-09, d-16, d-22, d-39, ques-08, ux-06, uat-019, uat-036]
requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-11 revision.analystChangesSinceGeneration on the analyst questionnaire read and the QUESTIONNAIRE_RELEASED refusals; 10-07 the family I refusal copy in startQuestionnaireGenerationAction; 10-04 the zod-free request-domain predicates; 10-02 the analyst request route gate"
provides:
  - "request-domain.ts: questionnaireGenerationAction(relation) returns generate, replace or released from the served questionnaire relation (QuestionnaireGenerationAction type)"
  - "The analyst request page reads the questionnaire summary on the server, only when the hub offers Replace, and passes analystChangesSinceGeneration (or null) to AssessmentDetail"
  - "QuestionnaireGenerationJob: action, analystChangesSinceGeneration, questionnaireHref and questionnaireNumber props replace hasExistingQuestionnaire"
  - "Replace questionnaire (outline, Sparkles) opens Replace this questionnaire? with the 0, 1, n or unknown description, Keep this questionnaire, destructive confirm with Replacing questionnaire..., and a refusal kept inside the dialog"
  - "The released hint (UI-SPEC 3.3) with a RecordLink to the questionnaire, and no action"
  - "Failure copy by failureCode (UI-SPEC 12.4); a not-acknowledged failure offers the same Replace confirmation"
  - "ConfirmDialog accepts a ReactNode description"
  - "Generation journey E7 and UX06_NO_REQUEST_REVERT_ONCE_QUESTIONNAIRE_EXISTS"
affects: [10-14 seeds the card with running and failed jobs, adds the queued, running and timed-out copy and guards this file's copy; its journey step reads the replacement step by symbol, 10-23 pilot walkthrough]
actuals:
  tokens: 13388
  tasks: 2
  commits: 4
plan_head_before: 43e425c42fb377e58ecb40eda8e95b12941a341f
plan_head_after: 7bba41991c3faab48b21906f6de2f77c179b410a
tech-stack:
  added: []
  patterns:
    - "A server page reads an analyst-only count and hands the client card a number, keeping the route zod-free in the browser"
    - "A confirmation whose start can be refused throws from onConfirm so ConfirmDialog stays open with the refusal as errorMessage"
    - "Server-supplied codes map to copy through a Map, so a served code can never reach an inherited property"
key-files:
  created: []
  modified:
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/csrm/src/components/csrm/confirm-dialog.tsx
    - apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
    - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
    - .planning/phases/10-existing-flow-gap-closure/deferred-items.md
key-decisions:
  - "10-12: questionnaireGenerationAction offers replace only for an available questionnaire whose served state is analyst-review; unavailable, released, submitted and state-less relations all give released, so the hub never offers a replacement Strapi would refuse (D-22)"
  - "10-12: the page reads the questionnaire summary only when the request is submitted and the action is replace (the only time the count is shown), not for every available relation; a failed read or a summary without the count passes null and the dialog uses the count-unavailable sentence"
  - "10-12: the released hint names the questionnaire by number as a RecordLink; without a number it falls back to the plain words the questionnaire (no link), never an id"
  - "10-12: a QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED failure offers Replace questionnaire only while the action is not released; once released the card shows the hint instead. Other failures keep Retry questionnaire generation as UI-SPEC 12.1 says, since returning the questionnaire to analyst review makes a retry succeed"
  - "10-12: ConfirmDialog's description widened from string to ReactNode so the served count renders in tabular figures (UI-SPEC 3.2); every existing caller passes a string and is unchanged"
patterns-established:
  - "Confirmations for refusable starts: onConfirm awaits a start that resolves false on refusal and throws, so the refusal shows inside the open dialog"
requirements-completed: [QUES-08, UX-06]
coverage:
  - id: D1
    description: "The hub offers Generate, Replace or nothing from the served questionnaire relation alone, never a replacement Strapi would refuse (D-22)"
    requirement: QUES-08
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#the questionnaire generation action the hub offers (six relation cases)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#offers neither Generate nor Replace once the questionnaire is released"
        status: pass
    human_judgment: false
  - id: D2
    description: "Replace this questionnaire? states the discard count (0, 1, n or unknown) read from the analyst questionnaire summary, that Requestor answers are never replaced and what happens next; Keep this questionnaire dismisses; the acknowledgement is sent once, only after confirming (D-08, D-16)"
    requirement: QUES-08
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#states what a replacement discards when the served count is 0, 1, 3 and null"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#sends replacement acknowledgement only after the explicit confirmation"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-route-gate.test.tsx#reads the questionnaire summary for the change count a replacement discards"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-generation-workflow.spec.ts#return to the request and open the replacement confirmation (discarding the 2 changes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A refused replacement keeps the dialog open with the family I refusal; a failed job reads as UI-SPEC 12.4 by code, other codes keep the served message; a not-acknowledged failure offers the same confirmation (D-22)"
    requirement: QUES-08
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#keeps the confirmation open with the refusal when Strapi refuses the replacement"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#words a {code} failure for the analyst (five cases)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#offers Replace questionnaire through the confirmation when the replacement was not acknowledged"
        status: pass
    human_judgment: false
  - id: D4
    description: "A released questionnaire shows the UI-SPEC 3.3 hint with a link to the questionnaire and no action (D-09)"
    requirement: QUES-08
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#offers no action and says to return the questionnaire to analyst review first"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx#offers no replacement after a not-acknowledged failure once the questionnaire is released"
        status: pass
    human_judgment: false
  - id: D5
    description: "The analyst hub offers no Return to draft once a questionnaire exists (UX-06, UAT-036 hub part)"
    requirement: UX-06
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-generation-workflow.spec.ts#UX06_NO_REQUEST_REVERT_ONCE_QUESTIONNAIRE_EXISTS"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#offers Replace questionnaire with the served change count while the questionnaire is in analyst review"
        status: pass
    human_judgment: false
  - id: D6
    description: "The confirmation, hint and failure copy read well to a Security Analyst at the G-4 premium bar, at mobile and desktop widths"
    verification: []
    human_judgment: true
    rationale: "Copy tone, the visual weight of the outline Replace action against the destructive confirm, and the hint's placement are judgements no test asserts; the journey only proves no overflow and no serious axe violations"
duration: 13min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 12: Replace questionnaire with its discard count Summary

**An analyst can now replace a questionnaire in analyst review only through `Replace this questionnaire?`, which states how many analyst changes the replacement discards (read from the analyst questionnaire summary), says Requestor answers are never replaced, and keeps any refusal inside the dialog. A released questionnaire offers no action and links to it with the way back. Failed jobs read by code, and the hub never offers a request revert once a questionnaire exists.**

## Performance

- **Duration:** about 13 min
- **Started:** 2026-10-02T07:20:07Z
- **Completed:** 2026-10-02T07:33:00Z
- **Tasks:** 2 (Task 1 a tracer; its automated verify re-ran green before expansion)
- **Files modified:** 10 (9 source and test files, plus the phase's deferred items)

## Accomplishments

- **The action predicate (D-22).** `questionnaireGenerationAction(relation)` in `request-domain.ts` (zod-free) gives `generate` for an absent questionnaire, `replace` for one in `analyst-review`, and `released` for anything else that exists.
- **The count (D-16).** The analyst request page reads `getQuestionnaire` on the server when the request is submitted and the action is `replace`, and passes `revision.analystChangesSinceGeneration` or `null`. The client card receives a number, so `/app/review/requests/{documentId}` stays zod-free in the browser (the guard passes).
- **Replace confirmation (D-08, UI-SPEC §3.2).** `Replace questionnaire` (outline, `Sparkles`) opens `Replace this questionnaire?`. It shows one of four descriptions (0, 1, n in `tabular-nums`, or count unavailable). The dismiss is `Keep this questionnaire`, and the destructive confirm `Replace questionnaire` reads `Replacing questionnaire…` while pending. A refusal (family I) stays in the open dialog.
- **Released hint (D-09, UI-SPEC §3.3).** `This questionnaire has been released to the Requestor. To replace it, return {number} to analyst review first.` The number is a `RecordLink` to the analyst questionnaire, the text is `text-sm text-foreground-secondary`, and the card offers no action.
- **Failure copy (UI-SPEC §12.4).** `REQUEST_NOT_ELIGIBLE`, `QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED`, `QUESTIONNAIRE_ANSWERED` and `QUESTIONNAIRE_RELEASED` read as the spec's sentences; any other code shows the served `failureMessage`. A not-acknowledged failure offers the same Replace confirmation, which replaces `Replace and generate again`.
- **Idle description (§12.1).** `Generate a questionnaire from this request for Security Analyst review.`
- **Journey.** E7: the replacement step uses `Replace questionnaire` and `Replace this questionnaire?`, and asserts `discarding the 2 changes analysts made to its questions since it was generated` (the two questions added by the QUES08 step). The new `UX06_NO_REQUEST_REVERT_ONCE_QUESTIONNAIRE_EXISTS` asserts no `Return to draft` on the rendered hub. The first `Generate questionnaire` and the draft precondition assertion are unchanged.

## Task Commits

1. **Task 1 (tracer): Replace questionnaire states the discard count, from the summary read to the dialog**
   - RED `bfe14b7` (test): expect Replace questionnaire to state what it discards
   - GREEN `b804b66` (feat): replace a questionnaire only after stating the analyst changes it discards
2. **Task 2: the released hint, failure copy by code, no request revert once a questionnaire exists, then the journey**
   - RED `57d14bf` (test): expect the released hint and failure copy by code
   - GREEN `7bba419` (feat): explain why a released questionnaire cannot be replaced and word job failures by code

No REFACTOR commits were needed. **Plan metadata:** the docs commit that adds this SUMMARY, then the STATE/ROADMAP commit.

## TDD Gate Compliance

Both tasks have a `test(10-12)` commit before their `feat(10-12)` commit. Each RED run was checked with `gsd-tools check tdd-red-evidence` and returned `RED_EVIDENCE_OK` (`target_test_failed`). Vitest's `tap-flat` output has no `# tests/# pass/# fail` lines, so those three lines were appended, counted from the TAP `ok`/`not ok` lines.

## Tests run

| Run | Scope | Result |
| --- | --- | --- |
| Task 1 RED | `questionnaire-generation-job`, `assessment-review-workflow`, `analyst-route-gate` | 21 failed (all new or changed cases, on their assertions or the missing export), 52 passed; `RED_EVIDENCE_OK` |
| Task 1 GREEN | the three files, `zod-client-boundary.test.ts`, `record-route-titles.test.ts` | 95/95 |
| Task 1 GREEN | `src/features/assessments`, `src/features/requests`, `src/components`, `zod-client-boundary`, `src/lib/metadata` | 532/532 in 49 files; typecheck exit 0; lint exit 0 |
| Task 2 RED | `questionnaire-generation-job`, `assessment-review-workflow` | 8 failed (the new cases, on their assertions), 60 passed; `RED_EVIDENCE_OK`. The `provider-failed` case passes by design: it guards the unchanged fallback |
| Task 2 GREEN | same wider set as Task 1 | 540/540 in 49 files; typecheck exit 0 |
| Playwright | `e2e/questionnaire-generation-workflow.spec.ts` (no dev servers listening first) | `desktop` project: 1 passed, 0 failed, 0 flaky, 0 skipped; test 12.8 s, run 1.1 min. The run changed nothing in the tree (D-48) |
| Full web suite | `pnpm --dir apps/csrm test` | 2,549/2,549 in 125 files, 31.7 s |
| Web gates | `typecheck`, `lint`, `api:check` (then `git update-index --refresh`) | exit 0, exit 0, clean |
| Static guard | `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` | empty |

The Strapi suite was not run: this plan changes no Strapi source.

## Files Created/Modified

- `apps/csrm/src/features/requests/request-domain.ts`: `QuestionnaireGenerationAction` and `questionnaireGenerationAction`.
- `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx`:
  - the new props, the Replace trigger and the §3.2 confirmation (`replacementDescription`);
  - `start` now resolves whether a job started, and `confirmReplacement` keeps the dialog open on a refusal;
  - the released hint, the §12.4 `failureCopy` map, and the not-acknowledged route through the same dialog;
  - the new idle description.
- `apps/csrm/src/features/assessments/assessment-detail.tsx`: `analystChangesSinceGeneration` prop; passes the action, count, questionnaire href and number to the card.
- `apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx`: `readAnalystChangesSinceGeneration` after the request read (the 10-02 gate still runs first).
- `apps/csrm/src/components/csrm/confirm-dialog.tsx`: `description: ReactNode`.
- Tests: `questionnaire-generation-job.test.tsx` (the 157-158 case now clicks `Replace questionnaire` twice; dialog, released and failure cases), `assessment-review-workflow.test.tsx` (predicate table, detail cases), `analyst-route-gate.test.tsx` (the page's summary read and its failure).
- `apps/csrm/e2e/questionnaire-generation-workflow.spec.ts`: E7 and the UX06 step.
- `.planning/phases/10-existing-flow-gap-closure/deferred-items.md`: one open item (below).

## Decisions Made

- The predicate gives `released` for every existing questionnaire that is not in analyst review (released, submitted, unavailable, or served without a state), so no replace is ever offered that Strapi would refuse.
- The page reads the summary only when it will show the count (submitted request, `replace` action), not for every available questionnaire; a failed read gives the count-unavailable sentence.
- Without a questionnaire number, the hint says "the questionnaire" with no link rather than showing an id.
- After a not-acknowledged failure, the card offers Replace only while the action is not `released`. Other failures keep `Retry questionnaire generation` (§12.1): once the questionnaire is back in analyst review, a retry succeeds.
- The UX06 zero-count assertion sits after the visible draft-precondition line, so it runs against a rendered hub rather than passing before the page loads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ConfirmDialog` description widened to `ReactNode`**
- **Found during:** Task 1 GREEN
- **Issue:** UI-SPEC §3.2 sets the count in `tabular-nums`, but `ConfirmDialog` only took a string description.
- **Fix:** `description: ReactNode`. `AlertDialogDescription` already renders nodes, and every existing caller passes a string.
- **Files modified:** `apps/csrm/src/components/csrm/confirm-dialog.tsx`
- **Verification:** full web suite 2,549/2,549; typecheck clean
- **Committed in:** `b804b66`

**2. [Rule 2 - Missing coverage] Page-level tests for the summary read in `analyst-route-gate.test.tsx`**
- **Found during:** Task 1 RED
- **Issue:** The plan lists no test for the page's read, which is one of its key links (page to `questionnaire-service`, `analystChangesSinceGeneration`).
- **Fix:** Two cases, added to the file that already mounts the page with mocked services: the count reaches the dialog, and a refused read gives the count-unavailable sentence.
- **Files modified:** `apps/csrm/src/features/assessments/analyst-route-gate.test.tsx`
- **Committed in:** `bfe14b7`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing coverage). **Impact:** both were needed to meet the plan's own contract. No scope creep.

## Issues Encountered

- Task 2's first RED had the failure-copy cases failing for the wrong reason: the polite live region repeats `Questionnaire generation failed`, so a title lookup was ambiguous. I scoped the cases to the single `role="alert"` and re-ran RED before committing it.
- The plan's line numbers had drifted. The draft precondition assertion is now at `questionnaire-generation-workflow.spec.ts:160` (not `:130`), and its text is unchanged. The card mount in `assessment-detail.tsx` was found by symbol; the full-width Request context and section-gap changes (261001-kxa, 261001-le4), 10-02's permission copy and 10-04's `RequestContextDetails` and revert predicate are intact, and their tests pass.

## Deferred

- `deferred-items.md`: a refused **non-replacing** start (`Generate questionnaire`) still shows its family I refusal under the card's `Status unavailable` title. That title is §12.1's for a failed status check, and UI-SPEC names none for a refused start. This is left to plan 10-14, which rebuilds the card's states and guards its copy.

## Known Stubs

None.

## User Setup Required

None: no external service configuration required.

## Next Phase Readiness

- Plan 10-13 is next.
- Plan 10-14 builds on this card. It should:
  - add `seededJob`, `canRetry` and the queued, running and timed-out copy;
  - keep `action` and the `replace` element for its `Replace questionnaire` expectations;
  - find the replacement step by its step name (`confirm replacement and require a new reviewable completion`), since the journey's line numbers moved here.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*

## Self-Check: PASSED

All seven key files exist; commits bfe14b7, b804b66, 57d14bf, 7bba419 and fa7dc07 exist, each with the Co-Authored-By trailer.
