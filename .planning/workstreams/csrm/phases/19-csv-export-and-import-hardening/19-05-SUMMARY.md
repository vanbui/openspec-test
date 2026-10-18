---
phase: 19-csv-export-and-import-hardening
plan: 05
subsystem: exports
tags: [csv-export, xlsx, risk-register, authorization, service-identity, function-catalogue, served-operations, authorization-matrix, shared-backend]
status: complete

requires:
  - phase: 19-csv-export-and-import-hardening
    provides: "19-04: runListExport, riskRegisterExportView, sendExportFile, sendExportError, resolveExportActor, EXPORT_ROW_CAP, EXPORT_MEDIA_TYPES; 19-01: both approved Phase 19 records; 19-02: EXPORT_ROW_LIMIT in the closed reasons"
  - phase: 16-risk-curation
    provides: "the withdrawal endpoint the fixture uses, the register's ruled base query, the active-risk-readers guard"
  - phase: 14-request-attachments
    provides: "sendStoredFile (the four hardening headers), readWorkbookSheets, readZipDirectory and readZipEntry for read-back"
  - phase: 13-request-assignment-and-collaboration
    provides: "isEligiblePerson (csrm/people/eligible-person.ts), the re-exported SECURITY_ANALYST_AGENT_ROLE_NAME"
provides:
  - "GET /api/v1/risks/export (catalogue URL GET:/api/v1/risks/export?format={format}), operationId risk-register/export-risk-register, registered before /v1/risks/:riskId"
  - "CSRM_RISK_OPERATIONS.exportRegister and the exportRiskRegister handler (runListExport over riskRegisterExportView, sendExportFile, sendExportError, then handleError)"
  - "csrm-authorization.ts: exported SERVICE_IDENTITY_REFUSED_OPERATIONS, serviceIdentityDenialMessage, the analyst-export branch of humanAnalystDenialMessage, AuthorizationConfig.underlyingRead, the register export as a quoted literal in HUMAN_ANALYST_ONLY_OPERATIONS"
  - "riskRegisterPolicies(operation, underlyingRead?) in routes/csrm-risk.ts"
  - "catalogue: function.risk_register.export_api (role.security_analyst only) owning function.risk_register.export_api.api.01 (moved from function.risk_register.risk_register.api.04, name, URL and description unchanged); the Phase 19 design note appended last"
  - "tests/helpers/export-files.ts: readExportWorkbook, readExportCsv, readSheetXml, captureSecurityEvents"
  - "tests/exports.integration.test.ts: the register export's happy paths and every refusal (19-07 to 19-10 and 19-14 add theirs)"
  - "matrix: the GET:/api/v1/risks/export row; the fixture's HUMAN_ANALYST_ONLY_OPERATIONS and new SERVICE_IDENTITY_REFUSED_OPERATIONS mirrors; human-only count literal 32; the service-identity guard test"
affects: [19-06, 19-07, 19-08, 19-09, 19-10, 19-14, 19-15, phase-17, phase-19.1]

actuals:
  tokens: 19400
  tasks: 3
  commits: 4

plan_head_before: a23aaa8548d2e6bbf007d24a8c71b721575c448a
plan_head_after: 093516e0a92223a0902bf20b006fb5f971668c15

tech-stack:
  added: []
  patterns:
    - "An export route keeps its list's policy configuration and adds underlyingRead; the policy checks the read through the path that admitted the export, before any scope branch"
    - "SERVICE_IDENTITY_REFUSED_OPERATIONS refuses any caller isEligiblePerson rejects, right after the effective-operation check, whatever it holds (Requestor birthright included); no role name is tested except through isEligiblePerson"
    - "An export's catalogue URL carries its query; the served inventory and the matrix key it with the query stripped (operation.split('?')[0]), the policy literal stays exact"
    - "Export HTTP tests read the file back through CSRM's own readers and capture the security event lines around each request"

key-files:
  created:
    - apps/backend/tests/helpers/export-files.ts
    - apps/backend/tests/exports.integration.test.ts
  modified:
    - apps/backend/src/policies/csrm-authorization.ts
    - apps/backend/src/api/csrm-risk/operations.ts
    - apps/backend/src/api/csrm-risk/routes/csrm-risk.ts
    - apps/backend/src/api/csrm-risk/controllers/csrm-risk.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/served-operations.integration.test.ts
    - apps/backend/tests/analyst-insight-routes.unit.test.ts
    - apps/backend/tests/authorization-policy.unit.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts

key-decisions:
  - "Policy branch order: identity and grants (unchanged) -> the effective-operation check -> the service-identity refusal (SERVICE_IDENTITY_REFUSED_OPERATIONS and not isEligiblePerson: 'CSRM exports are refused to automation identities.') -> the human-only check (HUMAN_ANALYST_ONLY_OPERATIONS; an export member is worded 'CSRM analyst exports require a human Security Analyst.') -> underlyingRead ('CSRM export requires the list read.'; through hasHumanAnalystOperation when the operation is held through the human Security Analyst role, otherwise the explicit or birthright roles) -> the scope branches (the register's requireAnalystRiskRegisterScope)"
  - "The specification's 200 declares exactly text/csv; charset=utf-8 and application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, each with an equal contentMediaType; 400, 403 and 422 are inline responses on AssessmentWorkflowErrorResponse; no 401 is declared because the register list declares none and no /v1 operation does"
  - "function.risk_register.export_api sits after function.reports.run_api in functions and in role.security_analyst's functionIds; the moved FunctionApi keeps its array position with its new id"
  - "The cap fixture inserts the 10,001 Risks and their assessment links with knex (tables from Strapi's metadata) into a released assessment of the test database, and deletes them in a finally, so later export tests in the file never see them"
  - "Strapi answers every policy denial over HTTP with its generic 'Policy Failed' body, so the two export sentences and the list-read sentence are proven in authorization-policy.unit.test.ts; the HTTP cases prove the 403, the JSON body and that nothing is disclosed"

patterns-established:
  - "exports.integration.test.ts: seedRegisterFixture (memoised), exportAs(harness, query, identity | null, omitApiToken), withSecurityEvents, exportEvents, registerSnapshot; later plans add their own fixture and cases"
  - "withAgentGrantedRegisterExport: grant a role a Function in the test database for one action and restore it in a finally"

requirements-completed: []

duration: 70min
completed: 2026-10-17
---

# Phase 19 Plan 05: The Risk register export, served Summary

**`GET /api/v1/risks/export` served at its reserved catalogue URL: Bob's filtered register comes back as a workbook whose formula-like statement is a string cell with no `<f>`, or a BOM CSV with the value quoted and marked, through a new human-only API Function, the register read, a generic service-identity refusal set and the 10,000-row cap, with one security event line per admitted attempt and a six-actor matrix row.**

## Performance

- **Duration:** 70 min (2026-10-16T15:31Z to 16:41Z UTC; the full Strapi suite 42.3 min of it)
- **Tasks:** 3 of 3
- **Files:** 2 created, 15 modified

## Accomplishments

- The route `GET /v1/risks/export` sits directly before `GET /v1/risks/:riskId`; its policy config is `{ operation: "GET:/api/v1/risks/export?format={format}", requireAnalystRiskRegisterScope: true, underlyingRead: "GET:/api/v1/risks" }`. `exportRiskRegister` asserts the register scope, runs `runListExport` over `riskRegisterExportView(createStrapiRiskRegisterRepository(strapi))` with `resolveExportActor`, and sends the file through `sendExportFile`; errors go through `sendExportError`, then the existing `handleError`.
- Over HTTP, Bob's `format=xlsx&q=HYPERLINK` export is a file (route order proven), `Content-Type` exactly the XLSX string, `Content-Disposition` naming `risk-register-{today}.xlsx` with `filename*`, `nosniff`, `no-store`, the CSP and `X-CSRM-Row-Count: 1`; the first sheet's header is the eight visible labels and the statement is `'=HYPERLINK("https://example.test","Click")`, and `xl/worksheets/sheet1.xml` holds no `<f>`. The CSV is `text/csv; charset=utf-8`, starts with the BOM and holds `"'=HYPERLINK(""https://example.test"",""Click"")"`.
- The default `q=HYPERLINK` export excludes the Risk withdrawn through Phase 16's endpoint; `state=withdrawn&columns=riskNumber,riskState` holds exactly that Risk with State `Withdrawn`. The relation columns write the names the Risk detail shows, and an empty cell for the absent impacted asset.
- One `export.completed` line: `view: "risk-register"`, Bob's `documentId` and display name, `search: "HYPERLINK"`, `rowCount: 1`, no cell value.
- Refusals: the Requestors, both agent identities, the inactive analyst and no identity are 403 with no export event; the service agent stays 403 when its role is granted `function.risk_register.export_api` in the test database; a human analyst whose register read is withdrawn is 403; no token is 401; eight invalid queries are 400 with no reason and one `export.refused` `INVALID_QUERY` each; 10,001 matching Risks are 422 `EXPORT_ROW_LIMIT` with `rowCount: 10001`, `rowCap: 10000`, a JSON body and one `export.refused` at warn. Persistence is unchanged after every refusal.
- The reserved FunctionApi moved into `function.risk_register.export_api` (role.security_analyst only, no menuPath, in `idambox-csrm` by the seed rule); the agent's and the Requestor's effective operations exclude it; both catalogue copies are byte-identical and the Phase 19 design note is last, equal to the approved record's text.
- The served inventory lists `GET:/api/v1/risks/export` under `served` (53 unserved rows remain); the insight route inventory's bare `"/export"` fragment became `'"/v1/alerts/export"'` and `'"/v1/reports/:reportKey/export"'`.

## Facts later plans need

- **operationId:** `risk-register/export-risk-register` (tag `risk-register`).
- **Matrix row:** `GET:/api/v1/risks/export`, family `risks`, request `/api/v1/risks/export?format=csv`, `humanAnalystOnly(200)` (owner 403, other 403, analyst 200 cited by `provenBy` to the Task 1 workbook test, serviceAgent 403, noIdentity 403, noToken 401 by its `content-api-token` family).
- **The two exact 403 messages:** `CSRM exports are refused to automation identities.` (the service identity, every `SERVICE_IDENTITY_REFUSED_OPERATIONS` member) and `CSRM analyst exports require a human Security Analyst.` (a human-only export held other than through the Security Analyst role). The list-read refusal is `CSRM export requires the list read.`
- **The two declared media types:** `text/csv; charset=utf-8` and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (the strings of `EXPORT_MEDIA_TYPES`); 19-06's `EXPORT_RESPONSE_CONTENT_TYPES` must equal them.
- **Human-only count literal:** `32 + insightOperations.size`; 19-07 raises it to 33.
- **Cap fixture run time:** 10,001 Risks and their links inserted in 259 ms in the full suite (277 ms in the Task 2 run); the 422 itself is answered before any hydration.
- **19-07 onward:** add each export's literal to `SERVICE_IDENTITY_REFUSED_OPERATIONS` in the policy and the fixture mirror; analyst exports also to both `HUMAN_ANALYST_ONLY_OPERATIONS` (policy literal and mirror). The route passes `underlyingRead`. A matrix row cited by `provenBy` must name `harness.identities.analyst` (or the actor's identity) in the cited test's body.
- **19-08 / 19-09:** remove `'"/v1/alerts/export"'` / `'"/v1/reports/:reportKey/export"'` from `UNSERVED_PATH_FRAGMENTS` when serving them.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 1 RED | tests tsc + node --test exports.integration | 4 of 4 failed: `400 CSRM assessment query is invalid.` (the detail route answered `/v1/risks/export`); the fixture's Phase 16 withdrawal succeeded |
| 1 GREEN | the plan's verify: node 24.19 check, `api:check` (then `git update-index --refresh`), `cmp` of both catalogue copies, the spec's 200 content keys and `contentMediaType`s, tests tsc, exports + served-operations + analyst-insight-routes + active-risk-readers | API_CHECK_OK, CMP_OK, SPEC_OK; 22 tests, 22 pass, 0 fail, 0 skipped; EXIT 0 |
| 2 | the plan's verify: tests tsc, authorization-policy.unit + analyst-insight-authorization.unit + exports.integration + authorization.integration | 81 tests, 81 pass, 0 fail, 0 skipped; EXIT 0 (cap fixture 10,001 Risks seeded in 277 ms) |
| 2 RED evidence | the three new policy cases with the three export branches disabled at run time (`process.env.CSRM_TEST_MUTATION === "on" &&` prefixed), then restored | 30 tests, 27 pass, 3 fail (exactly the new cases); policy file restored, no diff |
| 3 focused | authorization-matrix.integration + contract-catalogue.integration + authorization-matrix-provenance.unit | 188 tests, 188 pass, 0 fail |
| 3 | the plan's verify: node check, `cmp`, `grep -q "32 + insightOperations.size"`, `api:check` (+ refresh), `pnpm --dir apps/backend test` (ports 1337 and 3000 free) | EXIT 0: 2,147 tests, 2,146 pass, 0 fail, 1 skipped (the pre-existing POSIX-modes test on Windows), 2,538.1 s; cap fixture 10,001 Risks seeded in 259 ms |

Acceptance checks: `/v1/risks/export` precedes `/v1/risks/:riskId` in the router; `served-operations.json` lists `GET:/api/v1/risks/export` under `served` and no longer under `unserved`; both catalogue copies hold `function.risk_register.export_api.api.01` at `GET:/api/v1/risks/export?format={format}`, no `function.risk_register.risk_register.api.04`, the Function in `role.security_analyst`'s `functionIds` alone, and a last design note starting `Phase 19 ` that equals the approved record's text; `csrm-authorization.ts` holds the quoted literal and both sentences, `grep -c '"Security Analyst Agent"'` prints 0 and `SERVICE_IDENTITY_ROLE_NAME` is absent; `UNSERVED_REASONS` still starts with the `IAM_SCIM_RESERVATIONS` spread; `UNSERVED_PATH_FRAGMENTS` holds the four earlier fragments and the two insight export literals; the test names include `exports are refused to automation identities`, `analyst exports require a human Security Analyst`, `service agent`, `underlying read`, `EXPORT_ROW_LIMIT` and `service identity`; `git diff --name-only bdd0f698` over `apps/backend/src/api/*/content-types/*` (less the three IAM exclusions) prints nothing.

## Task Commits

1. **Task 1: the filtered register exported over HTTP at its reserved URL, read back, logged.** `0b790078` (test, RED), `1b94ef16` (feat, GREEN)
2. **Task 2: every refusal, in the policy and over HTTP.** `fdf16fa6` (test; see Deviations: the policy branches landed in Task 1's GREEN, as the plan's Task 1 action lists them)
3. **Task 3: the six-actor matrix row, both mirrors, the catalogue proof and the full suite.** `093516e0` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The HTTP refusals cannot assert the export sentences**
- **Found during:** Task 2
- **Issue:** Strapi answers every policy denial over HTTP with its generic `Policy Failed` 403 body, so the planned wording checks on the HTTP responses could not pass; the existing HTTP suites never assert policy sentences either.
- **Fix:** the three sentences are proven exactly in `authorization-policy.unit.test.ts` (iterating the exported set); the HTTP cases prove the 403, the JSON error body, no disclosure, no export event and unchanged persistence.
- **Files modified:** apps/backend/tests/exports.integration.test.ts
- **Commit:** fdf16fa6

**2. [Rule 1 - Bug] The no-identity case sent Bob's identity**
- **Found during:** Task 2
- **Issue:** `exportAs`'s default parameter turned an explicit `undefined` identity into Bob's, so "no identity" returned 200.
- **Fix:** `exportAs` takes `string | null`; `null` sends no identity.
- **Files modified:** apps/backend/tests/exports.integration.test.ts
- **Commit:** fdf16fa6

**3. [Rule 3 - Blocking] The matrix provenance rule needs the cited test to name the actor**
- **Found during:** Task 3
- **Issue:** `matrix-provenance.ts` (SR-02) accepts a `provenBy` citation only when the cited test's body names `identities.analyst`; the Task 1 workbook test used `exportAs`'s default identity.
- **Fix:** that test passes `harness.identities.analyst` explicitly (behaviour unchanged).
- **Files modified:** apps/backend/tests/exports.integration.test.ts
- **Commit:** 093516e0

### Planned-order note (Task 2 GREEN)

Task 1's action lists every policy addition (the refusal set, its sentence, the human-only literal, the analyst-export wording and `underlyingRead`), so they all landed in `1b94ef16`. Task 2's new cases therefore passed on their first run and no separate `feat(19-05): refuse the service identity and require the list read on exports` commit was made (it would have been empty). Their RED evidence is a run-time mutation: with the three export branches disabled, exactly the three new policy cases fail (27 of 30 pass); with the branches restored all pass. The HTTP refusals were also exercised against the finished policy only.

### Choices the plan left open

- `function.risk_register.export_api` is placed after `function.reports.run_api` (functions and `role.security_analyst.functionIds`); the moved FunctionApi keeps its array position.
- The 400, 403 and 422 responses are inline on `AssessmentWorkflowErrorResponse` (no new component); no 401 is declared, as the register list and every `/v1` operation declare none.
- The cap fixture also deletes its 10,001 Risks and links afterwards, so later export tests in the same file see the fixture alone.
- The no-token case runs as Bob with the API token omitted (401 by the `content-api-token` family).

## Known Stubs

None.

## Threat Flags

None. The one new endpoint is the plan's own (T-19-15 to T-19-18 mitigated as registered): it reads through the register's repository under its scope, both refusal sets and the underlying read guard it, and it writes nothing.

## Self-Check: PASSED

Both created files and the SUMMARY exist; commits 0b790078, 1b94ef16, fdf16fa6 and 093516e0 are in the history.
