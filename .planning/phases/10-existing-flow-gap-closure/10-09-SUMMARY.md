---
phase: 10-existing-flow-gap-closure
plan: 09
subsystem: ui
tags: [questionnaire-governance, placement, in-place-form, focus-management, wcag-2.4.3, released-questions, parity-guard, d-04, d-05, d-06, d-07, d-17, d-22, ques-08, ux-06]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-05 canReturnToAnalystReview (questionnaire-workflow-rules.ts); 10-06 DEFINITION_CONFLICT and QUESTION_REMOVED on a placement clash; 10-07 the §10.2 G sentences and the reason field on every governance action result; 10-08 ConfirmDialog onDismiss and the questionnaire page leave guard"
provides:
  - "questionnaire-placement.ts (zod-free): QuestionPlacement, PlacementSection, SectionChoice, sectionChoices, placeInSection, placeInNewSection over every question, removed ones included"
  - "getQuestionnaireGovernanceQuestions(documentId): one GET /questions parsed as { definition, placements }; the placement parser is registered as getQuestionnaireQuestionPlacements against QuestionnaireQuestionsResponse"
  - "The rebuilt governance editor: Section select (existing or New section with a title), in-place forms (Edit in its row, a per-section Add question to {section}, the editor-level add at the top), focus moves, in-form refusals with Reload questions, one form at a time, polite announcements, cleared-answer notice by question text"
  - "ReleasedQuestionList (exported from questionnaire-governance.tsx) and the analyst's Released questions section with the served N of M answered"
  - "The released governance panel follows canReturnToAnalystReview (D-22, UI-SPEC §2.3)"
affects: [10-10 regeneration (Replace questionnaire; E7, E8 and the timeline key), 10-23 pilot walkthrough, any later plan that edits questionnaire-governance.tsx or the analyst review page]

actuals:
  tokens: 20880
  tasks: 3
  commits: 6
plan_head_before: ec2c42ca374624fb9ae9cb0aa5901ef728bdce86
plan_head_after: d485a37cbfbb82ad53fc5d388619472c6d4c1db4

tech-stack:
  added: []
  patterns:
    - "Placement over the complete question set: the analyst read is parsed twice (the filtered definition and a bound-free placement parser), and the client sends stored section metadata unchanged; Strapi still validates and refuses a clash with DEFINITION_CONFLICT"
    - "Pending focus through a ref and an effect that runs after every render: a focus move lands as soon as its element exists, so a focus target can wait for the reloaded questions without a setState in an effect"
    - "Per-item accessible names: visible text first, then {' '} and an sr-only qualifier (Add question to {section}), as the W-9 Edit question: {text} names are"

key-files:
  created:
    - apps/csrm/src/features/questionnaires/questionnaire-placement.ts
    - apps/csrm/src/features/questionnaires/questionnaire-placement.test.ts
  modified:
    - apps/csrm/src/features/questionnaires/questionnaire-service.ts
    - apps/csrm/src/features/questionnaires/questionnaire-governance.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
    - "apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx"
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
    - apps/csrm/src/lib/metadata/record-route-titles.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/backend/tests/questionnaire-governance.integration.test.ts
    - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
    - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts
    - apps/csrm/e2e/questionnaire-workflow.spec.ts

key-decisions:
  - "10-09: a new section's key is section-{slug} (or section when the title has no letters or digits), cut to the 120-character key bound with trailing hyphens trimmed, then -2, -3 … until no question holds it, removed questions included; its order is one past the highest section order of any question"
  - "10-09: Reload questions clears the refusal, refreshes the route and keeps the form open with what the analyst typed; placement is recomputed on the next save. A chosen section the reloaded questions no longer hold is refused in the form with the §10.2 G DEFINITION_CONFLICT sentence and Reload questions, without a request"
  - "10-09: Save question stays enabled while saving (it shows Saving question… with aria-disabled and ignores a second press), so focus stays on it when the server refuses (UI-SPEC §1.4); disabling it would drop focus to the page"
  - "10-09: delete errors stay in the delete dialog only (UI-SPEC §10.2 H) and clear when it is dismissed; the editor-level line is for release and return (D-06)"
  - "10-09: once released, the governance panel offers Return to analyst review only when canReturnToAnalystReview holds; when it does not, the panel shows the §2.3 assessment sentence. The rule fails closed, so an unavailable request also shows that sentence and no control"
  - "10-09: the released list shows on the awaiting-submission state only when the page is governable (a questionnaire and at least one active question), beside the panel; the submitted state keeps the read-only renderer with the answers"
  - "10-09: field errors are not alerts: each is named in its field's aria-describedby and focus moves to the first invalid field, so it is read once with the field; the server refusal is the form's one role=alert line"
  - "10-09: new buttons (per-section add, editor add, Save question, Discard changes, Reload questions) take the 44px touch-target height below 768px (max-md:min-h-11, direction §4 Buttons); Save question and Discard changes stack full width below 768px"

patterns-established:
  - "An analyst page that places questions reads getQuestionnaireGovernanceQuestions and passes placements down; QuestionnaireGovernance requires them"
  - "A form that opens in place records its invoking control as data-governance-control and returns focus there on discard; saved rows carry data-question-row and tabIndex -1"

requirements-completed: [QUES-08, UX-06]

coverage:
  - id: D1
    description: "Placement from every question, removed ones included: an existing section keeps its stored metadata and the question goes one past its highest order; a new section gets an unused key and the next free section order; sections are offered by title in section order, duplicates labelled by position, sections with only removed questions left out"
    requirement: "QUES-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-placement.test.ts (21 cases over the hosted, deterministic and seeded shapes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The analyst read is parsed as the active definition and as placements in one request; the placement parser passes all five parity modes without a narrowing or a grandfather entry and reads every question it is served"
    requirement: "QUES-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#getQuestionnaireQuestionPlacements accepts the payload its contract component declares / reports a rejection at the field that caused it / reads every question it is served"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#records the grandfather backlog count so it changes only deliberately (43)"
        status: pass
    human_judgment: false
  - id: D3
    description: "On a questionnaire generated through the mounted route, the old general-at-0 placement and a removed question's order clash with DEFINITION_CONFLICT, and the computed existing-section and new-section placements each return 200 with a valid definition that releases"
    requirement: "QUES-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-governance.integration.test.ts#mounted analyst adds to an existing and a new section of a generated questionnaire"
        status: pass
    human_judgment: false
  - id: D4
    description: "After the deterministic generation the analyst adds a question to Request context and to a new Offshore support section on the first try, each shown under its section"
    requirement: "QUES-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-generation-workflow.spec.ts#QUES08_ADD_TO_GENERATED_SECTIONS"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edit opens in its own row, a section's add after its questions, the editor-level add at the top with the last section; focus moves to Question text and returns to the opening control on discard, or to the saved, added or next question; one form at a time with the release caption; polite announcements"
    requirement: "QUES-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx#QuestionnaireGovernance question forms (UI-SPEC §1)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-governance-workflow.spec.ts#QUES08_FORM_OPENS_IN_VIEW (1440 and 375)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Field errors under their fields with focus on the first; a placement clash or removed question shows its §10.2 G sentence in the form's alert line with Reload questions, focus staying on Save question, and the editor-level line empty"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx#shows a placement clash beside Save question with Reload questions, keeping focus on Save"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx#checks the fields when Save question is pressed and moves focus to the first one to fix"
        status: pass
    human_judgment: false
  - id: D7
    description: "A released, unsubmitted questionnaire shows the analyst its questions read-only by section with the served N of M answered and a named progress bar, and no answer, checked state or control"
    requirement: "QUES-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx#shows the analyst a released questionnaire’s questions and the Requestor’s progress, with no answer (D-07)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-governance-workflow.spec.ts#QUES08_RELEASED_QUESTIONS_WITH_PROGRESS"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#QUES08_RELEASED_QUESTIONS_AFTER_REVERT (E3)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Return to analyst review is offered only before an assessment exists; afterwards the panel says the questions can no longer change"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx#offers Return to analyst review only before an assessment exists (D-22, UI-SPEC §2.3)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The cleared-answers notice names each question by its text, removed questions included, else A question no longer in this questionnaire, with Dismiss notice"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx#names each cleared answer by its question text, removed questions included"
        status: pass
    human_judgment: false
  - id: D10
    description: "Adding a question to a questionnaire the hosted provider generated (section-N from order 0)"
    requirement: "QUES-08"
    verification: []
    human_judgment: true
    rationale: "VALIDATION Manual-Only: the hosted provider needs real credentials, which this phase never uses; the hosted shape is covered by the placement unit cases only"

duration: 40min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 09: Questionnaire governance editor and the released view Summary

**The analyst can add a question to any section of an AI-generated questionnaire, or to a new section, on the first try. Placement now counts every question, removed ones included, and the form offers a Section select instead of a typed title. Question forms open where the analyst clicked, with focus and errors inside the form. While the Requestor answers, the analyst sees the released questions and the "N of M answered" count, but no answers.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-10-02T05:22:51Z
- **Completed:** 2026-10-02T06:03:02Z
- **Tasks:** 3 (6 commits: three RED, three GREEN)
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- **UAT-016, QUES-08 criterion 1 (placement):**
  - `questionnaire-placement.ts` places a question from the complete question set.
  - `getQuestionnaireGovernanceQuestions` parses the one questions read twice: as the active definition, and as placements through the new `getQuestionnaireQuestionPlacements` parser.
  - The editor's form chooses a section instead of taking a typed title. It sends a section's stored metadata unchanged, and an edit sends a placement only when the section changes.
  - A generated questionnaire takes an added question in Request context and in a new Offshore support section.
- **UAT-005, QUES-08 criterion 2 (forms in place):**
  - Edit replaces its own row with the form. Each section has its own `Add question` control (`Add question to {section}`), and the editor-level add opens at the top.
  - Focus goes to `Question text` when a form opens. It returns to the opening control on discard, and moves to the saved, added or next question after a save or delete.
  - Field errors show under their fields. A server refusal shows beside `Save question`, with `Reload questions` for `DEFINITION_CONFLICT` and `QUESTION_REMOVED`.
  - Only one form is open at a time, and saves are announced in a polite live region.
- **UAT-020, QUES-08 criterion 4 (released view):** the awaiting-submission view lists the released questions by section, without answers, under the served `{answered} of {total} answered` and a named progress bar.
- **UAT-036 (analyst questionnaire part):** once released, the governance panel offers `Return to analyst review` only when `canReturnToAnalystReview` holds (D-22).
- **UAT-024 (notice part):** the cleared-answers notice names each question by its text (D-17, web half).

## Task Commits

1. **Task 1: Add to existing and new sections of a generated questionnaire (tracer)**
   - RED: `e66a853` (test)
   - GREEN: `8cd30f3` (fix)
2. **Task 2: Forms in place, with focus, in-form errors and one form at a time**
   - RED: `4222a7e` (test)
   - GREEN: `a88f112` (fix)
3. **Task 3: Released questions and progress, the review-return rule, the journeys**
   - RED: `2dec5f2` (test)
   - GREEN: `d485a37` (feat)

**Plan metadata:** the docs commits that follow this summary.

## Files Created/Modified

- `apps/csrm/src/features/questionnaires/questionnaire-placement.ts` (new): the zod-free placement functions and types.
- `apps/csrm/src/features/questionnaires/questionnaire-placement.test.ts` (new): 21 cases over the three real shapes.
- `apps/csrm/src/features/questionnaires/questionnaire-service.ts`: the placement parser, its registration and `getQuestionnaireGovernanceQuestions`.
- `apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx`: the gate still runs first; the page then makes one governance questions read and passes `placements` on.
- `apps/csrm/src/features/questionnaires/questionnaire-governance.tsx`:
  - the rebuilt editor and the `QuestionForm` well (X-5);
  - `ReleasedQuestionList`;
  - the §2.3 panel rule.
- `apps/csrm/src/features/questionnaires/questionnaire-review.tsx`:
  - the `placements` prop;
  - the awaiting description (§2.2);
  - the `Released questions` section.
- `apps/csrm/src/features/questionnaires/questionnaire-governance.test.tsx`: 13 new cases. Existing renders now pass `placements`, and the file adds a `ResizeObserver` stub.
- `apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx`:
  - the route source check (D-39) now expects `getQuestionnaireGovernanceQuestions`;
  - two new cases: the awaiting view and the §2.3 panel.
- `apps/csrm/src/features/contract-response-parity.test.ts`: the placement parser joins the "reads every question" list. The grandfather count stays 43.
- `apps/csrm/src/features/assessments/analyst-route-gate.test.tsx` and `src/lib/metadata/record-route-titles.test.ts`: their mocks follow the new read.
- `apps/csrm/src/lib/performance/interface-copy-guard.test.ts`: adds `questionnaire-placement.ts` and `questionnaire-review.tsx`.
- `apps/backend/tests/questionnaire-governance.integration.test.ts`: the mounted proof on a generated questionnaire. No Strapi source or content type changed.
- `apps/csrm/e2e/questionnaire-generation-workflow.spec.ts`: `QUES08_ADD_TO_GENERATED_SECTIONS`.
- `apps/csrm/e2e/questionnaire-governance-workflow.spec.ts`:
  - E9 (`exact: true`);
  - `QUES08_FORM_OPENS_IN_VIEW` at 1440 and 375;
  - `QUES08_RELEASED_QUESTIONS_WITH_PROGRESS`.
- `apps/csrm/e2e/questionnaire-workflow.spec.ts`: E3. After the analyst's revert, the journey checks the `Released questions` region for the progress line and for no checkbox or radio.

## Tests run

- **Task 1 RED:** `questionnaire-placement.test.ts`, 20 of 21 failed on assertions.
  - A skeleton module still placed every question in `general` at order 0, so the run failed on assertions rather than on a load error.
  - `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for `placeInSection > places a hosted question one past the removed question, keeping the stored section`.
  - The Strapi file passed on its first run: 10/10 in 29.3 s. See deviation 1.
- **Task 1 GREEN (the plan's verify):** 15 files, 406/406, in this run:
  - the placement test, `contract-response-parity.test.ts`, `contract-operation-chain.test.ts`, `src/features/questionnaires`, `analyst-route-gate.test.tsx` and `record-route-titles.test.ts`.

  The typecheck was clean, and the Strapi file passed 10/10 in 27.1 s. The parity run listed the placement parser's three guard cases as passing.
- **Task 1 tracer gate:** the run is interactive and `end-of-phase`, and the verify step is automated only. It was re-run and passed, so expansion continued.
- **Task 2 RED:** `questionnaire-governance.test.tsx`, 13 new cases failed and the 7 existing ones passed. `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for `opens Edit in place of its question, with focus in Question text`.
- **Task 2 GREEN (the plan's verify):** the governance and workflow test files, 50/50. The typecheck was clean, with no act warnings.
- **Task 3 RED:** `questionnaire-workflow.test.tsx`, the 2 new cases failed and the other 30 passed. `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the awaiting-view case.
- **Task 3 GREEN:** `src/features/questionnaires` plus the copy guard, 12 files, 284/284.
- **Journeys** (the plan's three, plus `design-system-conformance.spec.ts` per the drift note; dev servers confirmed stopped): **13 passed** (desktop), 0 failed, 0 flaky, 0 skipped, in 3.5 min.
  - The conformance spec passed 10/10. This includes:
    - the print check (no `Add question to …`, `Reload questions` or form prints);
    - the Button weight-500 and field `text-sm` check;
    - the type-token matrix.
  - The generation journey ran in 11.5 s, the governance journey in 10.9 s and the questionnaire journey in 9.7 s.
  - The tree was clean afterwards (D-48).
- **Full web suite** (`pnpm --dir apps/csrm test`): 125 files, **2,513/2,513** in 26.4 s, up from 2,470 (this plan adds 43 tests).
- **Gates:**
  - `typecheck` passed. `lint` in this package is the same `next typegen && tsc --noEmit`.
  - `api:check` passed, and `git update-index --refresh` was run on `schema.d.ts`. The contract did not change.
- **Full Playwright run** (`pnpm --dir apps/csrm test:e2e`, dev servers confirmed stopped): **86 passed**, 82 desktop and 4 mobile.
  - 0 failed, 0 flaky, 0 skipped, in 12.1 min (05:50:47Z to 06:02:53Z).
  - This includes `accessibility.spec.ts`, whose axe sweeps cover the analyst-review and awaiting-submission states, and `design-contract.spec.ts`.
  - The tree was clean afterwards (D-48). The web server logged `The destination stream closed early`, as it did in the 10-08 full run (51 times there), and no test failed on it.

## Decisions Made

See `key-decisions` in the frontmatter (8 entries, each with its reason). In short:
- section keys are slugged and numbered to stay unique;
- `Reload questions` keeps the form open;
- `Save question` is never disabled, so focus stays on it after a refusal;
- delete errors stay in the delete dialog;
- the released panel follows the fail-closed D-22 rule;
- the released list shows only where the page is governable;
- field errors are not alerts;
- new controls get the 44px touch height below 768px.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3, blocking] The Strapi mounted cases could not fail first.**
   - **Found during:** Task 1 RED.
   - **Issue:** the plan expected the Strapi file to fail RED. The defect is web-only (research: "Layer: web only"), so the server already accepts a correct placement.
   - **Fix:** the mounted test proves that the old web placement (`general` at 0) and a removed question's order are each refused with `DEFINITION_CONFLICT` on a generated questionnaire, and that the computed placements save. It was green from the first run. The RED evidence for Task 1 comes from the placement unit test, which ran against a skeleton that encoded the old behaviour.
   - **Files modified:** `apps/backend/tests/questionnaire-governance.integration.test.ts`.
   - **Commit:** `e66a853`.
2. **[Rule 3, blocking] Two test mocks had to follow the new read.**
   - **Found during:** Task 1 GREEN.
   - **Issue:** `analyst-route-gate.test.tsx` and `record-route-titles.test.ts` mock the questionnaire service, and the analyst page now imports `getQuestionnaireGovernanceQuestions`.
   - **Fix:** `analyst-route-gate.test.tsx` now names `getQuestionnaireGovernanceQuestions` among its record reads. `record-route-titles.test.ts` keeps both reads, because the Requestor page still uses `getQuestionnaireQuestions`.
   - **Commit:** `8cd30f3`.
3. **[Rule 3, blocking] Existing governance tests now pass `placements`.**
   - **Found during:** Task 1 GREEN.
   - **Issue:** `QuestionnaireGovernance` now requires `placements` (deliberately, so no caller can silently place from active questions only). The file's existing renders did not pass it.
   - **Fix:** the file builds `placements` for its existing renders with a `placementsOf` helper.
   - **Commit:** `8cd30f3`.
4. **[Rule 3, blocking] A jsdom `ResizeObserver` stub.**
   - **Found during:** Task 2 GREEN.
   - **Issue:** the form's Radix `Checkbox` measures itself, and jsdom has no `ResizeObserver`.
   - **Fix:** the governance test stubs it, as `questionnaire-renderer.test.tsx` already does.
   - **Commit:** `a88f112`.
5. **[Rule 1, bug] The per-section accessible name lost its space.**
   - **Found during:** Task 2 GREEN.
   - **Issue:** a leading space inside the `sr-only` span was dropped from the accessible name, which read `Add questionto {section}`.
   - **Fix:** the space moved to `{' '}` outside the span, as the W-9 `Edit question:` names do.
   - **Commit:** `a88f112`.

### Plan wording clarifications (not code deviations)

- **Stale line numbers:** the plan's line numbers had drifted, so every change was located by symbol or test name:
  - the review page's questions read is at `:50`;
  - the route source check is at `:646` (plan: `:547`);
  - E3's assertion is at `:391` (plan: `:308`);
  - the conformance print check is the `prints application pages without the shell` test.
- **GREEN commit types:** Tasks 1 and 2 committed GREEN as `fix(10-09)`, as the plan names them; Task 3 used `feat(10-09)`.
- **The journey's add step:** `QUES08_ADD_TO_GENERATED_SECTIONS` uses the editor-level add and the `Section` select, which exist after Task 1, so the step does not depend on Task 2's per-section controls.

---

**Total deviations:** 5 auto-fixed (4 blocking, 1 bug), plus plan-wording clarifications.
**Impact on plan:** each fix was needed to prove or ship D-04 to D-07. No content type, Strapi source, dependency, specification or `CSRM_AI_*` setting changed.

## TDD Gate Compliance

- Each task has a RED `test(10-09)` commit before its GREEN commit: `e66a853` then `8cd30f3`, `4222a7e` then `a88f112`, and `2dec5f2` then `d485a37`.
- All three RED runs returned `RED_EVIDENCE_OK`.
- Tasks 1 and 2 committed GREEN as `fix(10-09)`, as the plan names them, so a `feat(`-only gate scan finds only Task 3's GREEN commit.
- No REFACTOR commit was needed.

## Issues Encountered

- A Bash heredoc halved a doubled backslash on its way to Python, and another heredoc with typographic apostrophes ended early. Both edits were rerun from scripts and files in the scratchpad.
- The `Add question to {section}` names needed `{' '}` outside the `sr-only` span (deviation 5).

## Deferred

- **Hosted-provider manual check:** adding a question to a questionnaire the hosted provider generated stays a manual check (VALIDATION Manual-Only; coverage D10). The hosted `section-N` shape is covered by the placement unit cases.
- **The timeline still shows the key:** the revision timeline still names a cleared answer's question by key, and `questionnaire-governance-workflow.spec.ts` still finds `/hosting-model/` there (`.first()`). UI-SPEC rows E7 and E8 (Replace questionnaire, and the question text in that assertion) belong to the next plan in the UI-SPEC's numbering.

## Known Stubs

None. The Task 1 RED skeleton was replaced by the implementation in `8cd30f3`.

## Threat Flags

None. The new parser reads an existing analyst-only operation and adds no surface. The released list renders only question text, type, required flag, choices, sections and the served aggregate `progress` (T-10-21). Strapi still validates every placement (T-10-22). The placement parser declares no bound and passes all five parity modes (T-10-23).

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

Ready for 10-10. QUES-08 and UX-06 are not marked complete in REQUIREMENTS.md: other Phase 10 plans also declare them, and the shared-ID gate reports 0 of 2 ready.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*

## Self-Check: PASSED

The two created source files and this summary exist, and all six task commits (`e66a853`, `8cd30f3`, `4222a7e`, `a88f112`, `2dec5f2`, `d485a37`) are in the history.
