---
phase: 07-requestor-request-workflow
verified: 2026-08-22T16:17:17Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "The Requestor dashboard highlights requests requiring action, recent submissions, request status, and relevant notifications using data-driven widgets."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Compare the committed 1440px dashboard and 390px request-form snapshots with the approved Phase 7 UI-SPEC."
    expected: "The desktop dashboard has the approved action-first hierarchy, and the mobile form, dialog, and popover remain readable and operable."
    why_human: "Visual design approval cannot be established by source inspection or a passing browser assertion. This is the deferred Plan 07-08 human checkpoint."
---

# Phase 7: Requestor Request Workflow Verification Report

**Phase Goal:** Deliver a vertical Requestor workflow for viewing, creating, saving, editing, and submitting the Requestor's own Cyber Risk Assessment Requests.
**Verified:** 2026-08-22T16:17:17Z
**Status:** human_needed
**Re-verification:** Yes — after dashboard-gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The Requestor dashboard highlights requests requiring action, recent submissions, request status, and relevant notifications using data-driven widgets. | ✓ VERIFIED | `dashboardForActor()` now makes distinct owner-bound draft and submitted queries, derives typed notices from only those rows, and the named real-Strapi regression passed: Jane sees her draft, submission, and notices; Bob's draft is excluded. |
| 2 | My Requests supports accessible search, filtering, sorting, pagination, and responsive list or table presentation. | ✓ VERIFIED | Re-verification sanity check found the owner-bound page/service/list wiring intact; the prior focused list test remains present and the Phase 07 artifact/key-link checks pass. |
| 3 | New Request and Request Details use persisted fields and terminology from the CSRM data model without inventing duplicate frontend-only domain fields. | ✓ VERIFIED | Generated OpenAPI remains byte-identical to the backend contract (105 operations); server pages, Server Actions, and backend allowlists retain the persisted request-field path. |
| 4 | A Requestor can save a draft, return to it, edit while workflow state permits, confirm submission, and see workflow state clearly. | ✓ VERIFIED | The named Playwright real-Strapi test `Jane persists, submits, withdraws, and discovers a request through real Strapi` exited 0. It exercises save, discovery, edit, submit confirmation, and withdrawal. |
| 5 | Record access and available actions are expressed through centralized capabilities and preserve ownership boundaries for later server-side enforcement. | ✓ VERIFIED | The named Playwright real-Strapi test `Bob can save Jane's draft while Jane receives a metadata-safe denial for Bob's record` exited 0. It proves analyst draft collaboration and the Requestor's metadata-free denial. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

All 39 plan-declared artifacts pass the structural verifier (existence and substantive-content checks). Re-verification performed full tracing for the former hollow dashboard path and quick regression checks for the previously passing artifacts.

| Artifact group | Expected | Status | Details |
| --- | --- | --- | --- |
| Backend request service and workflow routes | Owner-aware lifecycle and dashboard derivation | ✓ VERIFIED | `dashboardForActor()` filters drafts for attention, submissions for recency, and uses the same owner-filtered rows for notices. |
| Backend/reference OpenAPI and generated client types | Locked request-workflow contract | ✓ VERIFIED | `verify:openapi` passed: 105 operations, byte-identical backend/reference specs, unchanged generated artifact. |
| Typed CSRM service and dashboard page/component | Validated server-only data flow to widgets | ✓ VERIFIED | The service rejects malformed notice values; `app/page.tsx` maps validated data; `RequestDashboard` renders notices as links to details. |
| Request form, actions, details, list, and capability artifacts | Persisted, ownership-safe Requestor workflow | ✓ VERIFIED | All plan artifact checks passed; the two named real-stack lifecycle/ownership tests passed. |
| E2E launcher, config, workflow spec, and snapshots | Real Strapi and production-boundary proof | ✓ VERIFIED | Launcher/config/spec links pass; the three named dashboard/lifecycle/ownership Playwright tests exit 0. Visual approval remains human work below. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `dashboardForActor()` | Strapi Document Service | Owner filter before draft/submitted collection queries | ✓ WIRED | Both widget queries include `ownerFilter(actor)`; the real-stack regression excludes Bob's record. |
| Backend dashboard response | Generated OpenAPI → `csrm-service.ts` | Required `{ documentId, message }` notices | ✓ WIRED | Contract and generated type require both fields; runtime validator checks each notice before page consumption. |
| `app/page.tsx` | `RequestDashboard` | Server-loaded validated dashboard model | ✓ WIRED | Page calls `getRequestorDashboard(actor.email)` and passes mapped state to the component; no hard-coded dashboard rows were found. |
| `RequestDashboard` | Request Details route | Notice `documentId` in safe record link | ✓ WIRED | Each validated notice renders `/requests/{documentId}`; component regression test asserts the link. |
| Request pages/actions | Typed service and central route/capability policy | Server actor and ownership-safe operations | ✓ WIRED | Existing links passed quick regression; named lifecycle and ownership E2E tests exercise the complete boundary. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `apps/csrm/src/app/page.tsx` / `RequestDashboard` | `needsAttention`, `recentSubmissions`, `notices` | Typed service → owner-filtered Strapi request service | Yes | ✓ FLOWING |
| Request list page / `RequestList` | Request rows and pagination | Typed service → owner-filtered Strapi query | Yes | ✓ FLOWING |
| New/Details request forms | Persisted fields, catalogue choices, action results | Server Components/Actions → typed service → Strapi | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Owner-derived dashboard widgets and notices | `yarn workspace @idambox/csrm test:e2e --grep "derives Jane's dashboard widgets and notices from owned persisted workflow state"` | Exit 0 against disposable real Strapi | ✓ PASS |
| Draft/edit/submit/withdraw lifecycle | `yarn workspace @idambox/csrm test:e2e --grep "Jane persists, submits, withdraws, and discovers a request through real Strapi"` | Exit 0 against disposable real Strapi | ✓ PASS |
| Analyst draft collaboration and Requestor IDOR denial | `yarn workspace @idambox/csrm test:e2e --grep "Bob can save Jane's draft while Jane receives a metadata-safe denial for Bob's record"` | Exit 0 against disposable real Strapi | ✓ PASS |
| Dashboard component and typed API validation | `yarn workspace @idambox/csrm test:unit --run src/features/requests/request-dashboard.test.tsx src/lib/api/csrm-service.test.ts` | 2 files, 7 tests passed | ✓ PASS |
| API coverage and forbidden DELETE | `node apps/csrm/scripts/verify-request-api-coverage.mjs` | 105 operations; 9 adapters; prohibited DELETE confirmed | ✓ PASS |
| OpenAPI drift | `yarn workspace @idambox/csrm verify:openapi` | 105 operations; byte-identical specifications; generated client unchanged | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CSRM-05 | 07-01 through 07-08, remediation 3e3caeb | Requestor can create, view, and edit their own CSRM assessment requests in a Next.js application. | ✓ SATISFIED | All five roadmap criteria now have direct code/data-flow evidence; stateful and ownership behaviors have named real-Strapi test evidence. |

No orphaned Phase 7 requirement was found: every plan declares CSRM-05, and the requirements traceability maps it to Phases 7 and 13.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| Remediation files in 3e3caeb | — | `TBD` / `FIXME` / `XXX` | ✓ None | No unreferenced debt markers. |
| `csrm-assessment-request.ts`, `app/page.tsx` | Defensive `return []` / `return null` guards | ℹ️ Not a stub | They handle malformed/missing external values; the validated real-data paths above populate the rendered widgets. |

### Workspace Regression Assessment

`yarn workspace @idambox/csrm verify` was run once. Lint and TypeScript passed, then Vitest reported exactly three known stale assertions: two in `src/config/capabilities.test.ts` and one in `src/lib/fixtures/resolve-identity.test.ts`, each expecting 23 capabilities while the committed catalogue has 27. Git blame places the assertions in Phase 06 commits `ff9f14f` / `55fc4f` on 2026-08-09; the 27-capability catalogue change is `e29ce18` on 2026-08-10, before Phase 07. Commit `3e3caeb` does not touch either file. This is legacy suite debt, not a Phase 07 or remediation regression; it does not change the phase verdict.

### Human Verification Required

### 1. Visual approval checkpoint

**Test:** Compare `request-dashboard-desktop-1440.png` and `request-form-mobile-390.png` with the approved Phase 7 UI-SPEC.

**Expected:** The 1440px dashboard retains the action-first hierarchy, and the 390px form, dialog, and popover remain readable and operable.

**Why human:** Visual design approval is deliberately deferred by Plan 07-08 and cannot be proven by source inspection or automated assertions.

### Gaps Summary

The prior BLOCKER is closed. No implementation gaps or Phase 07 regressions remain. The phase awaits only the planned human visual-approval checkpoint; the unrelated legacy capability-count tests should be repaired separately.

---

_Verified: 2026-08-22T16:17:17Z_
_Verifier: the agent (gsd-verifier)_
