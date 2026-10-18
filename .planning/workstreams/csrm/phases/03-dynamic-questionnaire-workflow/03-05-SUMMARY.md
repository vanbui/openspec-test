---
phase: 03-dynamic-questionnaire-workflow
plan: 05
subsystem: questionnaire-workflow
tags: [strapi, questionnaire, authorization, transaction, conditional-validation]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: Versioned questionnaire JSON contract and owner-scoped mounted reads from Plans 03-02 and 03-04
provides:
  - Server-side schemaVersion 1 definition graph and value validation
  - Owner-only draft save with hidden-answer clearing and server-owned lifecycle metadata
  - Complete active-answer submission using one transaction and one server timestamp
affects: [03-06, 03-07, 03-09, 03-10, questionnaire-backend, questionnaire-web]

tech-stack:
  added: []
  patterns: [closed persisted JSON validation, policy-derived mutation actor, transaction-scoped batch submission]

key-files:
  created:
    - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts
    - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
    - apps/strapi/tests/questionnaire-workflow.unit.test.ts
  modified:
    - apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
    - apps/strapi/tests/questionnaire-workflow.integration.test.ts

key-decisions:
  - "Parse persisted questionnaire options and answer envelopes independently inside Strapi before any draft or submit write."
  - "Treat submitted and questionnaire-in-progress as the only answerable request states, and make any submitted answer envelope lock the batch."
  - "Use Strapi's transaction context for answer and request mutations, with one server timestamp across every active submitted answer."

patterns-established:
  - "Questionnaire mutation boundary: exact questionKey/value input only; definitions, relations, state, and timestamps remain server-owned."
  - "Submission boundary: recompute visible active questions from persisted definitions, reject incomplete or unsupported required input, then commit the batch atomically."

requirements-completed: [QUES-02, QUES-03, QUES-04]

duration: 12min
completed: 2026-08-30
---

# Phase 3 Plan 5: Secure Draft and Atomic Submit Workflow Summary

**Owner-scoped questionnaire drafts now clear hidden answers and resume authoritative values, while complete active answer batches submit irreversibly in one Strapi transaction with one server timestamp.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-29T17:25:55Z
- **Completed:** 2026-08-29T17:36:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a closed server-side parser for schemaVersion 1 question definitions, type-compatible values, deterministic ordering, conditional graph edges, choices, and unsupported File upload behavior.
- Added exact mutation payload allowlisting, answerable request guards, immutable submitted-batch guards, hidden-answer clearing, and server-owned draft timestamps/state.
- Mounted exact PATCH answers and POST submit routes behind application enablement, catalogue authorization, ownership, and workflow-state checks.
- Submitted every active answer with one timestamp inside Strapi's transaction context, with an injected failure test proving no partial persistence.
- Proved cross-owner and analyst mutation denial, mass-assignment rejection, repeated-submit conflicts, persisted immutability, and successful owner save/submit over mounted HTTP.

## Task Commits

Each task was committed atomically:

1. **Task 1: 03-W0-01B: Specify state guards, mass-assignment denial, and atomic submit** - `ed69513` (test)
2. **Task 2: Implement server-owned draft and atomic submit workflow** - `2f00ac7` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts` - Closed persisted definition parser, value validation, ordering, and authoritative conditional visibility.
- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts` - Payload allowlisting, draft normalization, request guards, completeness, batch stamping, and transactional persistence.
- `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts` - Safe mutation dispatch and 400/403/404/409 error mapping without answer-body logging.
- `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts` - Protected PATCH answers and POST submit workflow routes.
- `apps/strapi/tests/questionnaire-workflow.integration.test.ts` - Mounted owner, IDOR, analyst, mass-assignment, immutability, draft, and submit evidence.
- `apps/strapi/tests/questionnaire-workflow.unit.test.ts` - Pure graph, hidden clearing, lifecycle, completeness, File upload, and rollback contracts.

## Decisions Made

- Persisted definitions and existing answer envelopes are treated as untrusted input and must pass closed server-side parsing before any mutation.
- The first draft from `submitted` advances its owning request to `questionnaire-in-progress`; subsequent saves preserve that state, and no other request state is answerable.
- Any submitted answer makes the questionnaire immutable, preventing mixed draft/submitted batches and repeated submission.
- Mutation routes reuse the already-authorized questionnaire workflow controller gateway for the Strapi Content API action while their exact PATCH/POST catalogue operations remain independently enforced by both route policies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking verifier] Used a case-sensitive RED output guard**
- **Found during:** Task 1
- **Issue:** The plan's case-insensitive `-match 'No test'` guard matched the existing passing test name “fails closed when no test identity is mapped.”
- **Fix:** Used the equivalent case-sensitive match so RED remained attributable to the required Phase 3 mutation sentinel.
- **Files modified:** None.
- **Verification:** RED ran after mounted read authorization baselines and emitted `PHASE3_RED_W0_01_MUTATION_GUARDS_ABSENT`.
- **Committed in:** `ed69513`

**2. [Rule 3 - Blocking integration] Preserved the existing least-privilege Content API action allowlist**
- **Found during:** Task 2
- **Issue:** Adding new users-permissions action names would require changing files outside this plan, while the exact mutation FunctionAPI policies already provide the authoritative authorization boundary.
- **Fix:** Routed PATCH/POST through the existing authorized workflow controller action and dispatched by method to the named `saveAnswers` and `submitQuestionnaire` services. Both mutation routes still enforce their exact catalogue operation and questionnaire ownership before dispatch.
- **Files modified:** `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts`, `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`
- **Verification:** Mounted owner mutations return 200, cross-owner and analyst mutations return 403, and all 19 Strapi tests pass.
- **Committed in:** `2f00ac7`

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking issues).
**Impact on plan:** Both adjustments kept execution inside the declared files without weakening the exact FunctionAPI, ownership, validation, or transaction boundaries.

## Issues Encountered

- Context7 was unavailable locally. Version-specific transaction behavior was verified against the installed Strapi 5.51.0 database declarations and implementation before using `strapi.db.transaction`.

## Verification Results

- `pnpm --filter @csrm/strapi test` - PASS (19/19 tests)
- Mounted owner draft save and valid submit - PASS
- Mounted cross-owner and analyst PATCH/POST denial with unchanged persistence - PASS
- Mass-assignment rejection and submitted-batch immutability - PASS
- Pure conditional visibility, hidden-answer clearing, state, completeness, File upload, and rollback contracts - PASS (5/5)
- GREEN integrity scan - PASS (no mutation RED sentinel or missing-module wrapper remains)
- Frozen questionnaire/question schema diff - PASS (no changes)
- Catalogue byte parity - PASS (`DFAF37F396C09DF582A6D0019FEBB860C7BCC6A5B36F39EB94ACD056D7C8EC2A`)

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-06 can seed realistic questionnaire definitions and answerable request state against the authoritative workflow service.
- Plans 03-07 and 03-09 can call the mounted draft/submit operations and share the same conditional semantics.
- No blocker remains for subsequent Phase 3 plans.

## Self-Check: PASSED

- All six created or modified implementation/test files and this summary exist.
- Task commits `ed69513` and `2f00ac7` are present in repository history.
- Final Strapi verification passes 19/19 tests; schema freeze, catalogue parity, and GREEN integrity checks pass.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
