---
phase: 07-requestor-request-workflow
plan: "05"
subsystem: ui
tags: [nextjs, react, server-actions, forms, accessibility, catalogue]
requires:
  - phase: 07-requestor-request-workflow
    provides: Trusted Server Actions that validate and persist Requestor request fields.
  - phase: 07-requestor-request-workflow
    provides: Server-only typed catalogue adapters for Information Systems and Information Assets.
provides:
  - A progressive New Request form with title-only draft saves, safe submit confirmation, and field-level accessible validation.
  - Optional keyboard-operable catalogue relation selectors and conditional third-party context.
  - Dirty-work interception for in-app navigation and native browser unload prompting.
affects: [07-06-request-details, 07-08-integration-hardening]
actuals:
  tokens: 9885
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns:
    - Server Components load serializable catalogue choices and pass Server Actions to an interactive Client Component.
    - Shared request-form state keeps Server Action modules free of non-action runtime exports.
    - Native labelled controls and Radix confirmation dialogs supply mobile-safe accessible form interactions.
key-files:
  created:
    - apps/csrm/src/app/requests/new/page.tsx
    - apps/csrm/src/components/ui/request-form-primitives.tsx
    - apps/csrm/src/features/requests/catalogue-multi-select.tsx
    - apps/csrm/src/features/requests/request-form-state.ts
    - apps/csrm/src/features/requests/request-form.tsx
    - apps/csrm/src/features/requests/request-form.test.tsx
  modified:
    - apps/csrm/src/features/requests/request-actions.ts
    - apps/csrm/src/features/requests/request-actions.test.ts
    - apps/csrm/next-env.d.ts
key-decisions:
  - "Pass the existing trusted Server Actions from the server page rather than importing server-only action code into the Client Component."
  - "Load typed catalogue options on the server and debounce the client-side searchable option list without adding a dependency or public fetch path."
patterns-established:
  - "Draft saves validate title only; submit validation occurs before opening the confirmation dialog and preserves values on errors."
  - "Conditional third-party details are removed from rendered controls and cleared from client form state when the answer changes to No."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: Progressive New Request form implements D-06 through D-09 including accessible error states, draft save, confirmation, catalogue selections, and dirty-work protection.
    requirement: CSRM-05
    verification:
      - kind: automated_ui
        ref: yarn workspace @idambox/csrm test:unit --run src/features/requests/request-form.test.tsx
        status: pass
      - kind: integration
        ref: yarn workspace @idambox/csrm build
        status: pass
    human_judgment: false
duration: 9m
completed: 2026-08-22
status: complete
---

# Phase 07 Plan 05: Progressive New Request Form Summary

**Accessible progressive risk-assessment request form with server-backed draft/submit flows, optional CSRM catalogue relations, and protected unsaved work.**

## Performance

- **Duration:** 9m
- **Started:** 2026-08-22T14:25:35Z
- **Completed:** 2026-08-22T14:34:22Z
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments

- Added the four ordered persisted-field form sections with title-only draft validation and complete pre-submit validation.
- Added safe-default submit and unsaved-work dialogs, live feedback, focused error summaries, independent pending actions, and conditional third-party details.
- Added typed-server-loaded Information System and Information Asset selectors with 300ms debounced search, keyboard selection, named removable tokens, and optional empty relations.
- Kept browser input at the trusted Server Action boundary by passing action references through the server page and preserving the existing server-side validation and ownership controls.

## Task Commits

1. **Task 1: Deliver the progressive New Request form and optional searchable catalogue selection** — `46c0b96` (RED coverage), `361dbea` (implementation).

## Files Created/Modified

- `apps/csrm/src/app/requests/new/page.tsx` — capability-preflights the server actor and loads typed serializable catalogue choices.
- `apps/csrm/src/features/requests/request-form.tsx` — progressive draft/submit form, validation, announcements, and dirty-state handling.
- `apps/csrm/src/features/requests/catalogue-multi-select.tsx` — keyboard-accessible searchable optional relationship selector.
- `apps/csrm/src/components/ui/request-form-primitives.tsx` — section, field, and Radix confirmation-dialog composition.
- `apps/csrm/src/features/requests/request-form-state.ts` — browser-safe request-form values and action-state contracts.
- `apps/csrm/src/features/requests/request-actions.ts` — server-action-only exports after separating browser-safe state.
- `apps/csrm/src/features/requests/request-form.test.tsx` — role/name-based coverage for sections, validation, dialogs, selectors, and dirty navigation.

## Decisions Made

- Passed Server Actions from the Server Component page so the Client Component never imports `server-only`, credentials, actor resolution, or typed transport code.
- Reused the audited Radix Dialog dependency and native labelled controls, avoiding package and lockfile changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Separated browser-safe form state from the file-level Server Action module**
- **Found during:** Task 1
- **Issue:** Importing the Plan 04 action module from the Client Component caused Next.js production compilation to reject non-async helper exports and server-only imports.
- **Fix:** Moved shared values/types to `request-form-state.ts`, limited `request-actions.ts` to async Server Action exports, and passed those action references from the server route to the client form.
- **Files modified:** `apps/csrm/src/features/requests/request-form-state.ts`, `apps/csrm/src/features/requests/request-actions.ts`, `apps/csrm/src/features/requests/request-actions.test.ts`, `apps/csrm/src/features/requests/request-form.tsx`, `apps/csrm/src/app/requests/new/page.tsx`
- **Verification:** Action and form tests, TypeScript, and `yarn workspace @idambox/csrm build` passed.
- **Committed in:** `361dbea`

**2. [Rule 2 - AGENTS.md convention] Committed Next.js's generated type-reference update**
- **Found during:** Task 1
- **Issue:** The required production build refreshed `next-env.d.ts`; the CSRM project guide requires committing this generated change so the working tree remains clean.
- **Fix:** Included the generated production type-reference update in the implementation commit.
- **Files modified:** `apps/csrm/next-env.d.ts`
- **Verification:** Production build passed.
- **Committed in:** `361dbea`

**Total deviations:** 2 auto-fixed issues. Both were required to preserve the server/client security boundary and project build convention; no package was added or changed.

## Issues Encountered

- The shared Git index initially rejected staging with `Unable to create '/Users/vanbui/src/test/idambox/.git/index.lock': Operation not permitted`. Scoped repository write permission allowed the verified feature commit; no work was lost.
- Phase-wide `yarn workspace @idambox/csrm verify` still fails only in the pre-existing stale capability-count assertions: three expectations require 23 capabilities while the committed catalogue has 27. This remains recorded in `deferred-items.md` and is outside this plan's file/scope fence.

## Known Stubs

None.

## Verification

- `yarn workspace @idambox/csrm test:unit --run src/features/requests/request-form.test.tsx` — passed (7 tests).
- `yarn workspace @idambox/csrm test:unit --run src/features/requests/request-actions.test.ts src/features/requests/request-form.test.tsx` — passed (10 tests).
- `yarn workspace @idambox/csrm check-types` — passed.
- `yarn workspace @idambox/csrm build` — passed.
- `git diff --exit-code -- apps/csrm/package.json apps/backend/package.json yarn.lock` — passed; no dependency or lockfile mutation.
- `yarn workspace backend check-types` — passed.
- `yarn workspace @idambox/csrm verify` — known unrelated 23-vs-27 capability-count failures only.

## TDD Gate Compliance

The RED commit `46c0b96` precedes the GREEN implementation commit `361dbea`; focused behavior tests pass after implementation.

## Next Phase Readiness

Plan 07-06 can reuse `RequestForm` for persisted Request Details and connect the already defined request status/workflow panel without exposing server-only services to the browser.

## Self-Check: PASSED

Confirmed all planned request-form artifacts, the required server-action boundary fix, and commits `46c0b96` and `361dbea` exist in Git history.
