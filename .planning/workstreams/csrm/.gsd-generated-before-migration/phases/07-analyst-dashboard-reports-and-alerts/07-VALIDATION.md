---
phase: 07
slug: analyst-dashboard-reports-and-alerts
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-24
completed: 2026-09-25
---

> **Superseded instruction (2026-09-26).** Every instruction in this document to restore `apps/web/next-env.d.ts` and `apps/web/tsconfig.json` with `git checkout --` after a Playwright run no longer applies. Phase 8 D-12 untracked `next-env.d.ts` (a checkout of it now fails with `pathspec did not match`) and stopped a run from rewriting `tsconfig.json`, so a run leaves the tree clean. A dirty tree after a run is a harness defect to fix at its source, never something to restore.

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `07-RESEARCH.md` §"Validation Architecture". It maps every requirement and every locked decision (D-01 to D-37) to an automated check and the plan that creates it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Strapi: `node:test`, compiled by `tsc -p tests/tsconfig.json`, one process and one SQLite database per test file. Web: vitest 4.0.18 (jsdom). E2E: Playwright 1.58.2 with @axe-core/playwright 4.11.0. |
| **Config files** | `apps/strapi/tests/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Node** | Every command is prefixed `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" &&` (Node 24.19.0) |
| **Quick run: Strapi file** | `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/strapi && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js` |
| **Quick run: web** | `pnpm --filter @csrm/web test -- <pattern>` |
| **Full suite** | `pnpm --filter @csrm/strapi test`; `pnpm --filter @csrm/web test`; `pnpm --filter @csrm/web typecheck`; `pnpm --prefix apps/web api:check` |
| **Phase gate** | The full suite plus `pnpm --filter @csrm/web test:e2e` (full, in the background), with ports 1337 and 3000 free. Then `git checkout -- apps/web/next-env.d.ts apps/web/tsconfig.json`. |
| **Estimated runtime** | Strapi file: 10-90 s. Web file: under 20 s. Full Strapi: about 6-9 min. Full web: about 2-3 min. Full Playwright: about 17-20 min. |

**Known infrastructure fact (recorded by plan 01).** `tests/authorization.policy.test.js` is passed to `node --test` as `dist/tests/authorization.policy.test.js`. No build step emits that file, and Node 24 treats a test argument as a glob, so the pattern is skipped silently: the file never runs. Phase 7's policy proofs therefore live in `apps/strapi/tests/analyst-insight-authorization.unit.test.ts`, which is compiled and runs every time.

---

## Sampling Rate

- **After every task commit:** run the touched Strapi test files (quick run) and the matching web patterns.
- **After every plan:** run the full Strapi suite, the full web suite, the web typecheck and `api:check`. Plans 05, 07 and 08 also run their targeted Playwright specs.
- **Before `$gsd-verify-work`:** plan 09 runs the full Playwright suite, and it must be green.
- **Max feedback latency:** 90 s per task-level Strapi file. Targeted Playwright runs only at the end of a UI plan.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DASH-01, DASH-02 | — | Rules are deterministic for an explicit UTC today, and NULL status is never dropped | unit | quick run `analyst-insights.unit.test.js` | ❌ W0 (created in the task) | ✅ green |
| 07-01-02 | 01 | 1 | DASH-01, DASH-02 | T-07-01-01, -02, -03 | The automation agent is refused even when mis-granted, an insight never widens scope, and the catalogue copies are identical | unit + static | quick run `analyst-insight-authorization.unit.test.js`; `contract-catalogue.integration.test.js`; `cmp` of the two catalogue copies | ❌ W0 / ✅ | ✅ green |
| 07-01-03 | 01 | 1 | DASH-01, DASH-02 | T-07-01-04 | No duplicate grants after re-seeding | integration | quick run `analyst-insight-catalogue-seed.integration.test.js`; plan gate | ❌ W0 | ✅ green |
| 07-02-01 | 02 | 2 | DASH-01 | T-07-02-01, -02 | The Requestor summary counts only the caller's own records | integration + web unit | `request-status-summary.integration.test.js`; `pnpm --filter @csrm/web test -- requestor-dashboard request-service contract-response-parity` | ❌ W0 / ✅ | ✅ green |
| 07-02-02 | 02 | 2 | DASH-01 | T-07-02-05 | The overdue marker follows the server state only | unit + integration + web unit | `risk-register.unit.test.js`; `risk-register.integration.test.js`; `pnpm --filter @csrm/web test -- risk-schema risk-register` | ✅ | ✅ green |
| 07-02-03 | 02 | 2 | DASH-01 | T-07-02-03 | The `state` enum is closed, with constant SQL | unit + integration + web unit | plan gate (full suites and `api:check`) | ✅ | ✅ green |
| 07-03-01 | 03 | 1 | DASH-01 | T-07-03-03 | The active-id snapshot is bounded and fails closed | unit | quick run `review-queue.unit.test.js` and `questionnaire-generation.unit.test.js` | ✅ | ✅ green |
| 07-03-02 | 03 | 1 | DASH-01 | T-07-03-02 | Queue membership is pinned per lifecycle step; RED beyond 1,000 rows | integration (RED) | quick run `review-queue-buckets.integration.test.js` | ❌ W0 | ✅ green |
| 07-03-03 | 03 | 1 | DASH-01 | T-07-03-01, -02, -04 | Exact buckets at any volume; no draft; outside-queue reads nothing | integration | `review-queue-buckets.integration.test.js`; unchanged `assessment-workflow.integration.test.js`; plan gate | ✅ | ✅ green |
| 07-04-01 | 04 | 3 | DASH-01, DASH-02 | T-07-04-01, -02, -03, -04, -06 | Six-identity denial; drafts and partially released parents excluded; bound SQL | unit + integration | quick run `analyst-alert-query.unit.test.js`; `analyst-alerts.integration.test.js` | ❌ W0 | ✅ green |
| 07-04-02 | 04 | 3 | DASH-01, DASH-02 | — | Closed parsers with no narrowing | static + web unit | `contract-catalogue.integration.test.js`; `pnpm --filter @csrm/web test -- alert-schema alert-service contract-response-parity`; `api:check` | ❌ W0 / ✅ | ✅ green |
| 07-04-03 | 04 | 3 | DASH-01, DASH-02 | T-07-04-05 | The seed is inert outside the development gates | integration | quick run `analyst-insights-seed.integration.test.js`; plan gate | ❌ W0 | ✅ green |
| 07-05-01 | 05 | 4 | DASH-02 | — | Text equivalents; no colour-only meaning | web unit | `pnpm --filter @csrm/web test -- kpi-tile bar-chart segmented-control` | ❌ W0 | ✅ green |
| 07-05-02 | 05 | 4 | DASH-02 | — | Navigation visibility is not authorization; one current item | web unit | `pnpm --filter @csrm/web test -- alert-urgency-badge states mobile-navigation` | ✅ (extended) | ✅ green |
| 07-05-03 | 05 | 4 | DASH-02 | T-07-05-01, -02, -03, -04 | The capability check precedes every read; fixtures resolve after authorisation | web unit | `pnpm --filter @csrm/web test -- alert-presentation alert-list alerts-page e2e-ui-state-route-authorization risk-register risk-details` | ❌ W0 / ✅ | ✅ green |
| 07-05-04 | 05 | 4 | DASH-02 | T-07-05-01 | Browser denial for both Requestor identities | E2E (targeted) | `pnpm --filter @csrm/web test:e2e e2e/analyst-insights.spec.ts e2e/app-shell.spec.ts e2e/risk-register-workflow.spec.ts e2e/requestor-request-workflow.spec.ts e2e/assessment-navigation-lifecycle.spec.ts`; plan gate | ❌ W0 | ✅ green |
| 07-06-01 | 06 | 4 | DASH-02 | T-07-06-01, -02, -03, -05 | Reports never widen scope; key probing is refused by the policy first | integration | quick run `analyst-reports.integration.test.js` | ❌ W0 | ✅ green |
| 07-06-02 | 06 | 4 | DASH-02 | T-07-06-04 | Capped samples are flagged as truncated | unit + integration | `analyst-insights.unit.test.js`; `analyst-reports.integration.test.js` | ✅ | ✅ green |
| 07-06-03 | 06 | 4 | DASH-02 | — | Closed branch parsers | static + web unit | `pnpm --filter @csrm/web test -- report-schema report-service contract-response-parity`; plan gate | ❌ W0 / ✅ | ✅ green |
| 07-07-01 | 07 | 5 | DASH-02 | — | No read without the capability | web unit | `pnpm --filter @csrm/web test -- reports-pages mobile-navigation e2e-ui-state-route-authorization` | ❌ W0 / ✅ | ✅ green |
| 07-07-02 | 07 | 5 | DASH-02 | T-07-07-01, -02, -03 | Report key validity is never disclosed to non-analysts | web unit | `pnpm --filter @csrm/web test -- reports-pages report-views report-presentation` | ❌ W0 | ✅ green |
| 07-07-03 | 07 | 5 | DASH-02 | — | The partial month is marked by a dash and text, never colour alone | web unit | `pnpm --filter @csrm/web test -- report-views report-presentation reports-pages segmented-control` | ✅ | ✅ green |
| 07-07-04 | 07 | 5 | DASH-02 | T-07-07-01 | Identical denial and title for every report URL | E2E (targeted) | `pnpm --filter @csrm/web test:e2e e2e/analyst-insights.spec.ts e2e/app-shell.spec.ts`; plan gate | ✅ | ✅ green |
| 07-08-01 | 08 | 6 | DASH-01 | T-07-08-01, -03, -04 | Dashboard figures equal their lists and stay in scope | integration | quick run `analyst-dashboard.integration.test.js` | ❌ W0 | ✅ green |
| 07-08-02 | 08 | 6 | DASH-01 | T-07-08-01, -02 | Activity stays in scope; actor names reach analysts only | unit + integration + static + web unit | `analyst-insights.unit.test.js`; `analyst-dashboard.integration.test.js`; `contract-catalogue.integration.test.js`; `pnpm --filter @csrm/web test -- analyst-dashboard-service contract-response-parity`; `api:check` | ✅ | ✅ green |
| 07-08-03 | 08 | 6 | DASH-01 | T-07-08-05 | Independent widgets; the partial fixture only in the attested runtime | web unit | `pnpm --filter @csrm/web test -- analyst-dashboard e2e-ui-state mobile-navigation` | ❌ W0 / ✅ | ✅ green |
| 07-08-04 | 08 | 6 | DASH-01 | T-07-08-02 | Browser denial; the review children are undisturbed | E2E (targeted) | `pnpm --filter @csrm/web test:e2e e2e/analyst-insights.spec.ts e2e/app-shell.spec.ts e2e/assessment-navigation-lifecycle.spec.ts e2e/accessibility.spec.ts`; plan gate | ✅ | ✅ green |
| 07-09-01 | 09 | 7 | DASH-01, DASH-02 | T-07-09-01 | Five URLs denied to two identities | E2E (executed in 07-09-03's full run) | `pnpm --filter @csrm/web typecheck`; `pnpm --filter @csrm/web exec playwright test --list e2e/analyst-insights.spec.ts` | ✅ | ✅ green |
| 07-09-02 | 09 | 7 | DASH-01, DASH-02 | — | Axe-clean at 375 and 1440; five-state matrix | E2E (executed in 07-09-03's full run) | `pnpm --filter @csrm/web typecheck`; `pnpm --filter @csrm/web exec playwright test --list e2e/accessibility.spec.ts e2e/design-contract.spec.ts e2e/design-system-conformance.spec.ts` | ✅ | ✅ green |
| 07-09-03 | 09 | 7 | DASH-01, DASH-02 | T-07-09-02, -03 | The gate is evidenced; harness files restored | full gate | Full Strapi, web, typecheck, `api:check` and full `test:e2e`; freeze check; `cmp` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement and Decision Traceability

Every row names the automated proof and the plan that creates it. "Mounted" means the Strapi HTTP harness (`startAuthorizationHttpHarness`).

| Item | What must hold | Automated proof | Plan |
|------|----------------|-----------------|------|
| DASH-01 | Data-driven review queues, High and Critical Risks, overdue treatments, due dates, recent activity and alerts | `analyst-dashboard.integration.test.ts`; `review-queue-buckets.integration.test.ts`; `analyst-alerts.integration.test.ts`; `analyst-insights.spec.ts` (dashboard slice and journey) | 03, 04, 08, 09 |
| DASH-02 | Reports and alerts through authorised, responsive screens | `analyst-alerts.integration.test.ts`; `analyst-reports.integration.test.ts`; `alerts-page.test.tsx`; `reports-pages.test.tsx`; `analyst-insights.spec.ts`; `accessibility.spec.ts` | 04, 05, 06, 07, 09 |
| D-01 | Computed on read; no schema change; gaps recorded | `git diff --name-only … content-types` empty at every plan gate; `phase-07-derived-insights.md` exists | 01-09, 09 |
| D-02 | Pure rules with explicit today | `analyst-insights.unit.test.ts` literal cases; `grep "@strapi" src/csrm/insights` empty | 01 |
| D-03 | Database aggregates; named caps; truncated flags | Beyond-1,000 queue test; exposed-systems, High/Critical and activity truncation tests | 03, 06, 08 |
| D-04 | One treatment due-state definition that server and web agree on | Due-state unit literals; `risk-register.integration.test.ts` `treatmentDueState`; the web marker test; `isRiskOverdue` absent | 01, 02 |
| D-05 | Exactly the six served operations | Catalogue and spec blocks per operation; D-06 paths absent | 02, 04, 06, 08 |
| D-06 | Five unserved operations stay catalogued, with reasons | Catalogue test: D-06 URLs present, absent from the spec, design note present | 01 |
| D-07 | API-only Functions, the human-only guard, identical copies | `analyst-insight-authorization.unit.test.ts` (mis-granted agent); contract-catalogue Phase 7 grants block; `cmp` | 01 |
| D-08 | Closed spec, regenerated client, closed Zod, parity registration | `contract-response-parity.test.ts` (pinned list plus minimal, maximal and nullable instances); `api:check` | 02, 04, 06, 08 |
| D-09 | Denial of the Requestor, the second Requestor and the agent; owner scoping | The six-identity matrix in the alerts, reports and dashboard integration tests; `request-status-summary.integration.test.ts` | 02, 04, 06, 08 |
| D-10 | Eight derived kinds, deterministic ids, source references | Alert rule oracles (unit) plus the literal 14-alert list (mounted) | 01, 04 |
| D-11 | Urgency vocabulary distinct from severity | `alert-urgency-badge.test.tsx` (icons disjoint from severity, "Urgency:" prefix) | 01, 05 |
| D-12 | Paginated, filterable, sorted; the summary over the same predicate | List total equals summary per kind and urgency (mounted); `alert-list.test.tsx` | 04, 05 |
| D-13 | Four report keys and a data-driven index | `analyst-reports.integration.test.ts`; `reports-pages.test.tsx` | 06, 07 |
| D-14 | Never widens scope | Fixtures RP, AP, Q6, CI2, G and H excluded (mounted); `requireAnalystInsightScope` unit cases | 01, 04, 06, 08 |
| D-15 | Route placement; `/app` unchanged | Route tests; `requestor-dashboard.test.tsx` copy unchanged; the E2E `/app` sign-in helper | 05, 07, 08 |
| D-16 | Capability-gated presentation; denial without reads | Route-content tests (`listAlerts`, `listReportDefinitions`, `getReport` and the dashboard reads never called); E2E denial matrix | 05, 07, 08, 09 |
| D-17 | Five states, 375-1440, axe-clean | `design-system-conformance.spec.ts` Phase 7 matrix; `accessibility.spec.ts` Phase 07 test | 05, 07, 08, 09 |
| D-18 | KPI tile anatomy, no fabricated delta, links to equal lists | `kpi-tile.test.tsx`; tile-to-list equality in the E2E and in the mounted dashboard test | 05, 07, 08 |
| D-19 | Ink and severity charts with text equivalents; no dependency | `bar-chart.test.tsx` (`aria-hidden`, no focusables, `fg` tones); `report-views.test.tsx` tables; no new package in `package.json` | 05, 07 |
| D-20 | Reuse; new primitives in `components/csrm`, used by the dashboard and a report | Primitive tests; imports from both `analyst-dashboard.tsx` and the report views | 05, 07, 08 |
| D-21 | Exact buckets at any volume; one shared counter | `review-queue-buckets.integration.test.ts` (beyond 1,000, held generation, `countReviewQueueBucketFixture`); dashboard equality | 03, 08 |
| D-22 | One Requestor summary read | `requestor-dashboard.test.tsx` (`listDashboardRequests` once, summary once) | 02 |
| D-23 | Dedicated boot-relative fixture | `analyst-insights-seed.integration.test.ts` (gates, idempotency, re-anchoring, all eight kinds) | 04 |
| D-24 | Exact server values; no global totals in the browser | Literal mounted assertions; the E2E asserts membership and same-test equality only | 04, 06, 08, 05, 07, 09 |
| D-25 | Dual-actor journey; accessibility at both widths; shell-asserting sign-in | `analyst-insights.spec.ts` journey and denial; `accessibility.spec.ts` | 09 (slices in 05, 07, 08) |
| D-26 | Server `treatmentDueState`; `isRiskOverdue` retired | `risk-register.integration.test.ts` key set; the web grep gate | 02 |
| D-27 | Released-work alerts state facts and show "Released · read-only"; gap recorded | `source.released` (mounted); `alert-presentation.test.ts`; E2E released row; gap doc | 04, 05, 09 |
| D-28 | Serve the reserved `my_requests/status_summary` | Catalogue block (Requestor grant via `my_requests.api.02`); mounted test | 02 |
| D-29 | Request alerts only for reviewable statuses | Unit oracle; mounted Q5, Q6 and Q7 excluded; tuple equals `REVIEWABLE_REQUEST_STATUSES` | 01, 04 |
| D-30 | Semantic bucket rule; equivalence test; divergence documented | Oracle-versus-SQL membership per lifecycle step; gap doc item 8 | 03, 09 |
| D-31 | NULL handling; open parent for CI overdue | Unit (null status); mounted R5 and CI2 | 01, 04 |
| D-32 | Superseded by D-36 | Covered by the D-36 proofs (no closed Risks in exposure) | 02, 06, 08 |
| D-33 | Distinct API-only names; seed idempotency | `analyst-insight-catalogue-seed.integration.test.ts` | 01 |
| D-34 | Dashboard composition; independent widgets | `analyst-dashboard-service.test.ts` (five reads, unit isolation); E2E partial fixture | 08, 09 |
| D-35 | Nine vertical plans | This plan set | 01-09 |
| D-36 | Open exposure plus the register `state` filter | `risk-register.integration.test.ts` state cases; report and dashboard open counts equal `?state=open` totals | 02, 06, 08 |
| D-37 | Direction-document extensions; UI-D2 to UI-D20 | Primitive tests; `design-system-conformance.spec.ts` type scan; `mobile-navigation.test.tsx` single current item | 05, 07, 08, 09 |

---

## Wave 0 Requirements

This project creates its test scaffolds inside each plan's first (RED) task rather than in a separate wave. Every ❌ W0 row above is created by the task that owns it, before any implementation:

- [x] `apps/strapi/tests/analyst-insights.unit.test.ts`: pure rules (07-01-01)
- [x] `apps/strapi/tests/analyst-insight-authorization.unit.test.ts`: guard and scope (07-01-02)
- [x] `apps/strapi/tests/analyst-insight-catalogue-seed.integration.test.ts`: D-33 (07-01-03)
- [x] `apps/strapi/tests/request-status-summary.integration.test.ts`: D-09 and D-28 (07-02-01)
- [x] The harness (`tests/helpers/strapi-http-harness.ts`) gains `createFixtureDocument`, the widened `createAssessmentRequestFixture` (`dueDate`, `submittedDate`), `createQuestionnaireLifecycleFixture`, `getRequestLifecycleDocument`, `seedReviewableRequestsDirectly`, `withHeldQuestionnaireGeneration` and `countReviewQueueBucketFixture` (07-03-02)
- [x] `apps/strapi/tests/review-queue-buckets.integration.test.ts` (07-03-02)
- [x] `apps/strapi/tests/analyst-alert-query.unit.test.ts`, `analyst-alerts.integration.test.ts` (07-04-01)
- [x] `apps/strapi/tests/analyst-insights-seed.integration.test.ts` (07-04-03)
- [x] `apps/strapi/tests/analyst-reports.integration.test.ts` (07-06-01)
- [x] `apps/strapi/tests/analyst-dashboard.integration.test.ts` (07-08-01)
- [x] Web: `components/csrm/{kpi-tile,bar-chart,segmented-control,alert-urgency-badge}.test.tsx`; `features/alerts/{alert-schema,alert-service,alert-presentation,alert-list,alerts-page}.test.*`; `features/reports/{report-schema,report-service,report-presentation,report-views,reports-pages}.test.*`; `features/analyst-dashboard/*.test.*`
- [x] E2E: `apps/web/e2e/analyst-insights.spec.ts` (07-05-04, extended in 07-07-04, 07-08-04 and 07-09-01)
- [x] The shared today helper: tests compute `today` with the plan 01 `utcToday(new Date())` and build dates with `addUtcDays`, `startOfUtcMonth` and `addUtcMonths`. Literal expectations never recompute the rule under test.

No framework install is needed. Every tool is already present (07-RESEARCH "Standard Stack").

---

## Manual-Only Verifications

These are the orchestrator's browser backstops, from UI-SPEC "UI considerations" (backstop rows). They are listed again in plan 09's output.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Alerts table fits at the narrowest desktop widths | DASH-02 | Visual fit of wrapped Condition and Record cells at 768 and 1024, where the sidebar makes 1024 narrower | Open `/app/alerts` at 768 and 1024. There is no horizontal scroll, and cells wrap cleanly. |
| Cross-tab region scrolls inside itself at 375 | DASH-02 | Sticky-column scroll feel | Open `/app/reports/risk-exposure` at 375. The labelled region scrolls, the page does not, and keyboard focus reaches the region. |
| Responsive layout at four widths | DASH-01, DASH-02 | Layout judgement against the §2.6, §3.6 and §4.6 tables | Check the dashboard, Alerts, Reports index and one report at 375, 768, 1024 and 1440. |
| Mobile navigation sheet | DASH-01, DASH-02 | Touch reachability with every item present (analyst with Administration) | At 375×667, open the menu and reach every item and the "Development role" switcher by touch and keyboard. |
| Report print legibility | DASH-02 | Print is not a deliverable (export is deferred, D-06) but must stay legible | Print a report from the browser. There is no hover-only content and it is legible. |
| Deep link below the sticky header | DASH-02 | Visual confirmation of `scroll-padding-top` (automated in 07-05-04 by bounding boxes) | Open a Control Implementation alert. The Mitigation controls heading is fully visible below the header. |
| Three-second read | DASH-01 | UX judgement (CONTEXT specifics) | The dashboard answers "what needs me now?" at a glance. |
| Console clean | DASH-01, DASH-02 | Fresh-tab console state (STATE note 2026-09-23) | In a fresh tab, no console errors on any Phase 7 route. |

---

## Validation Sign-Off

- [x] Every task has an `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers every MISSING reference (each created in its owning RED task)
- [x] No watch-mode flags (`vitest run`, `node --test` and `playwright test` only)
- [x] Feedback latency under 90 s per task-level Strapi file
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved at plan check (2026-09-24); validation completed at phase close-out (2026-09-25, below)

## Validation Audit 2026-09-25 (phase close-out)

Every per-task row above is green: each automated command ran inside its plan (see the plan summaries) and again in the full close-out gate, run with the dev servers stopped on `ec75b98` plus the harness fix `eda7cfe`.

| Metric | Count |
|--------|-------|
| Per-task rows | 30 |
| Green | 30 |
| Red or flaky | 0 |
| Gaps found | 0 |
| Escalated to manual-only | 0 |

| Suite | Result |
|-------|--------|
| Strapi (`pnpm --filter @csrm/strapi test`) | 350 passed, 0 failed (9.2 min) |
| Web (`pnpm --filter @csrm/web test`) | 69 files, 834 tests passed (42 s) |
| Web typecheck | clean |
| `pnpm --prefix apps/web api:check` | clean |
| Playwright full suite (`pnpm --filter @csrm/web test:e2e`) | 49 passed, 0 failed (13.0 min) |

Manual-only verifications: all eight rows were performed on 2026-09-25 with a scripted headless browser audit (100 pages, three actors, 375px and 1440px: zero console errors, zero horizontal overflow, zero axe violations) and a visual review of the screenshots; the mobile navigation sheet, the deep link below the sticky header and the 375px cross-tab were confirmed earlier in `07-UI-REVIEW.md`. Report print legibility is carried into Phase 8 (D-33), where a print stylesheet hides the shell.

Environment note: the Playwright harness resolved pnpm only through Corepack's Windows path beside the Node binary, so its first run on a Linux host failed before a server started. `eda7cfe` adds the invoking pnpm and Corepack's POSIX location as fallbacks; no product code changed.

## Plan-check amendments (2026-09-24)

The amendments appended to plans 01, 02, 04, 05, 06, 07, 08 and 09 add these checks to the map above:

- exact served key sets pinned against the spec components in the mounted tests of 02, 04, 06 and 08;
- a static route inventory for the insight routes, created in 04 and extended in 06 and 08;
- insight-scope denial cases for the questionnaire and assessment read grants (01);
- accessibility and conformance scans of each new screen in its own plan (05, 07 and 08), each asserting populated content and no error state;
- the wider targeted Playwright run in 05;
- the isolated pre-gate run of the four browser specs in 09.
