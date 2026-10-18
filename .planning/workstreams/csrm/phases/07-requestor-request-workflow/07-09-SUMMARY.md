---
phase: 07-requestor-request-workflow
plan: "09"
subsystem: requestor-dashboard-remediation
tags: [strapi, nextjs, playwright, ownership, workflow]
status: complete
---

# Phase 07 Plan 09: Dashboard Derivation Remediation Summary

**The Requestor dashboard now derives action-needed requests, recent submissions, and actionable notices from owner-bound persisted workflow records.**

## Remediation

- `draft` requests are the owner-bound **Needs your attention** collection.
- `submitted` requests are the distinct owner-bound **Recently submitted** collection.
- The backend derives a request notice for each returned draft and submitted record, with its request identifier; the UI validates and renders those notices as safe links to the already-authorized request details route.
- The typed OpenAPI dashboard response now documents non-empty notice objects (`documentId`, `message`) while retaining the approved 105-operation contract and prohibiting generic request DELETE.

## Regression Proof

The disposable real-Strapi Playwright regression creates Jane's draft and submitted requests plus Bob's private draft. It proves that Jane's dashboard:

- includes only Jane's draft in action-needed;
- includes only Jane's submitted request in recent submissions;
- emits the corresponding workflow notices; and
- renders those real backend values without exposing Bob's record.

## Verification

- `yarn workspace @idambox/csrm test:unit --run src/features/requests/request-dashboard.test.tsx src/lib/api/csrm-service.test.ts` — passed (7 tests)
- `yarn workspace @idambox/csrm check-types` — passed
- `yarn workspace backend check-types` — passed
- `yarn workspace @idambox/csrm test:e2e --grep "derives Jane's dashboard widgets"` — passed (1 real-Strapi test)
- `yarn workspace @idambox/csrm verify:openapi` — passed (105 operations; byte-identical specifications)
- `node apps/csrm/scripts/verify-request-api-coverage.mjs` — passed
- `yarn workspace @idambox/csrm lint` — passed

## Scope and Security

No new route, entitlement, delete operation, or lifecycle transition was introduced. Dashboard queries retain the existing server-side owner filter, and notices only reference records returned by those owner-bound queries.
