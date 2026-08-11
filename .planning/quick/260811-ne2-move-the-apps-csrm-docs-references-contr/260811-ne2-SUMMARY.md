---
quick_id: 260811-ne2
slug: move-the-apps-csrm-docs-references-contr
subsystem: backend-bootstrap
tags: [strapi, csrm, seed-data, verification]
requires:
  - CSRM control catalogue seed data
provides:
  - Backend-owned control catalogue location for CSRM bootstrap
affects: [CSRM seed verification, backend bootstrap]
tech-stack:
  added: []
  patterns:
    - Resolve bootstrap-owned seed catalogues from the Strapi application root.
key-files:
  created:
    - apps/backend/src/bootstrap/controls/
  modified:
    - apps/backend/src/bootstrap/seed-csrm-data.ts
    - scripts/verify-csrm-seed.mjs
    - scripts/verify-csrm-seed-runtime.mjs
    - apps/backend/README.md
key-decisions:
  - "The backend bootstrap owns catalogue files that its seed imports."
duration: 9min
completed: 2026-08-11
status: complete
---

# Quick Task 260811-ne2: Move CSRM Control Catalogues Summary

The backend bootstrap is now the sole home for all 12 CSRM control catalogues, with seed and verification paths resolved from that backend-owned location.

## Accomplishments

- Moved all 12 JSON catalogues byte-for-byte from the CSRM documentation tree into `apps/backend/src/bootstrap/controls`.
- Updated the Strapi seed loader, static verifier, runtime verifier, and backend documentation to use the new location.
- Preserved catalogue validation, normalization, 2,646-control coverage, and two-boot idempotency behavior.

## Task Commit

1. **Relocate the control catalogues and rewire the complete seed path** — `a1b66f7` (`chore`)

## Verification

- Passed the old-directory-absent / exactly-12-catalogues relocation check.
- Passed `node scripts/verify-csrm-seed.mjs`.
- Passed `node scripts/verify-csrm-seed-runtime.mjs` (two Strapi boots; 2,646 controls, idempotency confirmed).
- Passed `yarn workspace backend check-types`.

## Decisions Made

- Kept catalogue content unchanged and moved it as Git-detected 100% renames.
- Derived the loader path from `strapi.dirs.app.root` to keep runtime ownership within the backend application.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The combined `yarn verify:csrm-seed` command exceeded the initial three-minute command allowance while its runtime verifier was still booting Strapi. Its static portion had already passed; rerunning the runtime verifier separately with sufficient time passed.

## Self-Check: PASSED

- Commit `a1b66f7` exists and contains the 12 catalogue renames plus all planned path updates.
- `apps/backend/src/bootstrap/controls` contains the expected 12 JSON files.
