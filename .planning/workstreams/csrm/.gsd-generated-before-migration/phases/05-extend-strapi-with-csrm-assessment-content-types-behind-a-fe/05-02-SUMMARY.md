---
phase: 05
phase_name: CSRM Backend Content Model
plan: 02
title: CSRM Feature Flag Guarding
status: complete
completed: 2026-05-29
requirements_completed:
  - CSRM-01
key_files:
  created:
    - apps/backend/src/csrm/config.ts
    - apps/backend/src/policies/csrm-app-enabled.ts
  modified:
    - apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts
    - apps/backend/src/api/csrm-information-asset/routes/csrm-information-asset.ts
    - apps/backend/src/api/csrm-information-system/routes/csrm-information-system.ts
    - apps/backend/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
    - apps/backend/src/api/csrm-question/routes/csrm-question.ts
    - apps/backend/src/api/csrm-assessment/routes/csrm-assessment.ts
    - apps/backend/src/api/csrm-risk/routes/csrm-risk.ts
---

# Plan 05-02 Summary

## Outcome

Added the `csrmAppIsEnabled` feature flag helper and a shared Strapi policy that blocks CSRM application-facing routes unless the flag is set to `true`. All seven CSRM routers apply `global::csrm-app-enabled` to core CRUD actions while schema registration remains static.

## Task Commits

| Task | Commit | Result |
| ---- | ------ | ------ |
| CSRM feature flag route guard | `9695a0a` | Added shared config/policy files and applied the policy to all generated CSRM routers. |

## Files Created Or Modified

- `apps/backend/src/csrm/config.ts`
- `apps/backend/src/policies/csrm-app-enabled.ts`
- `apps/backend/src/api/csrm-*/routes/*.ts`

## Requirements

- `CSRM-01`: complete. Active CSRM route behavior is gated by `process.env.csrmAppIsEnabled === "true"`.

## Verification

Passed:

```text
yarn check-types
rg 'process\.env\.csrmAppIsEnabled === "true"|global::csrm-app-enabled|auth: false|csrmAppIsEnabled' apps/backend/src/csrm apps/backend/src/policies apps/backend/src/api/csrm-*/routes/*.ts
git diff -- apps/backend/src/index.ts apps/backend/src/admin
```

No `auth: false` entries, `apps/backend/src/index.ts` changes, or `apps/backend/src/admin` files were introduced.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Self-Check

PASSED
