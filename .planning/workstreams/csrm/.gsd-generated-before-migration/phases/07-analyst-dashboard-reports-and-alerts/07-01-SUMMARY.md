---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 01
subsystem: analyst-insight-foundation
tags: [strapi, authorization, catalogue, seed, derivation-rules, utc-dates, node-test, tdd]

requires:
  - phase: 06.8-workflow-visibility-and-questionnaire-governance
    provides: the API-only, human-analyst-only Function pattern (b4f3d88), HUMAN_ANALYST_ONLY_OPERATIONS and the contract-catalogue parity block
  - phase: 05-risk-register-and-mitigation-management
    provides: the Risk Register read, the scope-assertion pattern and the rating and treatment-status vocabularies the rules mirror
provides:
  - five pure, Strapi-free insight modules keyed on an explicit UTC today (utc-date, insight-constants, treatment-due-state, alert-rules, report-math)
  - the single D-04 treatment due-state definition every later server consumer cites
  - the closed eight-kind alert and three-urgency vocabularies, the deterministic id, day offset, D-12 order and one oracle classifier per source record type
  - closed report partitions, UTC month buckets and a capped, flagged median
  - five API-only Functions granting the served analyst insight operations to role.security_analyst only, in both byte-identical catalogue copies, with the D-06 design note
  - the policy guard refusing any automation identity on the insight operations, and the requireAnalystInsightScope branch
  - CSRM_ANALYST_INSIGHT_OPERATIONS, assertAnalystInsightScope and AnalystInsightError for the insight routes and controllers
  - a catalogue seed that re-seeds API-only Functions idempotently
affects: [07-02, 07-04, 07-06, 07-08, analyst-insight-routes, capability-catalogue, csrm-seed, authorization-policy]

tech-stack:
  added: []
  patterns:
    - "Insight rules take `today` as a YYYY-MM-DD UTC string and never read the clock. `utcToday(new Date())` is the only clock read, and it happens at the call site."
    - "Every date window derives from deriveTreatmentDueState. Request, review and Control Implementation windows reuse it as a date-only open item, so no date comparison is restated."
    - "An analyst insight route uses `{ operation, requireAnalystInsightScope: true }`, and its controller calls assertAnalystInsightScope before any read."

key-files:
  created:
    - apps/strapi/src/csrm/insights/utc-date.ts
    - apps/strapi/src/csrm/insights/insight-constants.ts
    - apps/strapi/src/csrm/insights/treatment-due-state.ts
    - apps/strapi/src/csrm/insights/alert-rules.ts
    - apps/strapi/src/csrm/insights/report-math.ts
    - apps/strapi/src/api/csrm-analyst-insight/operations.ts
    - apps/strapi/src/api/csrm-analyst-insight/services/insight-scope.ts
    - apps/strapi/tests/analyst-insights.unit.test.ts
    - apps/strapi/tests/analyst-insight-authorization.unit.test.ts
    - apps/strapi/tests/analyst-insight-catalogue-seed.integration.test.ts
  modified:
    - apps/strapi/src/policies/csrm-authorization.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - apps/strapi/src/bootstrap/seed-csrm-data.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts

key-decisions:
  - "requireAnalystInsightScope requires the insight operation plus four reads on the human Security Analyst role: GET /api/v1/risks, GET /api/v1/assessment_requests, GET /api/v1/questionnaires and GET /api/v1/risk_assessments (plan-check amendment). A read granted only through an automation role the same identity holds does not count."
  - "The catalogue reconciler now matches an API-only Function by a NULL menuPath. `$eq: undefined` was cast to an empty string that never matched, so every seed re-created every API-only Function. This disproves research assumption A1."
  - "alert-rules exports the D-29 request tuple as REQUEST_ALERT_STATUSES, one export beyond the plan's list, because plan 04's unit test must compare it with plan 03's REVIEWABLE_REQUEST_STATUSES without editing alert-rules.ts."
  - "compareAlerts compares identifiers, kinds and documentIds by code unit, matching SQLite's BINARY collation, so plan 04's `ORDER BY ... kind` agrees with the oracle. control-implementation-overdue therefore sorts before risk-treatment-overdue at the kind tie."
  - "Report partitions reject no category value, but they throw a RangeError for a total that is not a whole count. A corrupt count is an invariant failure, not an unknown category."
  - "normalizeDateTime accepts ISO dates and date-times only. It validates the calendar date, because V8 rolls 2026-02-30 forward, and it reads a zone-less date-time as UTC, never as host local time."

patterns-established:
  - "API-only Functions are matched as NULL-menuPath rows by the seed, and their names never repeat a menu Function name (D-33)."
  - "Mutation checks on the compiled output (restored afterwards) show each new test kills the defect it names."

requirements-completed: [DASH-01, DASH-02]

duration: "about 33 minutes (11:47:45Z to the docs commit), including one full Strapi suite of 5 min 17 s"
completed: 2026-09-24
status: complete
actuals:
  tasks: 3
  commits: 6
---

# Phase 7 Plan 01: Analyst Insight Grants, Guard and Derivation Rules Summary

**Pure, UTC-dated derivation rules for the whole of Phase 7 (the single D-04 treatment due state, the closed alert vocabulary with its oracle classifiers, and the report partitions), five API-only analyst Functions granted to the human Security Analyst only, a policy guard that refuses automation and never widens scope, and a seed fix so re-seeding no longer duplicates API-only Functions.**

This is plan 1 of 9 (D-35). It lays the authorisation and derivation foundation that plans 02, 04, 06 and 08 mount handlers on. Nothing is published in `specification.json` here: each operation is published by the plan that serves it (D-08), so the generated client and `api:check` are unchanged.

## Performance

- **Duration:** about 33 minutes, from 11:47:45Z to the docs commit. This includes one full Strapi suite (5 min 17 s), two contract-catalogue runs and two seed-test runs, each of which boots its own Strapi.
- **Started:** 2026-09-24T11:47:45Z
- **Completed:** 2026-09-24, at the docs commit that carries this summary
- **Tasks:** 3 of 3, each with RED then GREEN commits. Task 3's GREEN is a `fix`, because its RED exposed a pre-existing seed defect.
- **Files modified:** 15 (10 created, 5 modified), plus this summary.

## Accomplishments

- **Derivation rules (D-02, D-04, D-10, D-11, D-13, D-29, D-31).** Five Strapi-free modules in `apps/strapi/src/csrm/insights/`, each taking `today` as a `YYYY-MM-DD` UTC string:
  - `utc-date`: calendar arithmetic across month, year and leap-day boundaries, plus one `normalizeDateTime` for epoch milliseconds, `Date` and ISO strings.
  - `treatment-due-state`: the single D-04 rule, inclusive at both window ends, with NULL treatment status counted as not Complete. The stored "Overdue" status is never read.
  - `alert-rules`: the eight kinds, the three urgencies with ranks, `alertId`, `alertUrgency`, `alertDayOffset`, the six-rule `compareAlerts`, and the Risk, Control Implementation, request and assessment classifiers. Request alerts come only from the four reviewable statuses. Both Control Implementation kinds need an open, disclosable parent Risk. An untreated Critical is "Not Started" or NULL, matched exactly.
  - `report-math`: rating, treatment-status, control-status, effectiveness and request-status partitions that sum to their totals, UTC month buckets with a partial current month, and the capped median.
  - `insight-constants`: every window and cap as a named constant.
- **Exact grants (D-07, D-06).** Five API-only Functions ("Dashboard Summary API", "Alert List API", "Alert Summary API", "Report Catalogue API", "Run Report API") carry the five served operations, each granted to `role.security_analyst` only.
  - The reserved FunctionAPIs were re-pointed in place with new ids (`<function>.api.01`), and their names, URLs and descriptions are unchanged.
  - The Dashboard, Reports and Alerts menu Functions keep only their five unserved operations.
  - A new design note says why those five stay unserved and that `GET /api/v1/my_requests/status_summary` is served as reserved.
  - Both copies are byte-identical.
- **Human-analyst guard (D-07, D-14).**
  - The five URLs join `HUMAN_ANALYST_ONLY_OPERATIONS`, with their own denial message.
  - `requireAnalystInsightScope` grants `analystInsightScope: "all"` only to a human analyst who also holds the four underlying reads, and sets no other scope.
  - `assertAnalystInsightScope` gives controllers the matching 403.
- **Seed idempotency (D-33).** Seeding twice leaves one Function and one FunctionAPI per insight operation. The analyst role holds exactly the catalogue's Function set. The agent and Requestor roles hold none of the five.

## Task Commits

1. **Task 1 RED: pin the insight rules to literal UTC-dated cases.** `30c6945` (test)
2. **Task 1 GREEN: derive treatment due state, alert kinds and report partitions from explicit UTC dates.** `17c7ce3` (feat)
3. **Task 2 RED: prove analyst insight operations are human-analyst only and never widen scope.** `475fe79` (test)
4. **Task 2 GREEN: grant the five analyst insight operations to the human Security Analyst only.** `056247c` (feat)
5. **Task 3 RED: prove the analyst insight Functions seed idempotently.** `d1a11b8` (test)
6. **Task 3 GREEN (deviation 1): stop re-seeding from duplicating API-only Functions.** `a86266a` (fix)

**Plan metadata:** the `docs(07-01)` commit that carries this summary.

## Files Created/Modified

- `apps/strapi/src/csrm/insights/utc-date.ts`: UTC calendar arithmetic and datetime normalisation.
- `apps/strapi/src/csrm/insights/insight-constants.ts`: the named windows and caps.
- `apps/strapi/src/csrm/insights/treatment-due-state.ts`: the single D-04 rule.
- `apps/strapi/src/csrm/insights/alert-rules.ts`: the alert vocabulary, ordering and oracle classifiers.
- `apps/strapi/src/csrm/insights/report-math.ts`: the closed partitions, month buckets and median.
- `apps/strapi/src/api/csrm-analyst-insight/operations.ts`: `CSRM_ANALYST_INSIGHT_OPERATIONS`, frozen.
- `apps/strapi/src/api/csrm-analyst-insight/services/insight-scope.ts`: `AnalystInsightError` and `assertAnalystInsightScope`.
- `apps/strapi/src/policies/csrm-authorization.ts`: the human-only insight URLs, `humanAnalystDenialMessage`, and the `requireAnalystInsightScope` branch.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: the five Functions, the re-pointed FunctionAPIs, the analyst grants and the design note, byte-identical.
- `apps/strapi/src/bootstrap/seed-csrm-data.ts`: an API-only Function is matched with `menuPath: { $null: true }`.
- `apps/strapi/tests/analyst-insights.unit.test.ts`: 27 literal rule tests.
- `apps/strapi/tests/analyst-insight-authorization.unit.test.ts`: 23 policy and scope tests.
- `apps/strapi/tests/analyst-insight-catalogue-seed.integration.test.ts`: 4 seed idempotency tests.
- `apps/strapi/tests/contract-catalogue.integration.test.ts`: the "Phase 7 analyst insight grants are API-only and human-analyst only" block.

## Verification

**RED, per task:**

| Check | Result |
| --- | --- |
| Task 1: `tsc -p tests/tsconfig.json` with only the test present | exit 1: TS2307 "Cannot find module" for each of `utc-date`, `insight-constants`, `treatment-due-state`, `alert-rules` (twice) and `report-math`, plus TS7031 knock-on errors. Nothing emitted (`noEmitOnError`). |
| Task 2: `contract-catalogue.integration` with the new block and the old catalogue | 9 passed, 1 failed: `PHASE7_FUNCTION_MISSING_function.dashboard.summary_api` |
| Task 2: `tsc -p tests/tsconfig.json` with the policy test present | exit 1: TS2307 for `csrm-analyst-insight/operations` and `services/insight-scope`, TS2339 `analystInsightScope` missing from the policy state type, TS18046 on the unresolved error class |
| Task 3: `analyst-insight-catalogue-seed.integration` before the fix | 3 passed, 1 failed: `Dashboard Summary API Function rows`, `2 !== 1` |

**GREEN, per task:**

| Check | Result |
| --- | --- |
| `analyst-insights.unit` | 27 passed, 0 failed |
| Mutant: an exclusive due-soon window end (compiled output, restored) | 4 failed, including "the treatment due state follows the D-04 window with both ends inclusive" |
| Mutant: a NULL treatment status counted as Complete (compiled output, restored) | 7 failed |
| `analyst-insight-authorization.unit` | 23 passed, 0 failed |
| Mutant: insight URLs removed from the human-only set (compiled output, restored) | 5 failed (the mis-granted agent cases) |
| Mutant: the questionnaire read no longer required (compiled output, restored) | 5 failed (the missing-read cases) |
| `contract-catalogue.integration` | 10 passed, 0 failed |
| `cmp` of the two catalogue copies | exit 0 |
| `analyst-insight-catalogue-seed.integration` after the fix | 4 passed, 0 failed |

**Acceptance checks:**

| Check | Result |
| --- | --- |
| `grep -c "@strapi" apps/strapi/src/csrm/insights/*.ts` | 0 for each of the five files; the modules import only each other |
| `insight-constants.ts` literals | `ALERT_DUE_SOON_WINDOW_DAYS = 14` and `TREATMENT_REPORT_DUE_WINDOW_DAYS = 30` present |
| Compiled exports against the plan's artifact lists | all present; the only extra is `REQUEST_ALERT_STATUSES` (deviation 2) |
| `csrm-authorization.ts` strings | `requireAnalystInsightScope` (2), "CSRM analyst insights require a human Security Analyst." (1) |
| Five ids by role (`node -e` over the catalogue) | security_analyst 5 of 5, security_analyst_agent 0, requestor 0 |
| Effective insight grants by role | analyst 5, agent 0, requestor 0 |
| The human analyst's underlying reads | GET /api/v1/risks, /assessment_requests, /questionnaires and /risk_assessments all held |
| `grep -c "dashboard/summary\|/v1/alerts\|/v1/reports" docs/references/specification.json` | 0 |
| `git diff --name-only eb28084 HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| `git log eb28084..HEAD --format=%B` and the added lines, scanned for attribution | none: no attribution trailer or line, and no tool name |

**Plan gate, final tree `a86266a`:**

| Check | Result |
| --- | --- |
| `pnpm --filter @csrm/strapi test` (full, serial) | 272 passed, 0 failed, 0 skipped (5 min 17 s): 217 at the 06.9 gate plus 55 new (27 + 23 + 4 + 1). `authorization.policy.test.js` appears only in the echoed command line. |
| `pnpm --filter @csrm/web test` (full) | 444 passed across 51 files. This is unchanged from the 06.9 gate, since no web code changed. |
| `pnpm --filter @csrm/web typecheck` | clean (exit 0) |
| `pnpm --prefix apps/web api:check` | clean (exit 0, no diff): the spec and generated client are unchanged |

The web typecheck and `api:check` ran while the Strapi suite was running. Both are deterministic and independent of `apps/strapi/dist`. The web unit suite ran after the Strapi suite finished.

## Orchestrator Amendments Applied

- **Insight scope covers what the insights disclose (plan check issue 2).**
  - **Policy:** `requireAnalystInsightScope` requires, on the human Security Analyst role, `CSRM_QUESTIONNAIRE_OPERATIONS.listAll` (`GET:/api/v1/questionnaires`) and `CSRM_ASSESSMENT_OPERATIONS.list` (`GET:/api/v1/risk_assessments`), in addition to `CSRM_RISK_OPERATIONS.listRegister` and `listAnalystReviewRequests`. The four sit in the named `ANALYST_INSIGHT_UNDERLYING_READS` tuple in `csrm-authorization.ts`.
  - **Tests:** `analyst-insight-authorization.unit.test.ts` adds one denial identity for each missing grant (`insight-analyst-no-questionnaires`, `insight-analyst-no-assessments`), checked on all five operations with the exact "CSRM analyst insight access is denied." message.
  - **Behaviour:** the catalogue's human Security Analyst holds both reads, which the effective-grant check above confirms, so there is no behaviour change.

## Decisions Made

- **The request tuple is exported.** It is named `REQUEST_ALERT_STATUSES`. Plan 04 imports it to compare with plan 03's constant, and plan 04 does not list `alert-rules.ts` among its files.
- **`utcToday(now)` has no default argument.** Every clock read stays visible at its call site (D-02).
- **`TreatmentFacts` keys are required**, although their values may be null or undefined. A caller cannot omit a fact by accident (research pitfall 4).
- **One window rule.** The request, review and Control Implementation windows reuse `deriveTreatmentDueState` through a date-only open item, so the plan's "never re-states the date comparison" holds.
- **Code-unit ordering.** `compareAlerts` orders by code unit, to agree with SQLite's `ORDER BY` on the kind literal. PostgreSQL collation is a Phase 8 concern (research A2).
- **`alertDayOffset` fails loudly.** It returns null only for a missing date, and throws a RangeError for a present but malformed one, so a driver returning an unexpected date form fails loudly.
- **Frozen constants.** The tuple constants are frozen with `Object.freeze`, and the default page size and period are typed as members of their tuples.
- **API-only Function names are distinct.** "Dashboard Summary API", "Alert List API", "Alert Summary API", "Report Catalogue API" and "Run Report API" are distinct from every menu Function name. The contract-catalogue block also asserts this statically.
- **Descriptions and source entities follow the precedents.** The Function descriptions follow the `release_api` wording ("Human analyst-only {purpose} grant. ..."). Each Function's `sourceEntities` are copied from the FunctionAPI it owns.
- **`requirements-completed` lists DASH-01 and DASH-02** because the template requires the plan's requirement ids. Both requirements complete only with the phase; `REQUIREMENTS.md`, `STATE.md` and `ROADMAP.md` were not touched, since the orchestrator owns them.

## Deviations from Plan

1. **[Rule 1/3 - Bug blocking D-33] Re-seeding duplicated every API-only Function.**
   - **Found during:** Task 3. The new idempotency test failed on its first run: `Dashboard Summary API Function rows`, `2 !== 1`.
   - **Issue:** `seedCsrmData` matched each catalogue Function with `menuPath: { $eq: functionSeed.menuPath }`. For an API-only Function that is `$eq: undefined`. `menuPath` is a `text` attribute, so Strapi's `castValue` runs `_.toString(undefined)` (`@strapi/database` `dist/query/helpers/where.js`, `fields/string.js`) and queries `menu_path = ''`. That never matches the stored NULL, so every seed created every API-only Function, and its FunctionAPIs, again. The roles were re-linked to the newest rows, so authorisation kept working while duplicates accumulated. This matches the research's observation of about 85 "Assessment Request Core API" rows in the dev database. Research assumption A1, that Strapi drops the filter, is disproved, and the plan's statement that `seed-csrm-data.ts` needs no change rested on it.
   - **Fix:** match a missing `menuPath` with `{ $null: true }`, which compiles to `IS NULL`. Menu Functions keep `$eq`.
   - **Files modified:** `apps/strapi/src/bootstrap/seed-csrm-data.ts`. This file is outside the plan's `files_modified`. It is bootstrap code, and no content-type changed.
   - **Verification:** the seed test passes 4 of 4 (one row per name, one FunctionAPI row per URL, `menuPath` null, the exact analyst Function set, and menu Functions holding only their unserved APIs). The full Strapi suite is green.
   - **Committed in:** RED `d1a11b8`, fix `a86266a`.
   - **Scope:** the fix applies to all 22 API-only Functions, not only the five new ones.
2. **[Plan detail] One export beyond the artifact list.** `REQUEST_ALERT_STATUSES` in `alert-rules.ts`, for the reason in Decisions Made.
3. **[Plan detail] The ordering fixture has seven elements, not six.** A sort fixture proves a tie rule only where two adjacent sorted elements first differ at that rule. Six rules therefore need seven elements; six elements leave one rule unproven.
4. **[Plan detail] Literal cases beyond the behaviour list.** These cases pin behaviour the plan left open, and none contradicts it:
   - RangeErrors for inputs that are not calendar dates or whole numbers;
   - a zone-less datetime read as UTC;
   - month-end clamping in `addUtcMonths`;
   - the control-status and effectiveness vocabularies read from the frozen schemas;
   - the whole-count check on partition totals;
   - `ALERT_DEFAULT_PAGE_SIZE` and `THROUGHPUT_DEFAULT_PERIOD` belonging to their tuples.
5. **[Plan detail] Additional guard and catalogue assertions.**
   - **Policy test:**
     - a human analyst whose reads come only through an agent role is denied;
     - an analyst without the insight grant gets the FunctionAPI denial;
     - the allowed decision deep-equals `{ assessmentRequestActor: "analyst", analystInsightScope: "all" }`, proving nothing else widens.
   - **Catalogue block:**
     - each new FunctionAPI id is pinned as `<function>.api.01`;
     - no API-only name repeats a menu Function name.
   - **Seed test:**
     - each URL has one FunctionAPI row;
     - the Reports and Alerts menu Functions are checked as well as Dashboard.
6. **STATE.md, ROADMAP.md and REQUIREMENTS.md not touched.** The orchestrator owns them, so the executor's state-update steps were skipped.

**Total deviations:** 6. Item 1 is a correctness fix without which D-33's truth could not hold. Items 2 to 5 add proof or a needed export without changing planned behaviour. Item 6 follows the orchestrator's instruction. Scope is not reduced.

## Issues Encountered

- **Line endings.** The working tree is CRLF with an LF index (`core.autocrlf=true`).
  - Edits to the catalogue kept CRLF throughout (2,306 CRLF, no lone LF), and the bootstrap copy was produced with `cp`, so `cmp` is byte-exact.
  - The catalogue is not `JSON.stringify` output (some arrays are inline), so it was edited as text in minimal hunks rather than rewritten.
  - `api:check` rewrote `schema.d.ts` with LF and git reported no content diff.
- **pnpm engine warning.** The standalone pnpm prints "Unsupported engine ... current: v22.19.0" even with the Node 24 PATH prefix. `node` resolves to v24.19.0 and every run used it. The warning is cosmetic.

## Deferred Issues

- **`tests/authorization.policy.test.js` never runs.** This is the finding the plan asked to record. The Strapi `test` script passes `dist/tests/authorization.policy.test.js` to `node --test`. The root `tsc` excludes `**/*.test.*` and does not compile JavaScript sources, and `apps/strapi/dist/tests/` holds only `fixtures/` and `helpers/` (checked during this plan). Node 24 treats the argument as a glob, so it matches nothing and is skipped silently. The file also still asserts five assessment-request operation keys where `operations.ts` has six. It was not edited. Phase 7's policy proofs live in `analyst-insight-authorization.unit.test.ts`, which compiles and runs every time.
- **`scripts/verify-phase-06-integrity.mjs` pins stale catalogue counts.** It expects 30 Functions and 110 FunctionAPIs. The catalogue had 40 and 121 before this plan and has 45 and 121 now. The script is not part of any suite and was already stale, so it was not changed.
- **Duplicate rows in the operator's dev database.** Duplicate API-only Function rows from earlier boots remain.
  - On the next boot with `IDAMBOX_SEED_CSRM=true`, the reconciler reuses one existing row per name, re-links the roles to it, and reconciles its FunctionAPIs to the catalogue. Authorisation stays correct, and the older duplicates stay detached and unreachable.
  - A clean-up is optional and was not attempted. The dev database is the orchestrator's.

## Known Stubs

None. The five operations are granted and guarded but not yet routed, by design. Plans 02, 04, 06 and 08 mount them, together with their contract and parsers (D-08).

## Threat Flags

None beyond the plan's threat model.
- **The seed fix sits inside T-07-01-04.** That entry covers duplicate API-only Function rows accumulating grants. It changes how rows are matched, not what is granted.
- **No new endpoint or route exists yet.** No content-type was touched.

## Next Phase Readiness

- **Ready for plan 02 onward.** Plans 02, 04, 06 and 08 can mount routes with `{ operation: CSRM_ANALYST_INSIGHT_OPERATIONS.<name>, requireAnalystInsightScope: true }` and call `assertAnalystInsightScope` first.
  - Insight routes should set no other scope flag. The earlier policy branches (reference data, administration, Risk Register) are checked first and would take precedence.
- **Plan 04's SQL order must match `compareAlerts`.** The last tie rules compare by code unit.
- **Plan 04 must cross-check the request tuple.** `REQUEST_ALERT_STATUSES` is ready to compare with plan 03's `REVIEWABLE_REQUEST_STATUSES`.
- **The orchestrator's next dev Strapi restart reseeds.** It moves the five FunctionAPIs to the new Functions in the dev database.

## TDD Gate Compliance

Each task has a `test(07-01)` RED commit followed by its GREEN commit: `30c6945` then `17c7ce3`, `475fe79` then `056247c`, and `d1a11b8` then `a86266a` (a `fix`, because the RED exposed a pre-existing defect).

## Self-Check: PASSED

- The ten created files exist and are tracked at HEAD.
- Commits `30c6945`, `17c7ce3`, `475fe79`, `056247c`, `d1a11b8` and `a86266a` exist on `dev`.
- No tracked file was deleted between `eb28084` and HEAD.
- `cmp` of the two catalogue copies exits 0, and `git status` shows only the pre-existing untracked `.planning/debug/`.

---
*Phase: 07-analyst-dashboard-reports-and-alerts*
*Completed: 2026-09-24*
