---
phase: 07-analyst-dashboard-reports-and-alerts
plan: 04
subsystem: analyst-alerts
tags: [strapi, knex, sqlite, union-all, openapi, openapi-typescript, zod, vitest, node-test, seed, tdd]

requires:
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 01)
    provides: the closed alert vocabulary, compareAlerts, the rule oracles, utcToday and addUtcDays, the named window and page sizes, normaliseRating, the alert grants and requireAnalystInsightScope
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 02)
    provides: the served-shape pinning pattern (specKeys) and the Risk Register treatment due state the alert window agrees with
  - phase: 07-analyst-dashboard-reports-and-alerts (plan 03)
    provides: REVIEWABLE_REQUEST_STATUSES, the knex repository style and the harness createFixtureDocument seam
provides:
  - GET /api/v1/alerts and GET /api/v1/alerts/summary, human Security Analyst only, derived on read from existing columns
  - createAlertRepository (listPage, count, countByKindAndUrgency), projectAlertRow and summariseAlertCounts, one UNION ALL branch per kind shared by the list, its total and the summary
  - parseAlertListQuery, assertEmptyInsightQuery and AlertQueryError
  - applyDisclosableParent exported from the Risk Register for every insight repository
  - the published AlertKind, AlertUrgency, AlertSourceType, AlertLinkType and ten closed alert components, the regenerated client and the AnalystInsight 400 and 403 responses
  - web alert-schema (vocabularies checked both ways against the generated unions, strict parsers, the URL query schema) and alert-service (listAlerts, getAlertSummary, parity registration)
  - the static analyst insight route inventory that plans 06 and 08 extend
  - seedAnalystInsights, ANALYST_INSIGHTS_FIXTURE and ANALYST_INSIGHTS_DAY_OFFSETS, the boot-relative Phase 7 fixture raising all eight kinds
affects: [07-05, 07-06, 07-07, 07-08, 07-09, alerts-screen, analyst-dashboard, reports, e2e-analyst-insights]

tech-stack:
  added: []
  patterns:
    - "A derived list is a UNION ALL of closed branch builders, each selecting the same typed columns (CAST literals and typed NULLs) in one fixed order; the list, its total and its grouped summary are all read from that one derived table."
    - "An ORDER BY that must agree with a pure comparator restates it rule for rule as constant fragments, and a mounted test sorts the served list with the comparator and adds a tie fixture for the last rule."
    - "A web vocabulary tuple is checked against its generated union in both directions with `true satisfies SameUnion<...>`, so a contract change fails the typecheck until it is mirrored."
    - "A boot-relative fixture declares every date as a named whole-day offset and writes only those, so a test can prove every date moves with the run's today."

key-files:
  created:
    - apps/strapi/src/api/csrm-analyst-insight/services/alert-query.ts
    - apps/strapi/src/api/csrm-analyst-insight/services/alert-repository.ts
    - apps/strapi/src/api/csrm-analyst-insight/controllers/alerts.ts
    - apps/strapi/src/api/csrm-analyst-insight/routes/alerts.ts
    - apps/strapi/src/bootstrap/seed-analyst-insights.ts
    - apps/strapi/tests/analyst-alert-query.unit.test.ts
    - apps/strapi/tests/analyst-alerts.integration.test.ts
    - apps/strapi/tests/analyst-insight-routes.unit.test.ts
    - apps/strapi/tests/analyst-insights-seed.integration.test.ts
    - apps/web/src/features/alerts/alert-schema.ts
    - apps/web/src/features/alerts/alert-schema.test.ts
    - apps/web/src/features/alerts/alert-service.ts
    - apps/web/src/features/alerts/alert-service.test.ts
  modified:
    - apps/strapi/src/api/csrm-risk/services/risk-register.ts
    - apps/strapi/src/index.ts
    - apps/strapi/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/web/src/lib/api/generated/schema.d.ts
    - apps/web/src/features/contract-response-parity.test.ts

key-decisions:
  - "The SQL order restates compareAlerts rule for rule as six constant fragments (urgency rank, undated last, date, source identifier, kind, source documentId). SQLite's BINARY collation compares by code unit, as compareAlerts does. The mounted test sorts the served list with compareAlerts, and a tie fixture proves the documentId rule."
  - "Branch columns are typed literals (CAST(? AS TEXT), CAST(? AS INTEGER), CAST(NULL AS TEXT)) with identifiers bound through ??, so the union lines up without dialect-specific typing and no SQL text is built from a value."
  - "source.released is a correlated EXISTS over the release triple of the assessment the work belongs to (the Risk's parent, a request's own assessment, or the assessment itself), so it can never duplicate a row."
  - "The fixture seeds before the other development fixtures that Jane owns. Her My Requests list sorts by updatedAt, newest first, at ten rows a page, which no submittedDate can influence."
  - "The fixture's request submission dates are boot-relative and later than every other development fixture's (plan-check amendment). The released request moves from D-20 to D-12, because D-20 on 2026-09-24 equals the latest existing fixture date."

patterns-established:
  - "Analyst insight route inventory: every served insight route is listed in analyst-insight-routes.unit.test.ts with its method, path, handler and operation, and no other router may declare its path or the insight operations."
  - "Seed mutation checks: the seed test loads the seed from the test build, so a mutant is applied to src, the tests are recompiled, run, and the source restored byte-exact and recompiled."

requirements-completed: [DASH-01, DASH-02]

duration: "about 60 minutes (13:54:47Z to about 14:55Z), including one full Strapi suite of 8 min 1 s"
completed: 2026-09-24
status: complete
actuals:
  tasks: 3
  commits: 8
---

# Phase 7 Plan 04: Derived Analyst Alerts, Their Contract and the Phase 7 Fixture Summary

**The human Security Analyst now reads every current alert of the eight derived kinds from `GET /api/v1/alerts`, most urgent first, and their counts by kind and urgency from `GET /api/v1/alerts/summary`. Both read one knex `UNION ALL` of per-kind branches, so every filtered total equals its summary count. The contract is published closed and parsed closed on the web, and a boot-relative fixture raises all eight kinds in any fresh or development database.**

This is plan 4 of 9 (D-35), wave 3. It delivers D-10, D-11, D-12, D-14, D-24, D-27, D-29 and D-31 on the server, D-08 and D-09 for the two alert operations, and the D-23 fixture that plans 05, 07, 08 and 09 read in the browser.

## Performance

- **Duration:** about 60 minutes, from 13:54:47Z to about 14:55Z. This includes one full Strapi suite (8 min 1 s), two full web suites, and 12 mounted or seed mutation runs (9 repository, 3 seed).
- **Started:** 2026-09-24T13:54:47Z
- **Completed:** 2026-09-24, at the docs commit that carries this summary
- **Tasks:** 3 of 3, each a RED commit followed by a GREEN commit, plus two refactor commits
- **Files:** 19 (13 created, 6 modified), plus this summary

## Accomplishments

- **Alerts derived on read (D-01, D-10, D-11, D-12).**
  - `alert-repository.ts` has one private branch per kind. Each selects the same 14 columns in one fixed order: kind, urgency and its rank, governing date, source type, documentId, identifier and title, control number and name, link type and documentId, residual rating, and a released flag.
  - The list wraps the selected kinds' branches in a `UNION ALL` derived table, applies the optional urgency, orders it by the six constant D-12 fragments, and pages it. The total counts the same derived table. The summary groups all eight branches by kind and urgency.
  - The controller reads the clock once, so the list, its total and every day offset share one `today`.
  - Governing dates follow the UI-SPEC §3.2 map: the Risk's `identifiedDate` for `critical-residual-risk-untreated` and the Control Implementation's `reviewDate` for `ineffective-control`.
- **Scope and exclusions (D-14, D-29, D-31, D-27).**
  - Risk and Control Implementation branches reuse the Risk Register's `applyDisclosableParent`, now exported with a structural parameter type that knex's builder satisfies.
  - Request branches read only `REVIEWABLE_REQUEST_STATUSES`.
  - Review alerts need the complete release triple.
  - A NULL treatment status is handled with `(treatment_status IS NULL OR ...)` for both the due-state kinds and the untreated Critical kind.
  - Both Control Implementation kinds need an open parent Risk.
  - `source.released` is true on released work.
- **Closed query.**
  - `kind` is one or more unique members of the closed set, returned in the closed order. Objects, duplicates, empty lists and unknown values are refused.
  - `urgency` is one closed value, `page` matches `/^[1-9]\d*$/` up to 1,000,000, and `pageSize` is one of 5, 10, 25 or 50.
  - Any other key is one safe 400, and the summary refuses every key.
- **Contract and client (D-08).**
  - Both operations are published under the `analyst-insights` tag, with the closed components and the `AnalystInsightBadRequest` and `AnalystInsightForbidden` responses.
  - `pageSize` declares `minimum: 5` for the parity guard, and no string carries a pattern.
  - The client is regenerated and `api:check` is clean.
  - The web parses both responses with strict Zod schemas. Their four vocabularies and the page sizes are checked against the generated unions in both directions at compile time.
  - `listAlerts` sends each kind as its own `kind` parameter and keeps a 403 as a 403. It reports a malformed body as a contract error, and both parsers are registered with the parity guard.
- **Denial (D-09).** The owner, the second Requestor, the service agent, the analyst-named identity without a role, the inactive analyst and a missing identity all get 403 on both operations, before any query is read. A missing token gets 401.
- **Phase 7 fixture (D-23).**
  - `seed-analyst-insights.ts` reconciles four requests, two assessments, five Risks, two Control Implementations on library Controls, and one Information System, each by its stable key. It is gated on the seed flag and the development identity, and serialised.
  - Every date is a declared whole-day offset from the run's today, rewritten on every run.
  - It raises all eight kinds on the seed's today and for three days after.

## Task Commits

1. **Task 1 RED: pin every derived alert, its order and its summary against controlled fixtures.** `3f08ca1` (test)
2. **Task 1 GREEN: derive analyst alerts on read and summarise them over the same predicate.** `10fb3b1` (feat)
3. **Task 2 RED: pin the published alert contract and its closed web parsers.** `b415dd9` (test)
4. **Task 2 GREEN: publish the alert operations and parse them with closed schemas.** `a92131a` (feat), with the spec and the regenerated `schema.d.ts` together
5. **Task 3 RED: pin the boot-relative analyst insight fixture.** `5f4b66b` (test)
6. **Task 3 GREEN: seed a boot-relative fixture that raises every analyst alert kind.** `b36aa48` (feat)
7. **Refactor: accept a constant kind list in the alert service.** `c276131` (refactor)
8. **Refactor: let alert repository callers leave the urgency out.** `20bc2b8` (refactor), type-only
   - `tsc` emitted a byte-identical `alert-repository.js`: sha256 `e3f7a9f0…` before and after.
   - Both compiles are clean.
   - The seed file and the two unit files pass 15 of 15.

**Plan metadata:** the `docs(07-04)` commit that carries this summary.

## Files Created/Modified

- **Strapi, alerts:**
  - `services/alert-query.ts` (the closed query parser);
  - `services/alert-repository.ts` (the branch builders, the list, total and summary, `projectAlertRow` and `summariseAlertCounts`);
  - `controllers/alerts.ts` (the plain-object `list` and `summary` handlers with a local `safeError`);
  - `routes/alerts.ts` (both routes, token-only, app-gated, with the insight scope);
  - all four in `apps/strapi/src/api/csrm-analyst-insight/`.
- **Strapi, shared:** `apps/strapi/src/api/csrm-risk/services/risk-register.ts` exports `applyDisclosableParent` and `DisclosableParentQuery`, with unchanged behaviour.
- **Strapi, fixture:** `apps/strapi/src/bootstrap/seed-analyst-insights.ts` (new) and `apps/strapi/src/index.ts` (the call, after `seedCsrmData`).
- **Contract:** `docs/references/specification.json` (two paths, 14 components, two responses) and `apps/web/src/lib/api/generated/schema.d.ts` (regenerated).
- **Web:** `apps/web/src/features/alerts/alert-schema.ts` and `alert-service.ts` (new); `contract-response-parity.test.ts` (import, inventory, pinned list).
- **Tests:**
  - `analyst-alert-query.unit.test.ts`: 7 tests.
  - `analyst-insight-routes.unit.test.ts`: 2 tests, the route inventory.
  - `analyst-alerts.integration.test.ts`: 7 mounted tests.
  - `analyst-insights-seed.integration.test.ts`: 6 tests.
  - `contract-catalogue.integration.test.ts`: 1 new block.
  - `alert-schema.test.ts` (5) and `alert-service.test.ts` (6).

## Phase 7 Fixture Reference

Plans 05, 07, 08 and 09 duplicate these values by value in `e2e/analyst-insights.spec.ts`. D(n) is the UTC date n days from the day the fixture last ran (the boot date). Date-times are written at `T00:00:00.000Z`. Every date not listed is written empty.

**Owner and analyst.** Every request is owned by Jane (`jane.doe@idambox.com`). Bob (`bob.doe@idambox.com`) generates, reviews and approves the assessments, owns and treats every Risk, and owns both Control Implementations.

**Requests** (none is `submitted`, so no spec can start generation on one):

| Stable key | Title | Status | Submitted | Due | Alerts |
| --- | --- | --- | --- | --- | --- |
| `RAR-E2E-P7-OVERDUE-001` | Phase 7 overdue review request | `under-review` | D-14 | D-10 | `request-overdue` |
| `RAR-E2E-P7-DUESOON-001` | Phase 7 due soon review request | `questionnaire-in-progress` | D-4 | D+5 | `request-due-soon` |
| `RAR-E2E-P7-MUTABLE-001` | Phase 7 analyst review request | `under-review` | D-9 | none | none |
| `RAR-E2E-P7-RELEASED-001` | Phase 7 released review request | `approved` | D-12 | none | none |

**Assessments:**

| Stable key | Request | Facts | Alerts |
| --- | --- | --- | --- |
| `ASM-E2E-P7-MUTABLE-001` | `RAR-E2E-P7-MUTABLE-001` | `in-review`, generated D-6, no approval facts, no next review | none |
| `ASM-E2E-P7-RELEASED-001` | `RAR-E2E-P7-RELEASED-001` | `approved`, generated D-8, assessment and approval D-5, approver Bob, next review D-3 | `assessment-review-due` (overdue, released) |

**Risks** (the inherent rating equals the residual rating; exactly five Risks):

| Stable key | Parent | Rating | Treatment | Dates | Information System | Alerts |
| --- | --- | --- | --- | --- | --- | --- |
| `RSK-E2E-P7-OVERDUE-001` | mutable | High | In Progress | target D-30 | Phase 7 exposure platform | `risk-treatment-overdue` |
| `RSK-E2E-P7-DUESOON-001` | mutable | Moderate | Not Started | target D+7 | none | `risk-treatment-due-soon` |
| `RSK-E2E-P7-CRITICAL-001` | mutable | Critical | Not Started | identified D-20, no target | Phase 7 exposure platform | `critical-residual-risk-untreated` |
| `RSK-E2E-P7-CLOSED-001` | mutable | High | Complete | target D-40, closure D-5 | none | none |
| `RSK-E2E-P7-RELEASED-001` | released | Critical | In Progress | target D-12 | none | `risk-treatment-overdue` (released) |

**Control Implementations** (keyed by Risk and Control; both link to their Risk):

| Risk | Control | Facts | Alerts |
| --- | --- | --- | --- |
| `RSK-E2E-P7-OVERDUE-001` | `E8-PATCH_OPERATING_SYSTEMS-001` | Planned, Not Assessed, implementation due D-10 | `control-implementation-overdue` |
| `RSK-E2E-P7-CRITICAL-001` | `E8-MULTI_FACTOR_AUTHENTICATION-001` | Implemented, Ineffective, reviewed D-15 | `ineffective-control` |

**Information System:** "Phase 7 exposure platform" (reconciled by name). The fixture never creates a Control.

**Window margins.** Due soon holds while the date is between today and today+14. D+5 and D+7 stay due soon for five and seven more days. Every overdue date only grows more overdue, so a suite that crosses UTC midnight cannot move a record into another category. The seed test checks every kind on the seed's today and on each of the next three days.

## Verification

**RED, per task:**

| Check | Result |
| --- | --- |
| Task 1: `tsc -p tests/tsconfig.json` | exit 1: TS2307 for `csrm-analyst-insight/services/alert-query` and `routes/alerts`, plus TS18046 knock-ons |
| Task 1: `analyst-alerts.integration`, emitted with `--noEmitOnError false` | 0 passed, 7 failed: every read 404 `NotFoundError` (no route), and the denial test got 404 instead of 403 |
| Task 2: web (`vitest run alert-schema alert-service contract-response-parity`) | 3 files failed: "Failed to resolve import" for `./alerts/alert-service`, `./alert-schema`, `./alert-service` |
| Task 2: `contract-catalogue.integration` | 13 passed, 1 failed: `UNEXPECTED_MISSING_GET_/v1/alerts` |
| Task 2: `analyst-alerts.integration` with the spec pinning | 2 passed, 5 failed: `ALERT_SPEC_COMPONENT_MISSING_AlertListResponse` and `..._AlertSummaryResponse` |
| Task 3: `tsc -p tests/tsconfig.json` | exit 1: TS2307 for `src/bootstrap/seed-analyst-insights`, plus TS18046 and TS2731 knock-ons |

**GREEN, per task:**

| Check | Result |
| --- | --- |
| Task 1: root `tsc`, tests `tsc` | both exit 0 |
| Task 1: `analyst-alert-query.unit` + `analyst-insight-routes.unit` | 9 passed, 0 failed |
| Task 1: `analyst-alerts.integration` | 7 passed, 0 failed |
| Task 1: `risk-register.unit` (after the export) | 15 passed, 0 failed |
| Task 2: web targeted (`alert-schema`, `alert-service`, `contract-response-parity`) | 69 passed across 3 files; the guard ran `alerts.listAlerts` and `alerts.getAlertSummary` against the minimal, maximal and nullable instances |
| Task 2: web typecheck | exit 0 |
| Task 2: `contract-catalogue.integration`, `analyst-alerts.integration` | 14 of 14, 7 of 7 |
| Task 2: `api:check` after the commit | exit 0 |
| Task 3: `analyst-insights-seed.integration` | 6 passed, 0 failed |
| Refactor: web targeted and typecheck | 69 passed; exit 0 |

**Acceptance checks:**

| Check | Result |
| --- | --- |
| `alert-repository.ts`: `unionAll` / `treatment_status IS NULL OR` / `json_extract` | 1 / 3 / 0 |
| `orderByRaw` in `alert-repository.ts` | one call, `for (const fragment of ALERT_LIST_ORDER) query.orderByRaw(fragment)`, over frozen constants |
| `risk-register.ts` contains `export function applyDisclosableParent` | yes |
| `routes/alerts.ts` contains `requireAnalystInsightScope` | yes |
| `specification.json` contains `"/v1/alerts"`, `"/v1/alerts/summary"`, `"AlertListResponse"`, `"AnalystInsightForbidden"` | yes |
| `contract-response-parity.test.ts` contains `features/alerts/alert-service.ts` | yes |
| `src/index.ts` contains `seedAnalystInsights` | yes |
| `seed-analyst-insights.ts` contains `developmentIdentityEnabled` and `RSK-E2E-P7-OVERDUE-001` | yes (7 matches together) |

**Mounted mutants** (`analyst-alerts.integration`). Each was applied to `alert-repository.ts`, run through the harness (which recompiles `dist`), and restored. The sha256 was `8b8439b2…` before and after every one.

| Mutant | Killed by |
| --- | --- |
| overdue predicate as a bare `treatment_status <> 'Complete'` (the plan's `fails_when`) | `ALERT_LIST_PAGINATION`, `ORACLE_DISAGREES_R5`, `ALERT_SUMMARY`, `SECOND_PAGE_PAGINATION` |
| Control Implementation branches without the open-parent predicate (`fails_when`) | `ORACLE_DISAGREES_CI2`, the literal list, the summary and the tie test |
| summary evaluated on a different day from the list (`fails_when`) | `ALERT_SUMMARY`, `TIED_SUMMARY_COUNT` |
| documentId order fragment removed | `TIED_ALERTS_NOT_ORDERED_BY_DOCUMENT_ID` |
| undated-last fragment removed | `ALERT_LIST_ORDER`, `PAGES_DO_NOT_TILE_THE_LIST`, `ALERT_ORDER_DISAGREES_WITH_ORACLE_AFTER_TIES` |
| review branch without the approver link | `ORACLE_DISAGREES_AP` and the literal list |
| Risk branches without `applyDisclosableParent` | `ORACLE_DISAGREES_RP` and the literal list |
| request branches without the reviewable status set | `ORACLE_DISAGREES_Q5` and the literal list |
| released flag always 0 | `ALERT_ITEM_1_risk-treatment-overdue_RR1` |

**Seed mutants.** The seed test loads the seed from the test build, so each mutant was applied to the source, the tests recompiled and run, and the source restored and recompiled. The sha256 was `2c3d0c1e…` before and after.

| Mutant | Killed by |
| --- | --- |
| identity gate dropped | `GATED_SEED_CREATED_REQUESTS` |
| mutable assessment not linked to its request | `RELATION_MISSING`, and the Risk detail test |
| review date fixed instead of re-anchored | `DATE_NOT_MOVED_TEN_DAYS_ASM-E2E-P7-RELEASED-001.nextReviewDate` |

**Compile-time mutants (web).**
- Dropping `ineffective-control` from `alertKinds` fails the typecheck with TS1360 ("Type 'true' does not satisfy the expected type 'false'") and TS2353 on the count shape.
- Removing `.readonly()` fails the const-tuple call with TS4104.
- Both files were restored with identical hashes.

**Plan gate.** The suites ran on tree `c276131`. The only later code commit, `20bc2b8`, is type-only: the emitted JavaScript is byte-identical, both compiles are clean, and its three affected files pass 15 of 15.

| Check | Result |
| --- | --- |
| `pnpm --filter @csrm/strapi test` (full, serial) | 321 passed, 0 failed, 0 cancelled, 0 skipped, exit 0 (14:44:22Z to 14:52:32Z, 8 min 1 s). This is 298 at the 07-02 gate plus 23 new: 7 query unit, 2 route inventory, 7 mounted alert, 1 catalogue block and 6 seed tests. |
| `pnpm --filter @csrm/web test` (full) | 465 passed across 53 files, exit 0. This is 452 across 51 at the 07-02 gate, plus 13 new (5 schema, 6 service, 2 parity entries). |
| `pnpm --filter @csrm/web typecheck` | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0 |
| `git diff --name-only 1c5139a HEAD -- 'apps/strapi/src/api/*/content-types'` | empty |
| `cmp` of the two catalogue copies | identical; neither changed in this plan |
| Deleted files across the plan | none |
| Commit messages and added lines scanned for attribution trailers and tool or assistant names | none |

The web suite, typecheck and `api:check` ran while the Strapi suite was running. None of them reads `apps/strapi/dist`.

## Orchestrator Amendments Applied

- **Served-shape pinning (plan check issue 1).**
  - `analyst-alerts.integration.test.ts` compares every served level with its published component through `specKeys`:
    - the list envelope (`AlertListResponse`), `meta` (`AlertListMeta`) and `pagination` (`AlertPagination`);
    - every item (`AlertItem`) with its `source` (`AlertSource`) and `link` (`AlertLink`);
    - the summary envelope, `data` (`AlertSummary`), `byKind` and `byUrgency`.
  - It also checks every served enumerated value against its published enumeration: kind, urgency, source type, link type, residual rating and page size.
  - Every list read in the file, including the filtered and paged ones, goes through this check.
  - Task 1 pinned the literal key sets. The spec comparisons were added in Task 2's RED, because the components did not exist before Task 2 (deviation 1).
- **Route inventory (plan check issue 10).**
  - `apps/strapi/tests/analyst-insight-routes.unit.test.ts` is the static Phase 7 inventory. It is a unit test, so it runs without booting Strapi. Each served insight route is inventoried with its method, path, handler and operation. The test asserts:
    - each route is mounted exactly once;
    - token-only auth;
    - `global::csrm-app-enabled` first;
    - exactly `{ operation, requireAnalystInsightScope: true }` and no other flag;
    - that each operation names its route.
  - A source scan of every `src/api/*/routes/*.ts` asserts:
    - no other router declares an insight path or uses `CSRM_ANALYST_INSIGHT_OPERATIONS`;
    - no router mounts a D-06 path (`/v1/alerts/:…`, `/v1/dashboard/alerts`, `/v1/dashboard/reports`, `/acknowledge`, `/export`).
  - Plans 06 and 08 add their routers to `INSIGHT_ROUTERS` and their operations to `SERVED_INSIGHT_ROUTES`.
- **Seed fixture relations (plan check issue 6).**
  - `ASM-E2E-P7-MUTABLE-001` is linked to `RAR-E2E-P7-MUTABLE-001`, and `ASM-E2E-P7-RELEASED-001` to `RAR-E2E-P7-RELEASED-001`.
  - The seed test asserts both links.
  - It also asserts that `getRiskRegisterDetail` resolves for `RSK-E2E-P7-OVERDUE-001` (parent lock `mutable`, title "Phase 7 analyst review request") and `RSK-E2E-P7-RELEASED-001` (`released`, "Phase 7 released review request").
- **Later submission dates, without displacing existing rows (plan check issue 6).**
  - Every fixture request is submitted later than every other development fixture's request. The seed test runs the questionnaire, assessment, navigation and Risk Register seeds and asserts this.
  - That required moving the released request from D-20 to D-12 (deviation 2).
  - The stated purpose, not displacing rows existing specs read, is met by the seed order in Jane's lists. `submittedDate` cannot reach it, as deviation 3 explains.

## Decisions Made

- **One ordering definition.** `ALERT_LIST_ORDER` restates `compareAlerts` rule for rule. The mounted test:
  - asserts the literal 14-id order;
  - asserts `served === [...served].sort(compareAlerts)` on the full list, and again after ties are added;
  - proves the documentId rule with Control Implementation ties created until their creation order differs from their documentId order, so an order that fell back to insertion order would be caught.
- **Typed union columns.** Literals are `CAST(? AS TEXT)` or `CAST(? AS INTEGER)`, absent columns are `CAST(NULL AS TEXT)`, and identifiers and aliases are bound with `??`. The union lines up without relying on SQLite's dynamic typing, and no SQL text is concatenated from a value. PostgreSQL remains unverified (research A2).
- **The released flag.** It is a correlated `EXISTS` over the release triple of the assessment the work belongs to, rather than a join, so a flag can never multiply rows.
  - For a request, that is its own assessment. This is unreachable in practice: a release approves the request, which takes it out of the reviewable statuses.
  - For a review alert, the triple is also the branch predicate, so the flag is always 1.
- **The Control Implementation title** is built in `projectAlertRow` as `"{controlNumber} {controlName}"`, and is null if either is missing. The identifier is the parent Risk number, and the link is the parent Risk.
- **Defence in depth.**
  - The repository re-checks the kinds, the urgency, the page (at most 1,000,000), the page size (at most 50) and `today`, whatever the caller.
  - `projectAlertRow` fails closed on any value outside the closed sets, a malformed date or a released flag that is not 0 or 1. The controller lets that through as a generic 500.
- **The summary** always carries all eight kinds and all three urgencies, with zero where nothing alerts. Its `total` is the sum of the grouped rows.
- **Web error mapping.** The web maps a parse failure to `normalizeResponseParserError(operation)`, as `assessment-service.ts` does, so development shows a contract-mismatch diagnostic and production shows the generic copy. A refusal keeps its status.
- **URL schema.** `alertListUrlQuerySchema` reads one kind at a time. An unknown kind or urgency reads as all, and a page size other than 10, 25 or 50 reads as 25, as the Risk Register's URL schema does.
- **Fixture facts.**
  - The fixture rewrites all of its facts on every run, not only its dates: statuses, relations and cleared revert and approval facts. All eight kinds then hold again after any edit on the development database.
  - Only CRITICAL carries an `identifiedDate`, as the plan fixes. Every other undeclared date is written empty, so the offsets map is the complete list of fixture dates.
  - The released assessment's `assessmentDate` equals its approval day, following the Risk Register seed's released precedent.
- **`requirements-completed`** lists DASH-01 and DASH-02, copied from the plan. Both complete only with the phase. `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, as instructed.

## Deviations from Plan

1. **[Amendment] Spec-pinned shapes were added to `analyst-alerts.integration.test.ts` in Task 2.**
   - The components are published in Task 2, so Task 1 could pin only the literal key sets.
   - Task 2's RED added the `specKeys` and enumeration checks. It failed on the missing components, and passed once they were published.
   - The file is not in Task 2's file list.
   - **Commits:** `b415dd9`, `a92131a`.
2. **[Amendment] Released request submitted at D-12, not D-20.**
   - On 2026-09-24, D-20 is 2026-09-04, the same date as `RAR-E2E-NAV-ANALYST-001`, the latest existing fixture. That is not later than every existing fixture.
   - D-12 is later, and still precedes the released assessment's generation (D-8) and approval (D-5).
   - The other three submission offsets are the plan's.
   - **Commits:** `5f4b66b`, `b36aa48`.
3. **[Amendment purpose] The fixture seeds before the other development fixtures, not "immediately after `seedRiskRegisterWorkflow`".**
   - **What the lists sort by:**
     - The amendment's premise is that later submission dates keep the fixture from sorting first. That holds only for an ascending order.
     - The browser's analyst queue sends `sort=submittedDate:desc` by default (`assessment-service.ts`). Later dates therefore put the fixture's three reviewable requests at the top of that queue. This is harmless at today's volume, about 8 "Requires my attention" rows against 25 per page. `assessment-release-workflow.spec.ts` finds its two seeded rows on page 1 either way.
     - Jane's My Requests list sorts by `updatedAt:desc` at 10 rows per page (`request-schema.ts`), which no submission date affects.
   - **The displacement risk:** seeded last, the fixture's four requests would be Jane's newest.
     - `questionnaire-governance-workflow.spec.ts` opens "Customer portal questionnaire awaiting release request" from page 1 of that list.
     - By my reading of the specs that run before it (two requests of hers updated by earlier specs, the two navigation fixtures, and the fixture's four), that row would sit at about position 9 of 10.
     - `request-relationship-states.spec.ts` opens "Customer portal questionnaire draft request" from the same page 1, and also opens every row on that page. The fixture's rows satisfy its per-row invariant (no unlinked assessment number) in the same way as the navigation fixtures.
   - **The fix:** seeded right after `seedCsrmData`, the fixture's rows are Jane's least recently updated, in a fresh E2E database and in the development database. Every other seed that owns a Jane request updates it on each boot afterwards.
   - **Proof:**
     - The seed test runs the seeds in bootstrap order and asserts that none of Jane's other seeded requests was updated before a fixture request.
     - It statically pins the call order in `src/index.ts`.
   - **Verification status:** the position estimate is from reading the specs. No browser run was in scope.
   - **Commit:** `b36aa48`.
4. **[Additional proof] Beyond the behaviour lists.**
   - **Mounted test:**
     - AP carries an overdue review date, so the release-triple exclusion is proved on the review branch as well as on Risks;
     - filtered lists equal the full list filtered, not only their totals;
     - kind and urgency combinations, including an impossible pair;
     - the default page size;
     - denial precedes query validation;
     - a missing token is 401;
     - error bodies carry no fixture data;
     - a UTC rollover fails with `UTC_DAY_ROLLED_OVER_DURING_TEST`.
   - **Unit test:** 27 refused query forms, the accepted page sizes, and the page bound.
   - **Seed test:**
     - every kind holds for three days after the seed's today;
     - the closed Risk and the requests without due dates stay silent;
     - the released Risk carries the released flag;
     - every written date equals its declared offset and nothing undeclared is written;
     - concurrent runs create nothing twice.
5. **[Plan detail] Exports beyond the artifact lists.**
   - **Strapi:** `ALERT_SOURCE_TYPES`, `ALERT_LINK_TYPES`, `AlertItem`, `AlertCountRow`, `AlertCounts`, `AlertPageInput`, `AlertRepository`, `AlertRepositoryError`, `summariseAlertCounts`, `AlertListQuery`, `AlertPageSize`, `DisclosableParentQuery`, `ANALYST_INSIGHTS_DAY_OFFSETS` and `SeedAnalystInsightsOptions`.
   - **Web:** `alertItemSchema`, `alertPageSizes`, `alertListQuerySchema`, `AlertListQuery`, `AlertListUrlQuery`, `AlertPageSize`, `parseAlertListPayload` and `parseAlertSummaryPayload`.
   - The catalogue test pins the Strapi source and link vocabularies against the published enums.
6. **[Plan detail] Contract details.**
   - Operation and component descriptions are added.
   - `AlertPagination.page` declares `maximum: 1000000`, so the published bound matches the query parameter and the web parser.
   - The catalogue test pins everything except free text.
7. **[Refactor] `listAlerts` accepts a readonly kind list** (`.readonly()` in `alertListQuerySchema`), so plan 08 can pass a constant tuple. A service test would not compile without it (TS4104). **Commit:** `c276131`.
8. **[Refactor] `listPage` and `count` accept an omitted urgency.**
   - Plans 06 and 08 call them as `listPage({ kinds, page, pageSize, today })` and `count({ kinds, today })`. The first cut typed `urgency` as a required key.
   - The change is type-only, with byte-identical emitted JavaScript.
   - **Commit:** `20bc2b8`.
9. **STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.** The orchestrator owns them, so the executor's state-update steps were skipped.

**Total deviations:** 9. Items 1 to 3 apply the binding amendments. Item 3 adds a one-line order change, because the amendment's stated mechanism cannot reach Jane's list. Items 4 to 6 add proof or exports without changing planned behaviour. Items 7 and 8 are small type-only improvements for the next plans' callers, and item 9 follows the orchestrator's instruction.

## Issues Encountered

- **The plan's web verify command runs the whole suite.** `pnpm --filter @csrm/web test -- a b c` passes a literal `--` to vitest, as 07-02 recorded. Targeted runs used `pnpm --filter @csrm/web exec vitest run <patterns>`.
- **Line endings.** New files were written with LF, and git warns they become CRLF in the working copy (`core.autocrlf=true`). Edited CRLF files kept their endings. `api:check` shows no content diff.
- **pnpm engine warning.** pnpm prints "Unsupported engine ... current: v22.19.0" even with the Node 24 PATH prefix. `node` resolved to v24.19.0 for every run.

## Deferred Issues

- **PostgreSQL ordering and typing (research A2).** On PostgreSQL, the kind, identifier and documentId tie rules would follow the database collation rather than code units. The typed CASTs and bound identifiers are portable by construction but unverified, because `pg` is not installed. This joins the Phase 8 notes that 07-03 recorded for plan 09.
- **Items recorded by 07-01, 07-02 and 07-03 are unchanged:**
  - `authorization.policy.test.js` never runs.
  - `verify-phase-06-integrity.mjs` has stale counts.
  - The parity guard's register entry is vacuous.
  - Error envelopes carry an undeclared `data: null`. The alert 400 and 403 bodies are Strapi's standard envelope too.

## Known Stubs

None. Both operations are served, published, parsed and registered. The fixture is wired into bootstrap. Plan 05 renders the alerts.

## Threat Flags

None beyond the plan's threat model.
- **T-07-04-01:** the grant, the human-only guard, `requireAnalystInsightScope` and `assertAnalystInsightScope`. The mounted matrix covers six identities on both routes.
- **T-07-04-02:** the disclosable-parent reuse, the reviewable statuses and the release triple. RP, AP, Q5 to Q7 and CI2 are excluded, and a mutant is killed for each rule.
- **T-07-04-03:** closed parsing with arrays checked member by member and objects refused. Branches come from a closed map, the order is constant fragments, and every value and identifier is bound.
- **T-07-04-04:** page size at most 50, page at most 1,000,000, and counts computed in SQL.
- **T-07-04-05:** both gates are proved by the seed test and a killed mutant.
- **T-07-04-06:** safe messages, asserted free of `SQL`, `stack`, `database` and fixture data.

## Next Phase Readiness

- **Plan 05 (Alerts screen):**
  - Use `listAlerts` and `getAlertSummary`, and parse the URL with `alertListUrlQuerySchema`.
  - Every value the screen renders is on the DTO: the sentence inputs `kind` and `dayOffset`, the date label from `kind`, `source.identifier`, `source.title`, `source.released`, `link`, and `residualRating`.
  - The fixture's released rows are `RSK-E2E-P7-RELEASED-001` (treatment overdue) and `ASM-E2E-P7-RELEASED-001` (review overdue).
- **Plan 06 (reports):**
  - Import `applyDisclosableParent`. Extend `analyst-insight-routes.unit.test.ts` with the report router and the two report operations.
  - `createAlertRepository(strapi).listPage({ kinds: ["risk-treatment-overdue"], page: 1, pageSize: 5, today })` and `count({ kinds, today })` take no urgency. Their rows are projected with `projectAlertRow(row, today)`.
  - The throughput fixture pair is `RAR-E2E-P7-RELEASED-001` (submitted D-12) and `ASM-E2E-P7-RELEASED-001` (approved D-5).
- **Plan 08 (dashboard):**
  - Call `createAlertRepository(strapi)` with `listPage` / `countByKindAndUrgency` and `projectAlertRow`, or read through the two operations.
  - `listAlerts` accepts a constant tuple of kinds, for example both treatment kinds.
  - Extend the route inventory with the dashboard route.
- **Orchestrator:**
  - The dev Strapi restart mounts both routes and seeds the fixture once, after `seedCsrmData`.
  - Browser checks:
    - As Bob, `GET /api/v1/alerts` and `/summary` return 200.
    - The development database lists at least one alert of each kind, with the fixture's sources.
    - As Jane, My Requests still shows her other seeded requests above the four "Phase 7 …" requests.

## TDD Gate Compliance

Each task has a `test(07-04)` RED commit followed by its `feat(07-04)` GREEN commit: `3f08ca1` then `10fb3b1`, `b415dd9` then `a92131a`, and `5f4b66b` then `b36aa48`. The REFACTOR steps are `c276131` and `20bc2b8`.

## Self-Check: PASSED

- The 13 created files exist and are tracked at HEAD.
- Commits `3f08ca1`, `10fb3b1`, `b415dd9`, `a92131a`, `5f4b66b`, `b36aa48`, `c276131` and `20bc2b8` exist on `dev`.
- No tracked file was deleted between `1c5139a` and HEAD.
- `git status` showed only the pre-existing untracked `.planning/debug/` and this summary before the docs commit.
