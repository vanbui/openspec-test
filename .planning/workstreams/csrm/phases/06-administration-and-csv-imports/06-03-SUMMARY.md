---
phase: 06-administration-and-csv-imports
plan: 03
subsystem: api-contracts
tags: [openapi, generated-types, administration, csv-import, authorization]

requires:
  - phase: 06-administration-and-csv-imports
    plan: 02
    provides: token-first 24-operation Administration route and grant boundary
provides:
  - Exact generated CRUD, detail, preview, and confirmed-apply transport types for four Administration collections
  - Closed bounded five-state CSV preview and result DTOs with digest-bound multipart confirmation
  - Resolved INT-01 single-process uniqueness boundary and explicit frozen-schema limitations
affects: [06-04-administration-crud, 06-08-csv-import, 06-09-csv-integration, 06-10-phase-green]

tech-stack:
  added: []
  patterns: [generated OpenAPI transport, picker-compatible optional list metadata, digest-bound confirmed import, closed bounded result projection]

key-files:
  created:
    - apps/web/src/features/administration/administration-service.test.ts
    - docs/contract-gaps/phase-06-administration-import-contract.md
  modified:
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts

key-decisions:
  - "Preserve the existing assessment-workflow operation identities and shared safe errors for Risk Type and Control GET paths while extending those literal paths with Administration-compatible query and response typing."
  - "Treat normalized Information System and Information Asset uniqueness as a single-Strapi-process guarantee; multi-process adoption requires a separately approved normalized unique-index/schema migration."

patterns-established:
  - "Five-state import contract: create, update, unchanged, rejected, and ambiguous remain distinct in preview, apply, summaries, and row results."
  - "Confirmed apply contract: the same file bytes, previewDigest, and literal confirmed=true are required; server reclassification remains authoritative."

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04]

duration: 14 min
completed: 2026-09-01
---

# Phase 6 Plan 3: Administration Transport and Import Contract Summary

**Generated 24-operation Administration typing with closed five-state CSV DTOs, byte-identical human-only grant proof, and an honest single-process INT-01 uniqueness boundary**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-01T14:17:59Z
- **Completed:** 2026-09-01T14:32:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Published all 24 list/create/detail/update/preview/apply method-path combinations without DELETE and regenerated the strict TypeScript client from the authoritative OpenAPI document.
- Added closed positive CRUD DTOs and bounded multipart preview/apply contracts with 5 MiB, 5,000-row, digest, explicit confirmation, and safe result constraints.
- Made `unchanged` a first-class classification alongside create, update, rejected, and ambiguous, with no required write result for unchanged rows.
- Proved both catalogue copies remain byte-identical with exactly 24 unique Administration FunctionAPIs, eight human-only Functions, and zero Requestor, agent, or DELETE grants.
- Resolved INT-01 in a dedicated contract record covering compatibility branching, normalization, bounds, five classifications, per-row transactions, unknown outcomes, and the frozen-schema cross-process limitation.

## Task Commits

1. **Task 1 RED: Define failing Administration transport contract** - `049f2e1` (test)
2. **Task 1 GREEN: Publish generated Administration transport contract** - `a430cad` (feat)
3. **Task 2 RED: Require resolved grant and INT-01 boundary** - `eb6eabf` (test)
4. **Task 2 GREEN: Resolve compatibility and INT-01 boundary** - `907b494` (fix)

## Files Created/Modified

- `docs/references/specification.json` - Exact CRUD/import paths, closed DTOs, bounded five-state responses, and multipart digest confirmation.
- `apps/web/src/lib/api/generated/schema.d.ts` - Regenerated typed client declarations for all literal paths and DTOs.
- `apps/web/src/features/administration/administration-service.test.ts` - Drift tests for the 24 operations, generated declarations, five states, bounds, catalogue identity, and INT-01 artifact.
- `docs/contract-gaps/phase-06-administration-import-contract.md` - Resolved CSV, compatibility, topology, and frozen-schema contract limitations.

## Decisions Made

- Kept `assessment-workflow/get-risk-types` and `assessment-workflow/get-controls` as the OpenAPI operation identities for their shared GET paths. The literal paths now carry Administration-compatible canonical query typing and optional list metadata while inherited assessment contract parity remains intact.
- Kept the already-reconciled catalogue bytes unchanged because Plan 06-02 had critically aligned the exact 24 human-only grants ahead of this prerequisite; this plan adds independent drift proof rather than creating meaningless byte churn.
- Recorded normalized System/Asset uniqueness as process-local instead of implying a database guarantee absent from the frozen schemas.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Regression] Preserved inherited assessment picker operation identities and safe errors**
- **Found during:** Task 2 full Strapi contract verification
- **Issue:** Replacing the shared Risk Type and Control GET operation IDs and safe 400/403 response references broke the inherited Phase 4 picker contract even though the HTTP paths remained compatible.
- **Fix:** Restored the two established assessment operation IDs and shared safe error references while retaining the new Administration query/list typing, POST methods, and remaining 22 literal operations.
- **Files modified:** `docs/references/specification.json`, generated schema, and Administration contract test
- **Verification:** Focused Phase 4 contract/catalogue parity passes; Administration drift suite and `api:check` pass.
- **Committed in:** `907b494`

**Total deviations:** 1 auto-fixed regression. **Impact:** The exact 24 method-path inventory remains generated while the pre-existing assessment picker contract stays source-compatible.

## Verification Evidence

- Focused Administration contract suite — PASS, 5/5 tests.
- `corepack pnpm --filter @csrm/web api:check` — PASS after committed generated output.
- Inherited Phase 4 assessment contract/catalogue parity — PASS after compatibility correction.
- Catalogue acceptance script — PASS: byte-identical copies, 8 human-only Functions, 24 unique FunctionAPIs, zero Requestor/agent Administration memberships, zero DELETE.
- `node scripts/verify-phase-06-integrity.mjs` — PASS, including frozen schemas, token-only 24-route boundary, generated drift, raw-fetch/facade absence, no live-port targeting, and test anti-escape scan.
- Full Strapi suite — 101/109 pass; the remaining eight failures are the unchanged downstream CRUD/import implementation REDs owned by Plans 06-04 through 06-09.
- Exact plan web command — the new service contract passes 5/5; the command's extra `--` causes Vitest to run the complete suite, where 10 honest Administration schema/workflow REDs remain for later plans (258/268 pass overall).

## TDD Gate Compliance

- Task 1 RED `049f2e1` failed on missing literal operations and missing five-state DTOs; GREEN `a430cad` generated the contract and passed all four initial assertions.
- Task 2 RED `eb6eabf` failed on the deliberately absent Plan 06-03 contract-gap artifact; GREEN `907b494` created the resolved record and passed the complete five-test suite.
- No sentinel, file-existence escape, early return, tautological fixture, or test-process bypass was introduced.

## Known Stubs

None in files created or modified by this plan. The fail-closed downstream route handlers remain prior-plan intentional boundaries and are covered by later executable plans.

## Issues Encountered

- The full suites intentionally remain RED only for executable Administration CRUD, parser, workspace, and CSV workflow modules scheduled after this shared contract prerequisite. Those tests were not weakened or bypassed.
- Existing `next-env.d.ts`, `tsconfig.json`, `.planning/debug/`, and `apps/web/.tmp/` worktree dirt was preserved and excluded from all commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 06-04 to implement reusable Administration CRUD against the exact generated DTOs.
- Plans 06-08 and 06-09 can implement parsing and digest-bound apply without inventing transport states or topology guarantees.
- No unresolved HIGH threat remains in this plan's contract or catalogue boundary.

## Self-Check: PASSED

- All four declared created/modified files exist.
- TDD commits `049f2e1`, `a430cad`, `eb6eabf`, and `907b494` exist in history.
- Generated drift, focused contract, catalogue identity/grants, inherited picker parity, and Phase 6 integrity checks pass.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-01*
