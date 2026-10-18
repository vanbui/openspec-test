---
phase: 07-requestor-request-workflow
plan: "02"
subsystem: api
tags: [strapi, openapi, openapi-typescript, contract, typescript, reproducibility]
requires:
  - phase: 07-requestor-request-workflow
    provides: Protected dashboard, submit, and withdraw request-workflow routes with no generic DELETE endpoint.
provides:
  - Deterministic 105-operation Strapi OpenAPI source with typed request-workflow custom routes.
  - Byte-identical CSRM reference specification and generated transport definitions.
  - Drift protection for specification equality, generated types, controlled mismatches, and write boundaries.
affects: [07-03-typed-services, 07-04-server-actions, 07-08-integration-hardening]
actuals:
  tokens: 119178
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns:
    - Custom Strapi routes declare Zod request/response schemas so OpenAPI emits typed path, body, and success contracts.
    - OpenAPI generation normalizes generator-invented datetime defaults before committing artifacts.
    - Drift verification compares backend/reference bytes and generates only beneath an OS temporary directory.
key-files:
  created:
    - apps/backend/scripts/normalize-openapi-specification.mjs
  modified:
    - apps/backend/package.json
    - apps/backend/specification.json
    - apps/backend/src/api/csrm-assessment-request/routes/01-csrm-assessment-request-workflow.ts
    - apps/csrm/docs/references/specification.json
    - apps/csrm/scripts/generate-openapi.mjs
    - apps/csrm/scripts/check-openapi-drift.mjs
    - apps/csrm/src/lib/api/generated/openapi.ts
key-decisions:
  - "Lock the generated contract at 105 operations: the three Phase 7 workflow operations replace the intentionally prohibited generic request DELETE operation."
  - "Remove only generator-invented datetime defaults after Strapi generation so the committed API contract is reproducible."
patterns-established:
  - "Backend OpenAPI source is copied byte-for-byte to the CSRM reference before openapi-typescript generation."
  - "Custom request actions expose explicit Zod path, body, and response schemas while retaining Strapi's standard documented error responses."
requirements-completed: [CSRM-05]
coverage:
  - id: D1
    description: Typed dashboard, submit, and withdraw operations are present in the generated backend, reference, and TypeScript contracts.
    requirement: CSRM-05
    verification:
      - kind: integration
        ref: IDAMBOX_SEED_CSRM=false IDAMBOX_KEYCLOAK_PROVISIONING=false yarn workspace backend openapi && cmp apps/backend/specification.json apps/csrm/docs/references/specification.json && yarn workspace @idambox/csrm generate:openapi && yarn workspace @idambox/csrm verify:openapi
        status: pass
    human_judgment: false
  - id: D2
    description: OpenAPI generation is reproducible, detects controlled temporary drift, and preserves the no-delete workflow boundary.
    requirement: CSRM-05
    verification:
      - kind: integration
        ref: yarn workspace @idambox/csrm verify:openapi && repeated backend OpenAPI SHA-256 comparison
        status: pass
    human_judgment: false
duration: 19m
completed: 2026-08-22
status: complete
---

# Phase 07 Plan 02: Typed Request Workflow OpenAPI Contract Summary

**Deterministic 105-operation Strapi OpenAPI contract with typed dashboard, submit, and withdraw request workflow endpoints.**

## Performance

- **Duration:** 19m
- **Started:** 2026-08-22T13:41:33Z
- **Completed:** 2026-08-22T14:00:50Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Added explicit Zod documentation schemas for the three protected workflow routes, producing typed action bodies, `id` parameters, success responses, and generated operation IDs.
- Regenerated the authoritative backend specification, copied it byte-for-byte to CSRM, and regenerated `openapi.ts` without reintroducing generic request deletion.
- Hardened contract drift checks to compare backend/reference bytes, detect a controlled mismatch in a temporary child, and confirm the committed type artifact remains untouched.

## Task Commits

1. **Task 1: Regenerate and lock the 105-operation OpenAPI contract** — `98db0b0` (RED contract gate), `1e75a92` (typed deterministic contract).

## Files Created/Modified

- `apps/backend/src/api/csrm-assessment-request/routes/01-csrm-assessment-request-workflow.ts` — typed metadata for the custom request-workflow routes.
- `apps/backend/scripts/normalize-openapi-specification.mjs` — removes only unstable generated datetime defaults after Strapi generation.
- `apps/backend/specification.json` and `apps/csrm/docs/references/specification.json` — synchronized 105-operation OpenAPI documents.
- `apps/csrm/scripts/{generate-openapi,check-openapi-drift}.mjs` — operation/no-delete assertions and non-mutating drift verification.
- `apps/csrm/src/lib/api/generated/openapi.ts` — generated dashboard, submit, withdraw, catalogue, and request transport types.

## Decisions Made

- Resolved the plan target to 105 operations after confirming that the secure Plan 07-01 removal of generic request DELETE changes the previous 103-operation baseline by +3 workflow operations and -1 DELETE operation.
- Kept Strapi's standard documented error responses rather than inventing a second schema source; explicit route metadata supplies typed request, parameter, and success contracts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Isolated OpenAPI generation from optional local bootstrap integrations**
- **Found during:** Task 1
- **Issue:** Local Keycloak provisioning and CSRM seed settings caused specification generation to attempt an unavailable Keycloak request.
- **Fix:** Ran the existing generator with `IDAMBOX_SEED_CSRM=false` and `IDAMBOX_KEYCLOAK_PROVISIONING=false`.
- **Verification:** Backend OpenAPI generation completed and produced the 105-operation contract.

**2. [Rule 3 - Blocking] Canonicalized generator-invented datetime defaults**
- **Found during:** Task 1
- **Issue:** Successive Strapi runs emitted changing datetime defaults, preventing a clean second-generation diff.
- **Fix:** Added a no-dependency post-generation normalizer that removes only generated ISO datetime defaults described as datetime fields.
- **Files modified:** `apps/backend/package.json`, `apps/backend/scripts/normalize-openapi-specification.mjs`
- **Verification:** Consecutive backend generation SHA-256 values matched exactly.
- **Committed in:** `1e75a92`

**Total deviations:** 2 Rule 3 blocking fixes; both preserve the planned contract and introduce no dependency or lockfile changes.

## Issues Encountered

- `yarn workspace @idambox/csrm verify` has three unrelated failing assertions: two in `src/config/capabilities.test.ts` and one in `src/lib/fixtures/resolve-identity.test.ts`. They still expect 23 capabilities while the committed catalogue contains 27. The details are recorded in `deferred-items.md`.

## Known Stubs

None.

## Verification

- `yarn workspace backend check-types` — passed.
- `IDAMBOX_SEED_CSRM=false IDAMBOX_KEYCLOAK_PROVISIONING=false yarn workspace backend openapi` — passed; repeated output SHA-256 matched.
- `cmp apps/backend/specification.json apps/csrm/docs/references/specification.json` — passed.
- `yarn workspace @idambox/csrm generate:openapi` — passed; second generation produced no diff.
- `yarn workspace @idambox/csrm verify:openapi` — passed, including controlled temporary mismatch detection and committed-artifact immutability.
- `yarn workspace @idambox/csrm verify` — failed only on the unrelated stale capability-count assertions recorded above.

## User Setup Required

None - no external service configuration required.

## Planning State Notes

- `state.advance-plan` and `state.update-progress` could not parse the legacy Phase 7 STATE.md table; the metric, decisions, session, and roadmap plan-progress handlers succeeded.
- `requirements.mark-complete CSRM-05` found no matching entry in the existing requirements register, as in Plan 07-01.

## Next Phase Readiness

Plan 07-03 can consume the checked-in generated request workflow types from the single backend-derived OpenAPI source.

## Self-Check: PASSED

Confirmed all generated and source artifacts exist and both task commits (`98db0b0`, `1e75a92`) are present in Git history.
