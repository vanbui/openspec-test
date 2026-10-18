# Phase 19 plan check, lane C (19-11 to 19-15)

## Fresh pre-execution check (2026-10-16)

Checked at HEAD `bdd0f698` (Phase 16 closed). Read-only: no plan or code edited, no test run.

### What still holds today

- Structure: `verify plan-structure` is valid with no errors or warnings for all five plans (3, 4, 3, 3, 4 tasks). `frontmatter validate --schema plan` is valid for all five. `bash -n` passes on all 17 `<automated>` commands.
- Dependencies: the chain is linear (19-11 depends on 19-10, then 19-12, 19-13, 19-14, 19-15, waves 11 to 15). There are no cycles and no same-wave coupling.
- Requirements: CSV-01 is in 19-11, 19-12, 19-14 and 19-15. CSV-02 is in 19-13, 19-14 and 19-15. CSV-03 is in 19-13 and 19-15. ROADMAP criteria 2 and 6 are covered by 19-12, criteria 3 and 5 by 19-13 and 19-15, and criterion 4 by 19-14 and 19-15.
- Web files and identifiers that exist today:
  - All nine list pages in 19-11.
  - `parseAssessmentCollectionQuery` (assessment-service.ts:249), `parseAssessmentRequestReviewQuery` (:254), `requestListQuerySchema` (request-schema.ts:43), `parseQuestionnaireListQuery` (questionnaire-service.ts:291), `alertListQuerySchema` (alert-schema.ts:137).
  - `reports-page-header.tsx`, `report-periods.ts`, `report-copy.ts`.
  - The released page and its reads `getReleasedAssessment`, `listReleasedAssessmentRisks` and `listReleasedControlImplementations` (app/(app)/app/assessments/[documentId]/page.tsx:10-12).
  - `LocalInstant` (components/csrm/local-time.tsx), `readViewerTimeZone` (lib/time/viewer-time-zone.ts), the PageHeader `data-print="hidden"` (page-header.tsx:25), `@media print` (globals.css:1340) and the Print refinements text (csrm-design-direction.md:496).
  - Every administration web file that 19-15 names, `status-badge.tsx` with the `importRow` family (:128-134), and `attachments-actions.ts`.
  - The e2e specs that the plans read: design-system-conformance, design-contract, accessibility, helpers/navigation.ts, analyst-insights, performance, administration-workflow.
- Backend identifiers that 19-13 and 19-14 read all exist today:
  - In administration-workflow.ts: `readCsvUpload`, `issuePreviewRecord`, `previewRecordForCommit`, `PreviewRecord`, `PREVIEW_TTL_MS`, `MAX_PREVIEW_RECORDS`, `MAX_PREVIEWS_PER_ACTOR_AND_KIND`, `AdministrationWorkflowError` and `importError`.
  - In csv-import.ts: `ADMINISTRATION_CSV_CONTRACTS`, `csvRowStates`, `CsvImportRow`, `classifyRows` and `parseCell`.
  - In administration-query.ts: `normalizeAdministrationNaturalKey`, `assertNaturalKeyAvailable` and `parseAdministrationQuery`.
  - `CSRM_ADMINISTRATION_OPERATIONS` with list operations (operations.ts:2,9,16,23), `requireAnalystAdministrationScope` (routes/csrm-administration.ts:9) and `logSecurityEvent` (security-event-log.ts:151).
  - The catalogue: `function.administration.risk_types` ends at `.api.04` (catalogue json:1178-1181), so `.api.05` to `.api.07` are free as 19-14 expects.
  - `SERVICE_IDENTITY_REFUSED_OPERATIONS`, `underlyingRead`, `tests/exports.integration.test.ts` and the spreadsheets modules import-file, header-match and xlsx-writer do not exist yet. Plans 19-03 and 19-05 create them (checked by lane A). `src/csrm/spreadsheets/xlsx-reader.ts` already exists.
- Route ordering: export routes must sit before `/:id` (19-14:100). This holds: `GET /v1/risk_types/:riskTypeId` (routes:25) would capture `/export`, and the plan places the route correctly. `import/template` has two path segments, so it does not collide.
- Route budgets:
  - 19-11 adds client export code to `/app/requests` (47,363 bytes left) and `/app/reports/risk-exposure` (43,694).
  - 19-12 adds it to `/app/review/assessments/{documentId}` (61,978 under its 460,000 override). `/app/assessments/{documentId}` is not budgeted.
  - 19-15 adds it to `/app/admin/controls` (49,102).
  - All of these figures come from 16-15-SUMMARY:236-247. No plan adds a button to `/app/risks/{documentId}` or `/app/requests/{documentId}`. The one shared-module change that does reach those two routes is Blocker 4.
- E2E scoping: none of the five plans adds or edits a Risk Register Playwright step, so the `q=` rule has no target here. The `router.replace` Show filter is not touched.
- Dependencies: no plan adds a web dependency. `write-excel-file` stays Strapi-only, and 19-15 asserts that `apps/csrm/package.json` is unchanged.
- Extension labels: X-30 to X-32 do not collide with X-27 to X-29 from Phase 16. Both are UI-SPEC labels; the direction itself titles extensions by name.

### Blockers

**B1. [verify, host] All 22 verify preambles are host-specific.**
- Evidence: the `/c/ProgramData/nvm/v24.19.0` PATH export and `pnpm()` shim appear in the hard rule and in every `<automated>` command:
  - 19-11: lines 120, 158, 188, 210 (4)
  - 19-12: lines 125, 167, 198, 227, 249 (5)
  - 19-13: lines 122, 164, 196, 228 (4)
  - 19-14: lines 117, 156, 185, 215 (4)
  - 19-15: lines 126, 171, 203, 226, 249 (5)
- Fix: use the host-neutral Node 24.19 check from Phase 15, followed by `pnpm --version >/dev/null` (copy it verbatim from 15-10-PLAN:187), and reword each hard rule to match.

**B2. [verify, clean tree] Every clean-status filter fails on the tree as it is today.**
- Evidence: the filters at 19-11:210, 19-12:249, 19-15:226 and 19-15:249 tolerate only the three operator items. They do not accept ` M .planning/workstreams/csrm/.verification-ledger.json`, which is modified right now.
- The hard rules have the same gap: 19-11:125, 19-12:129, 19-13:127, 19-14:122, 19-15:131 all say only the three operator items may remain.
- Fix: add the alternative `| M \.planning/workstreams/csrm/\.verification-ledger\.json` to each filter, exactly as 16-15-PLAN:213 does.

**B3. [gate, approvals] The 19-15 approval re-check does not use the format the pilot writes.**
- Evidence: 19-15:249 greps for `Approved by the pilot on YYYY-MM-DD (G-6)`. That is the stale executor-written form, inherited from 19-01:100 and 19-01:236.
- The check has no `tr -d "*"`, no `^Status: approved by the pilot on` anchor, and no case-insensitive check that no `status: awaiting` line remains. If the pilot writes the line in their own format, the gate fails.
- Fix: for each of the two Phase 19 records, pipe it through `tr -d "*"` into `grep -Eq` against `^Status: approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2} \(G-6\)`, then run `! grep -qi "status: awaiting"` over both. 16-15-PLAN:213 has the exact form.
- Plan 19-01 (lane A) should switch to the same format.
- 19-01:176 gives the Phase 06 and Phase 07 amendments no status line. If the pilot requires one, add `^Phase 19 amendment status: approved by the pilot on` checks here.

**B4. [gate, budget] The sixth badge in 19-15 will likely push `/app/risks/{documentId}` past its budget, and the plan never measures it before the gate.**
- Evidence: 19-15:110 adds `similar` with the lucide `CaseSensitive` icon and the label `Matched by similar name` to `statusPresentation`. That is one static map (status-badge.tsx:2-25 imports; :128-181 families), so the change ships wherever `StatusBadge` is imported, including risk-details.tsx (`/app/risks/{documentId}`) and request-hub (`/app/requests/{documentId}`).
- Those two routes have 289 and 558 bytes of headroom (16-15-SUMMARY:240, :243). The single `Archive` icon in Phase 16 cost about 273 bytes gzipped (16-12-SUMMARY:168).
- Tasks 2 and 3 never run `performance.spec.ts`. The first measurement is the full gate at 19-15:249, where a failure has no planned remedy.
- Fix: keep the import-row presentation off the shared first-load map, for example in a separate map imported only by csv-import-flow.tsx, or as a named-icon entry resolved in the import flow as the `attachment` family does (:166-167). Then add `e2e/performance.spec.ts` to the Task 3 verify and require both near-limit routes to stay within budget. Otherwise, record the D-24 triage before the task.

**B5. [verify, typecheck] 19-13 breaks the web typecheck that its own verify runs.**
- Evidence: 19-13:108 adds `similar` to the closed parsers in csv-import-schema.ts. `csvRowStates` (csv-import-schema.ts:18) feeds `CsvRowState` (:20), and status-badge.tsx:134 declares `importRowFamily` with `satisfies Record<CsvRowState, StatusPresentation>`.
- As soon as `similar` joins the web enum, `pnpm --dir apps/csrm typecheck` (19-13:164, :228) fails, because the badge entry is planned only in 19-15 Task 2 and status-badge.tsx is not in the files_modified of 19-13.
- csv-import-flow.tsx:178-179 also maps `csvRowStates` into tiles and filters, so `similar` would reach the flow before 19-15 shapes it.
- Fix: move the badge entry into 19-13 (placed per B4) and add status-badge.tsx and its test to the 19-13 files, or keep `similar` out of the web `csvRowStates` until 19-15. Either way, the 19-13 verify must pass.

**B6. [gate, dependency freeze] The 19-15 dependency check fails even when Phase 19 only adds `write-excel-file`.**
- Evidence: 19-15:249 requires the `+` lines of `git diff BASE..HEAD -- apps/backend/package.json`, with spaces and commas stripped, to equal exactly `+"write-excel-file":"4.1.1"`.
- The backend dependencies currently end with `styled-components` then `unpdf` (checked with node). `write-excel-file` sorts after `unpdf`, so pnpm appends it last. The `unpdf` line gains a comma and appears as a `-`/`+` pair, so a second `+"unpdf":...` line survives the `tr`, and the test fails.
- `pnpm-lock.yaml` is not checked at all.
- Fix: compare the parsed package.json at BASE (via `git show`) with the current one, for example in `node -e`, and assert that the only added key across dependencies and devDependencies is `write-excel-file` at `4.1.1`, with nothing removed or changed. Also assert that the only other changed dependency file under BASE..HEAD is `pnpm-lock.yaml`.

### Warnings

**W1. [gate, content-type freeze] The freeze lacks the IAM exclusions.**
- Evidence: 19-15:249 runs the content-type `git diff` with no pathspec exclusions. Today this is safe: `d1518c5f` (IAM merge #7) is an ancestor of HEAD, and PHASE_19_BASE is taken later (19-01:159), so BASE..HEAD covers Phase 19 alone.
- Any further IAM fast-forward during Phase 19 would trip it.
- Fix: as a prudent guard, append the three exclusions for `apps/backend/src/api/idambox-user`, `identity-source` and `keycloak-sync-outbox` in the quoted pathspec form used at 16-15-PLAN:213. 19-13:234 and 19-14:220 use the unexcluded form too.

**W2. [gate, Keycloak grep] The Keycloak grep covers the whole repository, not `apps/`.**
- Evidence: 19-15:249 sets `CHANGED` from `git diff --name-only "$BASE"..HEAD` over every path. The Phase 16 B3 ruling limited it to `-- apps/`. With BASE after `d1518c5f` the range is Phase 19 alone, but a merge from another workstream (for example `scripts/verify-keycloak-idp.mjs`) would trip it.
- Fix: add `-- apps/`. A guard is still prudent; no second range is needed unless another merge lands.

**W3. [19-11, header placement] Several list headers render before the data, so the Export button cannot receive the list total.**
- Evidence: 19-11:106 has each page pass ExportButton `meta.pagination.total`, its chips and `multiplePages` from the header. On several pages the header is static and renders before the Suspense that holds the data:
  - alerts/page.tsx:62-66 (`AlertsPageHeader` with no props)
  - review/requests/page.tsx:25
  - review/assigned/page.tsx:31
  - review/assessments/page.tsx:32
  - reports/[reportKey]/page.tsx:83-88 (the `ReportDetailLayout` action sits outside the Suspense)
- The "written ahead" escape (19-11:90) covers where to put the button, but not this data-flow change. Moving the header inside Suspense changes the loading skeleton and the streaming that Phase 11 chose.
- Fix: state the pattern. Either the header stays static and the button lives in the toolbar of the data component, or the total is read in the header through the cached list read, with the skeleton keeping the header. Make sure the gated states still render no button.

**W4. [19-12, active-risk rule] 19-12 is silent on withdrawn Risks, and its fixtures need `withdrawal`.**
- Evidence: both actors read Risks through the same `readRisks` (assessment-service.ts:507-508). `AssessmentRiskListItem` now requires `withdrawal` (assessment-schema.ts:534).
- 19-12:105 lists the risk fields of the model and 19-12:217 asserts that the analyst model equals the Requestor model, but no plan line says whether a withdrawn Risk appears in the report. The analyst read includes withdrawn Risks, which the Phase 16 cards render.
- Fix: state that the report lists active Risks only (or mirrors the released view exactly), require every `AssessmentRiskListItem` fixture in the report tests to carry `withdrawal`, and add a withdrawn-risk case.

**W5. [19-12, loader states] The states of the shared loader are underspecified.**
- Evidence: 19-12:105 says the Requestor loader returns null on 404. Today the released page also renders `permission`, `error` and `contract-mismatch` states and uses `cache(getReleasedAssessment)` for generateMetadata (assessments/[documentId]/page.tsx:20-27, :59-67).
- Fix: specify that the loader returns a discriminated result (or that the page keeps its error branches) and reuses the cached read, so the metadata read and the page read are not duplicated.

### Info

- I1. The post-demo journey spec `apps/csrm/e2e/risk-owner-journey.spec.ts` does not exist yet; Phase 17 creates it (16-15-PLAN:85). The `git diff` over it at 19-15:249 passes vacuously. A note in the plan is optional.
- I2. The baselines "web 2,048, Strapi 578, Playwright 84 at 678b117" (19-15:246) are stale and used only for comparison. The executor records the figures from the Phase 16 close.
- I3. Names in the plans that drifted from executed code. The "written ahead" rule covers all of them; the executor records the differences.
  - The preview response field is `summary`, not "counts" (administration-workflow.ts:190; integration test :693).
  - An expired preview is 409 `IMPORT_PREVIEW_CHANGED` today (administration-workflow.ts:256). 19-13:105 changes it to `IMPORT_REVIEW_EXPIRED`, a deliberate behaviour change that its tests should name.
  - `AdministrationWorkflowError` and `importError` do not allow 422 (:28, :120).
  - The test helper is `harness.createCsvMultipart`, so an XLSX upload needs a sibling helper.
  - The alerts header lives in alerts-page-header.tsx, and the report detail action slot is the `ReportDetailLayout` action.
- I4. After 19-15 removes the `csv-parse` import (csv-client-parser.ts:1), `csv-parse 7.0.2` stays in apps/csrm/package.json:22 as an unused dependency, because the gate freezes that file. Record it as a follow-up for the pilot.
- I5. Cross-lane: the `importFileRefusal` and `importStepRefusal` additions that 19-02 makes to refusal-copy.ts ship on `/app/requests/{documentId}` (558 bytes left; 16-11-SUMMARY:65). Lane A should confirm where family S lives; the 19-15 key link (:58-60) assumes refusal-copy.ts.
- I6. The 19-15 admin journey that checks the stored name is unchanged in the list should open the list with `q=` for the record the test created, because the admin lists persist across runs.
