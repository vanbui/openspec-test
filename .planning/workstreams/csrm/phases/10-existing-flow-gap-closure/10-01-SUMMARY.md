---
phase: 10-existing-flow-gap-closure
plan: 01
subsystem: ui
tags: [nextjs, server-actions, cookies, intl, time-zone, playwright, design-direction]

requires:
  - phase: v1.0 (Phases 1-8)
    provides: the AppShell, the protected app layout, the questionnaire revision timeline and the revert audit summary
provides:
  - "Design direction entries X-1 to X-5: Save status, Record picker, Dates and times, the middle-dot separator rule, In-place edit form"
  - "formatInstant / isValidTimeZone / InstantStyle / VIEWER_TIME_ZONE_COOKIE (apps/csrm/src/lib/time/format-instant.ts, zod-free)"
  - "readViewerTimeZone (server-only cookie read) and syncViewerTimeZoneAction (validated Server Action)"
  - "TimeZoneProvider, useViewerTimeZone, LocalInstant, ViewerTimeZoneSync (apps/csrm/src/components/csrm/local-time.tsx)"
  - "AppShellProps.timeZone: string | null, provided from the app layout"
  - "Revision timelines (both depths) and the revert audit summary in the viewer's zone"
affects: [10-02, 10-04, 10-05, 10-08, 10-15, 10-20, phase-11-local-time-everywhere]

actuals:
  tokens: 6659
  tasks: 3
  commits: 7
plan_head_before: 0716fd22d6b803808c956cd629674a6e620f7b0a
plan_head_after: 6c8f341a7e6dd73b3188fc8521adb102d759a13e

tech-stack:
  added: []
  patterns:
    - "One shared instant formatter: every time-of-day render goes through formatInstant/LocalInstant; ' UTC' only while the zone is unknown, never on date-only renders"
    - "Client-controlled cookie validated on write AND read (isValidTimeZone) so a forged value degrades to UTC, never a RangeError"
    - "A cookie-setting Server Action relies on Next's same-round-trip route re-render; no extra router.refresh()"
    - "Shared components render the client LocalInstant rather than calling a hook, so Server Component pages can use them"

key-files:
  created:
    - apps/csrm/src/lib/time/format-instant.ts
    - apps/csrm/src/lib/time/format-instant.test.ts
    - apps/csrm/src/lib/time/viewer-time-zone.ts
    - apps/csrm/src/lib/time/time-zone-actions.ts
    - apps/csrm/src/lib/time/time-zone-actions.test.ts
    - apps/csrm/src/components/csrm/local-time.tsx
    - apps/csrm/src/components/csrm/local-time.test.tsx
    - apps/csrm/src/components/csrm/revert-audit-summary.test.tsx
  modified:
    - docs/design/csrm-design-direction.md
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/app/(app)/layout.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
    - apps/csrm/src/components/csrm/revert-audit-summary.tsx
    - apps/csrm/src/components/shell/app-shell-account.test.tsx
    - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts

key-decisions:
  - "VIEWER_TIME_ZONE_COOKIE is defined in the pure format-instant.ts and re-exported by viewer-time-zone.ts, because server-only throws under vitest and every jsdom test rendering LocalInstant would otherwise reach it through the action module"
  - "ViewerTimeZoneSync does not call router.refresh(): a Server Action that sets a cookie already makes Next re-render the current route and layouts in the same round trip (Next docs, mutating-data 'Cookies'); the extra refresh rendered the page twice and aborted the first response"
  - "The browser proof clears only the csrm-time-zone cookie and reloads, then polls without navigating, so it proves the in-place re-render rather than passing on a later navigation; a negative control (sync disabled) fails it with the UTC label"
  - "A failed or refused sync is swallowed: times stay labelled UTC, which remains truthful"

patterns-established:
  - "LocalInstant({ value, style, fallback }) is the one way to render an instant on a D-19 surface; later plans (10-04, 10-08, 10-15, 10-20) reuse it"
  - "Design direction extensions are recorded verbatim from the UI-SPEC with their '(CSRM extension, 2026-09-27)' label before any code uses them"

requirements-completed: [UX-06]

coverage:
  - id: D1
    description: "X-1 to X-5 recorded verbatim in docs/design/csrm-design-direction.md"
    requirement: UX-06
    verification:
      - kind: other
        ref: "grep -F for the five acceptance strings in docs/design/csrm-design-direction.md (all PASS)"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatInstant renders viewer-zone times, labels UTC only on time-of-day renders while the zone is unknown, never labels date-only renders; isValidTimeZone accepts only IANA zones of 1-64 characters"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/time/format-instant.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "syncViewerTimeZoneAction stores only a valid zone in an httpOnly, lax, site-wide, one-year cookie, Secure only over https; refusals set nothing"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/time/time-zone-actions.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shell provides the cookie's zone and syncs the browser's zone once per app load; the route re-renders in place with local times and no visible UI"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/local-time.test.tsx#ViewerTimeZoneSync"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-governance-workflow.spec.ts#UX06_TIMELINE_SHOWS_LOCAL_TIME"
        status: pass
    human_judgment: false
  - id: D5
    description: "Revision timelines at both depths render event times in the viewer's zone"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx#shows each detail entry's time in the viewer's zone"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-governance-workflow.spec.ts#UX06_TIMELINE_SHOWS_LOCAL_TIME"
        status: pass
    human_judgment: false
  - id: D6
    description: "The revert audit summary shows When in the viewer's zone and never shows a document id as a name"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/revert-audit-summary.test.tsx"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 01: Viewer time zone on timelines and revert summary Summary

**Revision timelines and the revert audit summary now show times in the viewer's own zone. A validated `csrm-time-zone` cookie is written by a Server Action from the shell, read by the app layout, and rendered through one zod-free en-AU formatter, with " UTC" only while the zone is unknown. The design direction now carries X-1 to X-5.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-10-02T01:17:32Z
- **Completed:** 2026-10-02T01:50:27Z
- **Tasks:** 3 (of 3)
- **Files modified:** 16 (8 created, 8 modified)

## Accomplishments

- The design direction records Save status (X-1), Record picker (X-2), Dates and times (X-3), the spaced middle dot rule on the Voice bullet (X-4) and In-place edit form (X-5), verbatim from the UI-SPEC. Nothing else in the file changed.
- `formatInstant` / `isValidTimeZone`: one pure formatter with four styles (`date`, `date-long`, `date-time`, `time`), `en-AU` throughout. ` UTC` is appended only to time-of-day styles when the zone is null.
- The browser's zone reaches an `httpOnly`, `sameSite=lax`, `path=/`, one-year `csrm-time-zone` cookie through `syncViewerTimeZoneAction`. The cookie is `Secure` exactly when the first `x-forwarded-proto` value is `https`. The zone is validated on write and again on read (T-10-01).
- `AppShell` takes `timeZone` and wraps its content in `TimeZoneProvider`, with one `ViewerTimeZoneSync`. Both `AppShell` renders in the protected layout pass `readViewerTimeZone()`, including the existing OIDC `account` variant.
- Both depths of the revision timeline and the revert audit summary render through `LocalInstant`. The revert summary's `By` falls back to `Not recorded`, never to a document id.
- A browser running in Australia/Brisbane proves the in-place change: with the zone cookie cleared, the timeline shows UTC with the label and then settles on local time without navigating.

## Task Commits

1. **Task 1: X-1 to X-5, then the viewer's zone from browser to timeline**
   - `678e92c` docs: record the five extensions
   - `8741659` test (RED): formatter, validation, cookie action, LocalInstant/provider/sync, Brisbane timeline case
   - `308d535` feat (GREEN): lib/time modules, local-time.tsx, shell and layout wiring, timeline on LocalInstant
2. **Task 2: Revert audit summary on the shared formatter, no id as a name**
   - `67a9152` test (RED)
   - `2b3a5a8` fix (GREEN)
3. **Deviation fix (Rule 1), found during Task 3:** `e12e0f8` fix: let the zone action's own re-render refresh the route
4. **Task 3: Brisbane-zone browser proof and the full journey suite:** `6c8f341` test

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Tests Run

| Run | Result |
| --- | --- |
| RED, Task 1 (4 files) | 4 files failed: modules not found (the RED state the plan specifies) |
| GREEN, Task 1 verify set + AppShell test (7 files) | 72/72 passed |
| RED, Task 2 (revert-audit-summary.test.tsx) | 3 failed / 3 passed: the When-in-zone, UTC-label and id-as-name cases failed on their assertions |
| GREEN, Task 2 verify set (3 files) + assessment-review-workflow.test.tsx | 16/16 + 32/32 passed |
| After the Rule 1 fix: Task 1 + Task 2 targeted files + zod and server-only guards (8 files) | 79/79 passed |
| Full web unit suite (final code) | 114 files, 2,092/2,092 passed, 26.1 s |
| Typecheck / lint (`next typegen && tsc --noEmit`) | exit 0 |
| `pnpm --dir apps/csrm api:check` | exit 0, `schema.d.ts` unchanged (index refreshed) |
| Governance spec (final code) | 1/1 passed (desktop), 1.1 min |
| Governance spec, negative control (sync disabled, not committed) | failed as expected: `UX06_TIMELINE_SHOWS_LOCAL_TIME` received `2 Oct 2026, 1:33 am UTC` |
| **Full Playwright suite** (final code, before the spec commit, with the spec change in the tree) | **86/86 passed: desktop 82, mobile 4; 0 failed, 0 flaky, 0 skipped; 12.0 min reported, 719 s wall** |
| Content-type guard `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` | empty |

No journey needed the shell's re-render to settle beyond the governance spec's own `expect.poll`. Every journey passed on its first attempt.

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-4 on the Voice bullet, the X-3 bullet after it, and X-1, X-2 and X-5 after the segmented-control extension.
- `apps/csrm/src/lib/time/format-instant.ts`: `formatInstant`, `isValidTimeZone`, `InstantStyle`, `VIEWER_TIME_ZONE_COOKIE`.
- `apps/csrm/src/lib/time/viewer-time-zone.ts`: `import 'server-only'`; `readViewerTimeZone()`; re-exports the cookie name.
- `apps/csrm/src/lib/time/time-zone-actions.ts`: `'use server'`; `syncViewerTimeZoneAction(zone: unknown)`.
- `apps/csrm/src/components/csrm/local-time.tsx`: `'use client'`; `TimeZoneProvider`, `useViewerTimeZone`, `LocalInstant`, `ViewerTimeZoneSync`.
- `apps/csrm/src/components/shell/app-shell.tsx`: `timeZone` prop; provider and sync wrap the existing markup, which is unchanged.
- `apps/csrm/app/(app)/layout.tsx`: `readViewerTimeZone()` passed to both `AppShell` renders.
- `apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx`: the UTC `formatDate` is deleted; both entry kinds use `LocalInstant`.
- `apps/csrm/src/components/csrm/revert-audit-summary.tsx`: the UTC `formatRevertedAt` is deleted; `When` uses `LocalInstant`; `By` no longer falls back to the id.
- Tests: four new files, plus a Brisbane case in the timeline test and `timeZone={null}` and an action mock in `app-shell-account.test.tsx`.
- `apps/csrm/e2e/questionnaire-governance-workflow.spec.ts`: `test.use({ timezoneId: 'Australia/Brisbane' })` and the `UX06_TIMELINE_SHOWS_LOCAL_TIME` step.

## Decisions Made

- **Where the cookie name lives.** `VIEWER_TIME_ZONE_COOKIE` is defined in `format-instant.ts` and re-exported from `viewer-time-zone.ts`, which still exports it as the plan lists. `server-only` throws outside the `react-server` condition. If the action imported the server-only module, every jsdom test that renders `LocalInstant` (timelines, request pages, the shell) would fail on import.
- **No explicit `router.refresh()`.** The Rule 1 deviation below explains why.
- **Stronger browser proof.** The step clears only the zone cookie and reloads before polling. That proves UI-SPEC §4.5's in-place re-render, rather than passing because many navigations had already set the cookie.
- **A failed sync is swallowed.** Times keep the ` UTC` label, which is still accurate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The extra `router.refresh()` after the zone sync rendered the page twice and aborted the first response**
- **Found during:** Task 3 (the first governance spec run)
- **Issue:** The run logged `Error: The destination stream closed early` 4 times on the Next server. The pre-phase baseline run (`drq-verify-e2e`) logged none. Next re-renders the current route and its layouts in the same round trip when a Server Action sets a cookie (`node_modules/next/dist/docs/01-app/01-getting-started/*mutating-data*`, "Cookies"). The plan's `router.refresh()` therefore started a second full render while the first was still streaming.
- **Fix:** `ViewerTimeZoneSync` now only calls the action, and catches a rejection. The unit tests pin one call, no call when the zone matches or is invalid, and the UTC label kept after a failure. The `AppShell` test no longer mocks `useRouter`.
- **Evidence:** With the refresh: 4 aborted streams over 4 syncs. Without it: 1 to 2. With the sync disabled: 0, and the strengthened proof fails. Without the refresh, the strengthened proof passes, showing the action's re-render alone updates the page in place.
- **Files modified:** `local-time.tsx`, `local-time.test.tsx`, `app-shell-account.test.tsx`
- **Committed in:** `e12e0f8`

**2. [Plan wording] The `ViewerTimeZoneSync` contract no longer says "on `{ ok: true }` call `router.refresh()`"**
- This follows from deviation 1. The UI-SPEC behaviour ("sends the browser's zone once per app load when it differs from the cookie, then refreshes the route") still holds: the refresh is the framework's re-render in the action response.

---

**Total deviations:** 1 auto-fixed bug (Rule 1), plus the contract wording that follows from it.
**Impact on plan:** It halves the first-load server work for a new session and removes most of the aborted-stream log noise. There is no scope change.

## Issues Encountered

- **The remaining aborted-stream log lines are benign.** The full suite logged `The destination stream closed early` 46 times; the pre-phase run logged none. Each new browser context syncs its zone once on its first shell page. When a test navigates or closes the context while that action's re-render is still streaming, Next logs the abort. No assertion is affected. A real user who navigates away within that window gets the same one log line on the server, and no visible effect.
- **Experiment mistake, not committed.** One experiment run failed to build because my `sed` replacement contained `&&`, which `sed` expands to the matched text. The file was restored from a scratchpad backup and the experiment re-run with the Edit tool.
- **Harness note.** One experiment run printed `[harness] Could not remove: apps/backend/.tmp/playwright-e2e-….db (EPERM)`, a Windows file lock in the git-ignored `.tmp`. `git status` stayed clean after every Playwright run (D-48).
- **TDD note.** Task 1's RED was "module not found", which is the plan's stated RED. Task 2's RED failed on assertions for the target behaviour. `workflow.tdd_mode` is not enabled, so no `tdd-red-evidence` record was required.

## Deferred / Handed On

- **The server-only guard list.** `server-only-boundary.test.ts` enumerates auth, transport, gate and service modules, and does not yet list `src/lib/time/viewer-time-zone.ts`. The file does start with `import 'server-only'`, as the acceptance grep shows. Plan 10-02 edits that gate list (D-40) and can add it there.
- **Aborted-stream log noise.** If an operator's log alerting treats Next's `⨯` lines as errors, a later phase could defer the sync until the page is idle. That is not needed for correctness.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- `LocalInstant` and `formatInstant` are ready for 10-04 (request dates, `date` style), 10-08 (autosave time, `time` style), 10-15 (released dates, `date-long`) and 10-20 (save confirmations).
- 10-02 can depend on the timeline using `LocalInstant`, and on the gate-list note above.
- Ready for 10-02.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*

## Self-Check: PASSED
