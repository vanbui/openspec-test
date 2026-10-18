---
phase: 06-administration-and-csv-imports
plan: 11
subsystem: administration-imports
tags: [strapi, nextjs, csv, multipart, security, playwright]

requires:
  - phase: 06-10
    provides: complete four-collection Administration CSV preview and commit workflow
provides:
  - Actor-bound, collection-bound, file-bound, expiring and single-use opaque preview proofs
  - Pre-write reviewed-classification drift detection with explicit skipped-row reporting
  - Frozen-contract Control limits and exact one-file 5 MiB multipart enforcement
affects: [phase-06-verification, administration-imports, shared-mobile-shell]

tech-stack:
  added: []
  patterns:
    - Process-local bounded preview registry with cryptographically random opaque tokens
    - Commit-time classification is compared with the ordered reviewed snapshot before any mutation
    - Multipart upload shape is validated independently at parser and workflow boundaries

key-files:
  created: []
  modified:
    - apps/strapi/src/api/csrm-administration/services/administration-workflow.ts
    - apps/strapi/src/api/csrm-administration/services/administration-repository.ts
    - apps/strapi/src/api/csrm-administration/services/administration-query.ts
    - apps/strapi/config/middlewares.ts
    - apps/strapi/tests/administration.integration.test.ts
    - apps/web/src/features/administration/administration-schema.ts
    - docs/contract-gaps/phase-06-administration-import-contract.md

key-decisions:
  - "Keep the frozen previewDigest wire shape while changing its value from a caller-computable file hash to a server-issued random opaque proof."
  - "Consume preview proofs once and report every snapshot drift as ROW_PREVIEW_DRIFT before starting any row transaction."
  - "Use Strapi's database query layer for long frozen-contract Control strings because the unchanged content-type schema imposes an implicit 255-character documents-service limit."

patterns-established:
  - "Reviewed import provenance: actor, collection, raw file digest, expiry, row state, and matched documentId are one server-retained unit."
  - "Drift is calculated across the complete upload before eligible non-drift rows are written."

requirements-completed: [ADMIN-02, ADMIN-04]

duration: 1h 25m
completed: 2026-09-02
---

# Phase 06 Plan 11: Administration Import Gap Closure Summary

**Server-issued reviewed-preview proofs, pre-write drift reporting, frozen Control caps, and exact multipart limits close all four Phase 6 verification blockers**

## Performance

- **Duration:** 1h 25m
- **Started:** 2026-09-02T05:38:00+10:00
- **Completed:** 2026-09-02T07:03:00+10:00
- **Tasks:** 3
- **Files modified:** 13 implementation, test, and contract files

## Accomplishments

- Replaced forgeable raw file hashes with random, five-minute, actor/collection/file/snapshot-bound, bounded, single-use preview records while preserving the frozen transport field shape.
- Reclassified inside the existing collection mutation queue and compared all ordered states and matched document IDs before the first write; drifted rows are skipped and reported without overwriting concurrent records.
- Aligned server and web Control limits to 500/255/2000 and proved exact-boundary CSV preview-to-commit persistence plus cap-plus-one rejection.
- Enforced one file and 5,242,880 total file bytes in Formidable, independently rejected arrays and unexpected fields in the workflow, and proved duplicate same-name parts cause zero writes.
- Kept the frozen schemas unchanged and both catalogue copies byte-identical; updated the contract-gap record to match the implemented boundary.

## Task Commits

1. **Task 1 RED: Expose preview proof and drift gaps** - `39dbe29` (test)
2. **Task 1 GREEN: Bind commits to reviewed previews** - `b94eb03` (fix)
3. **Task 2 RED: Lock frozen Control field caps** - `a159c19` (test)
4. **Task 2 GREEN: Align frozen Control field caps** - `b767045` (fix)
5. **Task 3 RED: Lock multipart file boundaries** - `32eb4ce` (test)
6. **Task 3 GREEN: Enforce multipart import bounds** - `bb32791` (fix)
7. **Code review: Refresh gap closure review** - `6229f39` (docs)

**Plan metadata:** `d36e82c` (docs)

## Files Created/Modified

- `apps/strapi/src/api/csrm-administration/services/administration-workflow.ts` - Opaque preview registry, complete file-shape validation, one-time proof consumption, and pre-write drift handling.
- `apps/strapi/src/api/csrm-administration/controllers/csrm-administration.ts` - Passes the complete multipart files object into the workflow boundary.
- `apps/strapi/src/api/csrm-administration/services/administration-query.ts` - Exact frozen Control mutation caps.
- `apps/strapi/src/api/csrm-administration/services/administration-repository.ts` - Persists long frozen-contract Control fields without altering frozen content-type schemas.
- `apps/strapi/config/middlewares.ts` - Exact Formidable file-count, per-file, and aggregate-size limits.
- `apps/strapi/tests/administration.integration.test.ts` - Mounted proof-bypass, replay, drift, Control-boundary, and multipart zero-write regressions.
- `apps/strapi/tests/administration.unit.test.ts` - Exact server caps and multipart configuration assertions.
- `apps/web/src/features/administration/administration-schema.ts` - Exact 500/255/2000 Control input and record limits.
- `apps/web/src/features/administration/administration-schema.test.ts` - Exact-boundary and cap-plus-one web validation.
- `docs/contract-gaps/phase-06-administration-import-contract.md` - Implementation-accurate preview, drift, validation, multipart, and process-local limitations.
- `apps/web/src/components/shell/capability-navigation.tsx` and `mobile-navigation.test.tsx` - Preserved the menu trigger as the first post-skip-link focus target for Administration users.

## Decisions Made

- Preserve the frozen `previewDigest` format but treat it strictly as an opaque random token; its apparent `sha256:` prefix is compatibility syntax and conveys no derivation.
- Skip and report drifted rows instead of rejecting the entire commit, while calculating every drift index before any non-drift transaction begins.
- Retain the explicitly documented process-local registry limitation: restart or cross-process commit safely rejects the preview and requires a new review.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Bypassed the implicit frozen-schema string ceiling for Control persistence**
- **Found during:** Task 2 GREEN
- **Issue:** Strapi's documents service applied the unchanged content-type string ceiling after the closed workflow accepted contract-valid 500/2000-character values.
- **Fix:** Route Control create/update persistence through Strapi's database query layer after the same closed custom mutation validation; all other collections retain the documents service.
- **Files modified:** `apps/strapi/src/api/csrm-administration/services/administration-repository.ts`
- **Verification:** Mounted exact-boundary preview-to-commit test persists 500/255/2000 characters; cap-plus-one remains rejected and write-free.
- **Committed in:** `b767045`

**2. [Rule 3 - Blocking] Restored privileged mobile shell tab order required by the full gate**
- **Found during:** Final Playwright gate
- **Issue:** Administration shortcut links preceded the mobile navigation trigger, so the shared assessment keyboard journey reproducibly failed after the skip link.
- **Fix:** Moved the existing dialog trigger ahead of the shortcut navigation in DOM order and added a privileged-user tab-order unit regression. No E2E assertion or timeout changed.
- **Files modified:** `apps/web/src/components/shell/capability-navigation.tsx`, `apps/web/src/components/shell/mobile-navigation.test.tsx`
- **Verification:** Focused unit 4/4, focused assessment Playwright 1/1, full web suite 280/280, and full Playwright 16/16.
- **Committed in:** `4e0d984`

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 blocking gate defect).
**Impact on plan:** Both changes were necessary to satisfy the frozen contract and the exact requested full gate; no dependency, public API shape, schema, catalogue, authorization model, or Phase 7 scope changed.

## Issues Encountered

- The full Playwright gate twice exposed the deterministic shared-shell tab-order issue. The product markup was corrected and the original test was retained unchanged.
- Playwright's managed Next server logs harmless `destination stream closed early` messages during teardown; the final run exited 0 with all 16 scenarios passing.

## Verification Evidence

- Node runtime — PASS: v24.19.0.
- Phase 6 integrity — PASS: frozen schema hashes, catalogue identity/counts, no-delete and token boundaries, test anti-escape, isolated ports/database/build, API generation, secret/attribution/dependency checks.
- Full Strapi gate — PASS: 117/117.
- Web strict typecheck — PASS.
- Full web unit gate — PASS: 36 files, 280/280.
- Generated API parity — PASS.
- Full isolated Playwright gate — PASS: 16/16.

## User Setup Required

None - no live server, external service, schema migration, secret, or manual configuration is required.

## Next Phase Readiness

- All four automated Phase 6 verification blockers are closed and ready for re-verification.
- Phase 6 remains intentionally uncompleted after re-verification; Phase 7 must not be started by this plan.

## Self-Check: PASSED

- All task commits and modified files exist.
- The exact user-directed full gate exits 0 after the shared-shell correction.
- Frozen schemas remain hash-identical and catalogue copies remain byte-identical.
- No test was skipped, weakened, or conditionally escaped.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-02*
