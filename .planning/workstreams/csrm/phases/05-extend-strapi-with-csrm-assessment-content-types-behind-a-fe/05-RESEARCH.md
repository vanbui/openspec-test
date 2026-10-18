# Phase 05: CSRM Backend Content Model - Research

**Researched:** 2026-05-29
**Status:** Complete

## Research Question

What does the planner need to know to implement feature-flagged CSRM assessment workflow collections in the existing Strapi 5 backend without crossing into Phase 6 frontend/authentication work?

## Source Inputs

- `.planning/phases/05-extend-strapi-with-csrm-assessment-content-types-behind-a-fe/05-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- Existing Strapi content types under `apps/backend/src/api/*`
- Existing verification scripts under `scripts/`
- Official Strapi 5 documentation:
  - https://docs.strapi.io/cms/backend-customization/models
  - https://docs.strapi.io/cms/backend-customization/routes
  - https://docs.strapi.io/cms/backend-customization/policies
  - https://docs.strapi.io/cms/api/document-service
  - https://docs.strapi.io/cms/typescript/development
  - https://docs.strapi.io/cms/configurations/environment

## Findings

### Strapi Model Shape

Strapi 5 content types are backed by `schema.json` files under `./src/api/[api-name]/content-types/[content-type-name]/`. A model schema defines content-type settings, admin/API info, attributes, and options. This matches the current repo's manual schema files for `application`, `entitlement`, `role`, and `idambox-user`.

Relevant implications for Phase 5:

- Use collection types with `options.draftAndPublish: false`, matching existing backend domain models and avoiding draft uniqueness ambiguity.
- Avoid a generic `status` attribute because this repo already documents that Strapi reserves `status`; use `requestStatus`, `assessmentStatus`, and `treatmentStatus`.
- Use explicit relation attributes with `target`, `mappedBy`, and `inversedBy` where bidirectional traversal matters.
- Use `json` for question `options` unless a later phase needs fully managed option records.
- Use `media` for file-upload answers only if Phase 5 decides to support actual uploaded files now. A lower-risk first cut is to model question answer as `json` and preserve answer type `File upload` for Phase 6 workflow handling.

### Relation Design

The context locks a request-centered aggregate:

- `csrm-assessment-request` links to many information assets and many information systems.
- `csrm-assessment-request` links to one questionnaire.
- Questionnaire links to many questions.
- `csrm-assessment-request` links to one assessment.
- Assessment links to zero or more risks.
- Risks can reference impacted asset and impacted system records.
- User ownership fields should relate to `api::idambox-user.idambox-user` where practical.

Recommended implementation:

- Use bidirectional relations for the request aggregate so Phase 6 can query from the request outward and from child records back to the request.
- Use `manyToMany` for request-to-assets and request-to-systems because the same asset/system may appear in more than one assessment request.
- Use `oneToOne` for request-to-questionnaire and request-to-assessment.
- Use `manyToOne` from question to questionnaire and from risk to assessment, with `oneToMany` inverses on questionnaire/assessment.
- Use user relations for `requestor`, `sponsor`, `generatedBy`, `reviewedBy`, `approvedBy`, `riskOwner`, and `treatmentOwner`.

### Feature Flag Guarding

Strapi content types are normally registered from project files at boot. The selected Phase 5 behavior is not to remove schema files when disabled. Instead, app-facing behavior must be guarded when `csrmAppIsEnabled=false`.

Strapi routes can be configured with policies and middleware. Policies are a good fit for read-only allow/deny checks. The plan should add a shared CSRM flag helper and apply a policy to every CSRM core router action. The policy should:

- Allow requests only when `process.env.csrmAppIsEnabled === "true"`.
- Return a forbidden/not-found style response when disabled.
- Be reusable across all CSRM routes.

The service layer can also expose the flag helper so custom CSRM service behavior cannot bypass the route guard accidentally in later phases.

### Environment Configuration

The repo already uses explicit environment flags:

- `IDAMBOX_SEED_CORE`
- `IDAMBOX_SEED_CSRM`
- `IDAMBOX_KEYCLOAK_PROVISIONING`

Phase 5 should document the exact roadmap flag `csrmAppIsEnabled=false` in `apps/backend/.env.example` and backend docs. This is camelCase, but the roadmap and context name it explicitly, so plans should not silently rename it.

### Verification Strategy

The repo favors static verification scripts that parse schemas, source files, documentation, and package scripts. Phase 5 should add `scripts/verify-csrm-model.mjs` and root script `verify:csrm-model`.

The verifier should assert:

- All seven CSRM schema files exist and are collection types.
- Locked enum values are present for request status, assessment status, data classification, system environment, lifecycle state, answer type, treatment action, and treatment status.
- Locked relationship targets exist.
- No CSRM schema uses generic `status`.
- CSRM route files include the feature-flag policy.
- `apps/backend/.env.example` and docs mention `csrmAppIsEnabled`.
- `package.json` contains `verify:csrm-model`.

Plan verification should also run:

- `yarn verify:csrm-model`
- `yarn verify:schema`
- `yarn verify:csrm-seed`
- `yarn verify:keycloak-provisioning`
- `yarn check-types`

### Type Generation

Strapi 5 supports generating TypeScript schema typings with `ts:generate-types`. The current repo already has `apps/backend/types/generated/contentTypes.d.ts`; after adding new content types, execution should either regenerate this file or deliberately leave it untouched only if `yarn check-types` proves the project does not require updated generated types.

## Validation Architecture

Phase 5 can be validated without Docker by static schema/source checks plus TypeScript compilation:

- Add a static CSRM model verifier before closeout.
- Run the verifier after schema and guard tasks.
- Keep Docker/runtime verification manual because this phase is a backend model foundation and existing workflow already accepts static verification for Strapi schema contracts.

## Planning Recommendation

Use three plans:

1. **CSRM Content-Type Schemas**: create all seven content types with relationships and enums.
2. **CSRM Feature Flag Guarding**: add `csrmAppIsEnabled` config helper/policy and apply it to all CSRM route files.
3. **CSRM Verification, Documentation, And Types**: add static verifier, docs/env updates, generated type handling, and full verification commands.

## Research Complete

This research is sufficient for planning Phase 5. No blockers found.
