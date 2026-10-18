---
phase: 06-administration-and-csv-imports
plan: 08
subsystem: csv-import-foundation
tags: [csv-parse, strapi, nextjs, validation, security]

requires:
  - phase: 06-07
    provides: complete closed Administration adapters for all four reusable collections
provides:
  - Audited csv-parse 7.0.2 dependency in both runtime workspaces
  - Exact 5 MiB, 5,000-row, and 65,536-byte record limits at server and browser boundaries
  - Authoritative five-state Strapi parser and advisory browser parser for all four collections
  - Strict preview DTO schemas plus formula-safe templates, error reports, and result reports
affects: [06-09, 06-10, administration-import-preview, administration-import-commit]

tech-stack:
  added: [csv-parse@7.0.2]
  patterns:
    - Lightweight byte and logical-record preflight precedes UTF-8 decoding and CSV parsing
    - Browser parsing mirrors grammar and limits but never replaces Strapi authority
    - Existing normalized natural keys are preserved byte-for-byte on update classifications

key-files:
  created:
    - apps/strapi/src/api/csrm-administration/services/csv-import.ts
    - apps/web/src/features/administration/csv-import-schema.ts
    - apps/web/src/features/administration/csv-client-parser.ts
  modified:
    - apps/strapi/package.json
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/strapi/config/middlewares.ts
    - apps/web/next.config.ts

key-decisions:
  - "Preflight the exact byte, logical-row, and record-byte limits before fatal UTF-8 decoding and standards-compliant parsing."
  - "Classify duplicate CSV keys and multiple persisted matches as ambiguous without selecting a winner."
  - "Keep browser parsing advisory while sharing closed columns, exact constants, blank-optional semantics, and formula-safe download rules."

requirements-completed: [ADMIN-04]

duration: 13 min
completed: 2026-09-02
---

# Phase 06 Plan 08: Bounded CSV Parsing Foundation Summary

**Standards-compliant bounded CSV parsing with authoritative five-state Strapi classification, advisory browser validation, digest binding, and formula-safe downloads**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-01T18:24:43Z
- **Completed:** 2026-09-01T18:37:09Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added only the Package Legitimacy Audit-approved `csv-parse@7.0.2` direct dependency to Strapi and web, with a supply-chain-checked frozen lockfile.
- Raised the Next Server Action transport envelope to 6 MiB while keeping the Strapi multipart file cap and application authority at exactly 5 MiB.
- Implemented strict UTF-8/BOM/quotes/record-width/header/value parsing for Risk Types, Controls, Information Systems, and Information Assets without adding routes, schemas, entities, or authorization changes.
- Preserved original row order and first-class `create`, `update`, `unchanged`, `rejected`, and `ambiguous` counts, including normalized duplicate detection, multiple-existing-match denial, field changes, bounded issues, and SHA-256 byte digests.
- Added advisory browser validation with aligned constants and closed zod DTOs, plus correctly quoted, formula-neutralized templates/error reports/result reports and immediately revoked object URLs.

## Task Commits

1. **Task 1: Install the audited parser and enforce aligned bounds** - `33e3734` (chore)
2. **Task 2: Implement authoritative and advisory five-state parsing** - `684c808` (feat)

## Files Created/Modified

- `apps/strapi/src/api/csrm-administration/services/csv-import.ts` - Authoritative bounded parser, digest, validation, classification, and spreadsheet-cell safety.
- `apps/web/src/features/administration/csv-import-schema.ts` - Mirrored limits/columns and strict bounded preview DTO schemas.
- `apps/web/src/features/administration/csv-client-parser.ts` - Advisory browser parser, file validation, templates, reports, filename sanitation, and safe downloads.
- `apps/strapi/config/middlewares.ts` - Exact 5 MiB formidable file cap inside a minimal 6 MiB multipart envelope.
- `apps/web/next.config.ts` - 6 MiB Server Action request envelope.
- Both workspace manifests and `pnpm-lock.yaml` - Exact audited dependency resolution.

## Decisions Made

- File bytes and logical CSV records are scanned before decoding or parser allocation, so byte, row, and record bounds are authoritative even for direct callers.
- Header normalization is NFKC/trim/case-insensitive but maps only to each collection's closed canonical columns; unsupported or duplicate headers fail the whole file without echoing raw header content.
- Blank optional cells mean omit/leave unchanged. Existing natural-key spelling and casing replace caller CSV spelling in update/unchanged values so later commit code cannot silently rename a match.
- Rejected rows carry bounded field corrections, ambiguous rows never expose or select a winner, and unchanged rows have no changes, issues, or write result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added a standards-compatible browser File reading fallback**
- **Found during:** Task 2 browser RED/GREEN verification
- **Issue:** The test/browser File implementation did not universally expose `File.arrayBuffer()`, which prevented valid exact-cap files from reaching advisory validation.
- **Fix:** Added a `FileReader.readAsArrayBuffer` fallback while retaining the same byte array and exact preflight path.
- **Files modified:** `apps/web/src/features/administration/csv-client-parser.ts`
- **Verification:** Exact 5,242,880-byte and 5,000-row browser contract passes; every cap+1 case rejects.
- **Committed in:** `684c808`

---

**Total deviations:** 1 auto-fixed Rule 1 browser compatibility bug.
**Impact on plan:** The fix preserves the same closed advisory contract and adds no dependency, route, schema, or authority.

## TDD Gate Compliance

- The pre-seeded Wave 0 backend ADMIN-04 RED failed on the absent `csv-import` module and the later-plan preview/commit route; no sentinel or test escape was involved.
- The pre-seeded browser bounds RED failed on absent constants/validation and then on the real File API compatibility issue.
- GREEN commit `684c808` follows those failures and passes the parser-focused backend and browser contracts.
- **Warning:** Task 1 was marked `tdd="true"` but declared only dependency/configuration files, so it has no separate test-only RED commit; frozen install, typecheck, and configuration assertions provide its gate.
- No `PHASE6_RED`, `execArgv`, file-existence, early-return, `.only`, skip/fixme, tautological fixture, or denial weakening was introduced.

## Verification Evidence

- Node runtime — PASS: v24.19.0.
- `corepack pnpm install --frozen-lockfile` — PASS with supply-chain policy verification and no lock drift.
- Root `corepack pnpm typecheck` — PASS for Strapi/web and generated API drift.
- Strapi production/test TypeScript compilation — PASS.
- Focused backend Administration unit contract — PASS, 4/4: exact/cap+1 bounds, five classifications, fatal malformed input, and formula neutralization.
- Focused browser Administration schema/CSV bounds contract — PASS, 4/4, including exact 5 MiB/5,000 rows and every cap+1 rejection.
- Advisory five-state/template/report runtime verification — PASS with create/update/unchanged/rejected/ambiguous counts and formula-safe report cells.
- `corepack pnpm --filter @csrm/web api:check` — PASS.
- Catalogue copies — PASS, byte-identical SHA-256 `9a25c2e3aff75a9fff187b0d44cc4e10c2e762e44cf1f9bfcb208453200c4b6f`.
- Broad Administration suites retain the intentional Plan 06-09 REDs for mounted preview/commit and `csv-import-flow`; they were not selected as Plan 06-08 completion gates and were not weakened.

## Known Stubs

None in the files created by this plan. Route/controller mutation wiring and the five-step UI are deliberately absent implementations owned by Plan 06-09, not parser stubs.

## Issues Encountered

- The Context7 MCP and `ctx7` CLI were unavailable. Version-specific behavior was verified against the official csv-parse and Next.js documentation before implementation.
- `vite-node` was not installed, so browser runtime verification used the existing Vitest toolchain rather than adding an unapproved dependency.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-09 can wire Risk Type preview/confirmed apply directly to the authoritative parser without changing classification semantics.
- No unresolved HIGH threat remains in parser bounds, malformed encoding/structure handling, digest computation, raw error disclosure, or formula-safe download generation.

## Self-Check: PASSED

- All eight declared files exist and task commits `33e3734` and `684c808` exist in history.
- No tracked file deletion, schema/catalogue mutation, live port usage, raw fetch, authorization change, or unrelated user edit is included.
- Frozen install, strict typecheck, parser-focused tests, generated API check, and catalogue byte identity pass.

---
*Phase: 06-administration-and-csv-imports*
*Completed: 2026-09-02*
