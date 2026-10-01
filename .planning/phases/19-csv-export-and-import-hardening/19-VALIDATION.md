---
phase: "19"
slug: "csv-export-and-import-hardening"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `19-RESEARCH.md`, "Validation Architecture", before any plan exists. It maps every requirement, finding and decision to an automated proof:
- the three requirements: CSV-01, CSV-02 and CSV-03;
- the three findings: UAT-049, UAT-051 and UAT-052;
- the six ROADMAP success criteria;
- the locked decisions D-01 to D-41 in `19-CONTEXT.md`.

**How the maps are filled.**
- **Per-task map:** the rows below are seeded from the research's proposed plan families (`19-01` to `19-10`). The planner replaces them with one row per task, taken from each task's `<automated>` verify block, and the plan check verifies them (Dimension 8).
- **Plan numbering:** if the planner merges or splits plans, it records the mapping from the research's numbering here.
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
- **Status:** every status starts as ⬜ pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** Vitest 4.1.11 (jsdom) with Testing Library.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` into `.tmp/tests-dist`, one process and one SQLite database per test file. HTTP proofs go through `apps/backend/tests/helpers/strapi-http-harness.ts`. Its `request()` returns the raw `fetch` `Response`, so file bodies are read with `arrayBuffer()`.<br>**E2E:** Playwright 1.58.2, Chromium, on the production build (`desktop` 1440×900; `mobile` 375×812). |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| **Node** | Prefix every command in Git Bash with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" &&` (Node 24.19.0, pnpm 11.24.0). The PATH default is Node 22.19.0, which the engines field (`>=24.19.0 <25`) refuses. |
| **Quick run command** | **Web:** `pnpm --filter @csrm/web exec vitest run <path> [<path> …]`, with paths under `apps/csrm`. Never put a pattern after `--`.<br>**Strapi file** (dev servers stopped): `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js`.<br>**E2E** (dev servers stopped): `pnpm --filter @csrm/web test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a new or changed route or grant: `SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write` (dev servers stopped). |
| **Full suite command** | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test` |
| **Phase gate** | The full-suite commands, then `pnpm --dir apps/csrm test:e2e` (both projects, production build).<br>**Before:** ports 1337 and 3000 are free; in Git Bash, `netstat -ano \| grep -E ':(1337\|3000) .*LISTENING'` prints nothing.<br>**Afterwards:**<br>- `git status --short` shows only the brief's three operator items (Phase 8 D-12; a dirty tree is a harness defect);<br>- the content-type freeze check `git diff --name-only <phase-19-context-commit>..HEAD -- 'apps/backend/src/api/*/content-types/*'` prints nothing (D-01);<br>- `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` is silent;<br>- `git diff <phase-19-context-commit>..HEAD -- apps/csrm/package.json` shows no new web dependency (D-12: the XLSX pair is in Strapi only);<br>- `git diff --name-only <phase-19-context-commit>..HEAD \| grep -i keycloak` prints nothing. |
| **Estimated runtime** | A web file takes under 20 s; a Strapi unit file 10–30 s, a Strapi integration file 30–120 s, and the authorization matrix 2–4 min. The full Strapi suite takes about 10–15 min, and the full Playwright suite about 15–20 min (Phase 19 adds one journey spec and changes the import journey). |

**Known infrastructure facts.**
1. **Shared `dist`.** The orchestrator's dev Strapi (1337) and Next (3000) may run during planning. Everything that compiles Strapi shares `apps/backend/dist`: the Strapi suite, a single Strapi file, `served-operations:write` and Playwright. All of these wait until the servers are stopped.
2. **The dependency.** `write-excel-file@4.1.1` and `read-excel-file@9.3.10` are added, pinned, to `apps/backend` only, by the plan that justifies them (D-12):
   - before the install, a `checkpoint:human-verify` for the transitive `saxen` (flagged `too-new`);
   - after the install, `pnpm why fflate` shows only 0.8.3 (GHSA-px8p-9vwx-vf98 affects 0.8.0–0.8.2);
   - the plan's first task is a typecheck tracer importing `write-excel-file/node` and `read-excel-file/universal` under Strapi's node10 module resolution.
3. **Fixtures.** The UAT's files (`rt-2-headers`, `rt-3-cp1252`, `is-1`, `is-2-roundtrip`) become byte fixtures, generated in the test from byte arrays where possible:
   - Windows-1252 bytes such as `0xE9`;
   - UTF-16LE with `FF FE`;
   - archives built with `write-excel-file`, or with `zlib` for the bomb, ZIP64 and `xl/vbaProject.bin` cases.

   This keeps binary blobs out of git. Only an encrypted-workbook fixture needs Excel or LibreOffice, which this machine lacks: commit one from another machine, or rely on the CFB-marker unit test.
4. **Excel is not available.** No automated proof opens a file in Excel. The oracle for "arrives as text" is structural:
   - XLSX: the cell is a shared string, the sheet has no `<f>`, and the reader returns a string;
   - CSV: the field is quoted and marked.
5. **The download event.** Playwright arms `page.waitForEvent('download')` before clicking Export (precedent: `administration-workflow.spec.ts:339`), asserts `suggestedFilename()`, then reads the saved file's first bytes (`EF BB BF` or `PK`).
6. **Windows Vitest** can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.
7. **The base changes first.** Phases 10 to 16 execute before Phase 19 and change the files this phase edits: Phase 10's reasons and time zone, Phase 11's list columns and filters, Phase 13's assignee, Phase 14's file transfer, and Phase 16's active-risk filter. Re-run the plan check before executing.

---

## Sampling Rate

- **After every task commit:**
  - run the touched web test files by path;
  - run `typecheck` when types change, and `api:check` after any spec change;
  - run the touched Strapi files by path, dev servers stopped.
- **After every plan wave:**
  - run the full web suite, `typecheck` and `api:check`;
  - run the full Strapi suite after every plan that edits Strapi (19-02 to 19-07);
  - run each UI plan's targeted Playwright specs once at its end (19-03, 19-08, 19-09).
- **Before `/gsd-verify-work`:** the full suite must be green. That is the phase gate above (plan 19-10), recorded with counts, duration, the flaky count and the clean `git status`.
- **Max feedback latency:** 120 seconds at task level. The production-build E2E runs only at plan level.

---

## Requirement, Finding and Decision Map

Each row names the proof, whether its file exists, and its state. Strapi files are named by their compiled `.js` form for the quick run; web paths are under `apps/csrm`.

| Req / Finding / Decision | Behaviour to verify | Test type | Automated command / proof | File exists? | Status |
|--------------------------|--------------------|-----------|---------------------------|--------------|--------|
| CSV-01 (3) · D-11 · criterion 1 | Every trigger (`=`, `+`, `-`, `@`, tab, CR, LF), the full-width forms and the leading-whitespace forms are marked; quote-runs before a trigger are marked; numbers and dates are never marked; `strip(mark(v)) === v` over the corpus (`'=x`, `''=x`, ` =x`, `＝x`, `-5`, `- n/a`) | Strapi unit | quick run `spreadsheet-neutralise.unit.test.js` | ❌ W0 | ⬜ pending |
| CSV-01 (3) · D-08 | CSV: BOM, CRLF, every text cell quoted, doubled quotes, header labels, no title rows. XLSX: string cells (shared strings), no `<f>` anywhere, frozen bold header, widths, About sheet last, `d mmm yyyy` dates at the local calendar date. Written, then read back | Strapi unit | quick run `spreadsheet-writers.unit.test.js` | ❌ W0 | ⬜ pending |
| CSV-01 (1) · D-05 · D-06 · D-07 · criterion 1 | Each of the 13 list views plus the reports: the export equals the list across all pages (filters, search, sort, canonical column order, visible default, chosen columns, readable-only columns); labels (Released for `approved`); empty cells; Yes/No; local dates via `timeZone`, with a UTC fallback named in About; due state from the list projection (G-16) | Strapi integration | quick run `exports.integration.test.js` (files read back with the reader and `csv-parse`) | ❌ W0 | ⬜ pending |
| CSV-01 (1) · D-10 | File names `{view}-{local date}.{ext}` and `{assessment number}-risk-assessment-{date}.xlsx`; `Content-Disposition` with `filename` and `filename*`; content type; `nosniff`; `no-store` | Strapi integration + web unit | quick run `exports.integration.test.js`; `vitest run src/lib/files` | ❌ W0 | ⬜ pending |
| CSV-01 (2) · D-13 · D-16 · criterion 2 | Per new operation, the six-actor row (owner, other, analyst, serviceAgent, noIdentity, noToken):<br>- another Requestor's released assessment: 404;<br>- own unreleased: 404;<br>- a Requestor at an analyst export: 403;<br>- service agent at every export, own-record ones included: 403;<br>- analyst My-list export: own records only;<br>- no identity: 403. | Strapi integration + matrix | quick run `authorization-matrix.integration.test.js`, `exports.integration.test.js` | ✅ (extended) / ❌ W0 | ⬜ pending |
| CSV-01 (2) · D-14 · D-15 | One released predicate serves the detail, risks, control implementations, export and report read. An analyst export of an unreleased assessment gets 409 with its closed reason. Both actors get the same file content | Strapi unit + integration | quick run `assessment-workflow.integration.test.js`, `exports.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| CSV-01 · D-16 · D-17 | A filter, sort, column, format or `timeZone` outside the closed vocabulary gets 400. Over 10,000 rows gets the closed reason with the count and the cap, and no file. The cap is enforced after the count too (`limit: cap + 1`) | Strapi unit + integration | quick run `exports.integration.test.js`, `export-cap.unit.test.js` | ❌ W0 | ⬜ pending |
| CSV-01 (4) · D-18 | One JSON log line per export (time, actor `documentId` and name, view, format, columns, parsed filters, search and sort, `timeZone`, count, outcome or refusal reason) and per import commit (actor, collection, file name, digest, counts). Never a cell value or raw query. The sink is injectable | Strapi unit + integration | quick run `security-event-log.unit.test.js`, `exports.integration.test.js`, `administration.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| CSV-01 · D-02 · D-03 | The spec declares binary responses (`text/csv`, XLSX) with JSON errors; `api:generate` and a clean `api:check`; the parity guard's file-response mode; the operation chain; served inventory rows for the two reserved URLs now served; byte-identical catalogue copies; the catalogue moves of `function.risk_register.risk_register.api.04` and `function.reports.reports.api.03` into human-only API Functions | Web unit + Strapi integration + static | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`, `analyst-insight-routes.unit.test.js`; `api:check`; `cmp` of the catalogue copies | ✅ (extended) | ⬜ pending |
| CSV-01 · route order (Research Pitfall 1) | `GET …/export` reaches the export handler, not the `/:id` detail, for every list with a detail route | Strapi integration | quick run `exports.integration.test.js` (`Content-Type` of the response) | ❌ W0 | ⬜ pending |
| CSV-01 · D-19 · D-20 | The Server Action returns `{ fileName, contentType, bytes: Uint8Array }` or a closed refusal. The service validates type, name, size and signature. Dialog: default visible columns, Select all and Reset, the cap warning disables Export, empty disables, pending spinner, success toast with name and count, refusal kept in the dialog with choices kept, focus starts on format and returns to the button, phone sheet | Web unit | `vitest run src/components/csrm/export src/lib/files src/features/risks src/features/assessments` | ❌ W0 | ⬜ pending |
| D-07 (G-13) | Strapi's label vocabulary per family equals the web's one status mapping (`status-badge.tsx`, `request-domain.ts`, `risk-domain.ts`, `alert-presentation.ts`) | Web unit | `vitest run src/features/export-label-parity.test.ts` | ❌ W0 | ⬜ pending |
| CSV-01 (4) · D-23 · D-24 · criterion 6 | Both report routes render from the shared released loader. An unreleased or unreadable assessment gets the in-shell not-found. Header, sections, risks overview and detail, AI disclosure and generation date. Print media hides the shell and toolbar; tables repeat headers; nothing is clamped | Web unit + E2E | `vitest run src/features/assessments/released-report.test.tsx`; `test:e2e e2e/exports-and-imports.spec.ts` (print emulation; Chromium `page.pdf({ format: 'A4' })` ≥ 1 page) | ❌ W0 | ⬜ pending |
| CSV-02 (1) · D-27 · criterion 3 | Headers by field name or display label (case, spaces, `_`, `-`, NFKC); "Name" and "Internet facing" match. Unknown columns are warned by name; `Issues` and read-only columns get an informational note. Two headers mapping to one field are refused naming both; a missing required column is refused naming its label | Strapi unit | quick run `spreadsheet-headers.unit.test.js` | ❌ W0 | ⬜ pending |
| CSV-02 (2) · D-25 · D-26 · criterion 3 | Accepted: UTF-8 with and without a BOM; XLSX first sheet (cached values).<br>Refused with closed reasons and safe details: Windows-1252 (`rt-3-cp1252`); UTF-16; semicolon; tab; `.xls`; macro-enabled; encrypted; ZIP64; over-entries; the decompression bomb (50 MiB budget, `ERR_BUFFER_TOO_LARGE`).<br>Bounds unchanged: 5 MiB, 5,000 rows, 64 KiB per record. A single-column `Name` file is accepted | Strapi unit | quick run `spreadsheet-reading.unit.test.js` | ❌ W0 | ⬜ pending |
| CSV-02 (2) · D-28 · D-29 | Flags: Yes/No, Y/N, TRUE/FALSE in any case, plus XLSX booleans. Enums case-insensitive. Trim once (reader `trim: false`). `#CLEAR` empties an optional field on update, is an issue on a required field, and equals blank on create. The mark before a trigger is stripped. The example row is skipped with a note. Number cells in text columns are stringified | Strapi unit + integration | quick run `spreadsheet-values.unit.test.js`, `administration.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| CSV-02 (3) · D-31 | Templates from Strapi, CSV and XLSX, per collection: display-label headers; one example row with the reserved key; XLSX Notes sheet (label, API name, required, format and allowed values, flag spellings, `#CLEAR`, blank behaviour); text columns `@`-formatted | Strapi integration | quick run `administration.integration.test.js` | ✅ (extended) | ⬜ pending |
| CSV-02 (3) · D-32 · criterion 4 | The error report in the upload's format: the original header as typed, then every row not imported, verbatim and neutralised, with `Issues` (labels and original row number), and a BOM for CSV. Built only from the file plus the server's preview or result record (actor- and collection-bound). Imported and skipped-similar rows are excluded. Corrected and re-imported: `Issues` is ignored, and fixed rows create or update | Strapi integration | quick run `administration.integration.test.js` | ✅ (extended) | ⬜ pending |
| D-33 | A reference-list export (template columns plus read-only columns), edited and imported again, updates by natural key; the read-only columns are noted, not warned | Strapi integration | quick run `administration.integration.test.js`, `exports.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| CSV-03 · D-30 · criterion 5 | "uat-b: core customer billing system" against "UAT-B: Core customer billing system" classifies `similar` with the existing name. A commit with a missing decision is refused. `update` keeps the existing name and applies the other values; `skip` leaves the record unchanged. Drift is rejected. Two matching rows in one file stay `ambiguous`. A create is never offered | Strapi unit + integration | quick run `administration.unit.test.js`, `administration.integration.test.js` | ✅ (extended) | ⬜ pending |
| CSV-02 · CSV-03 (UI) · D-25 | The import accepts `.csv` and `.xlsx`, checks only extension, type and 5 MiB in the browser, and keeps `csv-parse` out of the import route's bundle. Fix-it messages come through the refusal-copy module. Header warnings show. Similar decisions work per row and in bulk ("Continue to confirmation" needs every choice). Template and error-report downloads at Review and Results | Web unit + E2E | `vitest run src/features/administration`; the changed `administration-workflow.spec.ts` | ✅ (changed) | ⬜ pending |
| Criteria 1–6 (journeys) · D-39 | Each journey runs at 1440 and 375:<br>1. Bob filters the register and exports XLSX (name, type, `PK`), and a CSV with the seeded `=HYPERLINK(…)` value arrives quoted and marked.<br>2. Jane exports her released assessment; the Secondary Requestor gets not-found, and the operation refuses 404.<br>3. Bob imports the `Name` file with an extra column (warning), and gets the Windows-1252 fix-it.<br>4. Bob downloads the error report, corrects it and re-imports it.<br>5. A lower-case duplicate is held, then decided.<br>6. The report prints A4. | E2E | `pnpm --filter @csrm/web test:e2e e2e/exports-and-imports.spec.ts` | ❌ W0 | ⬜ pending |
| D-01 · G-6 | Both contract-gap records exist and carry the pilot's approval before any spec or catalogue change | static + checkpoint | `test -f docs/contract-gaps/phase-19-exports-and-export-log.md && test -f docs/contract-gaps/phase-19-import-tolerance.md && grep -n "Approved" docs/contract-gaps/phase-19-*.md` | ❌ W0 | ⬜ pending |
| Non-negotiables | No content-type change; no web dependency; no Route Handler; no raw `fetch`; Keycloak untouched; the tree clean after Playwright | static + suites | The phase gate checks above; `contract-operation-chain.test.ts` (no raw `fetch`, no unlisted operation) | ✅ | ⬜ pending |

---

## Per-Task Verification Map

Seed rows, one per proposed plan, serialised by shared files (D-40). The planner replaces them with one row per task (`19-NN-MM`), each citing its plan's threat register (`T-19-NN`). Commands abbreviate `pnpm --filter @csrm/web exec vitest run` as `vitest run`, the Strapi single-file run as `quick run`, and `pnpm --filter @csrm/web test:e2e` as `test:e2e`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | CSV-01, CSV-02, CSV-03 (records) | T-19-01 | No spec, catalogue or import-contract change before the pilot approves both records (G-6) | static + checkpoint | `grep -n "Approved" docs/contract-gaps/phase-19-exports-and-export-log.md docs/contract-gaps/phase-19-import-tolerance.md` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | CSV-01 (3), CSV-02 (2) | T-19-02, T-19-SC | Pinned dependency in Strapi only; `saxen` human-verified; `fflate` 0.8.3; invertible neutraliser; bounded reading (encoding, zip guard, rows, records); no formula ever written | Strapi unit + checkpoint | quick run `spreadsheet-neutralise.unit.test.js`, `spreadsheet-writers.unit.test.js`, `spreadsheet-reading.unit.test.js`, `spreadsheet-headers.unit.test.js`, `spreadsheet-values.unit.test.js`; `pnpm --filter @csrm/strapi why fflate` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 2 | CSV-01 | T-19-03 | Tracer: the Risk register export end to end, through:<br>- the export grant, the underlying read and the agent refusal;<br>- the cap, the log line and the file headers;<br>- the reserved URL, served;<br>- the file-response parity mode;<br>- the Server Action bytes, the dialog primitive and the save helper. | Strapi integration + matrix + web | quick run `exports.integration.test.js`, `authorization-matrix.integration.test.js`, `security-event-log.unit.test.js`, `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `vitest run src/components/csrm/export src/lib/files src/features/contract-response-parity.test.ts`; `api:check` | ❌ W0 / ✅ | ⬜ pending |
| 19-04-01 | 04 | 3 | CSV-01 | T-19-04 | Analyst list exports (Requests with Phase 13's assignee and filters, Questionnaires, Risk assessments, Alerts) are human-analyst only, list-scoped and route-ordered; the label vocabulary parity holds | Strapi integration + matrix + web | quick run `exports.integration.test.js`, `authorization-matrix.integration.test.js`; `vitest run src/features/export-label-parity.test.ts`; `api:check` | ❌ W0 / ✅ | ⬜ pending |
| 19-05-01 | 05 | 4 | CSV-01 | T-19-05 | The reports export at `POST /api/v1/reports/{reportKey}/export`: the report's own parser and windows; one sheet per table; human-analyst only; the insight route inventory updated | Strapi integration + matrix | quick run `exports.integration.test.js`, `analyst-reports.integration.test.js`, `analyst-insight-routes.unit.test.js`, `authorization-matrix.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| 19-06-01 | 06 | 5 | CSV-01 (2) | T-19-06 | Own-record exports (My requests, My questionnaires, My risk assessments) are owner-scoped for every actor. The released-assessment export goes through the one predicate: 404 for another Requestor and for own unreleased, 409 for an analyst on an unreleased assessment, 403 for the agent | Strapi integration + matrix + web | quick run `exports.integration.test.js`, `assessment-workflow.integration.test.js`, `authorization-matrix.integration.test.js`; `vitest run src/features/assessments src/features/requests src/features/questionnaires` | ✅ / ❌ W0 | ⬜ pending |
| 19-07-01 | 07 | 6 | CSV-02, CSV-03 | T-19-07 | Import hardening in Strapi:<br>- XLSX input;<br>- refusals with closed reasons;<br>- header warnings;<br>- value tolerance;<br>- the `similar` state and commit decisions;<br>- templates;<br>- server-authoritative error reports and the result record;<br>- reference-list exports;<br>- the import-commit log line. | Strapi unit + integration + matrix | quick run `administration.unit.test.js`, `administration.integration.test.js`, `exports.integration.test.js`, `authorization-matrix.integration.test.js`; `api:check` | ✅ (extended) | ⬜ pending |
| 19-08-01 | 08 | 7 | CSV-02, CSV-03 | T-19-08 | The web import flow: the client parser retired, the fix-it copy, warnings, similar decisions, server downloads; the Export action on the reference lists | Web unit + E2E | `vitest run src/features/administration src/lib/api`; `test:e2e e2e/administration-workflow.spec.ts` | ✅ (changed) | ⬜ pending |
| 19-09-01 | 09 | 8 | CSV-01 (4) | T-19-09 | The report routes are gated by the released loader (not-found otherwise); the print layout; Export and "Print report" on both released views | Web unit + E2E | `vitest run src/features/assessments/released-report.test.tsx`; `test:e2e e2e/exports-and-imports.spec.ts --project desktop` | ❌ W0 | ⬜ pending |
| 19-10-01 | 10 | 9 | CSV-01, CSV-02, CSV-03 | T-19-10 | The six success-criterion journeys at both widths; the full gate on the production build; a clean tree; the freeze and `cmp` checks | E2E + full suites | `pnpm --filter @csrm/web test:e2e`; the full suite commands; `git status --short` | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/tests/spreadsheet-neutralise.unit.test.ts`: the trigger corpus and the invertibility property (owned by 19-02).
- [ ] `apps/backend/tests/spreadsheet-writers.unit.test.ts`: the CSV and XLSX writers, read back (19-02).
- [ ] `apps/backend/tests/spreadsheet-reading.unit.test.ts`, with generated byte fixtures: the UAT files, Windows-1252, UTF-16, semicolon and tab, the bomb, ZIP64, vbaProject, the `.xls` header and the encrypted CFB marker (19-02).
- [ ] `apps/backend/tests/spreadsheet-headers.unit.test.ts` and `apps/backend/tests/spreadsheet-values.unit.test.ts` (19-02).
- [ ] `apps/backend/tests/security-event-log.unit.test.ts` and `apps/backend/tests/export-cap.unit.test.ts` (19-03).
- [ ] `apps/backend/tests/exports.integration.test.ts`, plus a file read-back helper in `apps/backend/tests/helpers/` (19-03).
- [ ] `apps/csrm/src/components/csrm/export/*.test.tsx` and `apps/csrm/src/lib/files/*.test.ts` (19-03).
- [ ] `apps/csrm/src/features/export-label-parity.test.ts` (19-04).
- [ ] `apps/csrm/src/features/assessments/released-report.test.tsx` (19-09).
- [ ] `apps/csrm/e2e/exports-and-imports.spec.ts` (19-09 creates it; 19-10 completes it).
- [ ] Dependency install, Strapi only, pinned: `pnpm --filter @csrm/strapi add write-excel-file@4.1.1 read-excel-file@9.3.10 --save-exact`, after the `saxen` checkpoint (19-02).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Excel save-and-reopen with the neutraliser mark (optional; informs D-11's mark choice before files circulate) | CSV-01 (3) | Excel is not installed in the execution environment; OWASP's caveat concerns Excel's own behaviour | On a machine with Excel, open the exported CSV and XLSX containing `=HYPERLINK("https://example.test","Click")`:<br>1. Confirm that neither evaluates as a formula.<br>2. Save the CSV as CSV, close it and reopen it. Record whether the cell is still text.<br>3. Repeat with a hand-made CSV using OWASP's tab variant (`"\t=1+2"`).<br>4. Re-import both into CSRM and confirm that the stored value is unchanged.<br>Record the result in `phase-19-exports-and-export-log.md`. |
| The error report "reopens in Excel" (criterion 4), in Excel itself | CSV-02 (3) | The automated proof reads the file with the same libraries and `csv-parse`, not Excel | Optional pilot check: open the CSV (UTF-8 BOM) and the XLSX error reports in Excel, correct a row, save in the same format, and import. Automated coverage: `administration.integration.test.js` and `exports-and-imports.spec.ts` |

*Every other phase behaviour has automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
