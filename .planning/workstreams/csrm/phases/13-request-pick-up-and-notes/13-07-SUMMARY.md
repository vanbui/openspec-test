---
phase: 13-request-pick-up-and-notes
plan: 07
subsystem: auth
tags: [development-identity, seed, fixture-persona, security-analyst, sign-in, role-switcher, playwright, responsive-header]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the request assignment and notes services, whose UI proofs need a second human analyst (13-03 to 13-06)
  - phase: 11-navigation-and-home
    provides: signInAs asserting the Home heading and the banner role, the analyst navigation sections and the header Search control (11-02, 11-05, 11-19)
provides:
  - Seeded development user Sam Analyst (sam.analyst@idambox.com), active, holding exactly the Security Analyst role, no Keycloak subject; constant SECOND_ANALYST_EMAIL in seed-assessment-navigation-lifecycle.ts
  - Development role `Second Security Analyst` (developmentRoles, DevelopmentFixtureIdentity, capability grants, role switcher option, sign-in button `Continue as Second Security Analyst`)
  - E2E SignInRole `Second Security Analyst` and REQ08_SECOND_ANALYST_SIGN_IN in app-shell.spec.ts
  - The header role tag wraps from 375 to 767px when it cannot fit one line
affects: [13-08, 13-10, 13-11, 13-12, 13-17, 13-18, 13-19, 17]
actuals:
  tokens: 15100
  tasks: 2
  commits: 4
plan_head_before: ce3ecb95217a8875db17ee52d1ee1e4126b02399
plan_head_after: 24f3c2e072972876349aa935c84fda81746cc5e8
tech-stack:
  added: []
  patterns:
    - "A development-only persona seeded by email through the module's reconcile helper behind IDAMBOX_SEED_CSRM and developmentIdentityEnabled(), with its role looked up by name and a missing role thrown"
    - "A CSS-reading unit test pinning a responsive header rule beside the browser proof (the quick-find-trigger precedent)"
key-files:
  created:
    - apps/backend/tests/second-analyst-seed.integration.test.ts
    - apps/csrm/src/components/shell/header-role-layout.test.ts
  modified:
    - apps/backend/src/bootstrap/seed-assessment-navigation-lifecycle.ts
    - apps/csrm/src/lib/auth/session-adapter.ts
    - apps/csrm/src/lib/auth/development-session-adapter.ts
    - apps/csrm/src/lib/auth/development-session-adapter.test.ts
    - apps/csrm/src/lib/capabilities/development-capabilities.ts
    - apps/csrm/src/lib/capabilities/capability-adapter.test.ts
    - apps/csrm/src/components/shell/role-switcher.tsx
    - apps/csrm/src/components/shell/role-switcher.test.tsx
    - apps/csrm/app/sign-in/page.tsx
    - apps/csrm/src/lib/auth/sign-in-page.test.tsx
    - apps/csrm/app/globals.css
    - apps/csrm/e2e/helpers/navigation.ts
    - apps/csrm/e2e/app-shell.spec.ts
key-decisions:
  - "Sam Analyst is reconciled in seedAssessmentNavigationLifecycle beside Maya, so it shares her exact gate (IDAMBOX_SEED_CSRM and developmentIdentityEnabled()); the Security Analyst role is read by name through api::role.role and a missing role throws, as requiredUser does."
  - "The second analyst holds the same capability array object as Security Analyst (securityAnalystGrants), so the two grants cannot drift."
  - "At 375px the header could not hold Menu, Search and the 23-character `Second Security Analyst` tag on one line (Phase 11 UI-D10 measured the 19-character `Secondary Requestor`). From 375 to 767px a role tag that cannot fit now wraps onto a second line inside the header, its full text shown, rather than truncating (which would hide which analyst is signed in) or changing Menu or Search for every actor. A tag that fits stays on one line, so every other role renders as before; below 375px UI-D10's ellipsis is unchanged."
  - "REQ-08 stays Pending until the phase gate (the 13-03 to 13-06 precedent)."
requirements-completed: []
coverage:
  - id: D1
    description: "Sam Analyst is seeded once, active, display name Sam Analyst, holding exactly the Security Analyst role and no Keycloak subject, and never without IDAMBOX_SEED_CSRM or the development identity"
    requirement: "REQ-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/second-analyst-seed.integration.test.ts#D-31 seeding twice leaves one active Sam Analyst holding exactly the Security Analyst role and no Keycloak subject (T-13-26)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/second-analyst-seed.integration.test.ts#D-31 the second Security Analyst is not seeded without IDAMBOX_SEED_CSRM or without the development identity (T-13-25)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/second-analyst-seed.integration.test.ts#D-31 the second Security Analyst has no Keycloak fixture subject"
        status: pass
    human_judgment: false
  - id: D2
    description: "The development role Second Security Analyst sends sam.analyst@idambox.com as the development identity, holds exactly the Security Analyst grants, and is offered after Security Analyst by the role switcher and the development sign-in"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/auth/development-session-adapter.test.ts#the Second Security Analyst development role (D-31)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/shell/role-switcher.test.tsx#lists the four development roles, Second Security Analyst after Security Analyst (D-31, UI-D26)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/auth/sign-in-page.test.tsx#offers the four fixture identities, Second Security Analyst after Security Analyst (D-31, UI-D26)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The second analyst signs in through the E2E helper; at 1440 the analyst navigation shows Assessment work, and at 375 the header shows Menu, Search and the whole role tag with no horizontal scroll"
    requirement: "REQ-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/app-shell.spec.ts#REQ08_SECOND_ANALYST_SIGN_IN"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/shell/header-role-layout.test.ts#wraps a tag too long for one line from 375px to 767px, instead of scrolling or truncating"
        status: pass
    human_judgment: true
    rationale: "The UI Considerations backstop row (header with the second persona at 375) is a browser backstop the orchestrator walks; the automated half is green, the visual look of the wrapped tag is the pilot's call."
duration: 16min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 07: The second development Security Analyst Summary

**Sam Analyst (`sam.analyst@idambox.com`), a second human Security Analyst for development and E2E only, is seeded behind the development gates with exactly the Security Analyst role and no Keycloak subject, and is offered as `Second Security Analyst` by the development sign-in and the role switcher. The browser proves the sign-in at 1440 and 375. The 375 header needed a fix so the longer tag wraps instead of scrolling the page.**

## Performance

- **Duration:** about 16 min
- **Started:** about 2026-10-08T18:20Z
- **Completed:** 2026-10-08T18:36Z
- **Tasks:** 2. Task 1 is the tracer. Both ran RED, then GREEN.
- **Files changed:** 15, plus this SUMMARY

## The persona

| Field | Value |
| --- | --- |
| Email | `sam.analyst@idambox.com` (`SECOND_ANALYST_EMAIL`) |
| Username | `sam.analyst` |
| Name | `Sam` `Analyst`, display name `Sam Analyst` |
| Account status | `active` |
| Roles | exactly `Security Analyst` (looked up by name; a missing role throws) |
| Keycloak | no `externalSubject`; `development-fixture-subjects.ts` and the realm import unchanged |
| Gate | `IDAMBOX_SEED_CSRM=true` and `developmentIdentityEnabled()` (NODE_ENV, CSRM_ENVIRONMENT, CSRM_DEV_IDENTITY) |
| Web role | `Second Security Analyst`, after `Security Analyst`; the development session sends the email in `x-csrm-dev-identity`, which `csrm-development-identity` resolves by email |

## Accomplishments

- **Seed (D-31, T-13-25, T-13-26).** `seedAssessmentNavigationLifecycle` reconciles Sam by email next to Maya, under the same gate. The role is read through `api::role.role` by name.
- **Web role (UI-D26).**
  - `developmentRoles` ends with `'Second Security Analyst'`.
  - `DevelopmentFixtureIdentity` gains `'sam.analyst@idambox.com'`, and `developmentFixtureIdentityForRole` returns it for the new role.
  - The capability grants share one `securityAnalystGrants` array.
  - The role switcher adds the option, and the sign-in page adds `Continue as Second Security Analyst` with the outline variant, both after Security Analyst.
- **E2E.**
  - `SignInRole` gains the role.
  - `REQ08_SECOND_ANALYST_SIGN_IN` signs in through `signInAs`, which asserts Home and the banner role. For each width in `[1440, 375]` it sets the viewport (900 and 812 high) and reloads Home.
  - At 1440 it asserts the `Assessment work` group in Primary navigation.
  - At 375 it asserts `Menu`, the Search control, the role tag, `scrollWidth <= innerWidth`, and that the tag is whole (not truncated) and inside the screen.
- **Header fix.** `globals.css` gains `@media (min-width: 375px) and (max-width: 767px) { .header-role { flex: 0 1 auto; white-space: normal; text-align: center; } }`. A CSS-reading unit test pins it, the below-375 ellipsis and Search's `flex: none`.

## Test Counts

- **Task 1 RED:**
  - Web: `Tests 7 failed | 173 passed` (role list, identity, grants, cookie, switcher, sign-in).
  - Strapi: `# pass 2 / # fail 1` (`SECOND_ANALYST_NOT_EXACTLY_ONE`). The gate and the Keycloak-file checks already held.
- **Task 1 verify** (exit 0):
  - Web: `Tests 180 passed` over `src/lib/auth`, `src/lib/capabilities` and the role switcher.
  - Web typecheck and Strapi `tsc` clean.
  - Strapi `second-analyst-seed.integration`: `# pass 3 / # fail 0`.
  - The Keycloak diff against `PHASE_13_BASE=ab000f6` is empty.
  - The tracer gate re-ran the verify after GREEN: it passed.
- **Task 2 RED:**
  - Playwright desktop: `1 failed | 9 passed`. REQ08 overflowed at 375.
  - Unit: `Tests 1 failed | 1 passed` (`header-role-layout`).
- **Task 2 verify** (exit 0):
  - Playwright `e2e/app-shell.spec.ts`: desktop `10 passed` (56.2s). The mobile project runs nothing from this spec (not in its `testMatch`), so 375 is proven inside the desktop project.
  - `git status --short -- apps/csrm apps/backend/src docs` is empty after the run.
- **Extra checks:**
  - Web shell and CSS readers (`src/components/shell`, `page-header`, `dialog-size`, `src/lib/security`): `Tests 974 passed`.
  - Final web focused run: `Tests 182 passed`. Web typecheck and the e2e `tsconfig.e2e.json` are clean.
  - Backend `tsc --noEmit` is clean.
- No full suite was run (out of this plan's scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The 375px header scrolled sideways with the new role tag**
- **Found during:** Task 2, first Playwright run
- **Issue:** `.header-role` is `flex: none; white-space: nowrap` from 375px up. `SECOND SECURITY ANALYST` in the micro-label (11px mono, 0.14em tracking) is about 30px wider than `SECONDARY REQUESTOR`, so Menu + Search + tag passed 375px. UI-SPEC §17 assumed the header fits it.
- **Fix:** From 375 to 767px the tag may shrink and wrap onto a second line inside the 56px header, its full text shown. It neither truncates nor scrolls. Roles that fit are unchanged, and below 375 the UI-D10 ellipsis is unchanged.
- **Files modified:** `apps/csrm/app/globals.css`, plus the new `apps/csrm/src/components/shell/header-role-layout.test.ts`. The E2E also asserts that the tag is whole and on screen.
- **Commits:** `2ab172b` (RED), `24f3c2e` (fix)

**2. [Scope] The capability grant test went into `capability-adapter.test.ts`**
- The plan's verify runs `src/lib/capabilities`, and that file already holds the development capability projections. The same check is also in `development-session-adapter.test.ts`.

## Threat Flags

None. The persona is development-only behind the existing gates, and no endpoint, auth path or schema changed. The Keycloak paths, the realm import, every `.example` file and every content type are unchanged by this plan.

## Known Stubs

None.

## Next Phase Readiness

13-08 onwards can sign in as `Second Security Analyst` through `signInAs` for reassignment, a colleague following a job, and per-person unread flags. The pilot's browser walk owns the header backstop (the wrapped tag's look at 375).

## Self-Check: PASSED

- FOUND: apps/backend/tests/second-analyst-seed.integration.test.ts
- FOUND: apps/csrm/src/components/shell/header-role-layout.test.ts
- FOUND commits: 013986b, 604bd5d, 2ab172b, 24f3c2e
