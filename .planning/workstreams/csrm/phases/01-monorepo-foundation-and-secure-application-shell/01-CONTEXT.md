# Phase 1: Monorepo Foundation and Secure Application Shell - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the existing sibling Strapi application into this repository as `apps/strapi`; establish a pnpm/Turborepo root and a strict-TypeScript Next.js App Router application at `apps/web`; and provide the reusable shell, development authentication seam, typed API seam, design tokens, and test foundation that every later CSRM phase uses.

This phase does not implement the Requestor workflow, live Keycloak integration, live capability API, or full production feature endpoints.

</domain>

<decisions>
## Implementation Decisions

### Strapi Migration
- **D-01:** Copy the sibling Strapi project's working source into `apps/strapi` as a fresh workspace. Retain the existing sibling repository unchanged as a backup; do not import its Git history or retain nested `.git` metadata.
- **D-02:** The root repository's `.planning` directory is authoritative. Exclude the prior Strapi `.planning` directory.
- **D-03:** Adopt pnpm workspaces at the repository root with a single root `pnpm-lock.yaml`; migrate Strapi away from its current mixed npm/Yarn lockfile state.
- **D-04:** Copy all existing Strapi project files except `node_modules`. Any copied `.env` remains local-only and must be Git-ignored; it must never be staged or committed. Preserve/review `.env.example`.

### Foundation Sign-in Experience
- **D-05:** Phase 1 uses a centralized role-switching development session behind the same auth/capability adapter boundary intended for production.
- **D-06:** The production-ready browser session seam uses HTTP-only secure cookies. Do not use localStorage for access tokens.
- **D-07:** The Phase 1 development switcher is powered by a simple role flag, isolated in the adapter rather than scattered through UI components. It is a temporary development seam and must be replaceable by effective CSRM capabilities.
- **D-08:** Production authentication returns users to the protected page they originally requested after a successful Keycloak sign-in.

### Initial CSRM Visual Direction
- **D-09:** Establish a BProton-led visual treatment now, but express every visual decision through semantic CSRM tokens rather than raw component-level values.
- **D-10:** Use balanced enterprise density: compact navigation and data views with comfortable controls and generous spacing in forms and details.
- **D-11:** Ship a polished light-first theme only. Token architecture must permit dark mode later without page rewrites.
- **D-12:** Until approved brand assets are available, render a deliberately replaceable `IdamBox CSRM` text wordmark component.

### Contract-first Development
- **D-13:** Generate frontend transport types from the supplied OpenAPI document through a repeatable development/build step; commit generated output.
- **D-14:** Keep generated client/types internal. Feature code consumes domain-specific typed service modules that map transport data to domain/UI models.
- **D-15:** When a required operation is absent from OpenAPI, record a backend-contract gap. Only a fixture or HTTP-level test double behind the typed service seam may temporarily represent it; do not add a Next.js API facade.
- **D-16:** CI regenerates OpenAPI output and runs a clean typecheck; it fails when committed generated output drifts.

### the agent's Discretion
- Select specific pnpm/Turbo/OpenAPI generation packages and scripts after current-version research, while preserving the decisions above.
- Define the initial semantic token values from the approved public BProton reference without hard-coding them throughout components.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product, scope, and design
- `docs/CSRM-PROJECT-BRIEF.md` §§1, 11–17, 21–27, 29–33 — authoritative product scope, UX, frontend stack, API architecture, security, testing, and Phase 1 strategy.
- `docs/references/ux/` — enterprise UX inspiration only; do not copy it literally.

### CSRM domain and API contract
- `docs/references/specification.json` — authoritative Strapi paths, operations, parameters, request bodies, and schemas.
- `docs/references/idambox-datamodel.jdl` — authoritative CSRM entities, statuses, relationships, and terminology.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` — role/function/FunctionAPI capability traceability.

### Existing backend to migrate
- `../strapi/package.json` — existing Strapi 5.51.0 package and scripts to migrate into the pnpm workspace.
- `../strapi/config/middlewares.ts` — established Strapi security/CORS middleware baseline.
- `../strapi/config/plugins.ts` — existing refresh-session and upload type restrictions to preserve or deliberately revise.
- `../strapi/.env.example` — environment-variable example to review and preserve; never read or commit `.env` secrets.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing Strapi 5.51.0 source/configuration under `../strapi`: the backend is an established application to migrate, not a new backend to scaffold.
- `../strapi/config/middlewares.ts`: already enables Strapi security, CORS, session, and standard middleware layers.
- `../strapi/config/plugins.ts`: already configures refresh-token session handling and conservative upload MIME allow/deny lists.

### Established Patterns
- The sibling backend has both `package-lock.json` and `yarn.lock`; Phase 1 must converge on the root pnpm workflow rather than carry both forward.
- No frontend or codebase map exists in this repository yet, so `apps/web` establishes the initial feature-oriented Next.js conventions.

### Integration Points
- Root `package.json`, `pnpm-workspace.yaml`, Turbo configuration, and CI scripts orchestrate `apps/strapi` and `apps/web`.
- The Next.js auth/capability adapter calls the typed CSRM service boundary; the production implementation ultimately supplies Keycloak access tokens to Strapi.
- OpenAPI generation consumes `docs/references/specification.json` and produces committed transport code that typed feature services wrap.

</code_context>

<specifics>
## Specific Ideas

- The existing Strapi sibling stays intact as a backup after a source-level copy into `apps/strapi`.
- The role-switching developer experience must be easy to replace, not a shortcut to permanent `role === "analyst"` checks throughout the application.
- The application shell should feel recognisably BProton/IdamBox from the first phase, even before official logo assets are supplied.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 1-Monorepo Foundation and Secure Application Shell*  
*Context gathered: 2026-08-27*
