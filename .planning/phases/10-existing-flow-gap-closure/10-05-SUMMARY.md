---
phase: 10-existing-flow-gap-closure
plan: 05
subsystem: ui
tags: [nextjs, react, questionnaire, revert-to-draft, attention-list, revision-timeline, copy, vitest, playwright]

requires:
  - phase: 10-01
    provides: "LocalInstant and the revision timeline's local times (D-19)"
  - phase: 10-02
    provides: "the analyst route gate and plain permission copy on the questionnaire pages, and the interface copy guard"
  - phase: 10-03
    provides: "selectAdjacentRadio and the questionnaire journey's arrow-key step"
  - phase: 10-04
    provides: "the request-side twin: canRevertRequestToDraft and the 8.1 copy pattern"
provides:
  - "questionnaire-workflow-rules.ts (zod-free, type-only imports): canRevertQuestionnaireToDraft, canReturnToAnalystReview, submittedNoticeVariant, type SubmittedNoticeVariant"
  - "QuestionnaireIntroduction({ description, questionCount, hasConditionalQuestions }) in questionnaire-introduction.tsx (UI-SPEC 5.2)"
  - "submittedNotice?: SubmittedNoticeVariant on QuestionnaireRenderer (default requestor-revertible)"
  - "the Requestor questionnaire page in UI-SPEC 5.1 order: introduction first while answering, history below the questions, gap-8 page stack"
  - "the attention list only after a submit attempt or a server field error, in form order; validateActiveRequiredAnswers reports keys in form order"
  - "the Requestor history counted per release round with FilePenLine"
  - "four questionnaire files added to the interface copy guard"
  - "QUES09_INTRODUCTION_FIRST and UX06_QUESTIONNAIRE_REVERT_HIDDEN_AFTER_DRAFT in the journeys; E4 and E5 changed"
affects: [10-06, 10-07, 10-08, 10-09, 10-23, questionnaires]

actuals:
  tokens: 11300
  tasks: 3
  commits: 6
plan_head_before: 7d2c0680e2244434699433fc276edfe9396929c8
plan_head_after: 79caf43add6473c9d5be6ae08f2006b73ef19d13

tech-stack:
  added: []
  patterns:
    - "Backward questionnaire actions come from zod-free predicates over the served questionnaire state and request relationship; anything the read does not establish fails closed"
    - "A page chooses the renderer's submitted notice from the same predicate that gates its Return to draft, so the notice never promises a step the page does not offer"
    - "Server-returned field errors are set with type 'server', so the attention list can tell them apart from client required-field errors that linger until blur"

key-files:
  created:
    - apps/csrm/src/features/questionnaires/questionnaire-workflow-rules.ts
    - apps/csrm/src/features/questionnaires/questionnaire-workflow-rules.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-introduction.tsx
  modified:
    - apps/csrm/src/features/questionnaires/questionnaire-detail.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/questionnaire-workflow.spec.ts
    - apps/csrm/e2e/performance.spec.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts

key-decisions:
  - "submittedNoticeVariant reads the rule as it applies once the questionnaire is submitted (request side only), so an in-page submit, rendered before the revalidated read arrives, already shows the notice its next render keeps"
  - "An unserved request (absent or unavailable) gives the Requestor the requestor-locked notice: fail closed, promise no return to draft"
  - "The attention list includes required unanswered questions, unavailable file questions and server-set field errors (type 'server'); a client required error that lingers until blur does not keep an answered question listed"
  - "An unavailable file question stays plain text in the attention list (it cannot be answered), now in its form-order position with the spaced hyphen"
  - "A round still open (a return to analyst review with changes and no release yet) is listed too, as the plan's existing-fixture row requires; changes before the first release never are"
  - "The introduction's card uses the completion card's treatment (rounded-lg, border-border, bg-card, p-4) in the renderer's max-w-3xl column"

patterns-established:
  - "Questionnaire predicates live in questionnaire-workflow-rules.ts; plan 10-09 wires canReturnToAnalystReview into the governance panel"

requirements-completed: [QUES-09, UX-06]

coverage:
  - id: D1
    description: "Return questionnaire to draft is offered to either actor only while the questionnaire is submitted and the request is questionnaire-in-progress; unknown or unserved facts fail closed"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-workflow-rules.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx#offers both actors Return to draft only while the request is questionnaire-in-progress (UI-SPEC §10.1)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#UX06_QUESTIONNAIRE_REVERT_HIDDEN_AFTER_DRAFT"
        status: pass
    human_judgment: false
  - id: D2
    description: "The submit dialog, the three submitted notices and both return-to-draft descriptions follow UI-SPEC 8.2; none calls the step irreversible and every notice starts with Questionnaire submitted."
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx#shows the %s submitted notice under the unchanged Submitted title"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx#keeps the submit confirmation open on server failure and prevents duplicate submits"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts (E4) and apps/csrm/e2e/performance.spec.ts (E5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Requestor's page opens with About this questionnaire (description, loaded count, conditional sentence, saving, what to do when unsure), then the revert summary, the questions and the history"
    requirement: QUES-09
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx#opens with the introduction, then the revert summary, the questions and the history (UI-SPEC §5.1)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#QUES09_INTRODUCTION_FIRST"
        status: pass
    human_judgment: false
  - id: D4
    description: "Questions requiring attention appears only after a submit attempt or a server field error, lists questions in form order, focuses the first, and drops questions as they are answered"
    requirement: QUES-09
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx#lists the questions requiring attention only after a submit attempt, in form order, and focuses the first"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts#reports required keys in form order (section, then question), not in the order the server serves them (D-13)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts (QUES-04 invalid submission)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Requestor history counts changes per release round after the first release, dated by the round's latest change, with FilePenLine, and shows no key, actor or reason"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx#counts the Requestor’s history per release round, newest first, with a neutral change icon (UI-SPEC §4.3)"
        status: pass
    human_judgment: false
  - id: D6
    description: "With a long questionnaire description at 375, the introduction wraps and the first question stays reachable within a normal scroll"
    verification: []
    human_judgment: true
    rationale: "The plan marks this a backstop for the orchestrator's browser check in plan 10-23; the journey proves no horizontal overflow with the seeded description only"

duration: 13min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 05: Requestor questionnaire guidance, truthful submission copy and one revert rule Summary

**The Requestor's questionnaire now opens with About this questionnaire. Questions requiring attention appears only after a submit attempt, in form order, and the history below the questions counts changes per release round. One zod-free canRevertQuestionnaireToDraft decides Return to draft and the submitted notice on both actors' pages, and no questionnaire copy calls submission irreversible.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-02T03:25:49Z
- **Completed:** 2026-10-02T03:38:52Z
- **Tasks:** 3 of 3
- **Files modified:** 16 (3 created, 13 modified)

## Accomplishments

- **D-22 (questionnaire side), UAT-036:** `canRevertQuestionnaireToDraft` requires a submitted questionnaire and a served request in `questionnaire-in-progress`. Both the Requestor's page and the analyst's submitted review use it, so neither offers a revert that Strapi's `questionnaire-workflow.ts:278` would refuse. `canReturnToAnalystReview` is also ready for plan 10-09's governance panel: it requires a release and a request in `submitted` or `questionnaire-in-progress`.
- **D-15 (questionnaire side), UAT-022:**
  - the submit dialog says what happens next;
  - the notice has three variants (`requestor-revertible`, `requestor-locked`, `analyst`), each starting `Questionnaire submitted.` under the unchanged `Submitted` title;
  - the two return-to-draft descriptions follow UI-SPEC §8.2. "Answer batch" is gone from both.
- **D-13, UAT-023:**
  - the introduction comes first, with the description, the loaded question count (singular or plural), the conditional sentence, saving, and what to do when unsure;
  - the attention region is absent at load, appears after an attempt with `Answer or correct these questions, then submit again.`, follows section-then-question order, focuses the first, and drops items as they are answered;
  - the form-level alert keeps only failures.
- **D-17, UAT-024 (counts):** the summary walks the events in time order. It skips changes before the first release and emits one `{n} change(s) to the questions` entry per round, with `FilePenLine` (never the bin).
- **D-38:** the copy guard now scans `questionnaire-detail.tsx`, `questionnaire-introduction.tsx`, `questionnaire-renderer.tsx` and `questionnaire-workflow-rules.ts`.

## Task Commits

1. **Task 1: One revert rule and truthful submission copy (tracer):** `49f7801` (test, RED), `60411b0` (fix, GREEN)
2. **Task 2: Introduction first, attention list after an attempt in form order, history below:** `c41716f` (test, RED), `70e9c08` (feat, GREEN)
3. **Task 3: History per release round, the guard list, the journeys:** `e5d308a` (test, RED), `79caf43` (fix, GREEN)

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Tests run

| Run | Result |
| --- | --- |
| RED, Task 1: the rules test, `questionnaire-workflow.test.tsx`, `questionnaire-renderer.test.tsx` | rules file: module not found (the planned RED); 11 failed / 31 passed on assertions (old dialog copy, old notice, the drafted request still offering Return to draft). `check tdd-red-evidence` on the analyst description case: RED_EVIDENCE_OK |
| GREEN, Task 1 verify, plus typecheck | 3 files, 66/66; typecheck clean |
| Tracer gate (interactive, end-of-phase, automated-only verify) | re-run green, expanded to Task 2 |
| RED, Task 2: workflow, renderer and schema tests | 9 failed / 68 passed (no introduction, the region at load, server order, the em dash). `check tdd-red-evidence` on the attention-list case: RED_EVIDENCE_OK |
| GREEN, Task 2 verify, plus typecheck | 3 files, 77/77; typecheck clean |
| RED, Task 3: `questionnaire-revision-timeline.test.tsx` | 3 failed / 4 passed. `check tdd-red-evidence` on the two-round case: RED_EVIDENCE_OK |
| GREEN, Task 3 unit verify: `src/features/questionnaires`, `interface-copy-guard.test.ts` and `zod-client-boundary.test.ts` | 11 files, 164/164 |
| Playwright: `questionnaire-workflow.spec.ts`, `performance.spec.ts` and `assessment-release-workflow.spec.ts` (production build, no dev servers) | **12 passed, 0 failed, 0 flaky, 0 skipped, 2.0 min (122 s wall).** All 12 ran in the desktop project: the release journey, the questionnaire journey, and 10 performance routes, including `/app/questionnaires/{documentId}` within its delivered-JavaScript budget. Mobile ran 0: these specs have no mobile project entries |
| Tree after Playwright | clean apart from the three operator items (D-48) |
| Full web suite `pnpm --dir apps/csrm test` | 119 files, **2,223/2,223**, 28.2 s |
| `lint`, `api:check` (then `git update-index --refresh` on `schema.d.ts`) | both clean; `schema.d.ts` unchanged |

The WebServer log shows `Error: The destination stream closed early` 26 times. This is pre-existing harness noise from aborted render streams on navigation (10-01 to 10-04 logged 2 to 61). No test failed.

## Files Created/Modified

- `questionnaire-workflow-rules.ts` (new): the three predicates and `SubmittedNoticeVariant`. Its only import is a type.
- `questionnaire-workflow-rules.test.ts` (new): the predicate tables, including fail-closed rows.
- `questionnaire-introduction.tsx` (new): the §5.2 card.
- `questionnaire-detail.tsx`: the §5.1 order in a `gap-8` stack, the introduction's facts, the gated revert, the notice variant and the §8.2 Requestor description.
- `questionnaire-review.tsx`: the gated analyst revert, `submittedNotice="analyst"` and the §8.2 analyst description.
- `questionnaire-renderer.tsx`:
  - the `submittedNotice` prop and its three texts, and the §8.2 submit description;
  - the `attempted` state, the form-ordered attention list, focus in form order, and `type: 'server'` field errors;
  - no question list in the form-level alert.
- `questionnaire-domain.ts`: `validateActiveRequiredAnswers` walks `orderQuestionnaire`.
- `questionnaire-revision-timeline.tsx`: `summarise` groups rounds; `SummaryEntry` takes a summary item.
- Tests: the renderer, workflow, timeline, schema and copy guard tests.
- Journeys:
  - `questionnaire-workflow.spec.ts`: E4 and `QUES09_INTRODUCTION_FIRST`;
  - `performance.spec.ts`: E5;
  - `assessment-release-workflow.spec.ts`: `UX06_QUESTIONNAIRE_REVERT_HIDDEN_AFTER_DRAFT`.

## Decisions Made

See `key-decisions` above. In short:
- the notice variant reads the rule for the submitted questionnaire;
- an unserved request fails closed to the locked notice;
- server field errors are tagged, so answered questions leave the list at once;
- unavailable file questions stay plain text in form order;
- open rounds with changes are listed;
- the introduction uses the completion card's treatment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A client required error kept an answered question in the attention list**
- **Found during:** Task 2 (GREEN)
- **Issue:** `form.trigger()` sets a required error on each unanswered question. With `mode: 'onBlur'` that error stays until blur, so a question the Requestor had just answered stayed listed, against UI-SPEC §5.3's "items leave as they are answered".
- **Fix:** `applyFailure` now sets server field errors with `type: 'server'`. The list includes required unanswered questions, unavailable file questions and server-typed errors only.
- **Files modified:** `apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx`
- **Committed in:** `70e9c08`

**2. [Plan scope] A domain test was added to `questionnaire-schema.test.ts`**
- **Found during:** Task 2 (RED)
- **Issue:** the plan names `validateActiveRequiredAnswers` as the root cause (D-13) but lists no test for it. Its Task 2 verify already runs `questionnaire-schema.test.ts`.
- **Fix:** one case there pins form order over interleaved sections, with keys and unsupported keys.
- **Committed in:** `c41716f`

**3. [Plan wording] The analyst exact-props assertion now includes `submittedNotice: 'analyst'`**
- **Found during:** Task 1 (RED)
- **Issue:** `questionnaire-workflow.test.tsx` "composes submitted answers through the exact shared read-only renderer model" asserts the renderer's exact props.
- **Fix:** the expected props gain the new prop. Nothing else in the case changed.
- **Committed in:** `49f7801`

---

**Total deviations:** 3: one bug fix inside the planned behaviour, and two test-scope adjustments.
**Impact on plan:** none on scope. Every acceptance criterion passes.

## TDD Gate Compliance

Each task has a `test(10-05)` RED commit before its GREEN commit, each with RED_EVIDENCE_OK. The GREEN commits for Tasks 1 and 3 use `fix(10-05)`, as the plan names them; Task 2 uses `feat(10-05)`. No refactor commits.

## Issues Encountered

- `gsd-tools windows append` refused to record the item below. `.planning/WINDOWS.md` frontmatter says 1 open / 2 fixed / 3 total, but its entries yield 0 / 3 / 3. The mismatch predates this plan (last touched in `8495a37`, the September overlay). The ledger is optional, so I left it unchanged; the item is recorded here instead.

## Known Stubs

- **Interim copy gap** at `apps/csrm/src/features/questionnaires/questionnaire-introduction.tsx:28`: `Your answers save automatically, so you can stop and finish later.` is UI-SPEC §5.2 verbatim, and the plan's acceptance criteria require it. Autosave (D-11) arrives in plan 10-07; until then answers save through `Save draft`. Plan 10-07 closes the gap, and must land before Phase 10 ships.

## Threat surface

No new surface.
- **T-10-11 (mitigated):** the summary renders only `kind`, `at` and `explanation`. The timeline test asserts that no key, analyst name or reason appears.
- **T-10-12 (mitigated):** `canRevertQuestionnaireToDraft` requires `questionnaire-in-progress` and fails closed, and Strapi still refuses a stale request.
- **T-10-SC (accepted):** no package was added.

## User Setup Required

None.

## Next Phase Readiness

- **10-06:** adds the conflict reason codes these return-to-draft dialogs will show.
- **10-07:**
  - replaces the save status (`Draft saved.`, renderer test `:218`) and adds autosave, which closes the interim copy gap above;
  - retires the form-level alert that now carries only failures;
  - `QuestionnaireRenderer` now takes `submittedNotice`.
- **10-09:** wires `canReturnToAnalystReview` into the governance panel and may add `regenerated` (`Questionnaire replaced`, `Sparkles`) to the summary. `summarise` already skips unknown kinds' grouping and keeps them as single entries.
- **10-23:** the pilot's 375 walk should check the backstop (coverage D6): a long description wraps in the introduction, and the first question stays a normal scroll away.

## Self-Check: PASSED

- FOUND: `apps/csrm/src/features/questionnaires/questionnaire-workflow-rules.ts`, `questionnaire-workflow-rules.test.ts`, `questionnaire-introduction.tsx`
- FOUND commits: `49f7801`, `60411b0`, `c41716f`, `70e9c08`, `e5d308a`, `79caf43`
- Every task's acceptance criteria were re-run: 15/15 PASS. The plan's `<verification>` passed: the full web suite, typecheck and lint, and the three journeys on the production build.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
