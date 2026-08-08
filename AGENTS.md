# IdamBox Agent Guide

## Project Context

IdamBox is being rebuilt as a Strapi-backed platform foundation for multiple BProton application modules. The first milestone is a backend-only Strapi foundation with a core data model for IdamBox users, Roles, Applications, application-owned Functions, and FunctionApi operation grants.

Read `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` before planning or implementing phase work.

## Current Scope

Phase 1: Strapi Backend Foundation

- Create a Turbo monorepo following `example-projects/edalas-dylan`.
- Put the Strapi backend under `apps/backend`.
- Use native Strapi admin authentication for Phase 1.
- Create custom IdamBox content types for user, Role, Application, Function, and FunctionApi.
- Keep Phase 1 backend-only; do not add a Next.js frontend unless the roadmap changes.

## Important Boundaries

- Do not use Strapi admin users as IdamBox product users.
- Do not implement Auth0 until a future app phase.
- Do not add free-floating fine-grained permission strings; model application access through FunctionApi operation grants attached to application-owned Functions.
- Preserve the authorization path: `IdamBoxUser -> Role -> Function -> Application`, with `Function.functionApis` supplying operation-level grants.
- Do not recreate historical Entitlement or ApplicationRole content types from older planning artifacts; the accepted live contract is Application/Function/FunctionApi/Role.

## GSD Workflow

Next step: `$gsd-plan-phase 1`

For implementation work, keep changes scoped to the active phase and verify the phase success criteria before completion.
