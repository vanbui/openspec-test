---
phase: 11-navigation-landing-and-list-clarity
plan: 05
subsystem: ui
tags: [navigation, sidebar, drawer, prefetch, nextjs, vitest, playwright]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-04: pageHeadings, the labels every navigation entry reads; 11-02: Home at /app; 11-01: X-6 recorded in the design direction"
  - phase: 10-existing-flow-gap-closure
    provides: "10-08: guarded navigation (Link onNavigate -> useNavigationGuard().guardLink, onNavigated closing the sheet only when the guard lets the navigation go ahead)"
provides:
  - "navigation.ts: NavigationItem, NavigationSection (id, label, collapsible, prefetch), NavigationProfile, requestorNavigationProfile, analystNavigationProfile, navigationProfileFor(granted), profileItems(profile), activeNavigationHref (unchanged contract)"
  - "capability-navigation.tsx: CapabilityNavigation({ granted, profile?, onNavigated }) renders the primary action, each section holding a visible item, and a collapsible section whose button opens and closes its group"
  - "globals.css: .nav-primary-action and .nav-section-toggle (X-6)"
  - "helpers/navigation.ts: showPrimaryNavigation(page); openFromNavigation(page, name, exact?, section?) that expands a collapsed section first"
  - "performance.spec.ts: postHydrationPrefetch per route in the JSON record, with the Phase 8 /app/review figure beside the analyst's /app"
  - "E2E: UX07_SECTIONS_PER_ACTOR, UX07_DRAWER_SAME_SECTIONS, UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE, UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW"
affects: [11-06, 11-10, 11-13, 11-14, 11-19, 11-21, 13, 20, 22]

actuals:
  tokens: 25338
  tasks: 3
  commits: 5
plan_head_before: 8c5406a95e9e04e41660d2fbc9b7a5f7aecf4881
plan_head_after: 6d6c0631774433da519e2db23f56b1cd42c34e14

tech-stack:
  added: []
  patterns:
    - "Navigation is data: a profile per actor of ordered, capability-gated sections; the component names no section, so a later item, section or profile is a data entry (D-13)"
    - "A collapsible section's state lives only in component memory: open when the profile says so or when the current page is one of its items, opened by an effect on the pathname, closed only by its button"
    - "A section marked prefetch 'intent' renders Link prefetch={false} and calls router.prefetch on pointer enter and focus"

key-files:
  created: []
  modified:
    - apps/csrm/src/config/navigation/navigation.ts
    - apps/csrm/src/config/navigation/navigation.test.ts
    - apps/csrm/src/components/shell/capability-navigation.tsx
    - apps/csrm/src/components/shell/mobile-navigation.test.tsx
    - apps/csrm/app/globals.css
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/src/features/administration/administration-workflow.test.tsx
    - apps/csrm/src/features/dashboard/requestor-dashboard.test.tsx
    - apps/csrm/e2e/helpers/navigation.ts
    - apps/csrm/e2e/navigation-and-home.spec.ts
    - apps/csrm/e2e/analyst-insights.spec.ts
    - apps/csrm/e2e/administration-workflow.spec.ts
    - apps/csrm/e2e/design-system-conformance.spec.ts
    - apps/csrm/e2e/performance.spec.ts

key-decisions:
  - "11-05: Intent prefetch is a section property in the profile data (NavigationSection.prefetch: 'intent', set on Reference data), not a check of the section id in the component, so the component still names no section (D-13)"
  - "11-05: The primary action is not a navigation item: profileItems leaves it out, so it never competes for the current item, and on /app/requests/new the Requestor's My requests is current (UI-D43)"
  - "11-05: The collapsible group's id is useId() plus the section id, because the sidebar and the open drawer render the same profile at once"
  - "11-05: The primary action renders from Task 1, because UX07_SECTIONS_PER_ACTOR proves it leads the Requestor's navigation; Task 2 added its CSS, the toggle, the open rule and intent prefetch"
  - "11-05: The post-hydration prefetch figure is recorded for every route (median, max, samples with prefetch), and the analyst's /app record carries the Phase 8 /app/review figure beside it; nothing is budgeted"
  - "11-05: UX-07 stays open: requirements.ready-ids reports 0/1 ready, because later Phase 11 plans also declare it"

patterns-established:
  - "E2E navigation: showPrimaryNavigation returns the sidebar's landmark from 1024px and opens the Menu sheet below it; openFromNavigation expands collapsed sections before clicking"

requirements-completed: []

coverage:
  - id: D1
    description: "Each actor's navigation is a profile of job-named sections chosen from capabilities: the Requestor's New request, Home, My work; the analyst's Home, Assessment work, Oversight, Reference data and a collapsed My own requests"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/config/navigation/navigation.test.ts (navigation profiles; the current item over a profile; labels equal headings)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx (the Security Analyst's sections; the Requestor's sections)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_SECTIONS_PER_ACTOR ([desktop] 1440)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D2
    description: "My own requests starts collapsed except on its own pages, opens itself on a navigation to one, never closes itself, toggles with Enter and Space with focus kept, and renders no link while collapsed"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx (the analyst's collapsible My own requests)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D3
    description: "The phone drawer renders the same profile: Close navigation first, then the Requestor's New request; the analyst's items fit a 375x812 drawer with My own requests collapsed"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx (the drawer renders the same profile)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_DRAWER_SAME_SECTIONS ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D4
    description: "The primary action, every item and the collapsible section's items keep Phase 10's guarded navigation; a blocked link leaves the drawer open"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/navigation-guard.test.tsx (the shell links consult the guard)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx (closes the drawer when the Requestor's primary action navigates)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reference data links prefetch on pointer enter and focus only; the other items keep the router's default; the analyst's /app post-hydration prefetch is recorded beside the Phase 8 figure"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx (intent prefetch for Reference data)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/performance.spec.ts (/app as the Security Analyst; .tmp/performance/baseline-desktop.json postHydrationPrefetch)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The X-6 primary action pill and section button look right on the dark sidebar and in the drawer (fill, shadow, hover lift, chevron, focus ring)"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/mobile-navigation.test.tsx (navigation sheet and sticky header styles: the X-6 rules)"
        status: pass
    human_judgment: true
    rationale: "The tests pin the CSS rules' tokens and the reduced-motion override; the rendered look of the pill and the toggle on the sidebar is a visual judgment no test asserts"

duration: 54min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 05: The sidebar and drawer are divided into job-named sections per actor Summary

**Navigation is now one data profile per actor. The Requestor sees a light-filled `New request` pill, then Home, then `My work`. The Security Analyst sees Home, `Assessment work`, `Oversight` and `Reference data`, with `My own requests` collapsed at the bottom. That section opens itself on its own pages and is never persisted. The drawer renders the same profile through the same guarded component, and Reference data links prefetch only on intent. With the rebuilt sidebar, the analyst's `/app` downloads 134,246 bytes after hydration; Phase 8's largest figure was 176,293 bytes on `/app/review`.**

## Performance

- **Duration:** 54 min (wall clock, including four Playwright runs and three full web suites)
- **Started:** 2026-10-03T03:34:45Z
- **Completed:** 2026-10-03T04:29:33Z
- **Tasks:** 3 of 3
- **Files changed:** 14 (0 created, 14 modified, none deleted)

## Accomplishments

- **The profile data** in `navigation.ts`:
  - `requestorNavigationProfile`: the `New request` primary action (`/app/requests/new`, `assessment-request:create`, `FilePlus2`), then `top` (Home) and `my-work` (`My work`: My requests, My questionnaires, My risk assessments).
  - `analystNavigationProfile`: `top` (Home), `assessment-work`, `oversight`, `reference-data` (with `prefetch: 'intent'`), then `own-requests` (`My own requests`, `collapsible: { defaultCollapsed: true }`: My requests, New request).
  - Labels come from `pageHeadings`, and from `administrationConfig[kind].pluralLabel` for Reference data. Icons follow UI-SPEC §1.1.
  - `navigationProfileFor(granted)` returns the analyst profile for `assessment:review` and the Requestor profile otherwise. `profileItems(profile)` lists every item of every section, collapsed ones included, for `activeNavigationHref`, which is unchanged.
  - The flat list and the old group names are gone. `grep -rn` for the retired group export over `apps/csrm/src` prints nothing.
  - The doc comment says navigation is presentation only: route gates and Strapi authorise.
- **The component** (`capability-navigation.tsx`):
  - The primary action renders first inside `Primary navigation` as `nav-primary-action`, through the guard's `onNavigate`. It never carries `aria-current`.
  - Each section with a visible item renders as `role="group"` named by its label, with the `micro-label` heading and the `border-sidebar-border` divider. The top section has no label and no group.
  - The collapsible section renders a `button.nav-section-toggle` with `aria-expanded`, `aria-controls` and a 16px `ChevronRight` or `ChevronDown`. Its `role="group"` is `hidden` while closed, and it renders no links then, so nothing in it is in the tab order or prefetched.
  - The open rule: the section starts open when `defaultCollapsed` is false or the current page is one of its items. An effect on the pathname opens it and never closes it. Only the button closes it.
  - A section with `prefetch: 'intent'` renders its links with `prefetch={false}`, and calls `router.prefetch(href)` on `onPointerEnter` and `onFocus`.
  - `MobileNavigation` still renders `CapabilityNavigation`, so the drawer shows the same profile. `Close navigation` stays first.
- **CSS** (`globals.css`, beside `.nav-link`):
  - `.nav-primary-action`: `--radius-full`, `--background` fill (`--color-bg-page`), `--foreground` text, `--text-button`, `--shadow-button-light`. Hover is `translateY(-1px)` with `--shadow-button-light-hover` at `--duration-fast` and `--ease-out-expo`, with no recolour. It is 44px tall below 768px and 36px from 768px. Reduced motion removes the lift.
  - `.nav-section-toggle`: 36px, `--radius-md`, `--sidebar-muted` text, and the `--sidebar-active` hover fill.
  - Both use the sidebar's existing inverse focus ring. Neither rule holds a hex colour.
- **Copy guard:** `app-shell.tsx`, `account-menu.tsx`, `capability-navigation.tsx`, `wordmark.tsx`, `navigation.ts` and `page-headings.ts` are guarded. The role switcher stays excluded. All six were already clean.
- **E2E:**
  - `openFromNavigation` expands a collapsed section, named or each in turn, in the sidebar and in the drawer.
  - Four new proofs: `UX07_SECTIONS_PER_ACTOR` (1440), and `UX07_DRAWER_SAME_SECTIONS`, `UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE` and `UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW` (`@journey`, both projects).
- **Prefetch record (UI-SPEC §1.7):** `.tmp/performance/baseline-desktop.json` now carries `postHydrationPrefetch` for every route. The analyst's `/app` record shows it beside the Phase 8 figure (table below).

## Post-hydration prefetch (recorded, never budgeted)

| Run | Route, actor | Post-hydration JS delivered per sample | Median / max | Phase 8 figure |
|---|---|---|---|---|
| Full suite (04:19:55Z) | `/app`, Security Analyst | 134,246 × 5 | 134,246 / 134,246 (5 of 5 samples) | 176,293 max on `/app/review` |
| Changed specs | `/app`, Security Analyst | 134,246 × 5 | 134,246 / 134,246 | 176,293 |

The analyst's Home now downloads 42,047 bytes less after hydration than Phase 8's worst analyst page did (−23.9%). The page and the measurement window are different, so this is a record, not a like-for-like gain. Phase 8 also measured 108,466 bytes on the Requestor's `/app`, in three of five samples. That route now reads 110,986 to 112,465 bytes, in five of five.

## Task Commits

1. **Task 1: The Security Analyst's sidebar shows job-named sections from profile data (tracer, TDD)**
   - `a13047b`: test(11-05), RED
   - `1b185f0`: feat(11-05), GREEN
2. **Task 2: The Requestor's primary action, the self-opening own section, the drawer and intent prefetch (TDD)**
   - `0a5982d`: test(11-05), RED
   - `5768e6e`: feat(11-05), GREEN
3. **Task 3: Prove the sidebar and drawer per actor in the browser, move the group assertions, then run every journey**
   - `6d6c063`: test(11-05)

The ledger count is `git rev-list --count 8c5406a..6d6c063` = 5. All five commits end with the required `Co-Authored-By` trailer, checked with grep.

## TDD Gate Compliance

- **Task 1:** RED `a13047b` comes before GREEN `1b185f0`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed) for `mobile-navigation.test.tsx`, "the Security Analyst’s sections > shows Home, then Assessment work, Oversight, Reference data and a collapsed My own requests, in that order". The navigation still rendered the flat list with Reports and Administration groups.
  - The RED run failed 13 of 118 tests: 11 in `mobile-navigation.test.tsx` and 1 in `administration-workflow.test.tsx`, each on an assertion. `navigation.test.ts` failed at import, as expected, because the profile exports did not exist yet.
- **Task 2:** RED `0a5982d` comes before GREEN `5768e6e`.
  - `RED_EVIDENCE_OK` for "the analyst’s collapsible My own requests > toggles with Enter and Space, rendering its items only while open and keeping focus on the button". The button stayed `aria-expanded="false"`.
  - The RED run failed 12 of 188 tests, each on an assertion: the toggle, the open rule, the drawer toggle, intent prefetch and the two CSS rules.
  - The primary-action cases passed at RED, because Task 1 already rendered the action (see Decisions). The copy guard passed with its six new files.
- As in 11-01 to 11-04, the gsd-core JUnit parser reads the first `name=` attribute, which is the one inside `classname=`. The evidence was checked against scratchpad copies with `name` moved first, and the target written as the test name alone. Nothing in the repository changed.
- No refactor commit was needed.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The full Task 1 verify command was re-run against the committed tree: 94/94 unit, typecheck clean, Playwright 12 passed. Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (`src/config/navigation`, `src/components/shell`, `administration-workflow.test.tsx`) | 13 failed, 105 passed (118); `navigation.test.ts` failed at import |
| Task 1 GREEN (those, plus `navigation-guard`, `requestor-dashboard`, `questionnaire-workflow`) | 11 files, 189/189; typecheck clean |
| Task 1 full web suite before commit | 138 files, 2,913/2,913 |
| Task 1 Playwright `navigation-and-home.spec.ts` | 12 passed (desktop 7, mobile 5), 0 failed, 0 flaky, 0 skipped; 1.7 min; `git status` identical before and after |
| Tracer re-run of the Task 1 verify | 7 files, 94/94; typecheck clean; Playwright 12 passed; 1.8 min |
| Task 2 RED (`src/components/shell`, `src/config/navigation`, `navigation-guard`, copy guard) | 12 failed, 176 passed (188) |
| Task 2 GREEN verify | 9 files, 188/188; typecheck clean |
| Task 2 full web suite | 1 failure (`requestor-dashboard.test.tsx`: its mock had no `useRouter`, deviation 2), then fixed; 2 passed in that file |
| Task 3 changed specs (the plan's five) | 52 passed (desktop 43, mobile 9), 0 failed, 0 flaky, 0 skipped; 5.3 min; `git status` identical before and after |
| **Full Playwright suite** (`pnpm --dir apps/csrm test:e2e`, production build) | **106 passed: desktop 94, mobile 12; 0 failed, 0 flaky, 0 skipped; 13.5 min** (04:08:03Z to 04:21:34Z). `git status --short` identical before and after the run |
| Final full web suite (`pnpm --dir apps/csrm test`) | 138 files, 2,938/2,938 |
| `typecheck` and `lint` (`next typegen && tsc --noEmit`) | clean |
| `api:check` | exit 0; `schema.d.ts` unchanged after `git update-index --refresh` (no contract change) |

The Strapi suite was not run, because this plan changes no Strapi file.

## E2E Assertions Changed

Listed in the plan:
- **E8:**
  - `analyst-insights.spec.ts`:
    - The Alerts journey reaches Alerts from the `Oversight` group, which marks Alerts current (plan lines 203-208).
    - The 375×667 sheet test reads `Alerts` in `Oversight` and the last link of `Reference data` (289, 291).
    - The report-index test reads the `Oversight` links as `['Risk register', 'Alerts', 'Reports']`, then checks each by name (314-319).
    - The cross-screen journey opens Reports from `Oversight` (654).
  - `administration-workflow.spec.ts`: the analyst baseline expects the visible `Reference data` section, and the Requestor baseline expects none. These are at today's lines 89 and 114; the plan said 86 and 111.
  - `design-system-conformance.spec.ts`: the sidebar micro-label type check reads `Reference data`. It is at today's line 313; the plan said 286.
- **E9:** `analyst-insights.spec.ts` (Requestor and Secondary Requestor) expects `Home`, no `Analyst dashboard`, `Alerts` or `Reports` link, and no `Oversight` group. It used to check for no `Reports` group.
- **New:** `UX07_SECTIONS_PER_ACTOR`, `UX07_DRAWER_SAME_SECTIONS`, `UX07_OWN_SECTION_OPENS_ON_ITS_ROUTE` and `UX07_ANALYST_PERSONAL_ITEMS_BELOW_REVIEW` in `navigation-and-home.spec.ts`.
- **`performance.spec.ts`:** a `postHydrationPrefetch` record per route, with `phase8Baseline` on the analyst's `/app`. No budget changed.

Changed beyond the plan's list:
- `analyst-insights.spec.ts`: the local `reportsGroup` became `oversight`, and `lastAdministrationLink` became `lastReferenceDataLink`, with their comments. This is naming only.
- `helpers/navigation.ts` gained `showPrimaryNavigation`. The new journeys use it to reach the landmark at either width.
- No other spec needed a change. Every other `openFromNavigation` call either signs in as a Requestor (`My Requests` and `New request` match the Requestor's links) or opens an analyst review list.

Unit assertions changed beyond the plan's list:
- `administration-workflow.test.tsx`: the Security Analyst's `Reference data` group replaces `Administration` (deviation 1).
- `requestor-dashboard.test.tsx`: its `next/navigation` stand-in gains `useRouter` (deviation 2).
- `mobile-navigation.test.tsx`:
  - "marks the matching nested route as active" now expects no `My risk assessments` link for the analyst, because the analyst profile does not hold the Requestor's work list (D-08).
  - The micro-label case reads `Reference data`.
  - The rest of the file was rewritten for sections, as the plan says. The sheet, focus and style cases are kept.

## Files Created/Modified

- `src/config/navigation/navigation.ts`: the types, both profiles, `navigationProfileFor` and `profileItems`
- `src/components/shell/capability-navigation.tsx`: the section loop, the primary action, the collapsible section and intent prefetch
- `app/globals.css`: `.nav-primary-action` and `.nav-section-toggle`
- Unit tests:
  - `navigation.test.ts`: profiles, the current item and labels
  - `mobile-navigation.test.tsx`: sections, the toggle, the open rule, the drawer, prefetch and CSS
  - `interface-copy-guard.test.ts`: six files added
  - `administration-workflow.test.tsx` and `requestor-dashboard.test.tsx`
- E2E: `helpers/navigation.ts`, `navigation-and-home`, `analyst-insights`, `administration-workflow`, `design-system-conformance` and `performance`

## Decisions Made

- **Intent prefetch is profile data.** It is `NavigationSection.prefetch: 'intent'`, set on Reference data, rather than a component check for the section id. That keeps D-13's rule that no component names a section. The field is optional, so later sections keep the default.
- **The primary action is not an item.** `profileItems` leaves it out, so it never competes for the current item. On `/app/requests/new` the Requestor's `My requests` is current, and the analyst's `New request` is current (UI-D43).
- **Group ids are unique per instance.** A collapsible group's id is `useId()` plus the section id, because the sidebar and the open drawer render the same profile at once.
- **The primary action renders from Task 1.** `UX07_SECTIONS_PER_ACTOR` proves it leads the Requestor's navigation. Task 2 added its CSS, the toggle, the open rule and intent prefetch.
- **The prefetch record covers every route.** Each route gets its median, max and number of samples with prefetch. The analyst's `/app` also carries the Phase 8 `/app/review` figure (176,293). Nothing is budgeted. The file is ignored (`.tmp/performance/`). It still holds an older run's `/app/review` entry, which the current suite does not measure.
- **The section button keeps `micro-label` text.** The visible label is uppercase by CSS. Its accessible name is still `My own requests`, which both Testing Library and Playwright read.
- **UX-07 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: broken by the planned change] A unit test named the retired Administration group**
- **Found during:** Task 1, RED
- **Issue:** `administration-workflow.test.tsx` ("ADMIN-01 capability-gated Administration discovery") rendered `CapabilityNavigation` for Bob and expected `group` `Administration`. The file is not on the plan's list.
- **Fix:** It now expects the `Reference data` group, renamed in the RED commit. The case was in the RED run and passes at GREEN.
- **Files modified:** `apps/csrm/src/features/administration/administration-workflow.test.tsx`
- **Committed in:** `a13047b`

**2. [Rule 3: blocking] A test's `next/navigation` stand-in had no `useRouter`**
- **Found during:** Task 2, GREEN (the full web suite)
- **Issue:** `requestor-dashboard.test.tsx` mocks `next/navigation` with `usePathname` alone. The navigation now reads `useRouter` for intent prefetch, so Vitest refused the missing export.
- **Fix:** The stand-in returns `useRouter: () => ({ prefetch, push })`.
- **Files modified:** `apps/csrm/src/features/dashboard/requestor-dashboard.test.tsx`
- **Committed in:** `5768e6e`

**3. [Plan interface extension] `NavigationSection.prefetch`**
- **Issue:** The plan's D-06 shape for a section is `{ id; label; collapsible?; items }`. It also says "items in the reference-data section render with prefetch={false}", and that no component names a section (D-13). Both cannot hold unless the section carries the rule.
- **Fix:** An optional `prefetch?: 'intent'` field on the section, set on Reference data. The rendered behaviour is exactly as planned.
- **Committed in:** `5768e6e`

**4. [Process] The Task 2 primary-action cases were green at RED**
- The Task 1 tracer already rendered the action, because `UX07_SECTIONS_PER_ACTOR` needs it. Task 2's RED therefore targeted the toggle, which failed as required (`RED_EVIDENCE_OK`). The Task 2 GREEN added the action's CSS, which RED's style case did fail on.

---

**Total deviations:** 2 auto-fixed (1 assertion broken by the planned change, 1 blocking mock), plus 1 interface extension and 1 process note.
**Impact on plan:** No added scope. No route, capability, gate or Strapi policy changed (T-11-02). The Requestor profile holds no analyst item, and the unit cases render each profile with each actor's capabilities (T-11-18). No package was added (T-11-SC).

## Issues Encountered

- The production web server logged 75 `The destination stream closed early` messages and one `failed-to-find-server-action` during the full run. 11-04 logged 222 and 1. Every test passed.
- `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files (CRLF/LF stat). They stay untouched and unstaged.
- A heredoc with nested template literals failed to parse in Git Bash. The edits were made with the Edit tool instead, and no file was changed by the failed attempts.

## Known Stubs

None. Counts on items arrive in plan 11-13, as the plan says. Nothing in this plan renders a count placeholder.

## Threat Flags

None. Only navigation presentation changed. The full suite reran every permission journey, including Requestors refused every Phase 7 route.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-06 and later.
- Plan 11-13 (counts) can add a `count` key to `NavigationItem` and render it inside `renderLink`. The collapsed section's button is the place for the collapsed count, beside its label.
- Phase 13's `Assigned to me`, Phase 20's `My risks and treatments` and Phase 22's Admin profile are data entries in `navigation.ts` (D-13). An Admin profile also needs a branch in `navigationProfileFor`.
- When a count joins a link's name (11-10, 11-13), `openFromNavigation` already accepts a section argument. Its `name` is still a string.

## Self-Check: PASSED

- No files were created. The 14 modified files are in the five commits.
- Commits `a13047b`, `1b185f0`, `0a5982d`, `5768e6e` and `6d6c063` exist, and each has the trailer.
- Task 1 acceptance criteria re-ran PASS:
  - `navigation.ts` exports `navigationProfileFor`, `profileItems`, `requestorNavigationProfile` and `analystNavigationProfile`.
  - The grep for the retired export over `apps/csrm/src` prints nothing.
  - `navigation.ts` holds `My work`, `Assessment work`, `Oversight`, `Reference data` and `My own requests`.
  - `capability-navigation.tsx` contains `guardLink`.
  - The verify command exited 0, twice.
- Task 2 acceptance criteria re-ran PASS:
  - `capability-navigation.tsx` contains `nav-primary-action`, `nav-section-toggle`, `aria-controls` and `router.prefetch`.
  - `globals.css` has `.nav-primary-action` with `var(--shadow-button-light)`, and `.nav-section-toggle`, with no hex colour in either rule.
  - The copy guard lists `capability-navigation.tsx` and `navigation.ts`.
  - The verify command exited 0.
- Task 3 acceptance criteria re-ran PASS:
  - The three journey names are in `navigation-and-home.spec.ts`.
  - `analyst-insights.spec.ts` names `Oversight`, and `administration-workflow.spec.ts` names `Reference data`.
  - The full run passed in both projects, with the tree clean afterwards.
- The plan's verification passed: the web suite, typecheck, lint and `api:check` are green, and the full Playwright suite is green in both projects with the tree clean afterwards.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
