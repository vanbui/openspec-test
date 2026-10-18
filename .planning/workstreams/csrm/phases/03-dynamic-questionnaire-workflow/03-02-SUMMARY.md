---
phase: 03-dynamic-questionnaire-workflow
plan: 02
subsystem: validation
tags: [zod, vitest, questionnaire, json-contract, conditional-visibility]

requires:
  - phase: 02-requestor-risk-assessment-request-workflow
    provides: Strict web validation patterns and server-owned workflow boundaries
provides:
  - Closed schemaVersion 1 questionnaire definition and answer normalization
  - Pure deterministic ordering, visibility, hidden-answer clearing, progress, and completeness operations
  - Documented fail-closed File upload deferral with no persisted schema changes
affects: [03-05-answer-workflow, 03-06-questionnaire-seed, 03-07-web-services, 03-09-questionnaire-renderer, 03-10-analyst-review]

tech-stack:
  added: []
  patterns: [closed external JSON normalization, earlier-question condition graph, pure derived questionnaire state]

key-files:
  created:
    - apps/web/src/features/questionnaires/questionnaire-schema.test.ts
    - apps/web/src/features/questionnaires/questionnaire-schema.ts
    - apps/web/src/features/questionnaires/questionnaire-domain.ts
    - docs/contract-gaps/phase-03-questionnaire-json-contract.md
  modified: []

key-decisions:
  - "Use schemaVersion 1 closed Zod definitions and reject unknown keys, versions, type mismatches, nondeterministic order, and invalid condition graphs."
  - "Represent File upload as unsupported/file-upload-deferred, accept only null, and block completeness when it is visible and required."
  - "Derive visibility, hidden-answer clearing, progress, and required completeness from normalized data with pure functions."

patterns-established:
  - "Questionnaire trust boundary: parse persisted options and answer JSON once into closed render-ready types."
  - "Conditional graph integrity: conditions reference only type-compatible earlier questions in deterministic order."

requirements-completed: [QUES-02, QUES-03, QUES-04, QUES-05]

duration: 4min
completed: 2026-08-30
---

# Phase 3 Plan 2: Versioned Questionnaire JSON Contract Summary

**Closed schemaVersion 1 Zod normalization with deterministic conditional behavior, hidden-answer clearing, and fail-closed File upload handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-29T16:50:13Z
- **Completed:** 2026-08-29T16:54:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Defined and tested every persisted answer type, closed definition/answer envelopes, choice compatibility, date formatting, submitted metadata, deterministic ordering, and condition graph integrity.
- Added pure domain operations for visibility, stale hidden-answer removal, active progress, required completeness, and matching submitted batches.
- Documented the exact persisted JSON keys, server-owned lifecycle metadata, derived states, security rationale, frozen-schema constraint, and explicit File upload deferral.

## Task Commits

Each task was committed atomically:

1. **Task 1: 03-W0-02: Specify versioned definitions, responses, conditions, and progress** - `ef830bf` (test)
2. **Task 2: Implement the documented schemaVersion 1 questionnaire engine** - `f5f067b` (feat)

## Files Created/Modified

- `apps/web/src/features/questionnaires/questionnaire-schema.test.ts` - Twenty-two unconditional contracts covering definitions, answers, graph failures, visibility, progress, and completeness.
- `apps/web/src/features/questionnaires/questionnaire-schema.ts` - Closed Zod schemas, normalized types, graph validation, answer-type cross-checking, and typed support state.
- `apps/web/src/features/questionnaires/questionnaire-domain.ts` - Pure deterministic grouping, visibility, hidden-answer clearing, progress, and required-answer validation.
- `docs/contract-gaps/phase-03-questionnaire-json-contract.md` - Versioned persistence convention, lifecycle ownership, derived states, limitations, and security rationale.

## Decisions Made

- Conditions fail closed unless they target an existing, type-compatible earlier question; section and question ordering must be unique and deterministic.
- Select values are constrained to configured unique choices, Date uses `YYYY-MM-DD`, and unknown properties are rejected instead of stripped into usable definitions.
- A visible required File upload remains incomplete until an authorised upload/storage contract exists; paths and URLs are never accepted as surrogates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test expectation] Corrected progress for a hidden dependent question**
- **Found during:** Task 2 focused GREEN verification
- **Issue:** The test expected four active questions even though an empty controlling Multi select correctly hid its dependent details question.
- **Fix:** Corrected the expected active total to three and percentage to 33 without weakening any assertion.
- **Files modified:** `apps/web/src/features/questionnaires/questionnaire-schema.test.ts`
- **Verification:** Plain focused Vitest run executes and passes all 22 assertions.
- **Committed in:** `f5f067b`

**2. [Rule 2 - Test integrity] Kept RED failure attributable to the absent implementation without a sentinel escape hatch**
- **Found during:** Task 1 RED verification
- **Issue:** The plan's sentinel-matching wrapper conflicted with the execution constraint forbidding RED-only sentinel wrappers, file guards, and early-return escape hatches in normal contract tests.
- **Fix:** Used ordinary static imports so RED failed on the genuinely absent schema module; removed the diagnostic comment when GREEN and retained unconditional final tests.
- **Files modified:** `apps/web/src/features/questionnaires/questionnaire-schema.test.ts`
- **Verification:** Final sentinel/guard scan is empty and the plain test command executes all 22 assertions.
- **Committed in:** `ef830bf`, `f5f067b`

---

**Total deviations:** 2 auto-fixed (1 test expectation, 1 test-integrity safeguard).
**Impact on plan:** Both adjustments preserve the intended contract and strengthen test integrity without scope expansion.

## Issues Encountered

- Context7 tooling was unavailable locally, so version-specific Zod usage was verified directly against the installed Zod 4 package through compilation and execution.

## Known Stubs

- `apps/web/src/features/questionnaires/questionnaire-schema.ts:240` deliberately emits `unsupported/file-upload-deferred`. This is the locked Phase 3 limitation, not a fallback value; visible required File upload questions fail completeness until a future authorised upload contract resolves it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-05 through 03-10 can consume the normalized types and pure operations for authoritative save/submit and shared Requestor/analyst rendering.
- Ready for 03-03, which defines the OpenAPI and catalogue questionnaire contract.

## Self-Check: PASSED

- Found all four created contract, schema, domain, and test files.
- Found task commits `ef830bf` and `f5f067b`.
- Plain focused Vitest passes 22/22 assertions; the full web suite passes 66/66; strict TypeScript passes.
- Contract key parity passed, both frozen Strapi questionnaire schemas are untouched, and no dependency change or new threat surface was introduced.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
