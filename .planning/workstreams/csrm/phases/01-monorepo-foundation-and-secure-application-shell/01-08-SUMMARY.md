---
phase: 01-monorepo-foundation-and-secure-application-shell
plan: "08"
subsystem: strapi-authorization
tags: [strapi, koa, sqlite, idor, http, node-test]
requires:
  - phase: 01-07
    provides: fail-closed FunctionAPI and ownership policy
provides:
  - mounted Strapi HTTP authorization regression suite
  - isolated SQLite authorization fixture with test-only identity propagation
  - server-derived Requestor collection scope below REST query validation
affects: [01-09, phase-08-keycloak]
tech-stack:
  added: []
  patterns: [mounted-http-authorization-proof, test-only-identity-middleware, document-layer-collection-scope]
key-files:
  created:
    - apps/strapi/tests/authorization.integration.test.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts
    - apps/strapi/tests/tsconfig.json
  modified:
    - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
    - apps/strapi/src/policies/csrm-authorization.ts
requirements-completed: [FOUND-04, FOUND-05]
duration: 36min
completed: 2026-08-28
---

# Phase 1 Plan 08: Mounted HTTP Authorization Summary

**Booted Strapi HTTP tests now prove owner access, cross-Requestor denial, collection isolation, and fail-closed missing identity behaviour against isolated SQLite state.**

## Accomplishments

- Added a reusable loopback Strapi harness with test-only header identity propagation.
- Replaced the misleading direct-policy integration filename with `authorization.policy.test.js`.
- Moved trusted collection scoping to Strapi's document layer after REST-query validation.

## Task Commits

1. **Tasks 1–2: mounted authorization proof and accurately named policy runner** — `78db19a`

## Deviations from Plan

### Auto-fixed Issues

**[Rule 1 - Integration defect] REST validation rejected policy-injected relation filters.** The controller now sends the policy-derived scope through the document layer, preserving server-side enforcement and client filter isolation.

**Total deviations:** 1 auto-fixed.

## Verification

- `tsc --pretty false`
- `tsc -p tests/tsconfig.json --pretty false`
- `node --test dist/tests/authorization.policy.test.js .tmp/tests-dist/tests/authorization.integration.test.js`
- `tsc --noEmit`
- `git diff --check`

All passed.

## Next Phase Readiness

Plan 01-09 can reuse the mounted harness for the seeded catalogue and complete PUT/DELETE matrix.
