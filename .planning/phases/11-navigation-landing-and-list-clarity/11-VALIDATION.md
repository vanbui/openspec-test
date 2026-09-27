---
phase: "11"
slug: "navigation-landing-and-list-clarity"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-28"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Source and scope.** Seeded on 2026-09-28 from `11-RESEARCH.md` § "Validation Architecture", before any plan exists. It maps every requirement, finding and decision group to an automated proof:
- the five requirements: UX-07, UX-08, UX-09, UX-10 and DASH-03;
- the nine findings: UAT-001, UAT-002, UAT-003, UAT-004, UAT-035, UAT-038, UAT-048, UAT-060 and UAT-065;
- the locked decisions D-01 to D-58 in `11-CONTEXT.md`.

**How the maps are filled.**
- **Per-task map:** seeded with one row per proposed plan (research "Proposed plan grouping", 11-01 to 11-15). The planner replaces it with one row per task, taken from each task's `<automated>` verify block, and the plan check verifies them (Dimension 8).
- **Markers:** "❌ W0" marks a test file that the owning plan's first RED task creates, as in Phase 10.
- **Status:** every status starts as ⬜ pending.
- **Phase 10 first:** Phase 10 executes and passes its gate before any Phase 11 plan (D-04). Several proofs below rely on Phase 10's artifacts: `LocalInstant`, the navigation guard and the interface copy guard.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Web: vitest 4.1.11 (jsdom) with @testing-library/react 16.3.0 and user-event 14.6.1. Strapi: `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one process and one SQLite database per test file. E2E: Playwright 1.58.2 with @axe-core/playwright 4.11.0, Chromium, on the production build |
| **Config file** | `apps/web/vitest.config.ts` (`src/**/*.test.{ts,tsx}`, 20 s timeouts); `apps/strapi/tests/tsconfig.json`; `apps/web/playwright.config.ts` (`desktop` 1440×900 runs every spec; `mobile` 375×812 with touch runs only `@journey` tests; one worker) |
| **Node** | Prefix every command in Git Bash with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" &&`. The native modules are built for Node 24.19.0 (pnpm 11.24.0) |
| **Quick run command** | **Web:** `pnpm --filter @csrm/web exec vitest run <path> [<path> …]`, with paths under `apps/web`. Never `pnpm --filter @csrm/web test -- <pattern>`, which runs the whole suite.<br>**Strapi file, dev servers stopped:** `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/strapi && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js`.<br>**E2E, dev servers stopped:** `pnpm --filter @csrm/web test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]`. Each run builds for production first, so batch a plan's specs |
| **Contract commands** | `pnpm --prefix apps/web api:generate`, then `pnpm --prefix apps/web api:check`. After the new route (plan 11-08), `SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write` with the dev servers stopped |
| **Full suite command** | `pnpm --filter @csrm/web test`; `pnpm --filter @csrm/web typecheck`; `pnpm --prefix apps/web api:check`; `pnpm --filter @csrm/strapi test`; `pnpm --filter @csrm/web test:e2e` |
| **Phase gate** | The five full-suite commands on the production build.<br>**Before:** ports 1337 and 3000 are free (in Git Bash, `netstat -ano \| grep -E ':(1337\|3000) .*LISTENING'` prints nothing).<br>**Afterwards:**<br>- `git status --porcelain` is empty; a Playwright run leaves the tree clean, with no restore step (G-6, Phase 8 D-12);<br>- the content-type freeze check prints nothing: `git diff --name-only <phase-11 CONTEXT commit>..HEAD -- 'apps/strapi/src/api/*/content-types/*'`;<br>- `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` is silent |
| **Estimated runtime** | A web file takes under 20 s. A Strapi file takes 10 to 90 s, and the authorization matrix 2 to 4 minutes. The full web suite takes about 20 to 30 s, the full Strapi suite about 9 to 13 minutes, and the full Playwright suite about 11 to 15 minutes, likely longer with this phase's new journeys |

**Known infrastructure facts.**
1. **Shared `dist`:** the orchestrator's dev Strapi (1337) and Next (3000) run during planning and between plans. Anything that compiles Strapi shares `apps/strapi/dist`: a Strapi file, the Strapi suite and `served-operations:write`. So does a Playwright run. These wait until the servers are stopped. A task executed while they run records those proofs as pending for the plan's end.
2. **No hosted AI:** automated suites pin the deterministic provider. No Phase 11 proof triggers generation, except the existing journeys that already generate with the deterministic provider.
3. **Jobs are process-local** (R-08-36). The analyst Home's "Generation in progress" figure is proven through the existing queue bucket tests. No E2E relies on a job outliving a restart.
4. **Windows vitest:** vitest can fail with `EPERM: rename`. Rerun that file alone before treating it as a real failure.
5. **Fixtures:** the E2E proofs reuse seeded fixtures that no other spec consumes: Jane's navigation-lifecycle requests and her seeded questionnaire, and the Phase 7 analyst-insights Risks. D-45 adds one accepted, released Risk to `seed-analyst-insights.ts`. Journeys that change state create their own records through the UI, which is the 06.9 lesson.
6. **Sign-in proves the shell:** after plan 11-02, every sign-in asserts the level-one "Home" heading and the role in the banner. `e2e-sign-in-assertions.test.ts` enforces this.

---

## Sampling Rate

- **After every task commit:**
  - Run the touched web test files by path (under 20 s each).
  - Run `typecheck` when types change, and `api:check` after any spec change.
  - Run touched Strapi files by path only with the dev servers stopped; otherwise record them as pending for the plan's end.
- **After every plan wave:**
  - Run the full web suite, `typecheck` and `api:check`.
  - Run the full Strapi suite after every plan that edits Strapi: 11-04, 11-05, 11-06, 11-08, 11-11 and 11-12.
  - Run each plan's targeted Playwright specs once, at its end.
  - Plans 11-02 (Home, the redirect, the sign-in helpers), 11-03 (the sidebar) and 11-10 (the sidebar counts) end with one full Playwright run, because every journey passes through what they change.
- **Before `/gsd-verify-work`:** the full suite must be green. That is plan 11-15's phase gate, recorded with counts, duration, flaky count and the empty `git status`.
- **Max feedback latency:** 90 seconds at task level. The production-build E2E runs only at plan level.

---

## Per-Task Verification Map

Seeded per proposed plan. The planner replaces each row with one row per task (`11-NN-TT`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-xx | 01 | 1 | UX-09 (UAT-065) | — | N/A | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/csrm/status-badge.test.tsx src/features/assessments/assessment-status-filters.test.tsx src/features/assessments/assessment-list.test.tsx`; `pnpm --filter @csrm/web test:e2e e2e/assessment-navigation-lifecycle.spec.ts` | ✅ | ⬜ pending |
| 11-02-xx | 02 | 2 | UX-08 (UAT-001) | T-11-01 | A Requestor at `/app` issues no analyst read, fixture or partial | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/lib/testing/e2e-ui-state-route-authorization.test.tsx src/lib/testing/e2e-sign-in-assertions.test.ts src/lib/performance/zod-client-boundary.test.ts src/features/home`; `pnpm --filter @csrm/web test:e2e` (full) | ✅ / ❌ W0 (home) | ⬜ pending |
| 11-03-xx | 03 | 3 | UX-07 (UAT-002) | T-11-02 | Navigation visibility is not authorisation: every route gate is unchanged | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/config/navigation/navigation.test.ts src/components/shell`; `pnpm --filter @csrm/web test:e2e` (full) | ❌ W0 / ✅ | ⬜ pending |
| 11-04-xx | 04 | 4 | UX-09 (UAT-035) | T-11-03 | `queue=all` needs the explicit analyst grant and never returns a draft; `q` is escaped | Strapi unit + integration, web unit, E2E | quick run `review-queue.unit.test.js`, `review-queue-buckets.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/assessments src/features/contract-response-parity.test.ts`; `api:check` | ✅ | ⬜ pending |
| 11-05-xx | 05 | 5 | UX-09 (UAT-035, UAT-048) | T-11-04 | The owner list stays released-only and owner-scoped with the new filters | Strapi integration, web unit, E2E | quick run `assessment-workflow.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/assessments src/features/risks src/features/contract-response-parity.test.ts`; `api:check` | ✅ | ⬜ pending |
| 11-06-xx | 06 | 6 | UX-08 (UAT-003) | — | The next action never links a Requestor to an unreleased record (existing rule kept) | Strapi unit + integration, web unit | quick run `request-lifecycle.unit.test.js`, `request-workflow.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/requests src/features/contract-response-parity.test.ts`; `api:check` | ✅ | ⬜ pending |
| 11-07-xx | 07 | 7 | UX-08 (UAT-038) | — | N/A | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/requests/request-lifecycle-stepper.test.tsx src/features/requests/request-hub.test.tsx`; the 375px request page journeys | ✅ | ⬜ pending |
| 11-08-xx | 08 | 8 | UX-08, UX-09 (UAT-003) | T-11-05 | `GET /v1/my_requests` lists only the caller's own requests for every identity | Strapi integration, matrix, served ops, web unit | quick run `my-requests.integration.test.js`, `request-status-summary.integration.test.js`, `authorization-matrix.integration.test.js`, `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/requests src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; `api:check`; `cmp` of both catalogue copies | ❌ W0 / ✅ | ⬜ pending |
| 11-09-xx | 09 | 9 | UX-08 (UAT-003, UAT-004) | T-11-06 | Home items carry no unreleased Risk Assessment identity | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/home src/features/dashboard`; `pnpm --filter @csrm/web test:e2e e2e/navigation-and-home.spec.ts e2e/requestor-request-workflow.spec.ts e2e/design-system-conformance.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| 11-10-xx | 10 | 10 | UX-07 | T-11-07 | Requestors issue no analyst count read; a refused read shows no badge | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/shell/navigation-counts.test.ts src/components/shell`; `pnpm --filter @csrm/web test:e2e` (full) | ❌ W0 / ✅ | ⬜ pending |
| 11-11-xx | 11 | 11 | DASH-03, UX-09 (UAT-048, UAT-060) | T-11-08 | New filters are closed enums bound as parameters; a crafted value is 400 | Strapi unit + integration, web unit, E2E | quick run `risk-register.unit.test.js`, `risk-register.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/risks src/lib/performance/interface-copy-guard.test.ts src/features/contract-response-parity.test.ts`; `api:check`; `e2e/risk-register-workflow.spec.ts` | ✅ | ⬜ pending |
| 11-12-xx | 12 | 12 | DASH-03 (UAT-060), UX-09 | — | Exposure scope stays analyst-insight-only | Strapi integration + unit, web unit, E2E | quick run `analyst-dashboard.integration.test.js`, `analyst-reports.integration.test.js`, `analyst-insights.unit.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/analyst-dashboard src/features/reports src/lib/performance/interface-copy-guard.test.ts src/features/contract-response-parity.test.ts`; `api:check`; `e2e/analyst-insights.spec.ts` | ✅ | ⬜ pending |
| 11-13-xx | 13 | 13 | UX-09 (UAT-048) | — | N/A | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/reports src/features/analyst-dashboard src/features/home`; `e2e/analyst-insights.spec.ts` | ❌ W0 (audit) / ✅ | ⬜ pending |
| 11-14-xx | 14 | 14 | UX-10 | T-11-09, T-11-10 | Quick find returns only records the viewer may read; the term is validated; searches are bounded | unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/quick-find src/components/shell src/features/contract-operation-chain.test.ts`; `pnpm --filter @csrm/web test:e2e e2e/quick-find.spec.ts` | ❌ W0 | ⬜ pending |
| 11-15-xx | 15 | 15 | all | all | The gate | full suite + browser | The five full-suite commands; the phase gate checks; the 375px and 1440px browser checks | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Threat references** (the planner carries them into each plan's `<threat_model>`):

| ID | Threat | Mitigation |
|---|---|---|
| T-11-01 | A Requestor at `/app` triggers analyst reads | Variant decided before any read; unit proof |
| T-11-02 | Treating sidebar visibility as authorisation | Route gates and Strapi unchanged; the permission states stay |
| T-11-03 | `queue=all` widening the review scope, or `q` injecting SQL | Explicit analyst grant; reviewable and released statuses only; escaped `LIKE` |
| T-11-04 | New assessment filters widening the owner list | The owner released predicate is ANDed with every filter |
| T-11-05 | IDOR through `GET /v1/my_requests` | Owner id from the policy only; closed keys; matrix row |
| T-11-06 | Disclosing an unreleased Risk Assessment to its Requestor | Request facts and the lifecycle step only |
| T-11-07 | Analyst figures in a Requestor's sidebar | Counts chosen by capability; Strapi refusal shows no badge |
| T-11-08 | SQL injection through the Risk Register filters | Closed enums mapped to constant fragments, and bound values |
| T-11-09 | Quick find disclosing other Requestors' records | Scoped list reads only; E2E proof as the Secondary Requestor |
| T-11-10 | Quick-find flooding | Debounce; two characters minimum; five per list; one call in flight |

---

## Requirement, Finding and Decision Map

Each row names the proof, whether its file exists, and its state. Strapi files are named by their compiled `.js` form for the quick run. Web paths are under `apps/web`.

| Req / Finding / Decision | Behaviour to verify | Test type | Automated command / proof | File exists? | Status |
|--------------------------|--------------------|-----------|---------------------------|--------------|--------|
| UX-07 · UAT-002 · D-06, D-07, D-08 | Each actor's profile has the sections, order and items of `REPORT.md` §5. A section renders only when it holds a visible item. The analyst's own section starts collapsed and opens on `/app/requests…`. The New request button is a button, not a nav item | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/config/navigation/navigation.test.ts src/components/shell/mobile-navigation.test.tsx`; `e2e/navigation-and-home.spec.ts` at 1440px and 375px for Jane, Maya and Bob | ❌ W0 / ✅ | ⬜ pending |
| UX-07 · D-09 | Every nav label equals its page heading, and the route titles follow. "New request" is the new request page's heading | web unit + E2E | `navigation.test.ts` asserts each item's label is the heading constant its page renders; E2E opens every item and reads the level-one heading | ❌ W0 | ⬜ pending |
| UX-07 · D-10, D-11 | Badges on My requests and My questionnaires (Requestor), Requests and Alerts (analyst), and on the own section while collapsed. A zero shows no badge; a failed read shows none; the accessible name carries the count and its meaning; Requestors issue no analyst count read | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/shell/navigation-counts.test.ts`; E2E: the badge equals its list's total (the queue's Requires my attention total; overdue alerts; My requests needing action) | ❌ W0 | ⬜ pending |
| UX-07 · D-11 (A2) | After a revalidating action (submit a draft), the Requestor's My requests badge changes without a manual reload | E2E | `e2e/navigation-and-home.spec.ts` step | ❌ W0 | ⬜ pending |
| UX-07 · D-12 | The 375px drawer shows the same sections and button; the analyst drawer does not scroll for personal items while collapsed | E2E | `e2e/navigation-and-home.spec.ts` (mobile project) plus `app-shell.spec.ts` widths | ❌ W0 / ✅ | ⬜ pending |
| UX-07 · D-14 | Guarded navigation survives the restructure: with unsaved answers, a sidebar link and the New request button warn first; the mobile sheet stays open while blocked | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/csrm/navigation-guard.test.tsx src/components/shell`; `e2e/questionnaire-workflow.spec.ts` leave-warning step (from Phase 10) | ✅ (after Phase 10) | ⬜ pending |
| UX-08 · UAT-001 · D-16, D-18 | The analyst lands on Home with the queue, deadlines, jobs and alerts first and their own requests secondary; the Requestor lands on the Requestor Home; both are headed "Home" | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/home src/features/analyst-dashboard/analyst-dashboard.test.tsx`; E2E first-screen checks at 375px and 1440px | ❌ W0 / ✅ | ⬜ pending |
| UX-08 · D-16 (T-11-01) | A Requestor at `/app` issues no analyst read, fixture or partial selector | web unit | `pnpm --filter @csrm/web exec vitest run src/lib/testing/e2e-ui-state-route-authorization.test.tsx` | ✅ (moves) | ⬜ pending |
| UX-08 · D-17 | `GET /app/review` answers 307 to `/app` (query kept), and a browser lands on the Home heading as an analyst and as a Requestor. `/app/review/requests` is unaffected | E2E | `e2e/navigation-and-home.spec.ts`: `request.get('/app/review', { maxRedirects: 0 })` status and `location`; `page.goto('/app/review')` heading | ❌ W0 | ⬜ pending |
| UX-08 · UAT-003 · D-19, D-20, D-21 | "Needs your action" holds drafts (with the return reason) and questionnaires to answer (with progress); "With the Security Analyst" holds the rest, naming the Security Analyst and the days since submission; the stored-status tiles are gone | web unit + Strapi integration + E2E | `pnpm --filter @csrm/web exec vitest run src/features/home`; quick run `my-requests.integration.test.js` (the holder equals the lifecycle for fixtures at every step); `e2e/navigation-and-home.spec.ts` | ❌ W0 | ⬜ pending |
| UX-08 · UAT-004 · D-22 | At 375×812 the first content after the header is Needs your action, and it starts within the first screen | E2E | `e2e/navigation-and-home.spec.ts` (mobile project): the section's bounding box starts above 812px; DOM order | ❌ W0 | ⬜ pending |
| UX-08 · D-23 | Both variants render the five states through the guarded fixtures, and the new Requestor partial selector fails one section while the others render | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/lib/testing/e2e-ui-state.test.ts src/features/home`; `e2e/design-system-conformance.spec.ts` partial proof re-targeted | ✅ / ❌ W0 | ⬜ pending |
| UX-08 · D-25 | Recovery links read Home, not workspace, on the permission state, both not-found pages, the Risk detail permission state and the queue error | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/states/states.test.tsx src/lib/security/root-fallbacks.test.tsx`; the E2E rows in research "E2E and copy assertions that change" | ✅ | ⬜ pending |
| UX-08 · UAT-038 · D-26, D-28 | Below 768px the stepper shows the heading, "Step n of m", the next action (and the job override on the analyst hub) and a "Show all steps" disclosure with `aria-expanded`; from 768px the full stepper | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/requests/request-lifecycle-stepper.test.tsx src/features/assessments/assessment-review-workflow.test.tsx`; 375px journey on both request pages; the next action within the first screen | ✅ | ⬜ pending |
| UX-08 · D-27 (C5) | `nextAction.holder` is served for every step and actor; no copy says "the other party"; the parser is closed | Strapi unit + integration, web unit | quick run `request-lifecycle.unit.test.js`, `request-workflow.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/requests/request-hub.test.tsx src/features/contract-response-parity.test.ts`; `api:check` | ✅ | ⬜ pending |
| UX-09 · UAT-035 · D-29, D-30 (C1) | The queue item carries the requestor, type, criticality, due date and days since submission; `q` finds by number and by title; `all` returns reviewable and released requests and never a draft | Strapi unit + integration, web unit, E2E | quick run `review-queue.unit.test.js`, `review-queue-buckets.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/assessments/assessment-list.test.tsx`; E2E: the columns at 1440px, the cards at 375px, search by request number | ✅ | ⬜ pending |
| UX-09 · UAT-035 · D-31 (C2) | The assessment item carries the request title, Risk count and highest residual rating (off-ladder ignored); search by request title works on both lists; the owner list stays released-only | Strapi integration, web unit, E2E | quick run `assessment-workflow.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/assessments`; E2E search "payroll"-style by title | ✅ | ⬜ pending |
| UX-09 · UAT-048 · D-32 | The Related assessment picker finds an assessment by request title through the server, beyond the first 25 | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-actions.test.ts src/features/risks/risk-service.test.ts`; `e2e/risk-register-workflow.spec.ts` step | ✅ | ⬜ pending |
| UX-09 · D-34 (C6) | My requests reads `GET /v1/my_requests` with search, status, holder, sort and pagination, and each row shows its holder and next step | Strapi integration, web unit, E2E | quick run `my-requests.integration.test.js`; `pnpm --filter @csrm/web exec vitest run src/features/requests`; `e2e/requestor-request-workflow.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| UX-09 · UAT-048 · D-35 to D-39 | Every figure on both Homes and the four reports carries an href or is a documented sum; each kind's figure equals its list total; control-implementation figures open the Risks that hold them with honest link text; the median opens its period's releases | web unit + E2E | the figure-link audit unit (`src/features/reports`, `src/features/analyst-dashboard`, `src/features/home`); `e2e/analyst-insights.spec.ts` equality steps (exposure, throughput month, queue `all` by status, due state, accepted) | ❌ W0 (audit) / ✅ | ⬜ pending |
| UX-09 · D-38 | The treatment report's window is 14 days, and its due-state figures equal the Risk Register's `dueState` totals and the due-soon alert total | Strapi integration + unit | quick run `analyst-reports.integration.test.js` (fixture moved to today+14), `analyst-insights.unit.test.js` (constant) | ✅ | ⬜ pending |
| UX-09 · UAT-065 · D-46 | "Released" in the badge, filters, chips, throughput rows, Home and My requests; `status=approved` still filters; root `CONTEXT.md` updated | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/csrm/status-badge.test.tsx src/features/assessments src/features/reports`; `e2e/assessment-navigation-lifecycle.spec.ts`; `grep -n "Approved" CONTEXT.md` reviewed | ✅ | ⬜ pending |
| UX-10 · D-47, D-48 | Ctrl+K and ⌘K toggle the dialog; the header control opens it; focus starts in the input; arrows move the active option; Enter opens; Escape closes and restores focus; no cmdk client filter or vim bindings; the title is inside the dialog; the live region announces the counts | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/quick-find src/components/shell`; `e2e/quick-find.spec.ts` at 1440px and 375px; axe with the dialog open | ❌ W0 | ⬜ pending |
| UX-10 · D-49, D-50 (T-11-09, T-11-10) | The action validates the term (2 to 100 characters), asks only the lists the capabilities allow, five each, through existing service functions; one call in flight; stale results dropped | web unit | `pnpm --filter @csrm/web exec vitest run src/features/quick-find src/features/contract-operation-chain.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| UX-10 · D-49 (scope) | As the Secondary Requestor, Jane's request title and number find nothing; as Jane, her request opens with Enter | E2E | `e2e/quick-find.spec.ts` | ❌ W0 | ⬜ pending |
| UX-10 · D-51 | Opening a result with unsaved answers shows the leave warning first | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/csrm/navigation-guard.test.tsx src/features/quick-find`; the quick-find journey step on a questionnaire | ✅ (after Phase 10) / ❌ W0 | ⬜ pending |
| UX-10 · D-52 | The shell's first-load JavaScript stays within 300 KB on every key route; the dialog code loads on demand | E2E | `e2e/performance.spec.ts` (budgets) | ✅ | ⬜ pending |
| DASH-03 · UAT-060 · D-40, D-41 (C3, C4) | Released plus under assessment equals the Risk Register scope, and the two are disjoint; a partial release is in neither; accepted means released, open and Accept; a draft's Accept never counts | Strapi integration | quick run `risk-register.integration.test.js`, `analyst-dashboard.integration.test.js`, `analyst-reports.integration.test.js` | ✅ | ⬜ pending |
| DASH-03 · D-42, D-44 | The exposure widget and report default to released Risks, show under assessment separately, mark accepted Risks and state their scope in words; Risk Register rows mark stage and accepted state in text | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/analyst-dashboard src/features/reports src/features/risks`; `e2e/analyst-insights.spec.ts` (scope text, accepted marker on the D-45 seed Risk, equality) | ✅ | ⬜ pending |
| DASH-03 · D-43 | Treatments due, Upcoming due dates, Top alerts and the treatment and control reports say they include Risks under assessment | web unit | `pnpm --filter @csrm/web exec vitest run src/features/analyst-dashboard src/features/reports` | ✅ | ⬜ pending |
| D-54 | The dashboard, report and Risk Register files pass the interface copy guard (no "contextual"); `report-copy.json` equals the served definitions | web unit + Strapi integration | `pnpm --filter @csrm/web exec vitest run src/lib/performance/interface-copy-guard.test.ts`; quick run `analyst-reports.integration.test.js` | ✅ (after Phase 10) | ⬜ pending |
| D-55 | Instants on the queue, My requests, Home, Recent activity and My risk assessments render in the viewer's zone (Brisbane in E2E); calendar dates and report buckets stay zone-free | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/assessments src/features/requests src/features/home src/features/analyst-dashboard`; one E2E with `timezoneId: 'Australia/Brisbane'` reading a list date | ✅ | ⬜ pending |
| D-01 | No content-type schema changes | static | the phase gate's freeze check | ✅ | ⬜ pending |
| D-02, D-03 | The chain holds for C1 to C6: the specification, a clean `api:check`, the parity and chain guards, the matrix row, served operations regenerated, catalogue copies identical | web unit + Strapi | `api:check`; `pnpm --filter @csrm/web exec vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; quick run `authorization-matrix.integration.test.js`, `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `cmp` | ✅ | ⬜ pending |
| D-56 to D-58 | Failing tests first; deliberate E2E changes named per plan; the clean-tree gate; the browser checks | process + gate | plan review (plan check Dimension 8) and plan 11-15 | — | ⬜ pending |

---

## Wave 0 Requirements

Each plan creates its test file in its first RED task.

- [ ] `apps/web/src/config/navigation/navigation.test.ts`: the profiles, sections, labels equal to headings, and the collapsible section's open rule (plans 11-02 and 11-03). UX-07.
- [ ] `apps/web/src/components/shell/navigation-counts.test.ts`: the capability-chosen reads, fail-soft, and a zero hidden (plan 11-10). UX-07.
- [ ] `apps/web/src/features/home/*.test.tsx`: variant selection, the analyst order, the Requestor sections and the 375px DOM order (plans 11-02 and 11-09). UX-08.
- [ ] `apps/web/src/features/quick-find/*.test.ts(x)`: the action (validation, capability lists, bounds, hrefs) and the dialog (keyboard, live region, guard) (plan 11-14). UX-10.
- [ ] The figure-link audit test beside the report and Home presentation modules (plan 11-13). UX-09.
- [ ] `apps/web/e2e/navigation-and-home.spec.ts`, with `@journey` so the mobile project runs it (plans 11-02, 11-03, 11-09 and 11-10). UX-07, UX-08.
- [ ] `apps/web/e2e/quick-find.spec.ts`, with `@journey` (plan 11-14). UX-10.
- [ ] `apps/strapi/tests/my-requests.integration.test.ts`, plus a unit file for the query parser if the planner splits it (plan 11-08). UX-08, UX-09.

*No framework install is needed: vitest, `node:test` and Playwright are in place.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The premium experience bar: layout quality, density, spacing and hierarchy of both Homes, the sectioned sidebar, the lists and quick find | G-4; UX-07, UX-08, UX-09, UX-10 | Visual judgement beyond axe and overflow checks | Plan 11-15: with the servers up, sign in as Jane, Maya and Bob; view Home, the sidebar (desktop and drawer), a request page, the queue, the assessment list, the Risk Register, one report and quick find at 375px and 1440px; record screenshots and findings |
| Screen-reader output for the sidebar counts, the stepper disclosure and the quick-find result announcements | UX-07, UX-08, UX-10 | axe checks names and roles, not how announcements sound | NVDA with Chrome on Windows: tab through the sidebar (each count read with its meaning), expand "Show all steps" (expanded state announced), type in quick find (result count announced once per search) |
| ⌘K on macOS Safari and Firefox | UX-10 (A4) | The E2E runs Chromium only | On a Mac, press ⌘K on Home and on a questionnaire page: the dialog toggles, and the browser's own binding does not fire |
| The UAT-A, UAT-B and UAT-C baselines read correctly in the operator's development database | UAT-001, UAT-003, UAT-035, UAT-060, UAT-065 | The records live only in the operator's database, which tests must not change | After the orchestrator restarts the servers on the finished phase: read Bob's Home, Jane's Home at 375px, the queue columns, UAT-C's risks as under assessment, and "Released" on Jane's requests |
| The accepted seed Risk in the development database | D-45 | Seeds reach the development database only on the orchestrator's Strapi restart | After the restart, the Risk exposure widget shows one accepted Risk marker from `seed-analyst-insights.ts` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s at task level
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
