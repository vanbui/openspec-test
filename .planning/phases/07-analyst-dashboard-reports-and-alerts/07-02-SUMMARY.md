---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 02
subsystem: requestor-dashboard-and-risk-register
tags: [strapi, knex, sqlite, openapi, openapi-typescript, zod, react, vitest, node-test, tdd]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 01)
    provides: deriveTreatmentDueState, TREATMENT_DUE_STATES, utcToday, isUtcDate and addUtcDays, and the reserved my_requests.api.02 grant with its design note
  - phase: 05-risk-register-and-mitigation-management
    provides: the Risk Register knex repository, its closed parser, the register UI and the Phase 5 contract test
  - phase: 06.3-owner-and-analyst-scope-separation
    provides: requireRequestCollectionScope (owner scope with the numeric user id for every actor) and the contract-to-client parity guard
provides:
  - GET /api/v1/my_requests/status_summary, an owner-scoped knex group-by for every actor, published with closed components
  - countOwnedRequestsByStatus and projectMyRequestStatusSummary
  - getMyRequestStatusSummary, myRequestStatusSummaryResponseSchema and parseMyRequestStatusSummaryPayload
  - a Requestor dashboard that makes one draft list read and one summary read, where it made eight list reads
  - RiskRegisterItem.treatmentDueState across the server projection, the spec, the generated client, the closed parser and the register marker
  - listRiskRegister({ ..., today }) and projectRiskRegisterItem(document, today), with the controller as the only clock read
  - the closed Risk Register state filter (open | closed; absent means all) across the parser, a constant SQL predicate, the spec, the client, the canonical URL, More filters, the mobile Sheet and the chip
  - RISK_REGISTER_STATES (server), riskRegisterStates, riskRegisterStateLabels and riskTreatmentDueStates (web)
  - mounted served-shape pinning helpers (specKeys, assertServedRegisterShape) in the register and summary tests
affects: [07-04, 07-05, 07-06, 07-08, 07-09, requestor-dashboard, risk-register, analyst-dashboard, reports, alerts]

tech-stack:
  added: []
  patterns:
    - "An owner-scoped count is one knex group-by joined on the requestor link with the policy's numeric user id; the route sets requireRequestCollectionScope and the handler refuses any query key."
    - "A derived row fact takes an explicit UTC today as a required input; the controller reads the clock once with utcToday(new Date())."
    - "A closed filter maps a parsed enum to a constant whereRaw fragment inside applyFilters, so the total and the page share the predicate."
    - "Mounted tests pin every served key set against the published spec component (specKeys), level by level."

key-files:
  created:
    - apps/strapi/src/api/csrm-assessment-request/services/request-status-summary.ts
    - apps/strapi/src/api/csrm-assessment-request/controllers/my-request-status-summary.ts
    - apps/strapi/src/api/csrm-assessment-request/routes/my-request-status-summary.ts
    - apps/strapi/tests/request-status-summary.integration.test.ts
  modified:
    - apps/strapi/src/api/csrm-assessment-request/operations.ts
    - apps/strapi/src/api/csrm-risk/services/risk-register.ts
    - apps/strapi/src/api/csrm-risk/services/risk-register-query.ts
    - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - apps/strapi/tests/risk-register.unit.test.ts
    - apps/strapi/tests/risk-register.integration.test.ts
    - apps/strapi/tests/risk-register-seed.integration.test.ts
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts
    - apps/web/src/features/requests/request-schema.ts
    - apps/web/src/features/requests/request-service.ts
    - apps/web/src/features/requests/request-service.test.ts
    - apps/web/src/features/dashboard/requestor-dashboard-service.ts
    - apps/web/src/features/dashboard/requestor-dashboard.test.tsx
    - apps/web/src/features/risks/risk-schema.ts
    - apps/web/src/features/risks/risk-schema.test.ts
    - apps/web/src/features/risks/risk-service.test.ts
    - apps/web/src/features/risks/risk-register.tsx
    - apps/web/src/features/risks/risk-register-filters.tsx
    - apps/web/src/features/risks/risk-register.test.tsx

key-decisions:
  - "The summary counts rows through a Map keyed by the seven datamodel statuses (total by `satisfies Record<RequestStatus, …>`). An unknown or NULL status is ignored, so total is always the sum of the seven, and a count that is not a whole number throws, as report-math does."
  - "listRiskRegister asserts scope before it validates today, so a denied caller still gets 403 when the date is malformed. A malformed today is a RiskRegisterError(400, \"CSRM Risk Register date is invalid.\") raised before any repository read."
  - "The overdue marker keeps its Phase 5 look (AlertTriangle and the word, in the warning token); only its condition changed. Plan 05 swaps in AlertUrgencyBadge (UI-D13)."
  - "The Risk state select sits directly after Mitigation-control status in More filters, the URL key after mitigationStatus, matching the published parameter order. Option labels come from riskRegisterStateLabels, not JSX."
  - "The register's web query and row parsers are pinned directly to the published operation and component in risk-schema.test.ts, because the shared parity guard cannot exercise the register parser (see Deferred Issues)."

patterns-established:
  - "specKeys(component): the sorted property names of a closed spec component, compared with Object.keys of each served level."
  - "Boundary fixtures for date-derived facts use utcToday(new Date()) and addUtcDays offsets, with a rollover assertion (UTC_DAY_ROLLED_OVER_DURING_TEST) instead of a silent midnight flake."

requirements-completed: [DASH-01]

duration: "about 50 minutes (13:01:36Z to 13:52Z), including one full Strapi suite of 11 min 4 s"
completed: 2026-09-24
status: complete
actuals:
  tasks: 3
  commits: 6
---

# Phase 7 Plan 02: Requestor Status Summary, Treatment Due State and Risk State Filter Summary

**The Requestor dashboard now reads its lifecycle counts from one owner-scoped database group-by (`GET /api/v1/my_requests/status_summary`), where it made seven list reads. Every Risk Register row carries a server-derived `treatmentDueState`, so the Overdue marker can no longer flag a Complete or closed Risk. The register also takes a closed `open` | `closed` state filter whose total equals the rows it pages.**

This is plan 2 of 9 (D-35), wave 2. It delivers D-22 and D-28, D-04 and D-26, and the D-36 filter. Each is a vertical slice through the Strapi projection, `specification.json`, the regenerated client, the closed Zod parser and tests (D-08).

## Performance

- **Duration:** about 50 minutes, from 13:01:36Z to about 13:52Z. This includes one full Strapi suite (11 min 4 s, slower than usual because the web suite ran beside it for part of the time), the full web suite, three RED and three GREEN rounds of the targeted mounted files, and five mounted or unit mutation runs.
- **Started:** 2026-09-24T13:01:36Z
- **Completed:** 2026-09-24, at the docs commit that carries this summary
- **Tasks:** 3 of 3, each a RED commit followed by a GREEN commit
- **Files modified:** 25 (4 created, 21 modified), exactly the plan's `files_modified`, plus this summary

## Accomplishments

- **Requestor status summary (D-05, D-22, D-28).**
  - The catalogue-reserved `GET /api/v1/my_requests/status_summary` is served from its own router, controller and service in `csrm-assessment-request`.
  - The count is one knex group-by: `csrm_assessment_requests` joined to `csrm_assessment_requests_requestor_lnk`, filtered by the policy's numeric user id, and grouped by `request_status` with `countDistinct`.
  - Any query key is refused with a safe 400 before a read, and a missing owner scope is a 403.
  - The response has eight keys: `draft`, `submitted`, `questionnaireInProgress`, `riskAssessmentDrafted`, `underReview`, `approved`, `closed` and `total`. It is published as the closed `MyRequestStatusSummaryResponse` and `MyRequestStatusSummary` components and parsed strictly on the web.
  - `getRequestorDashboard()` makes one draft list read and one summary read. The 403 branch (dashboard permission state) and the null-count branch ("These counts are unavailable right now. Your requests are still listed in My Requests.") are unchanged. No string, layout or link changed (UI-SPEC §7.6).
- **Treatment due state (D-04, D-26).**
  - `projectRiskRegisterItem(document, today)` derives `treatmentDueState` with the plan 01 `deriveTreatmentDueState` from the hydrated document's own `targetDate`, `treatmentStatus` and `closureDate`. A non-string field counts as absent. `closureDate` is read but never disclosed on the row.
  - The controller passes `today: utcToday(new Date())`, the only clock read.
  - `TreatmentDueState` is published as a closed five-value enum and is a required `RiskRegisterItem` property.
  - The web parses it on the closed row. The register renders the existing Overdue marker exactly when the state is `overdue`, in both the desktop cell and the mobile card. `isRiskOverdue` is deleted, and `grep -rn isRiskOverdue apps/web/src` prints nothing.
- **Risk state filter (D-36).**
  - `RISK_REGISTER_STATES = ["open", "closed"]` is parsed with the existing closed `enumValue`: case variants, empty values, arrays and operator objects are 400.
  - `applyFilters` adds the constant `r.closure_date IS NULL` or `IS NOT NULL`. `count` and `selectPage` share `applyFilters`, so the total always equals the rows paged.
  - The parameter is published after `mitigationStatus` with the plan's description, so the Phase 5 `targetDateFrom … sort` regex still holds.
  - On the web, the canonical query and serialiser carry `state`. It has a URL key, the chip "Risk state: Open" or "Risk state: Closed", a "Risk state" select (All, Open, Closed) in More filters and therefore in the mobile Sheet, and it is cleared with the other filters.

## Task Commits

1. **Task 1 RED: pin the owner-scoped request status summary and the one-read dashboard.** `6c48757` (test)
2. **Task 1 GREEN: read the Requestor lifecycle counts from one owner-scoped status summary.** `fa97f0a` (feat)
3. **Task 2 RED: require the server treatment due state on every Risk Register row.** `9887ddd` (test)
4. **Task 2 GREEN: show the Risk Register overdue marker from the server treatment due state.** `f8ae5d2` (feat)
5. **Task 3 RED: pin the Risk Register open and closed state filter.** `53fc3c6` (test)
6. **Task 3 GREEN: filter the Risk Register by open or closed state.** `6bb63e2` (feat)

**Plan metadata:** the `docs(07-02)` commit that carries this summary.

Each GREEN commit carries its `specification.json` change together with the regenerated `schema.d.ts`, and `api:check` was clean after each.

## Files Created/Modified

- **Strapi, summary:** `services/request-status-summary.ts` (`countOwnedRequestsByStatus`, `projectMyRequestStatusSummary`, `RequestStatusSummaryError`), `controllers/my-request-status-summary.ts` (the plain-object `statusSummary` handler), `routes/my-request-status-summary.ts` (its own router with the owner collection policy) and `operations.ts` (`myRequestStatusSummary`), all in `apps/strapi/src/api/csrm-assessment-request/`.
- **Strapi, register:** `risk-register.ts` (`treatmentDueState`, required `today`, the state predicate), `risk-register-query.ts` (`RISK_REGISTER_STATES`, the `state` key and parse) and `controllers/csrm-risk.ts` (`today: utcToday(new Date())`), in `apps/strapi/src/api/csrm-risk/`.
- **Contract:** `docs/references/specification.json` (the summary path, two summary components, `TreatmentDueState`, the row property and the `state` parameter) and `apps/web/src/lib/api/generated/schema.d.ts` (regenerated).
- **Web, requests and dashboard:** `request-schema.ts` (the strict schema, `RequestStatusCount` and `parseMyRequestStatusSummaryPayload`), `request-service.ts` (`getMyRequestStatusSummary` and its parity registration) and `requestor-dashboard-service.ts` (one summary read).
- **Web, risks:** `risk-schema.ts` (`riskTreatmentDueStates`, `riskRegisterStates`, `riskRegisterStateLabels`, the row and query fields; `isRiskOverdue` deleted), `risk-register.tsx` (`TargetDate({ value, dueState })`, the `state` URL key, chip and clear) and `risk-register-filters.tsx` (the "Risk state" select).
- **Tests:** `request-status-summary.integration.test.ts` (4 mounted tests, new); `contract-catalogue.integration.test.ts` (3 new Phase 7 blocks, and the deliberate update to the Phase 5 parameter list); `risk-register.unit.test.ts` (4 new tests, with the call sites and the closed allowlist updated deliberately); `risk-register.integration.test.ts` (2 new mounted tests, the spec-pinned shape helper, and the deliberate key-set update); `risk-register-seed.integration.test.ts` (passes `utcToday(new Date())` and checks the state is present); and the web tests listed in key-files.

## Verification

**RED, per task:**

| Check | Result |
| --- | --- |
| Task 1: `request-status-summary.integration` | 0 passed, 4 failed. Every read returned 404 `NotFoundError`, because the route did not exist. |
| Task 1: `contract-catalogue.integration` | 10 passed, 1 failed: `UNEXPECTED_MISSING_GET_/v1/my_requests/status_summary` |
| Task 1: web (the plan's command runs the whole suite, see Issues) | 3 failed, 443 passed (446) across 51 files: `service.getMyRequestStatusSummary is not a function` twice, and the dashboard deep-equal (it still derived counts from seven list totals) |
| Task 2: `tsc -p tests/tsconfig.json` | exit 1, 13 errors, all about the missing input or field: TS2353 `today` ×7, TS2551 `treatmentDueState` ×4, TS2554 "Expected 1 arguments, but got 2" ×2 |
| Task 2, emitted with `--noEmitOnError false`: unit, mounted, catalogue | unit 10 passed, 4 failed; mounted 8 passed, 2 failed (the row key set, and `TREATMENT_DUE_STATE_past target, in progress`); catalogue 11 passed, 1 failed: `PHASE7_DUE_STATE_COMPONENT_MISSING` |
| Task 2: web risk files | 4 failed, 109 passed. The key failure is the plan's `fails_when`: `RSK-2026-010 desktop marker: expected … to have a length of +0 but got 1`. The Complete Risk with a past date still showed Overdue. |
| Task 3: `tsc -p tests/tsconfig.json` | exit 1: TS2724 `RISK_REGISTER_STATES` missing ×2, TS2339 `state` not on `RiskRegisterFilters` ×2 |
| Task 3, emitted: unit, mounted, catalogue | unit 14 passed, 1 failed (`RISK_REGISTER_STATES is not iterable`); mounted 10 passed, 1 failed (`RISK_STATE_PAGE_FAILED_{"state":"open"}`, a 400 for the unknown key); catalogue 11 passed, 2 failed (the Phase 5 parameter list, and `PHASE7_STATE_PARAMETER`) |
| Task 3: web risk files | 6 failed, 54 passed, each on the missing filter: `Filters (13)`, the "Risk state" combobox, the canonical query, the contract pin, the vocabulary and the service query |

**GREEN, per task:**

| Check | Result |
| --- | --- |
| Task 1: root `tsc`, tests `tsc` | both exit 0 |
| Task 1: `request-status-summary.integration` | 4 passed, 0 failed (re-run after the mutants: 4 of 4) |
| Task 1: `contract-catalogue.integration` | 11 passed, 0 failed |
| Task 1: web (whole suite) and typecheck | 447 passed across 51 files (the parity guard gained `request.getMyRequestStatusSummary`); typecheck exit 0 |
| Task 1: `api:check` after the commit | exit 0 |
| Task 2: `risk-register.unit`, `risk-register.integration`, `contract-catalogue.integration`, `risk-register-seed.integration` | 14 of 14, 10 of 10, 12 of 12, 3 of 3 |
| Task 2: web (whole suite), typecheck, `grep -rn isRiskOverdue apps/web/src` | 449 passed across 51 files; exit 0; no match |
| Task 2: `api:check` after the commit | exit 0 |
| Task 3: `risk-register.unit`, `risk-register.integration`, `contract-catalogue.integration` | 15 of 15, 11 of 11, 13 of 13 |
| Task 3: web risk files and parity, typecheck | 116 passed across 5 files; exit 0 |

**Mutants.** Each was applied to the source, run, and restored. The sha256 prefix was identical before and after each one.

| Mutant | Killed by |
| --- | --- |
| Summary SQL without `where("o.idambox_user_id", requestorId)` | `OWNER_SUMMARY_NOT_OWNER_SCOPED`, `ANALYST_SUMMARY_NOT_OWNER_SCOPED` |
| Summary route without `requireRequestCollectionScope` | `SUMMARY_READ_FAILED_owner`, `SUMMARY_READ_FAILED_analyst` (403 without an owner scope) |
| Projection ignores `closureDate` | unit `closed with a past target`; mounted `TREATMENT_DUE_STATE_closed with a past target` |
| Projection reads the clock instead of `today` | unit `DUE_STATE_NOT_EVALUATED_ON_2027-01-17` |
| `applyFilters` ignores `state` | mounted `RISK_STATE_OPEN` |

**Plan gate (final tree, `6bb63e2`):**

| Check | Result |
| --- | --- |
| `pnpm --filter @csrm/strapi test` (full, serial) | 298 passed, 0 failed, 0 skipped, 0 cancelled, exit 0 (13:40:00Z to 13:51:04Z). This is the 285 at the 07-03 gate plus 13 new: 4 summary, 3 catalogue, 4 unit and 2 mounted register tests. |
| `pnpm --filter @csrm/web test` (full) | 452 passed across 51 files, exit 0. This is the 444 at the 07-03 gate plus 8 new. |
| `pnpm --filter @csrm/web typecheck` | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0 with the files staged, and again after the commit |
| `git diff --name-only 8520a79 HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| `cmp` of the two catalogue copies | identical; neither changed in this plan |
| Commit messages and added lines scanned for attribution trailers and tool or assistant names | none |
| Deleted files across the plan | none |

The web suite ran while the Strapi suite was running; the web suite never reads `apps/strapi/dist`.

## Orchestrator Amendments Applied

- **Catalogue test in each task's verification (issue 8).** Each task added its own block and compiled and ran `contract-catalogue.integration.test.js` in its RED and GREEN steps:
  - Task 1: "Phase 7 Requestor status summary is published closed and granted through My Requests";
  - Task 2: "Phase 7 Risk Register rows publish the server-derived treatment due state";
  - Task 3: "Phase 7 Risk Register publishes the closed open and closed state filter", plus the Phase 5 parameter-list update.
- **Served-shape pinning (issue 1).**
  - **Summary:** `request-status-summary.integration.test.ts` compares the envelope with `specKeys("MyRequestStatusSummaryResponse")` and `data` with `specKeys("MyRequestStatusSummary")` for every identity read. It also pins the literal eight keys and checks that each count is a whole number.
  - **Register:** `risk-register.integration.test.ts` gains `assertServedRegisterShape`. It pins the envelope (`RiskRegisterResponse`), each row (`RiskRegisterItem`), `assessment` (`RiskRegisterAssessment`), the `treatmentOwner` object branch (`RiskRegisterUser`), `meta`, `pagination`, each selected label, and the full selected-label set when all five relation filters are active. The new due-state page serves both `treatmentOwner` branches (one object, six null). Every state-filter page is pinned as well.
  - **Not pinned:** error envelopes. See Deferred Issues.
- **Execution (issue 7).** Six commits: RED then GREEN per task. Each task's own tests were green before its GREEN commit.

## Decisions Made

- **The operation's path.** It is D-28's reserved `my_requests/status_summary`. UI-SPEC §7.6 still names `my_assessment_requests`, which D-28 superseded, so that text is stale and was not followed.
- **Summary folding.** Counts are folded through a `Map` of the seven statuses, so a stored value such as "constructor" can never match. A non-whole count throws a RangeError, which the dashboard treats as "counts unavailable", the same as any other summary failure.
- **The summary's requestor id is checked twice.** The controller accepts only an integer `assessmentRequestRequestorId` under an `own` scope. The service also refuses a non-positive or unsafe id (`RequestStatusSummaryError`).
- **Scope, then date, then query.** `listRiskRegister` asserts scope first, then validates `today`, then parses the query. An invalid `today` touches no repository method; a unit test proves it.
- **The mounted due-state test uses a fresh mutable parent** (`ASM-DUE-STATE-001`), and the state test uses another (`ASM-RISK-STATE-001`), so Risks from other tests can never share their pages. Boundary dates are `today` offsets from `utcToday(new Date())`. A UTC rollover during the test fails with its own message.
- **The stored "Overdue" treatment status is never read as a due state.** A unit case pins it: stored "Overdue" with a later target is `later`.
- **Web presentation maps live outside JSX:** `riskRegisterStateLabels` in `risk-schema.ts` (AGENTS.md).
- **`requirements-completed` lists DASH-01**, copied from the plan. DASH-01 completes only with the phase. `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, as instructed.

## Deviations from Plan

1. **[Plan detail] `risk-service.test.ts` changed in Task 2 as well as Task 3.**
   - **Issue:** its register fixture goes through the closed row parser, so it needed `treatmentDueState` as soon as the parser required it. The plan lists the file under Task 3 only.
   - **Commits:** `9887ddd`, then `53fc3c6` for `state`.
2. **[Additional proof] A direct register parser-to-contract pin in `risk-schema.test.ts`.**
   - **Found during:** Task 3.
   - **Issue:** the shared parity guard cannot exercise the register parser (see Deferred Issues).
   - **Fix:** "keeps the register query and row parsers in step with the published contract" compares:
     - the web query schema's keys with the `/v1/risks` parameter names;
     - the `state` enum with `riskRegisterStates`;
     - the row schema's keys with `RiskRegisterItem.properties`;
     - `TreatmentDueState.enum` with `riskTreatmentDueStates`.
   - The shared guard was not changed.
   - **Commits:** `53fc3c6` (RED on the missing `state`), `6bb63e2`.
3. **[Plan detail] Exports beyond the artifact lists.**
   - **Strapi:** `MyRequestStatusSummary`, `RequestStatusCountRow` and `RequestStatusSummaryError`.
   - **Web:** `RequestStatusCount`, `parseMyRequestStatusSummaryPayload`, `RiskTreatmentDueState` and `riskRegisterStateLabels`.
4. **[Plan detail] Descriptions in the contract.** The summary operation, `MyRequestStatusSummary` and `TreatmentDueState` carry descriptions. The operation's says it counts the caller's own requests for every actor and rejects any query key. The catalogue test pins everything except the free text.
5. **[Plan detail] Proof beyond the behaviour list.**
   - **Mounted summary:**
     - an analyst-owned request is counted for the analyst and nobody else, a positive proof of own scope;
     - a missing identity gets 403 and a missing token 401;
     - six query forms, including requestor tampering and `populate`, are rejected for two identities;
     - denials and rejections leak no counts.
   - **Unit:**
     - eight malformed `today` forms are refused with no repository read;
     - one register read is evaluated on four different days;
     - the stored "Overdue" status is ignored;
     - non-string facts count as absent.
   - **Mounted register:**
     - `closureDate` is never disclosed;
     - closed with Low gives an empty page;
     - absent means all;
     - six malformed `state` forms return a safe 400.
   - **Web:**
     - the unavailable-counts copy renders with the other three widgets intact;
     - 502 and 503 summary failures give null counts;
     - seven malformed summary payloads fail closed;
     - the marker is checked on the desktop row and the mobile card for seven states, including an `overdue` state with a future date (the web never re-derives it) and `later`;
     - the Risk state select's exact options, the chip, the mobile Sheet value and chip removal.
6. **STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.** The orchestrator owns them, so the executor's state-update steps were skipped.

**Total deviations:** 6. None reduces scope or changes the planned contract. Item 1 is required by the closed parser. Items 2 and 5 add proof. Items 3 and 4 are small additive details. Item 6 follows the orchestrator's instruction.

## Issues Encountered

- **The plan's web verify command runs the whole suite.** `pnpm --filter @csrm/web test -- a b c` passes a literal `--` to vitest (`vitest run "--" "requestor-dashboard" …`), so vitest runs every file. The results are still valid (whole-suite counts are reported above). For targeted runs, `pnpm --filter @csrm/web exec vitest run <patterns>` or `npx vitest run <patterns>` from `apps/web` filters as intended.
- **RED runtime evidence under `noEmitOnError`.** The strict tests `tsc` emits nothing when the tests reference a missing parameter or export. Runtime RED was therefore observed by emitting once with `--noEmitOnError false`. Every GREEN run used the strict compile.
- **Line endings.** Edited files kept CRLF (checked before each commit, with no lone LF). New files are LF in the working tree, and git normalises the index to LF. `api:check` showed no content diff.
- **pnpm engine warning.** pnpm prints "Unsupported engine ... current: v22.19.0" even with the Node 24 PATH prefix. `node` resolved to v24.19.0 for every run.

## Deferred Issues

- **The parity guard's register entry is vacuous (pre-existing, found in Task 3).**
  - **Cause:** `contract-response-parity.test.ts` synthesises every integer as `max(minimum, 1)` and ignores integer enums. `RiskRegisterPagination.pageSize` (enum `[10, 25, 50]`) is therefore always 1. The register parser rejects all three synthesised payloads, and `responseParser` in `risk-service.ts` reports the failure at the root, which `narrowedPaths: ['data']` then excuses.
  - **Effect:** the guard accepts any register drift. This was confirmed with a temporary probe, removed afterwards: minimal, maximal and nullable are all rejected at `meta.pagination.pageSize`.
  - **Suggested fix:** return the first enum value for integer enums in `instanceOf`, then drop the `['data']` narrowing on `risks.listRiskRegister`, and re-check the other entries for narrowings that become stale.
  - **In this plan:** the register is covered by the mounted spec pinning and the direct pin (deviation 2).
- **Error envelopes carry an undeclared `data: null` (pre-existing, API-wide).** Strapi's `ctx.badRequest` and `ctx.forbidden` serve `{ "data": null, "error": { … } }`, but `AssessmentWorkflowErrorResponse` and its siblings are closed with `error` only. The web never parses error bodies with a closed schema (it keys on status), so there is no user-facing effect. A later contract pass should either declare `data: null` or strip it.
- **Items recorded by 07-01 and 07-03 are unchanged.** `authorization.policy.test.js` never runs, and `verify-phase-06-integrity.mjs` has stale counts.

## Known Stubs

None. Every new field and read is wired end to end: the summary to the dashboard, `treatmentDueState` to the marker, and `state` to the query, the chip and the select.

## Threat Flags

None beyond the plan's threat model.
- **T-07-02-01:** owner scope comes from the policy's numeric id. The SQL joins on it alone, and the mounted test proves it for the owner, the second Requestor, the human analyst, the service agent and the analyst-named identity without a role.
- **T-07-02-02:** any query key is refused before a read.
- **T-07-02-03:** `state` is a closed enum with constant `whereRaw` fragments and no interpolation.
- **T-07-02-04:** safe 400 and 403 messages; tests assert no `SQL`, `stack` or `database` text.
- **T-07-02-05:** accepted. The web renders only the server state.

## Next Phase Readiness

- **Plans 06 and 08** can link exposure tiles and rows to `/app/risks?residualRating={Rating}&state=open` and `/app/risks?state=open`. The register's total for those URLs is the open predicate `r.closure_date IS NULL`, the same fact the report and dashboard counts must use (D-36).
- **Plan 05** can replace the marker's look with `AlertUrgencyBadge` (UI-D13) on the same `treatmentDueState === 'overdue'` condition, and may add due-soon presentation from the same field.
- **Plan 04 and later** read due states from `deriveTreatmentDueState`. The register rows now agree with it by construction.
- **Browser (plan 05's targeted run and the orchestrator):**
  - The Strapi dev server must restart to mount the new route and the register changes.
  - `risk-register-workflow.spec.ts` should behave as before: a fresh seed gives the mutable Risk a target of 2026-12-01, the spec persists 2026-08-30 ("In Progress", no closure date), and the server state is `overdue`, so the marker and its icon still show.
  - `requestor-request-workflow.spec.ts` still sees seven lifecycle cards.

## TDD Gate Compliance

Each task has a `test(07-02)` RED commit followed by its `feat(07-02)` GREEN commit: `6c48757` then `fa97f0a`, `9887ddd` then `f8ae5d2`, and `53fc3c6` then `6bb63e2`.

## Self-Check: PASSED

- The four created files exist and are tracked at HEAD.
- Commits `6c48757`, `fa97f0a`, `9887ddd`, `f8ae5d2`, `53fc3c6` and `6bb63e2` exist on `dev`.
- No tracked file was deleted between `8520a79` and HEAD.
- `git status` showed only the pre-existing untracked `.planning/debug/` before this summary was written.

---
*Phase: 07-analyst-dashboard-reports-and-alerts*
*Completed: 2026-09-24*
