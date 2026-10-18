---
phase: 02-requestor-risk-assessment-request-workflow
plan: 08
subsystem: ui
tags: [nextjs, react-hook-form, zod, server-actions, accessibility, vitest]

requires:
  - phase: 02-07
    provides: Authorised request detail projection with hydrated system and asset summaries
  - phase: 02-12
    provides: Shared validation schemas and server-revalidated create, update, and submit actions
provides:
  - Structured Requestor create and draft-edit form for every authorised persisted field
  - Authorised new, detail, and edit routes with loading, error, permission, and submitted states
  - Explicit irreversible submission with repeat protection and authoritative returned status/date
affects: [02-09, requestor-workflow, request-details, request-submission]

tech-stack:
  added: []
  patterns: [server-owned request pages with a focused form island, hydrated relation defaults, modal-accessible mutation feedback]

key-files:
  created:
    - apps/web/src/features/requests/request-form.tsx
    - apps/web/src/features/requests/request-form.test.tsx
    - apps/web/src/features/requests/request-workflow.test.tsx
    - apps/web/app/(app)/app/requests/new/page.tsx
    - apps/web/app/(app)/app/requests/[documentId]/page.tsx
    - apps/web/app/(app)/app/requests/[documentId]/edit/page.tsx
    - apps/web/app/(app)/app/requests/[documentId]/loading.tsx
    - apps/web/app/(app)/app/requests/[documentId]/error.tsx
  modified:
    - apps/web/src/features/requests/request-domain.ts
    - apps/web/src/features/requests/request-schema.ts
    - apps/web/src/components/csrm/confirm-dialog.tsx

key-decisions:
  - "Map edit defaults from the authoritative hydrated request projection, including persisted system and asset document IDs, rather than rebuilding empty client defaults."
  - "Keep failed submission feedback inside the open confirmation dialog so retry guidance remains accessible while modal focus is active."

patterns-established:
  - "Request forms share the closed Zod contract in browser and Server Action layers while Strapi remains authoritative for ownership and workflow facts."
  - "Only draft status renders Requestor mutation controls; successful submit replaces them with the returned persisted status and timestamp."

requirements-completed: [REQ-02, REQ-03, REQ-04]

duration: 9 min
completed: 2026-08-29
---

# Phase 02 Plan 08: Requestor Form and Submission Workflow Summary

**Responsive Server Component routes now support persisted Requestor draft creation, relation-safe resume/edit, and one-way confirmed submission with authoritative returned state.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-29T13:47:07Z
- **Completed:** 2026-08-29T13:55:50Z
- **Tasks:** 2 completed
- **Files modified:** 11

## Accomplishments

- Added a single-column RHF/Zod form covering all authoritative Requestor-editable assessment-request fields, authorised system/asset selectors, on-blur remediation, and the documented sponsor-directory gap.
- Added Server Component routes for new, detail, and draft edit flows, including hydrated relation defaults plus loading, error, permission, not-found, draft, and submitted presentation states.
- Made submission explicit and irreversible with confirmation, synchronous repeat protection, retry-safe 403/409/transport feedback, and persistent rendering of Strapi's returned status and submitted date.
- Proved that submitted records expose no Requestor edit or submit control, even when the client component receives a manipulated submitted payload.

## Task Commits

Each task was committed atomically:

1. **02-W0-03B: Specify draft and submit form behavior** - `bf363ce` (test)
2. **02-W0-03C: Build New Request, Request Details, draft Edit, and submit UI** - `4e58298` (feat)

## Files Created/Modified

- `apps/web/src/features/requests/request-form.tsx` - Structured create/edit form, relation mapping, draft save, and irreversible workflow controls.
- `apps/web/src/features/requests/request-form.test.tsx` - Field coverage, relation resume, validation, retry, pending lock, and submitted-state contract.
- `apps/web/src/features/requests/request-workflow.test.tsx` - Server route composition and draft-only editability contract.
- `apps/web/app/(app)/app/requests/new/page.tsx` - Authorised inventory-backed new request route.
- `apps/web/app/(app)/app/requests/[documentId]/page.tsx` - Authorised detail route with persisted workflow state and actions.
- `apps/web/app/(app)/app/requests/[documentId]/edit/page.tsx` - Draft-only edit route using hydrated persisted defaults.
- `apps/web/app/(app)/app/requests/[documentId]/loading.tsx` - Layout-matching request skeleton.
- `apps/web/app/(app)/app/requests/[documentId]/error.tsx` - Recoverable route error boundary.
- `apps/web/src/features/requests/request-domain.ts` - Closed draft editability policy and complete request projection fields.
- `apps/web/src/features/requests/request-schema.ts` - Complete normalized detail parsing for persisted editable fields and submitted date.
- `apps/web/src/components/csrm/confirm-dialog.tsx` - Optional modal-local error feedback for accessible retries.

## Decisions Made

- Persisted edit defaults are derived from `getRequest`, including hydrated relation document IDs; the browser never invents or clears relation state on resume.
- Sponsor remains absent and explicitly explained until a least-privilege sponsor-directory contract exists.
- Presentation editability is a closed `status === 'draft'` policy, while Strapi owner and transition checks remain the security boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Completed the existing detail projection for editable persisted fields**
- **Found during:** Task 2 (draft edit route implementation)
- **Issue:** The pre-existing `getRequest` normalizer omitted assessment type, business context, third-party, regulatory, and submitted-date fields, so resumed drafts could silently lose persisted values.
- **Fix:** Extended the same closed schema/domain projection with the authoritative content-schema fields; no endpoint or populate expansion was added.
- **Files modified:** `apps/web/src/features/requests/request-schema.ts`, `apps/web/src/features/requests/request-domain.ts`
- **Verification:** Strict typecheck, request service tests, form relation/default tests, and the complete web suite pass.
- **Committed in:** `4e58298`

**2. [Rule 2 - Missing Critical Functionality] Kept failed-submit guidance accessible inside modal focus**
- **Found during:** Task 2 (permission retry verification)
- **Issue:** Caller-owned inline feedback behind an open modal is hidden from the accessibility tree while ConfirmDialog correctly remains open for retry.
- **Fix:** Added optional modal-local error feedback and supplied normalized 403/409/transport messages from request workflows.
- **Files modified:** `apps/web/src/components/csrm/confirm-dialog.tsx`, `apps/web/src/features/requests/request-form.tsx`
- **Verification:** Focused feedback and request form suites prove the dialog remains open with an accessible alert and retained values.
- **Committed in:** `4e58298`

**3. [Rule 3 - Blocking] Added the jsdom ResizeObserver baseline required by Radix checkboxes**
- **Found during:** Task 2 (GREEN component verification)
- **Issue:** Radix checkbox measurement requires ResizeObserver, which jsdom does not provide.
- **Fix:** Added a test-only no-op ResizeObserver fixture before dynamically importing the form.
- **Files modified:** `apps/web/src/features/requests/request-form.test.tsx`
- **Verification:** All focused tests and the full 41-test web suite pass.
- **Committed in:** `4e58298`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical functionality, 1 blocking issue).

**Impact:** All deviations were required to preserve persisted data and accessible retry behavior; no new API, schema, package, sponsor lookup, or authorization boundary was introduced.

## Issues Encountered

None outstanding.

## Verification

- Focused RED emitted only `PHASE2_RED_W0_03B_FORM_WORKFLOW_UI_ABSENT` - PASS
- `cd apps/strapi; npm test` - PASS (10 tests)
- `cd apps/web; pnpm typecheck` - PASS
- `cd apps/web; pnpm test` - PASS (41 tests across 14 files)
- No raw fetch, frontend API facade, content schema change, sponsor lookup, hard-coded brand colour, or new dependency - PASS

## Known Stubs

None. Empty relation arrays are intentional persisted form defaults and render authorised inventory choices or an explicit no-options state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-09 can consume the completed request routes and workflow state for the Requestor dashboard journey.
- The full create → save draft → resume/edit → submit → read-only status path is ready for Phase 2 end-to-end verification.

## Self-Check: PASSED

- All eight created files and three modified contract/component files exist.
- Task commits `bf363ce` and `4e58298` exist in repository history.
- All task acceptance criteria and locked plan verification commands pass.
- No known stub prevents REQ-02, REQ-03, or REQ-04 from being achieved.

---
*Phase: 02-requestor-risk-assessment-request-workflow*
*Completed: 2026-08-29*
