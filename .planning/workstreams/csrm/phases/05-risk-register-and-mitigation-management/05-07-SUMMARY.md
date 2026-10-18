---
phase: 05-risk-register-and-mitigation-management
plan: 07
subsystem: api
tags: [openapi, openapi-fetch, zod, server-actions, risk-detail, parent-lock]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Authorised complete Risk aggregate detail and exact analyst grant from Plan 05-05
  - phase: 04-assessment-generation-and-review
    provides: Parent-locked Risk and ControlImplementation mutation services and writable schemas
provides:
  - Closed generated GET /v1/risks/{riskId} detail contract with safe no-data errors
  - Strict complete Risk aggregate parsing with mutable or released parent lock
  - Delta-only Risk and mitigation server actions with success-only route invalidation
  - One-read authoritative detail refresh after mutation conflicts
affects: [05-08, 05-09, risk-detail-ui, mitigation-management]

tech-stack:
  added: []
  patterns: [closed generated detail transport, strict aggregate trust boundary, authoritative conflict refresh]

key-files:
  created:
    - apps/web/src/features/risks/risk-actions.ts
    - apps/web/src/features/risks/risk-actions.test.ts
  modified:
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - apps/web/src/features/risks/risk-schema.ts
    - apps/web/src/features/risks/risk-service.ts
    - apps/web/src/features/risks/risk-service.test.ts

key-decisions:
  - "Represent Risk detail only as one complete mutable or released aggregate; malformed or partial release state remains a safe no-data result."
  - "Treat action values as already-computed deltas, reject empty updates server-side, and keep no-op handling local to the UI."
  - "After a 409, perform exactly one authoritative detail read without retrying the mutation or invalidating routes."

patterns-established:
  - "Risk detail transport: generated GET responses cross one strict closed Zod boundary before reaching a page consumer."
  - "Risk mutation conflicts: discard rejected values and return either authoritative detail or an explicit not-available discriminant."

requirements-completed: [RISK-02]

duration: 16min
completed: 2026-09-01
---

# Phase 5 Plan 7: Risk Detail Contract and Server Actions Summary

**A closed generated Risk aggregate now feeds strict server-only detail reads and delta-only mutation actions that refresh authority once after parent-lock races.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-31T17:20:46Z
- **Completed:** 2026-08-31T17:37:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added the stable `risk-register/get-risk` operation with opaque Risk identifier, complete closed detail/relation/mitigation schemas, bounded descendants, and safe 403/404/409 no-data envelopes.
- Generated the typed GET transport and added strict parsing that rejects extra identity/audit fields, partial aggregates, invalid release discriminants, malformed enums/dates, and over-populated mitigation arrays.
- Proved exact Security Analyst grant parity, Requestor absence, route and generated-operation parity, and byte-identical catalogue copies.
- Added strict server actions for Risk updates and mitigation create/update/delete using only the existing generated mutation services and writable schemas.
- Added exact register/detail invalidation after successful mutations and one authoritative detail read after every 409, with no retry or rejected-body disclosure.

## Task Commits

Each task was committed through its TDD sequence:

1. **Task 1 RED: Specify Risk detail transport** - `fd014a9` (test)
2. **Task 1 GREEN: Freeze Risk detail transport** - `df4f0de` (feat)
3. **Task 2 RED: Specify Risk detail actions** - `f1ba7e8` (test)
4. **Task 2 GREEN: Add Risk detail server actions** - `694752f` (feat)

## Files Created/Modified

- `docs/references/specification.json` - Closed Risk detail GET, aggregate DTOs, and safe no-data responses.
- `apps/web/src/lib/api/generated/schema.d.ts` - Reproducible typed Risk detail path and schemas.
- `apps/strapi/tests/contract-catalogue.integration.test.ts` - Exact operation, route, grant, error, generated-client, and catalogue parity proof.
- `apps/web/src/features/risks/risk-schema.ts` - Strict complete aggregate and bounded mitigation parsing.
- `apps/web/src/features/risks/risk-service.ts` - Server-only generated Risk detail GET.
- `apps/web/src/features/risks/risk-service.test.ts` - Complete, hostile, malformed, bounded, and safe-error transport coverage.
- `apps/web/src/features/risks/risk-actions.ts` - Closed delta-only Risk and mitigation actions with authoritative conflict refresh.
- `apps/web/src/features/risks/risk-actions.test.ts` - All-operation validation, routing, invalidation, failure, and 409 refresh coverage.

## Decisions Made

- There is no populated `invalid` Risk detail. Only complete `mutable` or `released` aggregates cross the web trust boundary.
- A mutation 409 exits editing through an explicit conflict result containing either one refreshed aggregate or a not-available discriminant with no Risk projection.
- Successful mutations invalidate `/app/risks` and the exact encoded detail route; rejected mutations and conflicts invalidate nothing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first full Strapi GREEN run showed the new detail GET had been added to the inherited Phase 4 mutation parity inventory, which imposed Phase 4 error references on the new read. The detail GET was moved to its dedicated Phase 5 parity block; the complete 94-test suite then passed without changing the frozen mutation contract.
- The PowerShell `pnpm` shim does not preserve the required runtime. Package commands used the active Node 24.19.0 executable with its bundled Corepack pnpm entry point.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The not-available strings are intentional closed failure states and contain no Risk projection.

## Self-Check: PASSED

- All eight created or modified implementation, contract, generated, and test files exist.
- TDD commits `fd014a9`, `df4f0de`, `f1ba7e8`, and `694752f` exist in RED-to-GREEN order.
- The complete Strapi suite passes all 94 tests under Node 24.19.0.
- API regeneration is clean; 18 focused Risk action/service tests and strict TypeScript typecheck pass.
- Catalogue copies remain byte-identical at SHA-256 `A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89`.
- No raw fetch, `PHASE5_RED`, `execArgv`, focused/skip escape hatch, file-existence guard, early return, TODO, FIXME, placeholder, or known stub remains in the Plan 05-07 surface.

## Next Phase Readiness

- Plan 05-08 can render the five Risk detail sections from one complete aggregate and switch mutation UI solely from `parentLock`.
- The dedicated editor can send computed deltas directly to the strict actions and replace local state from the authoritative 409 result.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
