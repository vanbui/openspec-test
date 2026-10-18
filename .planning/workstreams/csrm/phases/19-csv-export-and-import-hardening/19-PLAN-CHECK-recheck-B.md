# Phase 19 plan re-check, lane B (19-06 to 19-10), iteration 4

Checked on 2026-10-16 against HEAD `bdd0f698`. This was a read-only check: no plan or code was edited and no test was run.

**Verdict: ISSUES FOUND. 1 blocker (a cross-plan defect whose fix belongs in 19-05), 3 warnings, 2 info.**

## Mechanical checks
- `verify plan-structure`: all five plans are valid, with no errors or warnings (task counts: 06 4, 07 3, 08 4, 09 3, 10 4).
- `frontmatter validate --schema plan`: all five are valid.
- `bash -n`: all 18 `<automated>` commands pass.
- `grep -c ProgramData`: 0 in each plan.
- Each plan now ends with one `</output>` line (B-I1 fixed).

## Iteration-2 findings

### B1 preamble: Resolved
- Every verify begins with the host-neutral `node -e "...major !== 24 || minor < 19..." && pnpm --version >/dev/null` (for example 19-06:219, 19-07:202, 19-10:246).
- The Hard-rules line names `NODE24_DIR` (19-06:162).

### B2 ledger: Resolved
- The 19-06:332 filter includes the alternation ` M \.planning/workstreams/csrm/\.verification-ledger\.json`.
- Every Hard-rules line names the ledger (19-06:167, 19-07:163, 19-08 and 19-09 Hard rules, 19-10:190).
- Against today's `git status`, the filter accepts the ledger line. It still rejects the modified 19-0x-PLAN files, which is correct: they must be committed before execution.

### B5 human-only count chain: Resolved (arithmetic checked)
- The base is `31 + insightOperations.size` (`authorization-matrix.integration.test.ts:264`), and the literal check runs at :266-267.
- **19-05 → 32:** adds the register export.
- **19-07 → 33:** adds only `assessment_requests/export`. My requests joins the refusal set only (19-07:122-124, :266).
- **19-08 → 35:** adds `questionnaires/export` and `alerts/export`. `my_questionnaires` is excluded (19-08:128-129).
- **19-09 → 36:** adds the report export (19-09:125, :252).
- **19-10 → 37:** adds only `risk_assessments/export`. The released and My exports are excluded (19-10:165-166, :342-344).
- Each human-only plan lists `authorization-matrix.integration.test.ts` in files_modified and puts the quoted literals in `csrm-authorization.ts` (19-07:278, 19-08 Task 4 AC, 19-09:263, 19-10:356).
- The alert and report exports sit in `CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS`, outside the guard's `insightOperations` (:263), so they correctly need their own literals and count.

### B6 19-06 register wiring: Resolved
- **Placement.** 19-06:125-131 and must-have :44. The static `PageHeader` without `action` is rendered only in the Suspense fallback beside `RiskRegisterLoading`. `RiskRegisterContent` renders `PageHeader` with `action` (`page-header.tsx:17`) above every state.
- **When Export shows.** `ExportButton` renders only when `can("risk-register:export", granted)` holds on the `granted` set already read at `risks/page.tsx:18-20`, as Home decides its view (`app/(app)/app/page.tsx:25-28`), and only when `listRiskRegister` returned data with no error and no fixture state.
- **The count.** `meta.pagination.total` comes from the same read, with no second read.
- **The Requestor.** `RiskRegisterAccessDenied` (:21) renders with a header and no action.
- **Proof.** The page test covers four cases (19-06:202), its AC is at :225, and the Requestor journey is at :327.
- **The capability follows the export grant, not just read access.**
  - `strapi-capabilities.ts` anchors `risk-register:export` to `GET:/api/v1/risks` plus `GET:/api/v1/risks/export?format={format}` (19-06:133). That is the catalogue URL (`idambox-csrm-role-function-api-catalogue.json:2467`) that `/v1/me/access` reports verbatim (`effective-access.ts:50`).
  - 19-05 grants it to `role.security_analyst` only (19-05:37, :115) and lists it in `HUMAN_ANALYST_ONLY_OPERATIONS`, which `isOperationGranted` already filters (`effective-access.ts:38-41`).
- **OIDC path.** OIDC sessions derive capabilities only from `strapiGrantedCapabilities` (`oidc-session-adapter.ts:100-104`).
- **Development fixtures.** The development adapter grants the capability to `Security Analyst` and `Second Security Analyst` only (19-06:134), which mirrors the Strapi role grant.
- **Served-anchor test.** The served-anchor test (`strapi-capabilities.test.ts:47-60`) strips the query template the way the inventory does (19-06:135, :286). `capabilitiesFromOperations` keeps exact matching.

### B7 myRatingSummary: Resolved
- 19-10:112, :156 and :235 name it as the fourth caller, using `readableAssessmentFilters` + `RELEASED_ASSESSMENT_FILTERS` and `isReadableReleasedAssessment`.
- AC :251 covers it, and so does the rating-summary regression at :221, which cites `assessment-workflow.integration.test.ts:1930`.
- The controller code matches: `controllers/csrm-assessment.ts:343-352`.
- Task 2's gathered-name check (:285) can now pass.

### B-W1 active-risk naming: Resolved
- 19-10:107-114 and :159-162 name `riskSummariesFor` (:110, `activeRiskSql`), `projectRequestorAssessmentSummary`, `ACTIVE_RISK_FILTER` (:368) and `isActiveRisk` (:395). AC :320 covers them.
- 19-07:134-136, 19-08:134-136 and 19-09:127-129 each state the rule.
- `active-risk-readers.unit.test.js` runs in every full suite and in the targeted verifies of 19-08 Task 3 and 19-10 Tasks 1 and 3.

### B-W2 media types: Resolved
- 19-06:120 and :281 set `EXPORT_RESPONSE_CONTENT_TYPES` to exactly `text/csv; charset=utf-8` and the XLSX type.
- The charset tolerance lives only in the validator's essence comparison (`file-response.ts:89`).
- `checkFileResponse` stays untouched (AC 19-06:297), and a different spec declaration is treated as a 19-05 defect to stop on.
- The rest of the chain agrees:
  - 19-04:136;
  - 19-05:114, plus its verify at :186, which asserts exactly those two keys;
  - 19-07:143, 19-08:140, 19-09:140 and 19-10:168.

### B-W3 journey creates its own records: Resolved
- 19-06:144-147 and :318-325: the suffix is `Date.now().toString(36)`-project, the journey raises and drafts its own request, `q=export-{suffix}` scopes every register read, and no seed Risk is edited.
- AC :338 covers it.

### B-W4 contract-catalogue :1123: Resolved
- 19-09:95 and :142-145 name three places:
  - :1123, the `phase7UnservedOperations` row (today at :1122, inside the :1117-1123 array);
  - :1167, the menu row (today at :1165);
  - :1794, `PHASE7_REPORT_EXPORT_PUBLISHED`.
- Task 1's verify runs that file (:201).

### B-W5 export 403 messages: Resolved
- All three strings are asserted exactly in each plan:
  - 19-07:258-259 and AC :279;
  - 19-08 Task 4 action and AC;
  - 19-09:223-224 and AC :236;
  - 19-10:276, :306-307 and AC :321.
- The policy order makes them reachable. The human-only check is at `csrm-authorization.ts:409-411`, ahead of `underlyingRead`, which 19-05:110 places after it.
- So a mis-granted Jane gets the analyst-export sentence, and Bob without the list read gets "CSRM export requires the list read.".

### 19-07 pilot ruling (isOperationGranted honours SERVICE_IDENTITY_REFUSED_OPERATIONS): Resolved
- 19-07:130-133, :227 and :232, with AC :241.
- The case is written test-first in `keycloak-identity.unit.test.ts`. The change imports the set and `isEligiblePerson` rather than copying them. Both files are in files_modified.
- `EffectiveGrants` already carries `registeredSourceService` (used at `csrm-authorization.ts:417`).

### 19-10 negative case: Resolved
- 19-10:273: the Secondary Requestor at Jane's released assessment gets 404 with no file and no export event (also :170).
- The matrix `other` is 404 (:338).

### Route budgets (289 / 558 bytes): Resolved, and 19-10's claim holds
- **19-06** (19-06:136-142):
  - `file-response.ts` and `risk-service.ts` are server-only.
  - Family S1 copy comes from the feature-only `features/exports/export-refusal-copy.ts`.
  - The `capabilities` tuple is read by no client module. Today only server modules and `strapi-capabilities.test.ts` import it; `navigation.ts` and `quick-find-actions.ts` import only `can` and the type.
- **19-10** (19-10:150-153):
  - `assessment-schema.ts` is imported by client modules on both tight routes (`risk-detail-editor.tsx`, `mitigation-control-list.tsx`, `status-badge.tsx`).
  - `releasedAssessmentDetailForActorSchema` is used at runtime only by `assessment-service.ts:96` (server-only) and by tests. Moving it out only shrinks those bundles.
  - `released: z.boolean()` stays out of the shared module (AC :253).
- **19-07 to 19-09** touch no web module.

## New blockers

### NB-1. [dependency / cross-plan] A plan that mounts an /export route must also keep analyst-insight-routes.unit.test.ts green
- **Evidence.**
  - `apps/backend/tests/analyst-insight-routes.unit.test.ts:81` has `UNSERVED_PATH_FRAGMENTS`, which includes `"/export"`.
  - The loop at :144-148 checks every router source under `src/api/*/routes/` (`routeSources()`, :84-99), not just the insight routers.
  - 19-05 mounts `"/v1/risks/export"` in `csrm-risk/routes/csrm-risk.ts`, and 19-07 mounts `"/v1/assessment_requests/export"` and `"/v1/my_requests/export"`. Each makes the test fail with `UNSERVED_OPERATION_MOUNTED_<file>_/export`.
  - Only 19-08 (:142) drops the fragment. No plan from 19-01 to 19-07 lists or mentions the test (grep: 0 hits).
  - `pnpm --dir apps/backend test` runs `.tmp/tests-dist/tests/*.test.js`. So 19-05 Task 3's verify (19-05:246) and 19-07 Task 3's verify (19-07:272) fail on correct work.
- **Owner.** 19-05 (lane A), which is the first served export. It also blocks 19-07.
- **Example fix (non-binding).** In 19-05, narrow the fragment to the insight path still reserved (for example `"/v1/reports/:reportKey/export"`), or scope the fragment loop to the insight routers. Add the test to 19-05's files_modified. 19-08 and 19-09 then adjust it from that state.

## Warnings

### W-1. [task completeness] The 19-08 and 19-09 inventory edits must cover the route-shape assertions
- `analyst-insight-routes.unit.test.ts:102-123` has two requirements:
  - every route mounted in `routes/alerts.ts` and `routes/reports.ts` is in `SERVED_INSIGHT_ROUTES`;
  - its policies deepEqual exactly `{ operation, requireAnalystInsightScope: true }`.
- The export routes add `underlyingRead` (19-08:137, 19-09:130), so they fail `UNINVENTORIED_INSIGHT_ROUTE_*` and `INSIGHT_ROUTE_POLICY_*`.
- 19-08:142 says only that the edit drops `/export` and adds an explicit allow-list. Task 3's verify would expose this, but the plan should say the inventory admits each export route with its `underlyingRead` config.

### W-2. [files_modified] 19-10's web move touches files that are not listed
- `assessment-service.test.ts:14` imports `releasedAssessmentDetailForActorSchema` from `./assessment-schema`, and `released-assessment-route.test.ts:97` does too (by dynamic import). Both break when the schema moves.
- A required `released` on `AnalystAssessmentDetail` breaks the typed fixtures in `assessment-editor.test.tsx:79,171`, `risk-editor.test.tsx:72` and `analyst-assessment-route.test.tsx:88,113`.
- The "new server-only module beside it" option (19-10:151) would also be an unlisted file.
- Task 1's verify runs `vitest run src/features/assessments` and `typecheck` (19-10:246), so these files must change.
- Fix: list them, or keep the shared `AnalystAssessmentDetail` type without `released` and export the extended type from the service.

### W-3. [verification] 19-06 Task 1 leaves a failing web test until Task 3
- Task 1 adds the export anchor to `capabilityAnchors`.
- In `strapi-capabilities.test.ts`, the case "gives the Security Analyst every capability" (:34-36) then fails, and stays failing until Task 3 adds the URL to `analystOperations`.
- Task 1's verify runs only `capability-adapter.test.ts`, so the commit lands red (acknowledged at 19-06:203).
- Fix: move the `analystOperations` addition into Task 1, and keep the served-anchor change in Task 3.

## Info
- **I-1.** The `PHASE_19_BASE` references in the acceptance criteria rely on the recorded `bdd0f698` (19-PLAN-CHECK.md).
- **I-2.** Cross-plan consistency holds:
  - The 403 strings are the same in 19-02:103, 19-05:36 and :109, and 19-07 to 19-10.
  - The media types are the same in 19-04:136, 19-05:114 and 19-06 to 19-10.
  - The family S paths match 19-02:34.
  - The capability names (list:export) and the anchor rule (read + export, with the format template only where the catalogue has one) match 19-11:48 and :139-152.
  - The count chain continues into 19-14 (41).
