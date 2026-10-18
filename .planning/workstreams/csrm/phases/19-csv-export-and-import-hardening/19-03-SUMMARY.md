---
phase: 19-csv-export-and-import-hardening
plan: 03
subsystem: spreadsheets
tags: [csv-export, xlsx, import-tolerance, neutraliser, zip-bounds, write-excel-file, shared-backend]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-02: the IMPORT_ codes in CONFLICT_REASONS; 19-01: the approved import-tolerance record and PHASE_19_BASE=bdd0f698"
  - phase: 14-request-attachments
    provides: "zip-archive.ts (readZipDirectory, readZipEntry, findZipEntry, ZipArchiveError), xlsx-reader.ts (readWorkbookSheets, the verified rebuilt archive), read-excel-file 9.3.10, the ZIP, CFB and SpreadsheetML fixture builders"
provides:
  - "write-excel-file 4.1.1 in apps/backend only, exact pin; fflate resolves to 0.8.3 only"
  - "csrm/spreadsheets/neutralise.ts: NEUTRALISER_MARK, needsNeutraliser, sanitizeSpreadsheetCell, stripNeutraliserMark (exact inverse)"
  - "csrm/spreadsheets/csv-writer.ts: UTF8_BOM, writeCsv, CsvCell, CsvDocument"
  - "csrm/spreadsheets/xlsx-writer.ts: writeWorkbook, safeSheetName, XLSX_SHEET_NAME_MAX, WorkbookSheet, SheetCell (the only write-excel-file importer)"
  - "csrm/spreadsheets/xlsx-reader.ts: readFirstSheet, XlsxReadError.reason (14-02's exports unchanged)"
  - "csrm/spreadsheets/import-file.ts: readImportFile, ImportFileRefusal, IMPORT_FILE_REFUSAL_REASONS, isImportFileRefusalReason, importRefusalStatus, ZIP_ERROR_REASONS, boundImportTexts, IMPORT_MAX_BYTES/ROWS/RECORD_BYTES, XLSX_IMPORT_MAX_ENTRIES (512), XLSX_IMPORT_MAX_UNCOMPRESSED_BYTES (52,428,800), XLSX_IMPORT_MAX_COLUMNS (1,024), XLSX_IMPORT_BOUNDS, ImportRow, ImportFile, ImportFileFormat, ImportCell, ImportRefusalFound"
  - "csrm/spreadsheets/header-match.ts: headerKey, matchHeaders, HEADER_WARNINGS_MAX, ImportColumnHeader, HeaderMatch, ImportNoteCode, KnownIgnoredHeaders"
  - "csrm/spreadsheets/value-convert.ts: CLEAR_TOKEN, convertCell, VALUE_CONVERTERS, ConvertedCell, ImportValueColumn, ValueConverter, ImportValueIssueCode"
affects: [19-05, 19-06, 19-11, 19-13, 19-14, phase-18]

actuals:
  tokens: 20600
  tasks: 4
  commits: 8

plan_head_before: 35093c32801614e067dc57ea446078d208e505bc
plan_head_after: 6ad3760b4f302a217112184934990da724b37354

tech-stack:
  added: ["write-excel-file 4.1.1 (apps/backend only; its one dependency fflate 0.8.3 was already in the lockfile)"]
  patterns:
    - "One module per spreadsheet library: xlsx-writer.ts names write-excel-file, xlsx-reader.ts names read-excel-file; every caller goes through them"
    - "A workbook upload is bounded three times before the reader runs: the directory (import bounds), every inflate (one 50 MiB budget), the first sheet's used range (rows and columns)"
    - "A refusal carries one closed reason, its status and bounded found details; every ZipArchiveError code maps through a Record the compiler holds exhaustive"

key-files:
  created:
    - apps/backend/src/csrm/spreadsheets/neutralise.ts
    - apps/backend/src/csrm/spreadsheets/csv-writer.ts
    - apps/backend/src/csrm/spreadsheets/xlsx-writer.ts
    - apps/backend/src/csrm/spreadsheets/import-file.ts
    - apps/backend/src/csrm/spreadsheets/header-match.ts
    - apps/backend/src/csrm/spreadsheets/value-convert.ts
    - apps/backend/tests/helpers/spreadsheet-fixtures.ts
    - apps/backend/tests/spreadsheet-neutralise.unit.test.ts
    - apps/backend/tests/spreadsheet-writers.unit.test.ts
    - apps/backend/tests/spreadsheet-reading.unit.test.ts
    - apps/backend/tests/spreadsheet-headers-values.unit.test.ts
  modified:
    - apps/backend/package.json
    - pnpm-lock.yaml
    - apps/backend/src/csrm/spreadsheets/xlsx-reader.ts
    - apps/backend/src/api/csrm-administration/services/csv-import.ts

key-decisions:
  - "readFirstSheet reads the same verified, rebuilt archive as 14-02's readWorkbookSheets (CR-201, WR-201), not the uploaded bytes sliced to an ArrayBuffer: the plan's exact slice is what canonicalWorkbook already returns, and the library never parses unverified bytes"
  - "write-excel-file is imported through write-excel-file/node; tsc resolves its index.d.ts under the backend's node10 resolution, so no local declaration was needed (19-RESEARCH Pitfall 3)"
  - "A first-sheet used-range guard (XLSX_IMPORT_MAX_COLUMNS 1,024; rows over 5,001 refused as IMPORT_TOO_MANY_ROWS) runs before the reader, because read-excel-file pads every row to the used range and two cells at A1 and XFD1048576 would make billions of cells (T-19-06)"
  - "A malformed CSV structure (unbalanced quotes, ragged columns under today's relax_column_count: false) is IMPORT_FILE_TYPE, 415: the record's closed list has no other reason for content that is not readable CSV"
  - "A workbook date cell reaches ImportRow as its YYYY-MM-DD text (ImportRow carries no Date); Phase 18's date converter starts from that text"
  - "INVALID_ENUM and VALUE_TOO_LONG keep today's sentences but name the column by its display label, as the S4 sentences and the error report do"
  - "Header warnings are bounded at the source (50, controls removed, 200 characters), with found details sharing the same helper"
  - "The import bounds are declared in import-file.ts and pinned equal to csv-import.ts's CSV_MAX_* by a test, so csrm/spreadsheets does not import an api service module; 19-13 unifies them when the import adopts the reader"

patterns-established:
  - "spreadsheet-fixtures.ts builds every import shape in memory (encodings, bombs, macro and encrypted workbooks, sparse used ranges, the UAT files RT-2, RT-3, IS-1, IS-2)"

# Contributes to CSV-01 and CSV-02; neither is complete until the phase's exports and import adopt these modules.
requirements-completed: []

duration: 76min
completed: 2026-10-16
---

# Phase 19 Plan 03: Spreadsheet reading and writing modules Summary

**One neutraliser with an exact inverse, a BOM-and-CRLF CSV writer, a typed XLSX writer on write-excel-file 4.1.1, and one bounded CSV/XLSX import reader with closed refusals, header matching and value conversion, all pure Strapi modules tested without a Strapi instance.**

## Performance

- **Duration:** about 76 min (2026-10-16T12:48Z to 14:04Z), of which the full Strapi suite took 53 min
- **Tasks:** 4
- **Files:** 11 created, 4 modified

## Accomplishments

- **The neutraliser** (`neutralise.ts`) marks every formula trigger, its full-width form, a trigger after whitespace, and a run of quotes before a trigger with one leading `'`. `stripNeutraliserMark` removes exactly that mark. A fixed corpus and 5,000 generated values prove `strip(mark(v)) === v`, and that strip leaves every unmarked value alone.
- **The writers.** `writeCsv` writes a BOM, CRLF line ends, quoted and neutralised text, bare numbers and `YYYY-MM-DD` dates. `writeWorkbook` writes typed cells: `@` text, numbers, and `d mmm yyyy` dates at UTC midnight. The header row is bold and frozen (`ySplit="1"`), columns take their widths, and no cell is ever a formula. The test inflates `sheet1.xml` and asserts there is no `<f>` element.
- **The import reader** (`readImportFile`):
  - checks the extension allow-list and the advisory MIME type, then the 5 MiB bound;
  - lets the file's signature choose the path;
  - reads CSV as strict UTF-8 only (Windows-1252 and unknown-encoding refusals), checks the delimiter, and scans records quote-aware before parsing;
  - reads XLSX only after the import bounds, a single 50 MiB inflate budget, the macro checks and the used-range guard.

  Every refusal is an `ImportFileRefusal` with a closed reason, its status (413, 415 or 422) and bounded `found` details.
- **Header matching** works by field or label, ignoring case, spaces, underscores, hyphens and width. Unknown columns produce warnings; `Issues` and read-only columns produce notes. Duplicate and missing columns are refused with their `found` details.
- **Value conversion:**
  - flags accept Yes/No, Y/N and TRUE/FALSE, plus XLSX booleans;
  - enumerations are matched case-insensitively and return the canonical value;
  - `#CLEAR` clears an optional field on update and is blank on create; on a required field it is an issue;
  - the neutraliser's mark is stripped, and numbers become text.

  The two S4 sentences are verbatim. `VALUE_CONVERTERS` is frozen with keys `text`, `flag` and `enum` for Phase 18 to extend.
- **`csv-import.ts`** now imports the shared neutraliser and re-exports it. The administration import otherwise behaves exactly as before.

## Dependency evidence (D-12)

- `npm view write-excel-file version`: `4.1.1`. Licence MIT; registry modified 2026-06-08; one dependency `fflate: ^0.8.2`; no `postinstall`, `install` or `preinstall` script.
- `pnpm --dir apps/backend add write-excel-file@4.1.1 --save-exact`: `+ write-excel-file 4.1.1`, one package added.
- `pnpm --dir apps/backend why fflate`:

```
fflate@0.8.3
├─┬ read-excel-file@9.3.10
│ └── @csrm/strapi@0.1.0 (dependencies)
└─┬ write-excel-file@4.1.1
  └── @csrm/strapi@0.1.0 (dependencies)

Found 1 version of fflate
```

- The lockfile check (every `fflate@…` key and `fflate:` line) returns `['0.8.3']`.
- `git diff bdd0f698 -- apps/csrm/package.json` prints nothing.
- **Entry path used:** `write-excel-file/node` (default import plus the `Cell` and `Sheet` types). It resolves under `moduleResolution: "Node"` through `node/index.d.ts`. At runtime, `require` honours the `exports` map (`node/index.cjs`).

## Verification

| Task | Command (the plan's `<verify>`) | Result |
| --- | --- | --- |
| 1 | the lockfile `fflate` check, `tsc --noEmit`, the test build, and the neutralise and writers files | exit 0; 11 tests, 11 passed, 0 failed, 0 skipped |
| 2 | the test build, then reading, `zip-archive` and `attachment-extraction` | exit 0; 99 tests, 99 passed, 0 failed, 0 skipped (reading: 37) |
| 3 | the test build, then headers-values | exit 0; 18 tests, 18 passed, 0 failed, 0 skipped (with reading: 55 of 55) |
| 4 | `tsc --noEmit`, `pnpm --dir apps/backend test`, and the `FORMULA_INITIATORS` count | exit 0; **2,092 tests, 2,091 passed, 0 failed, 1 skipped** (the existing POSIX-modes test on Windows); `FORMULA_INITIATORS` count 0 |

Acceptance checks:
- `git grep -l "write-excel-file" -- apps/backend/src` lists only `xlsx-writer.ts`.
- `git grep -l "read-excel-file" -- apps/backend/src` lists only `xlsx-reader.ts`.
- `git grep -l -e "sanitizeSpreadsheetCell = " -e "function sanitizeSpreadsheetCell" -- apps/backend/src` lists only `neutralise.ts`.
- The content-type diff against `bdd0f698` is empty.
- `git ls-files --others --exclude-standard apps/backend/tests` lists nothing.
- `header-match.ts` and `value-convert.ts` contain no `@strapi` import.

The tracer gate after Task 1 re-ran its verify end to end and it passed, so expansion went ahead.

## Task Commits

1. **Task 1: neutraliser and writers.** `4407d582` (test, RED), `57f5c35c` (build, dependency), `00943d8a` (feat, GREEN)
2. **Task 2: bounded import reader.** `f64287eb` (test, RED), `6f1d2026` (feat, GREEN)
3. **Task 3: header matching and value conversion.** `c2004550` (test, RED), `84f8adbe` (feat, GREEN)
4. **Task 4: the administration import takes the shared neutraliser.** `6ad3760b` (refactor)

## Files Created/Modified

- `apps/backend/src/csrm/spreadsheets/neutralise.ts`: the one neutraliser and its exact inverse
- `apps/backend/src/csrm/spreadsheets/csv-writer.ts`: RFC 4180 CSV with BOM and CRLF
- `apps/backend/src/csrm/spreadsheets/xlsx-writer.ts`: the only write-excel-file importer
- `apps/backend/src/csrm/spreadsheets/xlsx-reader.ts`: `readFirstSheet`, `XlsxReadError.reason`, and a shared `verifiedWorkbook` helper (exports unchanged)
- `apps/backend/src/csrm/spreadsheets/import-file.ts`: the bounded reading pipeline with closed refusals
- `apps/backend/src/csrm/spreadsheets/header-match.ts`: header matching by field or label
- `apps/backend/src/csrm/spreadsheets/value-convert.ts`: the converters Phase 18 extends
- `apps/backend/src/api/csrm-administration/services/csv-import.ts`: imports and re-exports the neutraliser
- `apps/backend/package.json` and `pnpm-lock.yaml`: `write-excel-file` 4.1.1
- `apps/backend/tests/helpers/spreadsheet-fixtures.ts` and the four `spreadsheet-*.unit.test.ts` files

## Decisions Made

See `key-decisions` in the frontmatter. Two of them shape later plans:
- **The used-range guard.** It is a Rule 2 addition (see below).
- **Malformed CSV is `IMPORT_FILE_TYPE` (415).** The pilot's ruling 3 said an unreadable file gets a closed reason. `IMPORT_FILE_TYPE` is the only reason in the closed list that fits. Plans 19-13 and 19-15 should know the status is 415, not 422.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A first-sheet used-range guard before the reader**
- **Found during:** Task 2 (reading read-excel-file's `parseSheet`)
- **Issue:** the reader fills row gaps with empty rows and pads every row to the widest used column. A file of a few hundred bytes holding values at `A1` and `XFD1048576` would allocate about 17 billion cells. That is a denial of service the archive bounds do not catch (T-19-06).
- **Fix:** after the bounded inflate, `import-file.ts` finds the first sheet (the workbook's first `<sheet>` and its relationship) and scans its cells holding a value. If it cannot name the first sheet, it scans every worksheet. It refuses a range wider than `XLSX_IMPORT_MAX_COLUMNS` (1,024) as `IMPORT_WORKBOOK_TOO_LARGE`, and a last row beyond 5,001 as `IMPORT_TOO_MANY_ROWS` with `found.rows`. Both run before `readFirstSheet`.
- **Files modified:** `apps/backend/src/csrm/spreadsheets/import-file.ts`, with tests in `spreadsheet-reading.unit.test.ts` and `buildSparseWorkbook` in the fixtures
- **Commit:** `6f1d2026`

**2. [Rule 3 - Blocking] An import-file comment named the reading library**
- **Found during:** Task 2 GREEN
- **Issue:** 14-02's guard test in `attachment-extraction.unit.test.ts` ("only the XLSX reader names read-excel-file") failed. It searches source text, and a comment in `import-file.ts` named the library.
- **Fix:** reworded the comment. The guard holds as 14-02 wrote it.
- **Commit:** `6f1d2026`

### Written-ahead identifiers followed as executed

- `readFirstSheet(bytes, options?)` takes 14-02's `XlsxReadOptions`, so the import passes the 50 MiB `maxInflated`. It reads the verified rebuilt archive, not raw bytes (see key-decisions).
- `matchHeaders(headers, columns, { knownIgnored })` makes `knownIgnored` optional. The default is `Issues` with no read-only labels.
- The plan lists `buildCfbHeader` and `buildEncryptedCfb`. 14-02's `buildCfb` is private, so `buildCfbHeader` writes a minimal CFB header naming a `Workbook` stream, and `buildEncryptedCfb` reuses 14-02's exported `buildEncryptedOoxml`.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None. These modules have no callers yet. The administration import adopts the reader, matcher and converters in 19-13, and the exports adopt the writers in later Phase 19 plans, as planned.

## Threat Flags

None. All new surface is in the plan's threat model: T-19-05 is mitigated by the neutraliser and string-only cells, T-19-06 by the archive, inflate and used-range bounds, T-19-07 by the reader reading the verified rebuilt archive, T-19-08 by strict UTF-8, T-19-09 by macro and encryption refusals, and T-19-SC by the exact pin with `fflate` 0.8.3.

## User Setup Required

None.

## Next Phase Readiness

- 19-13 can switch `parseAdministrationCsv` to `readImportFile`, `matchHeaders` and `convertCell`. It should map `ImportFileRefusal.status` and `found` into the 413, 415 and 422 envelope, and unify `IMPORT_MAX_*` with `CSV_MAX_*`.
- The export plans can call `writeCsv` and `writeWorkbook` directly. Workbook date cells must be the UTC midnight of the viewer-local calendar date.

## Self-Check: PASSED
