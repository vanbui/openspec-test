---
phase: 19-csv-export-and-import-hardening
plan: 04
subsystem: exports
tags: [csv-export, xlsx, export-pipeline, export-vocabulary, security-event-log, row-cap, time-zone, shared-backend]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-03: writeWorkbook, writeCsv, safeSheetName, sanitizeSpreadsheetCell (inside the writers); 19-02: EXPORT_ROW_LIMIT and ASSESSMENT_NOT_RELEASED in CONFLICT_REASONS"
  - phase: 14-request-attachments
    provides: "security-event-log.ts (14-03), sendStoredFile and contentDispositionFor (14-07), readWorkbookSheets for the tests"
  - phase: 16-risk-curation
    provides: "the register's ruled base query (applyActiveRisk, applyWithdrawnRisk for state=withdrawn), isActiveRisk, the active-risk-readers guard"
  - phase: 11-navigation-landing-and-list-clarity
    provides: "the register's stage, accepted marker and due state in projectRiskRegisterItem; the list headers and chip labels the vocabulary mirrors"
provides:
  - "csrm/exports/run-export.ts: EXPORT_ROW_CAP (10,000, defined once), EXPORT_HYDRATE_BATCH (500), EXPORT_FORMATS, EXPORT_COLUMNS_MAX (40), EXPORT_FORMULA_NOTE, ExportQueryError and ExportRefusalError (re-exported), parseExportControls, runListExport, runFixedTableExport, buildAboutSheet; types ExportFile, ExportControls, ExportTable, ExportActor, ExportAboutExtras, ExportFormat, ExportTimeZone, AboutSheetInput"
  - "csrm/exports/export-views.ts: ListExportView<P, R>, ExportCellValue, ExportQueryDescription, ExportAuditQuery, RiskRegisterExportRow, riskRegisterExportView(repository), registeredExportViews()"
  - "csrm/exports/export-vocabulary.json (schemaVersion 1: labels, views, tables, reports, imports) and export-vocabulary.ts: EXPORT_VOCABULARY, parseExportVocabulary, exportViewMeta, exportViewColumns, exportTableColumns, exportReport, exportLabel, importColumns, EXPORT_CELL_TYPES, IMPORT_COLUMN_KINDS; types ExportCellType, ExportColumn, ExportViewMeta, ExportTableColumn, ExportTableSpec, ExportReportSpec, ExportReportTableSpec, ImportColumnSpec, ImportSpec, ExportVocabulary"
  - "csrm/exports/export-time.ts: parseExportTimeZone, localCalendarDate, formatExportedAt, EXPORT_TIME_ZONE_MAX, EXPORT_UTC_FALLBACK_NOTE, ExportTimeZone"
  - "csrm/exports/send-export.ts: EXPORT_MEDIA_TYPES (the one definition of both strings), exportFileName, sendExportFile, resolveExportActor, sendExportError, ExportFileFormat, ExportErrorContext"
  - "csrm/exports/export-errors.ts: ExportQueryError (400), ExportRefusalError (reason, status, rowCount?, rowCap?), ExportForbiddenError (403), ExportRefusalReason"
  - "security-event-log.ts: ExportSecurityEvent, ImportSecurityEvent, ExportSecurityEventReason, EXPORT_SECURITY_EVENT_NAMES, IMPORT_SECURITY_EVENT_NAMES; export.completed, export.refused and import.committed at info; EXPORT_ROW_LIMIT in SECURITY_EVENT_WARN_REASONS; INVALID_QUERY in SECURITY_EVENT_LOG_REASONS"
  - "risk-register-query.ts: parseRiskRegisterExportQuery, RiskRegisterExportQuery (the list parser unchanged)"
  - "risk-register.ts: RiskRegisterRepository.hydrate(documentIds, options?: { relations }), RISK_REGISTER_HYDRATE_RELATIONS, RiskRegisterHydrateRelation (the list's call unchanged)"
  - "web features/exports/export-vocabulary.json (byte-identical copy) and export-vocabulary.ts: exportVocabulary, exportViewMeta, exportViewColumns, exportReport, importColumns, exportLabel (no zod, client-safe)"
affects: [19-05, 19-06, 19-07, 19-08, 19-09, 19-10, 19-11, 19-12, 19-13, 19-14, phase-17.1, phase-18, phase-20, phase-21, phase-22]

actuals:
  tokens: 49000
  tasks: 3
  commits: 6

plan_head_before: 598420d60982b578a0cd3075f43a081832170773
plan_head_after: f3d5c9a6fb51cd10113db7e6eac5018d41231a41

tech-stack:
  added: []
  patterns:
    - "One export pipeline: a view is a thin adapter over its list's own scope check, export parser, repository and projection; run-export.ts never reads a record itself"
    - "Count first, refuse above the cap, read ids with cap + 1 and refuse again if more arrive: no partial file ever leaves"
    - "One vocabulary file in Strapi, copied byte for byte to the web, with label parity proven against the web's one status mapping"
    - "Every export attempt that passes the scope writes exactly one export.completed or export.refused line with the parsed, closed query only"

key-files:
  created:
    - apps/backend/src/csrm/exports/export-vocabulary.json
    - apps/backend/src/csrm/exports/export-vocabulary.ts
    - apps/backend/src/csrm/exports/export-errors.ts
    - apps/backend/src/csrm/exports/export-time.ts
    - apps/backend/src/csrm/exports/run-export.ts
    - apps/backend/src/csrm/exports/export-views.ts
    - apps/backend/src/csrm/exports/send-export.ts
    - apps/backend/tests/export-pipeline.unit.test.ts
    - apps/backend/tests/export-vocabulary.unit.test.ts
    - apps/csrm/src/features/exports/export-vocabulary.json
    - apps/csrm/src/features/exports/export-vocabulary.ts
    - apps/csrm/src/features/exports/export-vocabulary.test.ts
  modified:
    - apps/backend/src/csrm/audit/security-event-log.ts
    - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
    - apps/backend/src/api/csrm-risk/services/risk-register.ts
    - apps/backend/tests/security-event-log.unit.test.ts
    - apps/backend/.gitignore

key-decisions:
  - "ListExportView gains assertScope(state) and auditQuery(parsed) beside the planned members: the scope is checked before the controls are parsed (a 403 is a policy denial, never an export event), and the log takes the parsed filters, search and sort from the view rather than from the raw query"
  - "The two refusal classes live in export-errors.ts (re-exported by run-export.ts) so export-time.ts and send-export.ts can name them without an import cycle; ExportForbiddenError (403) is added for resolveExportActor"
  - "parseExportTimeZone canonicalises an accepted zone through resolvedOptions(); an empty string or a non-string is refused like an unknown zone; the log writes the zone or UTC-fallback, as the approved record's field list says"
  - "A list export with no format is refused (format is required); without columns it writes the view's visible columns"
  - "runFixedTableExport takes each table's own slug for the CSV file name and a summary flag; a summary table is written in the workbook, never counted and never chosen as a CSV; a fixed export logs columns [] (UI-D5: it takes none) and table as the CSV's chosen key or null"
  - "A report table's columns are its section's row header followed by its columns (the CSV needs the row labels); the parity test asserts [rowHeader, ...columns]"
  - "The About sheet's Rows detail is a number cell; Filters are one chip per line in the cell"
  - "The register describe() mirrors the list's chip labels for values no label family holds (Not rated, Not provided, No mitigation controls, Any mitigation control, None) in export-views.ts"

patterns-established:
  - "fakeRepository and fakeAssessmentView in export-pipeline.unit.test.ts prove a view without HTTP or a database"
  - "gen-vocab: the vocabulary is formatted with one column per line; edit the Strapi copy, then copy it over the web one (cmp in every verify)"

# Contributes to CSV-01 and CSV-02; neither is complete until the phase's served exports and import adopt these modules (19-15).
requirements-completed: []

duration: 73min
completed: 2026-10-16
---

# Phase 19 Plan 04: The export pipeline and its vocabulary Summary

**One Strapi export pipeline (count, cap, cap + 1 race check, batched hydration, the list's own projection, typed display cells, the About sheet, one log line) with the Risk register as its first view, one byte-identical column, table, import and label vocabulary proven against the web, viewer-zone dates, and the hardened file response, all proven with fakes and no HTTP.**

## Performance

- **Duration:** 73 min (2026-10-16T14:11Z to 15:24Z, the full Strapi suite 42.7 min of it)
- **Tasks:** 3 of 3 (each RED then GREEN)
- **Files:** 12 created, 5 modified

## Accomplishments

- `runListExport` runs a list export end to end: the view's scope, its export parser (no page), `count(filters, today)` refused above `EXPORT_ROW_CAP` with `EXPORT_ROW_LIMIT`, `selectPage({ offset: 0, limit: 10_001, today })` refused again when more than the cap arrive, hydration in batches of 500 in the list's order, `projectRiskRegisterItem(document, today)` with one UTC today throughout, and the chosen columns as typed display values. The due state is copied from the projection (a test replaces it and the file follows).
- The Risk register view reads Risks only through its repository, so the default export holds no withdrawn Risk and `state=withdrawn` exports the withdrawn ones alone with State `Withdrawn` and `Risk state: Withdrawn` on the About sheet; `active-risk-readers.unit.test.ts` is unchanged and green, its `risk-register.ts` exemption still one site.
- The register's `hydrate` takes optional `relations` (Risk owner, Risk Type, impacted system and asset, display fields only) for the chosen columns; the list's call is unchanged.
- The vocabulary holds the 12 list views, the released assessment's Summary, Risks and Mitigation controls tables, the four reports' tables, the four import collections (field for field with `ADMINISTRATION_CSV_CONTRACTS`) and ten label families; its web copy is byte-identical and its labels equal `statusPresentation`, `riskRegisterStateLabels`, `riskRegisterStageLabels`, `riskTreatmentDueStateLabels`, `requestHolderPresentation`, `alertKindLabels` and `alertUrgencyLabels`.
- The XLSX holds the data sheet then `About this export` (View, Search, Filters, Sorted by, Columns, Rows, As at, Period, Exported, Exported by, Values that look like formulas, AI assistance, each omitted when it does not apply); the CSV holds a BOM, CRLF, one header row and the data. Instants are local calendar dates in the validated zone; the UTC fallback sentence covers the unknown-zone partial state.
- Every attempt writes one `export.completed` or `export.refused` line; `INVALID_QUERY` logs at info, `EXPORT_ROW_LIMIT` at warn; `import.committed` is ready for 19-13; attachment lines are byte-identical (pinned by literal strings).
- `sendExportFile` sets exactly `text/csv; charset=utf-8` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` through `sendStoredFile`, plus `X-CSRM-Row-Count`; `sendExportError` gives a reasonless 400 and the closed 422 envelope with `rowCount` and `rowCap`.

## On-screen headers that differ from the planned labels

- **My requests:** the executed list (`request-table.tsx`) shows a `Security Analyst` column (Phase 13's assignee) after Status, which the plan's column list omits. The vocabulary adds `assignee` `Security Analyst` (person) there, visible, so the default export equals the screen; 19-07's "extractors for every `my-requests` column" covers it.
- Every other planned label equals its executed header (verified by the web test's `header: '<label>'` check for the eight list components and the administration list's headers for the four reference views).
- The administration list's `Sensitive-data flags` is one composite column on screen; the export writes its three flags (`Contains personal data`, `Contains legal data`, `Contains credit card data`) one value per cell (D-06), as planned.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 1 RED | tsc (emitting) + node --test security-event-log, export-pipeline | event-log: 4 of 18 failed on assertions; export-pipeline: modules missing |
| 1 GREEN | the plan's verify (tsc --noEmit, tests tsc, export-pipeline, security-event-log, risk-register, active-risk-readers, the Risk UID grep) | 57/57 pass, 0 fail, grep empty, VERIFY_OK |
| 2 RED | node --test export-vocabulary; vitest export-vocabulary | Strapi 6 of 10 failed on assertions; web: module missing |
| 2 GREEN | the plan's verify (cmp, vitest, web typecheck, tests tsc, export-vocabulary) | cmp equal; Vitest 6/6; typecheck clean; Strapi 10/10; VERIFY_OK |
| 3 RED | tests tsc + node --test export-pipeline | modules missing (export-time, send-export, runFixedTableExport) |
| 3 GREEN | export files: export-pipeline, export-vocabulary, security-event-log, risk-register, active-risk-readers | 84/84 pass |
| 3 GREEN | the plan's verify: tsc --noEmit and `pnpm --dir apps/backend test` (dev servers stopped, ports 1337 and 3000 free) | EXIT 0: 2,134 tests, 2,133 pass, 0 fail, 1 skipped (the pre-existing POSIX-modes test on Windows), 2,564.9 s |

Acceptance checks: `EXPORT_ROW_CAP = ` appears only in `run-export.ts`; `run-export.ts` names neither `deriveTreatmentDueState` nor `targetDate`; `export-views.ts` imports `projectRiskRegisterItem` and `isActiveRisk`; no file under `csrm/exports` names `csrm_risks` or the Risk document UID; `active-risk-readers.unit.test.ts` has no diff from `bdd0f698`; `send-export.ts` imports `sendStoredFile` and holds each media type string once, in `EXPORT_MEDIA_TYPES`; no content-type file changed since `bdd0f698`; the test names include `withdrawn`, `default export`, `cap race`, `About this export` and `label parity`.

## Task Commits

1. **Task 1: one filtered register export through the pipeline.** `cd72629c` (test, RED), `8fc65eaf` (feat, GREEN)
2. **Task 2: the whole vocabulary, its web copy and the parity test.** `f9706ddc` (test, RED), `39d2c8db` (feat, GREEN)
3. **Task 3: zones, the About sheet, CSV, the cap race, controls and the file response.** `4a6bd93c` (test, RED), `f3d5c9a6` (feat, GREEN)

## Files Created/Modified

- `apps/backend/src/csrm/exports/*` (seven files): the pipeline, views, vocabulary, time, file response and errors.
- `apps/backend/src/csrm/audit/security-event-log.ts`: the export and import families, levels and reasons; one formatter branch per family.
- `apps/backend/src/api/csrm-risk/services/risk-register-query.ts`: a shared internal filter-and-sort parser; `parseRiskRegisterExportQuery`.
- `apps/backend/src/api/csrm-risk/services/risk-register.ts`: `hydrate`'s optional export relations.
- `apps/backend/.gitignore`: Strapi's `exports` rule anchored to the app root (see Deviations).
- `apps/csrm/src/features/exports/*`: the web copy, its accessor and the parity test.

## Decisions Made

See `key-decisions` above. The ones a later plan must know: views implement `assertScope` and `auditQuery`; fixed tables carry their own CSV `slug` and an optional `summary` flag; report tables are `[rowHeader, ...columns]`; `ExportForbiddenError` is the 403 `resolveExportActor` throws and `sendExportError` maps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `apps/backend/.gitignore` ignored every `exports` directory**
- **Found during:** Task 1 GREEN commit
- **Issue:** Strapi's template rule `exports` matched `src/csrm/exports`, so git refused to stage the new modules.
- **Fix:** anchored it to `/exports` (Strapi's data-transfer output at the app root stays ignored), with a comment.
- **Files modified:** apps/backend/.gitignore
- **Commit:** 8fc65eaf

**2. [Rule 1 - Bug] RED test expected three rows in the default CSV**
- **Found during:** Task 3 GREEN
- **Issue:** the fixture has four active Risks (RSK-001, 002, 003, 005); the RED test asserted `X-CSRM-Row-Count: 3`.
- **Fix:** the assertion expects 4, with a message naming the four active Risks.
- **Files modified:** apps/backend/tests/export-pipeline.unit.test.ts
- **Commit:** f3d5c9a6

**3. [Rule 2 - Missing critical] My requests' `Security Analyst` column**
- **Found during:** Task 2
- **Issue:** the planned `my-requests` columns omitted the executed list's Security Analyst column; the default export would not equal the screen (D-06).
- **Fix:** added `assignee` `Security Analyst` (person, visible, after Status). Recorded above for 19-07.
- **Commit:** 39d2c8db

**4. [Rule 3 - Blocking] `export-errors.ts` added**
- **Issue:** `export-time.ts` and `send-export.ts` throw the pipeline's errors, and `run-export.ts` imports both, so defining the errors in `run-export.ts` would make an import cycle.
- **Fix:** the classes live in `export-errors.ts`; `run-export.ts` re-exports `ExportQueryError` and `ExportRefusalError` as planned.
- **Commit:** 8fc65eaf, f3d5c9a6

### RED evidence note

Tasks 1 and 3 (Strapi pipeline) and Task 2 (web) were RED because the modules under test did not exist yet (TypeScript TS2307, the test file failing to load). The security event log tests (Task 1) and the Strapi vocabulary tests (Task 2) failed on assertions. The new-module REDs therefore fail on module resolution rather than on an assertion, as 19-03's REDs did.

## Issues Encountered

- Bash heredocs holding a single quote inside the text (`(')`, `wasn’t`) failed to parse in this host's tool shell; the edits were made with the Edit tool and a scratch Node script instead. No effect on the code.

## Known Stubs

None. `runFixedTableExport` has no served caller yet by design: 19-09 (reports) and 19-10 (the released assessment) add them; the 11 other list views get their adapters in 19-05 to 19-12.

## Notes for later plans

- **19-05/19-06:** `EXPORT_MEDIA_TYPES` is the one definition of the two strings; the specification's 200 content keys and the web validator must equal them.
- **19-07:** add the `my-requests` `assignee` extractor (the Security Analyst's display name, or empty).
- **19-10:** `exportFileName` accepts lower-case slugs only (`^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$`); an assessment number such as `ASM-001` must be lower-cased (`asm-001-risk-assessment`) before it becomes a slug, or the name is refused.
- **19-09:** the vocabulary's `reports.<key>.tables` keys are the sections in kebab case; each table's columns are `[rowHeader, ...columns]`.
- **19-13:** `ImportSecurityEvent` is defined and formatted; pass the six counts and the file's SHA-256.

## Threat Flags

None. The plan adds no route, no content type and no new read: the register export reads through the register's own ruled repository, and the only new populate is the chosen columns' display relations (T-19-10).

## User Setup Required

None.

## Next Phase Readiness

19-05 can serve the first export: `riskRegisterExportView(createStrapiRiskRegisterRepository(strapi))`, `resolveExportActor`, `runListExport`, `sendExportFile` and `sendExportError` are ready.

## Self-Check: PASSED

All 12 created files are tracked, and the six task commits (cd72629c, 8fc65eaf, f9706ddc, 39d2c8db, 4a6bd93c, f3d5c9a6) exist.
