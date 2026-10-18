---
phase: 19-csv-export-and-import-hardening
plan: 11
subsystem: exports
tags: [csv-export, xlsx, export-dialog, server-actions, capabilities, export-placement, reports, released-assessment, served-operations, playwright, route-budgets]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-06: ExportButton, ExportDialog (fixedTables), exportRiskRegisterAction, exportRiskRegister, the export placement pattern, risk-register:export and the served-anchor check; 19-04: the web export vocabulary (views, reports, tables.released-assessment); 19-02: exportRefusal (family S1); 19-07 to 19-10: the eight served export operations and their generated types"
provides:
  - "Service functions exportReport (report-service), exportReviewRequests, exportRiskAssessments, exportMyRiskAssessments, exportReleasedAssessment (assessment-service), exportMyRequests (request-service), exportQuestionnaires, exportMyQuestionnaires (questionnaire-service), exportAlerts (alert-service), each registered as a file response"
  - "features/exports/export-file-check.ts: checkExportResponse, listExportParams, ExportResult, ExportedFile, EXPORT_FILE_CONTENT_TYPES (the one binary check every export service uses; exportRiskRegister moved onto it)"
  - "Server Actions exportReviewRequestsAction, exportMyRequestsAction, exportQuestionnairesAction, exportMyQuestionnairesAction, exportRiskAssessmentsAction, exportMyRiskAssessmentsAction, exportAlertsAction, exportReportAction(reportKey, input), exportReleasedAssessmentAction(assessmentId, input)"
  - "Nine export capabilities with anchors and development grants: reports:export, assessment-requests:export, my-requests:export, questionnaires:export, my-questionnaires:export, risk-assessments:export, my-risk-assessments:export, alerts:export, released-assessment:export"
  - "lib/capabilities/viewer-capabilities.ts: viewerCapabilities (cached session read, shared by the review gate and the lists' Export)"
  - "features/exports/list-export-button.tsx: ListExportButton (a list header's Export from the read's total, page count and chips)"
  - "ExportButton `scope` prop and export-scope.ts exportReportScopeSentence (a fixed-table view's §2.2 sentence)"
  - "Server-only chip builders: reviewQueueFilterChips, assessmentCollectionFilterChips, questionnaireFilterChips, myRequestFilterChips, alertFilterChips"
  - "An optional `action` on AlertsPageHeader, AssessmentRequestListHeader, AssignedRequestListHeader and AssessmentListHeader"
  - "Two Playwright journeys: list exports @journey, analyst exports refused to a Requestor @journey"
affects: [19-12, 19-14, 19-15]

actuals:
  tokens: 34000
  tasks: 3
  commits: 6

plan_head_before: e1d9699f94a6412aa7c13c57ef9a2b3f5f4e4bff
plan_head_after: da26755abadc459a0e885318fdf0f957e9a07cd8

tech-stack:
  added: []
  patterns:
    - "A fixed-table view's Server Action is bound on the page to its record key (exportReportAction.bind(null, reportKey); 19-12 binds exportReleasedAssessmentAction to the assessment id), so the dialog's input stays { query, format, table? }"
    - "A list header's Export is rendered by the data component after the read through ListExportButton, which strips page, page size and unset values from the parsed query"
    - "Chip builders for the dialog live server-only beside each feature; a test renders each client list with every filter and proves its chips equal the builder's"

key-files:
  created:
    - apps/csrm/src/features/exports/export-file-check.ts
    - apps/csrm/src/features/exports/list-export-button.tsx
    - apps/csrm/src/features/exports/export-services.test.ts
    - apps/csrm/src/features/exports/list-export-placement.test.tsx
    - apps/csrm/src/features/assessments/assessment-list-chips.ts
    - apps/csrm/src/features/alerts/alert-list-chips.ts
    - apps/csrm/src/features/questionnaires/questionnaire-list-chips.ts
    - apps/csrm/src/features/requests/my-request-chips.ts
    - apps/csrm/src/lib/capabilities/viewer-capabilities.ts
  modified:
    - apps/csrm/src/features/exports/export-actions.ts
    - apps/csrm/src/features/reports/report-service.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/requests/request-service.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.ts
    - apps/csrm/src/features/alerts/alert-service.ts
    - apps/csrm/src/features/risks/risk-service.ts
    - apps/csrm/app/(app)/app/reports/[reportKey]/page.tsx
    - apps/csrm/app/(app)/app/alerts/page.tsx
    - apps/csrm/app/(app)/app/review/requests/page.tsx
    - apps/csrm/app/(app)/app/review/assigned/page.tsx
    - apps/csrm/app/(app)/app/review/assessments/page.tsx
    - apps/csrm/app/(app)/app/review/questionnaires/page.tsx
    - apps/csrm/app/(app)/app/requests/page.tsx
    - apps/csrm/app/(app)/app/questionnaires/page.tsx
    - apps/csrm/app/(app)/app/assessments/page.tsx
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/alerts/alerts-page-header.tsx
    - apps/csrm/src/components/csrm/export/export-button.tsx
    - apps/csrm/src/components/csrm/export/export-dialog.tsx
    - apps/csrm/src/features/exports/export-scope.ts
    - apps/csrm/src/lib/capabilities/capability-adapter.ts
    - apps/csrm/src/lib/capabilities/development-capabilities.ts
    - apps/csrm/src/lib/capabilities/strapi-capabilities.ts
    - apps/csrm/src/lib/capabilities/analyst-review-gate.ts
    - docs/references/served-operations.json
    - apps/csrm/e2e/exports-and-imports.spec.ts

key-decisions:
  - "Fixed-table actions (reports, released assessment) take their record key as a bound first argument, not an input field, so the shared dialog sends the same { query, format, table? } for every view"
  - "The export dialog words a fixed-table view's scope from a `scope` prop the page builds (§2.2 report sentence), and reads no list view meta for fixed tables"
  - "The released assessment's CSV takes only risks or mitigation-controls (the specification's table enum); the summary travels in the workbook only"
  - "Every development fixture holds the four Requestor-birthright exports (my-requests, my-questionnaires, my-risk-assessments, released-assessment), as Strapi grants them to role.requestor; the analyst exports belong to the two Security Analyst fixtures only"
  - "Chip builders for the Export are server-only; the client lists keep their own chips unchanged, guarded by a rendered parity test"

patterns-established:
  - "Export placement on a Suspense list page: static header in the fallback, data component renders header + Export after the read, capability read through viewerCapabilities()"

requirements-completed: []

coverage:
  - id: D1
    description: "A report exports from its page: workbook of its tables, or one CSV table chosen in the dialog; no columns"
    requirement: CSV-01
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/reports/reports-pages.test.tsx#the report header’s Export (19-11)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/exports-and-imports.spec.ts#list exports @journey"
        status: pass
    human_judgment: false
  - id: D2
    description: "Requests, Assigned to me, Questionnaires, Risk assessments, Alerts, My requests, My questionnaires and My risk assessments carry Export last in their header, only with the list's own export capability and a successful read"
    requirement: CSV-01
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/exports/list-export-placement.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/alerts/alerts-page.test.tsx#the Alerts header’s Export (19-11)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/exports-and-imports.spec.ts#list exports @journey"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nine export services and actions (binary parse, shared file check, own query schema, closed format and columns)"
    requirement: CSV-01
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/exports/export-services.test.ts; apps/csrm/src/features/exports/export-actions.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Gated pages show no Export to a Requestor"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/exports-and-imports.spec.ts#analyst exports refused to a Requestor @journey"
        status: pass
    human_judgment: false

duration: 59min
completed: 2026-10-17
---

# Phase 19 Plan 11: Every list exports from its page Summary

**Nine typed export services and Server Actions, nine export capabilities and the header Export on the report pages and eight lists, placed by the export placement pattern; the route budgets lost about 130 bytes of headroom to a Turbopack chunk regrouping, reported below for a pilot decision.**

## Performance

- **Duration:** 59 min
- **Started:** 2026-10-16T22:04:20Z
- **Completed:** 2026-10-16T23:03Z
- **Tasks:** 3 of 3
- **Commits:** 6 (2 RED, 2 GREEN, 1 browser test, 1 fix)

## Accomplishments

- **Services.** `exportReport(reportKey, { format, table?, timeZone?, query })` POSTs the closed body. The eight GET exports send each list's own parameters without a page. `exportReleasedAssessment` sends `table` for CSV only. Every service reads with `parseAs: 'arrayBuffer'` and returns through the shared `checkExportResponse` (export rule, row-count header). Each is registered as a `fileResponses` entry of its module, so the parity guard holds all ten export operations against the two media types.
- **Actions.** One per view in `export-actions.ts`. Each parses with the list's own parser: `parseAssessmentRequestReviewQuery`, `requestListQuerySchema`, `parseQuestionnaireListQuery`, `parseAssessmentCollectionQuery`, or `alertListQuerySchema` without page and page size. Each takes a closed format and the view's vocabulary columns, refuses page, page size and unknown keys, reads the viewer's zone, and words refusals with `exportRefusal`. `exportReportAction` and `exportReleasedAssessmentAction` take no columns, and a table for CSV only.
- **Header Export by data component and capability:**

  | Page | Data component rendering the header Export | Capability checked |
  | --- | --- | --- |
  | `/app/reports/{reportKey}` | `ReportDetailContent` (period control, then Export) | `reports:export` |
  | `/app/alerts` | `AlertsContent` | `alerts:export` |
  | `/app/review/requests` | `AssessmentRequestListContent` | `assessment-requests:export` |
  | `/app/review/assigned` | `AssignedRequestListContent` (view `requests`, visible columns without `assignee`) | `assessment-requests:export` |
  | `/app/review/assessments` | `AssessmentListContent` | `risk-assessments:export` |
  | `/app/review/questionnaires` | `QuestionnaireReviewsPage` (header and list together) | `questionnaires:export` |
  | `/app/requests` | `RequestsPage` (`New request`, then Export) | `my-requests:export` |
  | `/app/questionnaires` | `QuestionnairesPage` | `my-questionnaires:export` |
  | `/app/assessments` | `AssessmentsPage` | `my-risk-assessments:export` |

  `released-assessment:export` and `exportReleasedAssessmentAction` are ready for 19-12's two released headers. The five Suspense pages keep the static header in the fallback, with no action except the throughput period control.
- **Capabilities.** Nine strings appended to the tuple, each anchored to its list read and its export as the catalogue writes them. Development grants: the analyst exports go to the two Security Analyst fixtures, and the four birthright exports to every fixture. `capabilitiesFromOperations` grants each only with both anchors. The served-anchor check passes with every new anchor (served inventory regenerated twice).

## Task Commits

1. **Task 1: a report exported from its page (tracer)**
   - RED `b5bec056`: `test(19-11): expect a report to export one CSV table from its page`
   - GREEN `ff892156`: `feat(19-11): export reports from their pages`
   - Tracer gate: the verify was re-run end to end before expanding. It passed.
2. **Task 2: the other eight services, actions and pages**
   - RED `c5590702`: `test(19-11): expect every list to export from its page`
   - GREEN `4883f5fd`: `feat(19-11): export every list from its page`
3. **Task 3: the browser journeys**
   - `5e09254c`: `test(19-11): prove the list exports and the gated pages in the browser`
   - Fix `da26755a`: `fix(19-11): keep the client lists unchanged and word the Export's chips on the server` (deviation 5)

## Verification

| Step | Command | Result |
| --- | --- | --- |
| Task 1 RED | vitest exports, reports, capabilities, export | 29 failed, as expected |
| Task 1 GREEN | `vitest run src/features/exports src/features/reports src/lib/capabilities` (plus export, risks, parity, chain), typecheck, lint | 24 files, 651/651 passed; typecheck and lint 0 |
| Task 2 RED | vitest exports, capabilities, alerts, parity, chain, export | 97 failed, as expected |
| Task 2 GREEN | the plan's verify: focused files, `pnpm --dir apps/csrm test`, typecheck, lint | focused 15 files, 491/491; full web suite 242 files, 6,208/6,208; typecheck and lint 0 |
| After the fix | full web suite, typecheck | 242 files, 6,216/6,216; typecheck 0 |
| Task 3 | `pnpm --dir apps/csrm test:e2e e2e/exports-and-imports.spec.ts`, then the tree check | 8 passed (desktop 4, mobile 4), 0 failed, 0 flaky, 1.6 min; tree check OK. Re-run on the final tree after the fix: the same 8/8. |
| Served inventory | `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (twice) | 11 pass, 1 skipped (the write marker); every export now lists its web caller |

- **One-row register export (19-06's journey):** 78 ms at 1440 and 73 ms at 375.
- **Static checks:** no `route.ts` added under `apps/csrm/app`. `data-table.tsx`, `page-header.tsx` and `status-badge.tsx` are unchanged.

## Route budgets (performance.spec.ts, delivered JS against 300,000 bytes)

| Build | `/app/risks/{documentId}` | `/app/requests/{documentId}` | `/app` |
| --- | --- | --- | --- |
| After 19-06 (brief) | 299,718 (282 left) | 299,378 (622 left) | n/a |
| Pre-plan `e1d9699f` (measured here) | 299,722 (278) | 299,380 (620) | 230,171 |
| After Task 1 `ff892156` | 299,712 (288) | 299,385 (615) | 230,169 |
| Final `da26755a` | **299,849 (151)** | **299,517 (483)** | 230,298 |
| Final with the eight lists' Export stubbed (experiment) | 299,718 (282) | 299,385 (615) | 230,172 |

- **The two routes lost about 130 bytes of headroom in Task 2.** Every route grew by about 127 bytes, `/app` included.
- **No code added to those routes causes it.**
  - In the kept build, no client chunk of these routes holds an Export capability string or the ExportButton.
  - The growth is a Turbopack regrouping of the shell's modules between two chunks that every route loads. Ten modules moved: the navigation guard, the draft storage, the radix `Dialog` re-export and three lucide icons among them. The decoded total of the two chunks is identical (62,841 bytes before and after). The regrouped chunks compress about 125 bytes worse.
- **The trigger** is `ExportButton`, and with it the dynamically loaded export dialog, becoming reachable from nine more routes. Stubbing `ListExportButton` restores 282 and 615 exactly.
- **Two attempts did not move it:**
  - splitting `can()` out of the capability tuple module (reverted, since the tuple was never in a client chunk);
  - returning the six client lists to their pre-plan code (kept as `da26755a`, because it leaves the lists untouched).
- **Both routes stay within budget** and `performance.spec.ts` passes (11/11). The orchestrator's "must not shrink" is not met. This needs a pilot decision (see Issues).

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] The dialog could not show a report's scope**
- **Found during:** Task 1.
- **Issue:** the 19-06 dialog read `exportViewMeta(view)`, which throws for a report, and had no fixed-table scope sentence. The plan's behaviour needs `The {report title} report as at {date}{, for {period}}, with its {t} tables.` (§2.2).
- **Fix:** `ExportButton` gained an optional `scope`, and the dialog uses it for fixed tables and skips list meta. Added `exportReportScopeSentence`, with a dialog test.
- **Files:** `export-button.tsx`, `export-dialog.tsx`, `export-scope.ts`, `export-dialog.test.tsx`.
- **Commits:** `b5bec056`, `ff892156`.

**2. [Rule 2 - Maintainability] One binary check for every export**
- **Found during:** Task 1.
- **Issue:** the file and row-count check sat privately in `risk-service.ts`. Nine more copies would have drifted.
- **Fix:** extracted `export-file-check.ts` (`checkExportResponse`, `listExportParams`, the result types). `exportRiskRegister` uses it, and its tests are unchanged and green.
- **Commit:** `ff892156`.

**3. [Rule 3 - Blocking] A fixed-table action needs its record key**
- **Found during:** Task 1.
- **Issue:** the dialog sends `{ query, format, table? }` for every view.
- **Fix:** the record key is bound on the page (`exportReportAction.bind(null, reportKey)`), as 19-12's plan already expects for the released assessment. The plan wrote `exportReleasedAssessmentAction({ assessmentId, format, table? })`; it is `(assessmentId, { query?: {}, format, table? })`.
- **Commit:** `ff892156`.

**4. [Rule 2] A shared capability read**
- **Found during:** Task 2.
- **Issue:** the list pages needed the session's granted set beside the review gate.
- **Fix:** added `viewer-capabilities.ts` (cached `viewerCapabilities()`, read as Home reads it). `canViewerReviewAssessments` now uses it, with unchanged behaviour.
- **Also added in Task 2:**
  - `list-export-button.tsx`, so the eight lists build the dialog's props one way;
  - the test file `list-export-placement.test.tsx` for the seven non-alert pages (the plan named only `alerts-page.test.tsx`).
- **Commit:** `4883f5fd`.

**5. [Rule 1] Chips moved out of the client lists**
- **Found during:** Task 3's budget measurement.
- **Issue:** Task 2 first moved each list's chips into shared modules that the client lists imported.
- **Fix:** the six client lists are back to their pre-plan code (`alert-list`, `request-table`, both questionnaire lists, `released-assessment`, and `assessment-list` apart from the header `action` props). The chip builders are server-only, and a rendered parity test proves each list's chips equal its builder's.
- **Effect:** this did not recover the budget bytes (see Route budgets), but it keeps client code unchanged.
- **Commit:** `da26755a`.

**6. Test-only fixes:**
- `export-services.test.ts` expected the CSV content type with its charset; the validator returns the essence `text/csv`.
- `alerts-page.test.tsx` matched one record link; the table and card both render it.

**7. [Pilot ruling 2026-10-17] Route-budget headroom lost to chunk regrouping (accepted for Phase 19)**
- **Found during:** Task 3's budget measurement (see "Route budgets" above).
- **Numbers (delivered JS against 300,000 bytes):** `/app/risks/{documentId}` 299,722 (278 left) before the plan, 299,849 (151 left) after; `/app/requests/{documentId}` 299,380 (620 left) before, 299,517 (483 left) after; `/app` 230,171 before, 230,298 after. Stubbing the eight lists' Export restores 299,718 and 299,385 exactly.
- **Cause:** `ExportButton` reaching nine more routes regroups the shell's Turbopack modules between two chunks every route loads; the decoded total is identical (62,841 bytes) and the new grouping compresses about 125 bytes worse. No code was added to either route.
- **Ruling:** the pilot accepted it as chunking variance for Phase 19 (option a). Lazy loading the list Export (option c) is rejected: a primary action that flashes or disables itself falls below the G-4 bar. Reclaiming the headroom by analysing the shared shell chunks (option b) is scheduled as a pilot-run GSD quick task after Phase 19 closes and before Phase 19.1 (`deferred-items.md`). For 19-12 to 19-15, both routes are measured after each plan, and a plan that would push either over 300,000 bytes stops and reports.
- **Commits:** `4883f5fd`, `da26755a`.

### Plan text differing from the executed code

- **Report vocabulary function name.** The vocabulary's `exportReport(reportKey)` shares its name with the new service `exportReport`, so pages and actions import it as `reportExportSpec`.
- **Export file names.** Report CSV files are named `{reportKey}-{table slug}-{date}.csv` (19-09's `reportExportTables`), which matches the journey's `risk-exposure-residual-rating-by-treatment-status-YYYY-MM-DD.csv`.
- **Static review headers.** The three headers live in the client module `assessment-list.tsx` and gained `action?: React.ReactNode`.

## Issues Encountered

- **Route budget headroom shrank by about 130 bytes** (282 to 151 on `/app/risks/{documentId}`, 622 to 483 on `/app/requests/{documentId}`). The cause is the chunk regrouping set out above, not code added to those routes. Recorded first as a STATE blocker; the pilot ruled on 2026-10-17 (deviation 7): accept it for Phase 19 and reclaim the headroom in a quick task after the phase. The options were:
  - accept it as chunking variance;
  - pin or shape Turbopack's chunking for the shell;
  - load the list Export differently.
- **Server log noise.** The Next server logged `Error: The destination stream closed early.` about 19 times during the Playwright runs, including in 19-06's register journey. No test failed.
- **Kept artifacts removed.** I removed the artifacts my `CSRM_E2E_KEEP_ARTIFACTS=1` run kept (`playwright-*-b1eee651…`). The earlier kept builds were left alone.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, Route Handler or raw `fetch`. Every action re-parses its input (T-19-36); every file passes `exportFileRule` (T-19-37); Export renders only from the data component with its own capability and a successful read (T-19-38).

## Next Phase Readiness

- 19-12 can place `Print report` and `Export {number}` on both released headers. It can use `exportReleasedAssessmentAction.bind(null, id)`, `released-assessment:export`, `fixedTables` from `tables.released-assessment` (CSV tables `risks` and `mitigation-controls`) and the new `scope` prop.
- CSV-01 is not marked complete, per the brief: it is delivered across the phase until 19-15.

## Self-Check: PASSED

All created files exist; commits b5bec056, ff892156, c5590702, 4883f5fd, 5e09254c and da26755a are in the history.
