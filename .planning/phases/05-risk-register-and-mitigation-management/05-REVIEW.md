---
phase: 05-risk-register-and-mitigation-management
reviewed: 2026-08-31T22:20:18Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/strapi/src/api/csrm-risk/services/risk-register-query.ts
  - apps/strapi/src/api/csrm-risk/services/risk-register.ts
  - apps/strapi/tests/risk-register.unit.test.ts
  - apps/strapi/tests/risk-register.integration.test.ts
  - apps/strapi/tests/contract-catalogue.integration.test.ts
  - docs/references/specification.json
  - apps/web/src/lib/api/generated/schema.d.ts
  - apps/web/src/features/risks/risk-schema.ts
  - apps/web/src/features/risks/risk-service.ts
  - apps/web/src/features/risks/risk-schema.test.ts
  - apps/web/src/features/risks/risk-service.test.ts
  - apps/web/src/features/risks/risk-register-filters.tsx
  - apps/web/src/features/risks/risk-register.tsx
  - apps/web/src/features/risks/risk-register.test.tsx
  - apps/web/e2e/risk-register-workflow.spec.ts
findings:
  critical: 1
  warning: 4
  info: 0
  total: 5
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-08-31T22:20:18Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The scoped Strapi query path correctly authorizes before parsing or repository work, binds filter values, implements inclusive date predicates, and restores selected-page order after hydration. The generated contract and focused tests are in sync. However, the browser boundary silently converts invalid date constraints into an unrestricted query, date urgency is timezone-wrong, inventory filter choices are truncated without disclosure, pagination invariants are not actually validated, and the E2E pagination assertions become false once the fixture set exceeds one page.

Focused web tests passed (43 tests), but one test explicitly codifies the unsafe invalid-date widening described below.

## Critical Issues

### CR-01: Invalid date filters silently broaden to the entire authorised register

**Classification:** BLOCKER
**File:** `apps/web/src/features/risks/risk-schema.ts:44-60`
**Issue:** `canonicalizeTargetDateRange` deletes both date constraints whenever either bound is malformed, duplicated, or later than the other. The resulting object then parses successfully and is sent to Strapi without either filter. A mistyped/bookmarked URL such as `?targetDateFrom=2026-01-01&targetDateTo=bad` therefore displays all authorised Risks instead of rejecting the filter or showing an error. An inverted range entered through the two date controls similarly disappears after navigation. This is fail-open filtering and can materially change the records an analyst believes they are reviewing. `risk-schema.test.ts:76-81` currently enshrines this behavior instead of detecting it.
**Fix:** Make invalid or inverted supplied bounds a validation failure and render a non-data validation state without calling `listRiskRegister`. For example, preprocess only scalar extraction, then add a schema-level refinement:

```ts
const dateRangeSchema = z.object({
  targetDateFrom: z.iso.date().optional(),
  targetDateTo: z.iso.date().optional(),
}).superRefine(({ targetDateFrom, targetDateTo }, ctx) => {
  if (targetDateFrom && targetDateTo && targetDateFrom > targetDateTo) {
    ctx.addIssue({ code: 'custom', path: ['targetDateTo'], message: 'End date must not precede start date.' });
  }
});
```

Update the route/UI to surface that failure and add tests proving no register request occurs for malformed, duplicate, or inverted date state.

## Warnings

### WR-01: Overdue status changes on the UTC day rather than the user's calendar day

**Classification:** WARNING
**File:** `apps/web/src/features/risks/risk-schema.ts:311-313`
**Issue:** `now.toISOString().slice(0, 10)` derives the current UTC date. In Australia/Sydney, a Risk due on 31 August is still shown as not overdue for roughly the first ten hours of 1 September local time. In negative UTC offsets, the inverse boundary error occurs. This produces a false operational status around every local midnight; the test only covers an exact UTC-midnight instant and cannot catch it.
**Fix:** Compare against a documented application/user timezone calendar date (or pass a server-derived business date into the component) rather than UTC. Add tests on both sides of midnight with positive and negative offsets.

### WR-02: System and asset filter pickers silently expose only the first 100 records

**Classification:** WARNING
**File:** `apps/web/src/features/risks/risk-service.ts:84-99`
**Issue:** Both inventory requests hard-code `page: 1, pageSize: 100` and return that page as if it were the complete option set. `parseRiskPickerPayload` accepts metadata showing additional pages (`risk-schema.ts:275-284`) but neither fetches them nor reports truncation. With more than 100 systems or assets, valid filter targets cannot be selected, even though the Risk Register endpoint accepts their document IDs.
**Fix:** Use a server-supported searchable picker, or fetch all bounded pages while checking `pageCount`/`total`. At minimum, reject an apparently incomplete payload instead of presenting it as complete, and test metadata with `pageCount > 1` and `total > data.length`.

### WR-03: The external payload validator accepts contradictory pagination metadata

**Classification:** WARNING
**File:** `apps/web/src/features/risks/risk-schema.ts:143-153`
**Issue:** The Zod boundary validates each pagination field independently but not their relationships. Payloads such as `{ data: [row], pagination: { page: 1, pageSize: 25, pageCount: 99, total: 0 } }` pass. The UI then mixes those untrusted fields (`risk-register.tsx:84-92,126`), using `pageCount` for stale-page correction while its table recomputes pages from `total`. A backend regression or inconsistent snapshot can consequently render contradictory counts/navigation despite the stated closed, honest boundary.
**Fix:** Add `superRefine` invariants: `pageCount === Math.ceil(total / pageSize)`, `data.length <= pageSize`, zero totals imply empty data/pageCount zero, and out-of-range pages imply empty data. Add hostile-payload tests for each contradiction.

### WR-04: E2E assertions confuse the current page size with the global result total

**Classification:** WARNING
**File:** `apps/web/e2e/risk-register-workflow.spec.ts:102,179`
**Issue:** The test requires the mobile card count and distinct first-page Risk numbers to equal the global `total`. The page size is 25, so the assertions fail as soon as the reusable test database contains more than 25 Risks, even when pagination is perfectly correct. This makes the acceptance test dependent on fixture volume and discourages adding legitimate fixtures.
**Fix:** Assert the visible count equals `min(total, pageSize)` on page one. If exact global uniqueness is required, walk every page, accumulate document identifiers, and compare the accumulated distinct count with `total`.

---

_Reviewed: 2026-08-31T22:20:18Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
