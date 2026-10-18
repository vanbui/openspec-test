---
phase: 19-csv-export-and-import-hardening
plan: 02
subsystem: refusal-vocabulary
tags: [conflict-reasons, contract, transport, refusal-copy, family-s, csv-export, import-tolerance, shared-backend]

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-01: the two approved Phase 19 records (closed reasons, found details, row cap) and PHASE_19_BASE=bdd0f698"
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "CONFLICT_REASONS ending at RISK_CURATION_UNDO_UNAVAILABLE; family R's feature-only copy module layout"
  - phase: 14-request-attachments
    provides: "the detection-beside-its-reason transport guard, the precedent for rowCount, rowCap and found"
provides:
  - "The 19 Phase 19 closed reasons in Strapi's CONFLICT_REASONS, the web mirror and both specification reason enums, in the recorded order"
  - "AssessmentWorkflowErrorResponse.error.details.rowCount, .rowCap and .found (closed, bounded)"
  - "server-client.ts: ImportRefusalFound, isImportRefusalFound, TransportError.rowCount/.rowCap/.found"
  - "apps/csrm/src/features/exports/export-refusal-copy.ts: exportRefusal, EXPORT_FAILED, ExportRefusalCopy (family S1)"
  - "apps/csrm/src/features/administration/import-refusal-copy.ts: importFileRefusal, importStepRefusal, IMPORT_FILE_REFUSAL_REASONS, isImportFileRefusalReason, ImportFileRefusalCopy (families S2 and S3)"
affects: [19-03, 19-05, 19-06, 19-11, 19-13, 19-14, 19-15, phase-17]

actuals:
  tokens: 23800
  tasks: 3
  commits: 5

plan_head_before: 954c7262fa634dc73e6da9b81747e313801bbc90
plan_head_after: e8d94b19d18c863c711383a8894a38203d22453d

tech-stack:
  added: []
  patterns:
    - "A refusal detail crosses the transport only beside its reason through a closed guard (rowCount/rowCap beside EXPORT_ROW_LIMIT; found beside an IMPORT_ reason), as detection does beside ATTACHMENT_MALWARE_FOUND"
    - "Family S lives in two feature-only copy modules with type-only imports, never in refusal-copy.ts, so no byte reaches the near-budget request and risk detail routes"

key-files:
  created:
    - apps/csrm/src/features/exports/export-refusal-copy.ts
    - apps/csrm/src/features/exports/export-refusal-copy.test.ts
    - apps/csrm/src/features/administration/import-refusal-copy.ts
    - apps/csrm/src/features/administration/import-refusal-copy.test.ts
  modified:
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
    - apps/csrm/src/lib/api/transport/server-client.ts
    - apps/csrm/src/lib/api/transport/server-client.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-UI-SPEC.md

key-decisions:
  - "importFileRefusal takes the 15 S2 codes (ImportFileRefusalReason), not any ConflictReason, so every input has UI-SPEC copy; callers narrow with isImportFileRefusalReason and keep their own copy for anything else"
  - "found crosses only when the whole object passes isImportRefusalFound (closed keys, 20 strings of 200 code points, semicolon or tab, non-negative safe integers); its strings then lose C0/C1 controls, DEL and bidi marks, embeddings, overrides and isolates"
  - "An EXPORT_ROW_LIMIT whose rowCount the transport dropped reads as S1's failed-file sentence"
  - "19-UI-SPEC S1's EXPORT_NOT_RELEASED row now reads ASSESSMENT_NOT_RELEASED (the pilot's stop A ruling 1, applied by this plan, which owns S1)"

patterns-established:
  - "Phase 19 copy modules are listed in interface-copy-guard.test.ts under a Phase 19 comment, and each has a family S vocabulary test"

requirements-completed: []

coverage:
  - id: D1
    description: "The 19 codes in Strapi's list, the web mirror and both spec enums, appended in the recorded order; the four lists equal"
    requirement: CSV-01
    verification:
      - kind: unit
        ref: "apps/backend/tests/conflict-reasons.unit.test.ts (9/9); apps/csrm/src/lib/api/conflict-reasons.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "rowCount, rowCap and found published closed and kept by the transport beside their reasons only"
    requirement: CSV-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/api/transport/server-client.test.ts; the Strapi details-shape tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Family S1 to S3 verbatim in two feature-only modules; refusal-copy.ts and status-badge.tsx unchanged since PHASE_19_BASE; conflict-reasons.ts value-imported only by the two server-side modules"
    requirement: CSV-03
    verification:
      - kind: unit
        ref: "export-refusal-copy.test.ts, import-refusal-copy.test.ts, interface-copy-guard.test.ts; Task 3 verify (base diff, value-importer walk)"
        status: pass
    human_judgment: true

duration: 62min
completed: 2026-10-16
status: complete
---

# Phase 19 Plan 02: Export and Import Refusal Vocabulary Summary

**The 19 Phase 19 refusal codes now exist as one closed list in Strapi, the specification and the web mirror. The contract carries `rowCount`, `rowCap` and a closed, bounded `found` object. The transport keeps each of those details only beside its own reason. Family S (S1 to S3) is copied word for word from the UI-SPEC into two feature-only modules, so no byte of it reaches the request or risk detail pages.**

## Performance

- **Duration:** about 62 min (the full Strapi suite took about 30 min of it)
- **Started:** 2026-10-16T11:43:44Z
- **Completed:** 2026-10-16T12:46:00Z
- **Tasks:** 3 (Task 1 a tracer, Tasks 1 and 2 TDD)
- **Files modified:** 14 (4 created, 10 modified)

## Accomplishments

- **The 19 codes, final position.** They are appended after `RISK_CURATION_UNDO_UNAVAILABLE` (Phase 16's last code) as the last 19 entries of all four lists, in this order: `EXPORT_ROW_LIMIT`, `ASSESSMENT_NOT_RELEASED`, `IMPORT_FILE_TYPE`, `IMPORT_FILE_TOO_LARGE`, `IMPORT_TOO_MANY_ROWS`, `IMPORT_ENCODING_WINDOWS_1252`, `IMPORT_ENCODING_UTF16`, `IMPORT_ENCODING_UNKNOWN`, `IMPORT_DELIMITER`, `IMPORT_LEGACY_XLS`, `IMPORT_MACRO_WORKBOOK`, `IMPORT_ENCRYPTED_WORKBOOK`, `IMPORT_WORKBOOK_TOO_LARGE`, `IMPORT_NO_HEADER`, `IMPORT_NO_ROWS`, `IMPORT_DUPLICATE_HEADER`, `IMPORT_MISSING_COLUMN`, `IMPORT_DECISION_MISSING`, `IMPORT_REVIEW_EXPIRED`. The four lists are Strapi's `CONFLICT_REASONS`, the web mirror, and the `reason` enums of `AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`. Both Strapi's and the web's tests assert this order with `slice(-19)`.
- **No code already existed.** No earlier phase had added any of the 19 names, so none is listed twice. There is no `EXPORT_NOT_RELEASED`, and a test asserts it stays absent.
- **Statuses** (recorded in the Strapi module comment and both spec descriptions):
  - 422: `EXPORT_ROW_LIMIT`, plus the 13 import file refusals not listed below.
  - 409: `ASSESSMENT_NOT_RELEASED`, `IMPORT_DECISION_MISSING` and `IMPORT_REVIEW_EXPIRED`.
  - 415: `IMPORT_FILE_TYPE`.
  - 413: `IMPORT_FILE_TOO_LARGE`.
- **Contract.** `AssessmentWorkflowErrorResponse.error.details` stays `additionalProperties: false` and gains three properties:
  - `rowCount`: an integer, minimum 0.
  - `rowCap`: an integer, minimum 1.
  - `found`: an object with `additionalProperties: false`. `headers` and `labels` are arrays of at most 20 strings, each at most 200 characters. `delimiter` is `semicolon` or `tab`. `rows` and `bytes` are integers, minimum 0.

  `schema.d.ts` was regenerated and is committed with the spec in the same commits.
- **Transport** (`server-client.ts`). `TransportError` gains `rowCount`, `rowCap` and `found`; `ImportRefusalFound` and `isImportRefusalFound` are exported.
  - `rowCount` and `rowCap` cross only beside `EXPORT_ROW_LIMIT`, and only as non-negative safe integers.
  - `found` crosses only beside a reason starting with `IMPORT_`, and only when the whole object passes the closed guard. Its strings then have controls and bidirectional overrides stripped.
- **Family S modules** (plans 19-06, 19-11, 19-13 and 19-15 import from these, never from `refusal-copy.ts`):
  - `apps/csrm/src/features/exports/export-refusal-copy.ts`: `exportRefusal({ status, reason, rowCount })` returns `{ tone, message, retry }`, covering every S1 row. Also exports `EXPORT_FAILED`.
  - `apps/csrm/src/features/administration/import-refusal-copy.ts`: `importFileRefusal({ reason, found, fileName, fileSize })` returns `{ title, body, steps }` for every S2 row. `importStepRefusal(kind)` returns `{ message, action }` for S3. Also exports `IMPORT_FILE_REFUSAL_REASONS` and `isImportFileRefusalReason`.
  - Neither module has a directive, and both import only types (`grep -E "^import " … | grep -vc "^import type"` prints 0 for both).
- **Guard.** Both modules are in `interface-copy-guard.test.ts` under `// Phase 19 (19-UI-SPEC §6; plan 19-02): family S, the export and import refusal copy.`. Each copy test has a `family S vocabulary` test that walks every string the module returns. It fails on `accept`, `dump`, `extract`, `generate a file` or any ASCII `'` or `"`.

## Verification

| Gate | Command (abridged) | Result |
| --- | --- | --- |
| Task 1 RED | 3 Vitest files plus `conflict-reasons.unit.test.js` | Vitest: 9 failed, 192 passed. Strapi: 1 failed, 6 passed. |
| Task 1 verify | `api:check`, 3 Vitest files, `typecheck`, Strapi tsc, `conflict-reasons.unit.test.js` | exit 0. Vitest: 3 files, 203/203 passed. Strapi: 7/7 passed, 0 failed. |
| Task 2 RED | `src/lib/api` plus both copy tests, and the Strapi file | Vitest: 40 failed, 437 passed (the import copy file did not resolve). Strapi: 2 failed, 7 passed. |
| Task 2 verify | `api:check`, `src/lib/api` plus both copy tests, `typecheck`, `lint`, Strapi tsc, the Strapi file | exit 0. Vitest: 7 files, 517/517 passed. Lint and typecheck clean. Strapi: 9/9 passed, 0 failed. |
| Task 3 verify | `PHASE_19_BASE` diff of `refusal-copy.ts` and `status-badge.tsx`, the value-importer walk, `pnpm --dir apps/csrm test`, `pnpm --dir apps/backend test` | exit 0. Base diff empty. The walk printed `WALK_OK`. Web: 237 files, 5963/5963 passed. Strapi: 2026 tests, 2025 passed, 0 failed, 1 skipped. |

Other checks:
- **Content types.** `git diff --name-only bdd0f698 -- 'apps/backend/src/api/*/content-types/*'` (with the three IAM exclusions) prints nothing.
- **Dev servers.** Ports 1337 and 3000 were free before the suites ran.
- **Playwright.** Not run; this plan does not require it.

## Task Commits

1. **Task 1 RED:** `304ec9f3` test(19-02): expect the export row limit to reach the screen with its count
2. **Task 1 GREEN:** `82d812ad` feat(19-02): carry the export row limit from Strapi to its sentence
3. **Task 2 RED:** `eeb0805a` test(19-02): pin every Phase 19 refusal code and its words
4. **Task 2 GREEN:** `f5079c8f` feat(19-02): add the export and import refusal codes and their fix-it copy
5. **Task 3:** `e8d94b19` test(19-02): guard family S's vocabulary and placement

**Plan metadata:** the `docs(19-02)` commit that adds this summary, the 19-UI-SPEC S1 row, STATE.md and ROADMAP.md.

## Files Created/Modified

- `apps/backend/src/csrm/conflict-reasons.ts`: the 19 codes and their statuses
- `apps/backend/tests/conflict-reasons.unit.test.ts`: the row limit, the 19-code order and the `found` shape
- `docs/references/specification.json`: both enums and descriptions; `rowCount`, `rowCap` and `found`
- `apps/csrm/src/lib/api/generated/schema.d.ts`: regenerated
- `apps/csrm/src/lib/api/conflict-reasons.ts` and its test: the web mirror
- `apps/csrm/src/lib/api/transport/server-client.ts` and its test: the three guarded details
- `apps/csrm/src/features/exports/export-refusal-copy.ts` and its test: S1
- `apps/csrm/src/features/administration/import-refusal-copy.ts` and its test: S2 and S3
- `apps/csrm/src/lib/performance/interface-copy-guard.test.ts`: both modules listed
- `.planning/.../19-UI-SPEC.md`: the S1 row renamed to `ASSESSMENT_NOT_RELEASED`

## Decisions Made

See `key-decisions` in the frontmatter. The main design choice is that `importFileRefusal` is total over the 15 S2 codes. Any other import refusal (`IMPORT_DECISION_MISSING`, `IMPORT_REVIEW_EXPIRED`) goes through `importStepRefusal`, and any other failure keeps the flow's existing copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The S1 `ASSESSMENT_NOT_RELEASED` branch moved from Task 1 to Task 2**
- **Found during:** Task 1 GREEN
- **Issue:** Task 1 asks for all six S1 rows, but `ASSESSMENT_NOT_RELEASED` is not a `ConflictReason` until Task 2. Comparing against it fails strict typecheck (TS2367).
- **Fix:** Task 1 shipped five S1 rows; Task 2 added the sixth together with its code.
- **Commit:** `82d812ad`, `f5079c8f`

**2. [Rule 3 - Blocking] The contract was staged before `api:check`**
- **Found during:** Task 1 verify
- **Issue:** `api:check` runs `git diff --exit-code` against the index, so a freshly regenerated, not-yet-staged `schema.d.ts` reads as drift.
- **Fix:** Staged `specification.json` and `schema.d.ts` before running the verify, then committed them in the same task commit. The verify itself was unchanged.

**3. [Rule 1 - Bug] A RED test's typing**
- **Found during:** Task 2 verify (typecheck)
- **Issue:** `import-refusal-copy.test.ts` passed a widened `string | undefined` to `isImportFileRefusalReason`.
- **Fix:** Added `as const`. The fix is in the GREEN commit `f5079c8f`.

**4. [Rule 2 - Correctness] Narrower `importFileRefusal` input, and fallback wording for a missing detail**
- **Signature.** The plan types the input as `reason: ConflictReason`. A non-S2 code would then need copy the UI-SPEC does not have, so the input is `reason: ImportFileRefusalReason` (the 15 S2 codes), with `IMPORT_FILE_REFUSAL_REASONS` and `isImportFileRefusalReason` exported for callers to narrow with.
- **Fallbacks.** Strapi serves `found` as the record states, and the browser knows the file's name and size. Even so, a dropped or absent detail must not produce an empty string. These fallbacks are not in 19-UI-SPEC and are flagged for the UI review:
  - **No file name:** reads `This file` (`IMPORT_FILE_TYPE`, `IMPORT_FILE_TOO_LARGE`).
  - **No file size:** `{name} is larger than 5 MB. Split the rows into smaller files and import each.`
  - **No row count:** `It has more than 5,000 rows. Split the rows into smaller files and import each.`
  - **`IMPORT_DUPLICATE_HEADER` without two headers and a label:** `Two of the column names match the same column. Delete one of them, then choose the file again.`
  - **`IMPORT_MISSING_COLUMN` with no labels:** `Add the required columns (they’re in the template), then choose the file again.`
  - **Three or more labels:** a written-out list (`Name, Owner and Status`).
  - **`IMPORT_DELIMITER` without `found.delimiter`:** reads `semicolons`.
  - **`EXPORT_ROW_LIMIT` without `rowCount`:** reads as S1's `We couldn’t create the file.` with `Try again`.

**5. [Pilot ruling 1] The 19-UI-SPEC S1 row now reads `ASSESSMENT_NOT_RELEASED`**
- Applied by this plan, which owns S1. The change is committed with this summary.

### Not done

- **`requirements.mark-complete` was not run.** CSV-01 to CSV-03 are delivered across the whole phase (plans 19-01 to 19-15), and 19-01 likewise recorded none.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None.

## Threat Flags

None. T-19-03 and T-19-04 are mitigated as the plan's threat register states (closed guards; strings cleaned of controls; a 403 is worded by S1, never with the server's message). No package was added (T-19-SC).

## User Setup Required

None.

## Next Phase Readiness

- Plans 19-03 and 19-05 can throw any of the 19 codes with `rowCount`, `rowCap` or `found`; the contract already publishes them.
- Plans 19-06 and 19-11 import `exportRefusal` from `features/exports/export-refusal-copy`.
- Plans 19-13 to 19-15 import `importFileRefusal`, `importStepRefusal` and `isImportFileRefusalReason` from `features/administration/import-refusal-copy`, passing `TransportError.found` and the chosen file's name and `formatFileSize` output.
- `refusal-copy.ts` and `status-badge.tsx` are unchanged since `PHASE_19_BASE`. The only value importers of the web `conflict-reasons.ts` are `server-client.ts` and `attachments-schema.ts`.

## Self-Check: PASSED

- Files present: `apps/csrm/src/features/exports/export-refusal-copy.ts`, `apps/csrm/src/features/exports/export-refusal-copy.test.ts`, `apps/csrm/src/features/administration/import-refusal-copy.ts` and `apps/csrm/src/features/administration/import-refusal-copy.test.ts`.
- Commits present: `304ec9f3`, `82d812ad`, `eeb0805a`, `f5079c8f` and `e8d94b19`. `git rev-list --count 954c7262..e8d94b19` = 5.

---
*Phase: 19-csv-export-and-import-hardening*
*Completed: 2026-10-16*
