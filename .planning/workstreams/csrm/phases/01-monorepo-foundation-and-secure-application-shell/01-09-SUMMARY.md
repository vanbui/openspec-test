---
phase: 01-monorepo-foundation-and-secure-application-shell
plan: "09"
subsystem: strapi-authorization
tags: [strapi, function-api, bootstrap, sqlite, http, idor]
requires:
  - phase: 01-08
    provides: mounted HTTP authorization harness
provides:
  - one seedable API-only FunctionAPI grant graph for every served assessment-request route
  - mounted collection, create, PUT, PATCH, and DELETE authorization matrix
affects: [phase-02, phase-08-keycloak]
tech-stack:
  added: []
  patterns: [catalogue-byte-parity, seeded-role-function-api-graph, persisted-http-authorization-proof]
key-files:
  created: []
  modified:
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/tests/authorization.integration.test.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts
requirements-completed: [FOUND-04, FOUND-05]
completed: 2026-08-28
---

# Phase 1 Plan 09: Canonical Grant Graph and HTTP Matrix Summary

**The catalogue now exposes one API-only, Role → Function → FunctionAPI grant graph for each of the five served assessment-request routes, with mounted HTTP coverage for collection scope and mutation authorization.**

## Accomplishments

- Added the non-navigation `function.risk_assessment_requests.core_api` Function and its five canonical served-route grants.
- Assigned that Function to Requestor, Security Analyst, and Security Analyst Agent, and removed the duplicate proposed new-request PATCH contract while retaining request-details PATCH documentation.
- Made the isolated HTTP harness invoke the actual CSRM bootstrap seed and added Requestor, analyst, inactive, and no-explicit-analyst-grant identities.
- Added assertions for catalogue route uniqueness, collection isolation, server-derived POST ownership, canonical PUT persistence/denial, PATCH rejection, and denied/granted DELETE persistence.

## Task Commit

1. **Tasks 1–2: canonical seed graph and mounted authorization matrix** — `03452b8`

## Verification

- Passed: byte-identical catalogue hash and a Node integrity assertion proving each production operation occurs exactly once.
- Passed: `git diff --check`.
- Blocked: the package test/typecheck currently fails before executing the new suite because pre-existing `src/bootstrap/seed-csrm-data.ts` Strapi generated-type errors reject fields used throughout that existing seeder (lines 363, 426, 468, 502, 514, 561, 599, and 624). No Plan 01-09 source edit was made outside its assigned files to suppress those unrelated errors.

## Next Phase Readiness

Phase 1 implementation is complete, but repair or regenerate the stale Strapi generated types before treating the full package test command as green. Phase 2 can use the canonical core grants as its authoritative served-route baseline.
