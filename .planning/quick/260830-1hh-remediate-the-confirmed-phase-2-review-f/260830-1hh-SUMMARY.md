---
phase: quick
plan: 260830-1hh
subsystem: authorization-and-request-workflow
tags: [strapi, nextjs, authorization, accessibility, regression]
requires:
  - phase-02-requestor-risk-assessment-request-workflow
provides:
  - fail-closed development identity and permission reconciliation
  - accurate request collection and dashboard states
  - accessible mutation confirmation and form feedback
affects: [phase-02-verification]
tech-stack:
  added: []
  patterns:
    - shared explicit development activation predicate
    - exact managed permission reconciliation
    - canonical controlled table sorting
    - route-local form loading composition
key-files:
  created:
    - apps/strapi/src/utils/development-identity-enabled.ts
    - apps/web/src/features/requests/request-form-loading.tsx
    - apps/web/app/(app)/app/requests/new/loading.tsx
    - apps/web/app/(app)/app/requests/[documentId]/edit/loading.tsx
  modified:
    - apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
    - apps/strapi/tests/authorization.integration.test.ts
    - apps/strapi/tests/request-workflow.integration.test.ts
    - apps/web/src/components/csrm/data-table.tsx
    - apps/web/src/features/dashboard/requestor-dashboard-service.ts
    - apps/web/src/features/requests/request-actions.ts
    - apps/web/src/features/requests/request-form.tsx
    - apps/web/src/features/requests/request-table.tsx
decisions:
  - Require three exact development environment values before identity impersonation or managed public grants are enabled.
  - Reconcile only the six owned public permission rows and preserve unrelated operator-managed rows.
  - Disable request filters during streamed route loading so browser input cannot be replaced mid-interaction.
metrics:
  duration: 22m
  completed: 2026-08-30
  tasks: 3
  files: 31
---

# Quick Plan 260830-1hh: Phase 2 Review Remediation Summary

Fail-closed Strapi authorization, accurate request collection states, and accessible request mutation feedback with regression coverage for all 19 confirmed findings.

## Performance

- **Duration:** 22 minutes
- **Started:** 2026-08-29T15:10:33Z
- **Completed:** 2026-08-29T15:32:33Z
- **Tasks:** 3
- **Files changed:** 31

## Accomplishments

- Closed development identity and public-permission activation behind three explicit gates and made disabled-state reconciliation authoritative and idempotent.
- Applied exact FunctionAPI policies to reference-data detail and mutation routes without broadening the served catalogue.
- Corrected sorting, pagination recovery, dashboard totals, loading presentation, confirmation behavior, mutation refresh, and form accessibility.
- Replaced conditional server checks with unconditional mounted regressions and completed browser coverage for the Requestor journey.

## Task Commits

1. **Task 1: Make server workflow and development authorization guards fail closed** - `88d65e1`
2. **Task 2: Correct request collection state, dashboard totals, and table presentation** - `1e177ed`
3. **Task 3: Refresh request mutations and complete accessible form feedback** - `09c8ae2`

## Finding Coverage

| Findings | Result |
|---|---|
| F-01, F-02, F-17, F-18, F-19 | Unconditional server regressions, explicit development gate, exact grant reconciliation, and fail-closed reference routes |
| F-03, F-05, F-06, F-09, F-10, F-12, F-13 | Canonical sorting, filtered totals, page recovery, semantic typography, layout-matched loading, and accurate announcements |
| F-04, F-07, F-08, F-11, F-14, F-15, F-16 | Exact detail refresh, visible retry guidance, accurate missing-record copy, form loaders, caller-owned confirmation, and accessible errors |

## Verification

- `apps/strapi`: `npm test` — 11 passed.
- `apps/web`: `pnpm typecheck` — passed.
- `apps/web`: `pnpm test` — 44 passed across 15 files.
- `apps/web`: `pnpm api:check` — passed with no generated-contract difference.
- `apps/web`: `pnpm test:e2e` — 9 passed.
- Direct catalogue comparison — byte-identical.
- Base-to-HEAD scope audit — no content-type schema, catalogue, dependency manifest, generated contract, or unrelated user-owned file changed.
- `git diff --check` — passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented reference-route fixtures from affecting workflow counts**

- **Found during:** Task 1 verification
- **Issue:** Mounted reference-route coverage created workflow fixtures that polluted a later collection-count assertion.
- **Fix:** Exercised the protected routes with nonexistent identifiers so authorization is proven without creating workflow records.
- **Files modified:** `apps/strapi/tests/authorization.integration.test.ts`
- **Commit:** `88d65e1`

**2. [Rule 1 - Bug] Prevented streamed loading state from replacing entered search text**

- **Found during:** Full browser verification after Task 3
- **Issue:** The route loading table could accept input immediately before the streamed final table replaced it, clearing the entered query.
- **Fix:** Disabled request filters during loading and submitted the value from the form DOM once the final table is interactive.
- **Files modified:** `apps/web/src/features/requests/request-table.tsx`, `apps/web/src/features/requests/request-table.test.tsx`
- **Commit:** `09c8ae2`

## Known Stubs

None.

## Security Review

All new trust-boundary behavior was identified in the plan threat register. No additional security surface was introduced.

## Scope Preservation

- Branch remained `dylan-test`.
- Existing changes to `02-VERIFICATION.md` and `02-REVIEW-FINDINGS.md` remain intact and unstaged.
- Both catalogue files, all content-type schemas, dependency manifests, and generated contracts remain unchanged.

## Self-Check: PASSED

- All created files exist.
- All three task commits exist in order from base `1aec468`.
- Required checks are green and the implementation history contains exactly the requested task commits.
