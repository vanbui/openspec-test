---
phase: 11-navigation-landing-and-list-clarity
plan: 02
subsystem: ui
tags: [home, navigation, redirect, nextjs, app-router, vitest, playwright]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-01: the Released request label and PHASE_11_BASE=9f95575"
provides:
  - "/app is Home for every actor: heading Home, title Home | IdamBox CSRM, chosen from the session's capabilities before any data read"
  - "features/home: HomePageHeader, AnalystHomeContent, RequestorHomeContent and RequestorHomeSkeleton"
  - "next.config.ts redirects() with the one /app/review -> /app 307 rule (query kept)"
  - "navigation: the /app item is Home (HouseIcon); no Analyst dashboard item; homeHref"
  - "analystDashboardCopy without title or description; area 'the review summary'; loadingLabel 'Loading Home'; analystHomePermissionAction (Return to sign in)"
  - "every E2E sign-in proves the level-one Home heading and the role in the banner; the guard pins HOME_HEADING"
  - "e2e/navigation-and-home.spec.ts (@journey, on the mobile project's testMatch list)"
affects: [11-03, 11-05, 11-09, 11-10, 11-12, 11-14, 11-19, 11-21]

actuals:
  tokens: 32900
  tasks: 2
  commits: 4
plan_head_before: 064593a029eef82d891ac32e875c6cce702de7c0
plan_head_after: c0a991476a7ed319cdaa439a0f1b112dbb2b5706

tech-stack:
  added: []
  patterns:
    - "A route that serves several actors reads the session's capabilities (no Strapi read), picks the variant, then streams that variant behind its own Suspense skeleton; each variant's content keeps its own gate"
    - "A retired route is a next.config.ts redirect with a literal source and a fixed destination, proved by a unit test of redirects() and a maxRedirects: 0 request in the browser suite"

key-files:
  created:
    - apps/csrm/src/features/home/home-page-header.tsx
    - apps/csrm/src/features/home/analyst-home.tsx
    - apps/csrm/src/features/home/requestor-home.tsx
    - apps/csrm/src/features/home/home-page.test.tsx
    - apps/csrm/src/lib/security/next-config-redirects.test.ts
    - apps/csrm/e2e/navigation-and-home.spec.ts
  modified:
    - apps/csrm/app/(app)/app/page.tsx
    - apps/csrm/app/(app)/app/loading.tsx
    - apps/csrm/app/(app)/app/error.tsx
    - apps/csrm/next.config.ts
    - apps/csrm/src/config/navigation/navigation.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.tsx
    - apps/csrm/playwright.config.ts
    - apps/csrm/e2e/helpers/navigation.ts
    - apps/csrm/src/lib/testing/e2e-sign-in-assertions.test.ts
    - apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
  deleted:
    - apps/csrm/app/(app)/app/review/(analyst-dashboard)/page.tsx
    - apps/csrm/app/(app)/app/review/(analyst-dashboard)/loading.tsx
    - apps/csrm/app/(app)/app/review/(analyst-dashboard)/error.tsx
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-page-header.tsx

key-decisions:
  - "11-02: /app chooses the analyst Home for assessment:review and the Requestor Home otherwise, from the session's capabilities before any read; the choice is presentation only, and AnalystHomeContent keeps its own capability gate (T-11-01, T-11-14)"
  - "11-02: HomePageHeader takes an optional variant; the loading and error boundaries pass withAction={false} without a variant, because they render before the page knows which Home it is"
  - "11-02: /app's error boundary takes Next 16.3's retry (re-fetch and re-render), as the retired analyst boundary did, instead of the plan's reset; its heading stays the ErrorState default until plan 11-03"
  - "11-02: the analyst Home's permission action is analystHomePermissionAction (Return to sign in -> /sign-in), shared by AnalystDashboard and the AnalystHomeContent gate (UI-D19)"
  - "11-02: the Requestor Home's state matrix, type scan and rating-count repair points in design-system-conformance.spec.ts sign in as the Requestor; the analyst Home replaces /app/review in the Phase 7 matrix; /app leaves the Phase 6 (analyst) matrix"
  - "11-02: performance.spec.ts measures /app once per actor; test titles and the JSON record carry the actor"
  - "11-02: UX-08 stays open: requirements.ready-ids reports 0/1 ready, since later Phase 11 plans also declare it"

patterns-established:
  - "Home variants: features/home holds each actor's Home content; app/(app)/app/page.tsx only reads the session and composes"

requirements-completed: []

coverage:
  - id: D1
    description: "/app is Home for every actor, chosen from the session's capabilities before any read; a Requestor issues no analyst read, fixture or partial selector, and each variant streams behind its own skeleton"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/home/home-page.test.tsx#Home at /app (6 tests)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx#gives a Requestor at /app the Requestor Home before any analyst read, analyst fixture or partial selector"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#Home and navigation @journey (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /app/review answers 307 to /app with its query, before the proxy; every actor's browser lands on Home; /app/review/requests is not redirected"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/security/next-config-redirects.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX08_REVIEW_REDIRECTS_TO_HOME (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The analyst dashboard route group, its boundaries, its header and the Analyst dashboard navigation item are gone; the /app item reads Home"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx#shipped Home navigation"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx#Analyst Home route files"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Requestor Home header carries New request at every width and spans the header below 768px; the analyst Home header has none"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/home/home-page.test.tsx#gives a Requestor the Requestor Home with New request"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#the Requestor signs in to Home with New request in its header ([mobile] measures the span at 375)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The analyst Home's copy: the review summary, Loading Home, Return to sign in; /app's loading boundary is the header alone and its error boundary retries"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts#analyst Home copy"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx#AnalystDashboard, page states"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/home/home-page.test.tsx#loads with the Home header alone; recovers from a route error"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every E2E sign-in proves the level-one Home heading and the role in the banner, and the guard enforces it"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/testing/e2e-sign-in-assertions.test.ts"
        status: pass
      - kind: e2e
        ref: "pnpm --dir apps/csrm test:e2e (full suite, 96 passed)"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 02: One Home at /app Summary

**Every actor now signs in to one Home at `/app`. The session's capabilities choose the analyst Home (the review summary that was at `/app/review`) or the Requestor Home before any data read. `/app/review` is a 307 to Home from `next.config.ts`, and the Analyst dashboard name, route group and navigation item are gone.**

## Performance

- **Duration:** 36 min (wall clock; it includes two targeted Playwright runs, the 13.2-minute full run and the full web suite)
- **Started:** 2026-10-03T00:40:45Z
- **Completed:** 2026-10-03T01:17:00Z
- **Tasks:** 2 of 2
- **Files changed:** 31 (6 created, 4 deleted, 21 modified)

## Accomplishments

- `app/(app)/app/page.tsx` is `HomePage`. It reads `getSessionAdapter().current()` and the session's capabilities from the cookie, with no Strapi read. It sets `analyst = can('assessment:review', granted)`, renders `HomePageHeader`, then a `Suspense` whose fallback is that variant's own skeleton (`AnalystDashboardSkeleton` or `RequestorHomeSkeleton`) around `AnalystHomeContent` or `RequestorHomeContent`. Metadata: `Home | IdamBox CSRM`.
- `features/home/analyst-home.tsx`: `AnalystHomeContent` is the analyst dashboard content moved from the route group. Its own `assessment:review` gate, its guarded fixtures and the `analyst-top-alerts-error` partial are kept, and they still resolve only after the real reads succeed.
- `features/home/requestor-home.tsx`: `RequestorHomeContent` is today's Requestor flow without its header: the fixture ladder, `emptyDashboardState` and the `draft-requests-error` partial. `RequestorHomeSkeleton` is the loading dashboard. Plan 11-09 rebuilds the sections.
- `features/home/home-page-header.tsx`: `HomePageHeader` renders the heading `Home` and the description `What needs your action, and where your work stands.`. The Requestor variant adds the primary `New request` link to `/app/requests/new`, which spans the header below 768px through the existing `.page-header-actions` rule. The analyst variant has no action.
- `next.config.ts`: `redirects()` returns `[{ source: '/app/review', destination: '/app', permanent: false }]`.
- `/app` boundaries: `loading.tsx` is `HomePageHeader withAction={false}` and nothing else. `error.tsx` is the same header plus `ErrorState retry={retry}`.
- Analyst copy: `analystDashboardCopy` loses `title` and `description`. Its area is `the review summary` and its loading label `Loading Home`. Both permission states (a refused read and the gate's own refusal) offer `Return to sign in` → `/sign-in`.
- Navigation: `{ href:'/app', label:'Home', capability:'assessment-request:read', icon:HouseIcon }`. The `/app/review` item, `ActivityIcon` and `LayoutDashboardIcon` are gone, and `workspaceHref` is now `homeHref`.
- Sign-ins: `signInAs` and the seven spec-local sign-ins assert `getByRole('heading', { level: 1, name: 'Home', exact: true })` and the role in the banner. The ordinary-server check (E2) reads `Home`. `e2e-sign-in-assertions.test.ts` pins `HOME_HEADING`.

**For the orchestrator (UI-SPEC Notes carried):** the standing instruction "E2E sign-in helpers assert the Dashboard heading" now reads "E2E sign-in helpers assert **the level-one Home heading and the role in the banner**".

## Task Commits

1. **Task 1: /app picks its Home before any read, and both actors sign in to it (tracer, TDD)**
   - `5a16e80`: test(11-02), RED
   - `6cdf663`: feat(11-02), GREEN
2. **Task 2: Retire the analyst dashboard route and name, move every route assertion to Home, then run every journey (TDD)**
   - `95466d4`: test(11-02), RED
   - `c0a9914`: feat(11-02), GREEN

Commits measured from the ledger: `git rev-list --count 064593a..c0a9914` = 4. All four end with the required `Co-Authored-By` trailer (checked with grep).

## TDD Gate Compliance

- Task 1: RED `5a16e80` comes before GREEN `6cdf663`. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed) for `home-page.test.tsx`, "gives a Requestor the Requestor Home with New request…": no heading named Home, because the page still rendered Dashboard. The RED run failed 5 tests, all on assertions: the four home-page cases and the sign-in guard's 7 `SIGN_IN_WITHOUT_SHELL` findings. `e2e-ui-state-route-authorization.test.tsx` failed at import, as expected, because `@/features/home/analyst-home` did not exist yet.
- Task 2: RED `95466d4` comes before GREEN `c0a9914`. `RED_EVIDENCE_OK` for `analyst-dashboard-presentation.test.ts`, "analyst Home copy > names its loading label…" (the copy still carried `title: 'Analyst dashboard'`). The RED run failed 26 of 191 tests, every one on copy, navigation or boundary assertions.
- One planned RED test passed at RED: `next-config-redirects.test.ts`. Task 1's GREEN adds the redirect, as the plan orders, so in Task 2 this test locks the rule as a regression check rather than driving it. It is recorded here and not hidden.
- No refactor commit was needed.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (home, route-fixture test, sign-in guard) | 5 failed, 3 passed (8); route-fixture file failed at import as expected |
| Task 1 GREEN (home, route-fixture, sign-in guard, all of `src/features/analyst-dashboard`) | 6 files, 120/120; typecheck clean |
| Task 1 Playwright `navigation-and-home.spec.ts` | 6 passed (desktop 3, mobile 3), 0 failed, 0 flaky, 0 skipped; 48.8 s |
| Tracer gate re-run of the Task 1 verify | 3 files, 38/38; typecheck clean; Playwright 6 passed (desktop 3, mobile 3); 48.2 s |
| Task 2 RED (12 files) | 26 failed, 165 passed (191) |
| Task 2 GREEN (redirects, analyst-dashboard, home, shell, zod boundary, `src/lib/testing`) | 19 files, 259/259; typecheck clean |
| Task 2 Playwright `navigation-and-home`, `accessibility`, `analyst-insights` | 30 passed (desktop 26, mobile 4), 0 failed, 0 flaky, 0 skipped; 4.1 min |
| **Full Playwright suite** (`pnpm --dir apps/csrm test:e2e`, production build) | **96 passed: desktop 88, mobile 8; 0 failed, 0 flaky, 0 skipped; 13.2 min** (01:01:59Z to 01:15:11Z). `[mobile]` for `navigation-and-home.spec.ts`: 4 passed. `git status --short` was identical before and after the run |
| Full web suite (`pnpm --dir apps/csrm test`) | 136 files, 2,870/2,870 passed |
| `typecheck` and `lint` (`next typegen && tsc --noEmit`) | clean |
| `api:check` | exit 0; `schema.d.ts` unchanged after `git update-index --refresh` (no contract change) |

The Strapi suite was not run: this plan changes no Strapi file.

## E2E Assertions Changed

Listed in the plan (E1 to E5, §14.3):
- E1/E2: `helpers/navigation.ts`, `analyst-insights.spec.ts`, `app-shell.spec.ts` (it also gains `exact: true`), `design-contract.spec.ts`, `design-system-conformance.spec.ts` (two sign-ins and the ordinary server's heading), `production-hardening.spec.ts`.
- E3/E4: `accessibility.spec.ts`: `dashboard` becomes `home` (`Home | IdamBox CSRM` / `Home`), the analyst axe sweep moves to `/app`, and the `/app/review` refusal row goes. `performance.spec.ts`: the analyst's key route is `/app`. `production-hardening.spec.ts`: `personalSteps` reads Home, and the `/app/review` analyst step and Requestor refusal step go.
- E5: `analyst-insights.spec.ts`: the `Home` item is current on `/app`, five `goto('/app/review')` calls and the partial URL move to `/app`, the `/app/review` refusal row goes, and the Requestor navigation check reads `Home`.
- §14.3: `/app` replaces `/app/review` in `phase7AuditedRoutes`, `phase7PopulatedContent` and the four-tile check.

Changed beyond the plan's list. Each was broken by this plan's route change, and each is a deliberate edit:
- `accessibility.spec.ts` "signed-in CSRM shell": the Security Analyst's `/app` is now the review summary, so its guard is `analystDashboardTiles` instead of the Requestor lifecycle cards.
- `design-system-conformance.spec.ts`:
  - `expectStateMeaning` takes the `/app` actor. The analyst Home recovers with `Try again`, and both Homes refuse with `Return to sign in`.
  - The "dashboard state matrix" and its `draft-requests-error` partial sign in as the Requestor. It gains a Requestor `/app` typography scan at 375 and 1440, so the Phase 6 matrix's old coverage of that screen is kept.
  - `/app` leaves the Phase 6 (analyst) `auditedRoutes`.
  - The Phase 7 Requestor-denial loop skips `/app`, which is the Requestor's own Home.
  - The repair-points test reads the `{rating} released assessments` counts as the Requestor, then signs in as the analyst for the rest.
- `performance.spec.ts`: `/app` is measured once per actor. Test titles carry the actor (`… as the {actor} stays within its performance budget`), and the JSON record is keyed by route and actor.
- `app-shell.spec.ts`'s sign-in now uses `exact: true`. Seven sign-in comments say Home instead of Dashboard.

## Files Created/Modified

- Created: `src/features/home/home-page-header.tsx`, `analyst-home.tsx`, `requestor-home.tsx`, `home-page.test.tsx`; `src/lib/security/next-config-redirects.test.ts`; `e2e/navigation-and-home.spec.ts`.
- Deleted (`git rm`): the three `(analyst-dashboard)` route files and `analyst-dashboard-page-header.tsx`.
- Modified:
  - Code: `app/(app)/app/page.tsx`, `loading.tsx`, `error.tsx`; `next.config.ts`; `navigation.ts`; `analyst-dashboard-presentation.ts`; `analyst-dashboard.tsx`; `playwright.config.ts`.
  - Unit tests: `analyst-dashboard.test.tsx`, `analyst-dashboard-presentation.test.ts`, `mobile-navigation.test.tsx`, `zod-client-boundary.test.ts`, `e2e-ui-state-route-authorization.test.tsx`, `e2e-sign-in-assertions.test.ts`.
  - E2E: `helpers/navigation.ts` and eight specs (accessibility, analyst-insights, app-shell, design-contract, design-system-conformance, navigation-and-home, performance, production-hardening).

## Decisions Made

- The variant is chosen in the page from the session's capabilities. That is presentation, never authorisation: `AnalystHomeContent` keeps its own gate, and Strapi authorises every read either Home makes.
- `HomePageHeader`'s `variant` is optional. The boundaries render before the variant is known, so they pass `withAction={false}` and no variant, rather than a variant chosen arbitrarily.
- `/app`'s `error.tsx` uses Next 16.3's `retry` prop, which re-fetches and re-renders, as the retired analyst boundary did. The plan's `retry={reset}` would only clear the boundary without re-fetching.
- `analystHomePermissionAction` sits beside `analystDashboardCopy`, so the component and the gate share one value. A copy-only key would have changed the `analystDashboardCopy` shape.
- `production-hardening.spec.ts`: the analyst's `/app/review` sweep step is removed, not converted to `/app`, because `personalSteps` already sweeps `/app`, now the analyst's Home, for the analyst. A second identical visit would add nothing.
- The redirect E2E checks the pathname with `expect.poll(() => new URL(page.url()).pathname)`, because the sign-in guard forbids `toHaveURL(/\/app$/)`.
- The `/app/review/requests` heading is asserted as today's `Assessment request review`. Plan 11-03 renames it.
- `UX-08` stays open: `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `analyst-dashboard.test.tsx` repointed in Task 1**
- **Found during:** Task 1, GREEN
- **Issue:** The test imported the three deleted route files, so Task 1's deletion broke it. The plan only lists the file under Task 2.
- **Fix:** The content tests import `AnalystHomeContent`. The route-file tests now check `/app`: the page gates before its `Suspense` and reads nothing itself, `analyst-home.tsx` gates, then reads, then resolves fixtures, the Home header has no action, and the route group is gone.
- **Committed in:** `6cdf663`

**2. [Rule 3 - Blocking] Stale `next dev` route types moved aside**
- **Found during:** Task 1, typecheck
- **Issue:** `.next/dev/types/validator.ts` was written by an earlier `next dev` on 2026-10-03 04:58 (gitignored). It still imported the deleted `(analyst-dashboard)/page.js`, and `tsconfig.json` includes `.next/dev/types/**/*.ts`.
- **Fix:** No dev server was running (checked with `netstat`). The four generated files were moved to the scratchpad (`p11-02-next-dev-types-backup/`), not deleted. The next `next dev` regenerates them. No tracked file changed.
- **Verification:** typecheck clean.

**3. [Rule 1 - Broken by the route change] Spec assertions beyond the plan's list**
- See "Changed beyond the plan's list" above. Each spec addressed the Requestor dashboard at `/app` as the Security Analyst, which this plan changes. Each fix keeps the original proof for the actor whose screen it is.
- **Committed in:** `c0a9914`

**4. [Format] `navigation.ts` keeps the file's compact style**
- The acceptance grep expects `label: 'Home'`, but the file writes every item compactly. It contains `label:'Home'` and `HouseIcon`, and has no `href:'/app/review',` line.

**5. [Tooling] RED evidence parser**
- As in 11-01, the gsd-core JUnit parser needs `name` before `classname`. The evidence was validated on scratch copies with the attributes reordered. Nothing in the repository was affected.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 test assertions broken by the route change), 1 format note and 1 tooling workaround.
**Impact on plan:** None of these adds scope. Each one keeps an existing proof true for the actor whose screen it is.

## Issues Encountered

- The full run's web server logged one `failed-to-find-server-action` message. It comes from a test that posts a server action the build does not have, which is expected in production-hardening. Every test passed.
- `api:check`'s `git update-index --refresh` reported "needs update" for the two operator `apps/backend/types/generated/*.d.ts` files. They are untouched and unstaged.

## Known Stubs

None. `RequestorHomeContent` renders today's Requestor dashboard sections. Plan 11-09 replaces them with the UI-SPEC §5.2 sections, as planned.

## Threat Flags

None. T-11-01 is mitigated: the variant is decided before any read, and two unit tests prove a Requestor makes no analyst read or partial. T-11-13: the redirect has a literal source and a fixed destination, and a unit test forbids patterns and absolute URLs. T-11-14: the gate is kept in `AnalystHomeContent`. T-11-SC: no package was added.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-03: the sectioned sidebar, the Go to Home recovery copy, the page-heading module and the analyst widget order.
- 11-09 rebuilds `RequestorHomeContent` and changes its partial selector to `requestor-home-with-analyst-error`. When it does, it should switch the Requestor `/app` recovery in `expectStateMeaning` to `Try again` (E17).

## Self-Check: PASSED

- The ten created or modified key files exist. The deleted route group and header file are gone.
- Commits `5a16e80`, `6cdf663`, `95466d4` and `c0a9914` exist, each with the trailer.
- Task 1 acceptance criteria all re-ran PASS:
  - `page.tsx` has `Home | IdamBox CSRM`, `can('assessment:review'` and both content imports.
  - `next.config.ts` has the `source`, `destination` and `permanent: false` values.
  - `git ls-files` of the route group prints nothing.
  - The helper has `name: 'Home', exact: true`, and the guard has `HOME_HEADING`.
  - `playwright.config.ts` lists the spec and names it in the comment, and the GREEN run reported `[mobile]` results.
- Task 2 acceptance criteria all re-ran PASS:
  - `next-config-redirects.test.ts` passes.
  - The spec has `UX08_REVIEW_REDIRECTS_TO_HOME` and `maxRedirects: 0`.
  - `navigation.ts` has the Home item and `HouseIcon`, and no `/app/review` item (format note above).
  - The case-sensitive `Analyst dashboard|Analyst Dashboard` grep over non-test `src` and `app` files prints nothing.
  - The full Playwright run has no failure, and the tree is clean.
- `git status --short` shows only the three operator items.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
