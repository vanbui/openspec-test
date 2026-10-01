---
phase: "19"
slug: "csv-export-and-import-hardening"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-01"
updated: "2026-10-01"
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-10-01 from `19-RESEARCH.md`, "Validation Architecture", and rebuilt by the planner for the final fifteen plans. It maps every requirement, finding and decision to an automated proof:
- the three requirements: CSV-01, CSV-02 and CSV-03;
- the three findings: UAT-049, UAT-051 and UAT-052;
- the six ROADMAP success criteria;
- the locked decisions D-01 to D-41 in `19-CONTEXT.md` and its Orchestrator Confirmations.

**How the maps are filled.**
- **Per-task map:** one row per task (`19-NN-MM`), taken from each task's `<automated>` verify block, citing its plan's threat register (`T-19-NN`). Every plan also carries `T-19-SC`.
- **Plan numbering (research seed → final):** seed 19-01 → 19-01 (records); seed 19-02 (shared modules) → 19-02 (reasons and words) and 19-03 (spreadsheet modules and the dependency); seed 19-03 (register tracer) → 19-04 (pipeline and vocabulary), 19-05 (register served) and 19-06 (register in the web and the export UI); seed 19-04 (analyst lists) → 19-07 (requests) and 19-08 (questionnaires and alerts); seed 19-05 (reports) → 19-09; seed 19-06 (own-record and released) → 19-07, 19-08 and 19-10 (the one released-assessment check); seed 19-07 (import in Strapi) → 19-13 (tolerance and decisions) and 19-14 (templates, error reports, reference exports); seed 19-08 (web import) → 19-15; seed 19-09 (report routes) → 19-11 (web list exports) and 19-12 (released export and print); seed 19-10 (gate) → 19-15 Task 4.
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
- **Status:** every status starts as ⬜ pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** Vitest 4.1.11 (jsdom) with Testing Library.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` into `.tmp/tests-dist`, one process and one SQLite database per test file. HTTP proofs go through `apps/backend/tests/helpers/strapi-http-harness.ts`. Its `request()` returns the raw `fetch` `Response`, so file bodies are read with `arrayBuffer()` (helpers in `apps/backend/tests/helpers/export-files.ts`, plan 19-05).<br>**E2E:** Playwright 1.58.2, Chromium, on the production build (`desktop` 1440×900; `mobile` 375×812, which lists `exports-and-imports.spec.ts` from plan 19-06). |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| **Node** | Every command in Git Bash starts with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm() { /c/ProgramData/nvm/v24.19.0/node /c/ProgramData/nvm/v24.19.0/node_modules/corepack/dist/pnpm.js "$@"; } &&` (POST-DEMO-BRIEF §4). The PATH default is Node 22.19.0, which the engines field (`>=24.19.0 <25`) refuses. |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <path> [<path> …]`, with paths under `apps/csrm`. Never put a pattern after `--`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts`. |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check` and `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts`. After a new or changed route, grant or web caller: `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (dev servers stopped). `cmp` of the two catalogue copies after every catalogue change. |
| **Full suite command** | `pnpm --dir apps/csrm api:check`; `pnpm --dir apps/csrm typecheck`; `pnpm --dir apps/csrm lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test` |
| **Phase gate** | Plan 19-15 Task 4: the full-suite commands, then `pnpm --dir apps/csrm test:e2e` (both projects, production build), with ports 1337 and 3000 free.<br>**Afterwards:**<br>- `git status --short` shows only the brief's three operator items (Phase 8 D-12; a dirty tree is a harness defect);<br>- `git diff --name-only PHASE_19_BASE..HEAD -- 'apps/backend/src/api/*/content-types/*'` prints nothing (D-01);<br>- `cmp` of the two catalogue copies is silent;<br>- `git diff PHASE_19_BASE..HEAD -- apps/csrm/package.json` is empty and `apps/backend/package.json` gains only `"write-excel-file": "4.1.1"` (D-12; `read-excel-file` came with 14-02);<br>- no changed path contains `keycloak`;<br>- both records carry `Approved by the pilot on YYYY-MM-DD (G-6)`;<br>- `apps/csrm/e2e/risk-owner-journey.spec.ts` is untouched (D-37);<br>- `COVERAGE.md` holds the API coverage declaration. |
| **Estimated runtime** | A web file takes under 20 s; a Strapi unit file 10–30 s, a Strapi integration file 30–120 s (`exports.integration.test.js` grows to several minutes by plan 19-14; the 10,001-row cap fixture is inserted with knex batches), and the authorization matrix 2–4 min. The full Strapi suite takes about 12–18 min and the full Playwright suite about 18–25 min. |

**Known infrastructure facts.**
1. **Shared `dist`.** The orchestrator's dev Strapi (1337) and Next (3000) may run during planning. Everything that compiles Strapi shares `apps/backend/dist` and `.tmp/tests-dist`: the Strapi suite, a single Strapi file, `served-operations:write` and Playwright. All of these wait until the servers are stopped, and the fifteen plans run one per wave (D-40).
2. **The dependency.** Plan 19-03 adds exactly `write-excel-file@4.1.1`, pinned, to `apps/backend` only, justified against D-12; its verify asserts `pnpm --dir apps/backend why fflate` shows only 0.8.3 (GHSA-px8p-9vwx-vf98 affects 0.8.0–0.8.2). `read-excel-file@9.3.10` and its `saxen` human-verify checkpoint belong to plan 14-02, so no Phase 19 install needs a blocking checkpoint (orchestrator constraint).
3. **Shared modules from Phase 14.** `csrm/files/zip-archive.ts` (14-02), `csrm/spreadsheets/xlsx-reader.ts` (14-02), `csrm/audit/security-event-log.ts` (14-03), `csrm/files/send-stored-file.ts` and the web `lib/files/file-response.ts` with the parity guard's file-response mode (14-07), and `lib/files/save-file.ts` (14-13) are reused and extended, never duplicated.
4. **Fixtures.** The UAT's files (`rt-2-headers` for Risk Types, `rt-3-cp1252`, `is-1`, `is-2-roundtrip`) become byte fixtures in `apps/backend/tests/helpers/spreadsheet-fixtures.ts` (plan 19-03), generated from bytes (Windows-1252 `0xE9`, UTF-16LE `FF FE`, archives built with `writeWorkbook` or `zlib` for the bomb, ZIP64 and `xl/vbaProject.bin` cases, a CFB header and an `EncryptedPackage` CFB). No binary blob is committed. Playwright generates its import files in the test's output directory.
5. **Excel is not available.** No automated proof opens a file in Excel. The oracle for "arrives as text" is structural: in XLSX the cell is a shared string, the sheet has no `<f>` and the reader returns the marked string; in CSV the field is quoted and marked.
6. **The download event.** Playwright arms `page.waitForEvent('download')` before activating `Export file` or a download button, asserts `suggestedFilename()`, then reads the saved file's first bytes (`EF BB BF` or `PK`).
7. **Windows Vitest** can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.
8. **The base changes first.** Phases 10 to 16 execute before Phase 19 and change the files this phase edits: Phase 10's reasons and time zone, Phase 11's list columns and filters, Phase 13's assignee and Assigned to me view, Phase 14's shared file modules, and Phase 16's active-risk filter and X-27 to X-29. Re-run the plan check before executing.

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` command (touched Vitest files by path; touched Strapi files by path with the dev servers stopped; `typecheck` when types change; `api:check` and `cmp` after any spec or catalogue change).
- **After every plan:** the full Strapi suite after each Strapi plan (19-02 to 19-05, 19-07 to 19-10, 19-13, 19-14 run it in their last task); the full web suite after each web plan (19-06, 19-11, 19-12, 19-15); each UI plan's Playwright specs at its end (19-06, 19-11, 19-12, 19-15).
- **Before `/gsd-verify-work`:** the phase gate above (plan 19-15 Task 4), recorded with counts, duration, the flaky count and the clean `git status`.
- **Max feedback latency:** 120 seconds at task level for unit files; integration files and the production-build E2E run at task end where the task owns them.

---

## Requirement, Finding and Decision Map

Each row names the proof, whether its file exists, and its state. Strapi files are named by their compiled `.js` form for the quick run; web paths are under `apps/csrm`.

| Req / Finding / Decision | Behaviour to verify | Test type | Automated command / proof | File exists? | Status |
|--------------------------|--------------------|-----------|---------------------------|--------------|--------|
| CSV-01 (3) · D-11 · criterion 1 | Every trigger, full-width and leading-whitespace form and quote-run is marked; numbers and dates never; `strip(mark(v)) === v` over the corpus | Strapi unit | quick run `spreadsheet-neutralise.unit.test.js` (19-03) | ❌ W0 | ⬜ pending |
| CSV-01 (3) · D-08 | CSV: BOM, CRLF, quoted text, header labels. XLSX: shared strings, no `<f>`, frozen bold header, `@` text, `d mmm yyyy`; written and read back | Strapi unit | quick run `spreadsheet-writers.unit.test.js` (19-03) | ❌ W0 | ⬜ pending |
| CSV-01 (1) · D-05 · D-06 · D-07 · D-09 · D-10 · D-17 | The pipeline: list parser, count, cap and its race, ids, batches, projection, chosen columns in canonical order, labels, empty cells, local dates with the UTC fallback, About sheet, file names and headers | Strapi unit | quick run `export-pipeline.unit.test.js` (19-04) | ❌ W0 | ⬜ pending |
| D-06 · D-07 · D-31 · D-33 (G-13) | One vocabulary, byte-identical web copy, label parity with the web's one mapping, visible labels equal the list headers, report tables equal the page's, import columns equal the contract | Strapi unit + web unit | quick run `export-vocabulary.unit.test.js`; `vitest run src/features/exports/export-vocabulary.test.ts` (19-04) | ❌ W0 | ⬜ pending |
| CSV-01 (4) · D-18 | `export.completed`, `export.refused`, `import.committed` lines with their fields, never a value or raw query | Strapi unit + integration | quick run `security-event-log.unit.test.js` (19-04), `exports.integration.test.js`, `administration.integration.test.js` | ✅ (14-03, extended) / ❌ W0 | ⬜ pending |
| CSV-01 (1) · criterion 1 · D-13 · D-16 · D-17 | The register export over HTTP: XLSX string cell, CSV marked field, route order, every refusal including the mis-granted agent, the missing read and 10,001 rows | Strapi integration + policy unit | quick run `exports.integration.test.js`, `authorization-policy.unit.test.js` (19-05) | ❌ W0 / ✅ | ⬜ pending |
| CSV-01 (2) · D-13 · D-16 | Six-actor matrix rows for all 22 operations; mirrors of `HUMAN_ANALYST_ONLY_OPERATIONS` and `SERVICE_IDENTITY_REFUSED_OPERATIONS` | Strapi integration | quick run `authorization-matrix.integration.test.js` (via the full suite; 19-05, 19-07 to 19-10, 19-14) | ✅ (extended) | ⬜ pending |
| CSV-01 (1) · D-04 · D-05 | Requests, My requests, Questionnaires, My questionnaires, Alerts, Reports, Risk assessments, My risk assessments and the four reference lists export whole in scope | Strapi integration | quick run `exports.integration.test.js` (19-07 to 19-10, 19-14) | ❌ W0 | ⬜ pending |
| CSV-01 (2) · criterion 2 · D-14 · D-15 · D-21 | One released-assessment check serves the three reads, My risk assessments, the analyst's `released` flag and the export; another Requestor 404, own unreleased 404, analyst unreleased 409, identical tables | Strapi unit + integration | quick run `released-assessment-read.unit.test.js`, `assessment-workflow.integration.test.js`, `exports.integration.test.js` (19-10) | ❌ W0 / ✅ | ⬜ pending |
| CSV-01 · D-02 · D-03 | Binary responses in the spec, `api:check`, the parity guard's file-response mode, the chain guard, the served inventory with web callers, `cmp`, the two reserved entries moved | Web unit + Strapi integration + static | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`, `analyst-insight-routes.unit.test.js`, `analyst-insight-catalogue-seed.integration.test.js`; `api:check`; `cmp` | ✅ (extended) | ⬜ pending |
| D-03 group 4 · D-16 · D-26 | The 19 reason codes equal on four lists; `rowCount`/`rowCap` and `found` kept only beside their reasons; family S copy | Strapi unit + web unit | quick run `conflict-reasons.unit.test.js`; `vitest run src/lib/api` (19-02) | ✅ (extended) | ⬜ pending |
| CSV-01 · D-19 · D-20 | Typed services, Server Actions, `exportFileRule`; the dialog's states, column choice, cap warning, pending, refusal with choices kept, focus, phone sheet, remembered format | Web unit | `vitest run src/lib/files src/features/exports src/components/csrm/export` (19-06, 19-11) | ❌ W0 | ⬜ pending |
| CSV-01 (4) · criterion 6 · D-23 · D-24 | Both report routes from the shared loader; not-found for unreleased or unreadable; the X-31 document and print rules; analyst actions only once released | Web unit + E2E | `vitest run src/features/assessments`; `test:e2e e2e/exports-and-imports.spec.ts` (print emulation; Chromium A4 PDF ≥ 1 page) (19-12) | ❌ W0 | ⬜ pending |
| CSV-02 (1) · criterion 3 · D-27 | Headers by field or label, unknown columns warned, `Issues` and read-only columns noted, duplicate and missing columns refused naming them | Strapi unit + integration | quick run `spreadsheet-headers-values.unit.test.js` (19-03), `administration.integration.test.js` (19-13) | ❌ W0 / ✅ | ⬜ pending |
| CSV-02 (2) · criterion 3 · D-25 · D-26 | Accepted CSV and XLSX; Windows-1252, UTF-16, unknown bytes, delimiters, `.xls`, macro, encrypted, ZIP64, entry flood and bomb refused with closed reasons; the 5 MiB and 5,000-row bounds; long rows rejected as rows | Strapi unit + integration | quick run `spreadsheet-reading.unit.test.js` (19-03), `administration.integration.test.js` (19-13) | ❌ W0 / ✅ | ⬜ pending |
| CSV-02 (2) · D-28 · D-29 | Flags, enums, `#CLEAR`, mark stripping, example row, number cells in text columns | Strapi unit + integration | quick run `spreadsheet-headers-values.unit.test.js`, `administration.unit.test.js`, `administration.integration.test.js` (19-03, 19-13) | ❌ W0 / ✅ | ⬜ pending |
| CSV-03 · criterion 5 · D-30 | `similar` with the existing name; decisions required; update keeps the name; skip leaves the record; drift; ambiguous within a file; no create offered | Strapi unit + integration | quick run `administration.unit.test.js`, `administration.integration.test.js` (19-13) | ✅ (extended) | ⬜ pending |
| CSV-02 (3) · criterion 4 · D-31 · D-32 · D-33 | Templates (CSV and XLSX with Notes); error reports from server records only at Review and Results; corrected report re-imports; reference export round trip | Strapi integration | quick run `administration.integration.test.js`, `exports.integration.test.js` (19-14) | ✅ (extended) / ❌ W0 | ⬜ pending |
| CSV-02 · CSV-03 (UI) · D-25 · D-30 | The flow reads nothing in the browser; S2 refusals; warnings and notes; similar decisions per row and in bulk with Undo; the gate; downloads at Review and Results; the sixth badge | Web unit | `vitest run src/features/administration src/components/csrm/status-badge.test.tsx` (19-15) | ✅ (changed) | ⬜ pending |
| Criteria 1–6 (journeys) · D-16 · D-39 | At 1440 and 375: register XLSX and CSV with the `=` value; a Requestor sees no analyst export; report and My-list exports; Jane's released export and the Secondary Requestor's not-found; the A4 print; import tolerance; error report round trip; similar name held | E2E | `pnpm --dir apps/csrm test:e2e e2e/exports-and-imports.spec.ts e2e/administration-workflow.spec.ts` (19-06, 19-11, 19-12, 19-15) | ❌ W0 / ✅ | ⬜ pending |
| D-01 · G-6 | Both records exist and carry the pilot's approval before any contract change | static + checkpoint | greps in 19-01 Tasks 1 and 3; preconditions in 19-02, 19-05; the gate re-checks | ❌ W0 | ⬜ pending |
| Non-negotiables | No content-type change; no web dependency; no Route Handler; no raw `fetch`; Keycloak untouched; the tree clean after Playwright; no post-demo journey slice | static + suites | the phase gate; `contract-operation-chain.test.ts` | ✅ | ⬜ pending |

---

## Per-Task Verification Map

`quick run` is the Strapi single-file run; `full Strapi` is `pnpm --dir apps/backend test`; `full web` is `pnpm --dir apps/csrm test` with `typecheck` (and `lint` where the task runs it); `vitest run` is `pnpm --dir apps/csrm exec vitest run`; `test:e2e` is `pnpm --dir apps/csrm test:e2e`. Every plan also accepts or mitigates `T-19-SC`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behaviour | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|------------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | CSV-01, CSV-02, CSV-03 | T-19-01 | X-30 to X-32 and both records written, awaiting approval | static | greps for the three direction labels, the refusal set, the predicate module, `ASSESSMENT_NOT_RELEASED`, `X-CSRM-Row-Count`, `#CLEAR`, `similar`, both dated notes and both awaiting lines | ✅ (docs) | ⬜ pending |
| 19-01-02 | 01 | 1 | CSV-01, CSV-02, CSV-03 | T-19-01 | The pilot approves before any contract change (G-6) | checkpoint (blocking-human) | — (`git diff --name-only PHASE_19_BASE -- apps docs/references` prints nothing) | — | ⬜ pending |
| 19-01-03 | 01 | 1 | CSV-01, CSV-02, CSV-03 | T-19-02 | Dated approvals recorded | static | greps for both dated approval lines and no awaiting line | ✅ (docs) | ⬜ pending |
| 19-02-01 | 02 | 2 | CSV-01 | T-19-03 | Row limit carried with its count only beside its reason | contract + web unit + Strapi unit | `api:check`; `vitest run src/lib/api/conflict-reasons.test.ts src/lib/api/transport/server-client.test.ts src/lib/api/refusal-copy.test.ts`; `typecheck`; quick run `conflict-reasons.unit.test.js` | ✅ (extended) | ⬜ pending |
| 19-02-02 | 02 | 2 | CSV-01, CSV-02, CSV-03 | T-19-03, T-19-04 | 19 codes equal on four lists; closed `found`; family S copy | contract + web unit + Strapi unit | `api:check`; `vitest run src/lib/api`; `typecheck`; `lint`; quick run `conflict-reasons.unit.test.js` | ✅ (extended) | ⬜ pending |
| 19-02-03 | 02 | 2 | CSV-01, CSV-02 | T-19-03 | Family S vocabulary guarded | web + Strapi suites | full web; full Strapi | ✅ | ⬜ pending |
| 19-03-01 | 03 | 3 | CSV-01 | T-19-05, T-19-SC | One neutraliser; no formula written; `write-excel-file` pinned; `fflate` 0.8.3 | Strapi unit + install check | `pnpm --dir apps/backend why fflate` check; `tsc --noEmit`; quick run `spreadsheet-neutralise.unit.test.js`, `spreadsheet-writers.unit.test.js` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 3 | CSV-02 | T-19-06, T-19-07, T-19-08, T-19-09 | Bounded reader; every file refusal closed | Strapi unit | quick run `spreadsheet-reading.unit.test.js`, `zip-archive.unit.test.js`, `attachment-extraction.unit.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 19-03-03 | 03 | 3 | CSV-02 | T-19-05 | Headers by field or label; tolerant values; `#CLEAR` | Strapi unit | quick run `spreadsheet-headers-values.unit.test.js` | ❌ W0 | ⬜ pending |
| 19-03-04 | 03 | 3 | CSV-01, CSV-02 | T-19-05 | The import takes the moved neutraliser; nothing regresses | Strapi suite | `tsc --noEmit`; full Strapi; trigger-pattern grep | ✅ | ⬜ pending |
| 19-04-01 | 04 | 4 | CSV-01 | T-19-10, T-19-12, T-19-13 | A register export through one pipeline with one log line; no due-state logic | Strapi unit | `tsc --noEmit`; quick run `export-pipeline.unit.test.js`, `security-event-log.unit.test.js`, `risk-register.unit.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 19-04-02 | 04 | 4 | CSV-01, CSV-02 | T-19-10 | One vocabulary; label, header and report parity; import columns equal the contract | Strapi unit + web unit | `cmp` of the vocabulary copies; `vitest run src/features/exports/export-vocabulary.test.ts`; `typecheck`; quick run `export-vocabulary.unit.test.js` | ❌ W0 | ⬜ pending |
| 19-04-03 | 04 | 4 | CSV-01 | T-19-11, T-19-14 | Zones, About sheet, CSV, cap race, closed controls, hardened file response | Strapi unit + suite | `tsc --noEmit`; full Strapi | ❌ W0 | ⬜ pending |
| 19-05-01 | 05 | 5 | CSV-01 | T-19-16, T-19-17 | Register export served at its reserved URL; route order; reserved entry moved | Strapi integration + contract | `api:check`; `cmp`; quick run `exports.integration.test.js`, `served-operations.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 19-05-02 | 05 | 5 | CSV-01 | T-19-15, T-19-16, T-19-18 | Service identity refused whatever it holds; underlying read required; 400, 403, 422 cases | policy unit + Strapi integration | quick run `authorization-policy.unit.test.js`, `exports.integration.test.js`, `authorization.integration.test.js` | ✅ / ❌ W0 | ⬜ pending |
| 19-05-03 | 05 | 5 | CSV-01 | T-19-15 | Matrix row; both refusal-set mirrors; catalogue proof | Strapi suite + contract | `cmp`; `api:check`; full Strapi | ✅ (extended) | ⬜ pending |
| 19-06-01 | 06 | 6 | CSV-01 | T-19-19, T-19-20, T-19-22 | Bytes validated (type, name, size, signature) and saved under the server's name; no Route Handler | web unit | `vitest run src/lib/files src/features/risks/risk-service.test.ts src/features/exports src/components/csrm/export`; `typecheck`; `lint` | ❌ W0 / ✅ | ⬜ pending |
| 19-06-02 | 06 | 6 | CSV-01 | T-19-19 | Dialog states: columns, empty, over the limit, pending, refusal, focus, phone sheet, format memory | web unit | `vitest run src/components/csrm/export src/features/exports`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 19-06-03 | 06 | 6 | CSV-01 | T-19-22 | Parity file-response registration; served web caller; copy guard | web unit + inventory | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts src/lib/performance/interface-copy-guard.test.ts`; full web | ✅ (extended) | ⬜ pending |
| 19-06-04 | 06 | 6 | CSV-01 | T-19-21 | Criterion 1 at both widths; a Requestor sees no register export | E2E | `test:e2e e2e/exports-and-imports.spec.ts e2e/performance.spec.ts e2e/design-contract.spec.ts`; clean `git status` | ❌ W0 | ⬜ pending |
| 19-07-01 | 07 | 7 | CSV-01 | T-19-25 | The review queue exports whole, human-only with its read | Strapi integration + contract | `api:check`; `cmp`; quick run `exports.integration.test.js`, `review-queue-buckets.integration.test.js` | ✅ | ⬜ pending |
| 19-07-02 | 07 | 7 | CSV-01 | T-19-23, T-19-24 | My requests own records only for every actor; agent refused | Strapi integration + contract | `api:check`; `cmp`; quick run `exports.integration.test.js`, `my-requests.integration.test.js` | ✅ | ⬜ pending |
| 19-07-03 | 07 | 7 | CSV-01 | T-19-24, T-19-25 | Refusals and both matrix rows | Strapi suite + contract | `cmp`; `api:check`; full Strapi | ✅ | ⬜ pending |
| 19-08-01 | 08 | 8 | CSV-01 | T-19-27 | Questionnaire review list exports whole, no answers in the file | Strapi integration + contract | `api:check`; `cmp`; quick run `exports.integration.test.js`, `questionnaire-workflow.integration.test.js` | ✅ | ⬜ pending |
| 19-08-02 | 08 | 8 | CSV-01 | T-19-26 | My questionnaires own records only | Strapi integration + contract | `api:check`; `cmp`; quick run `exports.integration.test.js` | ✅ | ⬜ pending |
| 19-08-03 | 08 | 8 | CSV-01 | T-19-28 | Alert list exports as derived (G-16); insight route inventory | Strapi integration + unit + contract | `api:check`; `cmp`; quick run `exports.integration.test.js`, `analyst-alerts.integration.test.js`, `analyst-insight-routes.unit.test.js` | ✅ | ⬜ pending |
| 19-08-04 | 08 | 8 | CSV-01 | T-19-26, T-19-28 | Refusals and three matrix rows | Strapi suite + contract | `cmp`; `api:check`; full Strapi | ✅ | ⬜ pending |
| 19-09-01 | 09 | 9 | CSV-01 | T-19-30, T-19-31 | Reports export at the reserved URL; entry moved; pinned tests updated | Strapi integration + unit + contract | `api:check`; `cmp`; quick run `exports.integration.test.js`, `analyst-reports.integration.test.js`, `contract-catalogue.integration.test.js`, `analyst-insight-routes.unit.test.js`, `analyst-insight-catalogue-seed.integration.test.js`, `served-operations.integration.test.js` | ✅ | ⬜ pending |
| 19-09-02 | 09 | 9 | CSV-01 | T-19-29, T-19-30 | Closed body, no `columns`, CSV tables, refusals | Strapi integration | quick run `exports.integration.test.js` | ✅ | ⬜ pending |
| 19-09-03 | 09 | 9 | CSV-01 | T-19-30 | Matrix row | Strapi suite + contract | `cmp`; `api:check`; full Strapi | ✅ | ⬜ pending |
| 19-10-01 | 10 | 10 | CSV-01 | T-19-32, T-19-33, T-19-34 | One released-assessment check; Jane's released export; the analyst's `released` flag | Strapi unit + integration + web unit + contract | `api:check`; `cmp`; `vitest run src/features/assessments src/features/contract-response-parity.test.ts`; `typecheck`; quick run `released-assessment-read.unit.test.js`, `assessment-workflow.integration.test.js`, `exports.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 19-10-02 | 10 | 10 | CSV-01 | T-19-32, T-19-33, T-19-35 | Another Requestor 404; own unreleased 404; analyst unreleased 409; identical tables; agent 403; gathered helpers gone | Strapi integration + static | quick run `exports.integration.test.js`, `assessment-workflow.integration.test.js`; source grep | ✅ | ⬜ pending |
| 19-10-03 | 10 | 10 | CSV-01 | T-19-35 | Assessment lists export in scope | Strapi integration + contract | `api:check`; `cmp`; quick run `exports.integration.test.js` | ✅ | ⬜ pending |
| 19-10-04 | 10 | 10 | CSV-01 | T-19-32, T-19-35 | Three matrix rows; released `other` 404 | Strapi suite + contract | `cmp`; `api:check`; full Strapi | ✅ | ⬜ pending |
| 19-11-01 | 11 | 11 | CSV-01 | T-19-36, T-19-37 | A report exports one CSV table from its page; no `columns` | web unit | `vitest run src/features/exports src/features/reports`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 19-11-02 | 11 | 11 | CSV-01 | T-19-36, T-19-37 | Every list exports from its page through typed services and actions; served web callers | web unit + inventory | `vitest run src/features/exports src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; full web; `typecheck`; `lint` | ❌ W0 / ✅ | ⬜ pending |
| 19-11-03 | 11 | 11 | CSV-01 | T-19-38 | Report and own-record exports in the browser; gated pages without a control | E2E | `test:e2e e2e/exports-and-imports.spec.ts`; clean `git status` | ✅ | ⬜ pending |
| 19-12-01 | 12 | 12 | CSV-01 | T-19-39, T-19-40 | Released view prints and exports through one loader | web unit | `vitest run src/features/assessments`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 19-12-02 | 12 | 12 | CSV-01 | T-19-40 | The X-31 document, its states and print rules | web unit + suite | `vitest run src/features/assessments src/lib/performance/interface-copy-guard.test.ts`; full web; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 19-12-03 | 12 | 12 | CSV-01 | T-19-40, T-19-41 | Analyst report and actions only once released | web unit | `vitest run src/features/assessments`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 19-12-04 | 12 | 12 | CSV-01 | T-19-39, T-19-41 | Criteria 2 and 6; the Secondary Requestor's not-found pages; axe; budgets | E2E | `test:e2e e2e/exports-and-imports.spec.ts e2e/performance.spec.ts e2e/design-contract.spec.ts e2e/accessibility.spec.ts`; clean `git status` | ✅ | ⬜ pending |
| 19-13-01 | 13 | 13 | CSV-02 | T-19-46 | One tolerant reader; Owner warned; Windows-1252 refused with its reason; web parsers | Strapi integration + web unit + contract | `api:check`; `vitest run src/features/administration/administration-schema.test.ts src/features/contract-response-parity.test.ts`; `typecheck`; quick run `administration.integration.test.js` | ✅ (extended) | ⬜ pending |
| 19-13-02 | 13 | 13 | CSV-02 | T-19-46 | Flags, `#CLEAR`, mark stripping, example row, long rows | Strapi unit + integration | quick run `administration.unit.test.js`, `administration.integration.test.js` | ✅ (extended) | ⬜ pending |
| 19-13-03 | 13 | 13 | CSV-03 | T-19-43, T-19-44, T-19-45, T-19-47 | Similar rows wait for a decision; drift; result record; `import.committed` | Strapi suite + web unit + contract | `api:check`; `vitest run src/features/administration src/features/contract-response-parity.test.ts`; `typecheck`; full Strapi | ✅ (extended) | ⬜ pending |
| 19-14-01 | 14 | 14 | CSV-02 | T-19-49 | Templates from the contract import back as they are | Strapi integration + contract | `api:check`; `cmp`; quick run `administration.integration.test.js` | ✅ (extended) | ⬜ pending |
| 19-14-02 | 14 | 14 | CSV-02 | T-19-48, T-19-51 | Error reports from server records only; criterion 4's corrected re-import | Strapi integration + contract | `api:check`; `cmp`; quick run `administration.integration.test.js` | ✅ (extended) | ⬜ pending |
| 19-14-03 | 14 | 14 | CSV-01, CSV-02 | T-19-49, T-19-50 | Reference exports round trip; 12 matrix rows | Strapi suite + contract | `cmp`; `api:check`; full Strapi | ✅ | ⬜ pending |
| 19-15-01 | 15 | 15 | CSV-02 | T-19-52, T-19-54 | The browser reads nothing; Strapi templates | web unit + static | `vitest run src/features/administration`; `typecheck`; `lint`; the CSV-parser grep | ✅ (changed) | ⬜ pending |
| 19-15-02 | 15 | 15 | CSV-02, CSV-03 | T-19-53, T-19-54 | S2 refusals; similar decisions with the gate and Undo; error reports; sixth badge | web unit + suite | `vitest run src/features/administration src/components/csrm/status-badge.test.tsx`; full web; `typecheck`; `lint` | ✅ (changed) | ⬜ pending |
| 19-15-03 | 15 | 15 | CSV-01, CSV-02, CSV-03 | T-19-53, T-19-54 | Reference-list Export; criteria 3 to 5 in the browser | web suite + E2E | full web; `typecheck`; `test:e2e e2e/exports-and-imports.spec.ts e2e/administration-workflow.spec.ts`; clean `git status` | ✅ | ⬜ pending |
| 19-15-04 | 15 | 15 | CSV-01, CSV-02, CSV-03 | T-19-55, T-19-SC | The phase gate and every static check | full suites + E2E + static | the phase gate command in 19-15 Task 4 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/tests/spreadsheet-neutralise.unit.test.ts`, `spreadsheet-writers.unit.test.ts`, `spreadsheet-reading.unit.test.ts`, `spreadsheet-headers-values.unit.test.ts` and `apps/backend/tests/helpers/spreadsheet-fixtures.ts` (owned by 19-03).
- [ ] `apps/backend/tests/export-pipeline.unit.test.ts` and `apps/backend/tests/export-vocabulary.unit.test.ts`; `apps/csrm/src/features/exports/export-vocabulary.test.ts` (19-04).
- [ ] `apps/backend/tests/exports.integration.test.ts` and `apps/backend/tests/helpers/export-files.ts` (19-05; extended by 19-07 to 19-10 and 19-14).
- [ ] `apps/csrm/src/components/csrm/export/export-dialog.test.tsx`, `apps/csrm/src/features/exports/export-actions.test.ts` and `apps/csrm/e2e/exports-and-imports.spec.ts` (19-06; the spec is extended by 19-11, 19-12 and 19-15).
- [ ] `apps/backend/tests/released-assessment-read.unit.test.ts` (19-10).
- [ ] `apps/csrm/src/features/exports/export-services.test.ts` (19-11).
- [ ] `apps/csrm/src/features/assessments/assessment-report.test.tsx` (19-12).
- [ ] Dependency install, Strapi only, pinned: `pnpm --dir apps/backend add write-excel-file@4.1.1 --save-exact` (19-03 Task 1), with the `fflate` 0.8.3 assertion.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Excel save-and-reopen with the neutraliser mark (Orchestrator Confirmations: listed for the pilot to run where Excel exists) | CSV-01 (3) | Excel is not installed in the execution environment; OWASP's caveat concerns Excel's own behaviour | On a machine with Excel, open the exported CSV and XLSX containing `=HYPERLINK("https://example.test","Click")`:<br>1. Confirm that neither evaluates as a formula.<br>2. Save the CSV as CSV, close it and reopen it. Record whether the cell is still text.<br>3. Repeat with a hand-made CSV using OWASP's tab variant (`"\t=1+2"`).<br>4. Re-import both into CSRM and confirm that the stored value is unchanged.<br>Record the result in `phase-19-exports-and-export-log.md`. |
| The error report "reopens in Excel" (criterion 4), in Excel itself | CSV-02 (3) | The automated proof reads the file with the same libraries and `csv-parse`, not Excel | Optional pilot check: open the CSV (UTF-8 BOM) and the XLSX error reports in Excel, correct a row, save in the same format, and import. Automated coverage: `administration.integration.test.js` (19-14) and `exports-and-imports.spec.ts` (19-15). |

*Every other phase behaviour has automated verification. The three UI Considerations backstops (a five-filter export dialog at 375px, a 200-character existing name in a decision label, a 25-risk A4 overview) are browser backstops for the orchestrator, recorded in plans 19-06, 19-15 and 19-12.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (19-01-02 is a blocking-human checkpoint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s for unit-level tasks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
