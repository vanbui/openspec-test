---
phase: 02-requestor-risk-assessment-request-workflow
plan: 02
subsystem: auth
tags: [strapi, koa, development-auth, authorization, users-permissions]

requires:
  - phase: 01-monorepo-foundation-and-secure-application-shell
    provides: Strapi Role to Function to FunctionAPI authorization policy and seeded Jane/Bob identities
provides:
  - Double-gated development identity middleware backed by active persisted IdamBox users
  - Idempotent CSRM-only public Content API permission reconciliation
  - Mounted fail-closed HTTP and permission-store coverage
affects: [02-requestor-risk-assessment-request-workflow, web-development-session, playwright]

tech-stack:
  added: []
  patterns: [exact environment double gate, persisted development identity lookup, additive permission allowlist reconciliation]

key-files:
  created:
    - apps/strapi/src/middlewares/csrm-development-identity.ts
    - apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
  modified:
    - apps/strapi/config/middlewares.ts
    - apps/strapi/src/index.ts
    - apps/strapi/tests/helpers/strapi-http-harness.ts
    - apps/strapi/tests/authorization.integration.test.ts

key-decisions:
  - "The development bridge stores only the persisted user documentId in request state; all roles and grants remain server-resolved by the authorization policy."
  - "Development public permissions are reconciled additively so unrelated operator-managed permissions are preserved."

patterns-established:
  - "Development identity: require exact NODE_ENV=development and CSRM_DEV_IDENTITY=true values before reading the email header."
  - "Development permissions: export and validate a closed api::csrm-* action list, then create only missing public-role rows."

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

duration: 27min
completed: 2026-08-29
---

# Phase 02 Plan 02: Strapi Development Authentication Bridge Summary

**Active seeded IdamBox identities now cross a double-gated mounted Strapi middleware while development public access is limited to six explicit CSRM Content API actions.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-29T11:49:00Z
- **Completed:** 2026-08-29T12:16:25Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Mounted HTTP coverage proves Jane and Bob resolve only under both exact environment gates, while missing, unknown, inactive, disabled, and non-development cases remain anonymous and receive 403.
- The global middleware resolves an exact persisted email and contributes only the active user's document ID to the existing authorization spine.
- Development bootstrap reconciliation grants exactly six CSRM actions, rejects non-CSRM allowlist entries, preserves unrelated permissions, and remains stable across repeated calls.
- Backend test plumbing now compiles every TypeScript test and executes every emitted integration test file alongside the production policy suite.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mounted fail-closed identity and permission tests** - `06cdf2c` (test)
2. **Task 2: Implement the double-gated Strapi identity middleware** - `a64cecc` (feat)
3. **Task 3: Seed only required development CSRM Content API permissions** - `c814c6b` (feat)

## Files Created/Modified

- `apps/strapi/src/middlewares/csrm-development-identity.ts` - Exact-gated active persisted identity resolver.
- `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts` - Validated, additive six-action permission bootstrap.
- `apps/strapi/config/middlewares.ts` - Registers the identity resolver in the global HTTP pipeline.
- `apps/strapi/src/index.ts` - Runs permission reconciliation after existing data seeds.
- `apps/strapi/.env.example` - Documents the disabled development bridge default.
- `apps/strapi/tests/helpers/strapi-http-harness.ts` - Isolates environment state, reuses seeded identities, records mounted identity state, and inspects public permissions.
- `apps/strapi/tests/authorization.integration.test.ts` - Exercises the full identity gate matrix and permission contract.
- `apps/strapi/tests/tsconfig.json` - Includes all backend TypeScript test files.
- `apps/strapi/package.json` - Executes every emitted integration test file.

## Decisions Made

- Store only the persisted `documentId` in `ctx.state.idamboxUser`; the authorization policy continues to reload account status, roles, functions, and FunctionAPI grants from Strapi.
- Preserve public-role permissions that operators manage outside this bootstrap. Idempotence is achieved by creating only missing allowlisted rows, not deleting or rewriting unrelated records.
- Emit the exact planned RED sentinels only during the focused RED command, allowing the identity task's full-suite verification to remain meaningful before the subsequent permission task exists.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The harness initially attempted to create duplicate Jane and Bob records. It was corrected to use the active identities produced by the production CSRM seed, which also strengthens the persisted-identity contract.
- Timed-out diagnostic runs left test-runner child processes active. Only those plan-owned processes were stopped before a single isolated RED run was repeated successfully.

## Known Stubs

None.

## User Setup Required

None - the bridge remains disabled by default. Local development can opt in with the documented `CSRM_DEV_IDENTITY=true` setting while running with `NODE_ENV=development`.

## Next Phase Readiness

- The server-side web transport can now attach `x-csrm-dev-identity` for mounted browser workflows.
- Request workflow guards and collection scoping can build on the same persisted authorization state without trusting browser-supplied roles or record identifiers.
- No blockers remain for subsequent Phase 2 plans.

## Self-Check: PASSED

- All nine created or modified plan files exist.
- Task commits `06cdf2c`, `a64cecc`, and `c814c6b` exist.
- `npm test` passes all eight Strapi policy and mounted integration tests.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
