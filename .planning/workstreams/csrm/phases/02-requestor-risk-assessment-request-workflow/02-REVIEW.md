---
phase: 02-requestor-risk-assessment-request-workflow
reviewed: 2026-08-30T00:44:00Z
depth: standard
files_reviewed: 67
files_reviewed_list:
  - apps/strapi/config/middlewares.ts
  - apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
  - apps/strapi/src/api/csrm-assessment-request/services/request-number.ts
  - apps/strapi/src/api/csrm-assessment-request/services/request-workflow.ts
  - apps/strapi/src/api/csrm-information-asset/operations.ts
  - apps/strapi/src/api/csrm-information-asset/routes/csrm-information-asset.ts
  - apps/strapi/src/api/csrm-information-system/operations.ts
  - apps/strapi/src/api/csrm-information-system/routes/csrm-information-system.ts
  - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/strapi/src/bootstrap/seed-csrm-data.ts
  - apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts
  - apps/strapi/src/index.ts
  - apps/strapi/src/middlewares/csrm-development-identity.ts
  - apps/strapi/src/policies/csrm-authorization.ts
  - apps/strapi/tests/authorization.integration.test.ts
  - apps/strapi/tests/contract-catalogue.integration.test.ts
  - apps/strapi/tests/helpers/strapi-http-harness.ts
  - apps/strapi/tests/request-workflow.integration.test.ts
  - apps/web/.env.local.example
  - apps/web/app/(app)/app/error.tsx
  - apps/web/app/(app)/app/loading.tsx
  - apps/web/app/(app)/app/page.tsx
  - apps/web/app/(app)/app/requests/[documentId]/edit/page.tsx
  - apps/web/app/(app)/app/requests/[documentId]/error.tsx
  - apps/web/app/(app)/app/requests/[documentId]/loading.tsx
  - apps/web/app/(app)/app/requests/[documentId]/page.tsx
  - apps/web/app/(app)/app/requests/error.tsx
  - apps/web/app/(app)/app/requests/loading.tsx
  - apps/web/app/(app)/app/requests/new/page.tsx
  - apps/web/app/(app)/app/requests/page.tsx
  - apps/web/app/layout.tsx
  - apps/web/e2e/requestor-request-workflow.spec.ts
  - apps/web/package.json
  - apps/web/playwright.config.ts
  - apps/web/src/components/csrm/confirm-dialog.tsx
  - apps/web/src/components/csrm/data-table.test.tsx
  - apps/web/src/components/csrm/data-table.tsx
  - apps/web/src/components/csrm/detail-section.tsx
  - apps/web/src/components/csrm/feedback-composites.test.tsx
  - apps/web/src/components/csrm/form-section.tsx
  - apps/web/src/components/csrm/page-header.tsx
  - apps/web/src/components/csrm/section-composites.test.tsx
  - apps/web/src/components/csrm/status-badge.tsx
  - apps/web/src/components/shell/app-shell.tsx
  - apps/web/src/features/dashboard/requestor-dashboard-service.ts
  - apps/web/src/features/dashboard/requestor-dashboard.test.tsx
  - apps/web/src/features/dashboard/requestor-dashboard.tsx
  - apps/web/src/features/requests/request-actions.test.ts
  - apps/web/src/features/requests/request-actions.ts
  - apps/web/src/features/requests/request-domain.ts
  - apps/web/src/features/requests/request-form-values.ts
  - apps/web/src/features/requests/request-form.test.tsx
  - apps/web/src/features/requests/request-form.tsx
  - apps/web/src/features/requests/request-schema.ts
  - apps/web/src/features/requests/request-service.test.ts
  - apps/web/src/features/requests/request-service.ts
  - apps/web/src/features/requests/request-table.test.tsx
  - apps/web/src/features/requests/request-table.tsx
  - apps/web/src/features/requests/request-workflow.test.tsx
  - apps/web/src/features/shell/shell-service.ts
  - apps/web/src/lib/api/generated/schema.d.ts
  - apps/web/src/lib/api/transport/server-client.test.ts
  - apps/web/src/lib/api/transport/server-client.ts
  - apps/web/src/lib/auth/development-session-adapter.ts
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/specification.json
findings:
  critical: 6
  warning: 4
  info: 0
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-30T00:44:00Z
**Depth:** standard
**Files Reviewed:** 67
**Status:** issues_found

## Summary

The requestor workflow has useful ownership scoping and field allowlisting, but it is not ready to ship. Six blockers remain: production authentication is absent, several mounted reference-data routes have no CSRM authorization policy, analyst requests bypass the published mutation contract, draft immutability is vulnerable to concurrent updates, and both dashboard and reference-data projections silently truncate valid records. Four test and data-presentation defects reduce the chance these failures will be caught.

Both submitted test suites passed (`42` web tests and `10` Strapi tests), but the passing coverage does not exercise several vulnerable paths described below.

## Narrative Findings

## Critical Issues

### CR-01: Production requests have no authentication session or credential propagation

**Classification:** BLOCKER
**File:** `apps/web/src/lib/auth/development-session-adapter.ts:81-105`; `apps/web/src/lib/api/transport/server-client.ts:44-61`
**Issue:** Outside `NODE_ENV=development`, `getSessionAdapter()` returns an adapter whose `current`, capability, and sign-in methods all throw. The Strapi transport only derives the development identity header and never forwards a production Keycloak access token. Consequently, the protected application cannot render in production and every direct Strapi call is unauthenticated. This violates the required Keycloak-to-Strapi authentication boundary and creates pressure to expose Content API permissions publicly.
**Fix:** Implement a production Keycloak-backed `SessionAdapter`, validate the server-side session, obtain the user's access token, and attach `Authorization: Bearer <token>` in `createStrapiClient`. Keep the development header branch strictly development-only, and add an integration test proving a production session reaches Strapi while a missing/invalid token fails closed.

### CR-02: Reference-data detail and mutation routes bypass FunctionAPI authorization

**Classification:** BLOCKER
**File:** `apps/strapi/src/api/csrm-information-system/routes/csrm-information-system.ts:15-18`; `apps/strapi/src/api/csrm-information-asset/routes/csrm-information-asset.ts:15-18`
**Issue:** Only each collection `find` action runs `global::csrm-authorization`. `findOne`, `create`, `update`, and `delete` run only the application-enabled policy. If any corresponding users-permissions action is enabled, callers can read or mutate inventory without an IdamBox Role -> Function -> FunctionAPI decision. The exposed routes therefore do not preserve Strapi as the authorization boundary.
**Fix:** Add canonical operation constants and `global::csrm-authorization` policies to every served route, granting requestors only the intended reference-data reads and restricting administration mutations to explicit analyst/admin FunctionAPI grants. Alternatively disable routes that are not part of the served contract. Add anonymous, requestor, analyst, and missing-exact-grant tests for the actual `/{id}` URLs.

### CR-03: Analyst create/update payloads bypass the authoritative workflow contract

**Classification:** BLOCKER
**File:** `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts:70-75`; `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts:95-101`; `apps/web/src/lib/api/generated/schema.d.ts:3270-3313`
**Issue:** Requestor payloads are allowlisted, but the analyst branches spread arbitrary `input` directly into Strapi. An analyst or Security Analyst Agent can therefore set server-owned `requestor`, `submittedDate`, `questionnaire`, `assessment`, or arbitrary workflow status values, even though the authoritative generated contract only permits editable request fields and the `submitted` intent. On create, the same branch can forge initial ownership and workflow facts. This can reassign records between requestors and bypass the documented transition model.
**Fix:** Validate every actor's external payload against an explicit server-side schema and use actor-specific allowlists and transition functions. Never spread raw request data into `documents.create/update`. If analysts need additional transitions, expose and catalogue dedicated operations with explicit transition validation and tests; keep ownership and generated workflow facts server-owned.

### CR-04: Concurrent update and submission can modify a request after submission

**Classification:** BLOCKER
**File:** `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts:95-101`; `apps/strapi/src/api/csrm-assessment-request/services/request-workflow.ts:56-73`
**Issue:** The controller reads the persisted draft, validates it, and updates it in separate operations. Two concurrent requests can both observe `draft`; one can submit while the other subsequently writes editable fields based on the stale draft snapshot. The request remains submitted but is changed after the irreversible transition, contradicting the promised read-only state. The UI advertises a `409` conflict path, but the server has no version or conditional-write mechanism that can produce it.
**Fix:** Make validation and mutation atomic. Use a database transaction with a row lock or a conditional update that includes the expected `requestStatus` and version/`updatedAt`, and return `409` when no draft row matches. Apply the same guard to submission so only one transition wins. Add a concurrency integration test with interleaved save and submit operations.

### CR-05: Dashboard silently omits actionable requests after the first 50

**Classification:** BLOCKER
**File:** `apps/web/src/features/dashboard/requestor-dashboard-service.ts:49-65`; `apps/web/src/features/dashboard/requestor-dashboard-service.ts:69-82`
**Issue:** The dashboard derives counts and items from a single page of 50 requests. A requestor with more than 50 records can have drafts or questionnaires on later pages, yet the dashboard reports lower counts and omits those actions. Sorting by update time does not make the projection complete.
**Fix:** Add server-side scoped aggregate/action endpoints or page through the complete bounded result set before deriving counts. Prefer dedicated Strapi projections that return authoritative counts and a deliberately limited recent-items list, and represent those two concepts separately in the UI contract.

### CR-06: Request forms silently hide inventory records after the first 100

**Classification:** BLOCKER
**File:** `apps/web/src/features/requests/request-service.ts:96-121`
**Issue:** Both reference-data loaders request only page 1 with `pageSize: 100` and discard pagination metadata. Valid systems and assets after the first 100 can never be selected in create/edit workflows, with no indication that results are incomplete. This makes the workflow incorrect for realistic inventories.
**Fix:** Implement paginated/searchable inventory selection, or retrieve all pages with a documented safe bound. Parse and retain pagination metadata so the UI can load additional authorized options. Add coverage with at least 101 records and verify selection of a later-page item.

## Warnings

### WR-01: Reference-route tests do not exercise the vulnerable detail URLs

**Classification:** WARNING
**File:** `apps/strapi/tests/contract-catalogue.integration.test.ts:175-194`
**Issue:** The mutation loop sends `PUT` and `DELETE` to collection URLs, which only proves those methods return `405`. It never calls `/api/csrm-information-systems/{id}` or `/api/csrm-information-assets/{id}`, where the unprotected core actions are actually mounted. POST also remains blocked by users-permissions in the harness rather than proving the CSRM policy denied it.
**Fix:** Seed the relevant Content API permissions in the isolated harness, then call every real collection/detail route and assert the CSRM policy decision for anonymous, requestor, analyst, and missing-exact-grant identities.

### WR-02: The Strapi harness leaks most environment mutations

**Classification:** WARNING
**File:** `apps/strapi/tests/helpers/strapi-http-harness.ts:88-109`; `apps/strapi/tests/helpers/strapi-http-harness.ts:340-348`
**Issue:** The harness changes APP keys, token salts, database settings, feature flags, and notification settings, but records and restores only three environment variables. Later tests in the same process inherit security-sensitive test configuration and can pass or fail depending on execution order.
**Fix:** Snapshot every environment variable the harness mutates and restore or delete each one in `close()`. Prefer a scoped helper that applies and restores the full environment map in a `try/finally` block.

### WR-03: End-to-end tests reuse a persistent fixed database

**Classification:** WARNING
**File:** `apps/web/playwright.config.ts:20-31`; `apps/web/e2e/requestor-request-workflow.spec.ts:55-56`
**Issue:** Playwright always starts Strapi against `.tmp/playwright-02-09.db` and does not remove or uniquely provision it. Every run retains newly created requests, so results depend on prior runs and the database grows indefinitely. A timestamped title reduces direct collisions but does not provide isolation.
**Fix:** Generate a per-run temporary SQLite path in setup, remove it during teardown, and seed only the fixtures required by the run. Alternatively reset the fixed test database before starting Strapi.

### WR-04: Missing third-party data is presented as an explicit "No"

**Classification:** WARNING
**File:** `apps/web/src/features/requests/request-schema.ts:132-158`; `apps/web/app/(app)/app/requests/[documentId]/page.tsx:37`
**Issue:** The transport schema accepts `thirdPartyInvolvement: null`, but `toRequest` converts null/undefined to `false`. The detail page then displays "No", turning an unknown or legacy missing value into an affirmative business statement. This can misstate assessment scope.
**Fix:** Preserve `boolean | null` in the domain model and render `Not provided` for null, reserving "Yes" and "No" for explicit boolean values. Add a payload-mapping and detail-render test for null.

---

_Reviewed: 2026-08-30T00:44:00Z_
_Reviewer: code review_
_Depth: standard_
