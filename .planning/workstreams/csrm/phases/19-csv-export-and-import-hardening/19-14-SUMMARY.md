---
phase: 19-csv-export-and-import-hardening
plan: 14
subsystem: imports
tags: [administration-import, import-template, error-report, reference-list-export, round-trip, authorization-matrix, catalogue]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-03: writeWorkbook, writeCsv, readImportFile, the neutraliser; 19-04: importColumns, the reference views' columns, runListExport, exportFileName; 19-05: SERVICE_IDENTITY_REFUSED_OPERATIONS, underlyingRead and the export refusal wording; 19-13: retained issue codes, matchedName, resultRecordFor, IMPORT_REVIEW_EXPIRED, createXlsxMultipart, the example row and the notes"
provides:
  - "12 served operations: GET /api/v1/{segment}/import/template, POST /api/v1/{segment}/import/error_report and GET /api/v1/{segment}/export for risk_types, controls, information_systems and information_assets"
  - "administration-workflow.ts: buildImportTemplate, parseTemplateQuery, buildImportErrorReport, errorReportFields, previewRecordForReport"
  - "csv-import.ts: importIssueMessage (the closed row-issue vocabulary with column labels) and similarRowMessage (S4)"
  - "administration-query.ts: parseAdministrationExportQuery and AdministrationExportQuery"
  - "export-views.ts: referenceListExportView(strapi, kind), the four reference lists in registeredExportViews"
  - "csrm-authorization.ts: the four reference exports as quoted literals in HUMAN_ANALYST_ONLY_OPERATIONS and SERVICE_IDENTITY_REFUSED_OPERATIONS"
  - "tests/helpers/strapi-http-harness.ts: MultipartImportInput with resultToken and timeZone on both multipart helpers"
affects: [19-15]

actuals:
  tokens: 69000
  tasks: 3
  commits: 6

plan_head_before: 7b0e71de9d57d7e0f38644e6b2b14d9cb1505942
plan_head_after: b8c2f78b0530e9dadec079a7246635d3affe04dc

tech-stack:
  added: []
  patterns:
    - "A generated file that is not an export of records (a template, an error report) goes out through sendStoredFile or sendExportFile with the export media types, and writes no security event"
    - "A record-bound download takes exactly one opaque token, checks the upload's SHA-256 against the record, and rebuilds every cell from the upload and the record, never from the client"
    - "An export whose list read and export share one Function is proven 'without the list read' by withdrawing that FunctionApi from the Function, not the Function from the role"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-administration/operations.ts
    - apps/backend/src/api/csrm-administration/routes/csrm-administration.ts
    - apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts
    - apps/backend/src/api/csrm-administration/services/administration-workflow.ts
    - apps/backend/src/api/csrm-administration/services/administration-query.ts
    - apps/backend/src/api/csrm-administration/services/csv-import.ts
    - apps/backend/src/csrm/exports/export-views.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/administration.integration.test.ts
    - apps/backend/tests/administration.unit.test.ts
    - apps/backend/tests/exports.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/authorization.integration.test.ts

key-decisions:
  - "FunctionApi numbers follow the task order: each Administration Function gains .api.05 Download {Plural} Import Template, .api.06 Download {Plural} Import Error Report and .api.07 Export {Plural} (the plan listed Export first; it allowed 'next free numbers')"
  - "An error report replaces an earlier report's Issues column instead of adding a second one, so a corrected report reported again still has one Issues column, last"
  - "Error report cells are written as typed: the neutraliser's mark is taken off and the writer puts it back, so `=1+2` and `'=1+2` both come back as `'=1+2` and import as `=1+2`; header cells are neutralised too"
  - "The template's example row fills text columns with `Example {label}` (so Description reads `Example description`), the first allowed value for an enumeration and Yes for a flag; its natural key comes only from the vocabulary"
  - "A template query is exactly `format=csv|xlsx`: any other parameter, a repeat or a missing format is 400 INVALID_ADMINISTRATION_DATA"
  - "Error-report 400s: INVALID_IMPORT_ERROR_REPORT for both or neither token, a malformed token, any field outside previewDigest, resultToken and timeZone (issues included) and an unknown zone; INVALID_IMPORT_FILE for a file whose digest differs from the record's"
  - "The reference exports publish the list's own documented query parameters (minus page and pageSize) plus format (required), columns and timeZone"

requirements-completed: []

duration: 2h20m
completed: 2026-10-17
---

# Phase 19 Plan 14: Templates, error reports and reference-list exports Summary

**Each Administration collection now serves a self-explaining import template, an error report Strapi rebuilds from the uploaded file and its own preview or result record, and a reference-list export in its import shape. The four exports are human-only, and all 12 operations are catalogued, published, inventoried and in the matrix. A corrected error report and an edited export both import back.**

## Performance

- **Duration:** about 2h20m (12:46 to 15:06 AEDT, 2026-10-17), including two full Strapi suite runs (35.7 and 41.8 min)
- **Tasks:** 3, each RED then GREEN
- **Files modified:** 21

## Accomplishments

- **Templates (D-31):** `GET /api/v1/{segment}/import/template?format=csv|xlsx`.
  - The headers are the import labels in contract order, followed by one example row with the vocabulary's reserved key.
  - Every cell is text (`@` in a workbook).
  - The XLSX template adds `Notes`: Column, Also accepted as, Required, Format and allowed values, and A blank cell, one row per column. An empty row follows, then the six §3.4 rules with `{singular}` filled in.
  - The file is named `{slug}-import-template.{csv|xlsx}` and has no row count, no event and no dropdowns.
  - Round trip: Bob's Information Systems workbook, with two rows typed in (one with Internet-facing `Y`), previews with `notes: ["example-row"]` and two `create` rows, and the commit creates both.
- **Error reports (D-32):** `POST /api/v1/{segment}/import/error_report`, multipart with `file` and exactly one of `previewDigest` or `resultToken`, plus an optional `timeZone`.
  - At Review, the file holds the rejected, ambiguous and similar rows. At Results, it holds the rejected (drift included) and ambiguous rows, so imported and unchanged rows and the analyst's own skips are left out.
  - The header comes back as typed (`name,DESCRIPTION`), the cells as typed and neutralised, then `Issues`: `Row 3: Name must be at most 255 characters.` and `Row 4: Matches the existing name “…” except for capitals or spacing. Type the existing name exactly to update it.`
  - Format: CSV with a BOM, or XLSX for an XLSX upload. The file is named `{slug}-import-issues-{local date}.{ext}`, with `X-CSRM-Row-Count`, and writes no event.
  - The preview record is read, not consumed: the reviewed file still commits after a report.
- **Criterion 4:** the CSV report, with its rejected name corrected and the similar row given the stored name, previews with `notes: ["issues-column"]`. The corrected row is `create` and the similar row `update`, and the `=1+2` cell imports as `=1+2`. The same round trip through an XLSX upload returns an XLSX report, and the corrected workbook previews as `create`.
- **Reference-list exports (D-04, D-33):** `GET /api/v1/{segment}/export?format=csv|xlsx`.
  - Each export runs the admin list's own parser, refusing a page; the count, order and hydration go through the admin repository, then the admin projection.
  - The file holds the import columns under the template's labels, then the read-only columns: Owner by display name for Information Systems, and Applicable controls as a count for Risk Types.
  - The control number `00{pid}` stays text in XLSX.
  - An exported Information Systems workbook, with one description edited, previews that row as `update` (changes `["description"]`) and every other row as `unchanged`, with `notes: ["read-only-columns"]`, `readOnlyColumns: ["Owner"]` and no warning.
  - Each export writes one `export.completed` line.
- **Grants and refusals (D-13, D-16, D-18):** the 12 operations join the four Administration Functions, which `role.security_analyst` alone holds.
  - The exports also need their list read (`underlyingRead`) and sit in both refusal sets as quoted literals.
  - Jane, the other Requestor, the service agent and no identity are refused 403 at all 12, and no token gets 401 (matrix rows).
  - At each export, the policy's own wording is proven:
    - The service agent, even with its role granted the Function, reads `CSRM exports are refused to automation identities.`
    - Jane, with the Requestor role granted the Function, reads `CSRM analyst exports require a human Security Analyst.`
    - Bob, with the list read withdrawn from the Function, reads `CSRM export requires the list read.`

## FunctionApi numbers and the human-only count

| Function | Template | Error report | Export |
| --- | --- | --- | --- |
| `function.administration.risk_types` | `.api.05` | `.api.06` | `.api.07` |
| `function.administration.controls` | `.api.05` | `.api.06` | `.api.07` |
| `function.administration.information_systems` | `.api.05` | `.api.06` | `.api.07` |
| `function.administration.information_assets` | `.api.05` | `.api.06` | `.api.07` |

- The export URLs are `GET:/api/v1/{segment}/export?format={format}`; the served inventory and the matrix key them `GET:/api/v1/{segment}/export`.
- **Human-only count:** 37 before this plan, 41 after (`41 + insightOperations.size`). The chain is 31 at `bdd0f698`, then 32 (19-05), 33 (19-07), 35 (19-08), 36 (19-09), 37 (19-10) and 41 (19-14).
- `SERVICE_IDENTITY_REFUSED_OPERATIONS` gained the same four (10 to 14 members). The fixture mirrors gained them too; no count is pinned for that mirror.

## Task Commits

1. **Task 1: templates**
   - RED `ff245aee` (test)
   - GREEN `5c871f86` (feat)
2. **Task 2: error reports**
   - RED `464d51a3` (test)
   - GREEN `47990481` (feat)
3. **Task 3: reference exports, matrix, catalogue, full suite**
   - RED `cdee0b19` (test)
   - GREEN `b8c2f78b` (feat)

## Route budgets

Not measured. This plan changes no web runtime module: its only `apps/csrm` file is the generated `schema.d.ts`, which is type-only and emits no JavaScript. `git diff --name-only 7b0e71de..HEAD -- apps/csrm` lists only that file. The 19-13 figures stand: `/app/risks/{documentId}` has 1,202 bytes of headroom and `/app/requests/{documentId}` 1,535. The web typecheck (`next typegen && tsc --noEmit`) passes against the regenerated schema.

## Verification

- **Task 1 verify** (api:check, cmp, tsc, `administration.integration`): exit 0, 33/33.
  - Also run: `contract-catalogue` and `served-operations`, 41/41.
- **Task 2 verify:** exit 0, 37/37.
  - `administration.unit`: 23/23, with the fake-clock expiry test.
- **Task 3 focused runs:**
  - The `reference-lists` tests: 5/5.
  - `authorization-matrix`, `contract-catalogue`, `export-vocabulary.unit` and `served-operations`: 224/224.
- **Task 3 verify** (cmp, api:check, `pnpm --dir apps/backend test`):
  - First run: 2,246 tests, 2,243 passed, 2 failed, 1 skipped (35.7 min). Both failures were the Phase 06 pins of 24 (deviation 5).
  - After the fix: exit 0, 2,246 tests, 2,245 passed, 0 failed, 1 skipped (41.8 min).
- **Acceptance checks:**
  - The content-type diff against `bdd0f698` prints nothing.
  - `Example (CSRM skips this row)` appears 0 times in `administration-workflow.ts` and 3 times in `export-vocabulary.json`.
  - `buildImportErrorReport`'s signature has no issues parameter.
  - The matrix fixture holds the three named row keys as literals and the four exports in both mirrors.
  - `csrm-authorization.ts` holds `"GET:/api/v1/information_systems/export?format={format}"` in both sets.
  - Both catalogue copies hold the four `Export {Plural}` FunctionApis, and `served-operations.json` lists the four `GET:/api/v1/{segment}/export` rows.
  - The specification change is additions only: 12 paths, and the parsed HEAD spec deep-equals the new one minus them.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] The multipart helpers' `resultToken` and `timeZone` landed with Task 2's RED tests**
- **Why:** the RED tests send both fields, so they could not compile without them.
- **Change:** `MultipartImportInput` now types both helpers.
- **Commit:** `464d51a3`

**2. [Rule 3] The expired-record proof is a unit test**
- **Where:** `administration.unit.test.ts`, which is outside the plan's file lists.
- **Why:** integration tests cannot reach Strapi's in-memory preview and result stores (19-13's recorded pattern).
- **Proof:** with a fake clock, both an expired preview and an expired result record answer 409 `IMPORT_REVIEW_EXPIRED` at the error report, and a live record builds it.
- **Commit:** `464d51a3`

**3. [Rule 1 - Test bug] Two error-report tests shared their importable row**
- **Issue:** the first verify run failed 36/37 because the Results test's "ok" row had already been created by the Review test.
- **Fix:** each test's row name now derives from its own stored name.
- **Commit:** `47990481`

**4. [Rule 3] The "without the list read" proof withdraws a FunctionApi, not a Function**
- **Issue:** an Administration Function holds both the list read and its export. `withRoleOperationWithdrawn` takes the whole Function from the role, which also withdrew the export, so the policy answered `CSRM FunctionAPI access is denied.`
- **Fix:** a test helper, `withFunctionApiWithdrawn`, takes only the list-read FunctionApi out of the Function, then restores it.
- **Commit:** `b8c2f78b`

**5. [Rule 3 - Blocking] Phase 06's Administration inventory pinned 24 operations**
- **Found during:** Task 3's first full suite run: 2,246 tests, 2,243 passed, 2 failed, 1 skipped.
- **Issue:** two tests in `authorization.integration.test.ts` (outside the plan's file lists) pinned the Administration operations at exactly 24, and the 12 new ones made 36: `catalogue grants exactly 24 no-delete human-analyst Administration operations` and `Administration route inventory is token-only, exact-grant, human-only, and duplicate-free`.
- **Fix:** both tests now use `ADMINISTRATION_OPERATION_COUNT = 24 + 12`, with a comment naming 19-14, and the first test's title says 36. Their other checks are unchanged, and they still pass with the new routes: exactly one FunctionApi per operation in an Administration Function, `role.security_analyst` only, token-only, `requireAnalystAdministrationScope`, no DELETE.
- **Result:** both files reran 193/193, then the full suite was run again (below).
- **Commit:** `b8c2f78b`

**6. Matrix keys as literals**
- **Change:** the administration family's table carries each collection's three row keys explicitly.
- **Why:** the acceptance greps find them as literals in the fixture, and the operation strings did not change.

### Readings of the plan

- **Jane's wording:**
  - Jane without any grant is refused before the human-only check: `CSRM FunctionAPI access is denied.`, as at every 19-07 to 19-10 export.
  - `CSRM analyst exports require a human Security Analyst.` is proven with Jane's Requestor role granted the Function, as those plans proved it.
- **Matrix rows:**
  - The template rows are issued for every actor (`exercisesAllowed`, the analyst 200 seen directly).
  - The error-report and export rows state the analyst's 200 `provenBy` the HTTP tests, as the plan says.
- **Between Task 1 GREEN and Task 3 GREEN** the matrix's "every served operation has exactly one matrix row" test failed, because the new routes were served before their rows existed. The plan places the 12 rows in Task 3, and each task's verify runs only its own file.
- **Policy comment:** `SERVICE_IDENTITY_REFUSED_OPERATIONS` said "Phase 19 adds its 14 export operations". With the reference lists it is 18, and the comment now says so.

### Differences from the identifiers the plan names (written ahead)

- `buildImportErrorReport` takes `{ kind, state, uploads, previewDigest?, resultToken?, timeZone? }` and resolves the actor from `state`. The controller closes the body first through `errorReportFields`.
- `previewRecordForReport` returns null for an unknown, foreign or expired record, and the report answers 409.
- `referenceListExportView` takes `(strapi, kind)`, as the other views take `strapi`.

## Issues Encountered

- `tsc` sets `noEmitOnError`, so Task 2's RED first showed as a compile error, the missing `buildImportErrorReport` export. The four integration tests were then shown failing with `--noEmitOnError false`: 0/4.
- Git's default diff shows the specification's insertions as a mixed diff. `--diff-algorithm=histogram` shows 682 insertions and 0 deletions.

## Known Stubs

None. The web does not offer the template, error report or reference exports yet: plan 19-15 wires them, anchored on the catalogue URLs.

## Threat Flags

None beyond the plan's register.
- T-19-48: built only from the upload and the actor's own record, digest-checked, closed fields, five-minute records.
- T-19-49: every cell, headers included, passes the one neutraliser.
- T-19-50: human-only, in both refusal sets, with matrix rows.
- T-19-51: the reader's bounds and at most 5,000 rows.

## Next Phase Readiness

- **19-15:**
  - Anchor the Download template, Download error report and Export buttons on the 12 catalogue URLs. For an export, strip `?format={format}` before matching the served path.
  - Send `resultToken` from the commit response at Results, and `previewDigest` at Review.
  - Read `X-CSRM-Row-Count` for the toast.
- **CSV-01 and CSV-02** stay open until 19-15, per the running notes.

## Self-Check: PASSED

- This SUMMARY is present, and the plan changed 21 files (`git diff --name-only 7b0e71de HEAD`).
- Commits `ff245aee`, `5c871f86`, `464d51a3`, `47990481`, `cdee0b19` and `b8c2f78b` are all on `csrm`. The plan made no file deletions.
