---
phase: 10-existing-flow-gap-closure
plan: 06
subsystem: api
tags: [strapi, openapi, conflict-reasons, transport, contract, d-22]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-04 canRevertRequestToDraft and 10-05 canRevertQuestionnaireToDraft / canReturnToAnalystReview, the web predicates whose refusals these reasons explain"
provides:
  - "One closed list of 18 conflict reason codes in Strapi (apps/backend/src/csrm/conflict-reasons.ts), in both conflict response schemas of the specification, and in the web (apps/csrm/src/lib/api/conflict-reasons.ts)"
  - "Every 409 the UAT met carries error.details exactly { reason } and leaves persistence deep-equal"
  - "TransportError.reason: the web keeps a 409's served reason only when isConflictReason accepts it"
  - "DEFINITION_CONFLICT on an add or edit placement clash (D-06)"
affects: [10-07, 10-09, questionnaire governance editor, request and questionnaire revert copy]

actuals:
  tokens: 12300
  tasks: 3
  commits: 5
plan_head_before: 4803bf04b7de29fc24555a04b664b8a4dc246386
plan_head_after: 5d048204d6ca118062077ba907cf4ab2edf4471c

tech-stack:
  added: []
  patterns:
    - "Workflow errors carry an optional ConflictReason as their last constructor argument; controllers pass conflictDetails(reason) as the details argument of ctx.conflict"
    - "A multi-condition guard splits so each throw names one rule and keeps its message"
    - "Governance log appends go through appendOrConflict and run before any write"
    - "A shared mounted fixture builder (tests/helpers/conflict-reason-fixtures.ts) builds one questionnaire per refusal and asserts 409, the exact details and a deep-equal snapshot"

key-files:
  created:
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - apps/backend/tests/helpers/conflict-reason-fixtures.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/tests/request-workflow.integration.test.ts
    - apps/backend/tests/questionnaire-workflow.integration.test.ts
    - apps/backend/tests/questionnaire-governance.integration.test.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/backend/tests/questionnaire-governance.unit.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/transport/server-client.ts
    - apps/csrm/src/lib/api/transport/server-client.test.ts

key-decisions:
  - "10-06: ASSESSMENT_STARTED covers an existing assessment or a request at an assessment stage (risk-assessment-drafted, under-review, approved, closed: ASSESSMENT_STAGE_REQUEST_STATUSES); any other non-releasable stage, or no request, is REQUEST_NOT_ELIGIBLE. One rule for questionnaire revert, release, the analyst-review gate and return to review."
  - "10-06: the web keeps a served reason only on a 409 (status === 409) and only when isConflictReason accepts it; message, name and every other detail stay behind (T-10-14)."
  - "10-06: governance log appends run before any write (return to review and add question were reordered), so HISTORY_UNAVAILABLE never leaves answers returned to draft or a question created."
  - "10-06: the spec carries the 18-code enum inline in both error schemas, as the plan's acceptance criterion reads; conflict-reasons.unit.test.ts and conflict-reasons.test.ts keep the two copies and both code lists equal."

patterns-established:
  - "Conflict reason: new ConflictCode goes in all three lists in one change; the equality tests fail otherwise"
  - "Refusal proof: assertConflictReason(harness, fixture, send, reason, diagnostic) asserts 409, details exactly { reason } and a deep-equal questionnaire, questions and request"

requirements-completed: [UX-06, QUES-08]

coverage:
  - id: D1
    description: "A refused request return to draft names REQUEST_NOT_SUBMITTED or REQUEST_WORK_STARTED (to the analyst and the owner) and writes nothing"
    requirement: "UX-06"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-workflow.integration.test.ts#request revert returns only eligible submitted requests to draft with server-owned audit facts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every questionnaire save, submit and return-to-draft refusal names its reason and writes nothing"
    requirement: "UX-06"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-workflow.integration.test.ts#mounted questionnaire answer and reversal conflicts name their reason and write nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every governance refusal (release, return to review, add, edit, delete) names its reason and writes nothing, including DEFINITION_CONFLICT on a placement clash"
    requirement: "QUES-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-governance.integration.test.ts#mounted governance conflicts name their reason and leave the questionnaire unchanged"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#the analyst-review gate accepts only the editable questionnaire stage"
        status: pass
    human_judgment: false
  - id: D4
    description: "Generating a questionnaire for a request that is not submitted names REQUEST_NOT_ELIGIBLE and writes nothing"
    requirement: "QUES-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted questionnaire generation refuses non-submitted requests"
        status: pass
    human_judgment: false
  - id: D5
    description: "The web transport keeps only a closed-list reason on a 409 and drops everything else from the error body"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/api/transport/server-client.test.ts#normalizeTransportError"
        status: pass
    human_judgment: false
  - id: D6
    description: "The reason list is one list in Strapi, both conflict response schemas and the web"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "apps/backend/tests/conflict-reasons.unit.test.ts#the conflict reason list Strapi raises is the list both conflict response schemas publish"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/conflict-reasons.test.ts#conflict reasons"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (clean)"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 06: Closed conflict reason codes Summary

**Every 409 the UAT met now names the one rule that refused it in `error.details.reason`, from a closed 18-code list that Strapi raises, both conflict response schemas publish and the web transport validates. Each refusal is proven to write nothing.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-10-02T03:42:28Z
- **Completed:** 2026-10-02T04:18:29Z
- **Tasks:** 3 of 3
- **Files modified:** 20 (5 created, 15 modified)

## Accomplishments

- Strapi's `CONFLICT_REASONS` (frozen, in the plan's order) and `ConflictReason`, with `conflictDetails(reason)` for the controllers.
- `AssessmentRequestWorkflowError`, `QuestionnaireWorkflowError`, `QuestionnaireGovernanceError` and `QuestionnaireGenerationWorkflowError` carry an optional `reason`. Every throw site in the plan's table names its code, and the multi-condition sites are split so each throw names one rule and keeps its message. `:529` (the missing document-service `create`) keeps no code, as planned.
- `denyConflict(ctx, message, reason?)` and `safeError(ctx, status, message, reason?)` pass `{ reason }` as the details argument of `ctx.conflict` and in their fallback bodies. Every catch of the four error classes passes `error.reason`.
- `governanceConflict` maps a `QuestionnaireDefinitionError` to `DEFINITION_CONFLICT` (D-06) and a `GovernanceLogError` to `HISTORY_UNAVAILABLE`. Every governance log append goes through `appendOrConflict`, so a full or unreadable log becomes `HISTORY_UNAVAILABLE` and never an uncaught error.
- The spec declares `reason` (a closed string `enum`) under both `AssessmentWorkflowErrorResponse.error.details` (still `additionalProperties: false`) and `QuestionnaireWorkflowErrorResponse.error.details` (still `true`). `schema.d.ts` is regenerated and committed with the spec. No route, grant or success schema changed, so the catalogue copies, the authorization matrix and `served-operations.json` are untouched.
- The web's `conflict-reasons.ts` has no imports and no directive. `TransportError.reason?: ConflictReason`. `normalizeTransportError` reads `error.details.reason` through plain guards only for a 409 and keeps it only when `isConflictReason` accepts it. The generic message and the status are unchanged, and the ADR 0004 token forwarding in `createStrapiClient` is untouched.

## Each code and the test that proves it

All mounted cases assert 409, `error.details` deep-equal to `{ reason }`, and a deep-equal snapshot of the questionnaire (with its questions) and the request before and after. The exception is the request revert cases, which snapshot the request.

| Code | Proven by (test file: diagnostic) |
|------|-----------------------------------|
| `REQUEST_NOT_SUBMITTED` | request-workflow.integration: `UNEXPECTED_DRAFT_REVERT_REASON` (return of a draft request) |
| `REQUEST_WORK_STARTED` | request-workflow.integration: `UNEXPECTED_QUESTIONNAIRE_GUARD_REASON_{analyst,owner}` (questionnaire exists; same code to both actors) |
| `REQUEST_NOT_ELIGIBLE` | questionnaire-workflow.integration `REVERT_NOT_ELIGIBLE`; governance.integration `RELEASE_DRAFT_REQUEST`, `RETURN_DRAFT_REQUEST`, `EDIT_DRAFT_REQUEST`; generation.integration `QUESTIONNAIRE_GENERATION_NON_SUBMITTED_REASON`; governance.unit `STATUS_draft` |
| `ASSESSMENT_STARTED` | questionnaire-workflow.integration `REVERT_AFTER_ASSESSMENT`, `REVERT_WITH_ASSESSMENT`; governance.integration `RELEASE_AFTER_ASSESSMENT`, `RELEASE_AFTER_DRAFT_STAGE`, `RETURN_AFTER_ASSESSMENT`, `DELETE_AFTER_ASSESSMENT`; governance.unit `STATUS_*`, `ASSESSMENT` |
| `QUESTIONNAIRE_NOT_SUBMITTED` | questionnaire-workflow.integration `REVERT_NOT_SUBMITTED` |
| `QUESTIONNAIRE_NOT_ANSWERABLE` | questionnaire-workflow.integration `SAVE_NOT_ANSWERABLE`, `SUBMIT_NOT_ANSWERABLE` (request `under-review`) |
| `QUESTIONNAIRE_ALREADY_SUBMITTED` | questionnaire-workflow.integration `SAVE_SUBMITTED`, `SUBMIT_TWICE` |
| `QUESTIONNAIRE_INCOMPLETE` | questionnaire-workflow.integration `SUBMIT_INCOMPLETE` |
| `QUESTIONNAIRE_HAS_NO_QUESTIONS` | questionnaire-workflow.integration `SUBMIT_WITHOUT_ACTIVE_QUESTION`; governance.integration `RELEASE_WITHOUT_ACTIVE_QUESTION` |
| `QUESTIONNAIRE_RELEASED` | governance.integration `RELEASE_TWICE`, `EDIT_WHILE_RELEASED`, `ADD_WHILE_RELEASED`; governance.unit `RELEASED` |
| `ALREADY_IN_ANALYST_REVIEW` | governance.integration `RETURN_IN_REVIEW` |
| `DEFINITION_INVALID` | governance.integration `RELEASE_INVALID_DEFINITION` (two questions at one order) |
| `DEFINITION_CONFLICT` | governance.integration `ADD_PLACEMENT_CLASH`, `EDIT_PLACEMENT_CLASH` (another key holds section order 1) |
| `HISTORY_UNAVAILABLE` | governance.integration `RELEASE_FULL_HISTORY`, `RETURN_FULL_HISTORY`, `ADD_FULL_HISTORY`, `EDIT_FULL_HISTORY`, `DELETE_FULL_HISTORY` (log at 1,000 entries) |
| `QUESTION_REMOVED` | governance.integration `EDIT_REMOVED`, `DELETE_REMOVED` |
| `QUESTION_HAS_DEPENDENTS` | governance.integration `DELETE_WITH_DEPENDENT` |
| `LAST_ACTIVE_QUESTION` | governance.integration `DELETE_LAST_ACTIVE` |
| `ANSWER_DATA_INVALID` | governance.integration `RETURN_INVALID_ANSWER`, `EDIT_INVALID_ANSWER` |

Every code is reached mounted, so no unit fallback was needed for `DEFINITION_INVALID`, `ANSWER_DATA_INVALID` or `QUESTIONNAIRE_HAS_NO_QUESTIONS`.

## Task Commits

1. **Task 1 (tracer): a refused request revert carries its reason from Strapi to the web transport**
   - RED `c25b569`: `test(10-06): expect a refused request revert to name its reason end to end`
   - GREEN `388a09b`: `feat(10-06): name the rule behind a refused request revert in the conflict response` (spec and `schema.d.ts` together)
2. **Task 2: reasons on every questionnaire, governance and generation conflict**
   - RED `754e681`: `test(10-06): expect every questionnaire, governance and generation conflict to name its reason`
   - GREEN `3c12a82`: `feat(10-06): name the rule behind every questionnaire, governance and generation conflict`
3. **Task 3: the three lists are one** - `5d04820`: `test(10-06): prove the conflict reason list is the same in Strapi, the contract and the web`

## Tests run

- **Task 1 RED:** web `server-client.test.ts` had 1 failed and 23 passed. The failure was the planned assertion: `reason` was absent. Strapi `request-workflow.integration` had 1 failed and 3 passed: `UNEXPECTED_DRAFT_REVERT_REASON`, where `details` was `{}`.
- **Task 1 GREEN:** web `server-client.test.ts` and `server-only-boundary.test.ts` 54/54; `api:check` clean; web typecheck clean; Strapi `request-workflow.integration` 4/4.
- **Task 1 tracer gate:** the run was interactive and `end-of-phase`, and the verify step is automated only. Verify passed end to end, so expansion continued.
- **Task 2 RED:** the three integration files had 16 passed and 3 failed (19 tests). Each failure was its file's first reason assertion, where `details` was `{}`.
- **Task 2 GREEN:** the three integration files plus `questionnaire-workflow.unit`, `questionnaire-governance.unit` and `questionnaire-generation.unit` passed 50/50.
- **Task 3:**
  - Web `conflict-reasons.test.ts` 30/30 and Strapi `conflict-reasons.unit` 1/1.
  - **Discrimination check:** dropping `HISTORY_UNAVAILABLE` from the web list failed both schema-equality cases (2 failed, 27 passed). Dropping it from Strapi's list was refused at compile time by `tsc`, because the services use the code. Dropping it from `QuestionnaireWorkflowErrorResponse`'s enum in the spec failed the Strapi test (`CONFLICT_REASONS_DIVERGE_FROM_QuestionnaireWorkflowErrorResponse`). Each file was restored with `git checkout -- <file>`, and the test passed again.
- **Full Strapi suite** (`pnpm --dir apps/backend test`, dev servers stopped): 581 passed, 0 failed, 0 skipped, in 689 s (11 min 29 s). Previously 578; this plan adds 3 tests.
- **Full web suite** (`pnpm --dir apps/csrm test`): 120 files, 2,267 passed and 0 failed, in 27.6 s. Previously 2,223.
- **Gates:** `pnpm --dir apps/csrm typecheck` passed, `pnpm --dir apps/csrm lint` passed, and `pnpm --dir apps/csrm api:check` was clean, followed by `git update-index --refresh`.
- **Static guards:** `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` is empty. The plan changed neither catalogue copy, nor `served-operations.json`, nor the authorization matrix.
- **Not run:** Playwright, by design (the plan runs none).

## Decisions Made

- **One stage rule across workflows:** `ASSESSMENT_STARTED` means an assessment exists or the request is at `risk-assessment-drafted`, `under-review`, `approved` or `closed` (the exported `ASSESSMENT_STAGE_REQUEST_STATUSES`). Any other non-releasable stage, or no request, is `REQUEST_NOT_ELIGIBLE`. The same rule applies to the questionnaire revert, release, the analyst-review gate (used by add, edit and delete) and return to review. The governance refusal sets are unchanged; only the codes are new.
- **Return to review carries the gate's own reason:** it re-throws the inner gate's reason (`ASSESSMENT_STARTED` or `REQUEST_NOT_ELIGIBLE`) under its existing message.
- **Reasons cross only on a 409:** the transport keeps a reason only when the status is 409. A thrown error, a 400 or a missing body never carries one.
- **The enum is inline in both schemas** (the acceptance criterion's wording) rather than a shared component. The two equality tests keep the copies identical.
- **The generation registry carries no codes:** `QuestionnaireGenerationRegistryError` (for example "job could not be allocated") is outside the plan's table and keeps no code, so the web falls back to its generic message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A full governance log could leave a partial write behind**
- **Found during:** Task 2
- **Issue:**
  - `addQuestionnaireQuestion` created the question before appending its log event.
  - `returnQuestionnaireToAnalystReview` wrote every answer back to draft before appending its event.
  - With a full log, both threw after writing. This broke T-10-15's "throw sites keep their positions before any write".
- **Fix:** both now append, through `appendOrConflict`, before any write. The event content and log order are unchanged.
- **Files modified:** `questionnaire-governance-workflow.ts`
- **Verification:** `ADD_FULL_HISTORY_WRITE` and `RETURN_FULL_HISTORY_WRITE` assert deep-equal persistence.
- **Committed in:** `3c12a82`

**2. [Rule 3 - Blocking] A shared test helper was added outside `files_modified`**
- **Found during:** Task 2
- **Issue:** the workflow and governance files both need the same per-refusal fixture and snapshot. The harness's existing seeders are shared, and other tests depend on their counts.
- **Fix:** `apps/backend/tests/helpers/conflict-reason-fixtures.ts`. It builds one fixture per case through the harness's existing `createAssessmentRequestFixture`, `createFixtureDocument` and `createAssessmentFixture`. The harness itself is unchanged.
- **Committed in:** `754e681`

**3. [Rule 2 - Missing proof] The existing analyst-review gate unit test now asserts each reason**
- **Found during:** Task 2
- **Issue:** `questionnaire-governance.unit.test.ts` was in the plan's verify list and already tabulated every refusing stage, but it asserted only the status.
- **Fix:** each refusing case now also asserts its reason. The `draft` stage is now `REQUEST_NOT_ELIGIBLE`, and the assessment stages are `ASSESSMENT_STARTED`.
- **Committed in:** `3c12a82`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing proof).
**Impact on plan:** all three serve the plan's persistence and proof requirements. No scope creep, no content-type change and no new dependency.

## Issues Encountered

- `api:check` diffs the working tree against the index, so it fails until the regenerated `schema.d.ts` is staged. The spec and `schema.d.ts` were staged together and committed in `388a09b`, as the plan's contract rule requires. `api:check` was clean afterwards.
- Two scripted edits went wrong in the shell:
  - A heredoc was rejected before it ran, and nothing was written.
  - Backticks in a doc comment were taken by the shell, which blanked `risk-assessment-drafted` from the comment.
  Both were caught before commit and fixed with the Edit tool.

## Known Stubs

None. The copy each code maps to lands in plan 10-07, as planned. Until then, the web shows its existing generic messages, because no Server Action reads `TransportError.reason` yet.

## Threat Flags

None. The reason codes are actor-neutral (T-10-13): `REQUEST_WORK_STARTED` gives the owner the same code as the analyst and never says which work started. Only the closed-list reason crosses into the web (T-10-14). Every refusal asserts deep-equal persistence (T-10-15).

## User Setup Required

None.

## Next Phase Readiness

- Plan 10-07 can map each `TransportError.reason` to its UI-SPEC copy in the request, questionnaire and governance Server Actions. `DEFINITION_CONFLICT` should tell the analyst to reload for the latest questions (D-06).
- Adding a code later requires changing all three lists in one change. The equality tests fail otherwise.

## Self-Check: PASSED

- All five created files exist on disk.
- All five task commits exist: `c25b569`, `388a09b`, `754e681`, `3c12a82` and `5d04820`.
- `server-client.ts` imports `isConflictReason`.
- The web `conflict-reasons.ts` has no `server-only` and no zod import.
- Both schemas declare `REQUEST_WORK_STARTED`, and each keeps its own `additionalProperties`.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
