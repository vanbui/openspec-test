---
phase: 19-csv-export-and-import-hardening
plan: 13
subsystem: imports
tags: [administration-import, xlsx, header-matching, value-conversion, similar-names, decisions, result-record, import-committed, status-badges, route-budgets]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-02: the IMPORT_ reasons, found details, transport guard and S2 copy; 19-03: readImportFile, ImportFileRefusal, matchHeaders, convertCell, the UAT fixtures; 19-04: importColumns(kind) and the import.committed event shape"
provides:
  - "IMPORT_CSV_MALFORMED (422, found.line) in Strapi CONFLICT_REASONS, both specification enums, the web mirror, the transport guard and the S2 copy; the reader's CSV parse refusal"
  - "csv-import.ts: classifyAdministrationImport and the async parseAdministrationImport over readImportFile, matchHeaders and convertCell; warnings, notes (issues-column, read-only-columns, example-row) and readOnlyColumns; the sixth state similar and CsvImportRow.matchedName"
  - "administration-query.ts: administrationExactKey, administrationSimilarKey"
  - "administration-workflow.ts: file refusals as 413/415/422 with details.reason and found; the closed decisions field; IMPORT_DECISION_MISSING and IMPORT_REVIEW_EXPIRED; retained issue codes; issueResultRecord, resultRecordFor, IMPORT_RESULT_TTL_MS; resultToken and skipped; one import.committed line per commit"
  - "features/administration/import-row-status.tsx: importRowPresentation, importRowLabel, ImportRowBadge (six states); status-badge.tsx without the import row family, with PresentedStatusBadge and an exported unknownStatusPresentation"
  - "tests/helpers/strapi-http-harness.ts: createXlsxMultipart; decisions on both multipart helpers"
affects: [19-14, 19-15]

actuals:
  tokens: 75000
  tasks: 3
  commits: 7

plan_head_before: bc4d675b56f567e1c8a7dcf4df63af74664b0683
plan_head_after: 5d1e7724284a9de9b4710deeacc982ee1f8cca75

tech-stack:
  added: []
  patterns:
    - "A refusal with a closed reason carries it on AdministrationWorkflowError.details; the controller then answers the AssessmentWorkflowErrorResponse envelope, and every other workflow error keeps the Administration envelope's code"
    - "Process-local token stores share one makeRoom (expiry prune, 16 per actor and collection, 256 global) and one newToken (sha256: plus 64 hex of 32 random bytes)"
    - "A feature's own status map renders through the shared PresentedStatusBadge, so it reuses the tone rendering and fallback without growing the shared first-load map"

key-files:
  created:
    - apps/csrm/src/features/administration/import-row-status.tsx
    - apps/csrm/src/features/administration/import-row-status.test.tsx
  modified:
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/src/csrm/spreadsheets/import-file.ts
    - apps/backend/src/api/csrm-administration/services/csv-import.ts
    - apps/backend/src/api/csrm-administration/services/administration-workflow.ts
    - apps/backend/src/api/csrm-administration/services/administration-query.ts
    - apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts
    - apps/backend/tests/administration.unit.test.ts
    - apps/backend/tests/administration.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - apps/backend/tests/spreadsheet-reading.unit.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
    - apps/csrm/src/lib/api/transport/server-client.ts
    - apps/csrm/src/lib/api/transport/server-client.test.ts
    - apps/csrm/src/features/administration/import-refusal-copy.ts
    - apps/csrm/src/features/administration/import-refusal-copy.test.ts
    - apps/csrm/src/features/administration/csv-import-schema.ts
    - apps/csrm/src/features/administration/administration-schema.test.ts
    - apps/csrm/src/features/administration/administration-service.test.ts
    - apps/csrm/src/features/administration/administration-workflow.test.tsx
    - apps/csrm/src/features/administration/csv-import-flow.tsx
    - apps/csrm/src/features/administration/csv-client-parser.ts
    - apps/csrm/src/components/csrm/status-badge.tsx
    - apps/csrm/src/components/csrm/status-badge.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts

key-decisions:
  - "#CLEAR on a flag (Yes/No) is the converters' required-field issue (CLEAR_REQUIRED, `{label} is required, so #CLEAR can’t empty it.`): a flag always holds a value, and the mutation contract refuses null for it"
  - "A file holding only the template's example row is refused IMPORT_NO_ROWS: once the example row is skipped there is nothing to import"
  - "A natural key that matches more than one stored record by the similar key stays ambiguous (MULTIPLE_EXISTING_MATCHES), even when one of them is exact, as Phase 06 treated two normalised matches"
  - "A similar row decided update whose file carries no other value writes nothing and reports the matched documentId"
  - "The commit refuses decisions before consuming the preview: after a 400 or 409 decision refusal the same preview can be committed again"
  - "The commit's 409 is published as anyOf the Administration envelope (IMPORT_PREVIEW_CHANGED, IMPORT_RECORD_LIMIT_EXCEEDED by code) and the AssessmentWorkflowErrorResponse envelope (IMPORT_REVIEW_EXPIRED, IMPORT_DECISION_MISSING by details.reason)"
  - "The import.committed actor's display name is resolved with resolveExportActor before anything is written; no resolved IdamBox User is 403"
  - "found.line is copied beside IMPORT_CSV_MALFORMED only; beside any other import reason the guard drops the line and keeps the rest of found"

patterns-established:
  - "Integration tests cannot reach Strapi's in-memory stores (the harness loads its own compiled module), so the result record and the expired-preview clock are proven in unit tests through the workflow functions"

requirements-completed: []

duration: 3h20m
completed: 2026-10-17
---

# Phase 19 Plan 13: Tolerant, decision-gated Administration imports Summary

**The four Administration imports now read CSV UTF-8 or the first sheet of an .xlsx through the one reader. They match headers by field name or label and read Yes/No, `#CLEAR` and marked values. A lower-case or re-spaced copy of a stored name waits as "Matched by similar name" until the commit decides it. Every commit leaves a result record and one `import.committed` line.**

## Performance

- **Duration:** about 3h20m (11:00 to 14:20 AEST, 2026-10-17), including the 39.6-minute Strapi suite and the performance run
- **Tasks:** 3 (each RED then GREEN), plus the pilot-approved amendment commit
- **Files modified:** 30

## Accomplishments

- **UAT-051's "Name" file:** `Name,Description,Owner` previews with `warnings: ["Owner"]`. The same rows as an .xlsx preview identically.
- **Files CSRM cannot read:** each refusal names what the person can fix.
  - Excel's default CSV is 422 `IMPORT_ENCODING_WINDOWS_1252`, with no file content in the response.
  - A semicolon file is `IMPORT_DELIMITER`, with `found.delimiter`.
  - A broken CSV is `IMPORT_CSV_MALFORMED`, with `found.line`.
  - A `.txt` is 415 `IMPORT_FILE_TYPE`.
  - Duplicate and missing columns name their headers and labels.
- **Values are read the way people type them:**
  - Flags accept Yes/No, Y/N, TRUE/FALSE and XLSX booleans.
  - `#CLEAR` empties an optional field on an update. On a create it equals blank, and on a required field it is a row issue.
  - The neutraliser's mark is stripped.
  - Workbook numbers in text columns are read as text (`42` becomes `"42"`, and `0042` stays `"0042"`).
  - The example row is skipped with a note, and the Issues and read-only columns are notes rather than warnings.
  - A row over 65,536 bytes is one rejected `VALUE_TOO_LONG` row.
- **Similar names (ROADMAP criterion 5, CSV-03):** `uat-b: core customer billing system` and `UAT-B:  Core customer billing system` are `similar`, with the stored `matchedName`.
  - Committing without a decision is 409 `IMPORT_DECISION_MISSING`, and nothing is written.
  - `update` applies the description and keeps the stored name. `skip` leaves the record deep-equal.
  - A concurrent edit makes the row drift, and it is rejected.
- **The sixth state's badge** lives in an import-only module. The shared badge map lost the import row family and its five icons, so both near-limit routes gained headroom (see Route budgets).

## Task Commits

1. **Pilot-approved amendment: IMPORT_CSV_MALFORMED** – `3aadba08` (feat, with its tests)
2. **Task 1: one tolerant reader, warnings, file refusals**
   - RED `eb3ec197` (test)
   - GREEN `f994d7d2` (feat)
3. **Task 2: tolerant values**
   - RED `72704421` (test)
   - GREEN `adde929d` (feat)
4. **Task 3: similar rows, decisions, result record, commit event, badges**
   - RED `807795b5` (test)
   - GREEN `5d1e7724` (feat)

## Final shapes

**Preview (`AdministrationImportPreviewData`):**
- Fields: `fileName`, `previewDigest`, `limits`, `summary`, `warnings`, `notes`, `readOnlyColumns`, `rows`.
- `summary`: `{ create, update, unchanged, rejected, ambiguous, similar }`, a count per state, six in all.
- `warnings`: at most 50 headers as typed, each at most 200 characters.
- `notes`: drawn from `issues-column`, `read-only-columns` and `example-row`, each at most once.
- `readOnlyColumns`: display labels, at most 20.
- Each row: `{ rowNumber, state, naturalKey, matchedDocumentId, matchedName, values, changes, issues }`. `matchedName` is the stored name or control number for an update, unchanged or similar row, and null otherwise. A cleared optional value is `null` in `values`.

**Commit request:**
- Fields: `file`, `previewDigest`, `confirmed: true`, and the optional `decisions`.
- `decisions` is a JSON string of `{ "<1-5 digits>": "update" | "skip" }`, with at most 5,000 entries and at most 200,000 characters.

**Commit response (`AdministrationImportResultData`):**
- Fields: `fileName`, `previewDigest`, `resultToken`, `limits`, `summary`, `previewChanged`, `rows`.
- `summary`: `{ create, update, unchanged, rejected, ambiguous, skipped }`. A similar row decided `update` counts under `update`, and one decided `skip` under `skipped`.
- Each row: `{ rowNumber, state, naturalKey, decision?, documentId?, issues }`.
  - A similar row keeps `state: "similar"` and always carries `decision`.
  - `documentId` is present only for create, update and similar+update rows.

**Result token:**
- Format: `sha256:` followed by 64 lowercase hexadecimal characters from 32 random bytes.
- Record: `{ actorDocumentId, kind, fileDigest, fileName, format, expiresAt, rows: [{ rowNumber, outcome, decision, issues: [{ code, field }] }] }`.
- `outcome` is one of `created`, `updated`, `unchanged`, `rejected`, `ambiguous` and `skipped`.
- Lifetime: `IMPORT_RESULT_TTL_MS = 300_000`. At most 256 records in all and 16 per actor and collection, pruned on issue.
- `resultRecordFor` returns null for another actor, another collection, or after the TTL.

**Refusal envelope:**
- File refusals and the two decision 409s answer `{ data: null, error: { status, name: "AdministrationImportRefusal", message, details: { reason, found? } } }`.
- A malformed multipart shape, `INVALID_IMPORT_CONFIRMATION`, `INVALID_IMPORT_DECISIONS` (400), `IMPORT_PREVIEW_CHANGED` and `IMPORT_RECORD_LIMIT_EXCEEDED` (409) keep the Administration envelope's `code`.

**Deliberate behaviour change:**
- An expired, unknown, other-actor or other-collection preview token was 409 `IMPORT_PREVIEW_CHANGED` at `bdd0f698`. It is now 409 `IMPORT_REVIEW_EXPIRED`.
- A file whose digest differs from the reviewed one keeps 409 `IMPORT_PREVIEW_CHANGED`.
- Named in the tests `CSV-03 IMPORT_REVIEW_EXPIRED: an unknown or another analyst's preview token…` (integration) and `CSV-03 an expired preview is 409 IMPORT_REVIEW_EXPIRED…` (unit, fake clock).
- A consumed (replayed) preview token is also unknown, so it now answers `IMPORT_REVIEW_EXPIRED`. Its existing test checks only the 409.

**Drift behaviour observed:** the commit classifies the file again and compares each row with the retained preview row on row number, state, matched documentId, matched `updatedAt` and `matchedName`.
- A similar row whose record was PATCHed between preview and commit is rejected with `ROW_PREVIEW_DRIFT`, and the concurrent edit stays.
- The Phase 06 drift tests (a concurrent create, a value edit) are unchanged.

**Import row badges:**
- `features/administration/import-row-status.tsx` holds the five Phase 6 states unchanged, plus `similar` ("Matched by similar name", warning, `CaseSensitive`).
- Only `csv-import-flow.tsx` imports it.
- `status-badge.tsx` dropped `CheckIcon`, `RefreshCwIcon`, `FileCheck2Icon`, `CircleXIcon` and `CircleQuestionMarkIcon`, the `importRow` member and the `CsvRowState` import, and gained no icon.

## Route budgets (performance.spec.ts, delivered JS against 300,000 bytes)

| Build | `/app/risks/{documentId}` | `/app/requests/{documentId}` |
| --- | --- | --- |
| Before 19-13 (19-12 final, `583851ed`) | 299,849 (151 left) | 299,510 (490 left) |
| After 19-13 (`5d1e7724` sources) | **298,798 (1,202 left)** | **298,465 (1,535 left)** |

Both routes shrank, by 1,051 and 1,045 bytes, because the shared badge map no longer carries the import row family and its five icons. `performance.spec.ts` passed 11/11 (2.8 min).

Other routes in the same run:
- `/app/review/assessments/{documentId}` 397,859
- `/app/admin/controls` 250,699
- `/app` 229,968

## Verification

- **Amendment (`3aadba08`):**
  - Strapi `spreadsheet-reading` and `conflict-reasons`: 51/51.
  - Web `conflict-reasons`, `server-client`, `import-refusal-copy` and the parity guard: 517/517.
  - `api:check` exit 0, web typecheck and lint clean.
- **Task 1 verify** (`api:check`, web parser and parity tests, typecheck, `tsc`, the integration file): exit 0.
  - Web 234/234.
  - Strapi integration 25/25.
- **Task 2 verify** (`tsc`, administration unit and integration files): exit 0, 43/43.
- **Task 3 verify** (`api:check`; Vitest `src/features/administration`, `status-badge`, `interface-copy-guard` and the parity guard; typecheck; lint; the two greps; `pnpm --dir apps/backend test`): all passed.
  - Vitest 680/680 in 9 files.
  - Typecheck and lint clean.
  - The badge-map greps pass.
  - Full Strapi suite: 2,220 tests, 2,219 passed, 0 failed, 1 skipped (39.6 min).
- **Acceptance checks:**
  - `grep -rl import-row-status apps/csrm/src apps/csrm/app`, tests excluded, lists only `csv-import-flow.tsx`.
  - The content-type diff against `bdd0f698` prints nothing.
  - `normalizeAdministrationNaturalKey` is unchanged.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Pilot-approved execution amendment (a23aaa85)

**IMPORT_CSV_MALFORMED.** The amendment landed exactly as specified in `docs/contract-gaps/phase-19-import-tolerance.md` ("Phase 19 execution amendment (2026-10-17)"), in one commit with its tests (`3aadba08`, D-02). The amendment section itself was not edited.
- **Reason lists:** it was appended last to Strapi `CONFLICT_REASONS` and the web mirror, and both specification reason enums and their descriptions gained it.
- **`found.line`:** the specification's `found` gains `line` (integer, minimum 1, tied to this reason). Strapi's `ImportRefusalFound` keeps it only as a positive safe integer. The transport guard accepts `line` as a positive safe integer and keeps it beside `IMPORT_CSV_MALFORMED` only.
- **S2 copy, as written:** the title is `Fix the CSV file`, with the two bodies, and the steps are `Open the file in Excel, check that row, then:` plus the CSV UTF-8 steps. `IMPORT_FILE_REFUSAL_REASONS` now lists 16 reasons.
- **Reader:** the reader's parse `catch` refuses with `IMPORT_CSV_MALFORMED` and the parser's `lines`, where it was 415 `IMPORT_FILE_TYPE`. The check order is unchanged, which a test proves: a Windows-1252 or semicolon file with a broken quote keeps its own reason.

### Auto-fixed issues

**1. [Rule 3 - Blocking] The unit tests of `parseAdministrationCsv` moved to the async `parseAdministrationImport` in Task 1**
- **Found during:** Task 1. The reader is async, so the classifier's entry point became async.
- **Change:** `administration.unit.test.ts` (outside Task 1's file list) now expects the reader's closed reasons in place of the old messages: `IMPORT_NO_ROWS`, `IMPORT_NO_HEADER`, `IMPORT_ENCODING_WINDOWS_1252`, `IMPORT_TOO_MANY_ROWS` and `IMPORT_FILE_TOO_LARGE`.
- **Over-long record:** a record over 64 KiB is now one rejected row (pilot ruling 4), where the old test expected the whole file to be refused.
- **Commit:** `f994d7d2`

**2. [Rule 3 - Blocking] Web service-test fixtures follow the published shapes**
- **Files:** `administration-service.test.ts` (outside the file lists).
- **Change:** its fixtures gained `warnings`, `notes` and `readOnlyColumns` (Task 1), then `similar`, `matchedName`, `resultToken` and `skipped`, and its contract test reads six states (Task 3).
- **Commits:** `f994d7d2`, `5d1e7724`

**3. [Rule 2 - D-02] The web's closed preview parser accepts `null` for an optional value a `#CLEAR` emptied**
- **Found during:** Task 2. The server now serves a cleared value as `null`, which the specification already allowed. The web parser refused it, so a `#CLEAR` preview would have failed in the browser.
- **Change:** `csv-import-schema.ts` and a parser test, in Task 2 (the plan lists that file only in Tasks 1 and 3).
- **Commit:** `adde929d`

**4. [Rule 3 - Blocking] `csv-client-parser.ts` sets `matchedName`**
- **Found during:** Task 3. The retiring client parser builds `CsvImportPreviewRow`s, which now require `matchedName`.
- **Change:** it sets `matchedName` (the match's stored key, or null) so the web keeps typechecking until 19-15 retires it.
- **Commit:** `5d1e7724`

**5. [Rule 3] The older summary expectations follow the published keys**
- **Change:** the preview summaries in `administration.integration.test.ts` and the unit five-state test gained `similar: 0`, and the commit summaries `skipped: 0`. The test `IMPORT_PREVIEW_CHANGED` reads `error.code`, because that 409 keeps the Administration envelope.
- **Commit:** `5d1e7724`

**6. Route budgets measured**
- The plan says no Playwright. The pilot's brief requires a measurement whenever a shared module the two routes import changes, and `status-badge.tsx` is one. `performance.spec.ts` ran once after Task 3 (results above), and the tree stayed clean.

### Differences from the identifiers the plan names (written ahead)

- `readCsvUpload` became `readImportUpload`, which returns the bytes, file name, MIME type and digest. `readImport` wraps `parseAdministrationImport` and maps `ImportFileRefusal` to the workflow error.
- `parseAdministrationCsv` became `parseAdministrationImport` (async). `classifyAdministrationImport` is the synchronous classifier over an `ImportFile`.
- `prunePreviewRecords` is folded into `makeRoom`, which the preview and result stores share.
- `resultCounts` became `resultSummary` (six keys).
- `parseCell` is gone, and cells go through `convertCell`. `CsvImportRow` gained `matchedName`.

## Issues Encountered

- A Bash heredoc that carried `\r\n` or some Unicode escapes was mangled by the shell layer. Those edits went through script files written with the Write tool.
- `IMPORT_PREVIEW_CHANGED` has no closed reason. The first Task 3 run read `details.reason` for it, and the test now reads the envelope's `code`.

## Known Stubs

None. The web flow still sends no `decisions` and does not show `warnings`, `notes` or `matchedName`, so a preview with a similar row cannot be committed from the browser yet: the commit answers 409 `IMPORT_DECISION_MISSING`. Plan 19-15 builds that UI, and maps `IMPORT_CSV_MALFORMED` and the other refusals there. The tiles grid keeps five columns for six states, and the Results tiles label `skipped` through the badge fallback ("Skipped"), until 19-15 shapes the flow.

## Next Phase Readiness

- **19-14:** `resultRecordFor`, the retained preview issue codes (`{ code, field }`, at most 20 per row) and `matchedName` are the server-authoritative basis for the error report.
- **19-15:**
  - The decisions UI posts `decisions` as a JSON string.
  - It maps `IMPORT_DECISION_MISSING` and `IMPORT_REVIEW_EXPIRED` to S3, and the 16 file refusals (with `IMPORT_CSV_MALFORMED`) to S2.
  - It shows `warnings`, `notes` and `readOnlyColumns`.
  - It retires `csv-client-parser.ts`.
- **CSV-02 and CSV-03** stay open until 19-15, as the running notes say. `requirements.mark-complete` is not run for them.

## Self-Check: PASSED

- Present: `import-row-status.tsx`, `import-row-status.test.tsx` and this SUMMARY.
- Commits `3aadba08`, `eb3ec197`, `f994d7d2`, `72704421`, `adde929d`, `807795b5` and `5d1e7724` are all on `csrm`.
