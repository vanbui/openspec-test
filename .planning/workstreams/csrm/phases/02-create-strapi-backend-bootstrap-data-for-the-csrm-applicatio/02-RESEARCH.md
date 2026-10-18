# Phase 2: CSRM Bootstrap Data - Research

## RESEARCH COMPLETE

**Phase:** 2 - CSRM Bootstrap Data  
**Date:** 2026-05-24  
**Purpose:** Determine the implementation shape needed to plan CSRM bootstrap data safely and verifiably.

## Scope Read

Phase 2 adds boot-time Strapi bootstrap data only:

- CSRM `Application`: `name: "IdamBox CSRM"`, `slug: "idambox-csrm"`, description expands Cybersecurity Risk Manager.
- CSRM `ApplicationRole` records: `Security Analyst`, `Security Analyst Agent`.
- Matching reusable `Role` records for both application roles.
- Active IdamBox users: Jane Doe and Bob Doe.
- Bob assigned to the reusable `Security Analyst` role.
- Jane active with no role assignments.
- Seed activation controlled by `IDAMBOX_SEED_CSRM=true|false`.

Out of scope: Keycloak, Strapi-to-Keycloak provisioning, CSRM content collections, and the CSRM Next.js app.

## Existing Implementation Pattern

### Bootstrap Entry Point

`apps/backend/src/index.ts` already uses Strapi's bootstrap hook:

- Imports `seedCoreData` from `./bootstrap/seed-core-data`.
- Calls `await seedCoreData(strapi)` in `bootstrap({ strapi })`.

Phase 2 should add a second seed helper and invoke it from this same bootstrap path.

### Existing Seed Helper

`apps/backend/src/bootstrap/seed-core-data.ts` provides the closest implementation analog:

- Uses `process.env.IDAMBOX_SEED_CORE !== 'true'` as an opt-in guard.
- Uses `strapi.documents('api::application.application')` and `strapi.documents('api::application-role.application-role')`.
- Finds applications by `slug` before creating them.
- Finds application roles by `name` plus owning application before creating them.

This pattern should be reused, but Phase 2 must not fold CSRM data into `IDAMBOX_SEED_CORE`.

## Content Model Findings

### Application

`apps/backend/src/api/application/content-types/application/schema.json` supports:

- `name` required and unique.
- `slug` required UID targeting `name`.
- `description` text.
- `status` required enum, default `active`.
- `applicationRoles` one-to-many relation to `api::application-role.application-role`.

The CSRM app can be looked up by `slug: "idambox-csrm"` and created with `status: "active"`.

### Application Role

`apps/backend/src/api/application-role/content-types/application-role/schema.json` supports:

- `name` required.
- `description` text.
- Required many-to-one `application` relation to `api::application.application`.
- Many-to-many `roles` relation mapped by reusable roles.

The seed should look up application roles by `name` plus CSRM application document ID.

### Role

`apps/backend/src/api/role/content-types/role/schema.json` supports:

- `name` required and unique.
- `description` text.
- Many-to-many `applicationRoles` relation to `api::application-role.application-role`.
- Many-to-many `idamboxUsers` relation mapped by IdamBox users.

The seed should look up roles by unique `name`. When creating or updating the matching role, it must associate the corresponding CSRM application role.

### IdamBox User

`apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json` supports:

- `email` required and unique.
- `firstName`, `lastName`, `displayName`.
- `status` enum with default `active`.
- Optional unique `externalSubject`.
- Private `password`.
- Many-to-many `roles` relation to `api::role.role`.

The seed should look up users by email. Jane should be created active with no roles. Bob should be created active and related to the reusable `Security Analyst` role.

## Implementation Considerations

### Recommended Files

- Add `apps/backend/src/bootstrap/seed-csrm-data.ts`.
- Update `apps/backend/src/index.ts` to call `seedCsrmData(strapi)` after `seedCoreData(strapi)`.
- Update `apps/backend/.env.example` with `IDAMBOX_SEED_CSRM=false`.
- Update `apps/backend/README.md` with CSRM seed docs.
- Add or extend a verification script under `scripts/`, preferably `scripts/verify-csrm-seed.mjs`.
- Update root `package.json` with a script such as `verify:csrm-seed`.

### Idempotency

Idempotency should be explicit for each record type:

- Application: find by `slug: "idambox-csrm"`.
- Application roles: find by `name` and CSRM application relation.
- Reusable roles: find by `name`.
- Users: find by `email`.

The plan should require that the seed avoids duplicate creates and preserves required relationships if a record already exists.

### Relation Wiring

The executor should verify the document service relation payloads against the current Strapi 5 document-service behavior already used in `seed-core-data.ts`. The existing seed passes relation document IDs directly for application ownership. The role/user many-to-many relations need special care because they are the new relation writes in this phase.

## Validation Architecture

The phase can be validated without launching a live Strapi instance:

- Static source verification can assert the exact CSRM seed constants: `IDAMBOX_SEED_CSRM`, `IdamBox CSRM`, `idambox-csrm`, `Security Analyst`, `Security Analyst Agent`, `jane.doe@idambox.com`, and `bob.doe@idambox.com`.
- Schema verification can reuse `scripts/verify-core-model.mjs` expectations for the four content types and relationships.
- Idempotency-focused verification can inspect the seed source for lookup-before-create behavior for applications, application roles, roles, and users.
- Type checking through `yarn check-types` should catch TypeScript integration errors.
- A full `yarn build` remains useful, but Phase 1 showed Strapi/esbuild may need sandbox escalation.

## Planning Recommendation

Create one implementation plan in Wave 1 that covers CSRM seed code, env/docs, and verification. This phase is cohesive and all work touches the same backend bootstrap surface, so splitting into multiple plans would add sequencing overhead without reducing risk.
