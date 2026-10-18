---
phase: 19-csv-export-and-import-hardening
plan: 06
subsystem: exports
tags: [csv-export, xlsx, risk-register, export-dialog, column-choice, server-action, file-response, capabilities, playwright]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-05: the served GET /v1/risks/export, its two declared media types and catalogue URL; 19-04: the export vocabulary and EXPORT_ROW_CAP; 19-02: exportRefusal and ExportRefusalCopy (family S1), TransportError.rowCount and rowCap"
  - phase: 14-request-attachments
    provides: "the shared file-response validator, the parity guard's file-response mode, saveFile, the binary-service and download-action precedents"
  - phase: 11-ux-and-navigation
    provides: "Home's capability choice, PageHeader's action slot, the register's filter chips"
provides:
  - "lib/files/file-response.ts: exportFileRule(format), EXPORT_RESPONSE_CONTENT_TYPES, EXPORT_RESPONSE_MAX_BYTES (64 MiB), ExportFileFormat, the utf8-bom signature"
  - "features/risks/risk-service.ts: exportRiskRegister, RiskRegisterExportQuery, ExportedFile, ExportFileCheckError, ExportResult; the file-response registration risks.exportRiskRegister"
  - "features/exports/export-actions.ts: exportRiskRegisterAction, ExportActionResult"
  - "features/exports/export-scope.ts: EXPORT_ROW_LIMIT, exportScopeSentence, exportFilterLines, exportDialogState, the empty, over-limit and format-hint words, the remembered format"
  - "components/csrm/export/: ExportButton (with ExportFilterChip, ExportFixedTable), ExportDialog (default export for next/dynamic), ColumnChoice"
  - "features/risks/risk-register-chips.ts: riskRegisterFilterChips and treatmentStatusFilterLabel, shared by the register table and the page header's Export"
  - "the risk-register:export capability, anchored to GET:/api/v1/risks and GET:/api/v1/risks/export?format={format}; the two development analysts hold it"
  - "the register page renders its PageHeader inside the Suspense-wrapped RiskRegisterContent, with Export only for a granted session and a data read"
  - "e2e/exports-and-imports.spec.ts with the register export journeys; the mobile project runs it"
affects: [19-07, 19-08, 19-09, 19-10, 19-11, 19-12, 19-15, phase-18]

actuals:
  tokens: 31400
  tasks: 4
  commits: 6

plan_head_before: bb33e19f69ee6bd81fbb5dc50b9050105aee33dd
plan_head_after: 3f0251e685bc7c7eb5518e234bc197bf534b20dd

tech-stack:
  added: []
  patterns:
    - "An export is a typed service with parseAs arrayBuffer, the shared validator's exportFileRule and the X-CSRM-Row-Count header, behind one 'use server' action per view that parses the view's own query schema, a closed format and a unique subset of the view's vocabulary"
    - "A list page renders its PageHeader inside the Suspense-wrapped data component, so the header's Export reads the list read's own total, search and chips; the Suspense fallback keeps a static header with no action"
    - "The export dialog's form mounts with each opening (Radix unmounts closed content), so refusals and column choices never outlive an opening; the format is read from localStorage on each mount"
    - "Closing while an export is pending discards the result through an alive ref; no file is saved and no toast shows"

key-files:
  created:
    - apps/csrm/src/features/exports/export-actions.ts
    - apps/csrm/src/features/exports/export-actions.test.ts
    - apps/csrm/src/features/exports/export-scope.ts
    - apps/csrm/src/components/csrm/export/export-button.tsx
    - apps/csrm/src/components/csrm/export/export-dialog.tsx
    - apps/csrm/src/components/csrm/export/column-choice.tsx
    - apps/csrm/src/components/csrm/export/export-dialog.test.tsx
    - apps/csrm/src/features/risks/risk-register-chips.ts
    - apps/csrm/e2e/exports-and-imports.spec.ts
  modified:
    - apps/csrm/src/lib/files/file-response.ts
    - apps/csrm/src/lib/files/file-response.test.ts
    - apps/csrm/src/features/risks/risk-service.ts
    - apps/csrm/src/features/risks/risk-service.test.ts
    - apps/csrm/app/(app)/app/risks/page.tsx
    - apps/csrm/src/features/risks/risk-register-page.test.tsx
    - apps/csrm/src/features/risks/risk-register.tsx
    - apps/csrm/src/features/risks/risk-register-filters.tsx
    - apps/csrm/src/lib/capabilities/capability-adapter.ts
    - apps/csrm/src/lib/capabilities/capability-adapter.test.ts
    - apps/csrm/src/lib/capabilities/development-capabilities.ts
    - apps/csrm/src/lib/capabilities/strapi-capabilities.ts
    - apps/csrm/src/lib/capabilities/strapi-capabilities.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - docs/references/served-operations.json
    - apps/csrm/playwright.config.ts

key-decisions:
  - "ExportButton takes the page's parsed query (without page and pageSize) as a query prop, which the dialog sends to the action; the plan's prop list named no query, and the action's input contract { query, format, columns? } needs it"
  - "The action refuses a query naming page or pageSize (z.record refine, then the register's own riskRegisterQuerySchema through pipe) rather than stripping them, so the shared schema is used unchanged and never re-shaped with omit"
  - "The utf8-bom signature requires the BOM and Strapi's text rule (valid UTF-8, no NUL, no executable header)"
  - "A missing or malformed X-CSRM-Row-Count (not 0 to 10,000 in digits) is a file-check failure 'row-count', worded as the failed file (S1, Try again)"
  - "The scope sentence and the over-limit body use the singular record noun and 'matches' for one record ('1 risk that matches ...'); the noun is the vocabulary's plural without its final s"
  - "The success toast is sonner's toast.success with the description and the direction's 5s duration"
  - "Columns are always sent as the checked keys in the view's order, including when they equal the visible default"

patterns-established:
  - "ExportButton({ heading, view, action, query, total, searchActive, search, chips, multiplePages, visibleColumns?, fixedTables? }); later list exports pass their own action, query and chips; fixed-table views pass fixedTables and the dialog sends { query, format, table? }"
  - "export-dialog.test.tsx's openDialog(user, overrides) helper and the ResizeObserver stub (installTestResizeObserver) for Radix radio groups in jsdom"

requirements-completed: []

duration: 41min
completed: 2026-10-17
---

# Phase 19 Plan 06: The Risk register export in the web Summary

**Bob exports the filtered Risk register from its header: a lazily loaded X-30 dialog with the scope sentence, Format, the column-choice primitive and every §2.5 and §2.6 state calls a validated Server Action, whose typed binary service checks the server's file with the new export rule, and the browser saves `risk-register-{date}.xlsx` or the BOM CSV under the server's name with an `Exported {file name}` toast; the header shows Export only for a session granted `risk-register:export` whose register read returned data.**

## Performance

- **Duration:** 41 min (2026-10-16T16:44Z to 17:25Z UTC)
- **Tasks:** 4 of 4
- **Files:** 9 created, 17 modified

## Accomplishments

- **Validator.** `exportFileRule(format)` accepts only the format's essence (`text/csv` or the XLSX type), a name matching `^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$` with the format's extension, at most 67,108,864 bytes, and `utf8-bom` (CSV) or `zip` (XLSX). `EXPORT_RESPONSE_CONTENT_TYPES` is exactly `{ csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }`. `attachmentFileRule` is unchanged.
- **Service.** `exportRiskRegister({ query, format, columns?, timeZone? })` sends the register's canonical query without page and page size, plus `format`, `columns` (comma-joined) and `timeZone` only when given, with `parseAs: 'arrayBuffer'`. It returns `{ fileName, contentType, bytes: Uint8Array, rowCount }`, the transport error (with `reason`, `rowCount`, `rowCap`), or `{ kind: 'file-check', failure }`.
- **File-response registration shape** (in `risk-service.ts`'s `responseParserModule`, mode `parsers`): `fileResponses: [{ label: 'risks.exportRiskRegister', path: '/v1/risks/export', method: 'get', contentTypes: Object.values(EXPORT_RESPONSE_CONTENT_TYPES) }]`. The parity guard resolves it against the specification's two 200 media types, with `checkFileResponse` unchanged, and refuses a registration that drops the CSV's charset parameter.
- **Action.** `exportRiskRegisterAction` (`'use server'`) refuses `page`, `pageSize`, an unknown or repeated column, no column, `format: "pdf"`, an invalid date range, an unknown property and no input with the S1 400 copy without calling the service. It passes the viewer's zone only when known and words a 422 as `This export would hold 12,500 rows, more than the 10,000 limit. …`.
- **Dialog (X-30).**
  - The parts, in order: the four §2.2 scope sentences with the `Search: “…”` and `Filters: … · …` lines, then `Format` (XLSX default, last choice in `csrm.export.format`, with a try/catch fallback to XLSX) and its hints.
  - Then `Table` for fixed tables while CSV is checked (its choice kept), and `ColumnChoice` (8 of 21 checked for the register, `Select all`, `Reset to visible`, the none-checked error) or the every-column line.
  - The states: the empty lines and the over-the-limit warning disable and describe `Export file`. `Exporting…` keeps the choices read-only and `Cancel` enabled, and cancelling discards the result.
  - Refusals: S1 alerts in the warning or danger tone, with focus on the title and `Try again` re-sending the same input.
  - Focus and keyboard: focus starts on the checked format, Enter submits from a radio or checkbox, and Escape returns focus to Export.
  - Below 768px it is a full-screen sheet with a title row, `Close` and the actions stacked with `Export file` first.
- **Placement.** `RisksPage` keeps the static header only in the Suspense fallback. `RiskRegisterContent` renders the header above the gate, the invalid-filter state, the fixture states and the table, and passes `ExportButton` only when `can('risk-register:export', granted)` holds and `listRiskRegister` returned data. The button receives the read's own `total` and `pageCount > 1`, the search and the chips other than the search, so no second read counts the rows.
- **Capability.** `risk-register:export` is appended to the tuple and anchored to `GET:/api/v1/risks` and `GET:/api/v1/risks/export?format={format}`. The development Security Analyst and Second Security Analyst hold it; the Requestor and Secondary Requestor do not. The served-anchor check compares each anchor without its `?…` template, and the regenerated inventory lists `src/features/risks/risk-service.ts` as the export's web caller.

## Measured

- **One-row export (Playwright, Export file click to the browser's download event):** 78 ms at 1440, 65 ms at 375.
- **Route budgets (performance.spec.ts, delivered JS against 300,000 bytes):**

  | Route | Delivered JS (bytes) | Headroom (bytes) |
  | --- | --- | --- |
  | `/app/risks` | 279,600 | 20,400 |
  | `/app/risks/{documentId}` | 299,718 | 282 |
  | `/app/requests/{documentId}` | 299,378 | 622 |

  The brief recorded 289 and 558 bytes of headroom for the two near-limit routes. `risk-register:export` appears in no client chunk of the build (grep of the kept build's `static/`), while `administration:manage` does, through the navigation config. So the small movement on both routes, 7 bytes down on one and 64 up on the other, is build-to-build variance, not code this plan added. The dialog, column choice and vocabulary load only through `next/dynamic`.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 1 RED | vitest on files, risk-service, page, capabilities, exports, export | 17 failed, 89 passed; export-actions and export-dialog failed to import (modules absent) |
| 1 GREEN | the plan's verify: node 24.19 check, vitest `src/lib/files src/features/risks/risk-service.test.ts src/features/risks/risk-register-page.test.tsx src/lib/capabilities src/features/contract-operation-chain.test.ts src/features/exports src/components/csrm/export`, typecheck, lint | 12 files, 129 passed, 0 failed, 0 skipped; typecheck and lint clean; EXIT 0. Also `src/features/risks`, the parity guard, shell, navigation and testing suites: 29 files, 723 passed |
| 2 RED | vitest `src/components/csrm/export` | failed to import `@/features/exports/export-scope` (module absent) |
| 2 GREEN | the plan's verify: node check, vitest `src/components/csrm/export src/features/exports`, typecheck, lint | 4 files, 59 passed, 0 failed (the dialog file 27); EXIT 0 |
| 3 | the plan's verify: node check, vitest parity + chain + capabilities + copy guard, `pnpm --dir apps/csrm test`, typecheck | guards 5 files, 506 passed; full web suite 240 files, 6,048 passed, 0 failed, 0 skipped; typecheck clean; EXIT 0 |
| 4 | the plan's verify: node check, `test:e2e e2e/exports-and-imports.spec.ts e2e/performance.spec.ts e2e/design-contract.spec.ts`, then the tree check (after the task commit) | 17 passed, 0 failed, 0 flaky, 0 skipped (desktop 15, mobile 2) in 3.6 min (217 s wall with build); E2E_EXIT=0; tree check 0, only the verification ledger modified |

Acceptance checks:
- `export-actions.ts` begins with `'use server'` and imports `readViewerTimeZone`.
- `git diff --name-only --diff-filter=A bdd0f698..HEAD -- apps/csrm/app` lists no `route.ts`.
- `risk-service.ts` holds `parseAs: 'arrayBuffer'` and `exportFileRule`.
- The page holds `can('risk-register:export'` inside `RiskRegisterContent`, and its fallback header has no `action`.
- The tuple holds `'risk-register:export'`, and only the two analyst fixtures are granted it.
- `strapiCapabilities.test.ts` and the inventory row (`webCallers: ["src/features/risks/risk-service.ts"]`) changed in `4fca35fa`.
- The three components start with `'use client'`, import no zod and hold no hex, `rgb(` or arbitrary colour; `export-scope.ts` has no directive.
- The dialog test names include `over the limit`, `remembered format`, `phone sheet` and `focus returns`.
- `checkFileResponse` has no changed line since `bdd0f698`.
- The copy guard lists `src/components/csrm/export/export-dialog.tsx`.
- The spec arms `waitForEvent('download')` before each `Export file`, builds its suffix from `Date.now().toString(36)` and the project name, and opens `/app/risks?q=export-{suffix}`.
- No content-type file changed since `bdd0f698`.

## Task Commits

1. **Task 1: the register's Export from the header to a saved file.** `2530e726` (test, RED), `4fca35fa` (feat, GREEN)
2. **Task 2: the full X-30 dialog.** `7e07f645` (test, RED), `319d4c44` (feat, GREEN)
3. **Task 3: the parity guard and the copy guard, with the full web suite.** `13c3e3ba` (test)
4. **Task 4: criterion 1 in the browser at both widths, with the Requestor's gate.** `3f0251e6` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The header's filter lines needed the register's chip labels on the server**
- **Found during:** Task 1
- **Issue:** The chips the table shows were computed inside the client `RiskRegisterTable`, with a label helper in the client `risk-register-filters.tsx`. A server component cannot call either, and the header's Export must name the same chips.
- **Fix:** Moved the chip list into the new zod-free `features/risks/risk-register-chips.ts` (`riskRegisterFilterChips`, `treatmentStatusFilterLabel`). The table and the filters import it, with the chips unchanged, and the copy guard reads the new module.
- **Files modified:** apps/csrm/src/features/risks/risk-register-chips.ts (new), risk-register.tsx, risk-register-filters.tsx
- **Commit:** 4fca35fa

**2. [Rule 3 - Blocking] ExportButton needed the query it exports**
- **Found during:** Task 1
- **Issue:** The plan's `ExportButton` props list named no query, but the action's input is `{ query, format, columns? }`.
- **Fix:** Added the `query` prop: the page's parsed query without page and page size.
- **Commit:** 4fca35fa

**3. [Rule 3 - Blocking] Radix radio groups need ResizeObserver in jsdom**
- **Found during:** Task 1 GREEN
- **Fix:** The dialog test installs the repository's `installTestResizeObserver` stub.
- **Commit:** 4fca35fa

**4. [Rule 1 - Bug] The first Playwright run matched the hidden phone card at 1440**
- **Found during:** Task 4
- **Issue:** `getByText(statement).first()` resolved to the register's mobile card, which is hidden from 768px.
- **Fix:** The assertion filters to the visible match. The rerun passed 17 of 17.
- **Commit:** 3f0251e6

### Choices the plan left open

- `exportDialogState` takes `filtered` beside `total` and `checkedColumns`, so it can tell the two empty states apart.
- The phone sheet is the shared `DialogContent` with full-screen classes and a title row, chosen by the same `(max-width: 767px)` store quick find uses.
- The page's Export also renders under the e2e `populated` fixture, which keeps the read's data. Every other fixture state replaces the data and shows no Export.

## Known Stubs

None. The dialog's fixed-table branch (`fixedTables`, the `Table` group, the `{ query, format, table }` input) is exercised by its Vitest fixture only. Plans 19-09 and 19-12 wire it to reports and released assessments, together with their own scope sentences.

## Threat Flags

None. No new endpoint, route or schema: the action calls the served export through the typed client (T-19-22), validates its input (T-19-19), the validator checks every byte before it reaches the browser (T-19-20), and the header's Export is presentation only, with the API's 403 the control (T-19-21).

## Self-Check: PASSED

The created files exist, and commits 2530e726, 4fca35fa, 7e07f645, 319d4c44, 13c3e3ba and 3f0251e6 are in the history.
