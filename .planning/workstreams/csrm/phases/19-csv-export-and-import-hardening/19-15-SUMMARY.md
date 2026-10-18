---
phase: 19-csv-export-and-import-hardening
plan: 15
subsystem: imports
tags: [administration-import, xlsx, file-refusals, similar-names, decisions, error-report, import-template, reference-list-export, capabilities, playwright, phase-gate, route-budgets]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-02: importFileRefusal, importStepRefusal, exportRefusal, TransportError.found; 19-04: importColumns; 19-06/19-11: ExportButton, ListExportButton, exportFileRule, the Export placement pattern; 19-13: IMPORT_CSV_MALFORMED, the preview and commit shapes, decisions, resultToken, the import-only import-row-status.tsx; 19-14: the 12 Administration file operations"
provides:
  - "csv-client-parser.ts: checkImportFileInBrowser only (.csv/.xlsx, 5 MB); the client CSV parser, neutraliser, template and report builders and the CSV download helper are gone; csv-parse leaves apps/csrm"
  - "import-flow-rules.ts: the flow's pure rules and sentence parts (Guidance, warnings, notes, decisions, gate, Confirm summary, Results tiles, error-report offers)"
  - "administration-service.ts: downloadImportTemplate, downloadImportErrorReport, exportReferenceList, decisions on the commit; 12 file responses registered"
  - "administration-actions.ts: downloadImportTemplateAction, downloadImportErrorReportAction, ImportRefusal (S2 file refusals, S3 step refusals), the closed decisions field"
  - "export-actions.ts: exportReferenceListAction (bound to the collection)"
  - "capabilities: risk-types:export, controls:export, information-systems:export, information-assets:export"
  - "csv-import-flow.tsx: S2/S3 alerts, warnings, notes, the similar panel, per-row decisions, bulk choices with Undo, the gate, the new-file guard, Strapi's templates and error reports"
  - "the reference-list header: Create {singular}, Import, Export {plural}"
  - "Playwright: import tolerance, error report round trip, similar name held @journey"
  - "COVERAGE.md"
affects: [phase-19-verification, post-phase-19-route-headroom-task]

actuals:
  tokens: 63475
  tasks: 4
  commits: 8

plan_head_before: 56e49d788c0a9de5f252c27e78c499d15573e059
plan_head_after: 80bf58e183ea47592fe551c345f2087c6a890ece

tech-stack:
  added: []
  removed: ["csv-parse 7.0.2 from apps/csrm (it stays in apps/backend)"]
  patterns:
    - "A refused import step returns { family: 'file', reason, title, body, steps } (S2) or { family: 'step', step, message, action } (S3) beside formError, worded only from the feature-only import-refusal-copy.ts"
    - "A decision radio group renders in both the desktop table and the phone card; the gate focuses the first one that is laid out (getClientRects), else the first in DOM order"
    - "A reference list's export is passed to the client workspace as a ReactNode from the server page, so the capability and read-success checks stay on the server"

key-files:
  created:
    - apps/csrm/src/features/administration/import-flow-rules.ts
    - .planning/workstreams/csrm/phases/19-csv-export-and-import-hardening/COVERAGE.md
  modified:
    - apps/csrm/src/features/administration/csv-import-flow.tsx
    - apps/csrm/src/features/administration/csv-client-parser.ts
    - apps/csrm/src/features/administration/administration-actions.ts
    - apps/csrm/src/features/administration/administration-service.ts
    - apps/csrm/src/features/administration/administration-workspace.tsx
    - apps/csrm/src/features/administration/administration-domain.ts
    - apps/csrm/app/(app)/app/admin/[collection]/page.tsx
    - apps/csrm/app/(app)/app/admin/[collection]/import/page.tsx
    - apps/csrm/src/features/exports/export-actions.ts
    - apps/csrm/src/features/exports/list-export-button.tsx
    - apps/csrm/src/components/csrm/export/export-button.tsx
    - apps/csrm/src/components/csrm/export/export-dialog.tsx
    - apps/csrm/src/lib/capabilities/capability-adapter.ts
    - apps/csrm/src/lib/capabilities/development-capabilities.ts
    - apps/csrm/src/lib/capabilities/strapi-capabilities.ts
    - apps/csrm/src/lib/files/save-file.ts
    - apps/csrm/package.json
    - pnpm-lock.yaml
    - docs/references/served-operations.json
    - apps/csrm/e2e/exports-and-imports.spec.ts
    - apps/csrm/e2e/administration-workflow.spec.ts

key-decisions:
  - "The import flow's `{singular}` and `{plural}` in running text use the collection's running labels (control, information system), as Phase 10's Guidance sentence does; Risk Type keeps its capitals"
  - "An empty upload is refused before any request as S2 IMPORT_NO_HEADER (Strapi's reader refuses it the same way); a wrong extension or a file over 5 MB is S2 in the browser and again in the Server Action"
  - "A malformed commit decisions field is refused before the request with S3 decision-missing; Strapi re-checks every decision against its preview"
  - "Confirm stays enabled when every similar row is decided Skip and nothing else is written: the commit then records the person's own skips (Results show Skipped by you)"
  - "The reference-list export sends the admin list's own serialised query (its filters included) without page and page size, exactly as the list read sends it, so the file holds what the filtered list shows; the action refuses any key the collection's list does not read"
  - "The reference-list dialog checks every column of the view and shows the round-trip hint through the column choice's existing hint slot (a new optional columnsHint prop on ExportButton and ListExportButton)"

patterns-established:
  - "Locate the visible element in Playwright when the Export placement pattern streams a header twice: read page-header text inside <main>"

requirements-completed: [CSV-01, CSV-02, CSV-03]

duration: 3h58m
completed: 2026-10-17
---

# Phase 19 Plan 15: The import a spreadsheet user can trust, and the phase gate — Summary

**The import now reads nothing in the browser. Strapi reads the CSV or Excel file and offers its own templates. A file it can't read says how to fix it. A lower-case near-match waits for Bob's own Update or Skip, and the rows that weren't imported come back as Strapi's error report to correct in Excel. Each reference list has Export in its import shape. The full gate is green on the production build (web 6,359, Strapi 2,245 + 1 skipped, Playwright 268). One static check, the Keycloak path check, fails on a 19-07 unit-test file and needs the pilot's ruling (see "Gate result").**

## Performance

- **Duration:** about 3h58m (15:14 to 19:12 AEDT, 2026-10-17). That includes one Strapi suite (35.1 min), three full Playwright runs (34.7, 36.1 and 36.2 min) and four partial runs.
- **Tasks:** 4 (Task 1 tracer RED then GREEN, Task 2 RED then GREEN, Task 3, Task 4), plus two gate fixes.
- **Files changed:** 36 (`git diff --name-only 56e49d78..HEAD`), with no deletions.

## Accomplishments

- **D-25 (Task 1, tracer):**
  - `csv-client-parser.ts` is now only `checkImportFileInBrowser`. It checks for a `.csv` or `.xlsx` name, in any case, and a size of at most 5,242,880 bytes.
  - The flow uploads through the Server Action and shows Strapi's answer. A test proves that no `arrayBuffer`, `text`, `stream` or `FileReader` read happens.
  - `csv-parse` is gone from `apps/csrm/package.json` and from the lockfile's apps/csrm importer (three lines). `pnpm --dir apps/csrm install --frozen-lockfile` passes, and `apps/backend` keeps `csv-parse` 7.0.2.
- **D-31, templates:**
  - Guidance offers `Download Excel template`, then `Download CSV template`.
  - Each saves Strapi's file through `saveFile`, shows `Downloading…` while pending, then toasts `Downloaded {file name}`.
  - A failure shows S3 with `Try again`.
- **§5.1 to §5.5:**
  - The title is `Import {plural}`, with the §5.1 description and route title.
  - The Guidance table reads Column, Also accepted as, Required, Format and allowed values, from the vocabulary's `importColumns`, followed by the `How values are read` list.
  - The X-19 single-file field (`File to import`, `Choose file`, `Drag a file here, or`) carries the §5.4 hint and shows `{name} · {size}`.
  - Review shows `Some columns will be ignored` with each header quoted, and the three notes.
- **D-26, S2 and S3 (Task 2):**
  - A file Strapi refuses (413 or 415, or 422 with a closed reason; `IMPORT_CSV_MALFORMED` names its line) is mapped in the action through `importFileRefusal`, with the file's name and X-23 size.
  - The refusal shows as a warning alert above the field (`FileWarning`) with numbered steps and `Choose another file`. Focus moves to its title, and the file stays listed.
  - A malformed multipart request (400) keeps the flow's own sentence.
  - `IMPORT_REVIEW_EXPIRED` shows S3 with `Choose file again`. `IMPORT_DECISION_MISSING` returns to Review with the similar filter.
- **D-30, X-32 (criterion 5):** a similar row keeps 19-13's `ImportRowBadge` and adds `Similar to the existing {singular} “{name}”.` with a radio group `Decision for row {n}` and nothing chosen.
  - The panel shows `{k} rows match…`, `{d} of {k} decided` (`aria-live`), `Update all {k}`, `Skip all {k}` and `Show these rows`.
  - A bulk choice that replaces a different choice raises the X-14 toast `Set {k} rows to {Update|Skip}`, whose `Undo` restores the earlier choices.
  - The gate line reads `Choose Update or Skip for {u} more {row|rows}.`. It selects the similar filter and focuses the first undecided group.
  - Choices persist between Review and Confirm, and the new-file guard (`Choosing another file clears your {d} choices.`) asks first.
  - The commit sends `decisions` as one JSON string.
  - Confirm's §5.7 summary omits zero parts, and Results show six tiles, including `Skipped by you`, with `Skipped by your choice.`
- **D-32, error reports (criterion 4):**
  - `Download error report` appears at Review when a row is rejected, ambiguous or similar, and at Results when a row was rejected or ambiguous.
  - It sends the file with the preview token at Review, or the result token at Results, plus the viewer's zone. It shows `Preparing error report…`, saves Strapi's file, and toasts `Downloaded {name}` with `{n} rows to correct.`
- **D-33, reference lists (Task 3):**
  - The header reads `Create {singular}`, `Import` and `Export {plural}`, with Export appended last inside the unchanged `md:flex-row-reverse` wrapper.
  - Export appears only when `can('<collection>:export', granted)` holds and the read succeeded with no fixture replacing it.
  - Every column is checked, with the hint `To edit this file and import it again, keep {key label} and every required column.`
  - The four capabilities are anchored to each list read and to `GET:/api/v1/{segment}/export?format={format}`, and granted to the Security Analyst fixtures only.
- **Inventory:** each task registered its four file operations with the parity guard and regenerated `served-operations.json` (`SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write`, 11 pass, 1 skip). All 12 now list `src/features/administration/administration-service.ts` as their web caller.

## Task Commits

1. **Task 1, tracer** (Strapi's templates; the browser reads nothing)
   - RED `3f94d532` (test)
   - GREEN `7f843bc2` (feat, including the `csv-parse` removal)
   - Tracer gate: the automated verify passed, then the remaining tasks followed.
2. **Task 2** (refusals, decisions, error reports)
   - RED `18a32c01` (test)
   - GREEN `9625877f` (feat)
3. **Task 3** (reference-list export, capabilities, journeys, route budgets): `8235293f` (feat)
4. **Task 4** (coverage declaration): `111f5b38` (docs)
5. **Gate fixes** (see Deviations 6 and 7)
   - `56521daa` (test)
   - `80bf58e1` (test)

## Route budgets (performance.spec.ts, delivered JS against 300,000 bytes)

| Build | `/app/risks/{documentId}` | `/app/requests/{documentId}` |
| --- | --- | --- |
| Phase 16 final gate (`fa0cf7a4`) | 299,711 (289 left) | 299,442 (558 left) |
| After 19-13 and 19-14 | 298,798 (1,202 left) | 298,465 (1,535 left) |
| **19-15 Task 3 verify (`8235293f` sources)** | **298,266 (1,734 left)** | **298,436 (1,564 left)** |
| 19-15 final gate run (`80bf58e1`) | 298,267 (1,733 left) | 298,436 (1,564 left) |

Both routes stayed within budget and shrank slightly, because the client parser left the shared graph. `/app/admin/controls` is 251,412.

## Gate result (Task 4, production build, `HEAD` `80bf58e1`, `PHASE_19_BASE=bdd0f698`)

| Gate command | Result | Duration | Phase 16 final gate |
| --- | --- | --- | --- |
| `pnpm --dir apps/csrm api:check && git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | exit 0, schema unchanged (the refresh only names the operator's ledger) | 2 s | — |
| `pnpm --dir apps/csrm typecheck` | exit 0 | 5 s | — |
| `pnpm --dir apps/csrm lint` | exit 0 | 4 s | — |
| `pnpm --dir apps/csrm test` | **6,359 passed, 0 failed** (244 files) | 72 s | 5,847 |
| `pnpm --dir apps/backend test` | **2,246 tests: 2,245 passed, 0 failed, 1 skipped** (the POSIX file-mode check) | 35.1 min (2,104 s) | 2,022 + 1 skipped |
| `pnpm --dir apps/csrm test:e2e` (both projects) | **268 passed: desktop 190, mobile 78. 0 failed, 0 flaky, 0 retries** (third full run) | 36.2 min | 248 (180 / 68) |
| `git status --short` | ` M .planning/workstreams/csrm/.verification-ledger.json` only | — | — |

- **Full Playwright runs:**
  - The first run had 257 passed, 4 failed and 7 not run (Deviation 6).
  - The second had 265 passed, 1 failed and 2 not run (Deviation 7).
  - The third had 268 passed.
- After the two spec commits, api:check, typecheck and lint ran again on `80bf58e1` (exit 0, 0, 0). The web and Strapi suites ran on `111f5b38`; the later commits change e2e specs only.
- One-row export time: desktop 75 ms, mobile 57 ms. The report PDF has 2 pages.

**Static checks (run as the plan writes them, with `BASE=bdd0f698`; see Deviation 5):**

| Check | Result |
| --- | --- |
| Content-type freeze (three IAM exclusions) | empty (pass) |
| `cmp` of the two catalogue copies | identical (pass) |
| **Keycloak path check over `apps/`** | **FAIL:** `apps/backend/tests/keycloak-identity.unit.test.ts` (see below) |
| Semantic dependency check (B6), identical to the plan's script | exit 0, output **empty** |
| Approval lines (bold stripped) | all four pass (below) |
| No `status: awaiting` line in the four records | pass |
| `apps/csrm/e2e/risk-owner-journey.spec.ts` unchanged | pass (absent at `bdd0f698` and at HEAD) |
| `COVERAGE.md` declaration | pass |

**The four approval lines as the pilot wrote them:**
- `docs/contract-gaps/phase-19-exports-and-export-log.md:279`: `Status: **approved by the pilot on 2026-10-16** (G-6).`
- `docs/contract-gaps/phase-19-import-tolerance.md:205`: `Status: **approved by the pilot on 2026-10-16** (G-6).`
- `phase-06-administration-import-contract.md`, `## Phase 19 amendment`: `Phase 19 amendment status: **approved by the pilot on 2026-10-16** (G-6).`
- `phase-07-derived-insights.md`, `## Phase 19 amendment`: `Phase 19 amendment status: **approved by the pilot on 2026-10-16** (G-6).`

**Keycloak path check: open for the pilot.**
- **What it found:** `git diff --name-only bdd0f698..HEAD -- apps/ | grep -i keycloak` prints `apps/backend/tests/keycloak-identity.unit.test.ts`.
- **Where it came from:** plan 19-07's own commit `946cb1ef` (`test(19-07): expect My requests to export own records only`). It is listed in 19-07's key files.
- **What changed:** 23 added lines, one new test of `summariseEffectiveAccess`: the My requests export is offered to Jane and Bob and withheld from the service agent. No Keycloak integration code or flag changed, and no file outside `apps/backend/tests` matches.
- **Why it isn't fixed here:** the check cannot pass without deleting 19-07's test or weakening the check, and the plan forbids both. This needs the pilot's ruling, for example an exclusion for that test path, as the IAM exclusions do for the freeze. Every other part of the gate passes.

## Phase gate (final run, after the code review)

Run by the stage B worker on 2026-10-17, ending 13:37 UTC, at `31d7c70d`. These steps came first:
- **The code review (stage A).** `19-REVIEW.md` holds 43 findings. `19-REVIEW-DISPOSITION.md` closes all of them, ending at `f673dcb7`: 39 fixed, 2 skipped with evidence and 2 deferred to Phase 22, with 0 open. Stage B corrected BE3-01's row (T-19-06).
- **`verify:post`.**
  - **Security:** `19-SECURITY.md` is verified, with `threats_open: 0` and 57 of 57 threats closed. The audit found T-19-06 open at high: the XLSX sheet pass was quadratic on an unterminated tag. It was fixed test-first (`08e2e72d` RED, `d12f1fa2` GREEN), together with the same pattern in the workbook, rels, dimension and cell-value scans. T-19-45's store caps gained their tests (`7160ce64`). The export rate and concurrency limit is deferred to Phase 22 (pilot ruling).
  - **Validation:** `19-VALIDATION.md` is validated and Nyquist-compliant. Its one gap, the byte-for-byte re-import of a marked export, was filled in `3c43d4f3`.
  - **UI review:** `19-UI-REVIEW.md` scored 20/24, with 0 blockers and 12 warnings. `19-UI-REVIEW-DISPOSITION.md` records UI-01 to UI-05 and UI-07 to UI-12 as fixed test-first (`6e748eeb` RED, `536d3856` GREEN), with no new copy. UI-06 is cited and captured below.
- **The verification and the UAT.** `19-VERIFICATION.md` reads `human_needed`: 6/6 criteria, CSV-01 to CSV-03 satisfied, 0 gaps. `19-UAT.md` lists the eight checks only a person or a deployment can make, all pending for the pilot's ruling.

**How the gate ran:**
- From the repository root, with Node v24.19.0 and pnpm 11.24.0 from the session shim.
- Both Keycloak flags were off, and no `.env` file was read.
- Before the run, the tree held only the uncommitted `.verification-ledger.json` and the two untracked stage B documents (`19-UAT.md` and this disposition, committed after the run).
- Ports 1337 and 3000 were free, and no dev server ran.
- The suites ran one at a time, all at one HEAD, with the web suite on its own. `retries` is 0, so a flaky test would show as a failure.

| Gate | Command | Result | Duration | HEAD |
|---|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check`, then `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | clean; `schema.d.ts` regenerates identical, and the refresh names only the operator's ledger | 2 s | `31d7c70d` |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean | 6 s | `31d7c70d` |
| Lint | `pnpm --dir apps/csrm lint` | clean | 4 s | `31d7c70d` |
| Web (Vitest), alone | `pnpm --dir apps/csrm test` | **Test Files 245 passed (245), Tests 6,440 passed (6,440)** | 75 s (Vitest 73.3 s) | `31d7c70d` |
| Strapi (node:test) | `pnpm --dir apps/backend test` | **ℹ tests 2,307, ℹ pass 2,306, ℹ fail 0, ℹ skipped 1**, cancelled 0. The skipped test is the POSIX file-mode check, which cannot run on Windows | 48.7 min (duration_ms 2,912,050) | `31d7c70d` |
| Playwright (production build, both projects) | `pnpm --dir apps/csrm test:e2e` | **268 passed**: desktop **190**, mobile **78**. 0 failed, 0 flaky, 0 skipped | 36.2 min (13:01:31 to 13:37:45 UTC) | `31d7c70d` |
| Tree | `git status --short` | ` M .planning/workstreams/csrm/.verification-ledger.json`, plus the two untracked stage B documents named above. The run modified no tracked file | | `31d7c70d` |

**Against the stage A regression gate** (web 6,433; Strapi 2,293 passed with 1 skipped; Playwright 268):
- **Web gains 7 tests:** the UI-04 dialog test, five import-flow UI review tests and the UI-05 report test.
- **Strapi gains 13 tests:**
  - the Nyquist byte-for-byte round trip;
  - nine T-19-06 timing cases (eight at 50,000 and 100,000 repetitions, plus the 5 MiB guard);
  - three T-19-45 cap tests.
- **Playwright** keeps its 268 tests. The `print report`, `register export`, `released assessment export` and `similar name held` journeys gained assertions and captures, but no new tests.
- **Strapi's longer run** (48.7 min against 34.6 min at stage A) came from this host's load. No test timed out.

**Other notes:**
- **Phase 19's journeys** in `exports-and-imports.spec.ts` all passed at 1440 and 375, including the UI-05 one-`h1` assertions in each medium and UI-02's panel with no `role="alert"`. The report PDF has 2 pages (`REPORT_PDF_PAGES[desktop]=2`).
- **Server log noise, not a failure.** The harness's Next server logged `The destination stream closed early.` 680 times, from streamed responses whose client navigated away, as in Phases 14 to 16. The other server errors were the deliberate ones: 3 `Invalid Server Actions request` and 2 `The Server Reference ID did not match the expected format`.

**Performance budgets.** `performance.spec.ts` passed on desktop, and no Phase 19 override was added. The figures come from this run's `apps/csrm/.tmp/performance/baseline-desktop.json`, measured from 13:26:09 to 13:26:55 UTC.

| Route | Actor | Delivered JS bytes | Budget | Left |
|---|---|---|---|---|
| `/app` | Requestor | 230,271 | 300,000 | 69,729 |
| `/app/requests` | Requestor | 261,744 | 300,000 | 38,256 |
| `/app/requests/{documentId}` | Requestor | **297,838** | 300,000 | **2,162** |
| `/app/questionnaires/{documentId}` | Requestor | 363,656 | 500,000 (override) | 136,344 |
| `/app` | Security Analyst | 230,271 | 300,000 | 69,729 |
| `/app/review/assessments/{documentId}` | Security Analyst | 412,161 | 460,000 (override) | 47,839 |
| `/app/risks` | Security Analyst | 278,645 | 300,000 | 21,355 |
| `/app/risks/{documentId}` | Security Analyst | **298,576** | 300,000 | **1,424** |
| `/app/reports/risk-exposure` | Security Analyst | 257,234 | 300,000 | 42,766 |
| `/app/admin/controls` | Security Analyst | 251,960 | 300,000 | 48,040 |

- Every TTFB was under 16 ms (budget 500), and every LCP was 420 ms or less (budget 2,500).
- The stage B fixes left both tight routes where stage A put them: `/app/risks/{documentId}` is unchanged at 298,576, and `/app/requests/{documentId}` moved by 3 bytes, from 297,841 to 297,838.
- The pilot's quick task to reclaim at least 5 KB on both routes before Phase 19.1 stays open (`deferred-items.md`).

**UI-06 captures** (`19-UI-REVIEW-DISPOSITION.md`, "Captures"):
- Each capture was copied from the run's `apps/csrm/test-results/` into the git-ignored `apps/csrm/.tmp/ui-review-19/`, where the next Playwright run will not replace it.
- The files: `export-dialog-{desktop,mobile}.png`, `released-export-dialog-{desktop,mobile}.png`, `report-screen-{desktop,mobile}.png`, `report-print-{desktop,mobile}.png`, `import-decisions-{desktop,mobile}.png` and `report-a4.pdf`.

### Static checks (on `31d7c70d`; PHASE_19_BASE=bdd0f698; run as 19-15's verify writes them)

| Check | Result |
|---|---|
| Content-type freeze (three IAM exclusions) | empty (pass) |
| `cmp` of the two catalogue copies | identical (pass) |
| Keycloak path check over `apps/` | only `apps/backend/tests/keycloak-identity.unit.test.ts`, the reviewed exception in `19-PILOT-RULINGS.md` (pass under that ruling); no stage B change touches a Keycloak path |
| Semantic dependency check (B6) | exit 0, output **empty** |
| Approval lines (bold stripped) | all present (below) |
| No awaiting line in the four records | pass: neither `awaiting` nor `status: awaiting` matches |
| `apps/csrm/e2e/risk-owner-journey.spec.ts` unchanged | pass |
| `COVERAGE.md` declaration | pass |

**The approval lines** (bold stripped):
- `docs/contract-gaps/phase-19-exports-and-export-log.md`: `Status: approved by the pilot on 2026-10-16 (G-6).` and `Phase 19 review amendment status: approved by the pilot on 2026-10-17 (G-6).`
- `docs/contract-gaps/phase-19-import-tolerance.md`: `Status: approved by the pilot on 2026-10-16 (G-6).` and `Phase 19 execution amendment status: approved by the pilot on 2026-10-17 (G-6).`
- `phase-06-administration-import-contract.md`, `## Phase 19 amendment`: `Phase 19 amendment status: approved by the pilot on 2026-10-16 (G-6).`
- `phase-07-derived-insights.md`, `## Phase 19 amendment`: `Phase 19 amendment status: approved by the pilot on 2026-10-16 (G-6).`

## Manual-only checks for the pilot (19-VALIDATION.md)

1. **The neutraliser mark in Excel (CSV-01 (3)).** On a machine with Excel, open an exported CSV and XLSX holding `=HYPERLINK("https://example.test","Click")`. Confirm that neither evaluates. Save the CSV as CSV, reopen it, then repeat with OWASP's tab variant (`"\t=1+2"`). Re-import both and confirm the stored values are unchanged. Record the result in `phase-19-exports-and-export-log.md`.
2. **The error report in Excel (CSV-02 (3), optional).** Open the CSV (UTF-8 BOM) and the XLSX error reports in Excel, correct a row, save in the same format, and import. Automated coverage: `administration.integration.test.js` (19-14) and `error report round trip @journey` (here).

The UI backstop for this plan is a 200-character existing name in an Update label, which should wrap at 375 and 1440 with the radio aligned to the first line. It stays the orchestrator's browser check. The layout is `flex items-start`, with the radio at `mt-0.5` and the label at `min-w-0 break-words`.

## Verification (per task)

- **Task 1 verify:** exit 0.
  - Vitest: 349/349 in 8 files (administration, parity, chain).
  - Typecheck and lint clean.
  - No `csv-parse` in `apps/csrm/src`; the manifest checks pass.
- **Task 2 verify:** exit 0.
  - Focused Vitest: 715/715 in 10 files.
  - Full web suite: 6,346/6,346.
  - Typecheck and lint clean.
  - `status-badge.tsx` unchanged by this plan.
- **Task 3 verify:**
  - Web suite: 6,359/6,359.
  - Typecheck clean.
  - Playwright (`exports-and-imports`, `administration-workflow`, `performance`): 36/36 in 3.7 min.
  - The verify's final tree check ran before the commit and saw the task's own uncommitted files. After commit `8235293f`, the tree held only the ledger (and the not-yet-committed `COVERAGE.md`, which Task 4 then committed).
- **Task 4 verify:** see Gate result. Every part passes except the Keycloak check.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] The Phase 6 catalogue count followed 19-14's 12 FunctionApis**
- **Issue:** `administration-service.test.ts` pinned 24 Administration FunctionApis. 19-14 made them 36 and ran only the web typecheck, so the web suite carried this one failure into 19-15 (baseline before 19-15: 6,317 passed, 1 failed).
- **Fix:** `24 + 12`, with a comment naming 19-14.
- **Commit:** `3f94d532`

**2. [Rule 3] `keyLabel` moved to `import-flow-rules.ts` in Task 1**
- **Why:** the plan reduces `csv-client-parser.ts` to `checkImportFileInBrowser` and creates the rules module in Task 2. The flow still needed the key label in Task 1.
- **Change:** `import-flow-rules.ts` was created in Task 1, deriving the label from the vocabulary.
- **Commit:** `7f843bc2`

**3. [Rule 2] The reference-list round-trip hint needed a prop on the shared export button**
- **Why:** `ExportButton` and `ListExportButton` (outside the file list) had no way to pass the §2.4 hint into the dialog's existing `ColumnChoice hint`.
- **Change:** they gained an optional `columnsHint`, and the dialog forwards it.
- **Bytes:** this is a type-only prop on the shared button, and the lazy dialog carries the rest; the route figures above show no growth.
- **Commit:** `8235293f`

**4. [Rule 3] The §10 strings appear in four more e2e specs**
- **Specs:** `accessibility.spec.ts`, `production-hardening.spec.ts`, `design-system-conformance.spec.ts` and `risk-register-workflow.spec.ts`. The import's route title, its heading, `Choose CSV file`, `Import CSV` and the Confirm checkbox are named there too.
- **Change:** only those strings changed, in `8235293f`.
- **Also touched:**
  - `export-actions.test.ts`: the action inventory and a new `exportReferenceListAction` describe.
  - `administration-domain.ts`: one `administrationFilterChips` shared by the table and the export's scope lines.
  - The workspace test: `Import`, and a header-order case.

**5. [Rule 3 - verify defect] The plan's `BASE=$(grep -oE 'PHASE_19_BASE=…' 19-01-SUMMARY.md | cut -d= -f2)` yields three lines**
- **Issue:** 19-01-SUMMARY records the value three times. Every `"$BASE"..HEAD` in the verify then fails with `bad revision`.
  - The content-type freeze's `test -z "$(git diff …)"` would pass vacuously.
  - The `CHANGED=` assignment and the dependency script would fail.
- **What was run:** the brief's `BASE=bdd0f698`, with every check's text otherwise exactly as the plan writes it. The dependency script's text was proven identical to the plan's.
- **Not edited:** the plan. A `| head -1` would fix its command.

**6. [Rule 1 - Gate failure, test locator] Two specs read a page description that the 19-06/19-11 Export placement streams twice**
- **What failed:** the first full run failed `REQ08_PICK_UP_FROM_QUEUE_ROW` and the Risk register journey, at desktop and mobile, with strict-mode `getByText` resolving to 2 elements.
- **Cause:** those pages render a header in the Suspense fallback and again in the data component. Until React reveals the streamed segment, its hidden copy sits outside `<main>`.
- **Fix:** the three description checks (Requests, Assigned to me, Risk register) now read inside `getByRole('main')`. The assertion is unchanged.
- **Proof:** both specs ran 30/30.
- **Commit:** `56521daa`

**7. [Rule 1 - Gate failure, shared data] The register's phone-card count assumed one page**
- **What failed:** the second full run failed `expectRegisterGeometry` at 375, with 50 cards against a total of 58. Today's runs grew the shared register past `pageSize=50`, as Phase 16's FE3-15 found for the register's other checks.
- **Fix:** it now expects one card per row of the page, `min(total, 50)`.
- **Proof:** the third full run passed 268/268.
- **Commit:** `80bf58e1`

### Readings of the plan

- **Reference-list export query.** The spec publishes only `q`, `sort`, and `framework`/`controlType` for Controls, on both the list and the export. The web's list read has always sent the other admin filters through `serializeAdministrationQuery`, and Strapi's export parser is the list's own parser, so it accepts them.
  - The export sends the same serialised query, minus page, page size and an empty `q`, so the file matches the filtered list and the dialog's count. The call is cast, as the list read effectively is.
  - This is the existing Phase 06 contract gap for the admin list filters, not a new contract change. No specification or content type changed.
- **Confirm's summary.** "Zero parts omitted" is read as: the `including …` and `… you chose to skip` clauses and each zero skip reason are omitted, and the second sentence is omitted when nothing is skipped.
- **Results tiles.** These are fixed (`RESULT_TILES`) from the result summary's six keys, where 19-13 left five labels from the badge map.
- **Unused exports kept.** `csv-import-schema.ts` (not in the plan) still exports `csvClientPreviewSchema`, `administrationCsvContracts` and `getAdministrationCsvContract`, which only the deleted parser used. They are left for a later cleanup.
- **REQUIREMENTS.md not ticked.** CSV-01 to CSV-03 are listed above as delivered by this last plan, but `requirements.mark-complete` was not run. The pilot runs it after ruling on the Keycloak check (the orchestrator asked for STATE and ROADMAP only).

## Threat model (register)

- **T-19-52:** the browser parser is deleted, and Strapi parses every upload.
- **T-19-53:** nothing is preselected; the UI gate and Strapi's `IMPORT_DECISION_MISSING` both hold undecided rows.
- **T-19-54:** templates, error reports and exports all pass `exportFileRule` (and the row count where served) before `saveFile`.
- **T-19-55:** the gate checks are recorded above.
- **T-19-56:** the route figures are recorded above.
- **T-19-SC:** the dependency check output is empty.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema change: the web now calls the 12 operations 19-14 served.

## Self-Check: PASSED

- Present: `import-flow-rules.ts`, `csv-client-parser.ts` (reduced), `COVERAGE.md` and this SUMMARY.
- Commits `3f94d532`, `7f843bc2`, `18a32c01`, `9625877f`, `8235293f`, `111f5b38`, `56521daa` and `80bf58e1` are all on `csrm` (8 = `git rev-list --count 56e49d78..80bf58e1`). The plan deleted no file.
- **The Phase 19 gate is not fully green:** the Keycloak path check is open for the pilot (see Gate result).
