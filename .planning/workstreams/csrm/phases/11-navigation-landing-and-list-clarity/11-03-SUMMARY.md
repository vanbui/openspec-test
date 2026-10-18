---
phase: 11-navigation-landing-and-list-clarity
plan: 03
subsystem: ui
tags: [home, analyst-home, local-time, copy, copy-guard, nextjs, vitest, playwright]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-02: the analyst Home at /app (features/home/analyst-home.tsx over features/analyst-dashboard), navigation-and-home.spec.ts on the mobile project's testMatch"
  - phase: 10-existing-flow-gap-closure
    provides: "10-01: LocalInstant and TimeZoneProvider in components/csrm/local-time.tsx; 10-02: the D-38 interface copy guard and the shared permission description"
provides:
  - "dashboardWidgetOrder in D-18 order: reviewQueue, treatmentsDue, upcomingDueDates, topAlerts, riskExposure, highCritical, recentActivity"
  - "Needs action tiles two by two below xl, four in a row from xl (page and skeleton), so the Review queue starts within the first 375x812 screen"
  - "Recent activity dates through LocalInstant style=date; ActivityRow keeps dateTime only; the UTC dateFormat is gone"
  - "UI-SPEC §2.4 copy: Loading… / Getting this page ready.; We couldn’t load this page; Home shows the work you can open…; default Go to Home -> /app"
  - "Go to Home in both not-found pages, the Requests error boundary and the Risk detail refusal"
  - "the copy guard refuses 'workspace' and scans both not-found pages and the Requests error boundary"
  - "UX08_ANALYST_PHONE_FIRST_SCREEN in navigation-and-home.spec.ts (@journey, desktop and mobile)"
affects: [11-04, 11-09, 11-12, 11-14, 11-16, 11-17, 11-21]

actuals:
  tokens: 5000
  tasks: 2
  commits: 4
plan_head_before: 481b97454ccc0609e58a773a1856957776a8873c
plan_head_after: 1a8efca2b79b6e07efdd0d91f4d365b388310f1c

tech-stack:
  added: []
  patterns:
    - "A widget row renders an instant through LocalInstant from the presentation's dateTime; the presentation never formats an instant itself"
    - "A shared state's default recovery is a StateAction constant (goToHome) rendered through the same StateActionLink as a caller's action"

key-files:
  created: []
  modified:
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.tsx
    - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
    - apps/csrm/src/components/states/states.tsx
    - apps/csrm/app/(app)/not-found.tsx
    - apps/csrm/app/not-found.tsx
    - apps/csrm/app/(app)/app/review/requests/error.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/navigation-and-home.spec.ts
    - apps/csrm/e2e/analyst-insights.spec.ts

key-decisions:
  - "11-03: UX08_ANALYST_PHONE_FIRST_SCREEN sits inside the @journey describe and reads the project's own width: the mobile project proves the Review queue region starts above 812px and its heading ends within 812px, with the tiles in two rows; the desktop project proves one row of four at 1440; both prove Review queue is the first widget heading and no tile's text overflows its tile"
  - "11-03: the Requests error boundary (app/(app)/app/review/requests/error.tsx) joins the copy guard with the two not-found pages, because this plan cleans it of 'workspace' too"
  - "11-03: the Risk detail refusal keeps 'Risk Register' casing ('The Risk Register is for Security Analysts. Home shows the work you can open.'); plan 11-04 changes the casing"
  - "11-03: PermissionDeniedState's default action is a goToHome StateAction rendered by StateActionLink, the same outline link as before"
  - "11-03: UX-08 stays open: requirements.ready-ids reports 0/1 ready, because later Phase 11 plans also declare it"

patterns-established:
  - "Recovery copy: a refusal or a not-found recovers with 'Go to Home' to /app; only a surface that is itself Home recovers with 'Return to sign in' (UI-D19)"

requirements-completed: []

coverage:
  - id: D1
    description: "The analyst Home leads with the Review queue: widgets in D-18 order after the Needs action tiles, in the page and its skeleton"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts#dashboard widgets > leads with the queue, then deadlines and alerts, then exposure and activity (D-18, UI-SPEC §5.3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx#follows the tiles with the seven widgets in D-18 order, led by the Review queue; loads as a labelled skeleton of four tiles and seven widgets in the final layout"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/analyst-insights.spec.ts#analyst dashboard shows what needs attention and every tile equals the list it opens (E6 h2 order)"
        status: pass
    human_judgment: false
  - id: D2
    description: "At 375x812 the four tiles sit two by two and the Review queue starts within the first screen; at 1440 they sit in one row"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx#leads with a visually hidden Needs action heading over a list of four linked tiles (grid-cols-2 xl:grid-cols-4)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX08_ANALYST_PHONE_FIRST_SCREEN ([mobile] 375x812 and [desktop] 1440x900)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Recent activity dates render in the viewer's time zone through LocalInstant, in a <time dateTime>"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx#dates recent activity in the viewer’s time zone, keeping the instant machine-readable (D-55, X-3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts#links each event to the analyst route for its record and keeps its instant for the viewer’s zone (D-55)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No product copy says workspace: the shared states, both not-found pages, the Requests error boundary and the Risk detail refusal use the UI-SPEC §2.4 strings and Go to Home"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/states/states.test.tsx; src/lib/security/root-fallbacks.test.tsx; src/features/risks/risk-details.test.tsx; request-routes, alerts, reports, administration and requestor-dashboard tests"
        status: pass
      - kind: e2e
        ref: "pnpm --dir apps/csrm test:e2e (full suite, 98 passed: desktop 89, mobile 9)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The copy guard refuses 'workspace' in user-visible strings of the guarded files, names file, line and term, and ignores names such as AdministrationWorkspace"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts (RED run named all ten findings; GREEN passes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The two-by-two tiles read well at the widths between 375 and 1279px (tile captions and supporting lines wrap in the subgrid)"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX08_ANALYST_PHONE_FIRST_SCREEN (no tile overflows at 375 and 1440)"
        status: pass
    human_judgment: true
    rationale: "Overflow is measured only at 375 and 1440; the visual quality of the two-column tiles at intermediate widths (for example 640 to 1279px) is not asserted and needs a reviewer's eye"

duration: 23min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 03: The analyst Home leads with the queue, and Home replaces workspace Summary

**On a phone, the analyst's Home now opens on the Review queue: the four Needs action tiles sit two by two below xl, and the widgets follow D-18 (queue, then deadlines and alerts, then exposure, then activity). Recent activity dates render in the viewer's time zone through `LocalInstant`. Every recovery link now reads "Go to Home", the generic states name no page, and the copy guard refuses "workspace".**

## Performance

- **Duration:** 23 min (wall clock, including three Playwright runs and the full web suite)
- **Started:** 2026-10-03T01:21:45Z
- **Completed:** 2026-10-03T01:45:02Z
- **Tasks:** 2 of 2
- **Files changed:** 27 (all modified; none created or deleted)

## Accomplishments

- `dashboardWidgetOrder` is `reviewQueue, treatmentsDue, upcomingDueDates, topAlerts, riskExposure, highCritical, recentActivity` (D-18). Recent activity still spans both columns from lg, and the skeleton follows the same order and spans.
- `kpiStripClassName` is `grid-cols-2 xl:grid-cols-4` (it was `sm:grid-cols-2 xl:grid-cols-4`), and the page and the skeleton share it (UI-D20).
- Recent activity renders `<LocalInstant style="date" value={row.dateTime} />`, which renders its own `<time dateTime>`. `ActivityRow` no longer carries `date`, and the module-level UTC `dateFormat` is deleted because nothing else read it (D-55, X-3). Outside a `TimeZoneProvider` the date is still UTC, as `LocalInstant` defines.
- `states.tsx`:
  - `LoadingState` reads `Loading…` and `Getting this page ready.`.
  - `ErrorState`'s default heading is `We couldn’t load this page`.
  - `PermissionDeniedState`'s description is `Home shows the work you can open. If you think you should have access, contact your administrator.`, and its default action is `Go to Home` → `/app`.
- Both not-found pages, the Requests list error boundary and the Risk detail permission state offer `Go to Home`. The Risk detail body reads `The Risk Register is for Security Analysts. Home shows the work you can open.`
- The copy guard has the term `workspace`. It now also scans `app/(app)/not-found.tsx`, `app/not-found.tsx` and `app/(app)/app/review/requests/error.tsx`, and `states.tsx` was already on its list. A new case proves it reads the term in copy and never in a name such as `AdministrationWorkspace`.
- E6 and E7 are changed in the E2E suite, and `UX08_ANALYST_PHONE_FIRST_SCREEN` is new.

## Task Commits

1. **Task 1: The analyst's phone Home opens on the queue, with activity in local time (tracer, TDD)**
   - `820fafb`: test(11-03), RED
   - `f4866c1`: feat(11-03), GREEN
2. **Task 2: "Workspace" leaves the product copy, guarded, then run every journey (TDD)**
   - `fadd10c`: test(11-03), RED
   - `1a8efca`: feat(11-03), GREEN

The ledger count is `git rev-list --count 481b974..1a8efca` = 4. All four commits end with the required `Co-Authored-By` trailer, checked with grep.

## TDD Gate Compliance

- **Task 1:** RED `820fafb` comes before GREEN `f4866c1`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed) for `analyst-dashboard-presentation.test.ts`, "dashboard widgets > leads with the queue…". The order it received was the old §2.2 order.
  - The RED run failed 6 of 90 tests, every one on an assertion: the order (twice), the tile class (twice), the activity view's `date`, and the Brisbane date. The Brisbane case found `24 Sept 2026` (UTC), not `25 Sept 2026`.
- **Task 2:** RED `fadd10c` comes before GREEN `1a8efca`.
  - `RED_EVIDENCE_OK` for `states.test.tsx`, "announces errors, invokes retry, and sends denied users to Home…".
  - The RED run failed 23 of 361 tests, every one on copy. The guard named all ten findings, each as file, line and term, for example `src/components/states/states.tsx:53 "workspace" in "Loading workspace…"`.
- As in 11-01 and 11-02, the gsd-core JUnit parser needs `name` before `classname`. The evidence was checked against copies in the scratchpad with the attributes reordered. Nothing in the repository changed.
- No refactor commit was needed.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The full Task 1 verify command was re-run after the GREEN commit and passed (below), and Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (`src/features/analyst-dashboard`, `src/features/home`) | 6 failed, 84 passed (90) |
| Task 1 GREEN, same files | 4 files, 90/90; typecheck clean |
| Task 1 Playwright `navigation-and-home.spec.ts` and `analyst-insights.spec.ts` | 19 passed (desktop 14, mobile 5), 0 failed, 0 flaky, 0 skipped; 1.4 min. `git status` showed nothing the run changed |
| Tracer re-run of the Task 1 verify command | 90/90; typecheck clean; Playwright 19 passed (desktop 14, mobile 5), 0 failed, 0 flaky, 0 skipped; 1.4 min |
| Task 2 RED (states, root-fallbacks, administration, alerts, analyst-dashboard, reports-pages, request-routes, risk-details, copy guard, requestor-dashboard) | 23 failed, 338 passed (361) |
| Task 2 GREEN, same files | 16 files, 361/361; typecheck clean |
| Full web suite (`pnpm --dir apps/csrm test`) | 136 files, 2,875/2,875 |
| `lint` (`next typegen && tsc --noEmit`) | clean |
| **Full Playwright suite** (`pnpm --dir apps/csrm test:e2e`, production build) | **98 passed: desktop 89, mobile 9; 0 failed, 0 flaky, 0 skipped; 13.2 min** (01:31:07Z to 01:44:20Z). `[mobile]` `navigation-and-home.spec.ts`: 5 passed, including `UX08_ANALYST_PHONE_FIRST_SCREEN`. `git status --short` was identical before and after the run |
| `api:check` | exit 0; `schema.d.ts` unchanged after `git update-index --refresh` (no contract change) |

The Strapi suite was not run, because this plan changes no Strapi file.

## E2E Assertions Changed

Listed in the plan:
- E6: `analyst-insights.spec.ts` `dashboardWidgets` follows the D-18 order. The h2 check after `Needs action` uses it.
- E7: `Return to workspace` → `Go to Home`:
  - `accessibility.spec.ts`: the in-shell not-found row, the Secondary Requestor on Jane's assessment, and the signed-out root not-found. These are today's lines 436, 492 and 504; the plan's 429, 485 and 497 had drifted. Each line carries the label twice (the `shows` label and the link name).
  - `administration-workflow.spec.ts:99`
  - `analyst-insights.spec.ts:710`
  - `app-shell.spec.ts:9`
  - `assessment-navigation-lifecycle.spec.ts:194, 229`
  - `design-contract.spec.ts:201`: the link name and the assertion message.
  - `design-system-conformance.spec.ts`: lines 135, 904 and 907.
- New: `navigation-and-home.spec.ts` `UX08_ANALYST_PHONE_FIRST_SCREEN`.

Changed beyond the plan's list:
- `design-system-conformance.spec.ts:128`: a comment that quoted the old label now quotes `Go to Home`.
- A grep of `apps/csrm/e2e` found no other occurrence of the old label. The identifier `workspaceRefusals` in `accessibility.spec.ts` is a name, not copy, and is kept.

## Files Created/Modified

- Code:
  - `src/features/analyst-dashboard/analyst-dashboard.tsx` and `analyst-dashboard-presentation.ts`
  - `src/components/states/states.tsx`
  - `app/(app)/not-found.tsx` and `app/not-found.tsx`
  - `app/(app)/app/review/requests/error.tsx`
  - `src/features/risks/risk-details.tsx`
- Unit tests:
  - `analyst-dashboard.test.tsx` and `analyst-dashboard-presentation.test.ts`
  - `states.test.tsx`, `root-fallbacks.test.tsx` and `risk-details.test.tsx`
  - `administration-workflow.test.tsx`, `alert-list.test.tsx`, `alerts-page.test.tsx`, `reports-pages.test.tsx`, `request-routes.test.tsx` and `requestor-dashboard.test.tsx`
  - `interface-copy-guard.test.ts`
- E2E:
  - `navigation-and-home.spec.ts` and `analyst-insights.spec.ts`
  - `accessibility.spec.ts`, `administration-workflow.spec.ts`, `app-shell.spec.ts`, `assessment-navigation-lifecycle.spec.ts`, `design-contract.spec.ts` and `design-system-conformance.spec.ts`

## Decisions Made

- `UX08_ANALYST_PHONE_FIRST_SCREEN` is a layout proof on real boxes. It stays inside the `@journey` describe, only reads, and uses the project's own width.
  - Mobile project (375×812): it scrolls to the top and asserts `scrollY` is 0. The tiles form two rows. The `Review queue` region's top is above 812px, and its heading ends within 812px.
  - Desktop project (1440×900): the tiles form one row.
  - Both projects: `Review queue` is the first h2 after `Needs action`, and no tile's `scrollWidth` exceeds its `clientWidth`.
- The Requests error boundary joins the copy guard, because this plan cleans it too. Its heading and description are unchanged here; plan 11-04 changes them. Its `ErrorState` now reads the new default, `We couldn’t load this page`.
- The Risk detail body keeps the casing `Risk Register` in this plan, as the plan says. Plan 11-04 changes the casing.
- `PermissionDeniedState`'s default action is a module constant `goToHome`, rendered by the same `StateActionLink` as a caller's action. The markup is the same outline link as before.
- The copy guard's own fixture uses `Open your workspace`, so the plan's `grep -rn "to workspace"` over `src`, `app` and `e2e` prints nothing.
- UX-08 stays open: `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: broken by the copy change] `requestor-dashboard.test.tsx` asserted `Loading workspace…`**
- **Found during:** Task 2, RED grep
- **Issue:** The plan's list of unit files does not include it, but its loading case reads `LoadingState`'s heading.
- **Fix:** It now asserts `Loading…`. It was in the RED run and passes at GREEN.
- **Committed in:** `fadd10c`

**2. [Scope note] `analyst-dashboard.test.tsx` lines 484, 489 and 520 needed no copy change**
- Plan 11-02 had already moved the analyst Home's permission state to `Return to sign in` (UI-D19). The file was changed in Task 1 for the order, the tiles and the Brisbane case only.

**3. [Process] Task 2's changed specs were not run on their own before the full suite**
- The full suite runs every changed spec in both projects, so it is a superset. The full run passed: 98 tests, 0 failed. Task 1's two specs were run on their own twice, once for GREEN and once for the tracer gate.

**4. [Process] Uncommitted RED edits showed in `git status` after `f4866c1`**
- I started Task 2's unit-test edits while Task 1's Playwright run was in progress. So `git status` right after the Task 1 GREEN commit also listed those uncommitted test files. They were committed as `fadd10c` before any other change. After every later commit, only the three operator items showed.

---

**Total deviations:** 1 auto-fixed (an assertion broken by the planned copy change), plus 1 scope note and 2 process notes.
**Impact on plan:** None adds scope.

## Issues Encountered

- The production web server logged 86 `The destination stream closed early` messages and one `failed-to-find-server-action` during the full run. 11-02's full run logged 73 and 1. They come from navigations that abort streamed responses, and from the production-hardening test that posts an unknown server action. Every test passed.
- `git update-index --refresh` reports "needs update" for files with CRLF/LF stat differences. These included the operator's two `apps/backend/types/generated/*.d.ts` files, which stay untouched and unstaged.

## Known Stubs

None.

## Threat Flags

None. T-11-15 is mitigated: the §2.4 copy names no internal mechanism, and the guard now refuses `workspace` in the state, not-found and Requests error files. T-11-16 is accepted: every recovery link is the fixed path `/app`. T-11-SC: no package was added.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-04: the page headings and titles, the Requests error boundary heading, and the Risk register casing of the Risk detail body.
- 11-12 adds "Your own requests" after Recent activity, in the left column from lg. The skeleton test's index-6 span check will need its eighth widget.

## Self-Check: PASSED

- The nine key files exist: `analyst-dashboard.tsx`, `analyst-dashboard-presentation.ts`, `states.tsx`, both not-found pages, `review/requests/error.tsx`, `risk-details.tsx`, `interface-copy-guard.test.ts` and `navigation-and-home.spec.ts`.
- Commits `820fafb`, `f4866c1`, `fadd10c` and `1a8efca` exist, and each has the trailer.
- Task 1's acceptance criteria all re-ran PASS:
  - `analyst-dashboard.tsx` contains `grid-cols-2 xl:grid-cols-4` and `LocalInstant`.
  - The order starts `reviewQueue`, `treatmentsDue`.
  - The spec contains `UX08_ANALYST_PHONE_FIRST_SCREEN`.
  - The verify command exited 0, twice.
- Task 2's acceptance criteria all re-ran PASS:
  - `states.tsx` contains `Go to Home`, `Getting this page ready.` and `We couldn’t load this page`.
  - The guard contains `'workspace'` and lists both not-found files.
  - `grep -rn "to workspace" apps/csrm/src apps/csrm/app apps/csrm/e2e` printed nothing.
  - The full Playwright run had no failed test in either project.
- The plan's verification passed: web suite, typecheck and `api:check` green; the full Playwright suite green in both projects, with the tree clean afterwards.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
