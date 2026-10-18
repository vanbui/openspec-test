---
phase: 03-dynamic-questionnaire-workflow
plan: 12
subsystem: questionnaire-e2e
tags: [playwright, strapi, nextjs, accessibility, authorization, questionnaire]

requires:
  - phase: 03-dynamic-questionnaire-workflow
    provides: Seeded questionnaire, secure workflow endpoints, typed web services, shared renderer, and role-specific routes from Plans 03-01 through 03-11
provides:
  - Green mounted Requestor-to-Security-Analyst questionnaire acceptance journey
  - OpenAPI-conformant authoritative mutation responses and bodyless persisted-draft submission
  - Responsive, keyboard, reduced-motion, axe, and direct no-content browser evidence
affects: [phase-03-verification, questionnaire-regression, analyst-review]

tech-stack:
  added: []
  patterns: [per-run isolated Playwright SQLite, authoritative mutation projection, cross-role mounted acceptance]

key-files:
  created: []
  modified:
    - apps/web/e2e/questionnaire-workflow.spec.ts
    - apps/web/playwright.config.ts
    - apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
    - apps/strapi/tests/questionnaire-workflow.integration.test.ts
    - apps/web/src/features/questionnaires/questionnaire-renderer.tsx
    - apps/web/src/features/questionnaires/questionnaire-renderer.test.tsx

key-decisions:
  - "Derive each Playwright database filename from the runner process so every mounted run starts on isolated questionnaire state."
  - "Return the closed OpenAPI QuestionnaireMutationResult projection from PATCH and POST rather than reusing the bounded questionnaire summary projection."
  - "Treat an absent submit body as an empty update list so bodyless POST submits the authoritative persisted draft batch."

patterns-established:
  - "Browser contract integrity: every Phase 3 assertion executes without sentinels, focused-test gates, file guards, or early returns."
  - "Validation summary focus: linked composite questions are programmatically focusable and announced through a named alert."

requirements-completed: [QUES-01, QUES-02, QUES-03, QUES-04, QUES-05]

duration: 16min
completed: 2026-08-30
---

# Phase 3 Plan 12: Questionnaire Workflow GREEN Gate Summary

**A real isolated Jane-to-Bob browser journey now proves conditional draft persistence, accessible validation, atomic immutable submission, and authoritative analyst read-only review across every Phase 3 quality gate.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-29T18:47:49Z
- **Completed:** 2026-08-29T19:04:08Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Removed the final deliberate Phase 3 browser sentinel and exercised every locked assertion unconditionally against fresh Strapi and Next.js servers.
- Covered Requestor discovery, conditional visibility, save/reload resume, linked validation focus, irreversible confirmation, submitted read-only state, role switch, and analyst review of the same authoritative answer.
- Added real 375px, 768px, and 1440px overflow checks together with keyboard, reduced-motion preference, serious/critical axe, draft-content masking, and signed-out direct-URL no-content assertions.
- Corrected the mounted mutation boundary to return the exact OpenAPI result shape and made contract-defined bodyless submission consume the persisted draft.
- Proved the full root test, type, API drift, production build, browser, schema freeze, catalogue parity, source invariant, and developer database integrity gates together.

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete the real Requestor-to-analyst journey** - `9cd1430` (fix)
2. **Task 2: Run the Phase 3 contract, security, and quality gate** - `59d204e` (test)

## Files Created/Modified

- `apps/web/e2e/questionnaire-workflow.spec.ts` - Full Requestor-to-analyst acceptance journey with accessibility, responsive, focus, persistence, immutability, and no-content assertions.
- `apps/web/playwright.config.ts` - Per-run isolated Phase 3 SQLite filename, explicit admin auto-open disablement, and no server reuse.
- `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts` - Closed authoritative mutation result projection matching the published OpenAPI contract.
- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts` - Bodyless submit uses the previously saved authoritative draft batch.
- `apps/strapi/tests/questionnaire-workflow.integration.test.ts` - Mounted response-shape and bodyless-submit regression assertions.
- `apps/web/src/features/questionnaires/questionnaire-renderer.tsx` - Named linked validation summary, composite focus targets, and explicit submitted acknowledgement.
- `apps/web/src/features/questionnaires/questionnaire-renderer.test.tsx` - Component regressions for validation summary and submission feedback plus zero literal sentinel match.

## Decisions Made

- Kept Playwright state unique per process rather than reusing a fixed database, while preserving the existing explicit `reuseExistingServer: false` and `STRAPI_ADMIN_AUTO_OPEN: false` safeguards.
- Reconstructed bounded question options in mutation responses from the already validated server definition instead of returning internal records or broadening the external contract.
- Kept validation guidance visible before submit and promoted it to a named alert, so the same linked summary supports proactive completion and invalid-submit focus recovery.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Returned the authoritative OpenAPI mutation result**
- **Found during:** Task 1 mounted draft save
- **Issue:** Strapi returned a questionnaire summary from PATCH/POST while the typed service correctly expected `QuestionnaireMutationResult`, causing a generic service failure after an HTTP 200 save.
- **Fix:** Added a closed mutation projection containing questionnaire ID, state, progress, normalized answers, and server timestamps, with mounted exact-key assertions.
- **Files modified:** `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`, `apps/strapi/tests/questionnaire-workflow.integration.test.ts`
- **Verification:** Full Strapi suite 21/21 and browser draft save/resume pass.
- **Committed in:** `9cd1430`

**2. [Rule 1 - Bug] Accepted contract-defined bodyless submission**
- **Found during:** Task 1 confirmed browser submit
- **Issue:** The OpenAPI POST operation has no request body, but the workflow required `{answers: []}` and rejected the typed client's bodyless request with 400.
- **Fix:** Treat an absent body as an empty update list and submit the persisted authoritative draft; mounted coverage now omits the POST body.
- **Files modified:** `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts`, `apps/strapi/tests/questionnaire-workflow.integration.test.ts`
- **Verification:** Mounted bodyless submit and complete browser submission pass.
- **Committed in:** `9cd1430`

**3. [Rule 2 - Missing critical accessibility] Completed linked validation focus and explicit success feedback**
- **Found during:** Task 1 active invalid-submit browser path
- **Issue:** Composite radio/checkbox questions were not programmatically focusable and the required-answer summary was not exposed as a named alert; successful submission also lacked the locked acknowledgement text.
- **Fix:** Added focusable fieldsets, a named linked validation alert, and explicit submitted acknowledgement while preserving the shared renderer.
- **Files modified:** `apps/web/src/features/questionnaires/questionnaire-renderer.tsx`, `apps/web/src/features/questionnaires/questionnaire-renderer.test.tsx`
- **Verification:** Renderer suite 9/9, axe checks, and Playwright focus/submission assertions pass.
- **Committed in:** `9cd1430`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical accessibility behavior).
**Impact on plan:** All fixes were required to make the published API and locked browser workflow agree; no new dependency, route, entity, schema, or authorization model was introduced.

## Issues Encountered

- The pnpm launcher emitted its known Node v22 engine warning while direct PATH resolution reported the required Node v24.19.0. All gates executed successfully without changing global tooling.

## Verification Results

- `pnpm test` - PASS (Strapi 21/21; web 93/93).
- `pnpm typecheck` - PASS.
- `pnpm --filter @csrm/web api:check` - PASS.
- `pnpm build` - PASS for Strapi and Next.js production builds.
- `pnpm --filter @csrm/web test:e2e -- questionnaire-workflow.spec.ts` - PASS against fresh real servers.
- Phase 3 test-integrity scan - PASS with zero `PHASE3_RED`, `execArgv`, or `expectsFocused` matches.
- Catalogue byte parity and frozen questionnaire/question schema diff - PASS.
- Raw-fetch, frontend-facade, duplicate-renderer, answer-logging, and File upload surrogate scans - PASS.
- Developer `apps/strapi/.tmp/data.db` SHA-256 remained `D705358B8C1FEAA0187466EA8C7A815BF75F9ADE1F05C5E1BEEC627D28DE3029`; all plan-specific databases were removed.

## Known Stubs

- `apps/web/src/features/questionnaires/questionnaire-renderer.tsx:148` deliberately renders File upload as unavailable because Phase 3 has no authorised upload, storage, scanning, or retention contract. Required active uploads fail closed and no surrogate input is exposed.

## TDD Gate Compliance

- The original browser RED contract is committed in `9df5fef` and the genuine GREEN implementation is committed in `9cd1430`; the sentinel is removed and the mounted journey passes unconditionally.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 is complete and ready for verification and transition.
- No known blocker remains; QUES-01 through QUES-05 pass across mounted backend, typed web, component, build, accessibility, responsive, and browser layers.

## Self-Check: PASSED

- All seven modified implementation/test files and this summary exist.
- Task commits `9cd1430` and `59d204e` exist in repository history.
- All acceptance criteria and the complete plan-level gate passed after the final code commit.

---
*Phase: 03-dynamic-questionnaire-workflow*
*Completed: 2026-08-30*
