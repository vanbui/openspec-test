# Phase 7: Analyst Dashboard, Reports, and Alerts - Context

> **Superseded instruction (2026-09-26).** Every instruction in this document to restore `apps/web/next-env.d.ts` and `apps/web/tsconfig.json` with `git checkout --` after a Playwright run no longer applies. Phase 8 D-12 untracked `next-env.d.ts` (a checkout of it now fails with `pathspec did not match`) and stopped a run from rewriting `tsconfig.json`, so a run leaves the tree clean. A dirty tree after a run is a harness defect to fix at its source, never something to restore.

**Gathered:** 2026-09-24
**Status:** Ready for planning
**Mode:** discuss-phase auto; the orchestrator answered every gray area from the operator's build-out steer, the ROADMAP, and the repository's locked decisions.

<domain>
## Phase Boundary

Give the Security Analyst a data-driven workload view: an analyst dashboard covering review queues, high and critical risks, overdue treatments, due dates, recent activity and alerts, plus dedicated Reports and Alerts screens (DASH-01, DASH-02). Every number is derived server-side by Strapi from records that already exist; nothing is hard-coded, persisted as a new entity, or computed from a partial page in the browser. The phase also closes two carried-forward follow-ups that live on the same surfaces: the review-queue bucket classification's 1,000-row scan bound, and the Requestor dashboard's seven extra list reads.

Out of scope: persisted alerts, alert acknowledgement, report export, notifications (NOTIFY-01 is v2), Keycloak, and any Strapi content-type schema change.
</domain>

<decisions>
## Implementation Decisions

### Derivation and data (no new entities)

- **D-01:** The JDL has no Alert, Notification, Report, Activity or Audit entity (catalogue design note 5). Every dashboard figure, alert, report row and activity item is **computed on read** by Strapi from existing fields: request `dueDate`, `submittedDate`, `requestStatus`, revert facts; questionnaire `generatedDate`, `releasedAt`/`releasedBy`, `governanceLog` events; assessment `assessmentStatus`, `generatedDate`, `approvalDate`/`approvedBy`, `nextReviewDate`; Risk `inherentRating`, `residualRating`, `treatmentStatus`, `treatmentAction`, `targetDate`, `closureDate`; ControlImplementation `controlStatus`, `effectivenessRating`, `implementationDueDate`. No content-type schema changes. If a genuinely required fact is missing, stop and record it under `docs/contract-gaps/` instead of inventing a field.
- **D-02:** Derivation rules live in pure, unit-tested Strapi domain modules (no Strapi calls inside them) that take an explicit `today` (UTC calendar date) so every rule is deterministic under test. Controllers and repositories only load bounded inputs and project closed DTOs. The web layer never derives a metric from raw records.
- **D-03:** Aggregates use database-level counts and group-bys (the Risk Register's knex repository is the precedent) or bounded, ordered queries. No handler loads an unbounded collection into memory. Where a list is capped, the cap is a named constant and the response says the list is truncated rather than presenting a partial count as a total.
- **D-04:** Treatment due-state is derived, never read from the stored `treatmentStatus = "Overdue"` value (nothing on the server sets it): a Risk is **overdue** when `targetDate < today`, `treatmentStatus ≠ Complete` and `closureDate` is empty; **due soon** when `targetDate` falls within a named window (default 14 days) under the same conditions. The web's existing overdue flag (`apps/web/src/features/risks/risk-schema.ts:335-338`) must agree with the server rule; one definition, cited by both.

### Endpoints, grants and contract

- **D-05:** Serve exactly these catalogue-reserved operations, all read-only, all human Security Analyst only: `GET /api/v1/dashboard/summary`, `GET /api/v1/alerts`, `GET /api/v1/alerts/summary`, `GET /api/v1/reports`, `GET /api/v1/reports/{reportKey}`. Plus one Requestor-birthright operation, `GET /api/v1/my_requests/status_summary` (the catalogue-reserved path; see D-28) (owner-scoped counts by `requestStatus`), mirroring `GET /api/v1/my_questionnaires/status_summary`.
- **D-06:** Do **not** serve `GET /api/v1/dashboard/reports`, `GET /api/v1/dashboard/alerts`, `GET /api/v1/alerts/{alertId}`, `PATCH /api/v1/alerts/{alertId}/acknowledge`, or `POST /api/v1/reports/{reportKey}/export`. They stay catalogued and unserved, with the reason recorded in the catalogue design notes and the phase summary: dashboard reports and alerts are redundant with the dedicated operations; derived alerts link straight to their source record, so an alert detail read adds nothing; acknowledgement needs persisted per-analyst state (a datamodel change, deferred); export is deferred beyond this milestone.
- **D-07:** Grants follow the Phase 06.8-01 precedent exactly (`b4f3d88`): one API-only Function per served analyst FunctionAPI, `roleIds: ["role.security_analyst"]`, no `menuPath`, no Requestor and no `role.security_analyst_agent` grant, re-pointing the existing reserved FunctionAPI entries to those Functions. The menu Functions (`Dashboard:Dashboard`, `Reports:Reports`, `Reports:Alerts`) remain as UI functions but carry no served analyst API. The operations are added to the human-analyst-only enforcement in `apps/strapi/src/policies/csrm-authorization.ts` so the service agent is refused even if a grant were misconfigured. The docs and bootstrap catalogue copies stay byte-identical, and the contract-catalogue integration test covers every new operation.
- **D-08:** Each operation is published in `docs/references/specification.json` with closed schemas (`additionalProperties: false`, closed enums, bounded arrays), the web client regenerated (`api:generate`, `api:check` clean), responses parsed by closed Zod schemas, and every new service module registered with the contract-to-client parity guard (`apps/web/src/features/contract-response-parity.test.ts`). Server shape and client parser change in the same plan.
- **D-09:** Denial is proven at the Strapi layer for the Requestor, the Secondary Requestor and the service agent on every analyst operation, and owner-scoping is proven for the Requestor status summary (a second Requestor's records never count).

### Alerts

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

### Reports

- **D-13:** A closed set of report keys, each a server-computed, read-only projection with no caller-supplied grouping beyond closed enums:
  - `risk-exposure` — contextual Risks by residual rating and by inherent rating, crossed with treatment status; the Information Systems carrying the most High and Critical residual Risks (bounded list).
  - `treatment-performance` — treatments by due state (overdue, due within 30 days, later, no target date) and by treatment status; the most overdue Risks (bounded list, oldest first).
  - `assessment-throughput` — requests by lifecycle state; assessments released per calendar month over a closed period choice (6 or 12 months); median days from request submission to release where both facts exist.
  - `control-effectiveness` — ControlImplementations by `controlStatus` and by `effectivenessRating`.
  `GET /api/v1/reports` lists these definitions (key, title, description) so the Reports index is data-driven.
- **D-14:** Report and dashboard figures scope to exactly what the human analyst's existing grants can read (the Risk Register and review scopes); a report never widens scope.

### Web surfaces

- **D-15:** Routes: the analyst dashboard at `/app/review` (the parent of the existing analyst review queues), Alerts at `/app/alerts`, Reports at `/app/reports` with each report at `/app/reports/[reportKey]`. `/app` stays the owner-scoped personal dashboard for every actor, unchanged in role; seven E2E specs and the 06.3 separation of owner and analyst scopes depend on it.
- **D-16:** Navigation and page presentation are gated by the existing `assessment:review` capability (presentation only — Strapi stays authoritative). No new capability is introduced; a Requestor reaching a route directly sees the shared permission-denied state and issues no analyst reads.
- **D-17:** Every new surface honours the five-state contract (loading skeletons, empty, populated, error with "Try again", permission denied) through the shared state primitives, works from 375px to 1440px, is axe-clean at both widths, and meets WCAG 2.2 AA.
- **D-18:** KPI tiles follow the design direction (§4 "Cards / KPI tiles": micro caption, display-size tabular value, optional delta). A delta appears only when the server supplies an honest comparison period; none is fabricated. Each tile that summarises a list links to that list, pre-filtered where a filter exists (for example the review queue bucket, the Risk Register residual-rating filter, the Alerts urgency filter).
- **D-19:** Charts follow ADR 0001 gap 3 and design direction §3.14: ink ramp (`--chart-1`, `--chart-2`, `--chart-grid`) with direct labels, severity charts in the §3.6 risk tokens, more than two series separated by pattern or dash plus labels, never a new hue. Meaning never depends on colour: every chart has a text equivalent (a data table or labelled values) available to assistive technology and visible on demand. **No charting dependency**: a small accessible bar primitive in `apps/web/src/components/csrm/` (HTML or SVG) covers the needed bar and column charts; add a library only if a plan proves a concrete need.
- **D-20:** Reuse before creating: the Requestor dashboard widget structure (`features/dashboard/requestor-dashboard.tsx`), `DataTable`, `RecordLink`, `StatusBadge`, `RiskRatingBadge`, `PageHeader`, and the state primitives. Any new shared primitive (KPI tile, bar chart) goes in `components/csrm` with its own tests and is consumed by at least the dashboard and one report.

### Carried-forward follow-ups (same surfaces)

- **D-21:** Review-queue buckets: remove the 1,000-row scan bound in `csrm-assessment-request/controllers/csrm-assessment-request.ts:57-108`. Express each bucket as a database-level predicate over `requestStatus` and the derived lifecycle facts, applying the in-memory generation-job registry as a bounded id-set predicate, so the page, the total and the dashboard's bucket counts come from one shared bucket definition and stay exact at any volume.
- **D-22:** The Requestor dashboard replaces its seven per-status `listDashboardRequests` reads (`requestor-dashboard-service.ts:163-172`) with one read of `GET /api/v1/my_requests/status_summary`. Behaviour and copy of the lifecycle cards are unchanged.

### Testing and fixtures

- **D-23:** A dedicated Phase 7 seed fixture (gated on `IDAMBOX_SEED_CSRM` plus the established development identity flags) creates records whose dates are relative to the boot date, so overdue, due-soon and review-due conditions exist deterministically in a fresh E2E database. It never reuses a fixture another spec mutates.
- **D-24:** Strapi integration tests assert exact derived values over controlled fixtures, including window boundaries (due today, due in exactly N days, overdue by one day), closed/complete exclusions, and scope. Browser tests never assert global totals, because other specs create records during a run; they assert fixture membership, consistency between a tile and the list it links to, actor-correct links, and denial.
- **D-25:** A dual-actor E2E journey covers: analyst dashboard → alert → source record; each report renders with its text equivalent; Requestor and Secondary Requestor see no analyst navigation and get the permission-denied state on direct URLs. The accessibility spec gains every new surface at 375px and 1440px. Sign-in helpers assert the shell (Dashboard heading and role banner), never the URL.

### Post-research decisions (orchestrator, 2026-09-24, resolving 07-RESEARCH.md "Decision Risks")

- **D-26 (DR-1):** D-04 agreement is achieved by adding a server-derived `treatmentDueState` (`overdue | due-soon | later | no-target-date | complete-or-closed`) to the Risk Register item projection, computed by the shared insight rule. The web renders that value and `isRiskOverdue` is retired. Existing Phase 5 key-set and presentation tests are updated deliberately.
- **D-27 (DR-2):** Release immutability is unchanged. Alerts on released work state facts ("Target date passed 12 days ago") and show that the source is released and read-only. The missing post-release treatment tracking is recorded in `docs/contract-gaps/phase-07-derived-insights.md` for a later decision.
- **D-28 (DR-3), amends D-05:** serve the catalogue's already-reserved `GET /api/v1/my_requests/status_summary` (`function.risk_assessment_requests.my_requests.api.02`) instead of inventing `my_assessment_requests`. The catalogue reserves exactly this operation for exactly this purpose, so the authoritative reference stays unchanged apart from grants.
- **D-29 (DR-4):** request alerts consider only the four reviewable request statuses; drafts are outside the analyst scope and never produce an alert.
- **D-30 (DR-5):** keep the semantic bucket rule; add an equivalence test with one fixture per lifecycle step and document the malformed-definition divergence.
- **D-31 (DR-6):** `critical-residual-risk-untreated` counts a NULL `treatmentStatus` as untreated (no treatment is recorded). The treatment due-state kinds follow D-04 literally, with NULL handled explicitly as "not Complete" (never by a bare SQL `<>` that drops NULLs). `control-implementation-overdue` also requires an open parent Risk, matching `ineffective-control`.
- **D-32 (DR-7):** the High and Critical residual tiles count exactly what the linked, filtered Risk Register shows (closed Risks included), are labelled as residual-rating counts, and link to that filter.
- **D-33 (DR-8):** API-only Function names are distinct from the menu Function names; a seed idempotency test proves no duplicate on re-boot.
- **D-34 (dashboard composition):** `dashboard/summary` carries bucket, residual and treatment counts plus recent activity; the dashboard reads `alerts/summary` and a bounded `alerts` page in parallel, so each widget fails independently.
- **D-36 (07-UI-SPEC UI-D1), supersedes D-32:** exposure figures count **open** contextual Risks (no `closureDate`), consistent with D-04 and D-10. The Risk Register gains a closed `state` filter (`open | closed`, absent = all) through the same contract path as its other filters (spec, server predicate, canonical URL query, web filter control), so every exposure tile and row links to a list with an equal total. No schema change: `closureDate` exists.
- **D-37 (07-UI-SPEC X-1..X-13):** all thirteen proposed extensions are accepted and recorded in `docs/design/csrm-design-direction.md` (§3.14 chart geometry and marks; §4 segmented control, KPI tile additions, cleared empty state, urgency vocabulary, block-link cue). The UI-SPEC's other decisions (UI-D2..UI-D20) stand, including the navigation group, the single-current-item rule, the scrolling mobile sheet and `scroll-padding-top`, per-route `loading.tsx`/`error.tsx`, and the `#mitigation-controls` anchor.
- **D-35 (plan shape):** the research's 14-unit decomposition is consolidated into at most nine vertical plans, each crossing server shape, spec, generated client, closed parser and tests together where it touches the contract. Recommended grouping: (1) grants, guard, catalogue and the pure insight rules; (2) Requestor status summary plus the Risk Register `treatmentDueState`; (3) D-21 buckets; (4) alerts server and parser plus the Phase 7 seed fixture; (5) shared primitives plus the Alerts screen; (6) reports server and parsers; (7) Reports screens; (8) dashboard summary server, parser and the `/app/review` screen; (9) browser evidence, accessibility and design-contract coverage, the contract-gap record, and the full gate.

### the agent's Discretion

- Exact DTO field names, module decomposition, report row caps, and named thresholds (keep them named constants with tests).
- Whether the dashboard composes `dashboard/summary` with a bounded `alerts` read, or `dashboard/summary` embeds the top alerts — either is fine if the counts share one predicate.
- Tile order and widget layout, within the UI-SPEC.

</decisions>

<specifics>
## Specific Ideas

- The operator's quality bar: clean, minimal, premium (Linear, Vercel, Stripe calibre), holding up across dense tables, badges and dashboards. The dashboard should answer "what needs me now?" within three seconds: action counts first, then risk exposure, then time-bound work, then recent activity.
- Reports read as calm, printable-looking pages: a serif page title, micro-label section captions, ink charts with direct labels, and a compact table beside or below each chart.
- Alerts read like an inbox without state: newest-most-urgent first, each row names the condition in words ("Treatment overdue by 12 days"), the source record, and the date that drives it.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product, domain and API authority
- `docs/CSRM-PROJECT-BRIEF.md` — product scope; dashboard, reports and alerts intent.
- `docs/references/specification.json` — authoritative OpenAPI contract; every new operation is declared here first.
- `docs/references/idambox-datamodel.jdl` — domain terms and the fields D-01 derives from.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` — reserved Phase 7 FunctionAPIs (`function.dashboard.dashboard`, `function.reports.reports`, `function.reports.alerts`) and design note 5.
- `.planning/REQUIREMENTS.md` — DASH-01, DASH-02.

### Established patterns to mirror
- Commit `b4f3d88` (Phase 06.8-01) — API-only Function per analyst FunctionAPI, policy wiring, catalogue test coverage.
- `apps/strapi/src/policies/csrm-authorization.ts` — human-analyst-only enforcement (`hasHumanAnalystOperation`, `HUMAN_ANALYST_ONLY_OPERATIONS`).
- `apps/strapi/src/api/csrm-risk/services/risk-register-query.ts` — database-level filtering, severity ordering and bounded hydration.
- `apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts` and `controllers/csrm-assessment-request.ts:57-108` — current bucket rules and the scan bound D-21 removes.
- `apps/web/src/features/dashboard/requestor-dashboard.tsx` and `requestor-dashboard-service.ts` — widget and service structure; the seven reads D-22 removes.
- `apps/web/src/features/contract-response-parity.test.ts` — parity guard every new service joins.

### Design authority
- `docs/design/csrm-design-direction.md` — sole source of UI values: §3.5 status, §3.6 risk scale, §3.10 type, §3.14 data visualisation, §4 KPI tiles, DataTable, badges, states, record links.
- `docs/adr/0001-adopt-bproton-design-system.md` — gap 3 (charts), gap 1 and 2 (status and risk colours).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Shared state primitives (`apps/web/src/components/states/states.tsx`), `DataTable` (`components/csrm/data-table.tsx`), `RecordLink`, `StatusBadge`, `RiskRatingBadge`, `PageHeader`, `nativeSelectClassName`.
- Owner-scoped summary precedents: `GET /v1/my_questionnaires/status_summary`, `GET /v1/my_risk_assessments/rating_summary` (closed `{Low, Moderate, High, Critical, total}`).
- Analyst summaries that already exist: `GET /v1/risk_assessments/status_summary`, `GET /v1/questionnaires/review_summary`.

### Established Patterns
- Analyst and owner scopes are separate routes and separate operations (Phase 06.3).
- Related records are absent, unavailable or available; only available ones link (Phase 06.4).
- Unauthorised assessment reads answer 404 by design; do not assert a permission state on that path.
- Playwright rewrites `apps/web/next-env.d.ts` and `apps/web/tsconfig.json`; restore both after every run.

### Integration Points
- Navigation: `apps/web/src/config/navigation/navigation.ts` and `components/shell/capability-navigation.tsx`.
- Capability guard: `apps/web/src/lib/capabilities/server-guard.ts` (`requireCapability`).
- Seeds: `apps/strapi/src/bootstrap/seed-csrm-data.ts` (Functions, FunctionAPIs, Roles; bob is the human analyst, jane and maya are Requestors).

</code_context>

<deferred>
## Deferred Ideas

- Persisted alerts and per-analyst acknowledgement — needs a datamodel extension and a `docs/contract-gaps/` record; not this milestone.
- Report export (`POST /api/v1/reports/{reportKey}/export`) — deferred beyond this milestone.
- Notifications for workflow events and due dates — NOTIFY-01 (v2).
- A Requestor-facing alerts view — the catalogue grants alerts to analysts only.

</deferred>

---

*Phase: 07-analyst-dashboard-reports-and-alerts*
*Context gathered: 2026-09-24*
