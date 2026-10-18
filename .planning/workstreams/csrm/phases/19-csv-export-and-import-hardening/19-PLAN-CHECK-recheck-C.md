# Phase 19 plan re-check, lane C (19-11 to 19-15), iteration 4

Checked 2026-10-16 at HEAD `bdd0f698`. Read-only: no plan or code edited, no test run.

**Verdict: ISSUES. 1 blocker, 2 warnings, 5 info.** Every iteration-2 finding for these plans is resolved.

## Mechanical checks
- `verify plan-structure`: valid, with no errors or warnings, for all five plans (3, 4, 3, 3 and 4 tasks).
- `frontmatter validate --schema plan`: valid for all five.
- `bash -n`: passes on all 17 `<automated>` commands.
- ProgramData count: 0 in each plan.
- Dependencies are linear (19-10 to 11 to 12 to 13 to 14 to 15), one plan per wave.

## Iteration-2 findings

- **B1 preamble: Resolved.** Every verify starts with the host-neutral `node -e` Node 24.19 check and `pnpm --version >/dev/null` (19-11:215/263/288; 19-12 Tasks 1 to 4; 19-13:198/230/265; 19-14 Tasks 1 to 3; 19-15:216/249/274/302). The hard rules point to POST-DEMO-BRIEF §4 (19-15:167).
- **B2 ledger: Resolved.** The filters accept the modified `.planning/workstreams/csrm/.verification-ledger.json` (19-11:288, 19-12 Task 4, 19-15:274 and :302). Every hard rule names it (19-11:177, 19-13:159, 19-14, 19-15:172).
- **B3 approvals: Resolved.**
  - 19-15:139 and :302 check both Phase 19 records with the bold markers stripped, against `^Status: approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2} \(G-6\)`.
  - They check the Phase 06 and 07 amendments from the `## Phase 19 amendment` heading onward, with the bold markers stripped, against `^Phase 19 amendment status: approved by the pilot on ...`.
  - A case-insensitive negative grep for `status: awaiting` then runs over all four. The Phase 06 and 07 notes have no such text today (only a `## Status` heading), so only 19-01’s awaiting lines can trip it, which is correct.
  - The checks are consistent with 19-01:27, :42, :45 and :110 and with VALIDATION :91.
- **B8 badge bytes: Resolved.**
  - The whole import row family moves to `features/administration/import-row-status.tsx` in 19-13 (:130-137). The 19-UI-SPEC :95 row agrees.
  - Today the family is at status-badge.tsx:128-134, with the `CsvRowState` import at :29, `StatusValues.importRow` at :56 and the map entry at :181. Each of its five icons (Check, RefreshCw, FileCheck2, CircleX, CircleQuestionMark) appears exactly twice in the file: its import and its family entry. So the move only shrinks the shared module: five icons leave and none is added.
  - Outside status-badge.tsx, `importRow` is used only in csv-import-flow.tsx (:38, :180-181, :199-200) and status-badge.test.tsx. No e2e spec uses it.
  - The 19-13 verify greps that the family and its type are gone.
  - 19-15 Task 3 runs `performance.spec.ts`. That spec budgets both routes (:104, :135) at 300,000 bytes (:55). Task 3 records both routes against 299,711 and 299,442.
- **B9 typecheck: Resolved.**
  - `similar` joins the web `csvRowStates` in 19-13 Task 3, in the same step as the badge move (19-13:129, :262). The badge files are in that task.
  - Task 1 keeps five states (:190).
  - The client parser builds its counts from `csvRowStates` (csv-client-parser.ts:183).
- **B10 dependency check: Resolved.**
  - **HEAD against HEAD.** I extracted the script from 19-15:302 and ran it with HEAD as the base. It prints only EXPECTED_CHANGE_MISSING and exits 1.
  - **Simulated ruled change.** On the LF blob of `pnpm-lock.yaml`, I applied the ruled change: backend importer lines after `unpdf`, the packages and snapshots entries, and the apps/csrm csv-parse lines removed. `git diff -U0` gives exactly the allow-list:
    - 3 importer `+` lines;
    - the `write-excel-file@4.1.1:` header twice;
    - the resolution, engines, `dependencies:` and `fflate: 0.8.3` lines;
    - 2 blank `+` lines;
    - 3 `-` csv-parse lines.
  - **The structure matches.** The lockfile is v9: importers at 2 spaces, entries at 6 and 8 (csv-parse at :43-45 for backend and :110-112 for csrm), and blank separators (fflate at :5311 and :15213).
  - **The pinned integrity is real.** `npm view write-excel-file@4.1.1` confirms the pinned integrity (`sha512-MUnC...71A==`), engines `>=18`, the single dependency `fflate ^0.8.2`, and no bin or peers.
  - **The manifest comparison makes the `unpdf` comma irrelevant.**
  - **Brittleness is acceptable.** The diff compares committed blobs, so CRLF is irrelevant. Other churn is real change for the pilot to see.
- **C-W2 Keycloak: Resolved.** The gate captures `git diff --name-only BASE..HEAD -- apps/` first and then greps it (19-15:137, :302). This matches VALIDATION :41.
- **C-W3 / Export placement ruling: Resolved.**
  - 19-11:121-137 uses 19-06:44 and :125’s wording. It names the five static headers, all verified today (alerts/page.tsx:63, review/requests/page.tsx:25, and so on). The header moves into the Suspense fallback, and the data component renders the header above every state. The count comes from the same read.
  - 19-15:120-125 is correct that the admin page has no Suspense and renders the workspace header after the read (admin page.tsx:30-46).
  - There is one capability per export (19-11:138-153, 19-15:126-130). The analyst exports go to the Security Analyst fixtures only. The `my-*` exports and `released-assessment:export` go to every fixture.
  - The anchors match the URLs that 19-07 to 19-10 and 19-14 publish. Only `risks/export` carries `?format={format}`. Both media types are exact (19-11:248, 19-14).
- **C-W4 withdrawn Risks: Resolved.**
  - 19-12 states the active-risk rule. It cites `ACTIVE_RISK_FILTER` at csrm-assessment.ts:368 and `isActiveRisk` at :395 (both verified), and `active-risk-readers.unit.test.ts` (it exists).
  - The model drops withdrawn Risks, and a `withdrawn` test is required.
  - The fixture note matches the code: `AnalystRiskDetail.withdrawal` is required (assessment-schema.ts:534), and `AssessmentRiskListItem` (:397-416) has no such field.
- **C-W5 loader: Resolved.**
  - 19-12 uses a discriminated result covering every state that page.tsx:57-84 renders today.
  - `cache(getReleasedAssessment)` moves to the module and is shared with `generateMetadata` (:20 and :26-28 today).
  - The acceptance criterion pins the move as behaviour-neutral.
- **19-14 count and 403 messages: Resolved.**
  - The count goes 37 to 41 (19-14:40, :106, Task 3).
  - The chain is consistent: 19-05 32, 19-07 33, 19-08 35, 19-09 36, 19-10 37, starting from today’s 31 at authorization-matrix.integration.test.ts:264.
  - The three export 403 messages are asserted.
  - The quoted literals are in both mirrors.
- **Info items: Resolved.**
  - csv-parse removal: 19-15:116 and :212, with a verify on both manifests.
  - Admin journey `q=`: 19-15:131 and :278.
  - Baselines: 5,847, 2,022 + 1 and 248.
  - Drifted names: 19-13:104 and :118-126.
  - Family S stays in feature-only modules.

## New blockers

**NB1. [verify fails on correct work] 19-15 Task 2’s full web suite fails the served-inventory agreement test.**
- Required property: every 19-15 task’s verify passes on correct work.
- Evidence:
  - Task 1 adds `downloadImportTemplate` and Task 2 adds `downloadImportErrorReport`, both as client calls in `administration-service.ts` (19-15:117, :210, :246).
  - `docs/references/served-operations.json` is in Task 3’s files only (:263) and is regenerated only there (:271).
  - Task 2’s verify runs `pnpm --dir apps/csrm test` (:249). That suite includes `contract-operation-chain.test.ts:176-182`, which requires the scanned web calls to equal the inventory’s `webCallers` exactly. So the test fails on correct Task 2 work.
  - The parity guard’s file-response registration also arrives only in Task 3. `contract-response-parity.test.ts:521` may fail in the same run.
  - 19-11 regenerates in every task that adds a caller (:212, :260).
- Example fix (non-binding): regenerate the inventory and register the file responses in the tasks that add each caller, with both files in those tasks. Alternatively, keep the full suite out of Task 2’s verify and run it in Task 3.

## Warnings

**W1. [files_modified] 19-15 Task 1 deletes the client parser, but its test file is not declared.**
- Required property: every file a task must edit is declared.
- Evidence:
  - `administration-schema.test.ts` loads `./csv-client-parser` (:50) and tests `parseAdministrationCsvClient` (:37, :247-273).
  - 19-15 deletes that parser (:115). Task 1’s verify runs `src/features/administration` (:216).
  - The test file is not in 19-15’s files; only 19-13 lists it.
- Example fix (non-binding): list it in Task 1 and say its parser cases are removed or rewritten against `checkImportFileInBrowser`.

**W2. [files_modified] 19-15 may create an undeclared helper module.**
- Required property: every file a task may create is declared.
- Evidence: 19-15:118 and :183 allow "a pure helper module" for the flow’s rules, with no path declared. `interface-copy-guard.test.ts` may need it listed, and that test is not in 19-15 either.
- Example fix (non-binding): name the module and its test in Task 2.

## Info
- **I1.** 19-06:44 cites Home `page.tsx:25-28`; the others cite `:24-29`, which is where the code is.
- **I2.** The admin header action wrapper is `md:flex-row-reverse` (administration-workspace.tsx:271), so a DOM-last Export renders leftmost on desktop. This complies with 19-UI-SPEC §1 (:133, DOM order), but it is worth a look in the UI review.
- **I3.** The comment at `apps/csrm/src/lib/files/save-file.ts:8` still names `downloadAdministrationCsv` after 19-15 deletes it.
- **I4.** 19-14 does not say whether the reference-list exports’ catalogue URLs carry `?format={format}`, and 19-15:127 hedges. The served-anchor check strips the query template, so either form works.
- **I5.** The lock allow-list depends on pnpm’s current v9 output. A pnpm upgrade inside the phase surfaces as an unexpected change, which is the intended behaviour.
