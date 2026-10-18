---
phase: 05-risk-register-and-mitigation-management
plan: 05
subsystem: api
tags: [strapi, risk-register, authorization, aggregate-projection, parent-lock]

requires:
  - phase: 05-risk-register-and-mitigation-management
    provides: Exact Security Analyst Risk Register scope and bounded repository patterns from Plan 05-02
  - phase: 04-assessment-generation-and-review
    provides: Transactional ancestor-locked Risk and ControlImplementation mutation services
provides:
  - Token-only exact-grant Security Analyst GET /v1/risks/:riskId route
  - Closed complete Risk projection with bounded relation labels and mitigation-control summaries
  - Server-owned mutable or released parent lock with partial release facts failing closed
  - Non-enumerating denied and missing Risk behavior before caller-selected lookup
affects: [05-07, 05-08, 05-09, risk-detail-ui]

tech-stack:
  added: []
  patterns: [authorization-before-lookup, complete aggregate projection, plus-one descendant bounds, server-owned parent lock]

key-files:
  created: []
  modified:
    - apps/strapi/src/api/csrm-risk/operations.ts
    - apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts
    - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
    - apps/strapi/src/api/csrm-risk/services/risk-register.ts
    - apps/strapi/tests/risk-register.unit.test.ts
    - apps/strapi/tests/risk-register.integration.test.ts

key-decisions:
  - "Reuse the exact human Security Analyst Risk Register scope for detail authorization before any caller-selected Risk lookup."
  - "Project one closed flat Risk aggregate with bounded ID/label relation summaries and a 1,000-item mitigation limit checked by a plus-one probe."
  - "Derive released state through the existing complete release predicate and expose mutable only for draft/in-review parents with no release facts; every partial or malformed release state returns the safe no-data path."

patterns-established:
  - "Risk detail completeness: malformed relations, missing ancestors, oversized descendants, and partial release facts discard the entire projection."
  - "Risk detail authorization: the token gate and exact catalogue grant establish analyst scope before query parsing or repository work."

requirements-completed: [RISK-02]

duration: 14min
completed: 2026-09-01
---

# Phase 5 Plan 5: Authorised Risk Aggregate Detail Summary

**Security Analysts can now load one closed contextual Risk aggregate with bounded relation labels, complete mitigation summaries, and an authoritative mutable or released parent lock.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-31T16:21:10Z
- **Completed:** 2026-08-31T16:34:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Mounted `GET /api/v1/risks/:riskId` behind the content API token gate, application gate, exact catalogue grant, and exact human Security Analyst Risk Register scope.
- Added a complete positive projection for every frozen Risk field, Risk type, owners, impacted system/asset, Assessment/request title, and ControlImplementation/reusable-Control summaries.
- Bounded mitigation descendants at 1,000 with a plus-one probe and made malformed, missing, oversized, and partial-release aggregates fail closed without partial Risk data.
- Proved existing and random Risk IDs are indistinguishable to Requestors, service/agent identities, inactive analysts, missing identities, and missing-token callers without persistence changes.
- Preserved the existing transactional Risk and ControlImplementation mutation boundary; the complete inherited mutation suite remains GREEN.

## Task Commits

Each task was committed through the plan TDD sequence:

1. **Task 1 RED: Specify the complete detail projection and parent-lock states** - `8eaeae4` (test)
2. **Task 2 GREEN: Mount and implement the complete Risk detail read** - `2701ea1` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-risk/operations.ts` - Exact catalogue operation identifier for Risk detail.
- `apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts` - Token-only analyst-scoped detail route beside the existing PATCH boundary.
- `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` - Closed-query detail controller and safe error handling.
- `apps/strapi/src/api/csrm-risk/services/risk-register.ts` - Bounded aggregate repository, closed projection, relation validation, and parent-lock derivation.
- `apps/strapi/tests/risk-register.unit.test.ts` - Exact key, relation, release-combination, denial-order, malformed-data, and plus-one-bound coverage.
- `apps/strapi/tests/risk-register.integration.test.ts` - Mounted authorization, token, released projection, partial release, missing ID, non-disclosure, and persistence coverage.

## Decisions Made

- Detail reads reuse the distinct `riskRegisterCollectionScope` established by Plan 05-02; navigation or broader analyst capabilities cannot substitute for the exact grant.
- The aggregate is projected only after all parent, relation, and mitigation descendants validate, so no partial response can cross the Strapi boundary.
- Parent lock state reuses the existing complete release predicate. There is no serialized `invalid` state and no client-visible release inference from status alone.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first GREEN run passed 89 of 90 tests; the remaining assertion used a descriptive fixture label instead of the seeded authoritative display name `Jane Doe`. Correcting that factual expectation produced a full pass without weakening the contract.
- The PowerShell `pnpm` shim does not preserve the required runtime. Package commands used the active Node 24.19.0 executable with its bundled Corepack pnpm entry point.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The only “not available” matches are the intentional safe Risk detail error envelope.

## Self-Check: PASSED

- All six modified implementation/test files and this Summary exist.
- TDD commits `8eaeae4` and `2701ea1` exist in RED-to-GREEN order.
- The complete Strapi suite passes all 90 tests under Node 24.19.0.
- Unit coverage passes all 10 Risk Register tests, including exact aggregate keys, every release-fact combination, malformed relations, and the 1,001-item bound probe.
- Mounted coverage proves exact-grant denial before lookup, token enforcement, closed released detail, safe missing/partial-release responses, persistence preservation, and no sensitive-field disclosure.
- No content-type schema, catalogue copy, package manifest, lockfile, mutation service, RED sentinel, `execArgv` guard, file guard, early return, focused test, or test skip changed or remains in the Plan 05-05 surface.

## Next Phase Readiness

- Plan 05-07 can freeze the complete generated Risk detail DTO against this mounted projection.
- Plan 05-08 can render the five detail sections and gate all mutation affordances directly from the server-owned `parentLock` discriminant.

---
*Phase: 05-risk-register-and-mitigation-management*
*Completed: 2026-09-01*
