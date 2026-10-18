---
phase: "21"
slug: "management-dashboards-and-metrics"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-01"
updated: "2026-10-02"
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** This file was seeded on 2026-10-01 from `21-RESEARCH.md`, "Validation Architecture", and rebuilt on 2026-10-02 for the eighteen final plans (21-01 to 21-18). It maps every requirement and success criterion, with its negative cases in the API and the UI, to an automated proof:
- the requirements DASH-04 and DASH-05;
- the four ROADMAP success criteria;
- the locked decisions D-01 to D-29 in `21-CONTEXT.md` and its Orchestrator Confirmations;
- the research items R1 to R11.

The phase closes UAT-059 (plan 21-18).

**How the maps are filled.**
- **Per-task map:** one row per task, from each task's `<automated>` verify block. The plan check verifies the rows (Dimension 8).
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention); "✅" an existing or earlier-phase file the task extends.
- **Status:** every status starts as ⬜ pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** vitest (jsdom) with @testing-library/react.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, with one process and one SQLite database per test file.<br>**E2E:** Playwright with @axe-core/playwright, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375×812, `@journey` tests of the listed specs) |
| **Node** | Prefix every command in Git Bash with POST-DEMO-BRIEF §4's Node 24 preamble (written out in each plan's verify blocks). |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <path> [<path> …]`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`; in the map below, `node --test …/<file>.js` abbreviates this.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a new route or grant (21-09, 21-12), `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (dev servers stopped). Then `cmp` the two catalogue copies and the two export-vocabulary copies, which must be silent. |
| **Full suite command** | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test` |
| **Phase gate** | Plan 21-18 Task 4: the full suite, then `pnpm --dir apps/csrm test:e2e` (both projects).<br>**Afterwards:**<br>- `git status --short` shows only POST-DEMO-BRIEF §2's three operator items;<br>- the content-type freeze since `PHASE_21_BASE` lists exactly `apps/backend/src/api/csrm-stage-transition/content-types/csrm-stage-transition/schema.json`;<br>- the catalogue copies are identical; no dependency changed (D-16);<br>- `risk-owner-journey.spec.ts` is unchanged and passes with the recorder in its acts;<br>- both records carry the pilot's approval; X-68 to X-73 are in the direction; `COVERAGE.md` declares no external API integration. |
| **Estimated runtime** | Quick runs: about 20 to 90 seconds per Strapi file, under 10 seconds per web file. Full Strapi suite: about 25 to 35 minutes. Playwright: about 20 to 30 minutes. |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (the touched web files by path; the touched Strapi files with dev servers stopped; `typecheck` after type changes; `api:check` after any specification change).
- **After every plan wave:** the full Strapi suite and the full web suite (each plan's last task runs at least one of them).
- **Before `/gsd-verify-work`:** the full suite, then Playwright (both projects), then a clean `git status --short` (21-18 Task 4).
- **Max feedback latency:** 90 seconds for a quick run.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-T1 | 01 | 1 | DASH-04, DASH-05 / D-01 to D-27 (records, X-68 to X-73, R-08-36/37) | T-21-01 | Records written before any schema or contract change | grep checks | `grep -qF` over the six direction labels, both records' names, tables, functions, reasons, nine amendment headings, residual-risk sentence and awaiting lines | ✅ (docs) | ⬜ pending |
| 21-01-T2 | 01 | 1 | D-01 / G-6 | T-21-01, T-21-02 | Executor stops until the pilot approves | checkpoint:decision (pilot) | none: blocking-human checkpoint; its acceptance criteria are checked by T3's command | n/a | ⬜ pending |
| 21-01-T3 | 01 | 1 | D-01 / G-6 | T-21-02 | Dated approval in every record | grep checks | `grep -Eq "Approved by the pilot on …"` over 2 records and `"Phase 21 amendment approved by the pilot on …"` over 9 amendments; no awaiting line remains | ✅ (docs) | ⬜ pending |
| 21-02-T1 | 02 | 1 | DASH-05 / D-06, D-07 (R1, R2) | — | N/A | Strapi unit | `node --test …/stage-derivation.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-02-T2 | 02 | 1 | DASH-05 (3) / D-09, D-11, D-12 (R7, R8) | — | N/A | Strapi unit | `node --test …/working-days.unit.test.js …/stage-statistics.unit.test.js …/analyst-insights.unit.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 21-02-T3 | 02 | 1 | DASH-05 (1), (2) / D-13, D-15, D-16 (R6) | T-21-03 | Malformed history → Not available; withdrawn and off-scale never on a cell | Strapi unit | `node --test …/trend-as-at.unit.test.js …/heat-map-fold.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-02-T4 | 02 | 1 | DASH-04 (2) / D-21, D-23 (R9) | T-21-04 | Folds take no run content | Strapi unit | `node --test …/ai-run-groups.unit.test.js` plus the five other 21-02 unit files | ❌ W0 | ⬜ pending |
| 21-03-T1 | 03 | 2 | DASH-05 / D-01, D-05, D-07, D-08 | T-21-05, T-21-07 | No route; row written with the submission or not at all; concurrent submits serialise | Strapi integration | `node --test …/stage-history.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-03-T2 | 03 | 2 | DASH-05 / D-07, D-08 (R3) | T-21-06 | Entry time from the act; "before" rule; refusal writes nothing | Strapi unit + integration | `node --test …/stage-recorder.unit.test.js …/stage-history.integration.test.js …/request-workflow.integration.test.js` | ❌ W0 / ✅ | ⬜ pending |
| 21-03-T3 | 03 | 2 | DASH-05 / D-03 item 7 (R4) | T-21-05 | Request with stage history cannot be deleted (409 `REQUEST_HAS_STAGE_HISTORY`) | Strapi integration + web unit + contract | `api:check`; `vitest run src/lib/api/conflict-reasons.test.ts`; `typecheck`; `pnpm --dir apps/backend test` | ✅ extends | ⬜ pending |
| 21-04-T1 | 04 | 2 | DASH-04, DASH-05 / D-06, D-08, D-09, D-11, D-12, D-21, D-26 | — | N/A | Web unit | `vitest run src/features/reports/metrics-format.test.ts src/components/csrm/status-badge.test.tsx`; `typecheck` | ❌ W0 / ✅ | ⬜ pending |
| 21-04-T2 | 04 | 2 | D-27 (UI amendment 2) | T-21-09 | Meaning not by colour (deltas) | Web unit | `vitest run src/components/csrm src/features/reports src/features/analyst-dashboard`; `typecheck` | ✅ extends | ⬜ pending |
| 21-04-T3 | 04 | 2 | DASH-05 (1) / D-13, D-14, D-16 | T-21-09 | Table equivalence; pointer targets out of the tab order | Web unit | `vitest run src/components/csrm/risk-trend-chart.test.tsx`; `typecheck` | ❌ W0 | ⬜ pending |
| 21-04-T4 | 04 | 2 | DASH-05 (2) / D-15, D-16 (SC2) | T-21-09 | Readable without colour; accessible cell names | Web unit | `vitest run src/components/csrm`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 21-05-T1 | 05 | 3 | DASH-05 / D-07 | T-21-11 | Request lock first; Maya's refused release writes nothing | Strapi integration | `node --test …/stage-history-acts.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-05-T2 | 05 | 3 | DASH-05 / D-07 | T-21-10 | Failed submission leaves no row | Strapi integration | `node --test …/stage-history-acts.integration.test.js …/questionnaire-workflow.integration.test.js` | ✅ extends | ⬜ pending |
| 21-05-T3 | 05 | 3 | DASH-05 (3) / D-05, D-07, D-10, D-11 | T-21-10, T-21-12 | Round episodes equal round times; refused recall writes nothing | Strapi integration | `node --test …/stage-history-acts.integration.test.js …/response-rounds.integration.test.js …/acceptance-rounds.integration.test.js …/send-back.integration.test.js` | ✅ extends | ⬜ pending |
| 21-05-T4 | 05 | 3 | DASH-05 / D-05, D-07, D-28 | T-21-10 | Append-only and no-gate static guards; twelve-act coverage; oracle | Strapi unit + integration | `node --test …/stage-history-guards.unit.test.js …/stage-history-acts.integration.test.js …/stage-history-oracle.integration.test.js`; `pnpm --dir apps/backend test` | ❌ W0 | ⬜ pending |
| 21-06-T1 | 06 | 4 | DASH-05 (3) / D-09, D-12, D-25, D-26 | T-21-14 | Out-of-scope episodes never counted | Strapi integration | `node --test …/cycle-times-repository.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-06-T2 | 06 | 4 | DASH-05 (3) / D-08, D-10, D-11, D-12, D-18 | T-21-14 | Drafts never in ageing | Strapi integration | `node --test …/cycle-times-repository.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-06-T3 | 06 | 4 | DASH-05 (1) / D-13, D-14, D-25 | T-21-14, T-21-15 | Withdrawn and unreleased never counted; capped reads | Strapi integration | `node --test …/risk-trend-repository.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-06-T4 | 06 | 4 | DASH-04 (2) / D-21 to D-23, D-25 | T-21-13 | No instruction, context summary, proposal or Requestor text in any run row | Strapi integration | `node --test …/ai-assistance-repository.integration.test.js …/cycle-times-repository.integration.test.js …/risk-trend-repository.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-07-T1 | 07 | 5 | DASH-05 (3) / D-03 items 5, 7, D-12, D-26 | T-21-16 | Closed filter values (400 `LIST_FILTER_INVALID`); queue totals equal ageing | Strapi integration + web unit + contract | `node --test …/review-queue-ageing.integration.test.js …/review-queue-buckets.integration.test.js`; `api:check`; `vitest run src/features/assessments`; `typecheck` | ❌ W0 / ✅ | ⬜ pending |
| 21-07-T2 | 07 | 5 | DASH-05 (3) / D-12, D-27 | — | N/A | Web unit | `vitest run src/features/assessments`; `typecheck`; `lint` | ✅ extends | ⬜ pending |
| 21-07-T3 | 07 | 5 | DASH-04 (1) / D-17 | T-21-17 | Requestor sees only their own time in stage (404 otherwise) | Strapi integration + web unit | `api:check`; `vitest run src/features/requests src/features/home`; `typecheck`; `lint`; `pnpm --dir apps/backend test` | ✅ extends | ⬜ pending |
| 21-08-T1 | 08 | 6 | DASH-05 (3) / D-03, D-04, D-11, D-19, D-25 | T-21-18, T-21-19 | First-line people and service identity 403 on report and export | Strapi integration + web unit + contract | `node --test …/analyst-reports.integration.test.js …/export-vocabulary.unit.test.js`; `cmp` vocabularies; `api:check`; `vitest run src/features/reports src/features/exports` | ✅ extends | ⬜ pending |
| 21-08-T2 | 08 | 6 | DASH-05 (3) / D-08 to D-12, D-26 (SC3) | T-21-18 | Permission state for a Requestor | Web unit | `vitest run src/features/reports`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 21-08-T3 | 08 | 6 | DASH-05 (3) / D-12, D-18, D-27 | — | N/A | Web unit | `vitest run src/features/reports`; `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ❌ W0 | ⬜ pending |
| 21-09-T1 | 09 | 7 | DASH-04, DASH-05 / D-02, D-03 items 2, 7, D-10, D-12, D-26 (SC3) | T-21-20 | One figure/list function; served chain | Strapi integration + unit + web unit + contract | `node --test …/report-records.integration.test.js …/analyst-insight-routes.unit.test.js …/contract-catalogue.integration.test.js …/served-operations.integration.test.js`; `cmp` catalogues; `api:check`; `vitest run src/features/reports src/features/contract-response-parity.test.ts`; `typecheck` | ❌ W0 / ✅ | ⬜ pending |
| 21-09-T2 | 09 | 7 | D-03 item 7 | T-21-22 | Closed drill-down parameters (400 / 404) | Strapi unit + integration | `node --test …/report-records-query.unit.test.js …/report-records.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-09-T3 | 09 | 7 | D-02, D-25 | T-21-20, T-21-21 | Seven matrix callers; service identity 403; analyst lacking a read 403 `INSIGHT_SCOPE_MISSING`; run read for AI only | Strapi unit + matrix | `node --test …/analyst-insight-authorization.unit.test.js …/authorization-matrix-provenance.unit.test.js …/authorization-matrix.integration.test.js …/report-records.integration.test.js`; `pnpm --dir apps/backend test` | ✅ extends | ⬜ pending |
| 21-10-T1 | 10 | 8 | DASH-05 (3) / D-10, D-12, D-26, D-27 (SC3) | — | N/A | Web unit | `vitest run src/features/reports/report-records-presentation.test.ts src/features/reports/report-drill-down.test.tsx`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 21-10-T2 | 10 | 8 | D-25, D-27 (Z1) | T-21-23, T-21-24 | Permission state at every records URL with no read; stale links explained | Web unit | `vitest run src/features/reports src/lib/api/refusal-copy.test.ts`; `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ✅ extends | ⬜ pending |
| 21-10-T3 | 10 | 8 | D-27 | — | N/A | Web unit | `vitest run src/features/reports`; `typecheck`; `lint` | ✅ extends | ⬜ pending |
| 21-11-T1 | 11 | 9 | DASH-05 (1) / D-03, D-13, D-14, D-19, D-25, D-26 (SC1) | T-21-25, T-21-26 | First-line people and service identity 403 on report, records and export | Strapi integration + web unit + contract | `node --test …/analyst-reports.integration.test.js …/report-records.integration.test.js …/export-vocabulary.unit.test.js`; `cmp`; `api:check`; `vitest run src/features/reports src/features/exports`; `typecheck` | ✅ extends | ⬜ pending |
| 21-11-T2 | 11 | 9 | DASH-05 (1) / D-13, D-14, D-16, D-26 (SC1) | — | N/A | Web unit | `vitest run src/features/reports`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 21-11-T3 | 11 | 9 | DASH-05 (1) / D-14, D-26 | — | N/A | Web unit | `vitest run src/features/reports`; `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ✅ extends | ⬜ pending |
| 21-12-T1 | 12 | 10 | DASH-05 (2) / D-02, D-03 item 4, D-15, D-16 (SC2) | T-21-27, T-21-29 | Withdrawn never counted; route before `:riskId`; capped reads | Strapi integration + web unit + contract | `node --test …/risk-heat-map.integration.test.js …/risk-register.integration.test.js …/contract-catalogue.integration.test.js …/served-operations.integration.test.js`; `cmp`; `api:check`; `vitest run src/features/risks src/features/contract-response-parity.test.ts`; `typecheck` | ❌ W0 / ✅ | ⬜ pending |
| 21-12-T2 | 12 | 10 | DASH-05 (2) / D-03 items 5, 7, D-15, D-26 | T-21-28 | Closed position values (400 `LIST_FILTER_INVALID`); cell totals equal register lists | Strapi integration + web unit + contract | `node --test …/risk-heat-map.integration.test.js …/risk-register.integration.test.js`; `api:check`; `vitest run src/features/risks`; `typecheck` | ✅ extends | ⬜ pending |
| 21-12-T3 | 12 | 10 | D-02, D-25 | T-21-27 | Seven matrix callers; service identity and analyst without the register read refused | Strapi unit + matrix | `node --test …/authorization-matrix-provenance.unit.test.js …/authorization-matrix.integration.test.js …/risk-heat-map.integration.test.js`; `pnpm --dir apps/backend test` | ✅ extends | ⬜ pending |
| 21-13-T1 | 13 | 11 | DASH-05 (2) / D-15, D-16, D-26 (SC2) | T-21-30, T-21-31 | `display` never sent to Strapi; permission state kept | Web unit | `vitest run src/features/risks`; `typecheck`; `lint` | ❌ W0 / ✅ | ⬜ pending |
| 21-13-T2 | 13 | 11 | D-15, D-27 | — | N/A | Web unit | `vitest run src/features/risks`; `typecheck`; `lint` | ✅ extends | ⬜ pending |
| 21-13-T3 | 13 | 11 | D-03 item 5, D-27 | — | N/A | Web unit | `vitest run src/features/risks`; `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ✅ extends | ⬜ pending |
| 21-14-T1 | 14 | 11 | DASH-04 (2) / D-02, D-03, D-19, D-21, D-22, D-25, D-26 (SC4) | T-21-32, T-21-33 | No run content in any body; first-line people and service identity 403 | Strapi integration + web unit + contract | `node --test …/analyst-reports.integration.test.js …/report-records.integration.test.js …/export-vocabulary.unit.test.js`; `cmp`; `api:check`; `vitest run src/features/reports src/features/exports`; `typecheck` | ✅ extends | ⬜ pending |
| 21-14-T2 | 14 | 11 | DASH-04 (2) / D-21, D-22, D-26 | T-21-32 | No run content in the UI | Web unit | `vitest run src/features/reports`; `typecheck`; `lint` | ✅ extends | ⬜ pending |
| 21-14-T3 | 14 | 11 | DASH-04 (2) / D-21 to D-23, D-26, D-27 | — | Permission state for a Requestor | Web unit + Strapi suite | `vitest run src/features/reports`; `typecheck`; `lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test` | ❌ W0 | ⬜ pending |
| 21-15-T1 | 15 | 12 | DASH-04 (2) / D-02, D-18, D-21, D-26 (SC4) | T-21-34, T-21-35 | Failed figure only with the run read; first-line people 403 | Strapi integration + web unit + contract | `node --test …/analyst-dashboard.integration.test.js`; `api:check`; `vitest run src/features/analyst-dashboard`; `typecheck` | ✅ extends | ⬜ pending |
| 21-15-T2 | 15 | 12 | DASH-05 (3) / D-12, D-18, D-26 | — | N/A | Strapi integration + web unit + contract | `node --test …/analyst-dashboard.integration.test.js`; `api:check`; `vitest run src/features/analyst-dashboard`; `typecheck`; `lint` | ✅ extends | ⬜ pending |
| 21-15-T3 | 15 | 12 | DASH-04 (1) / D-18, D-20, D-26, D-27 | — | N/A | Web unit + full suites | `api:check`; `vitest run src/features/analyst-dashboard`; `typecheck`; `lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test` | ✅ extends | ⬜ pending |
| 21-16-T1 | 16 | 13 | DASH-05 (2) / D-15, D-20, D-26 (SC2) | T-21-37 | Matrix equals the heat-map read | Strapi integration + web unit + contract | `node --test …/analyst-reports.integration.test.js`; `api:check`; `vitest run src/features/reports`; `typecheck` | ✅ extends | ⬜ pending |
| 21-16-T2 | 16 | 13 | DASH-04 (1) / D-20, D-26 | T-21-37 | Every cell equals its register total | Strapi integration + web unit + contract | `node --test …/analyst-reports.integration.test.js`; `api:check`; `vitest run src/features/reports`; `typecheck`; `lint` | ✅ extends | ⬜ pending |
| 21-16-T3 | 16 | 13 | DASH-04 (1), DASH-05 (3) / D-04, D-11, D-20 (G-16) | T-21-36 | No due logic outside the one rule | Strapi integration + web unit + contract | `node --test …/analyst-reports.integration.test.js`; `api:check`; `vitest run src/features/reports`; `typecheck`; `lint` | ✅ extends | ⬜ pending |
| 21-16-T4 | 16 | 13 | DASH-04 (1) / D-04, D-19, D-20 | — | N/A | Full suites + contract | `cmp` vocabularies; `api:check`; `pnpm --dir apps/csrm test`; `typecheck`; `lint`; `pnpm --dir apps/backend test` | ✅ extends | ⬜ pending |
| 21-17-T1 | 17 | 14 | DASH-04, DASH-05 / D-17, D-19, D-25, D-26 (SC1, SC2) | T-21-39 | Permission state with no read for first-line people | Web unit | `vitest run src/features/reports`; `typecheck`; `lint` | ❌ W0 / ✅ | ⬜ pending |
| 21-17-T2 | 17 | 14 | D-19 (X-73) | T-21-38 | Print note states the printing analyst's scope | Web unit | `vitest run src/features/reports`; `typecheck`; `lint` | ❌ W0 | ⬜ pending |
| 21-17-T3 | 17 | 14 | D-27 | — | N/A | Web unit | `vitest run src/features/reports`; `typecheck`; `lint`; `pnpm --dir apps/csrm test` | ✅ extends | ⬜ pending |
| 21-18-T1 | 18 | 15 | DASH-04, DASH-05 / D-08, D-28 | T-21-40 | Seeds only with the seed flag and the development identity | Strapi integration + full suite | `node --test …/management-metrics-seed.integration.test.js …/stage-history-guards.unit.test.js …/analyst-insights-seed.integration.test.js`; `pnpm --dir apps/backend test` | ❌ W0 / ✅ | ⬜ pending |
| 21-18-T2 | 18 | 15 | SC1 to SC4 / D-17, D-25, D-27, D-28 | T-21-41, T-21-42 | Maya and the risk owner persona refused in UI and API at every report, records, heat-map and summary read; clean tree | E2E (1440, 375) | `pnpm --dir apps/csrm test:e2e e2e/management-metrics.spec.ts --project desktop` then `--project mobile` (a passed count), then `git status --short` | ❌ W0 | ⬜ pending |
| 21-18-T3 | 18 | 15 | D-27, D-28 (R-08-34) | T-21-42 | Clean tree | E2E | `pnpm --dir apps/csrm test:e2e e2e/analyst-insights.spec.ts e2e/navigation-and-home.spec.ts e2e/performance.spec.ts`, then `git status --short` | ✅ extends | ⬜ pending |
| 21-18-T4 | 18 | 15 | DASH-04, DASH-05 / D-01, D-16, D-29 (G-6) | T-21-01, T-21-SC | Freeze check, approvals, no dependency or Keycloak change, journey unchanged | Full gate | the full suite command, `pnpm --dir apps/csrm test:e2e`, `git status --short`, the freeze check, `cmp`, the dependency, journey, Keycloak, approval, direction and coverage checks | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement and criterion coverage

| Item | Proven by (tasks) |
|------|-------------------|
| DASH-04 (1) metric sets per audience | 21-07-T3 (Requestor), 21-15 (analyst Home), 21-16 (risk manager reports), 21-17-T1 (leadership view), 21-18-T2 |
| DASH-04 (2) failed AI jobs for analysts | 21-02-T4, 21-06-T4, 21-14-T1 to T3, 21-15-T1, 21-18-T2 |
| DASH-05 (1) open released risks by residual rating over 12 months | 21-02-T3, 21-06-T3, 21-11, 21-17-T1, 21-18-T2 |
| DASH-05 (2) heat map, readable without colour | 21-02-T3, 21-04-T4, 21-12, 21-13, 21-16-T1, 21-18-T2 |
| DASH-05 (3) median and 90th percentile per stage to the slowest items; ageing bands | 21-02-T2, 21-03 to 21-06, 21-07, 21-08, 21-09, 21-10, 21-18-T2 |
| SC1 / SC2 / SC3 / SC4 | 21-18-T2 (browser and API at both widths), with the API proofs above |
| Negative cases (`<authorisation>`) | 21-07-T1/T3, 21-08-T1, 21-09-T3, 21-10-T2, 21-11-T1, 21-12-T3, 21-14-T1, 21-15-T1, 21-17-T1, 21-18-T2 |

---

## Wave 0 Requirements

Each plan's first RED task creates its test files before the implementation (the project convention); the helpers and fixture land in the plans that first need them:
- [ ] `stageRows(requestDocumentId)` and the stage-transition fixture UID in `apps/backend/tests/helpers/strapi-http-harness.ts` (21-03 Task 1); the rollback cases reuse the harness's existing `withDocumentWriteFailure`.
- [ ] `apps/backend/tests/helpers/insight-fixtures.ts` with timed stage rows, rounds, releases, history rows, runs and `injectedToday` (21-06 Task 1).
- [ ] The time-relative development fixture `seed-management-metrics.ts` behind `IDAMBOX_SEED_CSRM` and the development identity (21-18 Task 1), holding episodes of known lengths in every stage, open requests in each band and one before the history, past-month reviews and closures (including one with no row and one future-dated analyst-written closure), and failed and interrupted runs inside and outside the seven-day window, one completed on retry and one on a request returned to draft.
- [ ] The test files marked ❌ W0 above.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Severity tints, icons, labels and the dashed partial mark survive a real printer | DASH-05 (2) / D-19 | Print fidelity on paper (UI-SPEC backstop; 21-17 must_haves) | The pilot prints the leadership view to A4 PDF and paper and checks that every cell's count, icon and band label reads |
| A residual matrix cell announces its likelihood and consequence headers, count and band | DASH-05 (2) / D-16 | Screen-reader output (UI-SPEC backstop; 21-17 must_haves) | With NVDA, the pilot moves through the residual matrix and confirms each cell's announcement |
| The pilot's approval of the two records | D-01 / G-6 | Governance decision | 21-01 Task 2's blocking-human checkpoint |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the one checkpoint, 21-01-T2, is a blocking-human decision checked by 21-01-T3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s for quick runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (the plan check)
