---
phase: quick-260930-iei
plan: 01
subsystem: csrm-web-shell
tags: [oidc, account-menu, shell, dropdown-menu, keycloak]
requires: [ADR 0003 OIDC sign-in, ADR 0004 Strapi verifies Keycloak tokens]
provides:
  - "Top-bar circular initials account menu (name, email, Sign out) in OIDC mode"
  - "Session.email (display only), set by the OIDC adapter"
affects: [apps/csrm shell, OIDC walkthrough in apps/csrm/README.md]
tech-stack:
  added: []
  patterns: ["Client AccountMenu wrapping a server-action form; onSelect preventDefault keeps the form mounted until redirect"]
key-files:
  created:
    - apps/csrm/src/components/shell/account-initials.ts
    - apps/csrm/src/components/shell/account-initials.test.ts
    - apps/csrm/src/components/shell/account-menu.tsx
  modified:
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/components/shell/app-shell-account.test.tsx
    - apps/csrm/src/lib/auth/session-adapter.ts
    - apps/csrm/src/lib/auth/oidc-session-adapter.ts
    - apps/csrm/src/lib/auth/oidc-session-adapter.test.ts
    - apps/csrm/app/(app)/layout.tsx
    - apps/csrm/app/globals.css
    - apps/csrm/README.md
  deleted:
    - apps/csrm/src/components/shell/sign-out-form.tsx
decisions:
  - "'Username' is Session.displayName (Keycloak name, falling back to preferred_username via Auth.js); Auth.js callbacks left untouched"
  - "Menu email line hidden when absent or identical to the display name"
metrics:
  duration: "about 15 minutes"
  completed: 2026-09-30
status: complete
commits: 3
plan_head_before: 0a342f8ee496a8ef966017b35b2c5e218cbd0d3a
plan_head_after: e76aa5ff0f454f08c0d01b2aea7227dcdaeb196f
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase quick-260930-iei Plan 01: OIDC account menu in the top bar Summary

With `CSRM_AUTH_OIDC_ENABLED=true`, the shell now shows a circular initials button at the top right of the header. It opens a menu with the same avatar beside the user's name and email, then a "Sign out" item (LogOut icon) that submits the existing `signOutOfSession` action, so the Keycloak RP-initiated logout is unchanged.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | OIDC account menu in the top bar | 9a39539 |
| 2 | Carry the OIDC email claim to the menu | 86460f3 |
| 3 | Retire the sidebar sign-out form, update README, run the gate | e76aa5f |

## What changed

- `accountInitials()` is a pure, code-point-safe helper (first and last word, email local-part aware, `?` fallback) with unit tests.
- `AccountMenu` is a Client Component using the shadcn DropdownMenu and Avatar and the shared ghost icon Button. The trigger's accessible name is `"JD, account menu for Jane Doe"` (Label in Name). It is 36px on desktop and 44px below 768px. Semantic tokens only.
- The Sign out `<form action={signOutOfSession}>` sits in the menu. Its item calls `preventDefault()` in `onSelect` so the form stays mounted until the action redirects.
- `AppShell` renders the menu as the last header child; the sidebar and mobile sheet footer now hold only the dev role switcher. Dev mode markup is unchanged.
- `Session.email?` is carried only by the OIDC adapter (trimmed, conditional spread), and the layout forwards it in OIDC mode only. The layout is still `force-dynamic`. The Auth.js callbacks and the development adapter are untouched.
- Removed `SignOutForm` and the `.sign-out-form` CSS; README step 6 now points at the account menu.

## Verification

- `pnpm --filter @csrm/web typecheck` and `lint` (same `next typegen && tsc --noEmit`): pass.
- Task-scoped vitest (account-initials, app-shell-account, mobile-navigation, role-switcher, oidc-session-adapter, development-session-adapter): all pass.
- Full `pnpm test` in apps/csrm: 2043 passed, 2 failed. Both failures are pre-existing and unrelated (see Deferred Issues).
- The optional human check against a live Keycloak (1440px and 375px, mouse-click Sign out) was not run.
- The jsdom run prints "Not implemented: navigation to another Document" when the test clicks Sign out against the mocked action. It is noise from jsdom form submission, not a failure.

## Deviations from Plan

None - plan executed as written. The two email display tests in `app-shell-account.test.tsx` were written in Task 1 alongside the rest of that file, since the component already handled the optional email; Task 2 then added the adapter and layout wiring.

## Deferred Issues

Two full-suite failures, caused by hard-coded paths to `apps/strapi`, which was renamed to `apps/backend` (out of scope, not touched):

1. `src/components/csrm/feedback-composites.test.tsx` reads `apps/strapi/src/api/csrm-assessment-request/content-types/.../schema.json` (ENOENT).
2. `src/features/administration/administration-service.test.ts` reads `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` (ENOENT).

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema surface; T-q260930-01..04 mitigations applied (React text children only, force-dynamic retained, preventDefault on select, account only in OIDC mode).

## Notes

- Pre-existing working-tree changes `apps/backend/types/generated/contentTypes.d.ts` and `apps/csrm/next-env.d.ts` were not staged.
- The one file deletion (`sign-out-form.tsx`) is intentional.

## Self-Check: PASSED

- Created files exist: account-initials.ts, account-initials.test.ts, account-menu.tsx.
- Commits 9a39539, 86460f3 and e76aa5f are present in `git log`.
- `sign-out-form.tsx` is gone, with no remaining `SignOutForm` or `sign-out-form` references.
