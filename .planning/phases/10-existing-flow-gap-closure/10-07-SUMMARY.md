---
phase: 10-existing-flow-gap-closure
plan: 07
subsystem: ui
tags: [server-actions, refusal-copy, conflict-reasons, autosave, d-22, ux-06]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-06 TransportError.reason (the closed 18-code list on a 409); 10-04 and 10-05 the request and questionnaire actions whose refusals this plan words"
provides:
  - "apps/csrm/src/lib/api/refusal-copy.ts: UI-SPEC 10.2 families A to I with fallbacks, the 10.2 C answer-save sentences and kinds, and the 10.3 request sentence (zod-free, imports only the ConflictReason type)"
  - "reason?: ConflictReason on the failure branches of RequestActionResult, QuestionnaireActionResult, QuestionnaireGovernanceActionResult and AssessmentServerActionResult"
  - "failure?: 'blocked' | 'retryable' on every failed saveQuestionnaireDraftAction result (D-11)"
affects: [10-08 save status and autosave, 10-09 governance form Reload questions, request and questionnaire revert dialogs]

actuals:
  tokens: 12100
  tasks: 2
  commits: 4
plan_head_before: d4a8add3f32ace4256347488ddfe316e8ab35caf
plan_head_after: 4c16aa6806e163853b360204a719e4860791dcca

tech-stack:
  added: []
  patterns:
    - "A Server Action names its refusal family and passes the served reason: refusalMessage(family, reason) returns the family sentence or its fallback"
    - "A failure branch returns reason only when the transport served one (...withReason(reason)); Strapi's message never crosses"
    - "answerSaveRefusal(status, reason) owns both the sentence and the blocked/retryable kind of a failed answer save"

key-files:
  created:
    - apps/csrm/src/lib/api/refusal-copy.ts
    - apps/csrm/src/lib/api/refusal-copy.test.ts
  modified:
    - apps/csrm/src/features/requests/request-actions.ts
    - apps/csrm/src/features/requests/request-actions.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-actions.ts
    - apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts
    - apps/csrm/src/features/assessments/assessment-actions.ts
    - apps/csrm/src/features/assessments/assessment-actions.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts

key-decisions:
  - "10-07: a failed answer save is blocked on 403, 404 and every 409 (autosave stops until a refresh), and retryable on 400, answer field errors, 5xx and transport failures. A 404 is blocked because the questionnaire is gone and retrying cannot help; it keeps its 10.3 sentence."
  - "10-07: a save that fails the action's own validation is retryable with 'Some answers need attention before they can be saved.' when only answers are wrong (the field errors still map to their questions), and blocked with the existing 'Check the questionnaire details and try again.' when the save itself is malformed. A Strapi 400 carries no field errors to the web, so it reads the same attention sentence, retryable."
  - "10-07: a served reason is returned even when the family does not list it (for example a submit refused with QUESTION_REMOVED reads the D fallback and returns QUESTION_REMOVED); only closed-list codes ever reach an action."
  - "10-07: only saveQuestionnaireDraftAction returns failure; submit, revert and governance actions keep their 400, 403 and 404 messages (10.3). Generation start and retry map only a 409 through family I; their other statuses keep the assessment service messages, and every other assessment action is unchanged."

patterns-established:
  - "Refusal copy: a new refusal adds its sentence to its family in refusal-copy.ts and its row to refusal-copy.test.ts; a new code not yet listed reads the family fallback, which never asks for a reload"

requirements-completed: [UX-06]

coverage:
  - id: D1
    description: "Every UI-SPEC 10.2 row of families A to I reads its exact sentence, an absent or unlisted reason reads the family fallback, and no sentence asks to 'Reload and try again'"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/api/refusal-copy.test.ts#refusal copy by action and reason (UI-SPEC §10.2)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/refusal-copy.test.ts#refusal copy module (UI-SPEC §10.3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A refused request revert states its real reason in the dialog and returns the reason; request create, update and submit conflicts read 'This request can’t be saved in its current state.'"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-actions.test.ts#request return to draft refusals (UI-SPEC §10.2 A)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-actions.test.ts#request mutation action contract"
        status: pass
    human_judgment: false
  - id: D3
    description: "Questionnaire revert, submit, release, return to review, add, edit and delete refusals state their reason and return it; generation start and retry refusals read family I"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts#governance refusals"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts#questionnaire submit refusals (UI-SPEC §10.2 D)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-actions.test.ts#questionnaire generation refusals (UI-SPEC §10.2 I)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A failed answer save says whether it is blocked or retryable, so autosave can stop instead of looping"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts#answer save refusals tell autosave whether to stop (UI-SPEC §10.2 C, §6.1)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/refusal-copy.test.ts#answer save refusal (UI-SPEC §10.2 C and §6.1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "How each refusal reads inside its dialog and form on the running app"
    verification: []
    human_judgment: true
    rationale: "The actions' copy is unit-proven, but how a sentence sits in each dialog at 375 and 1440 is a visual check; plan 10-23 Task 2 walks both actors on the dev servers."

duration: 11min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 07: Refusal reasons in the Server Actions Summary

**Every request, questionnaire, governance and generation refusal now reads UI-SPEC §10.2's sentence for the reason Strapi served, from one zod-free copy module, and returns that reason; no action asks the person to "Reload and try again", and a failed answer save says whether autosave may retry.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-02T04:22:12Z
- **Completed:** 2026-10-02T04:33:30Z
- **Tasks:** 2 of 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `refusal-copy.ts` holds the eight families of §10.2 (A `requestRevert`, B `questionnaireRevert`, D `questionnaireSubmit`, E `questionnaireRelease`, F `returnToReview`, G `questionChange`, H `questionDelete`, I `questionnaireGeneration`), each a partial map from `ConflictReason` to its sentence plus a fallback. H reuses G's five shared sentences by reference. `refusalMessage(family, reason?)`, `answerSaveRefusal(status?, reason?)` (C), `answerSaveAttentionMessage` and `requestConflictMessage` (§10.3) are exported. It has no directive and imports only the `ConflictReason` type.
- `request-actions.ts`: the revert maps a 409 through family A and returns `reason`; create, update and submit map a 409 to `This request can’t be saved in its current state.`; the 400, 403, 404 and unavailable messages are unchanged.
- `questionnaire-actions.ts`: revert (B), submit (D), release (E), return to review (F), add and edit (G) and delete (H) map a 409 through their family and return `reason`; the 400, 403, 404 and unavailable messages are unchanged. The save maps every failure through `answerSaveRefusal` and returns `failure: 'blocked' | 'retryable'`.
- `assessment-actions.ts`: questionnaire generation start and retry map a 409 through family I and return `reason`; every other action keeps `serviceFailure`.
- The interface copy guard reads `src/lib/api/refusal-copy.ts` (sorted into `guardedFiles`); it passes.

## Task Commits

1. **Task 1 (tracer): a refused request revert shows its real reason, end to end**
   - RED `1932127`: `test(10-07): expect each refusal family to state its real reason`
   - GREEN `b387d35`: `fix(10-07): say why a request cannot return to draft`
2. **Task 2: questionnaire, governance and generation refusals by reason, and the save failure kind**
   - RED `37479be`: `test(10-07): expect questionnaire and generation refusals by reason and a save failure kind`
   - GREEN `4c16aa6`: `fix(10-07): state the real reason for questionnaire, governance and generation refusals`

## Tests run

- **Task 1 RED:** `refusal-copy.test.ts` and `request-actions.test.ts`: 66 failed, 1 passed (67). Every failure was a planned assertion (the absent copy module, the old 409 sentence, the missing `reason`); the pass is the unchanged-messages guard. `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the target test `states that work has started and returns the served reason`.
- **Task 1 GREEN:** the same two files 67/67; web typecheck clean.
- **Task 1 tracer gate:** the run is interactive and `end-of-phase`, and the verify step is automated only. Verify passed end to end after GREEN, so expansion continued.
- **Task 2 RED:** `questionnaire-actions.test.ts` and `assessment-actions.test.ts`: 60 failed, 26 passed (86). All 60 failures were `AssertionError`s on the planned copy, `reason` or `failure`; the passes are the existing tests and the unchanged-message guards. `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for `a 409 QUESTIONNAIRE_ALREADY_SUBMITTED is blocked, states the reason and returns it`.
- **Task 2 GREEN (the plan's verify):** `src/features/questionnaires`, `src/features/assessments`, `src/features/requests`, `src/lib/api` and the copy guard: 36 files, 563 passed, 0 failed; web typecheck clean.
- **Full web suite** (`pnpm --dir apps/csrm test`): 121 files, 2,403 passed and 0 failed, in 28.9 s. Previously 2,267; this plan adds 136 tests.
- **Gates:** `pnpm --dir apps/csrm typecheck`, `lint` and `api:check` passed, followed by `git update-index --refresh`. The tree was clean apart from the three operator items.
- **Static guards:** `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` is empty.
- **Not run:** Strapi and Playwright, by design (the plan edits no Strapi source and runs no Playwright).

## Decisions Made

- **Save failure kinds:** blocked on 403, 404 and every 409; retryable on 400, answer field errors, 5xx and transport failures. A 404 is blocked because the questionnaire is gone and retrying cannot help.
- **Save validation:** if only answers fail the action's validation, the result is retryable. It reads the §10.2 C sentence `Some answers need attention before they can be saved.`, and the field errors still map to their questions. A malformed save (for example a bad document id) is blocked and keeps `Check the questionnaire details and try again.`. A Strapi 400 brings no field errors to the web, so it reads the same attention sentence and is retryable.
- **Unlisted reasons:** an action returns any closed-list reason it was served, even when its family does not list it. The copy is the family fallback.
- **Scope of `failure`:** only the answer save returns it. Submit, revert and the governance actions keep their 400, 403 and 404 messages (§10.3). Generation maps only a 409 through family I.
- **Visible effect today:** the renderer shows a save failure's `formError`, so a save refused for answer field errors now reads the C attention sentence instead of the renderer's own `Check the highlighted answers and try again.` fallback. The renderer tests mock the action and stay green. Plan 10-08's save status consumes `failure`.

## Deviations from Plan

None. The plan was executed as written.

## TDD Gate Compliance

Both tasks have a RED `test(10-07)` commit, each before its GREEN commit, and both RED runs validated `RED_EVIDENCE_OK`. The GREEN commits use the plan's own messages, `fix(10-07): ...`, rather than the reference's default `feat(10-07): ...`, because they correct misleading refusals rather than add a feature. No REFACTOR commit was needed.

## Issues Encountered

- A static `import * as refusalCopy from './refusal-copy'` would make the RED run a load failure (INVALID_RED). The test loads the module only when the file exists, through a joined specifier that Vite cannot fold at transform time, so RED fails on assertions.
- The working copies are CRLF (`core.autocrlf=true`), so the first scripted edit of `request-actions.test.ts` matched only some of its LF anchors. The miss was caught on the RED run (`revertRequestToDraft is not defined` in the mock factory) and fixed with the Edit tool before the RED commit. Later scripts normalised line endings before matching.
- The shell rejected one long heredoc, and nothing was written. The edit scripts went to the scratchpad and ran from there.
- vitest's TAP output has no `# tests/# pass/# fail` summary, so the RED evidence records add counts derived from the same `ok`/`not ok` lines before `check tdd-red-evidence` reads them.

## Known Stubs

None. The components already render each action's `formError`. Plan 10-08 (the save status) consumes `failure`, and plan 10-09 (the governance form's `Reload questions`) consumes `reason`.

## Threat Flags

None. T-10-16: families A to D use only the actor-neutral §10.2 sentences, and the tests assert the exact strings. T-10-17: results carry only the web's own sentence and the closed-list `reason`. The tests mock a `raw backend detail` message and assert it never appears.

## User Setup Required

None.

## Next Phase Readiness

- Plan 10-08 can drive the §6.1 save status from `failure`: stop autosave on `blocked` and offer `Refresh page`; retry on `retryable`.
- Plan 10-09 can show `Reload questions` when an add or edit result's `reason` is `DEFINITION_CONFLICT` or `QUESTION_REMOVED` (D-06).
- UI-SPEC §19.1 E2 (`Draft saved.` becomes `Saved at`) stays with the autosave plan; this plan changed no renderer copy.

## Self-Check: PASSED

- `refusal-copy.ts` and `refusal-copy.test.ts` exist on disk.
- All four task commits exist: `1932127`, `b387d35`, `37479be` and `4c16aa6`.
- `request-actions.ts` imports `refusalMessage`. `questionnaire-actions.ts` imports `refusalMessage` and `answerSaveRefusal`.
- `grep "Reload and try again"` over both action files prints nothing.
- The copy guard lists `src/lib/api/refusal-copy.ts`.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
