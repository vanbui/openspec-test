---
phase: 05
phase_name: CSRM Backend Content Model
plan: 01
title: CSRM Content-Type Schemas
status: complete
completed: 2026-05-29
requirements_completed:
  - CSRM-02
  - CSRM-03
  - CSRM-04
key_files:
  created:
    - apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json
    - apps/backend/src/api/csrm-information-asset/content-types/csrm-information-asset/schema.json
    - apps/backend/src/api/csrm-information-system/content-types/csrm-information-system/schema.json
    - apps/backend/src/api/csrm-questionnaire/content-types/csrm-questionnaire/schema.json
    - apps/backend/src/api/csrm-question/content-types/csrm-question/schema.json
    - apps/backend/src/api/csrm-assessment/content-types/csrm-assessment/schema.json
    - apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
  modified:
    - apps/backend/types/generated/contentTypes.d.ts
---

# Plan 05-01 Summary

## Outcome

Created the seven first-class CSRM Strapi collection types and the request-centered relation graph. The model keeps CSRM data separate from IdamBox authorization data while linking user-facing ownership fields to custom `IdamBox User` records.

## Task Commits

| Task | Commit | Result |
| ---- | ------ | ------ |
| CSRM schemas and generated API files | `cac07a4` | Added schemas, controllers, routers, services, and regenerated Strapi content type declarations required by `yarn check-types`. |

## Files Created Or Modified

- `apps/backend/src/api/csrm-assessment-request/**`
- `apps/backend/src/api/csrm-information-asset/**`
- `apps/backend/src/api/csrm-information-system/**`
- `apps/backend/src/api/csrm-questionnaire/**`
- `apps/backend/src/api/csrm-question/**`
- `apps/backend/src/api/csrm-assessment/**`
- `apps/backend/src/api/csrm-risk/**`
- `apps/backend/types/generated/contentTypes.d.ts`

## Requirements

- `CSRM-02`: complete. The backend has a first-class CSRM assessment request collection.
- `CSRM-03`: complete. Questionnaire and question collections are related to assessment requests.
- `CSRM-04`: complete. Assessment and risk collections are related to assessment requests and include release state fields.

## Verification

Passed:

```text
yarn workspace backend strapi ts:generate-types
yarn check-types
```

## Deviations from Plan

- Generated Strapi content type declarations were updated during Plan 05-01 rather than waiting for Plan 05-03 because `yarn check-types` correctly rejected the new generated-style factory UIDs until typegen included the new CSRM schemas.

**Total deviations:** 1 auto-fixed. **Impact:** positive; the generated types now match the new schemas before later plans build on them.

## Self-Check

PASSED
