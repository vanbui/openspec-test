---
phase: 19-csv-export-and-import-hardening
verified: 2026-10-17T13:51:00Z
status: passed
score: "6/6 roadmap success criteria verified at HEAD 16803cd4 (after the T-19-06 fix d12f1fa2); CSV-01, CSV-02 and CSV-03 satisfied; UAT-049, UAT-051 and UAT-052 closed in code; 15/15 plans' must-haves delivered (46/47 artifact and 37/37 key-link pattern checks pass; the one miss is a placement deviation with the wiring found elsewhere); 3 plan backstop truths routed to human checks; 0 gaps; 8 human checks; 8 operator checks stay open as deferred follow-ups in 19-UAT.md (pilot status ruling, 2026-10-18)"
covered_files:
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-01-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-01-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-02-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-02-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-03-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-03-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-04-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-04-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-05-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-05-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-06-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-06-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-07-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-07-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-08-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-08-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-09-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-09-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-10-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-10-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-11-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-11-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-12-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-12-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-13-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-13-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-14-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-14-SUMMARY.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-15-PLAN.md
  - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/19-15-SUMMARY.md
  - apps/backend/.gitignore
  - apps/backend/package.json
  - apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts
  - apps/backend/src/api/csrm-administration/operations.ts
  - apps/backend/src/api/csrm-administration/routes/csrm-administration.ts
  - apps/backend/src/api/csrm-administration/services/administration-query.ts
  - apps/backend/src/api/csrm-administration/services/administration-workflow.ts
  - apps/backend/src/api/csrm-administration/services/csv-import.ts
  - apps/backend/src/api/csrm-analyst-insight/controllers/alerts.ts
  - apps/backend/src/api/csrm-analyst-insight/controllers/reports.ts
  - apps/backend/src/api/csrm-analyst-insight/operations.ts
  - apps/backend/src/api/csrm-analyst-insight/routes/alerts.ts
  - apps/backend/src/api/csrm-analyst-insight/routes/reports.ts
  - apps/backend/src/api/csrm-analyst-insight/services/alert-query.ts
  - apps/backend/src/api/csrm-analyst-insight/services/report-query.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/operations.ts
  - apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/routes/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
  - apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/operations.ts
  - apps/backend/src/api/csrm-assessment/routes/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-assessment/services/released-assessment-read.ts
  - apps/backend/src/api/csrm-current-user/services/effective-access.ts
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/operations.ts
  - apps/backend/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-risk/controllers/csrm-risk.ts
  - apps/backend/src/api/csrm-risk/operations.ts
  - apps/backend/src/api/csrm-risk/routes/csrm-risk.ts
  - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
  - apps/backend/src/api/csrm-risk/services/risk-register.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/bootstrap/seed-csrm-data.ts
  - apps/backend/src/csrm/audit/security-event-log.ts
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/csrm/exports/export-errors.ts
  - apps/backend/src/csrm/exports/export-time.ts
  - apps/backend/src/csrm/exports/export-views.ts
  - apps/backend/src/csrm/exports/export-vocabulary.json
  - apps/backend/src/csrm/exports/export-vocabulary.ts
  - apps/backend/src/csrm/exports/released-assessment-export.ts
  - apps/backend/src/csrm/exports/report-tables.ts
  - apps/backend/src/csrm/exports/run-export.ts
  - apps/backend/src/csrm/exports/send-export.ts
  - apps/backend/src/csrm/spreadsheets/csv-writer.ts
  - apps/backend/src/csrm/spreadsheets/header-match.ts
  - apps/backend/src/csrm/spreadsheets/import-file.ts
  - apps/backend/src/csrm/spreadsheets/neutralise.ts
  - apps/backend/src/csrm/spreadsheets/value-convert.ts
  - apps/backend/src/csrm/spreadsheets/xlsx-reader.ts
  - apps/backend/src/csrm/spreadsheets/xlsx-writer.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - "apps/csrm/app/(app)/app/admin/[collection]/import/page.tsx"
  - "apps/csrm/app/(app)/app/admin/[collection]/page.tsx"
  - "apps/csrm/app/(app)/app/alerts/page.tsx"
  - "apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx"
  - "apps/csrm/app/(app)/app/assessments/[documentId]/report/error.tsx"
  - "apps/csrm/app/(app)/app/assessments/[documentId]/report/loading.tsx"
  - "apps/csrm/app/(app)/app/assessments/[documentId]/report/page.tsx"
  - "apps/csrm/app/(app)/app/assessments/page.tsx"
  - "apps/csrm/app/(app)/app/questionnaires/page.tsx"
  - "apps/csrm/app/(app)/app/reports/[reportKey]/page.tsx"
  - "apps/csrm/app/(app)/app/requests/page.tsx"
  - "apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx"
  - "apps/csrm/app/(app)/app/review/assessments/[documentId]/report/error.tsx"
  - "apps/csrm/app/(app)/app/review/assessments/[documentId]/report/loading.tsx"
  - "apps/csrm/app/(app)/app/review/assessments/[documentId]/report/page.tsx"
  - "apps/csrm/app/(app)/app/review/assessments/page.tsx"
  - "apps/csrm/app/(app)/app/review/assigned/page.tsx"
  - "apps/csrm/app/(app)/app/review/questionnaires/page.tsx"
  - "apps/csrm/app/(app)/app/review/requests/page.tsx"
  - "apps/csrm/app/(app)/app/risks/page.tsx"
  - apps/csrm/app/globals.css
  - apps/csrm/e2e/accessibility.spec.ts
  - apps/csrm/e2e/administration-workflow.spec.ts
  - apps/csrm/e2e/design-system-conformance.spec.ts
  - apps/csrm/e2e/exports-and-imports.spec.ts
  - apps/csrm/e2e/production-hardening.spec.ts
  - apps/csrm/e2e/request-pick-up.spec.ts
  - apps/csrm/e2e/risk-register-workflow.spec.ts
  - apps/csrm/package.json
  - apps/csrm/playwright.config.ts
  - apps/csrm/src/components/csrm/export/column-choice.tsx
  - apps/csrm/src/components/csrm/export/export-button.tsx
  - apps/csrm/src/components/csrm/export/export-dialog.tsx
  - apps/csrm/src/components/csrm/segmented-control.tsx
  - apps/csrm/src/components/csrm/status-badge.tsx
  - apps/csrm/src/features/administration/administration-actions.ts
  - apps/csrm/src/features/administration/administration-domain.ts
  - apps/csrm/src/features/administration/administration-service.ts
  - apps/csrm/src/features/administration/administration-workspace.tsx
  - apps/csrm/src/features/administration/csv-client-parser.ts
  - apps/csrm/src/features/administration/csv-import-flow.tsx
  - apps/csrm/src/features/administration/csv-import-schema.ts
  - apps/csrm/src/features/administration/import-flow-rules.ts
  - apps/csrm/src/features/administration/import-refusal-copy.ts
  - apps/csrm/src/features/administration/import-row-status.tsx
  - apps/csrm/src/features/alerts/alert-list-chips.ts
  - apps/csrm/src/features/alerts/alert-service.ts
  - apps/csrm/src/features/alerts/alerts-page-header.tsx
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/src/features/assessments/assessment-list-chips.ts
  - apps/csrm/src/features/assessments/assessment-list.tsx
  - apps/csrm/src/features/assessments/assessment-report-model.ts
  - apps/csrm/src/features/assessments/assessment-report.tsx
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-server-schema.ts
  - apps/csrm/src/features/assessments/assessment-service.ts
  - apps/csrm/src/features/assessments/released-assessment-actions.tsx
  - apps/csrm/src/features/assessments/released-assessment-report.ts
  - apps/csrm/src/features/assessments/released-assessment.tsx
  - apps/csrm/src/features/assessments/report-toolbar.tsx
  - apps/csrm/src/features/exports/export-actions.ts
  - apps/csrm/src/features/exports/export-file-check.ts
  - apps/csrm/src/features/exports/export-refusal-copy.ts
  - apps/csrm/src/features/exports/export-scope.ts
  - apps/csrm/src/features/exports/export-vocabulary.json
  - apps/csrm/src/features/exports/export-vocabulary.ts
  - apps/csrm/src/features/exports/list-export-button.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-list-chips.ts
  - apps/csrm/src/features/questionnaires/questionnaire-service.ts
  - apps/csrm/src/features/reports/report-service.ts
  - apps/csrm/src/features/requests/my-request-chips.ts
  - apps/csrm/src/features/requests/request-service.ts
  - apps/csrm/src/features/risks/risk-register-chips.ts
  - apps/csrm/src/features/risks/risk-register-filters.tsx
  - apps/csrm/src/features/risks/risk-register.tsx
  - apps/csrm/src/features/risks/risk-service.ts
  - apps/csrm/src/lib/api/conflict-reasons.ts
  - apps/csrm/src/lib/api/transport/server-client.ts
  - apps/csrm/src/lib/capabilities/analyst-review-gate.ts
  - apps/csrm/src/lib/capabilities/capability-adapter.ts
  - apps/csrm/src/lib/capabilities/development-capabilities.ts
  - apps/csrm/src/lib/capabilities/strapi-capabilities.ts
  - apps/csrm/src/lib/capabilities/viewer-capabilities.ts
  - apps/csrm/src/lib/files/file-response.ts
  - apps/csrm/src/lib/files/save-file.ts
covered_digest: "v2:sha256:6c5468730daf20ba266fc465acbc1e0d98e83bdaa3ec9f1c4e2b1696d547ab1b"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_verified: 2026-10-17T11:27:48Z
  previous_status: human_needed
  previous_score: "6/6 roadmap success criteria verified; 0 gaps; 8 human checks"
  reason: "The earlier report (committed in 31d7c70d) predates the T-19-06 fix. 08e2e72d (test) and d12f1fa2 (fix) changed apps/backend/src/csrm/spreadsheets/import-file.ts, a covered file, so the fingerprint went stale. 7160ce64 added the T-19-45 preview-cap tests (tests only)."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "A questionnaire export with a status filter bounds the memory of an over-cap attempt, not only the file (19-REVIEW BE1-09)"
    addressed_in: "Phase 22"
    evidence: "19-REVIEW-DISPOSITION.md and deferred-items.md route BE1-09 to Phase 22's hardening; 22-CONTEXT.md:520 'Carried from Phase 19 (2026-10-17, pilot rulings)'. Outside the six success criteria: the 10,000-row cap still bounds the file, and the export is analyst-only."
  - truth: "function.reports.reports, empty after 19-09's move, is no longer granted to the Security Analyst Agent (19-REVIEW BE2-07)"
    addressed_in: "Phase 22"
    evidence: "22-CONTEXT.md:520 carries BE2-07; Phase 22 withdraws the agent's explicit grants (D-09). Not a hole: the report export moved to function.reports.export_api, granted to role.security_analyst only, and SERVICE_IDENTITY_REFUSED_OPERATIONS refuses the agent."
human_verification:
  - test: "An export opened in Excel with the neutraliser mark (CSV-01 (3), criterion 1; 19-UAT test 1)"
    expected: "Exported CSV and XLSX holding =HYPERLINK(\"https://example.test\",\"Click\") open with the cell as text and nothing evaluates; the CSV saved as CSV and reopened keeps it as text; OWASP's tab variant behaves the same; re-importing both leaves the stored values unchanged."
    why_human: "Excel is not installed here, and OWASP's caveat concerns Excel's own behaviour. Backstops: spreadsheet-neutralise.unit.test.ts, spreadsheet-writers.unit.test.ts, exports.integration.test.ts 'risk-register: … a formula-like statement as text …' and 'reference-lists: … imported back byte for byte in CSV and XLSX …' (the exports file re-run here at 16803cd4, 47/47)."
  - test: "An error report corrected in Excel and imported again, CSV and XLSX (CSV-02 (3), criterion 4; 19-UAT test 2)"
    expected: "Both error reports open in Excel; a rejected row is corrected and saved in the same format; the re-import previews the fixed row as create or update and notes the Issues column."
    why_human: "The automated proof reads the files with the same libraries and csv-parse, not with Excel. Backstops: administration.integration.test.ts 'CSV-02 D-32 criterion 4: a corrected error report re-imports with its Issues column noted, through CSV and through XLSX' (re-run here at 16803cd4 through the fixed XLSX reader, green) and the e2e 'error report round trip @journey' (final gate at 31d7c70d)."
  - test: "A Windows-1252 CSV saved by real Excel (CSV-02 (2), criterion 3; 19-UAT test 3)"
    expected: "Excel's 'CSV (Comma delimited)' file with Café is refused at Select file with the 'Save the file as CSV UTF-8' steps and the file stays chosen; the CSV UTF-8 or .xlsx resave imports the name intact."
    why_human: "The suites write Windows-1252 from a latin1 buffer, not from Excel. Backstops: spreadsheet-reading.unit.test.ts 'IMPORT_ENCODING_WINDOWS_1252: RT-3 (0xE9)', administration.integration.test.ts 'CSV-03 an unreadable file is refused with IMPORT_ENCODING_WINDOWS_1252 …' (both re-run here at 16803cd4, green) and the e2e 'import tolerance @journey'."
  - test: "The 25-risk released assessment printed on A4 paper (criterion 6; 19-12 backstop truth; 19-UAT test 4)"
    expected: "The overview is A4 portrait with the 16mm margin and Page n of m; the overview table's header repeats on each page and no column is clipped; Risks in detail starts on a new page; the document title is the one h1 on paper."
    why_human: "Plan 19-12 marks this truth verification: backstop (non-inferable); no test renders 25 risks on paper. Backstops: assessment-report.test.tsx (re-run here, green), the X-31 print rules in globals.css, and the e2e 'print report @journey' (print emulation and the A4 PDF on desktop, 2 pages at the final gate)."
  - test: "NVDA and keyboard-only on Windows (19-UI-REVIEW UI-01 to UI-04, UI-11, UI-12; 19-UAT test 5)"
    expected: "Export dialog, column choice, released Print report and Export, the import steps, the similar-row gate and the downloads announce once and keep focus on the pressed control or the next action; the whole path works without a mouse."
    why_human: "DOM assertions and axe cannot establish real screen-reader speech. Backstops: export-dialog.test.tsx and administration-workflow.test.tsx with the stage B tests of 6e748eeb and 536d3856 (re-run here, green), and axe at 375 and 1440 in exports-and-imports.spec.ts."
  - test: "Visual review at 768, with reflow from 320 to 1440 (19-UI-REVIEW UI-06; the 19-06 and 19-15 backstop truths; 19-UAT test 6)"
    expected: "Each list header with Export, the export dialog at 768 (including a five-filter dialog with a long search term at 375 that wraps and keeps Export file visible), the released header wrapper, the report card, and the import Review step with a 200-character existing name in an Update label that wraps at 375 and 1440 with the radio aligned to its first line."
    why_human: "The UI audit was code-only and no Playwright project runs at 768. Plans 19-06 and 19-15 mark the five-filter and 200-character truths verification: backstop, and no test seeds either. Backstops: the @journey tests' expectNoOverflow and axe at 375 and 1440 with one search term and a short name."
  - test: "The operator's development database after the next Strapi start (19-UAT test 7)"
    expected: "The new export and import FunctionAPI rows load with the human-only analyst exports on role.security_analyst and the own-record Function on the Requestor birthright; the BE2-08 re-seed leaves one FunctionAPI row per catalogued URL, so the two moved URLs carry no stale grant; Bob exports and imports, Jane exports only her own records and her released assessment."
    why_human: "The operator's database changes only when the operator restarts Strapi; the verifier may not start servers. Backstops: catalogue-reseed.integration.test.ts 3/3, authorization-matrix.integration.test.ts 173/173 (both run 2026-10-17 and in the final gate at 31d7c70d) and exports.integration.test.ts 47/47 (re-run here)."
  - test: "Production schema and contract acceptance (19-UAT test 8)"
    expected: "The deployment accepts the additive specification.json operations with their binary responses and the catalogue's API-only Functions, with no grant to the Security Analyst Agent or any service role; export.completed and export.refused (including the log-only EXPORT_FAILED) reach the production log pipeline, one line per attempt, with no cell value."
    why_human: "Needs a deployment against the production schema, catalogue and log pipeline. Backstops: the content-type freeze is empty since bdd0f698, the catalogue copies are byte-identical (cmp), and both G-6 records carry the pilot's approval lines."
---

# Phase 19: CSV export and import hardening: Verification Report

**Phase Goal:** As a Security Analyst or risk manager, I want to export any list I can see and to import spreadsheets without fighting the format, so that CSRM fits the Excel work around it.
**Verified:** 2026-10-17T13:51:00Z (2026-10-18 local)
**Status:** passed (pilot status ruling, 2026-10-18) (the pilot rules on the final status; see Gaps Summary)
**Re-verification:** Yes. The fingerprint went stale, so this re-run is at HEAD `16803cd4` against PHASE_19_BASE `bdd0f698`. The earlier report was at `536d3856` (verified 2026-10-17T11:27:48Z, committed in `31d7c70d`). There were no gaps to close.

## Re-verification note (2026-10-18)

The earlier report was written before the security audit's T-19-06 fix. Since `536d3856`, these commits changed `apps/`:

- `08e2e72d` adds the RED tests. Eight cases feed an unterminated `<c`, `<row`, `<c a="`, `<sheetData`, `<dimension`, `<v`, `<sheet` or `<Relationship` run at 50,000 and 100,000 repetitions. A ninth case fills the 5 MiB upload bound.
- `d12f1fa2` is the T-19-06 fix in `apps/backend/src/csrm/spreadsheets/import-file.ts`. Five open-ended attribute-run regexes are gone: `SHEET_ELEMENT`, `VALUE_CONTENT`, the `<sheet>` and `<Relationship>` patterns in `firstSheetPart`, and the `<sheetData>` opener and `<dimension>` remover in `valuedSheet`. In their place is one forward tag scan, `nextXmlTag`/`findXmlTag` (`import-file.ts:358-409`). It finds each tag with `indexOf` and reads that tag's attributes to its `>` once, with quotes honoured. A named tag with no `>` or an unclosed quote is refused as `IMPORT_FILE_TYPE`, and so is a run longer than `XML_TAG_ATTRIBUTES_MAX` (8,192, `:331`). The new scan feeds `firstSheetPart` (`:428`), `hasValueContent` (`:472`), `withoutDimension` (`:482`) and `valuedSheet` (`:515`). The cell close is found by the same scan, and the main loop resumes past it, so no tag is read twice.
- `7160ce64` adds three T-19-45 tests to `administration.unit.test.ts` (tests only): 16 preview records per actor, 256 in all, and the 1 MiB refusal.
- `31d7c70d` and `16803cd4` changed only planning documents.

**What this re-run checked again.** Criteria 3, 4 and 5 read XLSX uploads through the changed reader, so they got full re-verification.

- I read the diff line by line against the old patterns. The behaviour on well-formed parts is unchanged. Each tag must now match its exact local name (`sheet`, not `sheets`; `c`, not `col`); the old `\b` gave the same result for every real OOXML name. The CDATA test, the self-closing test and the matched cell close (same prefix, no attributes) are as before.
- The focused suites below were re-run at `16803cd4`, including the XLSX cases of criteria 3 and 4 and the byte-for-byte round trip in CSV and XLSX.
- I ran an extra timing probe of my own on shapes the tests do not cover (see Behavioral Spot-Checks).

Criteria 1, 2 and 6 and the non-negotiables do not depend on the reader. For those, the code evidence below is carried forward from the earlier report and was checked against the diff: no other `apps/` file changed. The full-suite evidence is the recorded final gate at `31d7c70d`, which ran after the fix.

Findings no longer open:

- T-19-06 is closed. `19-SECURITY.md` is `status: verified`, `threats_open: 0`.
- The final gate after stage B is recorded in `19-15-SUMMARY.md`, and its captures are in `19-UI-REVIEW-DISPOSITION.md`.
- The criterion labels on `19-UAT.md` tests 1 and 3 are corrected (CSV-01 criterion 1; CSV-02 criterion 3), and the file is committed.

## User Flow Coverage

The roadmap goal is a user story (mode: mvp). The outcome clause is: "CSRM fits the Excel work around it".

| Step | Expected | Evidence in code | Status |
|---|---|---|---|
| Export any list the person can see | Each list, queue, alert list, report and released assessment offers Export in its header, and the file is the list whole, in scope, filtered, searched and sorted as on screen. | 14 export operations, one pipeline (`runListExport`, `run-export.ts:312-406`; `runFixedTableExport` for reports and the released assessment), each route with its list's policy plus `underlyingRead` (`csrm-authorization.ts:508-515`). The web header Export is on 12 list pages, the report page and both released views (`ListExportButton` / `ExportButton`; capability-gated, after a successful read). `exports.integration.test.ts` 47/47 here. | ✓ VERIFIED |
| Open the file in Excel safely | XLSX and CSV (UTF-8 with BOM); a formula-like value arrives as text. | One neutraliser (`neutralise.ts:16-47`) feeds both writers (`csv-writer.ts:30-48`, `xlsx-writer.ts:31-99`, text cells in `@` format, no formula element). | ✓ VERIFIED (Excel itself: human check 1) |
| Import a spreadsheet as people make them | Headers by label in any case; unknown columns warned and ignored; flags as Yes/No, Y/N, TRUE/FALSE; `#CLEAR`; Excel's legacy CSV gets a fix-it message; a crafted workbook cannot stall the import. | `matchHeaders` (`header-match.ts:45-91`), `decodeStrictUtf8` (`import-file.ts:236-246`), `value-convert.ts:49-92`; the XLSX reader's linear tag scan (`import-file.ts:358-409`, T-19-06); web S2 copy (`import-refusal-copy.ts:116-117`) and the warning alert (`csv-import-flow.tsx:597`). | ✓ VERIFIED (real Excel file: human check 3) |
| Fix what was refused and re-import | The error report is the original rows plus Issues, in the upload's format, and re-imports. | `buildImportErrorReport` (`administration-workflow.ts:894-970`) from Strapi's retained record only; the Issues column is noted on re-import (`header-match.ts:85`). | ✓ VERIFIED (in Excel: human check 2) |
| Never merge a near-duplicate silently | A case- or spacing-only match waits for Update or Skip. | `classifyRows` (`csv-import.ts:177-255`) gives `similar`; the commit refuses 409 `IMPORT_DECISION_MISSING` without a decision (`administration-workflow.ts:429-440`) and keeps the stored name on Update (`:548-552`). | ✓ VERIFIED |
| Print a released assessment | A clean A4 report from either actor's released view. | Two report routes on one loader; `@page csrm-report { size: A4 portrait; margin: 16mm }` (`globals.css:1443-1475`). | ✓ VERIFIED (paper: human check 4) |
| Excel, paper, assistive technology, 768, operator database and production | These hold for the operator. | Not provable from code. See Human Verification Required. | ? HUMAN NEEDED |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | The filtered Risk Register exports to XLSX with the visible columns, and a value starting with "=" arrives as text. | ✓ VERIFIED | **Route → policy:** `GET /v1/risks/export` is registered before `/v1/risks/:riskId` (`csrm-risk.ts` routes `:37-43`) with `requireAnalystRiskRegisterScope` and `underlyingRead: listRegister`. The policy refuses the service identity (`csrm-authorization.ts:498-501`), requires a human analyst grant (`:502-505`, the URL is in `HUMAN_ONLY_EXPORT_OPERATIONS` `:83-101`) and the register read through the same path (`:508-515`). The catalogue grants `function.risk_register.export_api` to `role.security_analyst` only (checked with a script; both copies `cmp`-identical). **Service:** `exportRiskRegister` (controller `:139-156`) runs `runListExport` over `riskRegisterExportView` (`export-views.ts:236-279`), which uses the register's own parser, repository `count`/`selectPage`/`hydrate` and `projectRiskRegisterItem`. The default columns are the vocabulary's eight `visible: true` keys (`run-export.ts:101`), which equal the eight table columns (`risk-register.tsx:133-140`). Text cells go through `sanitizeSpreadsheetCell` as `@`-format string cells (`xlsx-writer.ts:64-70`). **Web:** `RiskRegisterExport` (`app/(app)/app/risks/page.tsx:27-44`) renders only with `risk-register:export` and a read with data (`:61`), and calls `exportRiskRegisterAction` (`export-actions.ts:104`), then `exportRiskRegister` (`risk-service.ts:167-191`, `server-only`, `client.GET('/v1/risks/export')`, `arrayBuffer`). **Behaviour (re-run here at 16803cd4):** `exports.integration.test.js` 'risk-register: Bob's filtered Risk register exports as a workbook … a formula-like statement as text, with one log line' passes. It asserts the header row equals the eight visible labels, the cell is `'=HYPERLINK(…)` and the sheet XML has no `<f>`. Also passing: 'the CSV export starts with the BOM and quotes and marks…', '…default export holds no withdrawn Risk…' and 'EXPORT_ROW_LIMIT…'. E2E `register export @journey` passed in the final gate at `31d7c70d`. |
| 2 | A Requestor can export only their own released assessment. | ✓ VERIFIED | **Route → policy:** `GET /v1/risk_assessments/:assessmentId/export` (routes `:88-93`) needs the export grant, the detail read and the released risk and control-implementation reads (BE2-01). It is granted to `role.security_analyst` and `role.requestor` and is in `SERVICE_IDENTITY_REFUSED_OPERATIONS` (`csrm-authorization.ts:188-189`). **Record level:** `exportReleasedAssessment` (controller `:527-577`) builds the viewer from the policy's actor and calls `findReadableReleasedAssessment` (`released-assessment-read.ts:106-119`). That read applies `RELEASED_ASSESSMENT_FILTERS` and the Requestor's own-request filter in one query (`:48-54, 67-71`) and checks both again in memory (`:90-98`). A Requestor gets 404 for another person's or their own unreleased assessment (`:540-542`). An analyst gets 409 `ASSESSMENT_NOT_RELEASED` (`:551-553`). The My risk assessments export is owner-scoped. **Web:** `ReleasedAssessmentHeaderActions` (`released-assessment-actions.tsx:19-44`) renders after the reads and only with `released-assessment:export` (`app/(app)/app/assessments/[documentId]/page.tsx:44-52`); the analyst page shows it only when the server-computed `released` is true (`review/assessments/[documentId]/page.tsx:148-162`). **Behaviour (re-run here at 16803cd4):** these pass: 'released-assessment: Jane exports her released assessment…', '…another Requestor at Jane's released assessment and Jane at her own unreleased one get the missing record's 404, with no file and no export event', '…Bob's export of an unreleased assessment is 409…', and 'Bob's export of Jane's released assessment holds the same tables as Jane's'. 'my-risk-assessments: … each export their own released assessments only…' and the service-agent 403 are in the same 47/47 run. `released-assessment-read.unit.test.js` and `released-read-ownership-scan.unit.test.js` passed on 2026-10-17 and in the final gate. |
| 3 | A file with "Name" headers and an extra column imports with a warning, and a Windows-1252 file gets a fix-it message. | ✓ VERIFIED (re-verified after T-19-06) | **Code:** `headerKey` ignores case, spaces, underscores, hyphens and width, and matches field names and labels (`header-match.ts:40-63`). An unknown header becomes a warning named as typed (`:85-86`). `decodeStrictUtf8` refuses non-UTF-8 with `IMPORT_ENCODING_WINDOWS_1252`, or `IMPORT_ENCODING_UNKNOWN` when a byte is undefined in Windows-1252 (`import-file.ts:236-246`; the fix did not touch the CSV path). The XLSX path now reads the workbook, rels and sheet with the linear tag scan (`:358-409`); the valued-cell rewrite (BE3-01) keeps its result. The four previews read through `readImportFile` (`:645`) in `administration-workflow.ts`. **Web:** unchanged since `536d3856`. The preview's `warnings` render as 'Some columns will be ignored' (`csv-import-flow.tsx:597`). The refusal renders 'Save the file as CSV UTF-8' with its steps (`import-refusal-copy.ts:116-117`). The browser checks only extension and size (`csv-client-parser.ts:21-27`), and the import goes `administration-actions.ts` → `administration-service.ts:195-207` (`client.POST('/v1/{collection}/import/preview')`). **Behaviour (re-run here at 16803cd4):** these pass: `administration.integration.test.js` 'CSV-02 UAT-051 the Name file with an Owner column previews with Owner in a warning, and its .xlsx previews alike' (the XLSX case goes through the fixed reader), 'CSV-03 an unreadable file is refused with IMPORT_ENCODING_WINDOWS_1252, IMPORT_DELIMITER, IMPORT_CSV_MALFORMED or IMPORT_FILE_TYPE and writes nothing', and 'CSV-02 IS-1 flags, #CLEAR, the example row…'. `spreadsheet-reading` 64/64 includes 'the valued-cell rewrite returns what the library reads from the original sheet' and the nine T-19-06 cases; `spreadsheet-headers-values` passes 19/19. |
| 4 | The error report reopens in Excel, can be corrected and re-imports. | ✓ VERIFIED (re-verified after T-19-06; in Excel itself: human check 2) | **Code:** `POST /v1/{collection}/import/error_report` → `buildImportErrorReport` (`administration-workflow.ts:894-970`). It takes the actor's own retained preview or result record and refuses another file (SHA-256). It writes the header as typed, every row not (yet) imported with its cells neutralised, and an `Issues` column, in the upload's format (CSV with a BOM through `writeCsv`). An earlier Issues column is replaced. On re-import, `Issues` is noted, not warned (`header-match.ts:85`). The XLSX error report goes back in through the fixed reader. **Web:** 'Download error report' at Review and Results (`csv-import-flow.tsx:522`) → `administration-service.ts:227-230`. **Behaviour (re-run here at 16803cd4):** these pass: 'CSV-02 D-32 the error report at Review…', '…at Results holds only the rows not imported…', 'CSV-02 D-32 criterion 4: a corrected error report re-imports with its Issues column noted, through CSV and through XLSX', '…error report refusals…', and the exports file's 'reference-lists: the Information Systems export, imported back byte for byte in CSV and XLSX, previews every row unchanged'. E2E `error report round trip @journey` passed in the final gate at `31d7c70d`. |
| 5 | A lower-case duplicate of an existing name is held for a decision. | ✓ VERIFIED (re-verified after T-19-06) | **Code:** `classifyRows` (`csv-import.ts:177-255`) matches on the exact key (trimmed, NFC) and the similar key (NFKC, `en-AU` lower case, collapsed spaces; `administration-query.ts:247-249`). A similar-only hit is `similar` with `matchedName`, never `create` (`:239-252`), and two rows of one file stay `ambiguous`. The commit checks decisions against the retained preview and refuses 409 `IMPORT_DECISION_MISSING` while any similar row is undecided (`administration-workflow.ts:429-440`). Update keeps the stored name (`:548-552`); Skip writes nothing (`:535-538`). This matches the approved record (`phase-19-import-tolerance.md:91-112`). The classifier sits downstream of the reader and is unchanged. The T-19-45 bound on the retained previews it relies on is now tested (`7160ce64`). **Web:** the `Matched by similar name` badge (`import-row-status.tsx:29`), `DecisionGroup` with nothing chosen (`csv-import-flow.tsx:209-230`), and the gate that keeps Continue enabled and moves focus to the first undecided row (`:459-466`). **Behaviour (re-run here at 16803cd4):** these pass: 'CSV-03 Matched by similar name: a lower-case or re-spaced copy of a stored name is similar, an exact name is not, and two rows of one file stay ambiguous', 'CSV-03 IMPORT_DECISION_MISSING: a similar row waits for its decision; update keeps the stored name, skip leaves the record deep-equal, drift rejects it', 'CSV-03 IMPORT_REVIEW_EXPIRED…', 'CSV-03 import.committed…', and the three T-19-45 unit tests. The web tests `administration-workflow.test.tsx` and `import-row-status.test.tsx` pass. E2E `similar name held @journey` passed in the final gate at `31d7c70d`. |
| 6 | A released assessment prints as a clean A4 report. | ✓ VERIFIED (paper: human check 4) | **Code:** `/app/assessments/{id}/report` and `/app/review/assessments/{id}/report` render `AssessmentReportScreen` from the shared loader (`released-assessment-report.ts`). The Requestor's route is gated by Strapi's one record-read check, and the analyst's by `canViewerReviewAssessments` and the server's `released` flag. Otherwise each is the in-shell not-found. The model keeps active Risks only. Print rules: the named page `csrm-report` is `A4 portrait`, 16mm margin, `Page n of m` (`globals.css:1443-1455`). The detail starts on a new page and a Risk avoids breaking inside (`:1457-1475`). The document title is the print-only `h1` (UI-05). `Print report` is in both released headers (`released-assessment-actions.tsx:20-25`). **Behaviour (re-run here):** `assessment-report.test.tsx` passes in the 407-test web run. It covers the X-31 order, the long statement unclamped, print rules in tokens, the not-found before release, and UI-05's one h1 in each medium. E2E `print report @journey` passed in the final gate at `31d7c70d` (print emulation; the A4 PDF on desktop has 2 pages). |

**Score:** 6/6 truths verified (0 present, behavior-unverified).

### Plan backstop truths (verification: backstop)

Three plan truths are marked non-inferable. No test seeds their inputs, so presence and wiring do not count, and each is routed to a human check. The fix changed none of them.

| Plan | Truth | Status |
|---|---|---|
| 19-06 | At 375px a dialog with five active filters and a long search wraps without horizontal scroll and keeps Export file visible | ⚠️ insufficient_spec → human check 6 |
| 19-12 | A 25-risk released assessment prints its overview on A4 with repeated headers, no clipped column, detail on a new page | ⚠️ insufficient_spec → human check 4 |
| 19-15 | A 200-character existing name wraps its Update label at 375 and 1440 with the radio aligned | ⚠️ insufficient_spec → human check 6 |

### Project non-negotiables touched by the phase

Carried forward from 2026-10-17. Since `536d3856`, the only `apps/` source change is `import-file.ts`, which touches no route, grant, policy, web call or dependency.

| Rule | Status | Evidence |
|---|---|---|
| Authorisation in Strapi (Role → Function → FunctionAPI, record-level); navigation visibility is not security | ✓ | All 22 new operations are in the catalogue. The script output: the analyst exports on `role.security_analyst`; `my_*` exports on `role.requestor`; the released export on both; templates, error reports and reference exports on the four Administration Functions. None is granted to the agent. Every export route carries `global::csrm-authorization` with `underlyingRead`. `SERVICE_IDENTITY_REFUSED_OPERATIONS` (14 exports) refuses automation whatever it holds. `authorization-matrix.integration.test.js` 173/173 (2026-10-17, and inside the final gate's 2,306). Web Export controls are capability-gated after a successful read; the 403s come from Strapi (the exports file's 403 cases re-run here). |
| Requestor isolation | ✓ | The one released-read module (`released-assessment-read.ts`) is the only place that compares a requestor with the viewer (`released-read-ownership-scan.unit.test.js` passes). My-list exports are owner-scoped for every actor. Another Requestor gets 404 with no export event (re-run here). |
| AI output is advisory | ✓ | No AI path is added. The released export and the printed report carry the approved AI notice (FE4-01, FE4-16). Every suite pins the deterministic provider. |
| JDL terminology, frozen datamodel | ✓ | `git diff --name-only bdd0f698..HEAD` over content types and components is empty. The two G-6 records carry the pilot's approvals, 2026-10-16, with amendments of 2026-10-17 (`phase-19-import-tolerance.md:205, 246`; `phase-19-exports-and-export-log.md:279, 345`). |
| Typed API layer, no raw fetch | ✓ | Every export and import goes from a `'use server'` action through a `server-only` typed service to `client.GET/POST` with `parseAs: 'arrayBuffer'`. No `fetch(` in any Phase 19 web file. There is no Route Handler. |
| Dependencies justified | ✓ | The package diff is exactly `write-excel-file` 4.1.1 added to `apps/backend` and `csv-parse` removed from `apps/csrm`. The T-19-06 fix adds no dependency. |
| Keycloak paths | ✓ (reviewed exception) | `git diff --name-only bdd0f698..HEAD -- apps/ \| grep -i keycloak` lists only `apps/backend/tests/keycloak-identity.unit.test.ts`, touched once by `946cb1ef` (+23 lines). The pilot ruled it the one reviewed exception (`19-PILOT-RULINGS.md`). No commit since `536d3856` touches a Keycloak path. |

## Required Artifacts

`verify.artifacts` was run on all 15 plans on 2026-10-17: 46/47 pass. The one miss is a placement deviation; the string exists in another file. No plan artifact was removed or renamed since.

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/backend/src/csrm/spreadsheets/*` (neutraliser, writers, reader, header matcher, value converters) | One neutraliser and its inverse; typed writers; bounded tolerant reader | ✓ VERIFIED | Imported by the export pipeline, the error report, the templates and `csv-import.ts`. The reader's bound now covers malformed tags too (T-19-06: linear tag scan, `XML_TAG_ATTRIBUTES_MAX`). `spreadsheet-reading` 64/64 and `spreadsheet-headers-values` 19/19 here. |
| `apps/backend/src/csrm/exports/*` (pipeline, views, vocabulary, send, released, report tables) | One pipeline for 14 exports | ✓ VERIFIED | Called from the risk, request, my-requests, questionnaire, insight, assessment and administration controllers. The vocabulary JSON is byte-identical to the web copy (`export-vocabulary.test.ts`, re-run here). |
| `apps/backend/src/api/csrm-assessment/services/released-assessment-read.ts` | One released-read check | ✓ VERIFIED | Used by the released reads, My risk assessments, the export and the analyst's `released` flag. |
| `apps/backend/src/policies/csrm-authorization.ts` | Refused set, human-only exports, `underlyingRead` | ✓ VERIFIED | See truth 1. The matrix mirrors both sets (BE2-03). |
| `apps/csrm/src/components/csrm/export/*`, `features/exports/*` | ExportButton, dialog, column choice, actions | ✓ VERIFIED | Wired into 12 list pages, the report page and both released views. |
| `apps/csrm/src/features/assessments/assessment-report.tsx`, both `report/page.tsx` | X-31 document and routes | ✓ VERIFIED | Linked from `ReleasedAssessmentHeaderActions`. |
| `apps/csrm/src/features/administration/csv-import-flow.tsx` (19-15, pattern `Matched by similar name`) | The similar-row state in the flow | ⚠️ DEVIATION (info) | The label is in the import-only map `import-row-status.tsx:29`, where 19-13 placed it so the shared badge map does not grow. `csv-import-flow.tsx:26` imports `ImportRowBadge` and `importRowLabel`, and the e2e `similar name held` finds `Matched by similar name (1)`. |
| `apps/csrm/e2e/exports-and-imports.spec.ts` | Journeys at 375 and 1440 | ✓ VERIFIED | 11 `@journey` tests (register, lists, released, refusals, print, import tolerance, error report, similar), listed in `playwright.config.ts:217`. All passed at both widths in the final gate at `31d7c70d`. |

## Key Link Verification

`verify.key-links` was run on all 15 plans on 2026-10-17: 37/37 verified. The T-19-06 fix keeps the reader's export (`readImportFile`, `import-file.ts:645`) and its callers unchanged.

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Web pages (header Export) | Strapi export routes | `ExportButton` → `'use server'` action (`export-actions.ts`) → `server-only` typed service → `client.GET/POST(…/export)` | ✓ WIRED | Paths match the routes and `specification.json`. `contract-operation-chain.test.ts` and `contract-response-parity.test.ts` pass (2026-10-17 and the final gate). |
| Export routes | Policy | `global::csrm-authorization` with `operation`, `underlyingRead`, `additionalUnderlyingReads` | ✓ WIRED | The refused set is checked before the human-only and underlying-read checks. |
| Released export | Record-level check | `findReadableReleasedAssessment` | ✓ WIRED | 404 for a Requestor, 409 for an analyst before release. |
| List exports | List repositories and projections | `ListExportView` (`count`, `selectIds`, `hydrate`, `project`) | ✓ WIRED | No export module reads `csrm_risks` itself (`active-risk-readers.unit.test.js` passes). |
| Import preview/commit | Reader, matcher, converters, classifier | `readImportFile` → `matchHeaders` → `classifyRows` | ✓ WIRED | Shared by the four collections; the reader's XLSX branch now runs `firstSheetPart` and `valuedSheet` over the linear tag scan. |
| Commit | Similar decisions | `decisions` checked against the retained preview | ✓ WIRED | 409 without a decision. |
| Every export | Security event log | `logSecurityEvent(export.completed / export.refused)` | ✓ WIRED | Actor, view, format, columns, filters, search, sort, zone and row count, never a cell value (`security-event-log.unit.test.js` passes). |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Register export file | `rows` | `repository.count/selectPage/hydrate` over the register's ruled query, `projectRiskRegisterItem` | Yes | ✓ FLOWING |
| Released export file | `released.tables` | `findReadableReleasedAssessment` and the released risk and control reads, paged `id:asc` (BE1-07) | Yes | ✓ FLOWING |
| Export dialog scope line | `total`, `chips` | The list read's own `pagination.total` and selected labels (`risks/page.tsx:27-44`) | Yes | ✓ FLOWING |
| Import review rows and warnings | `preview.rows`, `preview.warnings` | Strapi preview over the uploaded bytes (through the fixed reader) and the stored records | Yes | ✓ FLOWING |
| Error report | `reported` rows | Strapi's retained preview or result record, matched to the file by digest | Yes | ✓ FLOWING |
| Print report | `AssessmentReportModel` | The shared released loader over Strapi's released reads | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

This verifier ran them at HEAD `16803cd4` with node v24.19.0, on focused files only. Both backend builds were recompiled first: `tsc` and `tsc -p tests/tsconfig.json`, exit 0 each. I did not run the full Strapi suite or Playwright, started no server, and read no `.env` file.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Reader, including the nine T-19-06 cases and the valued-cell rewrite equivalence | `node --test .tmp/tests-dist/tests/spreadsheet-reading.unit.test.js` | 64/64 pass. The eight timing cases settle as `IMPORT_FILE_TYPE` in 0 to 8 ms at 50,000 and 100,000 repetitions; the 5 MiB guard is refused in 44 ms | ✓ PASS |
| Header matching and value conversion (criterion 3) | `node --test …/spreadsheet-headers-values.unit.test.js` | 19/19 pass | ✓ PASS |
| Administration service, including the three T-19-45 cap tests | `node --test …/administration.unit.test.js` | 30/30 pass | ✓ PASS |
| Criteria 3, 4 and 5 (UAT-051, UAT-052), templates, error reports, decisions | `node --test --test-concurrency=1 …/administration.integration.test.js` | 37/37 pass | ✓ PASS |
| Criteria 1 and 2, every export's scope and refusals, the cap, the byte-for-byte reference round trip in CSV and XLSX | `node --test --test-concurrency=1 …/exports.integration.test.js` | 47/47 pass | ✓ PASS |
| Web import and exports (`src/features/administration`, `src/features/exports`, `src/components/csrm/export`) and `assessment-report.test.tsx` | `pnpm --dir apps/csrm exec vitest run …` (14 files) | 407/407 pass | ✓ PASS |
| T-19-06 shapes the tests do not cover: terminated `<dimension>x<y>` pairs, a run of open `<c>` cells closed once at the end, and a legitimate valued-cell sheet as control | Ad hoc `readImportFile` timing script in the session scratchpad (stored workbooks from `buildRawSheetWorkbook`; nothing written to the repository) | 50,000 / 100,000 repetitions: 44 / 23 ms (refused `IMPORT_FILE_TYPE`), 4 / 6 ms (read, 1 row), 13 / 14 ms (read 2,501 / 4,001 rows). Linear, no rescan | ✓ PASS |
| Final full regression gate, after the T-19-06 fix | `19-15-SUMMARY.md`, "Phase gate (final run, after the code review)", all at `31d7c70d` | web 6,440/6,440 (245 files); Strapi 2,307 tests, 2,306 passed, 0 failed, 1 skipped (the POSIX file-mode check on Windows); Playwright 268/268 (desktop 190, mobile 78), 0 flaky; `api:check`, typecheck and lint clean; performance budgets within 300,000 | ℹ INFO (recorded; not re-run here). `git diff --name-only 31d7c70d..HEAD -- apps/` is empty, so the gate's code is today's code |

## Probe Execution

No phase-declared or conventional `scripts/*/tests/probe-*.sh` probes apply to this application feature phase.

## Requirements Coverage

The plans claim only CSV-01, CSV-02 and CSV-03. REQUIREMENTS.md maps no other ID to Phase 19.

| Requirement | Source plans | Description | Status | Evidence |
|---|---|---|---|---|
| CSV-01 | 19-01 to 19-12, 19-14, 19-15 | Registers, lists, queues, alerts and reports export to CSV and XLSX. | ✓ SATISFIED (Excel itself, paper: human checks 1, 4) | (1) The list's own parser, scope, order and visible columns, a column choice (1 to 40 keys in canonical order), and `{slug}-{local date}.{csv\|xlsx}` names. (2) Strapi scopes each export, and a Requestor exports only their own released assessments (truth 2). (3) The neutraliser covers `=`, `+`, `-`, `@`, tab, CR, LF, their full-width forms, a leading-whitespace prefix and a hidden-control prefix; CSV is UTF-8 with a BOM. (4) One `export.completed` or `export.refused` line per attempt, with actor, view, filters and row count; the A4 report (truth 6). Closes UAT-049. |
| CSV-02 | 19-01 to 19-04, 19-13 to 19-15 | Imports tolerate spreadsheet habits and return files a user can fix and re-import. | ✓ SATISFIED (real Excel: human checks 2, 3) | (1) Headers by field or label, case-insensitive; unknown columns warned by name (truth 3). (2) The Windows-1252 fix-it refusal; `TRUE_WORDS`/false words for flags (`value-convert.ts:49-63`); `#CLEAR` (`:91-92`). (3) Templates with display headers and the reserved example row, and the XLSX Notes sheet (`administration-workflow.ts:738-804`); error reports with the original rows plus Issues and a BOM (truth 4). The XLSX reader is now linear on malformed tags (T-19-06), with no change for real files. Closes UAT-051. |
| CSV-03 | 19-01, 19-02, 19-13, 19-15 | A near-match name in an import needs an explicit decision. | ✓ SATISFIED | Case- or whitespace-only matches show as 'Matched by similar name' and are neither created nor updated until the user chooses (truth 5). A leading or trailing space difference is the exact tier (trimmed), as the approved record defines. Closes UAT-052. |

REQUIREMENTS.md still shows all three as `[ ]` / Pending. Updating them is the orchestrator's phase-close step, not a code gap.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| Phase 19 `apps/**` source files (`git diff --name-only bdd0f698..HEAD`), and the four files changed since `536d3856` | — | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, "not yet implemented", "coming soon" | — | None found (re-scanned `import-file.ts`, `spreadsheet-reading.unit.test.ts`, `administration.unit.test.ts` and `helpers/spreadsheet-fixtures.ts`). |
| `apps/backend/src/csrm/exports/export-views.ts` | questionnaire view `count` | BE1-09: a `status`-filtered questionnaire export loads the scope before the cap | ℹ Info (deferred to Phase 22) | The cap still bounds the file. |
| Catalogue `function.reports.reports` | — | BE2-07: an empty menu Function still granted to the agent | ℹ Info (deferred to Phase 22) | Not a hole. |
| `/app/risks/{documentId}`, `/app/requests/{documentId}` | route budgets | Tight headroom at the review gate (1,424 and 2,159 bytes) | ℹ Info | Within budget at the final gate. The pilot's quick task reclaims at least 5 KB before Phase 19.1 (`deferred-items.md`). |
| `apps/backend/src/csrm/spreadsheets/import-file.ts` | 331, 358-409 | `XML_TAG_ATTRIBUTES_MAX` refuses a named tag whose attribute run passes 8,192 characters | ℹ Info | No real `<sheet>`, `<Relationship>`, `<sheetData>`, `<dimension>`, `<row>`, `<c>`, `<v>` or `<t>` tag comes near it. Every criteria test and the byte-for-byte round trip read as before. |
| `apps/backend/src/csrm/spreadsheets/import-file.ts` (T-19-06) | — | ~~Open-ended attribute runs rescanned the sheet for every later tag (quadratic; 22.7 s for 321 KB)~~ | ✓ Resolved | Closed by `08e2e72d` and `d12f1fa2`; re-run here (see spot-checks). `19-SECURITY.md`: `status: verified`, `threats_open: 0`. |
| `19-15-SUMMARY.md`; `19-UI-REVIEW-DISPOSITION.md` "Captures (final gate)" | — | ~~Final gate after stage B not recorded~~ | ✓ Resolved | Recorded at `31d7c70d` and committed in `16803cd4`. |
| `19-UAT.md` | tests 1 and 3 | ~~Criterion labels mismatched~~ | ✓ Resolved | Now 'CSV-01, criterion 1' and 'CSV-02, criterion 3'; committed in `16803cd4`. |

## Human Verification Required

These are the eight deferred operator checks in `19-UAT.md` (`status: testing`, every result `pending`).

1. **An export opened in Excel with the neutraliser mark (CSV-01 (3), criterion 1).** Open the exported CSV and XLSX holding `=HYPERLINK("https://example.test","Click")`. Confirm nothing evaluates. Save the CSV as CSV, reopen it, and repeat with OWASP's tab variant. Then re-import both and confirm the stored values are unchanged. *Backstop:* `spreadsheet-neutralise`, `spreadsheet-writers`, and `exports.integration` 'risk-register … formula-like statement as text' and 'reference-lists … imported back byte for byte'.
2. **An error report corrected in Excel and imported again (criterion 4).** Do this with both the CSV (UTF-8 BOM) and the XLSX. *Backstop:* `administration.integration` 'criterion 4: a corrected error report re-imports … through CSV and through XLSX' (re-run here through the fixed reader), and the e2e `error report round trip`.
3. **A Windows-1252 file made in real Excel (criterion 3).** Expect the fix-it refusal with the file kept; then the CSV UTF-8 or .xlsx resave imports `Café` intact. *Backstop:* `spreadsheet-reading` 'IMPORT_ENCODING_WINDOWS_1252: RT-3 (0xE9)', `administration.integration` 'CSV-03 an unreadable file is refused …', and the e2e `import tolerance`.
4. **The 25-risk A4 print on paper (criterion 6, 19-12 backstop).** Check the repeated overview header, no clipped column, Risks in detail on a new page, and `Page n of m`. *Backstop:* `assessment-report.test.tsx`, the `csrm-report` print rules, and the e2e `print report` (print emulation and the A4 PDF).
5. **NVDA and keyboard-only on Windows (UI-01 to UI-04, UI-11, UI-12).** Check the export dialog, column choice, released actions, import steps, the similar-row gate and the downloads. *Backstop:* the stage B unit tests (`6e748eeb`, `536d3856`) and axe at 375 and 1440.
6. **Visual review at 768, reflow from 320 to 1440 (UI-06; 19-06 and 19-15 backstops).** Include a five-filter dialog with a long search at 375, and a 200-character existing name in an Update label at 375 and 1440. *Backstop:* `expectNoOverflow` and axe in the `@journey` tests at 375 and 1440, and the final gate's captures.
7. **The operator's database after the next Strapi start.** Check the new grants and the BE2-08 catalogue re-seed (one FunctionAPI row per catalogued URL). Bob exports and imports; Jane exports only her own records. *Backstop:* `catalogue-reseed.integration` 3/3, the matrix 173/173 and `exports.integration` 47/47.
8. **Production schema and contract acceptance.** Check the additive operations and binary responses, the API-only Functions with no agent grant, and the export log lines in the production pipeline. *Backstop:* the empty content-type diff, the byte-identical catalogue copies, and the G-6 approvals.

## Gaps Summary

No success criterion, requirement or plan must-have fails at HEAD `16803cd4`. The T-19-06 fix changed only the XLSX reader's tag scanning in `import-file.ts`. Every criterion was re-checked against it:

- Criteria 3 to 5 cross the changed reader. Their integration tests re-pass through both CSV and XLSX: the Name file with an Owner column and its `.xlsx`, the encoding refusals, the corrected error report re-imported in both formats, the byte-for-byte reference round trip, and the similar-name hold with its decisions.
- The reader's own suite re-passes, including the equivalence test showing the valued-cell rewrite returns what the library reads from the original sheet.
- I read the new scan against the patterns it replaced and found no behaviour change for well-formed parts.
- My own timing probe on three shapes outside the test set stays linear.
- Criteria 1, 2 and 6 do not touch the reader, and no other `apps/` file changed. Their evidence carries forward, and their export and report tests re-pass.

Focused runs here: Strapi 113 unit (64 reading, 19 headers and values, 30 administration) and 84 integration (37 administration, 47 exports), all green. Web: 407 tests in 14 files, all green. The full-suite evidence is the recorded final gate at `31d7c70d`, which ran after the fix with no `apps/` change since: web 6,440; Strapi 2,306 passed, 1 skipped; Playwright 268/268.

The one artifact pattern miss is a placement deviation: 19-13 put the similar-row label in the import-only badge map by design. Two review findings are deferred to Phase 22 with named routes and do not touch the criteria. The earlier report's open process and security items are closed: T-19-06 (`threats_open: 0`), the final gate record, and the UAT labels.

The status is `human_needed` because three things cannot be proved from source or deterministic tests: Excel's own handling of the files, paper and assistive-technology output, and the operator's database and production acceptance. These are the eight operator checks in `19-UAT.md`. The three plan backstop truths (five-filter dialog, 25-risk print, 200-character name) are among them. The pilot rules on the final status.

---

_Verified: 2026-10-17T13:51:00Z (re-verification; initial 2026-10-17T11:27:48Z)_
_Verifier: Claude (gsd-verifier)_

**Pilot status ruling (2026-10-18):** `passed`. The re-verification at `16803cd4` (`93799b8f`) found 0 gaps: 6/6 criteria met, CSV-01 to CSV-03 satisfied, and the T-19-06 fix verified on the code with linear timing. All 57 of 57 threats are closed, the phase is Nyquist-compliant, and all 43 review findings are dispositioned with none open. The final gate at `31d7c70d` is green and ran on today's `apps/` code: web 6,440/6,440; Strapi 2,306 passed with 1 skipped; Playwright 268/268, 0 flaky. As in Phases 10 to 16, the eight checks in `19-UAT.md` need real Excel, paper, NVDA, a 768 visual review, the operator's database or a deployment. They stay open as deferred operator follow-ups and do not block completion.
