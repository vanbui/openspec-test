---
phase: 06-create-the-idambox-csrm-next-js-application
plan: "08"
subsystem: responsive-shell
tags: [nextjs, react, radix, accessibility, responsive-navigation, development-fixtures]
requires:
  - phase: 06-04
    provides: Server-derived identity, capability, route, and fixture-action contracts
  - phase: 06-07
    provides: Server-rendered CSRM shell and filtered navigation composition
provides:
  - Accessible compact drawer and presentation-only desktop sidebar collapse islands
  - Account menu, validated development fixture switching, page-title focus, and polite announcements
  - Production-gated fixture UI with no browser-held authorization state
affects: [06-09-browser-evidence, 07-requestor-request-workflow, 13-integration-and-hardening]
actuals:
  tokens: 8019
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns: [server-filtered-navigation-props, presentation-only-local-storage, small-client-interaction-islands]
key-files:
  created:
    - apps/csrm/src/components/shell/mobile-navigation.tsx
    - apps/csrm/src/components/shell/account-menu.tsx
    - apps/csrm/src/components/shell/development-identity-selector.tsx
    - apps/csrm/src/components/shell/route-announcer.tsx
  modified:
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/components/shell/sidebar.tsx
    - apps/csrm/src/components/shell/navigation-group.tsx
    - apps/csrm/src/components/shell/app-header.tsx
    - apps/csrm/src/components/shell/shell.test.tsx
key-decisions:
  - "Filter enabled capability-authorized routes in the server AppShell before passing serializable navigation props to client islands."
  - "Persist only the sidebar collapsed boolean under an explicitly presentation-only storage key."
  - "Guard development selector rendering on the server runtime and retain server-action validation as the authoritative production rejection path."
patterns-established:
  - "Small shell islands own only local open/collapse state and signal server refresh through focused events."
  - "Identity changes focus the current h1, close the account menu, refresh server data, and publish a polite live-region message."
requirements-completed: [APP-06]
coverage:
  - id: D1
    description: Accessible compact drawer, keyboard-operable navigation groups, and desktop sidebar collapse with synchronized offsets.
    requirement: APP-06
    verification:
      - kind: unit
        ref: apps/csrm/src/components/shell/shell.test.tsx#opens-and-dismisses-mobile-navigation,persists-only-sidebar-presentation,collapses-desktop-navigation
        status: pass
      - kind: other
        ref: yarn workspace @idambox/csrm check-types
        status: pass
    human_judgment: false
  - id: D2
    description: Account menu and non-production fixture switcher with server refresh, focus restoration, announcement, and production omission.
    requirement: APP-06
    verification:
      - kind: unit
        ref: apps/csrm/src/components/shell/shell.test.tsx#changes-development-identity,omits-fixture-controls-in-production,announces-route-and-identity-changes
        status: pass
      - kind: other
        ref: yarn workspace @idambox/csrm build
        status: pass
    human_judgment: false
duration: 13m
completed: 2026-08-09
status: complete
---

# Phase 06 Plan 08: Responsive Shell Interaction Islands Summary

**Accessible responsive CSRM navigation and account islands with server-filtered routes, presentation-only sidebar persistence, and production-gated development identity switching.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-09T10:13:02Z
- **Completed:** 2026-08-09T10:25:57Z
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments

- Replaced the compact-width sidebar with a labelled left Sheet drawer that closes on Escape or route selection, restores focus, and keeps navigation independently scrollable.
- Added a desktop collapse control that synchronizes the 272px/64px sidebar with header and main offsets while persisting only a cosmetic boolean.
- Added controlled account, fixture-selection, and polite route-announcement islands; fixture changes invoke the validated server action, refresh, refocus the page title, close the menu, and safely relocate future non-home paths.

## Task Commits

1. **Task 1: Operate the responsive drawer and sidebar collapse islands** — `48f5f3e` (test), `e6aeb1c` (feat)
2. **Task 2: Wire account, development identity, focus, and announcement islands** — `19f8da9` (test), `63645dc` (feat)

## Files Created/Modified

- `apps/csrm/src/components/shell/{mobile-navigation,sidebar,navigation-group}.tsx` — bounded responsive navigation controls, semantic group state, icon labels, and tooltips.
- `apps/csrm/src/components/shell/{account-menu,development-identity-selector,route-announcer}.tsx` — controlled menu, server-action fixture submission, focus return, and polite feedback.
- `apps/csrm/src/components/shell/{app-shell,app-header}.tsx` — server-filtered route props and coordinated responsive shell placement.
- `apps/csrm/src/components/shell/shell.test.tsx` — focused drawer, storage, menu, server-action, focus, production, and live-region assertions.

## Decisions Made

- Client islands receive already-filtered routes rather than capability or role authority; no global client provider was introduced.
- The only browser storage key is `idambox-csrm-sidebar-collapsed`; it never stores identity, capabilities, roles, tokens, or routes.
- Production never renders fixture labels or selector controls, and the existing server action retains its independent runtime/key validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Isolated the existing mixed React/Radix test-runtime boundary in focused shell tests**
- **Found during:** Task 1 (Operate the responsive drawer and sidebar collapse islands)
- **Issue:** The Yarn workspace resolves React 19 for CSRM components but hoists some Radix internals beside React 18, which causes invalid-hook errors only when the Radix primitives are directly mounted in Vitest.
- **Fix:** Kept the production components on the approved Radix primitives and supplied narrow native test doubles for Sheet, tooltip, and dropdown primitive behavior in the focused interaction test. Browser-level Radix behavior remains covered by Plan 06-09.
- **Files modified:** `apps/csrm/src/components/shell/shell.test.tsx`
- **Verification:** All 11 focused shell tests, strict type-checking, and the production build pass.
- **Committed in:** `e6aeb1c`, `63645dc`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No package or lockfile changes were made; production interactions continue to use the reviewed local Radix primitives.

## Issues Encountered

- The production static bundle still contains a lazily referenced fixture-island chunk, but server runtime gating prevents fixture controls from rendering and the server action rejects any production selection request. Plan 06-09 should retain a production-browser assertion that the account menu exposes no fixture control.

## Known Stubs

None.

## Next Phase Readiness

Plan 06-09 can exercise the finished desktop, tablet, and mobile islands in Chromium, including Radix's real focus containment, tooltip behavior, and production menu omission.

## Self-Check: PASSED

- Confirmed all nine declared shell files exist.
- Confirmed task commits `48f5f3e`, `e6aeb1c`, `19f8da9`, and `63645dc` exist.
- Confirmed the 11-test shell suite, strict type-check, and production build pass.
