---
status: testing
phase: 19-csv-export-and-import-hardening
source: [19-VERIFICATION.md, 19-VALIDATION.md, 19-SECURITY.md, 19-UI-REVIEW-DISPOSITION.md, 19-15-SUMMARY.md]
started: "2026-10-17"
updated: "2026-10-17"
---

# Phase 19 human verification

Verification found no gap. All six roadmap criteria hold in the code, and CSV-01, CSV-02 and CSV-03 are satisfied, closing UAT-049, UAT-051 and UAT-052 (`19-VERIFICATION.md`: 6/6, 0 gaps, status `human_needed`). The status is `human_needed` only because eight checks need a person, Excel, a printer, a screen reader or a deployment. The pilot rules on the verification status.

Eight checks need a person, Excel, a printer, a screen reader or a deployment. No browser walk by a person has been run for this phase, so none is recorded as passed here. The pilot rules on each one: run it, or accept it as a deferred operator follow-up, as Phases 10 to 16 did.

Each check below names its automated backstop. The final gate (`19-15-SUMMARY.md`, "Phase gate (final run, after the code review)") runs `exports-and-imports.spec.ts` at 375 and 1440, with axe and the no-overflow check on every Phase 19 surface. It keeps the A4 PDF and the screenshots that `19-UI-REVIEW-DISPOSITION.md` lists under "Captures".

**Pilot status ruling (2026-10-18):** `passed`. The re-verification at `16803cd4` (`93799b8f`) found 0 gaps: 6/6 criteria met, CSV-01 to CSV-03 satisfied, and the T-19-06 fix verified on the code with linear timing. All 57 of 57 threats are closed, the phase is Nyquist-compliant, and all 43 review findings are dispositioned with none open. The final gate at `31d7c70d` is green and ran on today's `apps/` code: web 6,440/6,440; Strapi 2,306 passed with 1 skipped; Playwright 268/268, 0 flaky. As in Phases 10 to 16, the eight checks in `19-UAT.md` need real Excel, paper, NVDA, a 768 visual review, the operator's database or a deployment. They stay open as deferred operator follow-ups and do not block completion.

## Current Test

[awaiting the pilot's ruling]

## Tests

### 1. An export opened in Excel, with the neutraliser mark (CSV-01, criterion 1)

expected: On a machine with Excel, an exported CSV and XLSX holding `=HYPERLINK("https://example.test","Click")` open with the cell as text, and nothing evaluates. Saving the CSV as CSV and reopening it keeps the cell as text. A hand-made CSV with OWASP's tab variant (`"\t=1+2"`) behaves the same way. Re-importing both leaves the stored values unchanged. The result is recorded in `docs/contract-gaps/phase-19-exports-and-export-log.md`.
result: pending
reason: "Deferred operator follow-up: Excel is not installed in this environment, and OWASP's caveat concerns Excel's own behaviour. Backstops: `spreadsheet-neutralise.unit.test.ts` and `spreadsheet-writers.unit.test.ts` (the `'=HYPERLINK(…)` cell in both writers), and `exports.integration.test.ts :: reference-lists: the Information Systems export, imported back byte for byte in CSV and XLSX, previews every row unchanged, the marked formula-like description included` (`3c43d4f3`)."

### 2. An error report corrected in Excel and imported again (CSV-02, criterion 4)

expected: The CSV error report (UTF-8 with BOM) and the XLSX error report open in Excel. A person corrects a rejected row, saves in the same format and imports the file. The corrected row now previews as create or update, and the Issues column is ignored with its warning.
result: pending
reason: "Deferred operator follow-up: the automated proof reads the file with the same libraries and `csv-parse`, not with Excel. Backstops: `administration.integration.test.ts` (19-14's error report round trip), and the e2e `error report round trip @journey` at 375 and 1440."

### 3. A Windows-1252 CSV saved by real Excel (CSV-02, criterion 3)

expected: A file saved by Excel as "CSV (Comma delimited)", holding a name with an accent such as `Café`, is refused at Select file with `IMPORT_ENCODING_WINDOWS_1252`'s fix-it copy and its three steps, and the file stays chosen. After the file is saved as "CSV UTF-8" in Excel, or uploaded as the `.xlsx` itself, the import reads the name intact. A semicolon-delimited file from a European locale gets its own delimiter refusal.
result: pending
reason: "Deferred operator follow-up: the suites write Windows-1252 from a latin1 buffer, not from Excel. Backstops: `spreadsheet-reading.unit.test.ts :: IMPORT_ENCODING_WINDOWS_1252: RT-3 (0xE9)` and `IMPORT_ENCODING_UNKNOWN …`, `administration.integration.test.ts :: CSV-03 an unreadable file is refused with IMPORT_ENCODING_WINDOWS_1252, IMPORT_DELIMITER, IMPORT_CSV_MALFORMED or IMPORT_FILE_TYPE and writes nothing`, and the e2e `import tolerance @journey` step `Excel’s default CSV gets Save the file as CSV UTF-8 with three steps, and the file stays chosen`."

### 4. The 25-risk released assessment printed on A4 paper (19-12, X-31)

expected: A released assessment with 25 risks, printed or saved as a PDF from `Print report`, puts its overview on A4 portrait with the 16mm margin and `Page n of m`. The overview table's header repeats on each page and no column is clipped. `Risks in detail` starts on a new page, each Risk avoids breaking inside where it fits, and the document title is the page's one heading level 1 (UI-05).
result: pending
reason: "Deferred operator follow-up: the paper look needs a person to read the sheet. Backstops: `assessment-report.test.tsx` (the A4 document, its parts and order, and UI-05's one h1 on paper), and the e2e `print report @journey`. That test checks print emulation at 375 and 1440 and saves the A4 PDF on desktop (`report-a4.pdf`, see `19-UI-REVIEW-DISPOSITION.md`, \"Captures\")."

### 5. NVDA and keyboard-only on Windows (UI-01 to UI-04, UI-11, UI-12)

expected: With NVDA and Chrome on Windows, at 1440 and 375, a person checks each of these surfaces:
- the export dialog: focus starts on the checked format, Enter exports, `Exporting…` is spoken on the button that keeps focus, a refusal is read once at its title, and focus returns to `Export`;
- the column choice: the count, `Select all` and `Reset to visible`, and the `Choose at least one column.` error read with the group;
- the released assessment's `Print report` and `Export {number}`;
- the import's steps: `File to import` is spoken with `Choose file`, the S2 refusal and `Choose one file to check.` are announced, the similar panel's count is polite, and the gate line is read with the focused decision;
- the error report and template downloads, which keep focus while pending.
The whole path works without a mouse.
result: pending
reason: "Deferred operator follow-up: there is no screen reader in this environment. Automated proofs: the keyboard and focus paths in `export-dialog.test.tsx` and `administration-workflow.test.tsx`, including the stage B UI-01 to UI-12 tests (`6e748eeb`, `536d3856`), and axe at 375 and 1440 in `exports-and-imports.spec.ts`."

### 6. Visual review at 768, with reflow from 320 to 1440 (UI-06)

expected: At 768 a person reviews:
- each list header with `Export`;
- the export dialog at the 768 breakpoint, where it stops being a sheet, including a five-filter dialog;
- the two-column checklist from 640px;
- the released header wrapper;
- the report card and its overview table;
- the import's Review step with the summary tiles, the decision radios, and a 200-character existing name in an Update label (the radio stays aligned with the first line).
Every surface reflows from 320 to 1440 with no clipping or horizontal page scroll.
result: pending
reason: "Deferred operator follow-up (pilot ruling, 2026-10-17). The UI audit was code-only. The final gate's journeys run at 375 and 1440 with `expectNoOverflow` and axe, and keep screenshots of the export dialog, the released dialog, the report on screen and in print, and the import decisions at both widths (`19-UI-REVIEW-DISPOSITION.md`, \"Captures\"). No project runs at 768."

### 7. The operator's development database after the next Strapi start

expected: With both Keycloak flags off, the first Strapi start on the operator's database applies the Phase 19 catalogue:
- the new API-only export and import Functions and their FunctionAPI rows, with the human-only analyst exports on `role.security_analyst` and the own-record Function on the Requestor birthright;
- the BE2-08 re-seed, which leaves exactly one FunctionAPI row per catalogued URL, so the two moved URLs carry no stale grant.
Bob can export and import, and Jane can export only her own records and her released assessment. No content type changes, so no table or column is added.
result: pending
reason: "Deferred operator follow-up, at the operator's next start. Backstops: `catalogue-reseed.integration.test.ts` (from a database seeded with `bdd0f698`'s catalogue: each moved URL ends with one FunctionAPI row, held by its catalogued Function, and no row is orphaned), `authorization-matrix` and `exports.integration.test.ts`. The content-type freeze is empty (final gate static checks)."

### 8. Production contract and catalogue acceptance

expected: The deployment accepts the additive `specification.json` operations and the role-function catalogue: the API-only Functions, the human-only analyst exports, no grant to the Security Analyst Agent or any service role, and the Strapi copy identical to `docs/references/`. The export event log (`export.completed` and `export.refused`, including the log-only `EXPORT_FAILED` reason) reaches the production log pipeline with one line per attempt, and no cell value is logged.
result: pending
reason: "Deferred to deployment. The catalogue copies are byte-identical (`cmp`), the content-type freeze is empty, and the G-6 records `phase-19-exports-and-export-log.md` and `phase-19-import-tolerance.md` carry the pilot's approvals (final gate static checks)."

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

No observed implementation gap:
- `19-VERIFICATION.md` records 0 gaps: 6/6 criteria, with CSV-01, CSV-02 and CSV-03 satisfied.
- `19-SECURITY.md` is `verified` with `threats_open: 0` and all 57 threats closed. T-19-06, the XLSX sheet pass, was found open at high and fixed test-first in stage B (`08e2e72d`, `d12f1fa2`). T-19-45's caps gained their tests (`7160ce64`).
- `19-VALIDATION.md` is validated and Nyquist-compliant. Its one gap, the byte-for-byte re-import of a marked export, was filled in `3c43d4f3`.
- `19-REVIEW-DISPOSITION.md` holds 43 findings with 0 open; BE3-01's row is corrected for T-19-06.
- `19-UI-REVIEW-DISPOSITION.md` records UI-01 to UI-05 and UI-07 to UI-12 fixed (`6e748eeb`, `536d3856`), and UI-06 cited and captured.

The export rate and concurrency limit is deferred to Phase 22 (pilot ruling; `deferred-items.md`, `22-CONTEXT.md`).

The final complete automated gate is recorded in `19-15-SUMMARY.md` under "Phase gate (final run, after the code review)".

## Deferred Follow-Ups

- test: 1
  idea: "Open an export holding the neutraliser mark in Excel, save as CSV, reopen and re-import, including OWASP's tab variant: the operator's"
  deferred_at: 2026-10-17
- test: 2
  idea: "Correct the CSV and XLSX error reports in Excel and import them again: the operator's"
  deferred_at: 2026-10-17
- test: 3
  idea: "A Windows-1252 CSV saved by real Excel gets the fix-it refusal, and its CSV UTF-8 or .xlsx resave imports intact: the operator's"
  deferred_at: 2026-10-17
- test: 4
  idea: "Print a 25-risk released assessment on A4 and read the paper: the operator's"
  deferred_at: 2026-10-17
- test: 5
  idea: "NVDA and keyboard-only on the export dialog, column choice, released actions, import steps and downloads: the operator's"
  deferred_at: 2026-10-17
- test: 6
  idea: "Visual review of every Phase 19 surface at 768, with reflow from 320 to 1440: the operator's"
  deferred_at: 2026-10-17
- test: 7
  idea: "The Phase 19 catalogue and the BE2-08 re-seed on the operator's development database at the next Strapi start: the operator's"
  deferred_at: 2026-10-17
- test: 8
  idea: "Production acceptance of the additive contract, the catalogue and the export event log: at deployment"
  deferred_at: 2026-10-17
