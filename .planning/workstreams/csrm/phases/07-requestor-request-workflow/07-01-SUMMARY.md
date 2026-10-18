---
phase: 07-requestor-request-workflow
plan: "01"
subsystem: api
tags: [strapi, koa, ownership, lifecycle, sqlite, security]
requires:
  - phase: 02-csrm-bootstrap-data
    provides: Persisted IdamBox users, roles, and Function grants for actor and analyst resolution.
  - phase: 05-csrm-content-model
    provides: CsrmAssessmentRequest and catalogue content types.
provides:
  - Authenticated server-to-server actor boundary for CSRM request operations.
  - Owner-bound request creation, lifecycle transitions, bounded reads, and analyst draft collaboration.
  - Disposable real-Strapi HTTP evidence for ownership and lifecycle protections.
affects: [07-02-openapi-transport, 07-03-typed-services, 07-04-server-actions, 07-05-request-form]
actuals:
  tokens: 9455
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Server-asserted internal token and actor email policy with persisted Function-derived capability.
    - Document Service filters applied at ownership lookup, with fixed metadata-safe denials.
    - Disposable SQLite loopback HTTP verifier for Strapi workflow security.
key-files:
  created:
    - apps/backend/src/api/csrm-assessment-request/policies/internal-csrm-caller.ts
    - apps/backend/src/api/csrm-assessment-request/routes/01-csrm-assessment-request-workflow.ts
    - scripts/verify-csrm-request-workflow.mjs
  modified:
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
key-decisions:
  - "Authenticate CSRM internal calls with a non-public digest-compared token and server-asserted active IdamBoxUser email."
  - "Derive analyst elevation from the persisted Risk Assessment Requests:Requests Function, never role-name strings."
  - "Return the same fixed 404 body for unknown and non-owned request identifiers."
patterns-established:
  - "Request workflow mutations whitelist draft fields and derive owner, number, status, and submitted date server-side."
  - "List and dashboard queries only accept bounded, allowlisted filters and sorts."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: Owner-bound persisted draft creation and metadata-safe detail access.
    requirement: CSRM-05
    verification:
      - kind: integration
        ref: node scripts/verify-csrm-request-workflow.mjs --case owned-draft-tracer
        status: pass
    human_judgment: false
  - id: D2
    description: Server-enforced draft lifecycle, bounded requests/dashboard reads, and relation validation.
    requirement: CSRM-05
    verification:
      - kind: integration
        ref: node scripts/verify-csrm-request-workflow.mjs --case lifecycle --case list-dashboard
        status: pass
    human_judgment: false
  - id: D3
    description: Persisted Function-derived analyst read/save collaboration for unsubmitted drafts only.
    requirement: CSRM-05
    verification:
      - kind: integration
        ref: node scripts/verify-csrm-request-workflow.mjs --case analyst-draft
        status: pass
    human_judgment: false
duration: 18m
completed: 2026-08-22
status: complete
---

# Phase 07 Plan 01: Request Workflow Boundary Summary

**Authenticated Strapi request workflow with owner-filtered persistence, server-controlled lifecycle transitions, and Function-derived analyst draft collaboration.**

## Performance

- **Duration:** 18m
- **Started:** 2026-08-22T13:20:15Z
- **Completed:** 2026-08-22T13:38:27Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a server-only internal caller policy that digest-compares the non-public token, resolves one active IdamBoxUser, and derives analyst capability from persisted Functions.
- Replaced generic request access with owner-filtered creation, detail, list, dashboard, save, submit, and withdraw behavior; generic DELETE is not routed.
- Added disposable SQLite real-HTTP coverage for forged fields, identifier swapping, bounded query parsing, lifecycle rules, catalogue relations, and analyst draft-only collaboration.

## Task Commits

1. **Task 1: Prove one authenticated owner-created draft through real Strapi HTTP** — `383e811` (RED verifier), `620b113` (owner boundary).
2. **Task 2: Expand lifecycle, reads, and analyst draft collaboration** — `27ef132` (RED verifier), `3ded4d8` (workflow implementation).

## Files Created/Modified

- `apps/backend/src/api/csrm-assessment-request/policies/internal-csrm-caller.ts` — internal credential verification and persisted actor/capability resolution.
- `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` — safe HTTP envelopes and workflow action dispatch.
- `apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts` — ownership filters, transitions, validation, bounded reads, and serialization.
- `apps/backend/src/api/csrm-assessment-request/routes/*.ts` — protected generic and explicit dashboard/transition routes without DELETE.
- `scripts/verify-csrm-request-workflow.mjs` — bounded disposable Strapi listener verification and cleanup.

## Decisions Made

- Used identical fixed `404` responses for unknown and non-owned resource access, including analyst submission attempts, to avoid record-existence disclosure.
- Allowed a persisted analyst Function to view/save any unsubmitted draft while preserving the Requestor and draft state; submission and withdrawal remain owner-only.
- Kept catalogue relation validation at the persistence boundary while allowing each optional relation list to be empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mounted the Strapi server before binding the verifier listener**
- **Found during:** Task 1
- **Issue:** Binding `httpServer` directly did not mount content API routes, producing a misleading `404`.
- **Fix:** Bound through the Strapi server wrapper so it mounts routes before the loopback listener accepts requests.
- **Files modified:** `scripts/verify-csrm-request-workflow.mjs`
- **Verification:** Real `POST /api/csrm-assessment-requests` returned `201` after the fix.

**2. [Rule 1 - Bug] Aligned analyst submission denial with metadata-safe ownership semantics**
- **Found during:** Task 2
- **Issue:** The verifier expected a `403`, but the owner-filtered endpoint deliberately returns the fixed non-disclosing `404` for a non-owner.
- **Fix:** Asserted the intended `404` denial and absence of request data.
- **Files modified:** `scripts/verify-csrm-request-workflow.mjs`
- **Verification:** Full real-HTTP workflow verifier passed.

**Total deviations:** 2 auto-fixed Rule 1 issues. No scope expansion or dependency change.

## Known Stubs

None.

## Verification

- `yarn workspace backend check-types` — passed.
- `node scripts/verify-csrm-request-workflow.mjs --case owned-draft-tracer --case lifecycle --case list-dashboard --case analyst-draft` — passed.
- `node scripts/verify-csrm-seed-runtime.mjs` — passed.

## Planning State Notes

- `state.advance-plan` could not update the existing Phase 7 table because it does not contain the handler's expected Current Plan/Total Plans fields.
- `requirements.mark-complete CSRM-05` found no matching requirement in the existing requirements register. The plan still declares CSRM-05 as its completed requirement; the roadmap handler recorded Plan 01 progress successfully.

## User Setup Required

Set the same random, non-public `IDAMBOX_CSRM_INTERNAL_TOKEN` (at least 32 bytes) for the backend and CSRM server. Do not expose or commit it, and never use a `NEXT_PUBLIC_` variable.

## Next Phase Readiness

The direct Strapi ownership/lifecycle contract is ready for OpenAPI generation and typed server-only transport work in Plan 07-02.

## Self-Check: PASSED

Confirmed all six implementation artifacts and all four TDD commits (`383e811`, `620b113`, `27ef132`, `3ded4d8`) exist in Git history.
