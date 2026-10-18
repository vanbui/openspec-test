# Phase 1 Walking Skeleton

## User story

**As a** CSRM developer, **I want to** start one repository and use a responsive, capability-projected application shell with a typed Strapi service seam, **so that** later workflow slices have a secure and reproducible foundation.

## Locked architectural decisions

- Root: pnpm workspaces plus Turborepo and one root `pnpm-lock.yaml` (D-03).
- Backend: copy the sibling source into `apps/strapi`; retain the sibling unchanged and exclude nested Git, `.planning`, dependencies, runtime state, old locks, and local `.env` (D-01, D-02, D-04).
- Web: strict TypeScript Next.js App Router, semantic BProton-led tokens, and a light-first responsive AppShell (D-09 through D-12).
- Identity: server-side adapter seam with HTTP-only secure-cookie settings; the development role selector is isolated and never authorizes Strapi (D-05 through D-08).
- Data: committed OpenAPI-generated transport types, one server transport client, and feature services; no Next.js API facade (D-13 through D-16).

## Walking path

`pnpm dev` -> `apps/web` server layout -> session/capability adapters -> AppShell/navigation/state components -> typed feature service -> Strapi API boundary.

Strapi remains responsible for Role -> Function -> FunctionAPI and record-level enforcement. The development selector changes only frontend fixture presentation; it is not a Strapi authorization credential.

## Acceptance path

1. Start root Turbo development tasks after the approved package installation.
2. Open the web shell at desktop and mobile widths, use the accessible navigation, and switch the development fixture role.
3. Observe capability-projected navigation and permission-denied presentation without treating either as backend authorization.
4. Run generated-type drift, typecheck, unit/component, Strapi authorization-harness, and Playwright accessibility checks.
