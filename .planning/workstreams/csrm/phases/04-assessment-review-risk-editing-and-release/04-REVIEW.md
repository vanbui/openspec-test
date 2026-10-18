---
phase: 04-assessment-review-risk-editing-and-release
reviewed: 2026-08-30T06:50:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - AGENTS.md
  - .planning/phases/04-assessment-review-risk-editing-and-release/04-VERIFICATION.md
  - apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/strapi/src/api/csrm-assessment/routes/csrm-assessment.ts
  - apps/strapi/src/api/csrm-assessment-request/services/collection-scope.ts
  - apps/strapi/src/api/csrm-risk/services/risk-workflow.ts
  - apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts
  - apps/strapi/src/api/csrm-risk/routes/csrm-risk.ts
  - apps/strapi/src/api/csrm-control-implementation/routes/csrm-control-implementation.ts
  - apps/strapi/tests/assessment-workflow.unit.test.ts
  - apps/strapi/tests/assessment-workflow.integration.test.ts
  - apps/web/src/features/assessments/assessment-schema.ts
  - apps/web/src/features/assessments/assessment-service.ts
  - apps/web/src/features/assessments/assessment-actions.ts
  - apps/web/src/features/assessments/assessment-editor.tsx
  - apps/web/src/features/assessments/risk-editor.tsx
  - apps/web/src/features/assessments/control-implementation-editor.tsx
  - apps/web/src/features/assessments/owner-combobox.tsx
  - apps/web/src/features/assessments/assessment-editor.test.tsx
  - apps/web/src/features/assessments/assessment-service.test.ts
  - apps/web/src/features/assessments/assessment-actions.test.ts
  - apps/web/src/features/assessments/owner-combobox.test.tsx
  - apps/web/src/features/assessments/assessment-review-workflow.test.tsx
  - apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx
  - apps/web/e2e/assessment-release-workflow.spec.ts
  - apps/web/e2e/questionnaire-workflow.spec.ts
  - apps/web/e2e/requestor-request-workflow.spec.ts
  - docs/references/specification.json
  - apps/web/src/lib/api/generated/schema.d.ts
  - scripts/verify-phase-04-integrity.ps1
  - scripts/verify-phase-04-integrity.test.ps1
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-30T06:50:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

The closure fixes resolve the prior destructive nullable-exemption edit, immediate owner-selection display loss, stale readiness, and mismatched owner-label bound. The analyst detail now has the complete Risk projection, persists and reloads it, and uses server-backed owner search; duplicate shared GET registrations are gone. One refresh-path owner-display defect remains.

Focused web tests passed: 40 tests across the editor, owner-combobox, and assessment-service suites. The test process reported the local Node 22 engine mismatch (the workspace requires Node 24), so that passing result is not a substitute for the configured Node 24 gate.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Refreshed owner labels are discarded by the editor

**File:** `apps/web/src/features/assessments/assessment-editor.tsx:157`

**Issue:** `refreshAssessment()` replaces `currentAssessment` with the authoritative analyst-detail response, including its new `ownerLabels`, but `options.users` is built from the original `users` prop. When an analyst creates a Risk and selects an owner returned only by search, the create editor unmounts and the new Risk editor mounts with the stale initial label set. Its selected owner therefore has no visible name even though the stored owner ID is present. This is a continuation of the owner-selection fidelity problem on the create-and-refresh path.

**Fix:** Build the option set from `currentAssessment.ownerLabels` (or update a local owner-label map inside `refreshAssessment`) so each refresh carries the server-resolved selected owners into newly mounted Risk editors. Add a regression test that selects a searched owner while creating a Risk, completes the refresh, and asserts the created Risk shows that owner.

---

_Reviewed: 2026-08-30T06:50:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
