---
phase: "21"
slug: "management-dashboards-and-metrics"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** This file was seeded on 2026-10-01 from `21-RESEARCH.md`, "Validation Architecture", before any plan exists. It maps every requirement and success criterion, with its negative cases in the API and the UI, to an automated proof:
- the requirements DASH-04 and DASH-05;
- the four ROADMAP success criteria;
- the locked decisions D-01 to D-29 in `21-CONTEXT.md`;
- the research items R1 to R11.

The phase closes UAT-059.

**How the maps are filled.**
- **Per-task map:** the planner rebuilds it for the final plans, one row per task, from each task's `<automated>` verify block. The plan check verifies the rows (Dimension 8).
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates (the project convention).
- **Status:** every status starts as ⬜ pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **Web:** vitest (jsdom) with @testing-library/react.<br>**Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, with one process and one SQLite database per test file.<br>**E2E:** Playwright with @axe-core/playwright, Chromium, on the production build. |
| **Config file** | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375×812) |
| **Node** | Prefix every command in Git Bash with POST-DEMO-BRIEF §4's Node 24 preamble. |
| **Quick run command** | **Web:** `pnpm --dir apps/csrm exec vitest run <path> [<path> …]`.<br>**Strapi file** (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`.<br>**E2E** (dev servers stopped): `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. |
| **Contract commands** | `pnpm --dir apps/csrm api:generate`, then `pnpm --dir apps/csrm api:check`. After a new route or grant, `SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (dev servers stopped). Then `cmp` the two catalogue copies, which must be silent. |
| **Full suite command** | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test` |
| **Phase gate** | The full suite, then `pnpm --dir apps/csrm test:e2e` (both projects).<br>**Afterwards:**<br>- `git status --short` shows only POST-DEMO-BRIEF §2's three operator items;<br>- the content-type freeze check lists exactly the approved stage-history schema file;<br>- the dependency diff is empty (no package added, D-16);<br>- `risk-owner-journey.spec.ts` stays green with the recorder in its acts. |
| **Estimated runtime** | Quick runs: about 20 to 90 seconds per Strapi file, under 10 seconds per web file. Full Strapi suite: about 25 to 35 minutes. Playwright: about 20 to 30 minutes. |

---

## Sampling Rate

- **After every task commit:** the touched web files by path; the touched Strapi test file (dev servers stopped); `typecheck` after type changes; `api:check` after any specification change.
- **After every plan wave:** the full Strapi suite and the full web suite.
- **Before `/gsd-verify-work`:** the full suite, then Playwright (both projects), then a clean `git status --short`.
- **Max feedback latency:** 90 seconds for a quick run.

---

## Per-Task Verification Map

Seeded by requirement. The planner replaces it with one row per task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-xx | tbd | 1 | DASH-05 / D-06 (R1) | — | N/A | Strapi unit | `…/stage-derivation.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 1 | DASH-05 (3) / D-09, D-12 (R7, R8) | — | N/A | Strapi unit | `…/working-days.unit.test.js`, `…/stage-statistics.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 1 | DASH-05 (1) / D-13 (R6) | — | N/A | Strapi unit | `…/trend-as-at.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 1 | DASH-05 (2) / D-15 | — | Withdrawn and off-scale never counted as on a position | Strapi unit | `…/heat-map-fold.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 1 | DASH-04 (2) / D-21 (R9) | — | N/A | Strapi unit | `…/ai-run-groups.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 3 | DASH-05 / D-07 (R2, R3) | T-21-tamper | Rows only inside an act's transaction; no row on rollback; append-only and no-gate static guards | Strapi unit + integration | `…/stage-recorder.unit.test.js`, `…/stage-history.integration.test.js`, `…/stage-history-acts.integration.test.js`, `…/stage-history-guards.unit.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 3 | DASH-05 / D-05 | — | N/A | Strapi integration | `…/stage-history-oracle.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 3 | R4 | T-21-tamper | A request with stage history cannot be deleted (409 `REQUEST_HAS_STAGE_HISTORY`) | Strapi integration | `…/request-delete.integration.test.js` | ❌ W0 / extends 13-06 | ⬜ pending |
| 21-xx | tbd | 4 | DASH-05 (3) / D-09 to D-12 | T-21-scope | Queue filters and figures count only the review scope | Strapi integration | `…/cycle-times-report.integration.test.js`, `…/review-queue-ageing.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 5 | DASH-05 (1), (2) / D-13 to D-16, D-20 | T-21-scope | Trend and heat-map totals equal their lists | Strapi integration | `…/risk-trend-report.integration.test.js`, `…/risk-heat-map.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 6 | DASH-04 (2) / D-21 to D-23 | T-21-disclose | No instruction, context summary, proposal or Requestor text in any run row | Strapi integration | `…/ai-assistance-report.integration.test.js` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 4–7 | D-02, D-25 | T-21-scope | Seven matrix callers; first-line people, Admin and service identity 403; analyst without the run read refused on AI reads only | Strapi integration + matrix | `…/authorization-matrix.integration.test.js`, `…/report-records-query.unit.test.js` | ✅ / ❌ W0 | ⬜ pending |
| 21-xx | tbd | 7 | DASH-04 (1) / D-17, D-18 | T-21-scope | The Requestor sees only their own time in stage (404 otherwise) | Strapi integration | `…/analyst-insights.integration.test.js`, `…/my-requests.integration.test.js` (extend) | ✅ extends | ⬜ pending |
| 21-xx | tbd | 8 | DASH-04, DASH-05 / D-16, D-27 | — | Permission state at every report URL for first-line people | Web unit (Vitest) | `pnpm --dir apps/csrm exec vitest run src/components/csrm src/features/reports src/features/analyst-dashboard src/features/dashboard` | ❌ W0 | ⬜ pending |
| 21-xx | tbd | 9 | SC1 to SC4 | T-21-scope | Maya and the risk owner persona refused in UI and API | E2E (1440, 375) | `pnpm --dir apps/csrm test:e2e e2e/<phase spec>.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Harness helpers: `stageRows(requestDocumentId)` (a Query Engine read), `withInjectedFailureAfter(act)` for rollback cases, and an injected clock for the insight services (07 D-24's pattern).
- [ ] A time-relative development fixture behind `IDAMBOX_SEED_CSRM` and the development identity (21-RESEARCH R5). It holds:
  - episodes of known lengths in every stage;
  - past-month residual reviews and closures, including one closure with no row and one future-dated v1 closure;
  - failed and interrupted runs inside and outside the seven-day window, and a run on a request later returned to draft.
- [ ] The test files marked ❌ W0 above.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Severity tints, icons, labels and the dashed partial mark survive a real printer | DASH-05 (2) / D-19 | Print fidelity on paper (UI-SPEC backstop) | The pilot prints the leadership view to A4 PDF and paper and checks that every cell's count, icon and band label reads |
| A residual matrix cell announces its likelihood and consequence headers, count and band | DASH-05 (2) / D-16 | Screen-reader output (UI-SPEC backstop) | With NVDA, the pilot moves through the residual matrix and confirms each cell's announcement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
