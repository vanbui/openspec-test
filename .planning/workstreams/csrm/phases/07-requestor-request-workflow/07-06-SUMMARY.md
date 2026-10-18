---
phase: 07-requestor-request-workflow
plan: "06"
subsystem: ui
tags: [nextjs, react, server-actions, request-workflow, authorization, accessibility]
requires:
  - phase: 07-requestor-request-workflow
    provides: Trusted request Server Actions and a typed ownership-safe request service.
provides:
  - Capability-preflighted dynamic Request Details routes with metadata-safe access denial.
  - Owner draft editing, submitted-request withdrawal, analyst draft collaboration, and semantic read-only request states.
affects: [07-07-request-dashboard, 07-08-integration-hardening]
actuals:
  tokens: 12117
  tasks: 1
  commits: 3
tech-stack:
  added: []
  patterns:
    - Dynamic routes classify central registered bracket segments before invoking typed protected detail loading.
    - Request Details passes trusted Server Actions from its server route to client workflow controls without exposing credentials or actor authority.
key-files:
  created:
    - apps/csrm/src/app/requests/[requestId]/page.tsx
    - apps/csrm/src/features/requests/request-details.tsx
    - apps/csrm/src/features/requests/request-details.test.tsx
  modified:
    - apps/csrm/src/config/routes.ts
    - apps/csrm/src/domain/route-access.ts
    - apps/csrm/src/features/requests/request-form.tsx
key-decisions:
  - "Use the existing backend's indistinguishable 404 response as a metadata-safe access denial rather than expose record-existence information."
  - "Reuse RequestForm with explicit detail-mode options so analyst draft collaboration remains save-only and all mutations retain the trusted Server Action boundary."
patterns-established:
  - "Lifecycle controls derive from returned record state and centralized capabilities, never role strings, URL ownership, or browser-submitted authority."
  - "Read-only lifecycle states use semantic definition lists and OptionalValue rather than disabled inputs."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: Dynamic registered Request Details routes preflight capabilities before protected loads and display owner/analyst lifecycle controls without delete actions.
    requirement: CSRM-05
    verification:
      - kind: automated_ui
        ref: yarn workspace @idambox/csrm test:unit --run src/features/requests/request-details.test.tsx src/domain/route-access.test.ts
        status: pass
      - kind: integration
        ref: yarn workspace @idambox/csrm build
        status: pass
    human_judgment: false
duration: 9m
completed: 2026-08-23
status: complete
---

# Phase 07 Plan 06: Ownership-Safe Request Details and Lifecycle Controls Summary

**Capability-preflighted request details with owner/analyst draft collaboration, reversible submitted withdrawal, and accessible semantic read-only lifecycle states.**

## Performance

- **Duration:** 9m
- **Started:** 2026-08-22T14:38:39Z
- **Completed:** 2026-08-22T14:47:17Z
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments

- Enabled only the New Request and dynamic Request Details route definitions, with central bracket-segment matching before a typed protected detail load.
- Added the same progressive form for Requestor-owned drafts, analyst draft collaboration warning/save-only controls, and submitted withdrawal confirmation with acknowledged workflow feedback.
- Added status-specific semantic read-only presentation for every later lifecycle state, preserving false/zero-like values and using `Not provided` only for optional omissions.
- Added regression coverage for route ordering, owner/analyst action matrices, all read-only workflow copy, withdrawal focus, and disclosure-safe UI behavior.

## Task Commits

1. **Task 1: Deliver ownership-safe Request Details, lifecycle actions, analyst draft editing, and read-only states** — `54e741a` (RED coverage), `aff72c7` (implementation), `22a977b` (verification fixes).

## Files Created/Modified

- `apps/csrm/src/app/requests/[requestId]/page.tsx` — server route preflight, trusted detail load, safe state mapping, and server-action wiring.
- `apps/csrm/src/features/requests/request-details.tsx` — lifecycle panel, owner/analyst form modes, withdrawal confirmation, and semantic read-only details.
- `apps/csrm/src/features/requests/request-details.test.tsx` — workflow, action, focus, and read-only regression coverage.
- `apps/csrm/src/config/routes.ts` and `apps/csrm/src/domain/route-access.ts` — enabled direct request routes and safe dynamic segment matching.
- `apps/csrm/src/features/requests/request-form.tsx` — reusable detail-mode labels, action visibility, acknowledgement callbacks, and optional header composition.

## Decisions Made

- Used the backend's intentionally identical unknown/non-owned `404` as the access-denied detail surface, so UI never reveals a title, number, status, or record existence.
- Derived analyst collaboration from the existing capabilities supplied to the server route; the backend remains authoritative for every save, submit, and withdrawal.
- Kept read-only records semantic and responsive instead of showing disabled editable inputs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Extended the reusable form and heading interfaces for safe detail modes**
- **Found during:** Task 1
- **Issue:** The existing new-request-only form could not render analyst-specific save-only draft editing or move focus to the required details heading after acknowledged mutations.
- **Fix:** Added small display/action callbacks to `RequestForm` and an optional focus target to `PageHeader`; no browser component imports server-only code.
- **Files modified:** `apps/csrm/src/features/requests/request-form.tsx`, `apps/csrm/src/components/shell/page-header.tsx`
- **Verification:** Focused workflow tests, strict TypeScript, and the production build passed.
- **Committed in:** `aff72c7`

**2. [Rule 1 - Bug] Corrected plan-local lint and enabled-route regression expectations**
- **Found during:** Task 1 verification
- **Issue:** The first implementation reassigned a protected-load result in an async Server Component, and the established capability test still expected the newly enabled request routes to be planned.
- **Fix:** Kept route preflight and protected loading sequential/immutable, then updated the affected route-registry expectation.
- **Files modified:** `apps/csrm/src/app/requests/[requestId]/page.tsx`, `apps/csrm/src/features/requests/request-details.tsx`, `apps/csrm/src/config/capabilities.test.ts`
- **Verification:** Lint and type checking pass; the full suite now fails only on the pre-existing 23-vs-27 capability-count assertions.
- **Committed in:** `22a977b`

**Total deviations:** 2 auto-fixed issues required for secure form reuse and clean verification. No package, lockfile, API, or backend contract changes were made.

## Issues Encountered

- `yarn workspace @idambox/csrm verify` runs lint and type checking successfully, then remains blocked only by three pre-existing stale assertions expecting 23 capabilities while the committed catalogue contains 27. This was already documented by Plans 07-03 through 07-05; the route-registry assertion caused by this plan was corrected.

## Known Stubs

None.

## Verification

- `yarn workspace @idambox/csrm test:unit --run src/features/requests/request-actions.test.ts src/features/requests/request-form.test.tsx src/features/requests/request-details.test.tsx src/domain/route-access.test.ts` — passed (25 tests).
- `yarn workspace @idambox/csrm check-types` — passed.
- `yarn workspace @idambox/csrm build` — passed; production output includes the dynamic Request Details route.
- `yarn workspace backend check-types` — passed.
- `yarn workspace @idambox/csrm verify` — lint and type checking passed; only the known, unrelated 23-vs-27 stale capability-count assertions failed.

## Next Phase Readiness

Plan 07-07 can link dashboard/list request rows to the protected Request Details route and rely on its lifecycle-specific UI controls.

## Self-Check: PASSED

Confirmed all created detail artifacts exist and commits `54e741a`, `aff72c7`, and `22a977b` are present in Git history.
