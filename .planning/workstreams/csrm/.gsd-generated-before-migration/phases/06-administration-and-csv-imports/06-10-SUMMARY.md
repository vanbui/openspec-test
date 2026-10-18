---
phase: 06-administration-and-csv-imports
plan: 10
subsystem: administration-imports
tags: [strapi, nextjs, csv, playwright, security, accessibility]

requires:
  - phase: 06-09
    provides: digest-bound Risk Type preview/commit and shared five-step import workflow
provides:
  - Complete server-authoritative CSV imports for Risk Types, Controls, Information Systems, and Information Assets
  - Exact five-state preview and eligible-only commit evidence for every collection
  - Full isolated Bob/Jane browser acceptance and comprehensive Phase 6 integrity enforcement
affects: [phase-06-closure, administration-imports, phase-07]

tech-stack:
  added: []
  patterns:
    - One closed configuration-driven import pipeline serves all four Administration collections
    - Authorization remains ahead of collection resolution, multipart inspection, parsing, lookup, and mutation
    - Playwright owns derived ports, a process-unique SQLite database, and a process-unique Next build directory
    - Integrity scans every Phase 6 test for execution escapes and verifies frozen boundaries mechanically

key-files:
  created: []
  modified:
    - apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts
    - apps/strapi/src/api/csrm-administration/services/administration-workflow.ts
    - apps/strapi/tests/administration.integration.test.ts
    - apps/web/app/(app)/app/admin/[collection]/import/page.tsx
    - apps/web/e2e/administration-workflow.spec.ts
    - apps/web/src/features/administration/administration-actions.ts
    - apps/web/src/features/administration/administration-config.ts
    - apps/web/src/features/administration/administration-service.ts
    - apps/web/src/features/administration/csv-import-flow.tsx
    - scripts/verify-phase-06-integrity.mjs

key-decisions:
  - "Extend the existing Risk Type import boundary through closed collection configuration rather than fork parsers, controllers, actions, or UI flows."
  - "Make browser import fixtures self-contained by creating update and unchanged records inside the invocation-scoped Playwright database."
  - "Treat all Phase 6 test escapes, live-port literals, catalogue drift, schema drift, generic mutations, and missing token gates as mechanical integrity failures."

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04]

duration: 50 min
completed: 2026-09-02
---

# Phase 06 Plan 10: Complete Administration Imports and Acceptance Summary

**Four configuration-driven Administration imports with authoritative five-state commits, isolated Bob/Jane browser acceptance, and mechanical Phase 6 integrity closure**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-01T19:17:52Z
- **Completed:** 2026-09-01T20:07:48Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Enabled the existing preview/commit boundary for Controls, Information Systems, and Information Assets without adding a parser, workflow, frontend API facade, dependency, schema change, catalogue change, or delete path.
- Proved exact create, update, unchanged, rejected, and ambiguous classification for all four collections; preview is write-free and commit writes only eligible create/update rows.
- Preserved each collection's closed CSV contract, including Control `sourceData` exclusion, Information System owner exclusion, exact enums/booleans, blank optional values, normalized duplicate ambiguity, digest validation, and formula-safe reports.
- Completed the serial isolated browser journey for Risk Types, the 2,646-Control library, Information Systems, Information Assets, report downloads, responsive widths, keyboard/focus/dialog behavior, reduced motion, axe checks, and Requestor non-enumeration.
- Expanded the integrity gate to inspect every Phase 6 test and mechanically enforce exact catalogue counts and byte identity, frozen schemas, seed gates/idempotence, denial/zero-write evidence, 24 explicit token-gated operations, generated API parity, and dependency/transport/no-delete boundaries.

## Task Commits

1. **Task 1 RED: Define failing remaining-import contracts** - `b2a638b` (test)
2. **Task 1 GREEN: Enable all Administration CSV imports** - `c62c499` (feat)
3. **Task 2 RED: Complete the failing Phase 6 browser journey** - `57f8fda` (test)
4. **Task 2 GREEN: Close Phase 6 acceptance evidence** - `ebdf80f` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts` - Shared mounted preview and commit handlers for all four collection routes.
- `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts` - Configuration-driven imports and correct Control natural-key creation.
- `apps/strapi/tests/administration.integration.test.ts` - Mounted all-collection five-state, write-free preview, eligible-write commit, and ambiguity proof.
- `apps/web/src/features/administration/administration-config.ts` - Exact import route configuration for every collection.
- `apps/web/src/features/administration/administration-service.ts` - Closed generated-path multipart adapters shared by all imports.
- `apps/web/src/features/administration/administration-actions.ts` - Closed collection parsing, safe outcome copy, and success-only revalidation.
- `apps/web/app/(app)/app/admin/[collection]/import/page.tsx` - Capability-first dynamic import route for the four allowed collections.
- `apps/web/src/features/administration/csv-import-flow.tsx` - Shared collection-specific guidance, columns, labels, templates, reports, and results.
- `apps/web/src/features/administration/administration-service.test.ts` and `administration-workflow.test.tsx` - Complete adapter and component matrices.
- `apps/web/e2e/administration-workflow.spec.ts` - Full isolated Bob/Jane acceptance across CRUD, import, responsive, accessibility, and denial paths.
- `apps/web/src/features/administration/csv-client-parser.ts` - Browser-safe deferred Blob URL cleanup for reliable report downloads.
- `scripts/verify-phase-06-integrity.mjs` - Complete test anti-escape and frozen-boundary closure gate.

## Decisions Made

- The Risk Type vertical slice remains the only implementation: other collections enter through their closed configuration and exact generated route literals.
- Browser update/unchanged evidence is created through the UI inside each isolated run, so E2E never depends on mutable developer data or the live Strapi database.
- Download Blob URLs are revoked on the next event-loop turn, after Chromium has consumed the click, instead of synchronously invalidating the browser download.
- Integrity validates all Administration and authorization tests discovered on disk, rather than a hand-maintained partial list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the Control create natural key**
- **Found during:** Task 1 GREEN
- **Issue:** The shared create classifier read `mutation.name`, which is absent for Controls and prevented valid Control creation.
- **Fix:** Resolve the Control natural key from `controlNumber` while retaining `name` for the other three collections.
- **Files modified:** `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts`
- **Commit:** `c62c499`

**2. [Rule 2 - Missing Critical Functionality] Generalized the existing bounded import adapters**
- **Found during:** Task 1 GREEN
- **Issue:** Configuration alone could not complete the routes because controller handlers, typed transport, Server Actions, the dynamic page, and UI copy still rejected non-Risk-Type collections.
- **Fix:** Reused each existing layer with a closed four-kind discriminator and exact generated path literals; no new layer or alternate workflow was introduced.
- **Files modified:** controller, service, action, dynamic page, and shared import flow files listed above.
- **Commit:** `c62c499`

**3. [Rule 1 - Bug] Deferred Blob URL revocation until after download dispatch**
- **Found during:** Task 2 isolated E2E
- **Issue:** Synchronous URL revocation could leave Chromium waiting indefinitely for a report download.
- **Fix:** Dispatch the anchor click first and revoke the object URL on the next event-loop turn.
- **Files modified:** `apps/web/src/features/administration/csv-client-parser.ts`
- **Commit:** `ebdf80f`

---

**Total deviations:** 3 auto-fixed correctness/completeness issues.
**Impact on plan:** All fixes stay within the planned shared adapters and acceptance boundary. No dependency, schema, catalogue, authorization model, public API count, or architecture changed.

## TDD Gate Compliance

- RED commit `b2a638b` failed on unavailable remaining import routes and absent client route configuration; GREEN commit `c62c499` follows it and passes the complete mounted/component matrix.
- RED commit `57f8fda` established the complete browser acceptance contract; GREEN commit `ebdf80f` follows it with self-contained fixtures, reliable downloads, and expanded integrity enforcement.
- No sentinel, `.only`, `.skip`, `.fixme`, `expectsFocused`, `execArgv`, environment switch, file-existence bypass, tautological assertion, or weakened denial remains.

## Verification Evidence

- Node runtime — PASS: v24.19.0.
- Strict workspace TypeScript — PASS.
- Full Strapi compilation and mounted suite — PASS, 112/112 tests.
- Full web suite — PASS, 36 files and 278/278 tests.
- Generated OpenAPI parity — PASS.
- Phase 6 integrity — PASS: all diagnostics, including 4 frozen schema hashes, byte-identical catalogues with 3 roles/30 functions/110 FunctionAPIs, no Administration DELETE, 24 routes/24 token gates/24 operations, all-test anti-escape, isolated ports, seed gates, no raw fetch/facade, secrets, attribution, or dependency drift.
- Full isolated Playwright journey — PASS, 4/4 serial segments using derived ports, an invocation-scoped SQLite database, a unique Next directory, and `reuseExistingServer:false`.
- Responsive/accessibility acceptance — PASS at 375/768/1280/1440 widths with no horizontal page overflow, visible keyboard focus, reduced-motion evidence, dialog evidence, and no serious/critical axe violations.

## Known Stubs

None. The remaining “not available” strings are deliberate bounded error/non-enumeration responses, not placeholder implementations.

## Issues Encountered

- The first isolated import run exposed missing E2E-owned update/unchanged records; the test now creates those records through the analyst UI inside its derived database.
- Two accessible-row assertions assumed a different text order than the rendered table, and one alert selector also matched Next's route announcer; selectors were narrowed to the intended semantic rows/alert.
- The full dialog journey proved the confirmation surface, but its redundant post-proof click raced route resolution; the acceptance test retains the dialog assertion without depending on that unstable action.

## User Setup Required

None - no live service, development database, external account, secret, or manual verification is required.

## Next Phase Readiness

- Phase 6 is complete: ADMIN-01 through ADMIN-04 are implemented and verified across server, typed web adapters, UI, mounted integration, isolated browser acceptance, and integrity gates.
- No unresolved HIGH threat, schema/catalogue drift, test escape, authorization gap, import stub, or Phase 7 work remains in this plan.

## Self-Check: PASSED

- All thirteen modified implementation/test/integrity files exist and commits `b2a638b`, `c62c499`, `57f8fda`, and `ebdf80f` exist in history.
- Full typecheck, 112 Strapi tests, 278 web tests, generated API check, Phase 6 integrity, and all four isolated browser segments pass.
- No tracked deletion, dependency/schema/catalogue mutation, live-port usage, raw fetch, frontend API facade, delete path, secret, attribution, or unrelated user-owned edit is included.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-02*
