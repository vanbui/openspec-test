# Phase 7: Analyst Dashboard, Reports, and Alerts - Research

> **Superseded instruction (2026-09-26).** Every instruction in this document to restore `apps/web/next-env.d.ts` and `apps/web/tsconfig.json` with `git checkout --` after a Playwright run no longer applies. Phase 8 D-12 untracked `next-env.d.ts` (a checkout of it now fails with `pathspec did not match`) and stopped a run from rewriting `tsconfig.json`, so a run leaves the tree clean. A dirty tree after a run is a harness defect to fix at its source, never something to restore.

**Researched:** 2026-09-24
**Domain:** Server-derived analytics over a frozen Strapi 5.51 datamodel (knex on SQLite), plus Next.js 16.3 App Router analyst screens
**Confidence:** HIGH for the codebase patterns and SQL shapes. Each shape was prototyped read-only against `apps/strapi/.tmp/data.db` with knex 3.0.1 and SQLite 3.51.3. MEDIUM for PostgreSQL portability, because no `pg` driver is installed, and for seed-reconciliation keying.

<user_constraints>
## User Constraints (from 07-CONTEXT.md, verbatim)

### Locked Decisions

#### Derivation and data (no new entities)

- **D-01:** The JDL has no Alert, Notification, Report, Activity or Audit entity (catalogue design note 5). Every dashboard figure, alert, report row and activity item is **computed on read** by Strapi from existing fields: request `dueDate`, `submittedDate`, `requestStatus`, revert facts; questionnaire `generatedDate`, `releasedAt`/`releasedBy`, `governanceLog` events; assessment `assessmentStatus`, `generatedDate`, `approvalDate`/`approvedBy`, `nextReviewDate`; Risk `inherentRating`, `residualRating`, `treatmentStatus`, `treatmentAction`, `targetDate`, `closureDate`; ControlImplementation `controlStatus`, `effectivenessRating`, `implementationDueDate`. No content-type schema changes. If a genuinely required fact is missing, stop and record it under `docs/contract-gaps/` instead of inventing a field.
- **D-02:** Derivation rules live in pure, unit-tested Strapi domain modules (no Strapi calls inside them) that take an explicit `today` (UTC calendar date) so every rule is deterministic under test. Controllers and repositories only load bounded inputs and project closed DTOs. The web layer never derives a metric from raw records.
- **D-03:** Aggregates use database-level counts and group-bys (the Risk Register's knex repository is the precedent) or bounded, ordered queries. No handler loads an unbounded collection into memory. Where a list is capped, the cap is a named constant and the response says the list is truncated rather than presenting a partial count as a total.
- **D-04:** Treatment due-state is derived, never read from the stored `treatmentStatus = "Overdue"` value (nothing on the server sets it): a Risk is **overdue** when `targetDate < today`, `treatmentStatus ≠ Complete` and `closureDate` is empty; **due soon** when `targetDate` falls within a named window (default 14 days) under the same conditions. The web's existing overdue flag (`apps/web/src/features/risks/risk-schema.ts:335-338`) must agree with the server rule; one definition, cited by both.

#### Endpoints, grants and contract

- **D-05:** Serve exactly these catalogue-reserved operations, all read-only, all human Security Analyst only: `GET /api/v1/dashboard/summary`, `GET /api/v1/alerts`, `GET /api/v1/alerts/summary`, `GET /api/v1/reports`, `GET /api/v1/reports/{reportKey}`. Plus one Requestor-birthright operation, `GET /api/v1/my_assessment_requests/status_summary` (owner-scoped counts by `requestStatus`), mirroring `GET /api/v1/my_questionnaires/status_summary`.
- **D-06:** Do **not** serve `GET /api/v1/dashboard/reports`, `GET /api/v1/dashboard/alerts`, `GET /api/v1/alerts/{alertId}`, `PATCH /api/v1/alerts/{alertId}/acknowledge`, or `POST /api/v1/reports/{reportKey}/export`. They stay catalogued and unserved, with the reason recorded in the catalogue design notes and the phase summary: dashboard reports and alerts are redundant with the dedicated operations; derived alerts link straight to their source record, so an alert detail read adds nothing; acknowledgement needs persisted per-analyst state (a datamodel change, deferred); export is deferred beyond this milestone.
- **D-07:** Grants follow the Phase 06.8-01 precedent exactly (`b4f3d88`): one API-only Function per served analyst FunctionAPI, `roleIds: ["role.security_analyst"]`, no `menuPath`, no Requestor and no `role.security_analyst_agent` grant, re-pointing the existing reserved FunctionAPI entries to those Functions. The menu Functions (`Dashboard:Dashboard`, `Reports:Reports`, `Reports:Alerts`) remain as UI functions but carry no served analyst API. The operations are added to the human-analyst-only enforcement in `apps/strapi/src/policies/csrm-authorization.ts` so the service agent is refused even if a grant were misconfigured. The docs and bootstrap catalogue copies stay byte-identical, and the contract-catalogue integration test covers every new operation.
- **D-08:** Each operation is published in `docs/references/specification.json` with closed schemas (`additionalProperties: false`, closed enums, bounded arrays), the web client regenerated (`api:generate`, `api:check` clean), responses parsed by closed Zod schemas, and every new service module registered with the contract-to-client parity guard (`apps/web/src/features/contract-response-parity.test.ts`). Server shape and client parser change in the same plan.
- **D-09:** Denial is proven at the Strapi layer for the Requestor, the Secondary Requestor and the service agent on every analyst operation, and owner-scoping is proven for the Requestor status summary (a second Requestor's records never count).

#### Alerts

- **D-10:** Alerts are stateless, derived conditions with a deterministic id (`<kind>:<sourceDocumentId>`), a closed `kind` vocabulary, a source-record reference (type, documentId, identifier, title) that the UI turns into an actor-correct RecordLink, the governing date, and an urgency. The closed set covers the four families the catalogue names — overdue work, high residual risk, ineffective controls, upcoming treatment or review dates:
  - `risk-treatment-overdue` and `risk-treatment-due-soon` (D-04);
  - `request-overdue` and `request-due-soon` (request `dueDate`, request not `approved` or `closed`);
  - `control-implementation-overdue` (`implementationDueDate < today`, `controlStatus = Planned`);
  - `assessment-review-due` (approved assessment whose `nextReviewDate` is past or within the window);
  - `critical-residual-risk-untreated` (`residualRating = Critical`, `treatmentStatus = Not Started`, not closed);
  - `ineffective-control` (ControlImplementation `effectivenessRating = Ineffective` on an open Risk).
  The planner may merge or drop a kind only with a written reason; it may not add persisted state.
- **D-11:** Alert urgency is a closed three-value vocabulary — `overdue`, `due-soon`, `attention` — presented with the existing status tokens (danger, warning, info) plus icon and text. Where the source is a Risk, the Risk's residual rating is shown beside it with the existing risk badge; urgency and severity are never conflated.
- **D-12:** `GET /api/v1/alerts` is paginated (page size capped, existing pagination envelope), filterable by `kind` and `urgency`, and sorted by urgency then governing date. `GET /api/v1/alerts/summary` returns counts by kind and by urgency computed over the same predicate, so the list total and the summary always agree.

#### Reports

- **D-13:** A closed set of report keys, each a server-computed, read-only projection with no caller-supplied grouping beyond closed enums:
  - `risk-exposure` — contextual Risks by residual rating and by inherent rating, crossed with treatment status; the Information Systems carrying the most High and Critical residual Risks (bounded list).
  - `treatment-performance` — treatments by due state (overdue, due within 30 days, later, no target date) and by treatment status; the most overdue Risks (bounded list, oldest first).
  - `assessment-throughput` — requests by lifecycle state; assessments released per calendar month over a closed period choice (6 or 12 months); median days from request submission to release where both facts exist.
  - `control-effectiveness` — ControlImplementations by `controlStatus` and by `effectivenessRating`.
  `GET /api/v1/reports` lists these definitions (key, title, description) so the Reports index is data-driven.
- **D-14:** Report and dashboard figures scope to exactly what the human analyst's existing grants can read (the Risk Register and review scopes); a report never widens scope.

#### Web surfaces

- **D-15:** Routes: the analyst dashboard at `/app/review` (the parent of the existing analyst review queues), Alerts at `/app/alerts`, Reports at `/app/reports` with each report at `/app/reports/[reportKey]`. `/app` stays the owner-scoped personal dashboard for every actor, unchanged in role; seven E2E specs and the 06.3 separation of owner and analyst scopes depend on it.
- **D-16:** Navigation and page presentation are gated by the existing `assessment:review` capability (presentation only — Strapi stays authoritative). No new capability is introduced; a Requestor reaching a route directly sees the shared permission-denied state and issues no analyst reads.
- **D-17:** Every new surface honours the five-state contract (loading skeletons, empty, populated, error with "Try again", permission denied) through the shared state primitives, works from 375px to 1440px, is axe-clean at both widths, and meets WCAG 2.2 AA.
- **D-18:** KPI tiles follow the design direction (§4 "Cards / KPI tiles": micro caption, display-size tabular value, optional delta). A delta appears only when the server supplies an honest comparison period; none is fabricated. Each tile that summarises a list links to that list, pre-filtered where a filter exists (for example the review queue bucket, the Risk Register residual-rating filter, the Alerts urgency filter).
- **D-19:** Charts follow ADR 0001 gap 3 and design direction §3.14: ink ramp (`--chart-1`, `--chart-2`, `--chart-grid`) with direct labels, severity charts in the §3.6 risk tokens, more than two series separated by pattern or dash plus labels, never a new hue. Meaning never depends on colour: every chart has a text equivalent (a data table or labelled values) available to assistive technology and visible on demand. **No charting dependency**: a small accessible bar primitive in `apps/web/src/components/csrm/` (HTML or SVG) covers the needed bar and column charts; add a library only if a plan proves a concrete need.
- **D-20:** Reuse before creating: the Requestor dashboard widget structure (`features/dashboard/requestor-dashboard.tsx`), `DataTable`, `RecordLink`, `StatusBadge`, `RiskRatingBadge`, `PageHeader`, and the state primitives. Any new shared primitive (KPI tile, bar chart) goes in `components/csrm` with its own tests and is consumed by at least the dashboard and one report.

#### Carried-forward follow-ups (same surfaces)

- **D-21:** Review-queue buckets: remove the 1,000-row scan bound in `csrm-assessment-request/controllers/csrm-assessment-request.ts:57-108`. Express each bucket as a database-level predicate over `requestStatus` and the derived lifecycle facts, applying the in-memory generation-job registry as a bounded id-set predicate, so the page, the total and the dashboard's bucket counts come from one shared bucket definition and stay exact at any volume.
- **D-22:** The Requestor dashboard replaces its seven per-status `listDashboardRequests` reads (`requestor-dashboard-service.ts:163-172`) with one read of `GET /api/v1/my_assessment_requests/status_summary`. Behaviour and copy of the lifecycle cards are unchanged.

#### Testing and fixtures

- **D-23:** A dedicated Phase 7 seed fixture (gated on `IDAMBOX_SEED_CSRM` plus the established development identity flags) creates records whose dates are relative to the boot date, so overdue, due-soon and review-due conditions exist deterministically in a fresh E2E database. It never reuses a fixture another spec mutates.
- **D-24:** Strapi integration tests assert exact derived values over controlled fixtures, including window boundaries (due today, due in exactly N days, overdue by one day), closed/complete exclusions, and scope. Browser tests never assert global totals, because other specs create records during a run; they assert fixture membership, consistency between a tile and the list it links to, actor-correct links, and denial.
- **D-25:** A dual-actor E2E journey covers: analyst dashboard → alert → source record; each report renders with its text equivalent; Requestor and Secondary Requestor see no analyst navigation and get the permission-denied state on direct URLs. The accessibility spec gains every new surface at 375px and 1440px. Sign-in helpers assert the shell (Dashboard heading and role banner), never the URL.

### the agent's Discretion

- Exact DTO field names, module decomposition, report row caps, and named thresholds (keep them named constants with tests).
- Whether the dashboard composes `dashboard/summary` with a bounded `alerts` read, or `dashboard/summary` embeds the top alerts — either is fine if the counts share one predicate.
- Tile order and widget layout, within the UI-SPEC.

### Deferred Ideas (OUT OF SCOPE)

- Persisted alerts and per-analyst acknowledgement — needs a datamodel extension and a `docs/contract-gaps/` record; not this milestone.
- Report export (`POST /api/v1/reports/{reportKey}/export`) — deferred beyond this milestone.
- Notifications for workflow events and due dates — NOTIFY-01 (v2).
- A Requestor-facing alerts view — the catalogue grants alerts to analysts only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | A Security Analyst dashboard presents data-driven review queues, high/critical risks, overdue treatments, due dates, recent activity, and alerts. | D-21 bucket predicates (Q3), Risk Register–scoped counts and due-state (Q2, Q4), UNION ALL alert list (Q4), recent activity through bounded Document Service reads (Q5), `/app/review` page (Q6) |
| DASH-02 | A Security Analyst can view reports and alerts through authorised, responsive screens. | Exact grants plus the human-analyst guard (Q1), four report query shapes (Q2), `/app/alerts`, `/app/reports`, `/app/reports/[reportKey]` (Q6), an accessible HTML bar primitive (Q8), dual-actor E2E (Q7) |
</phase_requirements>

## Summary

Everything Phase 7 needs is already in the frozen datamodel, and the repository already has a working precedent for each piece. The Risk Register repository (`csrm-risk/services/risk-register.ts:295-423`) shows how to count and page at the database level through `strapi.db.connection` (knex). Commit `b4f3d88` and `csrm-authorization.ts:23-30,236-241` show how to add a human-analyst-only guard to exact FunctionAPI grants. The 06.9 seed shows how to reconcile a dedicated fixture by stable key. The contract-parity guard and the typed openapi-fetch layer show how to publish a closed response and parse it with Zod. All six content types this phase aggregates have `draftAndPublish: false` and no i18n, so there is exactly one row per document. Counting rows counts documents, and nothing double-counts (verified in the dev database).

Two facts discovered here shape the plans. **First, datetime columns are stored in SQLite as INTEGER epoch milliseconds, while date columns are TEXT `YYYY-MM-DD`.** A raw knex comparison against an ISO string is silently wrong: `approval_date >= '2026-09-01T…'` returned 0 rows, while a JS `Date` binding returned the correct 1. Raw reads also return epoch milliseconds, not ISO strings. **Second, D-21 can be exact.** Every lifecycle fact is a column or a join except "questionnaire submitted", and that one is a portable knex `whereJsonPath` over question answers. It is exact because answer batches are submitted, reverted and returned all at once. The generation registry becomes a `document_id IN (…)` predicate once it exposes its active request ids.

Several locked decisions carry consequences the planner must schedule; see Decision Risks.
- **D-04 contract change:** "one definition cited by both" forces an additive `treatmentDueState` on the Risk Register list DTO, because that DTO has no `closureDate`.
- **Frozen released records:** released assessments freeze their Risks, ControlImplementations and `nextReviewDate`, so treatment and review alerts on released work can never clear in-app.
- **Request status summary path:** D-05's path is not the catalogue's reserved one.
- **Draft requests:** D-10's request alerts must exclude drafts to satisfy D-14.

No new package is needed. The chart primitive is plain HTML with direct labels.

**Primary recommendation:**
1. Publish grants and the guard first.
2. Put every rule in a Strapi-free `src/csrm/insights/` module with an explicit `today`.
3. Build all counts and pages with knex, reusing the Risk Register disclosable-parent predicate and the review status sets, with JS `Date` bindings for datetimes.
4. Hydrate only bounded pages through the Document Service.
5. Ship each server shape with its closed Zod parser in the same plan.

## Project Constraints (from AGENTS.md)

- Strapi is the only production API boundary. Web code uses the typed openapi-fetch layer, with no raw fetch in pages and no frontend facade.
- Keycloak stays disabled.
- Strapi enforces Role → Function → FunctionAPI plus record-level authorisation. Navigation visibility is not security.
- Requestor is an implicit birthright role, and Security Analyst is explicit.
- AI output is advisory and never releases an assessment. This phase touches no AI path.
- The content-type schemas under `apps/strapi/src/api/*/content-types` are frozen.
- Use JDL terms (no Alert, Report or Activity entities). Record gaps in `docs/contract-gaps/`.
- Use semantic tokens only, with no hard-coded values in feature components. WCAG 2.2 AA at 375–1440px. The five-state contract applies, and status and risk are never shown by colour alone.
- Strict TypeScript. Prefer Server Components. Use shadcn/ui before custom primitives. Keep business logic out of JSX.
- Add a dependency only with a concrete reason (D-19 already rules out a chart library).
- Next.js 16.3 differs from training data; check `apps/web/node_modules/next/dist/docs/`.
- Every new endpoint needs exact catalogue grants in both catalogue copies, record-level checks in Strapi, a `specification.json` entry, a regenerated client, a clean `api:check`, and a closed Zod parser.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Grant and human-analyst checks | API (Strapi policy) | — | Exact FunctionAPI grants plus `HUMAN_ANALYST_ONLY_OPERATIONS`; the web only gates presentation |
| Derivation rules (due-state, alert kinds, report maths) | API (pure `src/csrm/insights`) | — | D-02: deterministic with an explicit `today` |
| Counts, group-bys, alert paging, bucket predicates | Database, through knex | API repository | D-03: exact at any volume |
| Actor names and record hydration | API (Document Service, bounded) | — | `populate` with `fields` resolves display names in the same read |
| Capability gate before reads, closed parsing | Frontend server (RSC) | — | `can('assessment:review')` first, then typed services |
| Charts, tiles, filters, states | Browser/RSC presentation | — | No metric derivation in the web (D-02) |

## Standard Stack

No new packages. Everything below is already installed and verified in `node_modules`.

| Library | Version | Purpose | Note |
|---|---|---|---|
| `@strapi/strapi` / `@strapi/database` | 5.51.0 | Routes, policies, Document Service, knex connection | `import type { Database } from "@strapi/database"; type Knex = Database["connection"]` gives full knex typing (including `whereJsonPath` and `unionAll().as()`) without adding `knex` as a dependency. Verified by a tsc probe. |
| knex (transitive) | 3.0.1 | SQL builder | Dialect-aware `whereJsonPath`/`jsonExtract`; `better-sqlite3` converts `Date` bindings with `valueOf()` (`dialects/better-sqlite3/index.js:54-63`) |
| better-sqlite3 | 12.8.0 (SQLite 3.51.3) | The only installed DB driver | `pg` and `mysql2` are absent, so PostgreSQL cannot be exercised in this repository |
| next | 16.3.3 | App Router | Async `params`/`searchParams`; `error.tsx` receives `retry()` (re-fetch) and `reset()` |
| zod | 4.4.3 (web) | Closed response parsers | `.strict()` objects and bounded arrays |
| openapi-fetch / openapi-typescript | 0.17.0 / 7.13.0 | Typed client and `api:generate` | `api:check` = regenerate + `git diff --exit-code` on `schema.d.ts` |
| lucide-react | 1.30.0 | Icons | `BellIcon`, `ChartColumnIcon`, `GaugeIcon`, `CalendarX2Icon`, `CalendarClockIcon`, `EyeIcon` exist |
| vitest / @playwright/test / @axe-core/playwright | 4.0.18 / 1.58.2 / 4.11.0 | Web unit, E2E, accessibility | — |
| node:test (Node 24.19.0) | — | Strapi suites (`tsc` then `node --test`) | One process per test file, so each integration file gets its own SQLite database |

**Package Legitimacy Audit:** not applicable. The phase installs nothing, and D-19 forbids a chart dependency.

## Architecture Patterns

### System Architecture Diagram

```
Analyst browser ──> Next RSC route (/app/review | /app/alerts | /app/reports[/key])
                     │ can('assessment:review')? ── no ──> PermissionDeniedState (no reads issued)
                     ▼ yes
             typed service (server-only openapi-fetch; Bearer token + x-csrm-dev-identity)
                     ▼
Strapi /api/v1/... ─ csrm-app-enabled ─ csrm-authorization:
    exact FunctionAPI grant → HUMAN_ANALYST_ONLY guard → requireAnalystInsightScope
    (also requires human-analyst GET:/api/v1/risks + GET:/api/v1/assessment_requests) → state.analystInsightScope="all"
                     ▼
controller: assert scope → parse closed query (400 on anything else) → today = utcToday(new Date())
                     ▼
pure rules (src/csrm/insights): windows, D-04 due-state, alert kind/urgency/id, report partitions, median
                     ▼
repositories (knex): COUNT/GROUP BY/SUM(CASE), UNION ALL alert branches, D-21 EXISTS predicates
   scope = Risk Register disclosable-parent predicate + review status sets (never widened)
                     ▼
bounded hydration (Document Service: page ids ≤ 50, activity ≤ 10 per source, populate actor displayName)
                     ▼
closed DTO {data, meta} ─> closed Zod parser ─> MetricCard / BarChart+text / DataTable / RecordLink
                                        └─> tiles link to filtered lists whose totals use the same predicate
```

### Recommended Project Structure

```
apps/strapi/src/csrm/insights/            # pure, Strapi-free (D-02); unit-tested with explicit today
  utc-date.ts                              # utcToday, addUtcDays, daysBetween, monthStartsUtc, normalizeDateTime
  insight-constants.ts                     # ALERT_DUE_SOON_WINDOW_DAYS=14, TREATMENT_REPORT_WINDOW_DAYS=30, caps
  treatment-due-state.ts                   # D-04 single definition (alerts, reports, Risk Register projection)
  alert-rules.ts                           # kinds, urgency, rank, id, dayOffset, per-record oracle classifier
  report-math.ts                           # partitions, month buckets, median, normalisation to closed keys
apps/strapi/src/api/csrm-analyst-insight/  # no content type (like csrm-administration)
  operations.ts  routes/csrm-analyst-insight.ts
  controllers/{dashboard,alerts,reports}.ts  # one controller file per resource → no cross-plan edits
  services/{insight-scope,alert-repository,report-repository,report-definitions,recent-activity,dashboard-summary}.ts
apps/strapi/src/api/csrm-assessment-request/services/review-queue-repository.ts   # D-21, shared with dashboard
apps/strapi/src/bootstrap/seed-analyst-insights.ts                                 # D-23
apps/web/app/(app)/app/{review,alerts,reports,reports/[reportKey]}/{page,loading,error}.tsx
apps/web/src/components/csrm/{metric-card,bar-chart,alert-urgency-badge}.tsx     # + tests
apps/web/src/features/{analyst-dashboard,alerts,reports}/{*-schema,*-service,*}.ts(x)
```

### Q1: Grants, policy, routes, catalogue (template `b4f3d88`)

That commit shows the pattern:
1. An `operations.ts` constant.
2. Routes with the policies `["global::csrm-app-enabled", { name: "global::csrm-authorization", config: { operation, … } }]`.
3. The URL added to `HUMAN_ANALYST_ONLY_OPERATIONS`.
4. The same edit to both catalogue copies.
5. A regenerated `schema.d.ts`.
6. A parity block in `contract-catalogue.integration.test.ts`.

Use the Phase 5 and 6 route form `config: { auth: { strategies: ["content-api-token"] }, policies }` (`csrm-risk/routes/csrm-risk.ts:34-40`).

**Policy (`apps/strapi/src/policies/csrm-authorization.ts`):**
- Add the five URLs to `HUMAN_ANALYST_ONLY_OPERATIONS` (lines 23-30).
- The denial message is currently a two-way ternary (lines 238-240). Replace it with a message map.
- Add `requireAnalystInsightScope?: boolean` to `AuthorizationConfig` and `analystInsightScope?: "all"` to the state type (lines 71-84).
- Add a branch beside `requireAnalystRiskRegisterScope` (lines 283-292), sketched below. It enforces D-14: the analyst must already hold both underlying read grants.
- The controllers assert `analystInsightScope === "all"`, mirroring `assertRiskRegisterScope` (`risk-register.ts:207-213`).
- For the Requestor summary, use `{ operation, requireRequestCollectionScope: true }` (lines 337-340). That gives owner scope with the numeric `assessmentRequestRequestorId`, exactly what the list the dashboard reads today uses. Bob resolves as `requestor` there because his analyst role does not hold the Requestor-only FunctionAPI (lines 230-243), so it is owner-scoped for every actor.

```ts
if (config.requireAnalystInsightScope) {
  if (!hasHumanAnalystOperation(grants.explicitRoles, config.operation)
    || !hasHumanAnalystOperation(grants.explicitRoles, "GET:/api/v1/risks")
    || !hasExplicitAnalystOperation(grants.explicitRoles, "GET:/api/v1/assessment_requests")) {
    return deny(policyContext, "CSRM analyst insight access is denied.");
  }
  policyContext.state.csrmAuthorization = { ...policyContext.state.csrmAuthorization, analystInsightScope: "all" };
  return true;
}
```

**Catalogue (edit both copies byte-identically: `docs/references/…catalogue.json` and `apps/strapi/src/bootstrap/…catalogue.json`):**

| Change | Detail |
|---|---|
| New API-only Functions (5) | `function.dashboard.summary_api` "Dashboard Summary API", `function.reports.list_api` "Report Catalogue API", `function.reports.run_api` "Run Report API", `function.alerts.list_api` "Alert List API", `function.alerts.summary_api` "Alert Summary API". Each has `roleIds: ["role.security_analyst"]`, no `menuPath`, and one `functionApiIds` entry. |
| Re-point FunctionAPIs | `dashboard.api.01` (summary), `reports.api.01/02`, `alerts.api.01/02` get the new `functionId`. Renaming the ids to `<newFunctionId>.api.01` follows 06.8 and is recommended. Keep name, url and description. Remove them from the menu Functions' `functionApiIds`: Dashboard keeps api.02/.03, Reports keeps api.03, Alerts keeps api.03/.04 (D-06). |
| Roles | Add the five ids to `role.security_analyst.functionIds` only. The agent and Requestor are unchanged. |
| Requestor summary | Re-point the reserved `function.risk_assessment_requests.my_requests.api.02` url to `GET:/api/v1/my_assessment_requests/status_summary` (see Decision Risk DR-3). The Requestor role already holds that Function (catalogue line 95), and the birthright extends it to every actor. |
| Design notes | Add a note recording the five unserved operations and the D-06 reasons. D-01 says "note 5", but the alert/report note is the sixth entry (index 5). |

**`seed-csrm-data.ts` needs no code change.** Its reconciler reads the catalogue generically:
- **Functions:** matched by name + application + `menuPath` (lines 434-475).
- **FunctionAPIs:** matched by (name, url) inside each Function (lines 480-512).
- **Role links:** reset from `functionIds` (lines 527-569).

A re-pointed FunctionAPI leaves its old row detached from the menu Function, which is harmless and unreachable. There is one caveat, recorded as [ASSUMED] A1. In the dev database, the old API-only Functions have up to 85 duplicate rows, while those added since 06.1 appear exactly once. That suggests Strapi now drops the `$eq: undefined` menuPath filter and keys API-only Functions by name + application alone. **So a new API-only Function must never share a name with a menu Function** ("Dashboard", "Reports", "Alerts"). Add an idempotency test: seed twice, then assert one Function per catalogue name and the exact analyst role set.

**`contract-catalogue.integration.test.ts`:** add a "Phase 7" block modelled on lines 854-935. It asserts:
- Each of the 5 Functions exists once, with `roleIds` deep-equal `["role.security_analyst"]` and no `menuPath`.
- Each has exactly one FunctionAPI with its URL, plus the backlink.
- The analyst has an effective grant; the agent and Requestor do not.
- The operationId, the 400/403 responses (404 for the report run), the success `$ref`, and `additionalProperties:false` on every new component.
- The generated path, operation and component strings are present.
- The Requestor op has `grants: { "role.requestor": "function.risk_assessment_requests.my_requests" }`.
- The five D-06 URLs stay catalogued and are absent from `specification.json` paths.

The policy unit test (`tests/authorization.policy.test.js` with `tests/fixtures/authorization.ts`) gains a misconfigured "Security Analyst Agent" role that holds `GET:/api/v1/dashboard/summary`. It must be denied by the guard, not by the catalogue.

### Q2: Database-level aggregation

**Row model:**
- All six types have `draftAndPublish: false` with no `pluginOptions.i18n`.
- In the dev database, each table's row count equals its distinct `document_id` count, `published_at` is never null, and `locale` is NULL [VERIFIED].
- Use `COUNT(DISTINCT x.id)` defensively. Add no `published_at`/`locale` predicates.
- Guard the assumption with a test that the six schema files keep `draftAndPublish:false`; Strapi 5 would store two rows per document otherwise.
- Relations use `<table>_<attr>_lnk` link tables (manyToOne and oneToOne included). The owning side is the table named first.

| Entity | Table | Columns used | Links |
|---|---|---|---|
| CsrmAssessmentRequest | `csrm_assessment_requests` | `request_status`, `due_date` (date TEXT), `submitted_date` (datetime INT ms), `request_number`, `title`, `document_id` | `_requestor_lnk(csrm_assessment_request_id, idambox_user_id)` |
| CsrmQuestionnaire | `csrm_questionnaires` | `released_at`, `generated_date`, `reverted_at` (datetime), `governance_log` (json) | `csrm_questionnaires_assessment_request_lnk(csrm_questionnaire_id, csrm_assessment_request_id)`, `_released_by_lnk`, `_generated_by_lnk` |
| CsrmQuestion | `csrm_questions` | `answer` (json TEXT: `{state, submittedAt, value…}`) | `csrm_questions_questionnaire_lnk(csrm_question_id, csrm_questionnaire_id)` |
| CsrmAssessment | `csrm_assessments` | `assessment_status`, `approval_date`/`generated_date` (datetime), `next_review_date` (date) | `csrm_assessments_assessment_request_lnk`, `_approved_by_lnk`, `_generated_by_lnk` |
| CsrmRisk | `csrm_risks` | `residual_rating`/`inherent_rating` (free **string**), `treatment_status` (enum, nullable), `target_date`/`closure_date` (date), `risk_number`, `risk_statement` | `csrm_risks_assessment_lnk`, `_information_system_impacted_lnk`, `_treatment_owner_lnk` |
| CsrmControlImplementation | `csrm_control_implementations` | `control_status`, `effectiveness_rating`, `implementation_due_date`/`review_date` (date) | `_risk_lnk(csrm_control_implementation_id, csrm_risk_id)`, `_control_lnk(…, csrm_control_id)` → `csrm_controls(control_number, name)` |
| CsrmInformationSystem | `csrm_information_systems` | `name`, `document_id` | — |

**Scopes to reuse (D-14):**
- **Risk scope:** the Risk Register's `applyDisclosableParent` (`risk-register.ts:119-145`). It admits a mutable parent (draft or in-review, no approval facts) or a released parent (approved, `approval_date`, and `approved_by` link). Export it; don't copy it.
- **Request scope:** the review status sets (`collection-scope.ts:44-50`, selected by `queueStatuses()` at lines 66-68 since 06.9-04): reviewable {submitted, questionnaire-in-progress, risk-assessment-drafted, under-review} ∪ released {approved, closed}. Never draft.
- **Assessment scope:** the analyst assessment list reads every assessment.

**Query shapes (knex, `c = strapi.db.connection`):**

```ts
// a/b. Risk counts: residual (or inherent) × treatment status, RR scope
applyDisclosableParent(c("csrm_risks as r")).select("r.residual_rating as rating", "r.treatment_status as status")
  .countDistinct({ total: "r.id" }).groupBy("r.residual_rating", "r.treatment_status");
// normalise in report-math: rating ∉ {Low,Moderate,High,Critical} → notRated; status null → notRecorded; Number(total)

// c. Treatment due-state partition (dates are TEXT → string bindings are correct)
const open = "(r.closure_date IS NULL AND (r.treatment_status IS NULL OR r.treatment_status <> 'Complete'))";
applyDisclosableParent(c("csrm_risks as r")).select(c.raw(`
  SUM(CASE WHEN ${open} AND r.target_date < ? THEN 1 ELSE 0 END) AS overdue,
  SUM(CASE WHEN ${open} AND r.target_date >= ? AND r.target_date <= ? THEN 1 ELSE 0 END) AS due_within,
  SUM(CASE WHEN ${open} AND r.target_date > ? THEN 1 ELSE 0 END) AS later,
  SUM(CASE WHEN ${open} AND r.target_date IS NULL THEN 1 ELSE 0 END) AS no_target,
  SUM(CASE WHEN NOT ${open} THEN 1 ELSE 0 END) AS complete_or_closed, COUNT(*) AS total`,
  [today, today, plus30, plus30]));

// d. Requests by status: analyst scope (whereIn reviewable ∪ released) or owner scope (D-05)
c("csrm_assessment_requests as r").join("csrm_assessment_requests_requestor_lnk as o", "o.csrm_assessment_request_id", "r.id")
  .where("o.idambox_user_id", requestorId).select("r.request_status as status").countDistinct({ total: "r.id" }).groupBy("r.request_status");

// e. Released per month: ONE query, JS Date bindings (month starts UTC)
c("csrm_assessments as a").where("a.assessment_status", "approved").whereNotNull("a.approval_date")
  .whereExists((s) => s.from("csrm_assessments_approved_by_lnk as ab").whereRaw("ab.csrm_assessment_id = a.id").select("ab.id"))
  .select(months.map((m, i) => c.raw("SUM(CASE WHEN a.approval_date >= ? AND a.approval_date < ? THEN 1 ELSE 0 END) AS ??", [m.start, m.end, `m${i}`])));

// f. Median submission→release: bounded sample (cap+1), newest first; median in report-math
//    select r.submitted_date, a.approval_date … join assessment_request_lnk … where release predicate
//    and a.approval_date >= periodStart and r.submitted_date IS NOT NULL order by a.approval_date desc, a.id desc limit CAP+1
//    → normalizeDateTime(number|Date|string) → days = (approval - submitted)/86_400_000, drop negatives, 1 dp; {value|null, sampleSize, truncated}

// g. Control implementations by status × effectiveness, via Risk scope
c("csrm_control_implementations as ci").join("csrm_control_implementations_risk_lnk as cr", "cr.csrm_control_implementation_id", "ci.id")
  .join("csrm_risks as r", "r.id", "cr.csrm_risk_id").modify(applyDisclosableParent)
  .select("ci.control_status", "ci.effectiveness_rating").countDistinct({ total: "ci.id" }).groupBy("ci.control_status", "ci.effectiveness_rating");

// h. Top Information Systems by High/Critical residual Risks (cap+1 → truncated)
c("csrm_risks as r").join("csrm_risks_information_system_impacted_lnk as l", "l.csrm_risk_id", "r.id")
  .join("csrm_information_systems as s", "s.id", "l.csrm_information_system_id").modify(applyDisclosableParent)
  .whereIn("r.residual_rating", ["High", "Critical"])
  .select("s.document_id", "s.name", c.raw("SUM(CASE WHEN r.residual_rating = 'Critical' THEN 1 ELSE 0 END) AS critical"),
    c.raw("SUM(CASE WHEN r.residual_rating = 'High' THEN 1 ELSE 0 END) AS high")).countDistinct({ total: "r.id" })
  .groupBy("s.id", "s.document_id", "s.name").orderBy([{ column: "critical", order: "desc" }, { column: "total", order: "desc" }, "s.name", "s.document_id"]).limit(CAP + 1);
```

The monthly SUM with `Date` bindings (a count of 1) and the ISO-string trap (a count of 0) were both executed read-only against the dev database. `whereNotIn(col, [])` compiled to a true predicate [VERIFIED]. PostgreSQL returns COUNT and SUM as strings, so always wrap them in `Number()` (as `risk-register.ts:405` does).

### Q3: D-21 review-queue buckets as database predicates

**How buckets are decided today:**
- `find` reads up to 1,000 reviewable rows in pages of 100 and classifies them in memory (`controllers/csrm-assessment-request.ts:74-98` after 06.9-04).
- The classifier is `selectReviewQueueBucket` (`collection-scope.ts:290`, formerly 243-265), which calls `deriveRequestLifecycle` (`request-lifecycle.ts:23-39`).

**Inputs:**

| Fact | Source | SQL |
|---|---|---|
| `requestStatus` | column | `r.request_status IN (bucketStatuses ∩ requested)` |
| questionnaire exists / released | join | `EXISTS(ql … )` / `EXISTS(ql JOIN csrm_questionnaires q … q.released_at IS NOT NULL)` |
| questionnaire submitted | join + JSON | `EXISTS(ql JOIN csrm_questions_questionnaire_lnk qql JOIN csrm_questions qu … whereJsonPath('qu.answer','$.state','=','submitted'))` |
| assessment exists | join | `EXISTS(csrm_assessments_assessment_request_lnk al …)` |
| assessment released | join | `EXISTS(al JOIN csrm_assessments a … status='approved' AND approval_date NOT NULL AND EXISTS(approved_by_lnk))` |
| generation active | in-memory registry | `r.document_id IN (:activeIds)` / `NOT IN` |

**Exact predicates.** These follow from `highestMatchingStep` restricted to the reviewable base, where step 0 (draft) and closed can't occur:
- `released`: status ∈ released ∩ requested. No lifecycle predicate.
- `generation-in-progress`: status ∈ reviewable ∩ requested AND `document_id IN active`. An empty set short-circuits to an empty page.
- `awaiting-requestor`: reviewable ∧ qReleased ∧ ¬qSubmitted ∧ ¬assessmentExists. It does **not** exclude active jobs, exactly as today (the `awaiting-requestor` branch of `selectReviewQueueBucket`).
- `requires-attention`: reviewable ∧ `document_id NOT IN active` ∧ ¬assessmentReleased ∧ (assessmentExists ∨ qSubmitted ∨ ¬qReleased).

The facts were prototyped read-only on the dev database. `RAR-DEV-QUES-DRAFT-001` (released, not submitted, no assessment) lands in awaiting-requestor. The unreleased questionnaire lands in requires-attention.

**Why "questionnaire submitted" can be a JSON predicate.** In-app, it is "every *active* question has a submitted answer" (`questionnaire-scope.ts:152-155,200-213`), which needs definition parsing and visibility. It is still equivalent to "some answer has `state = 'submitted'`", because the workflow keeps submission all-or-none:
- Submit stamps every visible active answer with one timestamp (`questionnaire-workflow.ts:115-143`).
- A submitted batch is immutable (lines 105-109).
- Revert returns every one to draft (lines 340-356).
- Return-to-review converts all of them and clears release (`questionnaire-governance-workflow.ts:246-262`).
- Question edits happen only in unreleased analyst review (lines 237-243, 443-447).

The only divergence is a malformed definition, which the app treats as "not-started". Document that as accepted. `whereJsonPath` compiles to `json_extract` on SQLite and `jsonb_path_query_first … #>> '{}'` on PostgreSQL (knex source).

**Latent fact the rewrite must not copy.** The current scan populates `assessment: true` (controller line 71) without `approvedBy`, `reviewedBy` or `risks`. So `isReleased()` (`assessment-workflow.ts:121-126,62-67`) and `validateReleaseReadiness()` (lines 317-354) are always false in the queue. This is harmless today: reviewed and drafted share a bucket, and a release always approves the request in the same transaction. The SQL version should implement the semantic rule. Its equivalence test should feed the oracle fully populated documents.

**Composing with 06.9-04 (landed in `ac83db5`, `1c32d3b`, `22227d2`, `e14891e`).** `buildAnalystReviewCollectionQuery` now returns `{kind:"outside-queue"}|{kind:"read", …}` (`collection-scope.ts:236-252`), and `find` answers outside-queue with an empty page before any read (controller lines 62-69). D-21 keeps that short-circuit. On the read branch it translates the queue `$in` set, the requested `$eq` status, and the title/number/dueDate filters into knex:
- `LOWER(r.title) LIKE ? ESCAPE '!'`, as in the Risk Register at `risk-register.ts:297-302`.
- Explicit null ordering that matches today's SQLite order: NULLs first for asc, last for desc.
- A final `r.id` tiebreak.

Then select a page of `document_id`s and hydrate them (≤100) with `documents.findMany({ filters: { documentId: { $in } }, fields: [...5 projected fields] })`, preserving the order (the Risk Register pattern at lines 274-277). Put the builders in `review-queue-repository.ts` and export `countBucket()` for the dashboard. That gives one shared definition for the page, its total, and the tiles.

**Registry.** Add `activeRequestIds(): readonly string[]` beside `hasActiveJob` (`questionnaire-generation-registry.ts:16,27`), then export it through the workflow (`questionnaire-generation-workflow.ts:71-73`). Guard the snapshot with a named cap: fail closed if it is ever exceeded; it is unreachable in practice. The registry is process-local, so generation-in-progress is exact only for a single Strapi process (Phase 8 note).

**Test seam.** A held generation job: patch `deterministicQuestionnaireGenerationProvider.generate` from `dist` so it awaits a gate, the same technique the harness uses in `withProviderFailure` (`strapi-http-harness.ts:905`).

### Q4: Alert predicates (UTC calendar dates; `today = new Date().toISOString().slice(0,10)`)

The window rule:
- `overdue` ⇔ governing date `< today`.
- `due-soon` ⇔ `today ≤ date ≤ addUtcDays(today, 14)`, inclusive at both ends.
- `dayOffset = daysBetween(today, date)`, which is negative when overdue.
- Dates are compared as `YYYY-MM-DD` strings in SQL, which is correct for TEXT dates.

| Kind | Urgency | Predicate | Governing date | Scope | Null handling |
|---|---|---|---|---|---|
| risk-treatment-overdue / due-soon | overdue / due-soon | target_date vs window ∧ `(treatment_status IS NULL OR <> 'Complete')` ∧ closure_date IS NULL | target_date | RR disclosable parent | null target → no alert; **NULL status counts as not Complete** |
| request-overdue / due-soon | overdue / due-soon | due_date vs window ∧ status ∈ **reviewable** | due_date | review scope (drafts excluded, DR-4) | null due_date → none |
| control-implementation-overdue | overdue | implementation_due_date < today ∧ control_status='Planned' | implementation_due_date | CI → Risk → RR parent | null date or status → none |
| assessment-review-due | overdue if < today, else due-soon | released triple ∧ next_review_date ≤ today+14 | next_review_date | all assessments | null → none |
| critical-residual-risk-untreated | attention | residual_rating='Critical' ∧ treatment_status='Not Started' ∧ closure_date IS NULL | target_date (nullable) | RR parent | NULL status: DR-6 |
| ineffective-control | attention | effectiveness_rating='Ineffective' ∧ parent risk closure_date IS NULL | review_date (nullable) | RR parent | — |

**Input reliability:**
- Request `dueDate` is optional, entered by the Requestor (`request-schema.ts:60`), and sparse.
- `nextReviewDate` is analyst-editable only before release (`assessment-workflow.ts:23,128-134`) and frozen afterwards.
- Risk and CI fields freeze at release (`risk-workflow.ts:208` → `withMutableAssessmentMutation` → `assertMutableAssessment`), so released-work alerts never clear (DR-2).
- Risk ratings are free strings, so they are normalised to the closed ladder or `null`.

**List (D-12).** Build a knex `select * from (b1 UNION ALL b2 …) alerts ORDER BY urgency_rank, CASE WHEN governing_date IS NULL THEN 1 ELSE 0 END, governing_date, kind, source_id LIMIT ? OFFSET ?`.
- The UNION was prototyped on the dev database.
- Every branch selects the same typed columns: kind literal, rank, the date column (all `date`), source type, source document_id, identifier, title, residual rating, and link ids. There are no datetime columns, so there is no epoch-ms normalisation.
- Only 1:1 joins are used (CI→risk, risk→assessment, CI→control); scope checks are `EXISTS`.

**Summary.** It runs per-kind `COUNT(DISTINCT …)` with the **same branch builders**, so the list total equals `summary.byKind[kind]` and `summary.byUrgency[u]`. The integration test asserts every equality.

**DTO.** The id is `<kind>:<sourceDocumentId>`; for CI kinds that is the CI documentId, which keeps ids unique. `source` carries `{type, documentId, identifier, title}`, and `link` carries `{type: assessment-request|assessment|risk, documentId}`. A CI links to its parent Risk (`/app/risks/{id}`), because no CI page exists. Add `residualRating|null` (D-11) and `dayOffset|null`. Page sizes are {10, 25, 50}.

### Q5: Recent activity and actor names

Every source is a column-level timestamp with an actor **relation**, so one bounded Document Service read per source both resolves the name through `populate: { rel: { fields: ["documentId","displayName"] } }` and returns ISO dates:

| Activity | Filter / sort (limit 10 each) | Actor |
|---|---|---|
| Request submitted | `submittedDate $notNull`, status ∈ reviewable ∪ released | `requestor` (revert clears `submittedDate`, `request-workflow.ts:111,143`) |
| Questionnaire generated | `generatedDate $notNull` | `generatedBy` |
| Questionnaire released | `releasedAt $notNull` | `releasedBy` |
| Assessment drafted | `generatedDate $notNull` | `generatedBy` |
| Assessment released | `approvalDate $notNull`, status approved, `approvedBy.id $notNull` | `approvedBy` |

Merge the results in `recent-activity.ts` (pure): sort by `occurredAt` desc, then kind, then documentId; take `RECENT_ACTIVITY_LIMIT = 10`.

Two sources are excluded, both to be recorded in the Phase 7 contract-gap note:
- **Questionnaire submission.** Its time exists only in per-question answer JSON.
- **`governanceLog` events.** These store only a documentId (`questionnaire-scope.ts:278-290`), which is why the revision timeline says "An analyst" (`questionnaire-revision-timeline.tsx:26`).

**Actor names.** A null actor relation means the UI omits the actor; it never falls back to "An analyst". Closing the timeline follow-up would take one batched `idambox-user findMany({documentId:{$in}}, fields)`. That is out of D-21/D-22 scope; leave it as a follow-up.

### Q6: Web routes, services, navigation

**Route shell** (precedent `risks/page.tsx`, `risks/[documentId]/page.tsx`):
- Keep the page synchronous: `PageHeader` plus `<Suspense fallback={<Skeleton/>}>` around an exported async `…Content`.
- The content first resolves `can('assessment:review', granted)` through `getSessionAdapter()` and returns `PermissionDeniedState area=…` **before any read**.
- It then parses `searchParams`/`params` (Promises in 16.3: `await params`) with Zod, calls the typed service, and maps 403 to permission, other errors to error, and data to populated.
- Join the E2E UI-state harness with `resolveE2eUiState` after the read, and add the route to `e2e-ui-state-route-authorization.test.tsx`.
- `/app/reports/[reportKey]` validates the key with a closed `z.enum` and calls `notFound()` or renders the not-available state for unknown keys, issuing no read.
- New `error.tsx` files use the 16.3 `retry()` prop, which re-fetches and re-renders (`next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` "retry"; runtime `error-boundary.js:43,114`). Keep the shared `ErrorState retry={retry}` copy.

**Parent segment.** `review/loading.tsx` and `review/error.tsx` wrap the child segments too (loading.md:76, error.md:96). All three children have their own boundaries, so nothing regresses. Keep the review page's skeleton layout-accurate, with `data-slot="skeleton"`, which the accessibility helper waits on.

**Navigation** (`src/config/navigation/navigation.ts`): add `{'/app/review','Analyst dashboard',GaugeIcon}`, `{'/app/alerts','Alerts',BellIcon}` and `{'/app/reports','Reports',ChartColumnIcon}` under `assessment:review`. `isActiveRoute` (`capability-navigation.tsx:18-22`) matches by prefix except for `/app`, so `/app/review` would mark itself **and** "Assessment Requests" as `aria-current` on `/app/review/requests/*`. Add an exact-match flag, with a test beside `mobile-navigation.test.tsx:26-34`.

**Services and parsers:**
- **Modules:** `features/{analyst-dashboard,alerts,reports}/*-service.ts` (`server-only`, `createStrapiClient`, the `request()` helper as in `risk-service.ts:45-57`), each exporting `responseParserModule`.
- **Parity guard:** register each module in `contract-response-parity.test.ts`, both the import inventory (lines 10-37) and the **pinned sorted module list** (lines 207-221).
- **Report union:** register one parser per report with `path:'/v1/reports/{reportKey}', method:'get', branch:'<ReportComponent>'`. The guard threads `branch` into nested unions.
- **Bucket shapes:** the guard emits single-element arrays, integers of 1 and first enum values (lines 127-185). Use closed **objects** for fixed buckets, not arrays of buckets, and add no `.min()`, `.length()` or cross-field `refine` to Zod.
- **D-22:** `getMyAssessmentRequestStatusSummary()` goes in `features/requests/request-service.ts` with a parser entry. In `requestor-dashboard-service.ts:154-203`, replace the seven `listDashboardRequests` calls with that single read.
  - A 403 still yields `permission-denied`.
  - Any other failure yields `requestLifecycleCounts: null`, the same copy as today.
  - Update `requestor-dashboard.test.tsx:216-225,351-353` from 8 calls to 1.

**Tile links (D-18, D-24): every tile counts exactly what its link shows:**
- Queue tiles use D-21 `countBucket` and link to `/app/review/requests?queue=…`. The default queue omits the parameter (`assessment-list.tsx:55`).
- The High and Critical tiles count the Risk Register predicate, including closed Risks, because the register has no closure filter. They link to `/app/risks?residualRating=Critical`.
- The overdue-treatment and urgency tiles use the alert summary and link to `/app/alerts?kind=…` or `?urgency=…`.

### Q7: Seeds, boot-relative dates, E2E harness

**Fixture (D-23).** `seed-analyst-insights.ts` follows `seed-assessment-navigation-lifecycle.ts:46-47`:
- **Gate:** `IDAMBOX_SEED_CSRM === "true" && developmentIdentityEnabled()`. Call it from `src/index.ts` bootstrap after `seedRiskRegisterWorkflow`.
- **Reconcile by stable keys:** `RAR-E2E-P7-*`, `ASM-E2E-P7-*` and `RSK-E2E-P7-*` (unique columns). CIs are keyed by (risk, control).
- **Dates:** rewrite them on every boot from `utcToday(new Date())` using the **same** `addUtcDays` as the rules, so the conditions hold whatever the boot date, on the dev database too.
- **Concurrency:** serialise with an in-process queue (`seed-risk-register-workflow.ts:269-276`).
- **Spacing:** keep offsets ≥3 days from any window edge (for example −30, −10, +5, +7, and nextReview −2). A roughly 15-minute suite that crosses UTC midnight then cannot flip a category. Boundaries belong in Strapi tests.
- **Statuses and owner:** use `under-review` or `questionnaire-in-progress` request statuses, never `submitted`, so no spec can start generation on them. Use jane as the owner.

**Integration tests (D-24).** Each `tests/*.test.ts` file is its own node process with its own `authorization-${pid}.sqlite` (`startAuthorizationHttpHarness`, `strapi-http-harness.ts:227`). Bootstrap seeds are off in the harness, and only `seedCsrmData` runs (lines 275-276). A new Phase 7 file therefore starts from known state:
- Seed controlled fixtures in `before`.
- Compute `today` in the test from the same helper.
- Assert literal expected values. Keep boundary fixtures at today, today+14, today+15 and today−1.

The harness helpers `createAssessmentRequestFixture` and `createAssessmentFixture` (added by 06.9-04, lines 199-209, 1133-1143) and `createRiskRegisterFixture`/`createRiskRegisterMitigationFixture` (1152-1166) accept too few fields. Widen them for `dueDate`/`submittedDate`, release facts plus `nextReviewDate`, and CI `effectivenessRating`/`implementationDueDate`/`reviewDate`.

**Playwright boot** (`apps/web/playwright.config.ts`):
- **Ports:** Strapi `20000+pid%10000` and Next `40000+pid%10000` (lines 42-45).
- **Database and dist:** a per-run `.tmp/playwright-e2e-<uuid>.db` (line 37) and Next dist `.tmp/playwright-next-<uuid>`.
- **Strapi process:** `pnpm develop` with `IDAMBOX_SEED_CSRM=true` and `CSRM_AI_PROVIDER=deterministic` (lines 86-87); `workers:1`, `fullyParallel:false` (58-61). `strapi develop` writes the shared `apps/strapi/dist`.
- **UI-state attestation:** it lasts 60 minutes (`e2e-ui-state.ts:25`).
- **Spec order:** files run alphabetically, so never rely on order.
- **Finding the fixture alert:** filter `/app/alerts?kind=risk-treatment-overdue`, and page until the `RSK-E2E-P7-OVERDUE` row appears, or give it the oldest target date.

### Q8: Accessible chart primitive (no dependency)

**Markup.** Use HTML, not SVG: `<figure aria-labelledby>` with a visible title, then an `<ol>` of rows. Each row holds a visible label, the tabular value, and a decorative bar (`<span aria-hidden="true">`). Its width comes from the value's share of the maximum through an inline `style={{ inlineSize: \`${pct}%\` }}` (data, not a design value; the shadcn `Progress` precedent).

**WCAG:**
- **1.1.1:** the visible labelled values are the text alternative and are always on screen. Cross-tabs render as a `<table>` with a `<caption>` beside or under the chart, behind a `<details><summary>Show data table</summary>` disclosure.
- **1.4.1:** each row carries a label and a number. Severity rows also carry the `RiskRatingBadge` icon and label.
- **1.4.11:** bars duplicate text, so they are not required for understanding. Their fills still pass: `bg-chart-1` (#141413) at 18.4:1 and `bg-chart-2` (#6B6962) at 5.5:1 on white. Severity bars use the **fg** risk tokens (`bg-risk-high`, …), never `-subtle`. `--chart-grid` (#D8D5CD, 1.35:1) is only for decorative tracks and gridlines.
- **More than two series:** show them as separate small bars per row, told apart by labels, with dash or pattern only if needed, and never a new hue. Prefer a table for crosstabs.

**Tokens** (`app/globals.css:109-117,169-171,248-250`): `bg-chart-1`, `bg-chart-2`, `bg-chart-grid`, `bg-risk-{low,medium,high,critical}`, `text-foreground-secondary`, `.micro-label`, `text-display`, `tabular-nums`.

**Behaviour.** Render instantly with no animation (§5, do-not #8). At 375px, the label stacks above the bar. `MetricCard` (the brief's name) is §4 anatomy: micro caption, `text-display tabular-nums` value, an optional delta slot left unused, and, when it is a link, border → `--color-border-ink` plus a −1px lift. Its accessible name contains caption and value.

**Urgency badge.** Mirror `StatusBadge`: overdue uses the destructive tokens with `CalendarX2Icon`, due-soon uses warning with `CalendarClockIcon`, and attention uses info with `EyeIcon`. None of these shapes appear in the risk ladder, so urgency and severity are never conflated (D-11).

### Anti-Patterns to Avoid

These are in addition to the pitfalls below:
- Don't copy the in-memory summaries into new handlers: `loadCompleteQuestionnaireScope` and the 1,000-row loops at `csrm-assessment.ts:145-160` both load whole collections.
- Don't duplicate scope SQL. Export `applyDisclosableParent` and the status sets instead.
- Don't do web-side date maths once D-04 lands.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| JSON field predicate | Raw `json_extract`/`LIKE '%"state":"submitted"%'` | knex `whereJsonPath` | Dialect-aware; PostgreSQL `jsonb::text` inserts spaces |
| Datetime comparison | ms arithmetic in SQL strings | `Date` bindings (knex converts per dialect) | SQLite stores INTEGER ms; PostgreSQL uses timestamps |
| Heterogeneous paged list | Load every alert and merge in memory | `UNION ALL` + `ORDER BY` + `LIMIT/OFFSET` | Exact at any volume (D-03) |
| Actor names | One lookup per item | `populate` with `fields: ["displayName"]` | One bounded read per source |
| Knex types | Adding `knex` as a dependency, or hand-typing a wide builder | `import type { Database } from "@strapi/database"` | No new dependency; tsc-verified |
| Tables, states, badges, links | New variants | `DataTable`, state primitives, `StatusBadge`/`RiskRatingBadge`, `RecordLink` | D-20, plus the design-contract suite checks them |
| Charts | A library or SVG axis code | HTML bar list with direct labels | D-19; accessible by construction |

## Runtime State Inventory

| Category | Items Found | Action |
|---|---|---|
| Stored data | The dev `apps/strapi/.tmp/data.db` holds seeded Functions and FunctionAPIs. Re-pointing leaves the old summary, alerts and reports FunctionAPI rows detached, and unreachable because authorisation walks role→function→api. Older duplicate API-only Function rows (e.g. "Assessment Request Core API" ×85) already exist. The Phase 7 fixture adds E2E-keyed records on boot when `IDAMBOX_SEED_CSRM=true`. | None; reseed on boot |
| Live service config / OS state | None; verified no external services | — |
| Secrets/env | None new. `CSRM_AI_*` untouched | — |
| Build artifacts | `apps/strapi/dist`, shared by `strapi develop`, Playwright's Strapi and the harness `compileStrapi`, plus `.tmp/tests-dist` | Never run them concurrently |

## Common Pitfalls

1. **ISO-string datetime comparisons.** With knex, `approval_date >= '2026-09-01T…'` returned 0 rows and a `Date` binding returned 1 [VERIFIED]. Raw reads return `1788018028452`, not ISO strings. PostgreSQL returns `Date` for timestamps, TEXT for dates (Strapi's type parser) and strings for COUNT/SUM. Normalise everything in `utc-date.normalizeDateTime`.
2. **NULL in `<>`.** `treatment_status <> 'Complete'` drops NULL rows. Write `(IS NULL OR <> …)`.
3. **Tile/list mismatch.** A tile counting "open" Risks that links to the Risk Register, which includes closed ones, breaks D-24 consistency. Count the linked list's own predicate.
4. **Under-populated relations.** They make predicates constant (Q3). Test the oracle with a full `populate`.
5. **Parity guard shapes.** Single-element arrays, integers of 1 and first enum/branch mean no `.min(6)` on the months array and no `total === sum` refinement. Unions need a `branch` per parser. The pinned module list must change.
6. **Double `aria-current`** for `/app/review`: add exact matching.
7. **Shared files change under you.** 06.9-04 has just rewritten `collection-scope.ts`, the controller, `strapi-http-harness.ts`, `contract-catalogue.integration.test.ts` and `specification.json`. Plans must read the current versions; the line numbers here are as of `e14891e`. Plans that edit the same file must run in sequence.
8. **Build and Windows hazards:**
   - `apps/strapi/dist` corrupts if the dev Strapi, Playwright or the Strapi suite run together (405s from half-written builds).
   - Playwright rewrites `apps/web/next-env.d.ts` and `tsconfig.json`; restore both with `git checkout --`.
   - vitest `EPERM: rename` is a Windows flake; rerun the single file.
9. **404 versus 403.** Analyst-insight denials are 403 from the policy. Only assessment detail reads answer 404 by design. Don't mix the two in tests.
10. **Suite-order totals.** Never assert global totals in the browser. Place E2E fixture dates ≥3 days from window edges. `today` is the UTC date, so before 10:00 AEST it is still yesterday locally; say "UTC" in copy where dates are compared.
11. **Seed naming.** An API-only Function named like a menu Function is merged into it by the reconciler (A1).
12. **Sign-in helpers.** They use `getByRole('heading', { name: 'Dashboard' })`, which is a substring match (e.g. `assessment-navigation-lifecycle.spec.ts:20`). They only run on `/app`, but new helpers should use `exact: true`.
13. **SQL injection.** Use only constant `orderByRaw` fragments and bound parameters, and derive every column or alias from closed enums, never from query strings.

## Decision Risks

**DR-1 (D-04): agreement requires a Risk Register contract change.**
- **Evidence:** `isRiskOverdue` (`risk-schema.ts:335-338`) checks the date only, so it flags Complete and closed Risks as Overdue, contrary to D-04. The list DTO (`RiskRegisterItem`, `risk-register.ts:34-44`) has no `closureDate`, and D-02 forbids web-side derivation.
- **Adjustment:** add a server-derived `treatmentDueState` (`overdue|due-soon|later|no-target-date|complete-or-closed`) to `RiskRegisterItem`, computed by the shared rule with `today`, and retire `isRiskOverdue`.
- **Tests to update:** `risk-register.integration.test.ts:126` (exact key set), the web `risk-register.test.tsx:123` and `risk-schema.test.ts:145`.

**DR-2 (D-04/D-10/D-13): alerts on released work can never clear in-app.**
- **Evidence:** Risk and ControlImplementation mutations go through `withMutableAssessmentMutation` → `assertMutableAssessment` (`risk-workflow.ts:208`; `control-implementation-workflow.ts:185,214,241`; `assessment-workflow.ts:128-134`), and `nextReviewDate` is frozen at release. A released Risk past its target, or a released assessment past its review date, alerts forever.
- **Adjustment:** don't change mutability. The alerts are true facts. Word them as facts ("Target date passed 12 days ago") and show the released or read-only state. Record "post-release treatment tracking" in `docs/contract-gaps/phase-07-derived-insights.md` for a later decision.

**DR-3 (D-05): the Requestor summary path is not the reserved one.**
- **Evidence:** the catalogue reserves `GET:/api/v1/my_requests/status_summary` (`function.risk_assessment_requests.my_requests.api.02`, line 1006) with exactly this description, and nothing reserves `my_assessment_requests`.
- **Adjustment:** keep the D-05 path, which is consistent with the served `/v1/assessment_requests` naming, and **re-point the reserved entry's url** rather than add a second summary FunctionAPI. Record it in the design notes. Serving the reserved path instead would also satisfy D-05's intent; that is the orchestrator's call.

**DR-4 (D-10 against D-14): `request-overdue` would include drafts.**
- **Evidence:** "not approved or closed" includes `draft`, but the analyst review scope never includes drafts (`collection-scope.ts:44-50,66-68`; the 06.9-04 G-2 "no draft ever returned").
- **Adjustment:** request alerts use the four reviewable statuses only. Record the reason.

**DR-5 (D-21): exactness rests on the submission invariant (Q3).**
- **Evidence:** the SQL "any answer submitted" predicate matches the in-app rule except for a malformed definition.
- **Adjustment:** keep the semantic rule. Add an equivalence test over one fixture per lifecycle step, asserting literal buckets plus the fully populated oracle. Document the malformed-definition divergence.

**DR-6 (D-10): the edges of `critical-residual-risk-untreated`.**
- **Evidence:** a Critical Risk with NULL `treatmentStatus` is also untreated. The literal `= 'Not Started'` misses it.
- **Adjustment:** include NULL, with a written reason, or keep it literal. The planner must state which. The same question arises for `treatmentAction='Accept'` Risks in the treatment kinds: D-04 is silent, and the seed records accepted Risks as Complete and closed (`seed-risk-register-workflow.ts:120-124`). Recommended: keep D-04 literal.

**DR-7 (D-18/D-24): the High and Critical tiles.** They must equal the Risk Register totals for the linked filter, so they are Risk Register counts, including closed Risks, not "open exposure". Label them accordingly, or link them nowhere. Linking to the register is recommended.

**DR-8 (D-07): API-only Function names** must be distinct from the menu Function names (A1). Low risk, and guarded by an idempotency test.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Strapi 5.51 drops a `$eq: undefined` filter, so API-only Functions reconcile by name + application. Evidence: dev-database duplicates stopped after Phase 6. | Q1 | A new Function could duplicate each boot. The idempotency test catches it. |
| A2 | The knex SQL is PostgreSQL-portable. Built with dialect-aware helpers, but `pg` is not installed. | Q2–Q4 | Phase 8 portability fixes |
| A3 | D-13's "requests by lifecycle state" means `requestStatus` counts in review scope (the Requestor dashboard's "lifecycle state" cards use `requestStatus`). | Q2 | A different breakdown; the 8-step lifecycle is computable from the Q3 facts |
| A4 | The median is scoped to releases within the selected period, with `THROUGHPUT_SAMPLE_CAP = 5000` and a `truncated` flag. | Q2 | Report semantics |
| A5 | The risk-exposure matrix counts the Risk Register scope, including closed Risks, to stay consistent with the register. | Q2, DR-7 | Exposure reads high |

## Open Questions

**Resolved (2026-09-24, 07-CONTEXT):** Q1 by D-28, which serves the reserved `my_requests/status_summary` path rather than the recommendation below. Q2 and Q3 by D-31. Q4 by D-34.

1. DR-3: which path to serve? Recommended: D-05's path, re-pointing the reserved entry.
2. DR-6: include NULL status in `critical-residual-risk-untreated`? Recommended: yes, with a reason.
3. Should `control-implementation-overdue` also require an open parent Risk, for consistency with `ineffective-control`? Recommended: yes, with a written reason.
4. Dashboard composition (discretion): recommended `dashboard/summary` (bucket, residual and treatment counts plus activity), with `alerts/summary` and `alerts?pageSize=10` read in parallel. Each widget then fails independently, like the Requestor dashboard's lifecycle counts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node (with the PATH prefix) | all suites | ✓ | 24.19.0 | — |
| better-sqlite3 / SQLite | Strapi and tests | ✓ | 12.8.0 / 3.51.3 | — |
| PostgreSQL driver `pg` | portability proof | ✗ | — | Build portable SQL; verify in Phase 8 |
| Playwright + Chromium, axe | E2E | ✓ (35/35 passed in 06.9) | 1.58.2 / 4.11.0 | — |
| Stopped dev servers (ports 1337/3000) | Playwright and the Strapi suite (shared `dist`) | Orchestrator-controlled | — | Run gates only when stopped |

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Strapi: `node:test` (compiled by `tsc -p tests/tsconfig.json`); web: vitest 4.0.18 (jsdom); E2E: Playwright 1.58.2 + @axe-core/playwright |
| Config | `apps/strapi/tests/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run | `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && (cd apps/strapi && node --test .tmp/tests-dist/tests/<file>.test.js)`; `pnpm --filter @csrm/web test -- <pattern>` |
| Full suite | `pnpm --filter @csrm/strapi test`; `pnpm --filter @csrm/web test`; `pnpm --filter @csrm/web typecheck`; `pnpm --prefix apps/web api:check`; phase gate `pnpm --filter @csrm/web test:e2e` (servers stopped, then restore the two Next files) |

### Phase Requirements → Test Map

| Req / Decision | Behaviour | Type | File (new unless noted) | Exists? |
|---|---|---|---|---|
| D-02, D-04, D-10, D-11, D-13 | Window boundaries (today, +14, +15, −1), NULL status, closed/complete exclusion, ids, ordering, median, partitions sum to total | unit | `apps/strapi/tests/analyst-insights.unit.test.ts` | ❌ |
| D-05, D-07, D-08 | Grants, spec, generated client, closed components, D-06 unserved | integration (static) | `contract-catalogue.integration.test.ts` (extend) | ✅ |
| D-07 | A misconfigured agent grant is still refused | unit (policy) | `tests/authorization.policy.test.js` + `fixtures/authorization.ts` (extend) | ✅ |
| D-09, D-12, D-14, D-24 | 403 for owner, otherRequestor, service agent, ungranted agent, inactive and anonymous; exact list and summary values; list total = summary per kind and urgency; RR and review scope exclusions (partial-release parent, drafts) | integration | `tests/analyst-alerts.integration.test.ts` | ❌ |
| DASH-02, D-13, D-14 | Four reports: exact values, `period` ∈ {6,12}, 400 for unknown query keys, 404 for unknown key, caps and `truncated` | integration | `tests/analyst-reports.integration.test.ts` | ❌ |
| DASH-01 | Summary tiles equal the queue totals, RR filtered totals and alert summary; activity ordering, limit and actor names | integration | `tests/analyst-dashboard.integration.test.ts` | ❌ |
| D-21 | One fixture per lifecycle step lands in its literal bucket; oracle agreement; >1 page exact totals; held generation; outside-queue unchanged | integration + unit | `tests/review-queue-buckets.integration.test.ts`, `review-queue.unit.test.ts` (extend) | ❌/✅ |
| D-05, D-09, D-22 | Owner-scoped counts (jane ≠ other); birthright for analyst and agent own scope; web makes one read, and 403 means permission denied | integration + web unit | `tests/request-status-summary.integration.test.ts`; `requestor-dashboard.test.tsx` (extend) | ❌/✅ |
| D-04 (DR-1) | `treatmentDueState` projection; register shows "Overdue" only for the derived state | integration + web unit | `risk-register.integration.test.ts`, `risk-register.test.tsx` (extend) | ✅ |
| D-23 | Gates, reconcile idempotency, boot-relative re-anchoring | integration | `tests/analyst-insights-seed.integration.test.ts` | ❌ |
| D-16, D-17 | Denial before reads; five states; fixture state only after authorisation | web unit | route-content tests per page; `e2e-ui-state-route-authorization.test.tsx` (extend) | ❌/✅ |
| D-19, D-20 | Text equivalent, `aria-hidden` bars, no colour-only meaning, link tiles' accessible names | web unit | `components/csrm/{bar-chart,metric-card,alert-urgency-badge}.test.tsx` | ❌ |
| D-08 | Parsers accept minimal, maximal and nullable contract payloads | web unit | `contract-response-parity.test.ts` (extend + pinned list) | ✅ |
| D-15 | Exact-match active navigation | web unit | `mobile-navigation.test.tsx` (extend) | ✅ |
| D-25, DASH-01/02 | Dashboard → alert → source record; tile total equals list total; reports with text equivalents; Requestor and Secondary Requestor see no navigation and get denial | E2E | `apps/web/e2e/analyst-insights.spec.ts` | ❌ |
| D-17, D-25 | Axe-clean, no overflow at 375/1440 for 7 surfaces; `/app/alerts` in the design-contract `collectionSurfaces` | E2E | `accessibility.spec.ts`, `design-contract.spec.ts` (extend) | ✅ |

### Sampling Rate

- **Per task commit:** the touched Strapi test file (compile, then `node --test` that file) and/or `pnpm --filter @csrm/web test -- <pattern>`.
- **Per plan:** the full Strapi suite, full web suite, web typecheck and `api:check`.
- **Phase gate:** all of the above plus the full Playwright suite, about 17 minutes estimated. Run it with ports 1337 and 3000 free, then restore `next-env.d.ts` and `tsconfig.json`.

### Wave 0 Gaps

- [ ] Harness: widen the fixture helpers (request dates; release facts plus `nextReviewDate`; CI effectiveness and dates; questionnaire answers by state) and add a held-questionnaire-generation seam (Q3).
- [ ] Shared test helper: a `today`-relative date builder imported from `src/csrm/insights/utc-date.ts`.
- [ ] The new test files listed above. The E2E fixture keys are shared between `seed-analyst-insights.ts` and the spec constants.

## Security Domain

| ASVS | Applies | Control |
|---|---|---|
| V4 Access control | yes | Exact FunctionAPI grants, `HUMAN_ANALYST_ONLY_OPERATIONS`, `requireAnalystInsightScope` (which also requires the RR and review grants), the reused record scope predicates, the owner scope for the Requestor summary |
| V5 Validation | yes | Closed query keys (400); `kind`, `urgency`, `pageSize`, `period` and `reportKey` enums; Zod `.strict()` on the web |
| V7 Errors | yes | The safe `{status,message}` envelope; tests `doesNotMatch(/SQL\|stack\|database/)` as in existing suites |
| V8 Data protection | yes | Analyst-only aggregates. The Requestor sees only own-scope counts. Actor display names go to analysts only |
| V13 API | yes | Closed OpenAPI components, bounded arrays, page-size caps |

| Threat | STRIDE | Mitigation |
|---|---|---|
| An automation identity reads workload | Elevation | The human-only guard, independent of the catalogue |
| A report widens scope through parameters | Info disclosure | No grouping parameters beyond closed enums; SQL scope reuses the RR and review predicates |
| SQL injection through sort or filter | Tampering | Bound parameters; aliases and columns only from closed maps |
| Unbounded scan or pagination DoS | DoS | Page size in {10,25,50}, named caps with `truncated`, COUNT/UNION in SQL |
| A draft request leaks into alerts | Info disclosure | Reviewable statuses only (DR-4) |

## Recommended Plan Decomposition

Execution is sequential, one executor unit at a time, so waves express dependencies rather than parallelism. Each vertical plan changes its server shape, spec, generated client and closed parser together (D-08). A 07-UI-SPEC from the UI gate should precede plans 03, 09, 11 and 13.

| Wave | Plan | Scope (key files) | Depends on |
|---|---|---|---|
| 1 | 07-01 Grants and guard | Both catalogue copies (5 Functions, re-pointing, Requestor url, design note); policy guard and scope flag; policy unit test; catalogue-only parity block; seed idempotency test | — |
| 1 | 07-02 Pure rules | `src/csrm/insights/*` + `analyst-insights.unit.test.ts` | — |
| 1 | 07-03 Web primitives | `components/csrm/{metric-card,bar-chart,alert-urgency-badge}` + tests | UI-SPEC |
| 2 | 07-04 Requestor summary (D-05, D-22) | Assessment-request route and controller `statusSummary` (knex group-by); spec and regeneration; `request-service` parser; `requestor-dashboard-service`; tests | 07-01 |
| 2 | 07-05 D-21 buckets | `review-queue-repository.ts`, `activeRequestIds`, controller `find`, harness seam and helpers, `review-queue-buckets.integration` | 06.9-04 (landed `e14891e`) |
| 3 | 07-06 Alerts server and parser | `csrm-analyst-insight` routes (new) plus `controllers/alerts.ts`, `alert-repository.ts`, exported `applyDisclosableParent`, spec, regeneration, `features/alerts/alert-{schema,service}` + parity, `analyst-alerts.integration` | 07-01, 07-02, 07-05 (harness) |
| 3 | 07-07 D-04 Risk Register agreement (DR-1) | `RiskRegisterItem.treatmentDueState` (spec, projection, web parser, register cell), Phase 5 test updates | 07-02 |
| 3 | 07-08 Phase 7 seed fixture | `seed-analyst-insights.ts`, `index.ts`, seed integration test (gives the orchestrator deterministic dev data) | 07-02 |
| 4 | 07-09 Alerts screen | `/app/alerts` (+loading/error), filters, DataTable, badges, navigation item, route-content tests | 07-03, 07-06 |
| 4 | 07-10 Reports server and parsers | `controllers/reports.ts`, `report-repository.ts`, definitions, spec (union + 4 components), regeneration, report parsers (4 branches) + parity, `analyst-reports.integration` | 07-06 |
| 5 | 07-11 Reports screens | `/app/reports`, `/app/reports/[reportKey]`, report views with BarChart and text equivalents, navigation item, tests | 07-03, 07-10 |
| 5 | 07-12 Dashboard summary server and parser | `controllers/dashboard.ts`, `dashboard-summary.ts`, `recent-activity.ts`, spec, regeneration, parser + parity, `analyst-dashboard.integration` | 07-05, 07-06 |
| 6 | 07-13 Analyst dashboard screen | `/app/review` (+loading/error), tiles and links, top alerts, activity, residual chart, "Analyst dashboard" navigation item with exact-match rule | 07-09, 07-12 |
| 7 | 07-14 Browser evidence and gate | `e2e/analyst-insights.spec.ts`, accessibility and design-contract additions, `docs/contract-gaps/phase-07-derived-insights.md`, full gate | all |

## Sources

### Primary (HIGH confidence, verified in this session)

**Codebase:**
- Strapi policy and routes: `csrm-authorization.ts`, `collection-scope.ts`, `controllers/csrm-assessment-request.ts`, `request-lifecycle.ts`.
- Questionnaire workflow: `questionnaire-{scope,workflow,governance-workflow,generation-registry,generation-workflow}.ts`.
- Assessment and Risk: `assessment-workflow.ts`, `risk-register{,-query}.ts`, `risk-workflow.ts`.
- Bootstrap and tests: `seed-*.ts`, `strapi-http-harness.ts`, `contract-catalogue.integration.test.ts`.
- Catalogue and contract: both catalogue copies, `specification.json`.
- Web: `requestor-dashboard{,-service}.tsx`, `risk-schema.ts`, `navigation.ts`, `capability-navigation.tsx`, `contract-response-parity.test.ts`, `e2e-ui-state.ts`, `playwright.config.ts`, the E2E specs, `globals.css`.

**Database probes and knex source:**
- The dev database, read-only: row cardinality, storage types, D-21 facts, the UNION ordering, and datetime binding behaviour.
- knex 3.0.1 source: `dialects/better-sqlite3/index.js` (Date bindings), `sqlite3/.../sqlite-querycompiler.js` and `postgres/.../pg-querycompiler.js` (`whereJsonPath`).
- A tsc probe of the `Database["connection"]` typing.

**Next and design authority:**
- Next 16.3.3 bundled docs (`03-file-conventions/{dynamic-routes,page,loading,error}.md`) and runtime `client/components/error-boundary.js`.
- `docs/design/csrm-design-direction.md` §3.5, §3.6, §3.14 and §4, and `docs/adr/0001-adopt-bproton-design-system.md` gaps 1–3.

### Secondary

- Evidence for A1: dev-database Function duplication counts.
- `docs/CSRM-PROJECT-BRIEF.md` §10 and §15 (Security Analyst dashboard focus; `MetricCard`, `ActivityTimeline` names).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new; versions read from `node_modules`.
- Architecture and SQL: HIGH on SQLite, since every shape was prototyped. MEDIUM for PostgreSQL (A2).
- Pitfalls: HIGH. Each one was reproduced or cited to a file and line.
- Decision risks: HIGH evidence; the choices need the orchestrator's confirmation.

**Research date:** 2026-09-24, against `dev` at `e14891e`. **Valid until:** 2026-10-24, or until `collection-scope.ts`, the harness or the catalogue change again.
