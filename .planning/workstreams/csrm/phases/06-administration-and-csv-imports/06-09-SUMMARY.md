---
phase: 06-administration-and-csv-imports
plan: 09
subsystem: administration-imports
tags: [strapi, nextjs, csv, transactions, accessibility]

requires:
  - phase: 06-08
    provides: bounded authoritative and advisory CSV parsing with five row states
provides:
  - Digest-bound Risk Type preview and confirmed commit through the exact frozen Strapi routes
  - Current-state reclassification with isolated per-row transactions and honest five-state results
  - Accessible capability-gated Guidance-to-Results import journey using the same File bytes
affects: [06-10, administration-imports, risk-types]

tech-stack:
  added: []
  patterns:
    - Authorization is asserted before multipart facts, parsing, lookup, or mutation
    - Preview is write-free and commit reparses identical bytes under serialized current-state authority
    - Each eligible row owns one transaction while unchanged, rejected, and ambiguous rows never write
    - Client parsing remains advisory and server-result drift stays visible without automatic retry

key-files:
  created:
    - apps/web/src/features/administration/csv-import-flow.tsx
    - apps/web/app/(app)/app/admin/[collection]/import/page.tsx
  modified:
    - apps/strapi/src/api/csrm-administration/services/administration-workflow.ts
    - apps/strapi/src/api/csrm-administration/services/administration-repository.ts
    - apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts
    - apps/strapi/tests/administration.integration.test.ts
    - apps/web/src/features/administration/administration-actions.ts
    - apps/web/src/features/administration/administration-service.ts
    - apps/web/src/features/administration/administration-service.test.ts
    - apps/web/src/features/administration/administration-workflow.test.tsx
    - apps/web/src/features/administration/csv-import-schema.ts

key-decisions:
  - "Bind commit to the literal confirmed=true value, the prefixed SHA-256 preview digest, and a second upload of the same File bytes."
  - "Reload and reclassify Risk Types inside the serialized commit boundary, then isolate every eligible row in its own repository transaction."
  - "Treat transport and 5xx commit failures as unknown outcomes that require collection inspection, never an automatic mutation retry."

requirements-completed: [ADMIN-04]

duration: 21 min
completed: 2026-09-02
---

# Phase 06 Plan 09: Risk Type CSV Import Summary

**Digest-bound Risk Type imports with write-free preview, authoritative current-state commit, isolated row rollback, and an accessible five-step review journey**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-01T18:40:39Z
- **Completed:** 2026-09-01T19:01:38Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Mounted only the frozen Risk Type preview and commit routes, preserving Strapi as the production API and authorization boundary.
- Enforced authorization before multipart inspection, exact byte limits, literal confirmation, prefixed digest equality, identical upload bytes, and authoritative current-state reclassification.
- Applied only `create` and `update` rows through one transaction per row; rollback converts expected row failures into bounded formula-safe results while unexpected infrastructure failures remain visible.
- Added strict preview/result DTO parsing and one-shot multipart transport with no manual `Content-Type`, mutation retry, or frontend API facade.
- Delivered the responsive five-step Guidance, Select file, Review rows, Confirm import, and Results experience with focus transfer, live announcements, five filters/counts, before/after changes, downloadable reports, explicit confirmation, drift messaging, and safe unknown-outcome recovery.
- Capability-gated the route before collection resolution so unauthorized requestors receive no collection clue or import call.

## Task Commits

1. **Task 1 RED: Define failing import boundary contracts** - `0ccd7bf` (test)
2. **Task 1 GREEN: Enforce digest-bound Risk Type imports** - `f2f0d3a` (feat)
3. **Task 2 RED: Define the failing five-step import journey** - `3ca609d` (test)
4. **Task 2 GREEN: Mount the accessible import journey** - `1e7cfeb` (feat)
5. **Overall verification fix: Type result drift comparison safely** - `1f7a6da` (fix)

## Files Created/Modified

- `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts` - Write-free preview, digest-bound commit, reclassification, transaction isolation, and safe results.
- `apps/strapi/src/api/csrm-administration/services/administration-repository.ts` - Bounded projected-field reads needed for honest current-state classification.
- `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts` - Exact multipart preview and commit controller wiring.
- `apps/strapi/tests/administration.integration.test.ts` - Mounted confirmation, rollback, unchanged, mismatch, and authorization proof.
- `apps/web/src/features/administration/csv-import-schema.ts` - Strict frozen preview and result trust-boundary schemas.
- `apps/web/src/features/administration/administration-service.ts` - Generated typed one-shot multipart calls.
- `apps/web/src/features/administration/administration-actions.ts` - Validated Server Actions with success-only revalidation and unknown-outcome handling.
- `apps/web/src/features/administration/administration-service.test.ts` - File-byte identity, no-header, no-retry, and action-boundary tests.
- `apps/web/src/features/administration/csv-import-flow.tsx` - Complete accessible five-step workflow.
- `apps/web/app/(app)/app/admin/[collection]/import/page.tsx` - Capability-first Risk Type import route.
- `apps/web/src/features/administration/administration-workflow.test.tsx` - Full forward/backward journey, outcome, focus, and zero-write coverage.

## Decisions Made

- The preview digest is a strict `sha256:<64 lowercase hex>` token and is compared against the authoritative digest of the commit upload; a mismatch is a deterministic 409.
- Commit re-runs parsing and classification against the latest persisted Risk Types inside the existing serialized workflow rather than trusting browser or earlier preview rows.
- Result drift counts rows whose final write result state differs from the authoritative commit-time classification, such as an expected row-level write rejection.
- Unknown mutation outcomes keep the confirmation context visible and direct the analyst to inspect Risk Types before considering another attempt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Expanded bounded natural-key projections for honest classification**
- **Found during:** Task 1 GREEN
- **Issue:** Existing-record lookup returned only the natural key, so authoritative parsing could not distinguish an unchanged row from an update.
- **Fix:** Reused the closed collection configuration to project its bounded editable fields without widening metadata or relation disclosure.
- **Files modified:** `apps/strapi/src/api/csrm-administration/services/administration-repository.ts`
- **Committed in:** `f2f0d3a`

**2. [Rule 1 - Bug] Removed an unsafe result-row cast found by the production Strapi compilation gate**
- **Found during:** Overall verification
- **Issue:** The drift helper unnecessarily required full preview rows even though commit results intentionally carry a smaller shape.
- **Fix:** Narrowed drift comparison to its actual row-state contract and removed the cast without changing runtime behavior.
- **Files modified:** `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts`
- **Commit:** `1f7a6da`

---

**Total deviations:** 2 auto-fixed correctness issues.
**Impact on plan:** Both changes are bounded within the existing adapter and result contract; no dependency, schema, catalogue, endpoint, or authorization model changed.

## TDD Gate Compliance

- RED commit `0ccd7bf` failed because preview/commit boundary behavior and real multipart web transport were absent.
- GREEN commit `f2f0d3a` follows it and passes the mounted Strapi and web service/action contracts.
- RED commit `3ca609d` failed because the five-step import component did not exist.
- GREEN commit `1e7cfeb` follows it and passes the complete accessible workflow journey.
- No sentinel, skip, `.only`, environment escape, file-existence bypass, or weakened denial assertion was introduced.

## Verification Evidence

- Node runtime — PASS: v24.19.0.
- Strapi production/test compilation and full mounted suite — PASS, 111/111 tests.
- Web full suite selected through the plan command — PASS, 36 files and 276/276 tests.
- Import workflow component — PASS, 12/12 tests.
- Web strict TypeScript — PASS.
- Generated OpenAPI drift check — PASS.
- Phase 6 integrity gate — PASS: all frozen schemas match, catalogue copies are byte-identical, no Administration DELETE grant, no live ports, isolated lifecycle retained, no raw fetch/facade, 24 routes and 24 token gates, no secrets, and dependency allowlist intact.
- Catalogue copies — PASS, SHA-256 `9a25c2e3aff75a9fff187b0d44cc4e10c2e762e44cf1f9bfcb208453200c4b6f`.

## Known Stubs

None. Safe “not available” messages are deliberate non-enumerating error states, not placeholder implementations.

## Issues Encountered

- The full Strapi command exposed a test-compilation-only unsafe cast after focused tests had passed; the helper was narrowed and the full 111-test suite was rerun successfully.
- The web test script runs the complete Vitest suite despite the supplied feature argument; all 276 tests passed.

## User Setup Required

None - no external service, live development port, or credential setup is required.

## Next Phase Readiness

- Plan 06-10 can extend the existing closed import adapter family to Controls, Information Systems, and Information Assets without changing Risk Type authority or UI semantics.
- No unresolved Risk Type import correctness, authorization, digest, rollback, accessibility, schema, catalogue, or generated-contract issue remains.

## Self-Check: PASSED

- All eleven declared implementation/test files exist and commits `0ccd7bf`, `f2f0d3a`, `3ca609d`, `1e7cfeb`, and `1f7a6da` exist in history.
- No tracked deletion, schema/catalogue mutation, dependency change, live-port usage, raw fetch, frontend API facade, delete path, test escape, secret, or unrelated user edit is included.
- Full Strapi/web suites, strict typecheck, generated API check, frozen catalogue identity, and the Phase 6 integrity gate pass.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-02*
