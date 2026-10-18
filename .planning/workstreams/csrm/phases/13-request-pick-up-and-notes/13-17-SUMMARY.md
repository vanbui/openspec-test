---
phase: 13-request-pick-up-and-notes
plan: 17
subsystem: api
tags: [strapi, ai-context, request-notes, ai-inputs-signal, request-assignment, openapi, zod]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the AI-input mark and its aiInputLog (13-05, 13-06), pickUpState (13-12), the v2 context summary that names the notes a run included (13-16)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: latestCompletedGenerationRun, projectAiGenerationFacts and the shared AiGenerationFacts parser (12-08), projectAssessmentGenerationFacts and the assessment's aiProvenance runId (12-09)
provides:
  - src/csrm/ai/ai-inputs-signal.ts: CONTEXT_WIDE_AI_OPERATIONS, the pure aiInputsChanged rule, loadAiInputsChanged and the AiInputsChanged types
  - AiGenerationFacts.aiInputsChanged on the analyst questionnaire and assessment reads (human Security Analysts only)
  - aiInputs { questionnaire, assessment } on the request read (human Security Analysts reading through the analyst grant only)
  - assignment { assignee, pickUp } and notes { total, unread } on the analyst questionnaire and assessment reads' request summary (loadAnalystRequestSummaryFacts)
  - Spec components AiInputsChanged, AiInputsChangedNote, RequestAiInputs, RequestSummaryAssignment, RequestSummaryNotes, and the generated client
  - Web parsers aiInputsChangedSchema, requestAiInputsSchema, requestSummaryAssignmentSchema, requestSummaryNotesSchema; the type AiInputsChanged in ai-assistance-domain.ts
affects: [13-18, 13-19, 14, 15, 16, 17]
actuals:
  tokens: 30500
  tasks: 2
  commits: 4
plan_head_before: 34054ba422de9d9692b9a2c32d8a17148fe67328
plan_head_after: fa159186f0be0f5461370449e7bd5e5bfeb7cfda
tech-stack:
  added: []
  patterns:
    - "One advisory rule in one leaf module, called by every read that serves it; the module imports only leaf parsers, so it never closes the CommonJS cycle through collection-scope"
    - "A loader that reaches cycle members (assignment policy, notes service) lives in its own module imported by controllers only"
    - "Required, nullable response fields the server always emits (null outside the one read that fills them), parsed closed on the web with absence read as null"
key-files:
  created:
    - apps/backend/src/csrm/ai/ai-inputs-signal.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-summary-facts.ts
    - apps/backend/tests/ai-inputs-signal.unit.test.ts
    - apps/csrm/src/features/requests/request-summary-schema.ts
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
    - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/request-notes/notes-actions.ts
    - apps/backend/tests/questionnaire-workflow.integration.test.ts
    - apps/backend/tests/request-notes.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/assessments/released-assessment-route.test.ts
    - apps/csrm/src/features/requests/request-service.test.ts
    - apps/csrm/src/features/request-notes/notes-actions.test.ts
    - apps/csrm/src/lib/performance/zod-client-boundary.test.ts
key-decisions:
  - "latestCompletedGenerationRun was not widened: questionnaire generation is the only context-wide operation that writes a questionnaire today, so the questionnaire's baseline stays exactly the run its generation.runId names."
  - "The assessment's baseline is the run its aiProvenance names (parseAssessmentAiProvenance(...).runId, the read's generation.runId), never a query over runs; the controller awaits loadAiInputsChanged and projectAssessmentGenerationFacts stays synchronous."
  - "A baseline run is used only when it is completed, its operation is in CONTEXT_WIDE_AI_OPERATIONS and it belongs to the same request; otherwise the record's generatedDate is the baseline; with neither there is no signal and no note is read."
  - "Fail visible (decision 454b03d): with the generatedDate fallback, a marked note whose aiInputLog cannot be parsed or holds no event that set the mark counts as changed; so does every marked note when the stored generation date cannot be read. A baseline run whose context summary the closed parser refuses reads as having included none, so every marked note shows."
  - "The run baseline carries the included notes' identities (documentId, part, sequence, postedAt) from the v2 summary, not only their ids, so an included-then-unmarked note is named without reading it again."
  - "Nothing changed reads null, as the plan's cases state, so a reader shows the signal exactly when it has notes to list; count always equals notes.length (a request holds at most 500 notes)."
  - "The signal in the questionnaire and assessment generation blocks is served to human Security Analysts only (the policy's humanAnalyst fact), not to every analyst-grant caller; the request read uses the assignment view's rule (analyst actor and humanAnalyst)."
  - "The request summary fields are required and nullable in the specification and always emitted (null on lists, mutation responses and a Requestor's reads); the web parsers read them closed and treat absence as null, so no projection or fixture of the shared summaries had to change."
  - "COLLAB-01 and REQ-08 stay Pending until the phase gate (the 13-03 to 13-16 precedent)."
requirements-completed: []
coverage:
  - id: D1
    description: "After Bob marks Jane's note, his questionnaire read's generation.aiInputsChanged and his request read's aiInputs.questionnaire list it as marked; a generation that included it clears the signal; unmarking it lists it as unmarked; Jane's reads carry no signal"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-workflow.integration.test.ts#mounted analyst reads say which marked notes changed the questionnaire's AI inputs since it was generated, and the Requestor's never do (D-29)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-notes.integration.test.ts#the request read carries the AI-inputs signal per target to human Security Analysts only (D-29)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The D-29 rule: no baseline no signal; run baseline marked and unmarked in sequence order; identical sets null; generatedDate fallback by the latest marking event, failing visible; v1 and unreadable summaries read as included none; only completed context-wide runs on the request; risk-scoped operations never context-wide"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/backend/tests/ai-inputs-signal.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The assessment read lists a note marked since the draft against the run its aiProvenance names and the request read agrees; a questionnaire or assessment generated before run records compares by its generation date; a seeded questionnaire has no signal"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted assessment read says which notes changed its AI inputs since the draft, and names the assignee and the notes (D-29, D-16, D-25)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-workflow.integration.test.ts#mounted questionnaire generated before run records compares by its generation date, and a seeded one has no signal (D-29)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The analyst questionnaire and assessment reads' request summary carries the assignee with the pick-up state and the notes figures; Jane's carries null for both"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-workflow.integration.test.ts#mounted analyst questionnaire read's request summary carries the assignee, the pick-up state and the notes; Jane's carries neither (D-16, D-25)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted Requestor reads require owner scope and the complete release aggregate"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
    human_judgment: false
duration: 80min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 17: The AI-Inputs-Changed Signal and the Request Summary Summary

**An analyst's questionnaire, assessment and request reads now say which notes changed each record's AI inputs since it was last generated. A note marked since that generation reads `marked`, and a note it used that has since been unmarked reads `unmarked`. The baseline is the run the read already names, or the generation date for a record generated before run records existed. A Requestor never sees the signal. The analyst questionnaire and assessment reads also say who holds the request, whether the viewer may pick it up, and how many notes it has.**

## Performance

- **Duration:** about 80 min, including the full Strapi suite
- **Started:** 2026-10-09T04:25Z
- **Completed:** 2026-10-09
- **Tasks:** 2 (each RED, then GREEN)
- **Files:** 4 created, 26 modified

## Accomplishments

- **One rule (D-29).** `src/csrm/ai/ai-inputs-signal.ts` holds `CONTEXT_WIDE_AI_OPERATIONS` (`questionnaire-generation` and `assessment-draft`; its comment says Phase 15's questionnaire proposals and Phase 16's "Suggest more risks" join it, and risk-scoped operations never do). It also holds the pure `aiInputsChanged({ markedNotes, baseline })` and the async `loadAiInputsChanged(strapi, { requestDocumentId, baselineRunId, generatedDate })`. The loader reads the baseline run, uses it only when it is completed, context-wide and on the same request, and parses its summary with `parseContextSummary` (a v1 summary reads as included none). Without a usable run it falls back to `generatedDate`, and with neither it returns null without reading a note. The module imports only the run record's and the note log's parsers, both leaves.
- **Where it is served.** The questionnaire read's `generation.aiInputsChanged` is measured against `latestCompletedGenerationRun` (`questionnaireAiInputsChanged`). The assessment read's is measured against the run its `aiProvenance` names (`assessmentAiInputsChanged`). The request read's `aiInputs` gives both targets through the same two helpers. All three are for human Security Analysts only.
- **The request summary (D-16, D-25).** `loadAnalystRequestSummaryFacts` returns `assignment: { assignee, pickUp }` from `pickUpState` and `projectPerson`, and `notes: { total, unread }` from `summarizeRequestNotes`. It is used on the analyst questionnaire and assessment reads. Every other projection of those summaries carries `null` for both, a Requestor's reads included.
- **Contract and web.** The new components are `AiInputsChanged` (count of at least 1, at most 500 notes), `AiInputsChangedNote` (closed), `RequestAiInputs`, `RequestSummaryAssignment` and `RequestSummaryNotes`. `AiGenerationFacts` requires `aiInputsChanged`. The request read requires `aiInputs`. `QuestionnaireAssessmentRequestAvailable` and `AssessmentRequestSummary` require `assignment` and `notes`. The generated client is regenerated. On the web, the shared `aiGenerationFactsSchema` requires `aiInputsChanged` (closed), the request read parser requires `aiInputs`, and both summary parsers read the new fields closed. `ai-assistance-domain.ts` gains only `export type AiInputsChanged`. `setNoteAiInputAction` also revalidates `/app/review/questionnaires` and `/app/review/assessments` by layout.

## Task Commits

1. **Task 1 RED** `eb5b131`: `test(13-17): expect the questionnaire to say when its AI inputs changed`
2. **Task 1 GREEN** `9c0a48e`: `feat(13-17): tell analysts when marked notes changed the questionnaire's AI inputs`
3. **Task 2 RED** `04b65d7`: `test(13-17): expect the AI-inputs signal rules and the request summary on both records`
4. **Task 2 GREEN** `fa15918`: `feat(13-17): show the assignee, notes and changed AI inputs on the questionnaire and assessment reads`

## Test Counts

| Run | Result |
| --- | --- |
| Task 1 RED, web (5 files) | 7 failed / 102 passed, each on the planned parser, fixture or revalidation assertion |
| Task 1 RED, Strapi (2 mounted cases) | # pass 0 / # fail 2 (`AI_INPUTS_CHANGED_BEFORE_ANY_NOTE`, `UNEXPECTED_BOB_AI_INPUTS`) |
| Task 1 verify, web (`src/features/questionnaires`, `assessments`, `requests`, `request-notes`, parity guard, zod boundary guard) | Test Files 51 passed, **Tests 1,220 passed** |
| Task 1 verify, Strapi (`questionnaire-workflow.integration`, `request-notes.integration`) | **# pass 25 / # fail 0** |
| Task 1 verify, `api:check` (after the commit), web typecheck, Strapi test compile | clean |
| Task 2 RED, web (2 files) | 2 failed / 81 passed (the request summary parsers) |
| Task 2 RED, Strapi unit | # pass 5 / # fail 2 (the generation-date cases) |
| Task 2 RED, Strapi mounted (name-filtered) | 3 planned failures (`AI_INPUTS_SUMMARY_ASSIGNMENT_BEFORE`, `AI_INPUTS_LEGACY_MARKED_NOTE_NOT_LISTED`, `SUMMARY_ASSIGNMENT_BEFORE_PICK_UP`); the updated release-aggregate case failed earlier in the filtered run on `OWNER_NEW_RELEASE_MISSING`, a fixture that earlier cases in its file seed, and passes in the full-file run |
| Task 2 verify, web (`src/features/assessments`, `questionnaires`, `requests`, `request-notes`, parity guard, zod boundary guard) | Test Files 51 passed, **Tests 1,223 passed** |
| Task 2 focused, Strapi (`ai-inputs-signal.unit`, `questionnaire-workflow.integration`, `request-notes.integration`, `assessment-workflow.integration`) | **# pass 74 / # fail 0** |
| Task 2 verify, `api:check` (after the commit), web typecheck | clean |
| **Full Strapi suite** (`pnpm --dir apps/backend test`, at `fa15918`) | **# tests 936 / # pass 936 / # fail 0** (16.7 min) |

**Module load order.** In fresh processes, each touched module was loaded first: `ai-inputs-signal`, `questionnaire-scope`, `assessment-scope`, `request-summary-facts`, `collection-scope`, and the questionnaire, assessment and request controllers. In each case `acceptsNotes("submitted")` stayed `true` and collection-scope's exports were defined. The notes window stays open (13-16's lesson).

## Decisions Made

See `key-decisions` above. In short:
- `latestCompletedGenerationRun` was not widened.
- The assessment's baseline is the run its `aiProvenance` names.
- A baseline run must be completed, context-wide and on the same request.
- The `generatedDate` fallback and an unreadable run summary both fail visible.
- Nothing changed reads null.
- The signal goes to human Security Analysts only.
- The request summary fields are required and nullable, always emitted, and parsed closed with absence read as null.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three web fixtures outside the plan's file list parse a `generation` block or the shared facts type**
- **Found during:** Task 1 GREEN (web typecheck and the questionnaires folder)
- **Issue:** `questionnaire-renderer.test.tsx` types a generation fixture as `AiGenerationFacts`, and `questionnaire-service.test.ts` parses one through the service. Both lacked the newly required `aiInputsChanged`.
- **Fix:** Each fixture gained the field. The service case also checks that the Requestor's reads drop the signal (`aiInputsChanged`, `note-1` added to its internals pattern).
- **Commit:** `9c0a48e`

**2. [Plan sequencing] The assessment's generation block carried `aiInputsChanged: null` between the two tasks**
- **Issue:** Task 1 makes `AiGenerationFacts.aiInputsChanged` required for both reads, but the plan serves the assessment target in Task 2.
- **Fix:** Task 1 served `null` on the assessment read so every commit keeps the read and the contract in step. Task 2 replaced it with the computed signal (`fa15918`).

**3. [Rule 2 - Structure] Two new modules beyond the plan's file list**
- `apps/backend/src/api/csrm-assessment-request/services/request-summary-facts.ts` holds the request summary loader. It reaches `pickUpState` and `summarizeRequestNotes`, both members of the load cycle through collection-scope. Putting it in `questionnaire-scope.ts` would have closed a new cycle (collection-scope already imports questionnaire-scope), so the controllers alone import it. The scopes import its type only.
- `apps/csrm/src/features/requests/request-summary-schema.ts` holds the two small closed parsers that the questionnaire and assessment schemas share. Neither schema module imports the other, and nothing is added to `request-domain.ts`'s shared chunk beyond types.
- `apps/csrm/src/features/questionnaires/questionnaire-domain.ts` gained the two optional fields so that its `SameType` check against the relationship parser still holds.

**4. [Expected test change] The release-aggregate case's bounded request summary**
- `assessment-workflow.integration.test.ts` "mounted Requestor reads require owner scope and the complete release aggregate" pinned the request summary's keys. The Requestor's summary now carries `assignment: null, notes: null`. The analyst's summary keeps the same four identity facts, and its two new objects are checked for their closed key sets. The change was committed in Task 2 RED (`04b65d7`).

## Threat Surface

T-13-54 (no signal or note figures on a Requestor's reads), T-13-55 (no note text in the signal: ids, parts, sequences, times and a change only) and T-13-56 (one `CONTEXT_WIDE_AI_OPERATIONS` list, with risk-scoped names tested absent) are mitigated as the register states. No new route, content-type change, dependency or grant was added. Every mounted case ran the deterministic provider.

## Known Stubs

None. The Task 1 interim `aiInputsChanged: null` on the assessment read was replaced in Task 2.

## Next Phase Readiness

13-18 can server-render the signal from `generation.aiInputsChanged` (questionnaire and assessment pages) and from `aiInputs` (the request hub). It can render the assignee and notes figures beside the originating request link from `assessmentRequest.assignment` and `.notes`. The mark action already revalidates those pages. Phases 15 and 16 add their operations to `CONTEXT_WIDE_AI_OPERATIONS` and attach their re-run actions to the same fields.

## Self-Check: PASSED

- The four created files exist (`ai-inputs-signal.ts`, `request-summary-facts.ts`, `ai-inputs-signal.unit.test.ts`, `request-summary-schema.ts`).
- Commits `eb5b131`, `9c0a48e`, `04b65d7` and `fa15918` are on the branch; `git rev-list --count 34054ba..fa15918` is 4.
