# Phase 05: CSRM Backend Content Model - Pattern Map

**Generated:** 2026-05-29
**Status:** Ready for planning

## Files To Create Or Modify

### New CSRM API content types

- `apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json`
- `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`
- `apps/backend/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts`
- `apps/backend/src/api/csrm-assessment-request/services/csrm-assessment-request.ts`
- Equivalent controller/route/service/schema folders for:
  - `csrm-information-asset`
  - `csrm-information-system`
  - `csrm-questionnaire`
  - `csrm-question`
  - `csrm-assessment`
  - `csrm-risk`

### Shared CSRM guard/config

- `apps/backend/src/csrm/config.ts`
- `apps/backend/src/policies/csrm-app-enabled.ts`

### Verification and docs

- `scripts/verify-csrm-model.mjs`
- `package.json`
- `apps/backend/.env.example`
- `apps/backend/README.md`
- `README.md`
- `apps/backend/types/generated/contentTypes.d.ts` if type generation changes it

## Existing Analogs

### Content type schema pattern

Analog files:

- `apps/backend/src/api/application/content-types/application/schema.json`
- `apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json`
- `apps/backend/src/api/role/content-types/role/schema.json`

Pattern:

- Use `"kind": "collectionType"`.
- Use deterministic `"collectionName"` values.
- Use `info.singularName`, `info.pluralName`, `info.displayName`, and `info.description`.
- Set `"options": { "draftAndPublish": false }`.
- Put relations under `attributes` with `type`, `relation`, `target`, `mappedBy`, and `inversedBy`.

### Controller, route, service pattern

Analog files:

- `apps/backend/src/api/application/controllers/application.ts`
- `apps/backend/src/api/application/routes/application.ts`
- `apps/backend/src/api/application/services/application.ts`

Pattern:

- Import `factories` from `@strapi/strapi`.
- Export `factories.createCoreController('api::name.name')`.
- Export `factories.createCoreRouter('api::name.name')`.
- Export `factories.createCoreService('api::name.name')`.

### Environment flag pattern

Analog files:

- `apps/backend/src/keycloak/config.ts`
- `apps/backend/.env.example`

Pattern:

- Keep feature activation explicit and environment-driven.
- Return a simple boolean/config object from a helper.
- Document default disabled behavior in `.env.example`.

### Static verifier pattern

Analog files:

- `scripts/verify-core-model.mjs`
- `scripts/verify-csrm-seed.mjs`
- `scripts/verify-keycloak-provisioning.mjs`

Pattern:

- Use Node `readFileSync` and `JSON.parse`.
- Define small `assert` and `assertIncludes` helpers.
- Fail by throwing an error with a clear message.
- End with a single success `console.log`.

## Implementation Notes For Plans

- Do not reuse Strapi admin users for CSRM ownership fields; relate to `api::idambox-user.idambox-user`.
- Do not add Next.js files in Phase 5.
- Do not add Keycloak CSRM authorization roles/groups.
- Use `requestStatus`, `assessmentStatus`, and `treatmentStatus`; do not add a generic `status` field to CSRM schemas.
