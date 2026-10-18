---
phase: 07-requestor-request-workflow
plan: "04"
subsystem: auth
tags: [nextjs, server-actions, request-workflow, strapi, authorization, vitest]
requires:
  - phase: 07-requestor-request-workflow
    provides: Server-only typed request transport with an internally authenticated actor assertion.
provides:
  - Server-only trusted request actor resolution from the development/test HTTP-only cookie seam.
  - Safe typed Server Actions for draft saves, submissions, and withdrawals.
  - A production resolver replacement that supplies no fixture identity.
affects: [07-05-request-form, 07-06-request-details, 07-08-integration-hardening]
actuals:
  tokens: 4980
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns:
    - Server Actions parse only allowlisted persisted request fields and resolve actor identity internally.
    - Production NormalModuleReplacementPlugin swaps the fixture-backed actor resolver for an empty OIDC-ready seam.
key-files:
  created:
    - apps/csrm/src/features/requests/request-actions.ts
    - apps/csrm/src/features/requests/request-actions.test.ts
    - apps/csrm/src/features/requests/resolve-request-actor.ts
    - apps/csrm/src/features/requests/resolve-request-actor.production.ts
  modified:
    - apps/csrm/next.config.ts
key-decisions:
  - "Bind request identifiers outside FormData and derive the actor exclusively from the server cookie/runtime seam."
  - "Keep the production resolver intentionally empty until Phase 13 supplies the OIDC implementation behind the same interface."
patterns-established:
  - "Action state preserves allowlisted entered values, maps only approved field errors, and reports cache/navigation effects after server acknowledgement."
  - "Draft validation requires title only while submission validates all D-07/D-09 persisted essentials before any service call."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: Trusted actor resolution and safe draft, submit, and withdraw Server Actions reject forged FormData authority fields.
    requirement: CSRM-05
    verification:
      - kind: unit
        ref: yarn workspace @idambox/csrm test:unit --run src/features/requests/request-actions.test.ts
        status: pass
      - kind: integration
        ref: yarn workspace @idambox/csrm build
        status: pass
    human_judgment: false
duration: 12m
completed: 2026-08-22
status: complete
---

# Phase 07 Plan 04: Trusted Request Actor and Server Actions Summary

**Server-only Requestor actor resolution with allowlisted draft, submit, and withdraw actions that preserve safe form state and cannot accept browser-supplied authority.**

## Performance

- **Duration:** 12m
- **Started:** 2026-08-22T14:14:59Z
- **Completed:** 2026-08-22T14:20:19Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Added an HTTP-only cookie/runtime resolver that exposes only a trusted actor email to request actions; production replaces it with an empty resolver pending Phase 13 OIDC.
- Added shared draft/submit parsing and validation for persisted fields, stable field IDs, safe action state, and Strapi-only lifecycle transitions.
- Added focused regression coverage for forged FormData authority, no-call validation failures, safe errors, and production resolver exclusion.

## Task Commits

1. **Task 1: Resolve the trusted request actor and define safe save/submit/withdraw Server Actions** — `1a7d899` (RED coverage), `87c5723` (implementation).

## Files Created/Modified

- `apps/csrm/src/features/requests/request-actions.ts` — server-only request parsing, validation, action state, revalidation, and typed service calls.
- `apps/csrm/src/features/requests/request-actions.test.ts` — focused safe-action and fixture-exclusion tests.
- `apps/csrm/src/features/requests/resolve-request-actor.ts` — development/test cookie-backed trusted actor seam.
- `apps/csrm/src/features/requests/resolve-request-actor.production.ts` — production-safe resolver with no fixture imports.
- `apps/csrm/next.config.ts` — narrowly matched production module replacement for the actor resolver.

## Decisions Made

- The Server Action ignores every authority-bearing FormData value and passes only the internally resolved actor email and allowlisted DTO to the typed service.
- Submitted requests are saved with complete validation before the explicit transition; failure state is returned without an optimistic status claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hoisted Vitest service mocks before module evaluation**
- **Found during:** Task 1
- **Issue:** Vitest hoists `vi.mock` factories, so ordinary top-level mock declarations caused the focused suite to fail before executing assertions.
- **Fix:** Used `vi.hoisted` for the resolver and typed-service mocks.
- **Files modified:** `apps/csrm/src/features/requests/request-actions.test.ts`
- **Verification:** Focused action suite passed all five cases.
- **Committed in:** `87c5723`

**Total deviations:** 1 Rule 1 test-harness correction. No scope expansion, package mutation, or security-boundary change.

## Issues Encountered

- Full `yarn workspace @idambox/csrm verify` remains blocked by the three pre-existing stale capability-count assertions that expect 23 capabilities while the catalogue contains 27. The focused action suite, CSRM type check, production build, and backend type check pass; the known out-of-scope failure remains documented from Plan 07-03.

## Known Stubs

None.

## Verification

- `yarn workspace @idambox/csrm test:unit --run src/features/requests/request-actions.test.ts` — passed (5 tests).
- `yarn workspace @idambox/csrm check-types` — passed.
- `yarn workspace @idambox/csrm build` — passed, including production actor resolver replacement.
- `yarn workspace backend check-types` — passed.
- `yarn workspace @idambox/csrm verify` — blocked only by the known, unrelated 23-vs-27 stale capability-count tests.
- Package manifests and `yarn.lock` — unchanged.

## Next Phase Readiness

Plan 07-05 can bind the Server Actions from the progressive New Request form without exposing fixture identity, tokens, system-owned fields, or lifecycle authority to the browser.

## Self-Check: PASSED

Confirmed all five planned implementation artifacts and both TDD commits (`1a7d899`, `87c5723`) exist; neither task commit deletes tracked files.
