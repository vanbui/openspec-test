---
phase: 03-dynamic-questionnaire-workflow
fixed_at: 2026-08-29T19:31:03Z
review_path: .planning/phases/03-dynamic-questionnaire-workflow/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-29T19:31:03Z
**Source review:** `.planning/phases/03-dynamic-questionnaire-workflow/03-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Hidden conditional questions make valid submissions appear unsubmitted

**Files modified:** `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts`, `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`, `apps/strapi/tests/helpers/strapi-http-harness.ts`, `apps/strapi/tests/questionnaire-workflow.integration.test.ts`
**Commit:** 8293bcd
**Applied fix:** State, progress, and analyst masking now use the authoritative visible question set. Added unconditional mounted coverage for a false controller value across requestor and analyst list, detail, summary, and question projections. Fixed; requires human verification because this changes workflow projection logic.

### CR-02: Concurrent saves can lose answers or reopen a submitted questionnaire

**Files modified:** `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts`, `apps/strapi/tests/helpers/strapi-http-harness.ts`, `apps/strapi/tests/questionnaire-workflow.integration.test.ts`
**Commit:** 9fb1e9d
**Applied fix:** Questionnaire mutations are serialized per questionnaire, acquire a database row lock when supported, and reload, validate, normalize, and persist inside one transaction. Added unconditional mounted PATCH/PATCH and PATCH/POST concurrency regressions. Fixed; requires human verification because this changes mutation ordering logic.

### WR-01: Rollback test exercises a test-only helper, not the production submit path

**Files modified:** `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts`, `apps/strapi/tests/questionnaire-workflow.unit.test.ts`, `apps/strapi/tests/helpers/strapi-http-harness.ts`, `apps/strapi/tests/questionnaire-workflow.integration.test.ts`
**Commit:** b4e09c3
**Applied fix:** Removed the test-only transaction helper, routed production writes through one persistence primitive, and added mounted failure injection on the second real document-service update with database reload assertions proving full rollback.

### WR-02: Workload summaries silently ignore questionnaires after the first 10,000

**Files modified:** `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts`, `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`, `apps/strapi/tests/questionnaire-workflow.unit.test.ts`
**Commit:** d5985d5
**Applied fix:** Summary queries now page deterministically through the complete authorized scope. Added a boundary regression with 1,001 records against a 1,000-record production page size.

---

_Fixed: 2026-08-29T19:31:03Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
