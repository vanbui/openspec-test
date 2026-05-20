---
phase: 1
phase_name: Strapi Backend Foundation
plan: 1
title: Monorepo And Strapi Backend Scaffold
type: implementation
wave: 1
depends_on: []
files_modified:
  - package.json
  - turbo.json
  - .gitignore
  - apps/backend/package.json
  - apps/backend/tsconfig.json
  - apps/backend/config/admin.ts
  - apps/backend/config/api.ts
  - apps/backend/config/database.ts
  - apps/backend/config/middlewares.ts
  - apps/backend/config/plugins.ts
  - apps/backend/config/server.ts
  - apps/backend/src/index.ts
  - apps/backend/types/generated/.gitkeep
autonomous: true
requirements_addressed:
  - MONO-01
  - MONO-02
  - MONO-03
  - BACK-01
  - BACK-03
---

<objective>
Create the IdamBox Turbo monorepo scaffold and a runnable Strapi backend application at `apps/backend`, following the closest local example project shape.
</objective>

<context>
Phase 1 is backend-only. Use `example-projects/edalas-dylan` as the primary structure reference: Yarn workspaces, Turbo, `apps/backend`, and future `apps/*` modules. Do not add a Next.js app in this plan.
</context>

<must_haves>
<truths>
- Phase 1 must create only the Strapi backend, not an application frontend.
- The backend must live at `apps/backend`.
- Root scripts must make backend development possible from the repository root.
- Strapi native admin authentication is the only authentication required in this phase.
</truths>
</must_haves>

<threat_model>
**Assets:** Strapi admin access, environment secrets, local development database.
**Threats:**
- HIGH: accidentally committing `.env` or local database files.
- MEDIUM: root scripts that start unexpected apps or hide backend failures.
- MEDIUM: insecure default production assumptions in database/server config.
**Mitigations:**
- Add `.env`, `.env.*`, `.tmp`, `dist`, `build`, and Strapi upload/temp outputs to `.gitignore`.
- Keep root scripts explicit and backend-focused for Phase 1.
- Use environment-driven Strapi config and safe local defaults.
**Residual Risk:** Admin account creation is manual through Strapi's first-run admin flow.
</threat_model>

<tasks>
<task id="1" type="implementation">
<title>Create root workspace configuration</title>
<files>
- `package.json`
- `turbo.json`
- `.gitignore`
</files>
<action>
Create a private root package using Yarn workspaces with `apps/*` and `packages/*`. Add scripts for `dev`, `build`, `start`, `develop:cms`, `build:cms`, `check-types`, `lint`, and `format`, routing through Turbo or the backend filter as appropriate. Add a Turbo config comparable to the local example but scoped to generic `build`, `dev`, `lint`, and `check-types` tasks.
</action>
<verify>
Root `package.json` declares workspaces and scripts. `turbo.json` includes non-cached persistent dev task and build/type-check task definitions. `.gitignore` excludes dependency, build, env, and Strapi runtime artifacts.
</verify>
<acceptance_criteria>
- Developer can identify `apps/backend` as the Phase 1 app from root scripts.
- Future `apps/*` packages can be added without changing the workspace declaration.
</acceptance_criteria>
</task>

<task id="2" type="implementation">
<title>Create Strapi backend package shell</title>
<files>
- `apps/backend/package.json`
- `apps/backend/tsconfig.json`
- `apps/backend/types/generated/.gitkeep`
</files>
<action>
Create the backend package with Strapi 5 dependencies matching the closest examples where practical. Include scripts for `dev`, `develop`, `build`, `start`, `strapi`, `lint`, and `check-types`. Configure TypeScript in the same style as the example backend.
</action>
<verify>
Backend package has Strapi scripts and TypeScript configuration. Type generation output directory is present but does not require generated files to be committed.
</verify>
<acceptance_criteria>
- `apps/backend` is a standalone Strapi package inside the workspace.
- Backend package scripts align with root scripts.
</acceptance_criteria>
</task>

<task id="3" type="implementation">
<title>Add baseline Strapi configuration</title>
<files>
- `apps/backend/config/admin.ts`
- `apps/backend/config/api.ts`
- `apps/backend/config/database.ts`
- `apps/backend/config/middlewares.ts`
- `apps/backend/config/plugins.ts`
- `apps/backend/config/server.ts`
- `apps/backend/src/index.ts`
</files>
<action>
Add minimal Strapi configuration files using TypeScript. Use environment-driven server and database settings. Support SQLite for local development and keep the database config extensible for PostgreSQL. Keep `src/index.ts` minimal; do not register custom services unless needed by Strapi startup.
</action>
<verify>
Configuration files match Strapi 5 project structure and avoid hard-coded secrets. `src/index.ts` exports `register` and `bootstrap` hooks or an empty default object compatible with Strapi.
</verify>
<acceptance_criteria>
- Backend can be configured through environment variables.
- Phase 1 requires no frontend or Auth0 config.
</acceptance_criteria>
</task>
</tasks>

<verification>
Run these checks after implementation:
- `git status --short` to confirm intended files changed.
- `yarn install` if dependencies are not installed.
- `yarn check-types` or `yarn build` if dependency installation succeeds.
- Inspect root scripts and backend scripts for correct names and filters.
</verification>

<success_criteria>
- Root monorepo config exists and follows the `apps/*` pattern.
- `apps/backend` exists as the Strapi backend package.
- Native Strapi admin auth remains the Phase 1 admin path.
- No frontend app is created.
</success_criteria>
