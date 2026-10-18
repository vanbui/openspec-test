---
phase: 19-csv-export-and-import-hardening
plan: 12
subsystem: exports
tags: [released-assessment, print-report, a4, export-placement, server-components, route-budgets, playwright, axe]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-10: the analyst detail's server-computed `released` (assessment-server-schema.ts) and the released reads gated by findReadableReleasedAssessment; 19-11: exportReleasedAssessmentAction(assessmentId, input), released-assessment:export, viewerCapabilities, ExportButton `scope`; 19-06: ExportButton `fixedTables`; 19-04: tables.released-assessment in the web vocabulary"
provides:
  - "features/assessments/released-assessment-report.ts (server-only): readReleasedAssessment (the one cache(getReleasedAssessment)), loadRequestorReleasedAssessment (discriminated result), readAnalystReleasedAssessment, loadAnalystReleasedAssessment, logContractMismatch; re-exports the model"
  - "features/assessments/assessment-report-model.ts (pure): toAssessmentReportModel (active Risks only, number order), AssessmentReportModel, releasedAssessmentScopeSentence, releasedAssessmentExportTables, releasedAssessmentActions, requestorReportHref, analystReportHref"
  - "features/assessments/assessment-report.tsx (Server Component): AssessmentReport, AssessmentReportSkeleton, AssessmentReportToolbar, AssessmentReportToolbarSkeleton, AssessmentReportScreen"
  - "features/assessments/report-toolbar.tsx: ReportToolbar, the report routes' one new client module (window.print)"
  - "features/assessments/released-assessment-actions.tsx: ReleasedAssessmentHeaderActions (Print report, then Export bound to the id)"
  - "Routes /app/assessments/{documentId}/report and /app/review/assessments/{documentId}/report (page, loading, error)"
  - "An optional `headerAction` slot on ReleasedAssessmentDetailView and AssessmentEditor"
  - "globals.css: the named `csrm-report` A4 page (16mm, Page n of m) and the report's print rules"
  - "Three Playwright journeys: released assessment export, released assessment refused to another Requestor, print report"
affects: [19-13, 19-14, 19-15, 17-participant-stage-aware-view]

actuals:
  tokens: 23300
  tasks: 4
  commits: 8

plan_head_before: 16d003114d9d97dc787e5dc455d5115caf252807
plan_head_after: 583851edaf40a5bcfb609428f8182ba494ccda7a

tech-stack:
  added: []
  patterns:
    - "One shared loader per record view returning a discriminated result; each route maps the states to what it renders (the released page to its states, the report route to notFound() or its error boundary)"
    - "A Server Component never imports a 'use client' module it does not need on the client: importing one makes every export of it a client entry and regroups the shared chunks of other routes (measured on the tight-budget routes)"
    - "Header actions for a client view are rendered on the server and passed as a ReactNode slot, so the client view gains a prop and no Server Action or service import"
    - "A printed document takes a named @page, so only it changes the paper box and margins"

key-files:
  created:
    - apps/csrm/src/features/assessments/released-assessment-report.ts
    - apps/csrm/src/features/assessments/assessment-report-model.ts
    - apps/csrm/src/features/assessments/assessment-report.tsx
    - apps/csrm/src/features/assessments/report-toolbar.tsx
    - apps/csrm/src/features/assessments/released-assessment-actions.tsx
    - apps/csrm/src/features/assessments/assessment-report.test.tsx
    - apps/csrm/app/(app)/app/assessments/[documentId]/report/page.tsx
    - apps/csrm/app/(app)/app/assessments/[documentId]/report/loading.tsx
    - apps/csrm/app/(app)/app/assessments/[documentId]/report/error.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/report/page.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/report/loading.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/report/error.tsx
  modified:
    - apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/csrm/src/features/assessments/released-assessment.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/app/globals.css
    - apps/csrm/e2e/exports-and-imports.spec.ts
    - apps/csrm/src/lib/performance/zod-client-boundary.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx
    - apps/csrm/src/features/assessments/released-assessment.test.tsx
    - apps/csrm/src/features/assessments/analyst-route-gate.test.tsx
    - apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx
    - apps/csrm/src/lib/metadata/record-route-titles.test.ts

key-decisions:
  - "The report model is a pure module (assessment-report-model.ts) re-exported by the server-only loader, so the analyst review page builds its header counts from it without importing the Requestor's reads"
  - "Both released headers get their actions as a server-rendered `headerAction` slot (the export placement pattern); the client views import no Server Action. exportReleasedAssessmentAction is bound in released-assessment-actions.tsx"
  - "The report takes a named page, `@page csrm-report`, so the A4 box and 16mm margin apply to the report only; every other page keeps the browser's default margins (design direction §4 Print)"
  - "The report document is plain server markup with no client table or scroll-region module; its overview scrolls inside a named, focusable region, expanded in print"
  - "Both report routes treat a refused read as missing in the page and in the title; a failed, mismatched or unavailable read throws to the route's error boundary"
  - "The analyst's AI flag follows Strapi's isAiAssistedAssessment over the generation facts (generated, with a named provider), so the analyst's paper equals the Requestor's"
  - "Risks in detail is omitted when there is no Risk, so print does not start an empty page; Risks overview carries the defensive line"

patterns-established:
  - "Route-budget diagnosis without Playwright: a build into .tmp plus a gzip sum of the route's manifest chunks reproduces performance.spec.ts within 2 bytes"

requirements-completed: []

coverage:
  - id: D1
    description: "One shared loader for the released page and the Requestor report route, behaviour-neutral for the released page"
    requirement: CSV-01
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-report.test.tsx#the released page reads through the shared loader"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/released-assessment-route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Print report, then Export {number}, in both released headers; the analyst's only when released is true"
    requirement: CSV-01
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-report.test.tsx#the released view’s header actions"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx#the analyst assessment route’s released header actions (19-12)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/exports-and-imports.spec.ts#released assessment export @journey"
        status: pass
    human_judgment: false
  - id: D3
    description: "The X-31 A4 report at both report routes, active Risks only, with its states and print rules"
    requirement: CSV-01
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-report.test.tsx#the A4 report document"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/exports-and-imports.spec.ts#print report @journey"
        status: pass
    human_judgment: false
  - id: D4
    description: "Another Requestor reaches neither the released view nor its report"
    requirement: CSV-01
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/exports-and-imports.spec.ts#released assessment refused to another Requestor @journey"
        status: pass
    human_judgment: false
  - id: D5
    description: "A released assessment with 25 risks prints its overview on A4 portrait with repeated headers, no clipped column, and Risks in detail on a new page (plan backstop truth)"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/exports-and-imports.spec.ts#print report @journey (seed has fewer risks; the PDF has 2 pages)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this truth as a backstop: the paper look of a 25-risk overview (no clipped column, header repetition across pages) needs a person to read the printed or saved PDF."

duration: 57min
completed: 2026-10-17
---

# Phase 19 Plan 12: Released assessment export and A4 print report Summary

**Jane's released assessment now has `Print report` and `Export ASM-…` in its header. The export saves the XLSX or a table's CSV from the server. `Print report` opens an A4 report rendered on the server, through one shared loader that Strapi's released-assessment record-read check gates. The analyst's page gets the same pair once the server says the assessment is released. Both route budgets are unchanged.**

## Performance

- **Duration:** 57 min
- **Started:** 2026-10-16T23:06:39Z
- **Completed:** 2026-10-17T00:04:00Z
- **Tasks:** 4
- **Files modified:** 26

## Accomplishments

- **One loader.** `released-assessment-report.ts` now holds the released page's reads and branches (`loadRequestorReleasedAssessment`) and the one `cache(getReleasedAssessment)` that `generateMetadata` shares. The page maps each state exactly as before, logging the same `[csrm-contract]` line.
- **Two report routes.** `/app/assessments/{id}/report` and `/app/review/assessments/{id}/report` each have a page, loading and error file. A missing, refused or unreleased assessment renders the in-shell not-found. The analyst's route reads through `loadAnalystReleasedAssessment`, which checks the review gate, the analyst detail and its `released` flag.
- **The X-31 document**, in this order:
  - a header with the product eyebrow, the h1 `Cyber security risk assessment`, the identifiers joined by the middle dot, and `Release date`, `Released by` and the overall rating;
  - Summary;
  - Overall rating and rationale;
  - Recommendations;
  - Control effectiveness and next review;
  - a captioned five-column `Risks overview`;
  - `Risks in detail`, each Risk at h3 with the shared read-only Risk at h4;
  - Notes, with the AI notice when AI assisted and the generation line naming its zone, or UTC when the zone is unknown.
- **Print rules.** `@page csrm-report { size: A4 portrait; margin: 16mm; }` with `Page n of m` in the bottom-right margin box. In print, the document drops its card edge, `Risks in detail` starts on a new page, Risks avoid breaking inside, and table headers repeat (the existing rule).
- **Header actions.** Both views show `Print report` (outline link with the `Printer` icon), then `Export {number}`, in the administration header wrapper:
  - Export is a fixed-table view: CSV tables `Risks` and `Mitigation controls`, scope `{number} as released: its summary, {r} risks and {c} mitigation controls.`
  - It shows only with `released-assessment:export`.
  - The analyst page shows the pair only when the detail's `released` is true.
- **Active Risks only.** The model drops any Risk the analyst detail shows as withdrawn, so the analyst's model equals the Requestor's, and so does the `{r}` count.

## Task Commits

1. **Task 1: one shared loader; Jane's view gets Print report and Export** (tracer)
   - `8f300575` (test, RED)
   - `dcce6a74` (feat, GREEN)
   - Tracer gate: the automated verify was re-run and passed, so expansion went ahead.
2. **Task 2: the full X-31 document, its states and the print rules**
   - `b5fefa93` (test, RED)
   - `753f5ac8` (feat, GREEN)
3. **Task 3: the analyst's report route and header actions, only once released**
   - `d3ea2bcb` (test, RED)
   - `5b5feaaa` (feat, GREEN)
4. **Route-budget fix, found while measuring for Task 4:** `0266583b` (fix)
5. **Task 4: criteria 2 and 6 in the browser at both widths:** `583851ed` (test)

## Verification

| Verify | Result |
| --- | --- |
| Task 1: `vitest run src/features/assessments src/lib/performance/zod-client-boundary.test.ts`, typecheck, lint | 668 passed / 0 failed / 0 skipped; typecheck and lint exit 0 |
| Task 2: assessments + copy guard, then the full web suite, typecheck, lint | 900 passed; full suite 243 files, 6,272 passed / 0 failed; exit 0 |
| Task 3: assessments + zod boundary, typecheck, lint (+ full suite) | 690 passed; full suite 243 files, 6,294 passed / 0 failed; exit 0 |
| After the fix commit: full web suite, typecheck | 243 files, 6,294 passed / 0 failed / 0 skipped; exit 0 |
| Task 4: `test:e2e` on exports-and-imports, performance, design-contract and accessibility | **40 passed, 0 failed, 0 flaky, 0 skipped** (7.2 min). Tree afterwards: only the verification ledger |

- **PDF page count:** 2 (desktop, `page.pdf({ format: 'A4', preferCSSPageSize: true })`). Page 1 has the header, the text sections and the overview; `Risks in detail` starts on page 2. The named page added no blank leading page.
- **Axe:** the report route has no serious or critical violation at 1440 or 375 (`expectNoSeriousViolations`). The accessibility sweep also passed.
- **Journeys at both widths:** `released assessment export`, `released assessment refused to another Requestor` and `print report` passed on both the desktop and mobile projects. At 375 the report has no horizontal page scroll.

## Route budgets (performance.spec.ts, delivered JS against 300,000 bytes)

| Build | `/app/risks/{documentId}` | `/app/requests/{documentId}` | `/app` |
| --- | --- | --- | --- |
| Before 19-12 (19-11 final; rebuilt here at `16d00311`: 299,854 / 299,518 estimated) | 299,849 (151 left) | 299,517 (483 left) | 230,298 |
| After Task 3, first measurement (report used the shadcn `Table` and `HorizontalScrollRegion`) | 299,979 (21) | **300,450 (over by 450)** | 230,285 |
| Final `583851ed` (Task 4 run) | **299,849 (151)** | **299,510 (490)** | 230,295 |

- Neither route shrank. `/app/risks/{documentId}` is back to exactly its pre-plan headroom, and `/app/requests/{documentId}` gained 7 bytes.
- **Other routes:**
  - `/app/review/assessments/{documentId}` is 398,901, within its own 460,000 budget.
  - The released route `/app/assessments/{documentId}` has no budget. It now loads the Export button, about 14 KB more delivered (estimated 260,165 to 274,435).

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] The first report build pushed `/app/requests/{documentId}` over its budget**
- **Found during:** the budget measurement after Task 3.
- **Issue:** `performance.spec.ts` measured `/app/requests/{documentId}` at 300,450 and `/app/risks/{documentId}` at 299,979.
  - The report document imported two `'use client'` modules from a Server Component: the shadcn `Table` and `HorizontalScrollRegion`.
  - That made every export of both a client entry. The table module grew 1,326 to 1,679 bytes (TableCaption and TableFooter were no longer tree-shaken), and it sits in two chunks of the requests route.
  - It also moved the scroll-region hook (module 3456, 1,733 bytes) from one shared chunk into two chunks of that route.
  - Found by rebuilding the pre-plan sources into `.tmp` and comparing module placement chunk by chunk.
- **Fix:** the overview table and its named scroll region are plain server markup with the same classes. A test now keeps the document free of both modules.
- **Files:** `assessment-report.tsx`, `assessment-report.test.tsx`.
- **Commit:** `0266583b`.

**2. [Rule 3 - Blocking] Tests that import the analyst page could not load the export Server Action module**
- **Found during:** Task 3.
- **Issue:** `export-actions.ts` reads `parseAssessmentCollectionQuery` and `parseQuestionnaireListQuery` when it loads. Three existing test files mock those services without them: `analyst-route-gate.test.tsx`, `ai-inputs-changed.test.tsx` and `record-route-titles.test.ts`.
- **Fix:** each mocks `@/features/exports/export-actions`. `analyst-assessment-route.test.tsx` also mocks `viewerCapabilities`, which the released header reads. No assertion changed.
- **Commit:** `5b5feaaa`.

**3. [Rule 3 - Blocking] A source-structure test named the reads in the released page**
- **Found during:** Task 1.
- **Issue:** `released-assessment.test.tsx` checked that the page source names the released reads. The plan moves those reads into the loader.
- **Fix:** the test now checks the Requestor loader's body for the released reads, with no analyst reads. The page must call `loadRequestorReleasedAssessment` and `notFound()`.
- **Commit:** `dcce6a74`.

**4. [Rule 1 - Bug] The refused-Requestor journey looked for the sidebar's `navigation` landmark**
- **Found during:** the first Task 4 run. One mobile failure: at 375 the sidebar is a drawer.
- **Fix:** the journey now checks the not-found inside the `main` landmark, plus the `.shell`.
- **Result:** the re-run passed 40 of 40. Fixed before the Task 4 commit.

### Plan differences (written ahead; I followed the executed code)

- **Two new modules not in `files_modified`:**
  - `assessment-report-model.ts`: the pure model, re-exported by the loader.
  - `released-assessment-actions.tsx`: the shared header actions.
- **The capability is not a prop of `released-assessment.tsx`.** The page reads `released-assessment:export` (as Home does) and passes the rendered action group as a `headerAction` slot. The editor already worked this way.
  - The key link's `exportReleasedAssessmentAction` is therefore bound in `released-assessment-actions.tsx`, not `released-assessment.tsx`.
  - This keeps the client view free of a Server Action import, as 19-11's placement pattern does.
- **`loadAnalystReleasedAssessment` was written in Task 1** with the rest of the loader module. Task 3's loader RED cases passed at RED. Its route, page and editor cases failed as expected.
- **`PHASE_19_BASE` does not exist as a git ref.** The no-new-colour check ran against the plan's base `16d00311`: `globals.css` adds no hex or `rgb(` value.
- **The toolbar's eyebrow and `data-print="hidden"`** sit on a wrapper around the shared `PageHeader`. `PageHeader` itself is unchanged: it is shared by the tight-budget routes.

**Total deviations:** 4 auto-fixed (2 Rule 1, 2 Rule 3), plus the plan differences above.
**Impact on plan:** none on scope. The budget fix made the document ship no table code at all.

## Issues Encountered

- **An analyst reading their own request's released assessment on the My route** (`/app/assessments/{id}`, `actor: 'analyst'`) gets a report with no AI notice in Notes. That projection carries no AI fact (12-UI-SPEC §10.2). The review route's report shows the notice, using Strapi's rule.
- **The released route has no budget and gained about 14 KB** with the Export button (see Route budgets).

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- 19-13 to 19-15 can proceed. Neither tight route lost headroom: 151 and 490 bytes left.
- Phase 17 can make the released view stage-aware through the same loader and the `headerAction` slot.
- The 25-risk paper backstop (D5) needs a person to read a printed or saved PDF at verify-work.

## Self-Check: PASSED

- All seven key created files exist.
- All eight task commits exist: `8f300575`, `dcce6a74`, `b5fefa93`, `753f5ac8`, `d3ea2bcb`, `5b5feaaa`, `0266583b`, `583851ed`.
- `git rev-list --count 16d00311..583851ed` = 8.

---
*Phase: 19-csv-export-and-import-hardening*
*Completed: 2026-10-17*
